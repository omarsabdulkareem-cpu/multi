import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Layers,
  MapPin,
  Boxes,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  ArrowRightLeft,
  Calendar,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Maximize2,
  Sliders,
  Warehouse as WarehouseIcon,
  RefreshCw,
  Info,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { WarehouseLocation, Warehouse, InventoryBalance, BulkBag } from '../types';

export type HeatmapMetricMode = 'OCCUPANCY' | 'DENSITY' | 'BULK_BAGS';
export type TimeRangeOption = '7D' | '14D' | '30D';

interface ZoneData extends WarehouseLocation {
  occupancyPct: number;
  densityKGperM2: number;
  dominantMaterial: string;
  materialBreakdown: { materialName: string; materialCode: string; weightKG: number; bagsCount: number }[];
  status: 'OPTIMAL' | 'MODERATE' | 'CONGESTED' | 'VACANT';
}

interface HistoricalDataPoint {
  date: Date;
  dateStr: string;
  totalOccupancyPct: number;
  totalWeightKG: number;
  wh01Pct: number;
  wh02Pct: number;
  wh03Pct: number;
  wh04Pct: number;
  netDeltaKG: number;
  significantEvent?: string;
  significantEventAr?: string;
}

interface StorageD3HeatmapAndTimelineProps {
  onSelectLocationForTransfer?: (locId: string) => void;
  onFilterByLocation?: (locCode: string) => void;
}

export const StorageD3HeatmapAndTimeline: React.FC<StorageD3HeatmapAndTimelineProps> = ({
  onSelectLocationForTransfer,
  onFilterByLocation,
}) => {
  const { isRTL } = useLanguage();
  const {
    warehouses,
    locations,
    inventoryBalances,
    bulkBags,
    inventoryMovements,
  } = useFactory();

  // Controls State
  const [metricMode, setMetricMode] = useState<HeatmapMetricMode>('OCCUPANCY');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('30D');
  const [activeSeries, setActiveSeries] = useState<{ [key: string]: boolean }>({
    total: true,
    wh01: true,
    wh02: true,
    wh03_04: true,
  });

  // SVG Refs
  const heatmapSvgRef = useRef<SVGSVGElement | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement | null>(null);
  const timelineSvgRef = useRef<SVGSVGElement | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timelineTooltipRef = useRef<HTMLDivElement | null>(null);

  // Compute Live Zone Enriched Data
  const enrichedZones: ZoneData[] = useMemo(() => {
    return locations.map((loc) => {
      // Find bags currently in this location
      const bagsInLoc = bulkBags.filter(
        (b) => b.locationId === loc.id || b.locationCode === loc.code
      );
      const bagWeightSum = bagsInLoc.reduce((acc, b) => acc + (b.weightKG || 0), 0);

      // Find balances in this location
      const balancesInLoc = inventoryBalances.filter(
        (bal) => bal.locationId === loc.id || bal.locationCode === loc.code
      );
      const balanceWeightSum = balancesInLoc.reduce(
        (acc, b) => acc + (b.availableKG || b.totalBalanceKG || 0),
        0
      );

      // Total KG: Prefer bag sum if bags exist, otherwise balance sum, otherwise loc.currentKG
      const computedWeightKG = bagWeightSum > 0 ? bagWeightSum : (balanceWeightSum > 0 ? balanceWeightSum : (loc.currentKG || 0));
      const computedBagsCount = bagsInLoc.length > 0 ? bagsInLoc.length : (loc.bulkBagsCount || Math.ceil(computedWeightKG / 1000));

      const capacity = loc.capacityKG > 0 ? loc.capacityKG : 30000;
      const occupancyPct = Math.min(100, Math.round((computedWeightKG / capacity) * 100));

      // Estimated floor surface area in m²: based on capacity (approx 1500 kg per m² of industrial rack footprint)
      const approxAreaM2 = Math.max(12, Math.round(capacity / 1500));
      const densityKGperM2 = Math.round(computedWeightKG / approxAreaM2);

      // Material breakdown
      const matMap = new Map<string, { materialName: string; materialCode: string; weightKG: number; bagsCount: number }>();
      bagsInLoc.forEach((b) => {
        const key = b.materialId || b.materialName || 'GEN';
        const cur = matMap.get(key) || {
          materialName: b.materialName || 'خام عام',
          materialCode: b.materialCode || 'MAT',
          weightKG: 0,
          bagsCount: 0,
        };
        cur.weightKG += b.weightKG || 0;
        cur.bagsCount += 1;
        matMap.set(key, cur);
      });

      if (matMap.size === 0 && balancesInLoc.length > 0) {
        balancesInLoc.forEach((bal) => {
          matMap.set(bal.materialId, {
            materialName: bal.materialName || 'خام',
            materialCode: bal.materialCode || 'MAT',
            weightKG: bal.availableKG || bal.totalBalanceKG || 0,
            bagsCount: bal.bulkBagsCount || 1,
          });
        });
      }

      const materialBreakdown = Array.from(matMap.values()).sort((a, b) => b.weightKG - a.weightKG);
      const dominantMaterial = materialBreakdown[0]?.materialName || (isRTL ? 'موقع فارغ / جاهز للتخزين' : 'Empty / Available Bay');

      let status: 'OPTIMAL' | 'MODERATE' | 'CONGESTED' | 'VACANT' = 'OPTIMAL';
      if (occupancyPct === 0) status = 'VACANT';
      else if (occupancyPct > 85) status = 'CONGESTED';
      else if (occupancyPct > 65) status = 'MODERATE';
      else status = 'OPTIMAL';

      return {
        ...loc,
        currentKG: computedWeightKG,
        bulkBagsCount: computedBagsCount,
        occupancyPct,
        densityKGperM2,
        dominantMaterial,
        materialBreakdown,
        status,
      };
    });
  }, [locations, bulkBags, inventoryBalances, isRTL]);

  // Filter zones by warehouse selector
  const displayedZones = useMemo(() => {
    if (selectedWarehouseId === 'ALL') return enrichedZones;
    return enrichedZones.filter((z) => z.warehouseId === selectedWarehouseId);
  }, [enrichedZones, selectedWarehouseId]);

  // Aggregate Metrics for Header HUD
  const overallMetrics = useMemo(() => {
    const totalCap = displayedZones.reduce((sum, z) => sum + z.capacityKG, 0);
    const totalWeight = displayedZones.reduce((sum, z) => sum + z.currentKG, 0);
    const totalBags = displayedZones.reduce((sum, z) => sum + z.bulkBagsCount, 0);
    const avgOccupancy = totalCap > 0 ? Math.round((totalWeight / totalCap) * 100) : 0;
    const congestedCount = displayedZones.filter((z) => z.occupancyPct >= 85).length;
    const vacantCount = displayedZones.filter((z) => z.occupancyPct < 25).length;

    return {
      totalCap,
      totalWeight,
      totalBags,
      avgOccupancy,
      congestedCount,
      vacantCount,
      totalBays: displayedZones.length,
    };
  }, [displayedZones]);

  // -------------------------------------------------------------
  // D3 REAL-TIME HEATMAP RENDERING
  // -------------------------------------------------------------
  useEffect(() => {
    if (!heatmapSvgRef.current || !heatmapContainerRef.current) return;

    const svg = d3.select(heatmapSvgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = heatmapContainerRef.current.clientWidth || 900;
    const isMobile = containerWidth < 640;
    const margin = { top: 20, right: 25, bottom: 40, left: isMobile ? 30 : 65 };
    const width = containerWidth - margin.left - margin.right;

    // Group zones by Warehouse
    const groupedByWh = d3.group(displayedZones, (d: ZoneData) => d.warehouseId);
    const whKeys: string[] = Array.from(groupedByWh.keys()) as string[];
    const rowHeight = isMobile ? 120 : 100;
    const height = Math.max(260, whKeys.length * rowHeight) + margin.top + margin.bottom;

    svg.attr('width', containerWidth).attr('height', height + 20);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Color Scales based on Metric Mode
    // 1. Occupancy: Green (0-40%) -> Cyan (40-65%) -> Amber (65-85%) -> Crimson (>85%)
    const occupancyColorScale = d3
      .scaleLinear<string>()
      .domain([0, 35, 65, 85, 100])
      .range(['#10b981', '#06b6d4', '#f59e0b', '#f43f5e', '#ef4444']);

    // 2. Density (KG/m²): 0 -> 2500+
    const densityColorScale = d3
      .scaleSequential(d3.interpolateYlOrRd)
      .domain([0, 2200]);

    // 3. Bulk Bags: 0 -> 60
    const bagsColorScale = d3
      .scaleSequential(d3.interpolateBlues)
      .domain([0, 60]);

    const getColor = (zone: ZoneData) => {
      if (zone.occupancyPct === 0) return '#1e293b';
      if (metricMode === 'OCCUPANCY') return occupancyColorScale(zone.occupancyPct);
      if (metricMode === 'DENSITY') return densityColorScale(zone.densityKGperM2);
      return bagsColorScale(zone.bulkBagsCount);
    };

    // Draw Warehouse Rows
    whKeys.forEach((whId: string, rowIndex: number) => {
      const whZones: ZoneData[] = Array.from(groupedByWh.get(whId) || []) as ZoneData[];
      const whMeta = warehouses.find((w) => w.id === whId);
      const rowY = rowIndex * rowHeight;

      // Warehouse Row Label
      const whLabel = g
        .append('g')
        .attr('transform', `translate(-10, ${rowY + 28})`)
        .attr('class', 'cursor-pointer select-none')
        .on('click', () => setSelectedWarehouseId(selectedWarehouseId === whId ? 'ALL' : whId));

      whLabel
        .append('text')
        .attr('text-anchor', isRTL ? 'start' : 'end')
        .attr('x', isRTL ? 5 : -5)
        .attr('y', 0)
        .attr('fill', '#94a3b8')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'monospace')
        .text(whId);

      whLabel
        .append('text')
        .attr('text-anchor', isRTL ? 'start' : 'end')
        .attr('x', isRTL ? 5 : -5)
        .attr('y', 14)
        .attr('fill', '#64748b')
        .attr('font-size', '9.5px')
        .attr('font-weight', 'normal')
        .text(whMeta ? (isRTL ? whMeta.nameAr.slice(0, 15) : whMeta.nameEn.slice(0, 15)) : '');

      // Calculate cell widths inside this warehouse row
      const cellGap = 10;
      const availableWidth = width - (isMobile ? 10 : 30);
      const colCount = Math.max(whZones.length, 1);
      const cellWidth = Math.min(180, Math.max(90, (availableWidth - (colCount - 1) * cellGap) / colCount));
      const cellHeight = rowHeight - 24;

      whZones.forEach((zone: ZoneData, colIndex: number) => {
        const cellX = colIndex * (cellWidth + cellGap);
        const cellY = rowY + 6;
        const color = getColor(zone);
        const isCongested = zone.occupancyPct >= 85;
        const isSelected = selectedZone?.id === zone.id;

        const cellGroup = g
          .append('g')
          .attr('transform', `translate(${cellX}, ${cellY})`)
          .attr('class', 'cursor-pointer transition-transform duration-200 hover:scale-[1.02]')
          .on('click', () => {
            setSelectedZone(zone);
          })
          .on('mouseenter', (event) => {
            if (!tooltipRef.current) return;
            const tooltip = d3.select(tooltipRef.current);
            tooltip.style('opacity', '1');

            // Position tooltip
            const [mx, my] = d3.pointer(event, heatmapContainerRef.current);
            tooltip
              .style('left', `${Math.min(containerWidth - 280, Math.max(10, mx - 120))}px`)
              .style('top', `${my + 25}px`);

            // Tooltip Content
            tooltip.html(`
              <div class="p-3 rounded-xl bg-slate-950/95 border border-cyan-500/40 text-xs shadow-2xl backdrop-blur-md max-w-xs space-y-2 pointer-events-none">
                <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></span>
                    <strong class="font-mono text-white text-sm">${zone.code}</strong>
                  </div>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-cyan-300">
                    ${zone.occupancyPct}% ${isRTL ? 'إشغال' : 'Occupied'}
                  </span>
                </div>
                <div class="text-[11px] text-slate-300 font-semibold truncate">
                  ${isRTL ? zone.nameAr : zone.nameEn}
                </div>
                <div class="grid grid-cols-2 gap-2 text-[10px] font-mono bg-black/40 p-2 rounded-lg border border-white/5">
                  <div>
                    <span class="text-slate-400 block">${isRTL ? 'الوزن الحالي:' : 'Current Mass:'}</span>
                    <span class="font-bold text-emerald-400">${(zone.currentKG || 0).toLocaleString()} KG</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block">${isRTL ? 'السعة الكلية:' : 'Total Cap:'}</span>
                    <span class="font-bold text-slate-300">${(zone.capacityKG || 0).toLocaleString()} KG</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block">${isRTL ? 'عدد الشلايف:' : 'Bulk Bags:'}</span>
                    <span class="font-bold text-amber-400">${zone.bulkBagsCount} / ${zone.maxBags || 60}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block">${isRTL ? 'الكثافة السطحية:' : 'Area Density:'}</span>
                    <span class="font-bold text-cyan-300">${zone.densityKGperM2} KG/m²</span>
                  </div>
                </div>
                <div class="text-[10px] text-slate-300">
                  <span class="text-slate-400 block mb-0.5">${isRTL ? 'المادة السائدة:' : 'Dominant Material:'}</span>
                  <span class="font-medium text-white truncate block">📦 ${zone.dominantMaterial}</span>
                </div>
                ${isCongested ? `
                  <div class="p-1.5 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 text-[9.5px] font-medium flex items-center gap-1">
                    <span>⚠️</span>
                    <span>${isRTL ? 'تنبيه: تشبع تخزيني مرتفع! يفضل تدوير الشلايف إلى عنبر بديل.' : 'Near capacity: Space reallocation suggested.'}</span>
                  </div>
                ` : ''}
              </div>
            `);
          })
          .on('mouseleave', () => {
            if (tooltipRef.current) {
              d3.select(tooltipRef.current).style('opacity', '0');
            }
          });

        // Background Box with gradient / border
        cellGroup
          .append('rect')
          .attr('width', cellWidth)
          .attr('height', cellHeight)
          .attr('rx', 10)
          .attr('fill', color)
          .attr('fill-opacity', zone.occupancyPct === 0 ? 0.35 : 0.88)
          .attr('stroke', isSelected ? '#38bdf8' : isCongested ? '#f43f5e' : 'rgba(255, 255, 255, 0.15)')
          .attr('stroke-width', isSelected ? 3 : isCongested ? 2 : 1)
          .attr('stroke-dasharray', isSelected ? '4 2' : 'none');

        // Pulse dot on congested cells
        if (isCongested) {
          cellGroup
            .append('circle')
            .attr('cx', cellWidth - 12)
            .attr('cy', 12)
            .attr('r', 4)
            .attr('fill', '#ef4444')
            .attr('class', 'animate-ping')
            .attr('opacity', 0.8);

          cellGroup
            .append('circle')
            .attr('cx', cellWidth - 12)
            .attr('cy', 12)
            .attr('r', 3.5)
            .attr('fill', '#ef4444');
        }

        // Inner Content Text
        // 1. Zone Code
        cellGroup
          .append('text')
          .attr('x', 10)
          .attr('y', 18)
          .attr('fill', '#ffffff')
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('font-family', 'monospace')
          .text(zone.code);

        // 2. Zone Name
        cellGroup
          .append('text')
          .attr('x', 10)
          .attr('y', 33)
          .attr('fill', 'rgba(255, 255, 255, 0.85)')
          .attr('font-size', '9.5px')
          .attr('font-weight', '500')
          .text((isRTL ? zone.nameAr : zone.nameEn).slice(0, 18));

        // 3. Metric Value Display
        let metricDisplay = `${zone.occupancyPct}%`;
        let subtext = `${(zone.currentKG || 0).toLocaleString()} KG`;
        if (metricMode === 'DENSITY') {
          metricDisplay = `${zone.densityKGperM2}`;
          subtext = 'KG/m²';
        } else if (metricMode === 'BULK_BAGS') {
          metricDisplay = `${zone.bulkBagsCount}`;
          subtext = isRTL ? 'أكياس شليف' : 'Bags';
        }

        cellGroup
          .append('text')
          .attr('x', 10)
          .attr('y', cellHeight - 18)
          .attr('fill', '#ffffff')
          .attr('font-size', '14px')
          .attr('font-weight', '900')
          .attr('font-family', 'monospace')
          .text(metricDisplay);

        cellGroup
          .append('text')
          .attr('x', cellWidth - 8)
          .attr('y', cellHeight - 18)
          .attr('text-anchor', 'end')
          .attr('fill', 'rgba(255, 255, 255, 0.75)')
          .attr('font-size', '9px')
          .attr('font-mono', 'true')
          .text(subtext);

        // 4. Mini Progress Track Bar at bottom of cell
        const trackHeight = 3.5;
        cellGroup
          .append('rect')
          .attr('x', 8)
          .attr('y', cellHeight - 7)
          .attr('width', cellWidth - 16)
          .attr('height', trackHeight)
          .attr('rx', 1.5)
          .attr('fill', 'rgba(0,0,0,0.4)');

        cellGroup
          .append('rect')
          .attr('x', 8)
          .attr('y', cellHeight - 7)
          .attr('width', Math.max(2, ((cellWidth - 16) * zone.occupancyPct) / 100))
          .attr('height', trackHeight)
          .attr('rx', 1.5)
          .attr('fill', '#ffffff');
      });
    });
  }, [displayedZones, metricMode, selectedWarehouseId, selectedZone, warehouses, isRTL]);

  // -------------------------------------------------------------
  // HISTORICAL TIME-SERIES DATA GENERATION (Past 30 Days)
  // -------------------------------------------------------------
  const historicalTimelineData: HistoricalDataPoint[] = useMemo(() => {
    const daysCount = timeRange === '7D' ? 7 : timeRange === '14D' ? 14 : 30;
    const now = new Date();
    const result: HistoricalDataPoint[] = [];

    // Current totals as baseline for day 0 (today)
    const currentTotalCap = locations.reduce((acc, l) => acc + l.capacityKG, 0) || 280000;
    const currentTotalKG = locations.reduce((acc, l) => acc + l.currentKG, 0) || 165000;

    // Daily historical points going backwards
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Simulate realistic physical dynamics of Al-Karwan factory operations over the past 30 days
      // Sine wave periodic deliveries (every 4-5 days) with production depletion and shredding loops
      const dayFactor = Math.sin((i * Math.PI) / 3.5) * 12000;
      const noise = ((i * 17) % 7 - 3) * 2500;
      const seasonalBase = currentTotalKG - (i * 850);
      const simulatedKG = Math.max(80000, Math.min(currentTotalCap * 0.95, seasonalBase + dayFactor + noise));
      const simulatedPct = Math.min(98, Math.max(35, Math.round((simulatedKG / currentTotalCap) * 100)));

      // Warehouse-specific distributions
      const wh01Pct = Math.min(95, Math.max(30, Math.round(simulatedPct * 1.05 + ((i % 4) - 2) * 3)));
      const wh02Pct = Math.min(90, Math.max(25, Math.round(simulatedPct * 0.88 + ((i % 5) - 2) * 4)));
      const wh03Pct = Math.min(85, Math.max(20, Math.round(simulatedPct * 0.75 + ((i % 3) - 1) * 3)));
      const wh04Pct = Math.min(90, Math.max(20, Math.round(simulatedPct * 0.82)));

      // Significant factory milestones annotations
      let significantEvent: string | undefined = undefined;
      let significantEventAr: string | undefined = undefined;
      if (i === 24) {
        significantEvent = 'Bulk Delivery Doc 546: +42,000 KG PET Flakes';
        significantEventAr = 'توريد إرسالية ضخمة مستند 546: +42 طن رقائق PET';
      } else if (i === 16) {
        significantEvent = 'Continuous Shredder 360 Campaign: Regrind stock peak';
        significantEventAr = 'حملة تشغيل مستمرة لمفرمة 360: ذروة رصيد المجروش';
      } else if (i === 7) {
        significantEvent = 'Mass Extrusion Run: High production feed consumption';
        significantEventAr = 'سحب تشغيلي مكثف لخطوط البثق وصرف خامات';
      } else if (i === 1) {
        significantEvent = 'RFID Portal Audit & Live Balance Reconcile';
        significantEventAr = 'جرد ومطابقة أرصدة بوابات RFID الذكية';
      }

      result.push({
        date: d,
        dateStr,
        totalOccupancyPct: simulatedPct,
        totalWeightKG: Math.round(simulatedKG),
        wh01Pct,
        wh02Pct,
        wh03Pct,
        wh04Pct,
        netDeltaKG: Math.round(dayFactor),
        significantEvent,
        significantEventAr,
      });
    }

    return result;
  }, [locations, timeRange]);

  // Timeline Statistics
  const timelineStats = useMemo(() => {
    if (historicalTimelineData.length === 0) {
      return { peakPct: 0, peakDate: '', avgPct: 0, netDelta: 0, turnoverDays: 14 };
    }
    const maxItem = historicalTimelineData.reduce((prev, cur) => (cur.totalOccupancyPct > prev.totalOccupancyPct ? cur : prev), historicalTimelineData[0]);
    const avgPct = Math.round(historicalTimelineData.reduce((acc, d) => acc + d.totalOccupancyPct, 0) / historicalTimelineData.length);
    const startKG = historicalTimelineData[0].totalWeightKG;
    const endKG = historicalTimelineData[historicalTimelineData.length - 1].totalWeightKG;
    const netDelta = endKG - startKG;

    return {
      peakPct: maxItem.totalOccupancyPct,
      peakDate: maxItem.dateStr,
      avgPct,
      netDelta,
      turnoverDays: 18,
    };
  }, [historicalTimelineData]);

  // -------------------------------------------------------------
  // D3 HISTORICAL TIME-SERIES CHART RENDERING
  // -------------------------------------------------------------
  useEffect(() => {
    if (!timelineSvgRef.current || !timelineContainerRef.current || historicalTimelineData.length === 0) return;

    const svg = d3.select(timelineSvgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = timelineContainerRef.current.clientWidth || 900;
    const margin = { top: 25, right: 30, bottom: 35, left: 50 };
    const width = containerWidth - margin.left - margin.right;
    const height = 240 - margin.top - margin.bottom;

    svg.attr('width', containerWidth).attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Gradients Definition for Area Fills
    const defs = svg.append('defs');

    // Total Gradient (Cyan/Teal)
    const totalGrad = defs
      .append('linearGradient')
      .attr('id', 'totalAreaGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    totalGrad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.45);
    totalGrad.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.0);

    // Scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(historicalTimelineData, (d) => d.date) as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    // Horizontal Grid Lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickValues([25, 50, 75, 100])
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .selectAll('line')
      .attr('stroke', 'rgba(255, 255, 255, 0.06)')
      .attr('stroke-dasharray', '3 3');

    // X Axis
    const xAxis = d3
      .axisBottom<Date>(xScale)
      .ticks(containerWidth < 600 ? 5 : 8)
      .tickFormat((d) => d3.timeFormat('%b %d')(d as Date));

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Y Axis (Percentage)
    const yAxis = d3
      .axisLeft(yScale)
      .tickValues([0, 25, 50, 75, 100])
      .tickFormat((d) => `${d}%`);

    g.append('g')
      .call(yAxis)
      .attr('color', '#64748b')
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Capacity Threshold Warning Line (85%)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', yScale(85))
      .attr('y2', yScale(85))
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', 0.65);

    g.append('text')
      .attr('x', width - 8)
      .attr('y', yScale(85) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#f43f5e')
      .attr('font-size', '9px')
      .attr('font-mono', 'true')
      .text(isRTL ? 'حد التحذير من التشبع 85%' : '85% Capacity Alert Line');

    // Line Generators
    const lineGenerator = (key: keyof HistoricalDataPoint) =>
      d3
        .line<HistoricalDataPoint>()
        .curve(d3.curveMonotoneX)
        .x((d) => xScale(d.date))
        .y((d) => yScale((d[key] as number) || 0));

    // Area Generator for Total
    if (activeSeries.total) {
      const areaGen = d3
        .area<HistoricalDataPoint>()
        .curve(d3.curveMonotoneX)
        .x((d) => xScale(d.date))
        .y0(height)
        .y1((d) => yScale(d.totalOccupancyPct));

      g.append('path')
        .datum(historicalTimelineData)
        .attr('fill', 'url(#totalAreaGrad)')
        .attr('d', areaGen);
    }

    // Render Sub-Series (WH-01, WH-02, WH-03_04)
    if (activeSeries.wh01) {
      g.append('path')
        .datum(historicalTimelineData)
        .attr('fill', 'none')
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 1.6)
        .attr('stroke-opacity', 0.75)
        .attr('d', lineGenerator('wh01Pct'));
    }

    if (activeSeries.wh02) {
      g.append('path')
        .datum(historicalTimelineData)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1.6)
        .attr('stroke-opacity', 0.75)
        .attr('d', lineGenerator('wh02Pct'));
    }

    if (activeSeries.wh03_04) {
      g.append('path')
        .datum(historicalTimelineData)
        .attr('fill', 'none')
        .attr('stroke', '#a855f7')
        .attr('stroke-width', 1.6)
        .attr('stroke-opacity', 0.75)
        .attr('d', lineGenerator('wh03Pct'));
    }

    // Render Total Series Curve (Prominent)
    if (activeSeries.total) {
      g.append('path')
        .datum(historicalTimelineData)
        .attr('fill', 'none')
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 2.8)
        .attr('d', lineGenerator('totalOccupancyPct'));
    }

    // Milestone Event Markers on Timeline
    historicalTimelineData.forEach((point) => {
      if (point.significantEvent) {
        const cx = xScale(point.date);
        const cy = yScale(point.totalOccupancyPct);

        const markerG = g
          .append('g')
          .attr('transform', `translate(${cx}, ${cy})`)
          .attr('class', 'cursor-pointer');

        markerG
          .append('circle')
          .attr('r', 5)
          .attr('fill', '#06b6d4')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5);

        markerG
          .append('circle')
          .attr('r', 9)
          .attr('fill', 'none')
          .attr('stroke', '#06b6d4')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '2 2')
          .attr('opacity', 0.85);
      }
    });

    // Crosshair & Scrubber Hover Overlay
    const focusG = g.append('g').style('display', 'none');

    // Vertical line
    const vLine = focusG
      .append('line')
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', 'rgba(255, 255, 255, 0.4)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3 3');

    // Dot at total curve
    const dotTotal = focusG
      .append('circle')
      .attr('r', 5)
      .attr('fill', '#06b6d4')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Overlay Rect to catch pointer
    svg
      .append('rect')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .attr('class', 'cursor-crosshair')
      .on('mouseenter', () => {
        focusG.style('display', null);
        if (timelineTooltipRef.current) {
          d3.select(timelineTooltipRef.current).style('opacity', '1');
        }
      })
      .on('mouseleave', () => {
        focusG.style('display', 'none');
        if (timelineTooltipRef.current) {
          d3.select(timelineTooltipRef.current).style('opacity', '0');
        }
      })
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, timelineSvgRef.current);
        const graphX = mx - margin.left;
        const xDate = xScale.invert(graphX);

        // Bisect to find closest data point
        const bisect = d3.bisector<HistoricalDataPoint, Date>((d) => d.date).left;
        const index = bisect(historicalTimelineData, xDate, 1);
        const d0 = historicalTimelineData[index - 1];
        const d1 = historicalTimelineData[index];
        let d = d0;
        if (d1 && xDate.getTime() - d0.date.getTime() > d1.date.getTime() - xDate.getTime()) {
          d = d1;
        }

        if (!d) return;

        const cx = xScale(d.date);
        const cy = yScale(d.totalOccupancyPct);

        vLine.attr('x1', cx).attr('x2', cx);
        dotTotal.attr('cx', cx).attr('cy', cy);

        // Tooltip Content & Position
        if (timelineTooltipRef.current) {
          const tooltip = d3.select(timelineTooltipRef.current);
          const [tipX, tipY] = d3.pointer(event, timelineContainerRef.current);

          tooltip
            .style('left', `${Math.min(containerWidth - 270, Math.max(10, tipX - 110))}px`)
            .style('top', `${Math.max(10, tipY - 140)}px`)
            .html(`
              <div class="p-3 rounded-xl bg-slate-950/95 border border-cyan-500/40 text-xs shadow-2xl backdrop-blur-md space-y-1.5 max-w-xs pointer-events-none">
                <div class="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span class="font-bold text-white font-mono">${d.dateStr}</span>
                  <span class="font-mono text-cyan-400 font-bold">${d.totalOccupancyPct}% ${isRTL ? 'إشغال' : 'Occupancy'}</span>
                </div>
                <div class="text-[11px] text-slate-300 font-mono">
                  ${isRTL ? 'إجمالي المخزون:' : 'Stored Mass:'} <strong class="text-emerald-400 font-bold">${d.totalWeightKG.toLocaleString()} KG</strong>
                </div>
                <div class="space-y-1 text-[10px] font-mono pt-1 border-t border-slate-800/80">
                  <div class="flex justify-between items-center text-blue-400">
                    <span>${isRTL ? 'مستودع الخامات WH-01:' : 'WH-01 Raw:'}</span>
                    <span class="font-bold">${d.wh01Pct}%</span>
                  </div>
                  <div class="flex justify-between items-center text-amber-400">
                    <span>${isRTL ? 'مستودع الثرم WH-02:' : 'WH-02 Regrind:'}</span>
                    <span class="font-bold">${d.wh02Pct}%</span>
                  </div>
                  <div class="flex justify-between items-center text-purple-400">
                    <span>${isRTL ? 'صالة الإنتاج والتام WH-03/04:' : 'WH-03/04 Buffer:'}</span>
                    <span class="font-bold">${d.wh03Pct}%</span>
                  </div>
                </div>
                ${d.significantEvent ? `
                  <div class="mt-1 p-1.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-200 text-[9.5px]">
                    📍 ${isRTL ? d.significantEventAr : d.significantEvent}
                  </div>
                ` : ''}
              </div>
            `);
        }
      });
  }, [historicalTimelineData, activeSeries, isRTL]);

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------- */}
      {/* SECTION 1: REAL-TIME D3 HEATMAP CARD */}
      {/* ----------------------------------------------------------- */}
      <div className="rounded-3xl bg-gradient-to-b from-[#0f1422] to-[#0a0d17] border border-cyan-500/30 shadow-2xl p-5 sm:p-6 space-y-5 relative overflow-hidden">
        {/* Subtle Ambient Backlight Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Control Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                D3.JS SPATIAL HEATMAP
              </span>
              <span className="text-xs text-slate-400">
                {isRTL ? 'خريطة الكثافة والإشغال المكاني الحية' : 'Real-Time Space Utilization & Density'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>{isRTL ? 'المصفوفة الحرارية لإشغال وكثافة مستودعات وعنابر المصنع' : 'Warehouse Heatmap & Space Utilization Engine'}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {isRTL
                ? 'رصد فوري لنسب ملء الأرفف وكثافة الأحمال السطحية (كغم/م²) لتفادي تكدس الشلايف وتحسين مسارات الروافع الشوكية.'
                : 'Live structural density (KG/m²) and volumetric rack occupancy tracking across factory store zones.'}
            </p>
          </div>

          {/* Metric Mode Selectors & Warehouse Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Metric Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setMetricMode('OCCUPANCY')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  metricMode === 'OCCUPANCY'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRTL ? 'نسبة الإشغال (%)' : 'Occupancy (%)'}
              </button>

              <button
                type="button"
                onClick={() => setMetricMode('DENSITY')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  metricMode === 'DENSITY'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRTL ? 'الكثافة (كغم/م²)' : 'Density (KG/m²)'}
              </button>

              <button
                type="button"
                onClick={() => setMetricMode('BULK_BAGS')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  metricMode === 'BULK_BAGS'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {isRTL ? 'الشلايف (أكياس)' : 'Bulk Bags'}
              </button>
            </div>

            {/* Warehouse Filter Selector */}
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="ALL">{isRTL ? '🏭 جميع المستودعات (شامل)' : 'All Warehouses'}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {isRTL ? w.nameAr : w.nameEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Telemetry KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'متوسط إشغال المصنع' : 'Avg Occupancy'}</span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-mono font-black ${overallMetrics.avgOccupancy > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {overallMetrics.avgOccupancy}%
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                ({(overallMetrics.totalWeight / 1000).toFixed(1)} / {(overallMetrics.totalCap / 1000).toFixed(0)} T)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'إجمالي الشلايف المخزنة' : 'Total Stored Bags'}</span>
            <div className="text-xl font-mono font-black text-amber-300">
              {overallMetrics.totalBags.toLocaleString()} <span className="text-xs text-slate-400 font-normal">{isRTL ? 'شليف' : 'Bags'}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'عنابر عالية التشبع (>85%)' : 'Congested Bays'}</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-xl font-mono font-black ${overallMetrics.congestedCount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                {overallMetrics.congestedCount}
              </span>
              <span className="text-[10px] text-slate-400">
                {overallMetrics.congestedCount > 0 ? (isRTL ? 'يتطلب تدوير' : 'Reallocate') : (isRTL ? 'مثالي' : 'Nominal')}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'عنابر شاغرة أو منخفضة' : 'Vacant Bays'}</span>
            <div className="text-xl font-mono font-black text-cyan-400">
              {overallMetrics.vacantCount} <span className="text-xs text-slate-400 font-normal">/ {overallMetrics.totalBays} {isRTL ? 'عنبر' : 'Bays'}</span>
            </div>
          </div>
        </div>

        {/* D3 SVG Canvas Container */}
        <div ref={heatmapContainerRef} className="relative w-full overflow-x-auto bg-slate-950/70 rounded-2xl border border-slate-800/80 p-2 sm:p-4">
          <svg ref={heatmapSvgRef} className="w-full select-none" />

          {/* D3 Floating Tooltip Container */}
          <div
            ref={tooltipRef}
            className="absolute transition-opacity duration-150 opacity-0 pointer-events-none z-30"
          />
        </div>

        {/* Dynamic Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 px-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-semibold">{isRTL ? 'دليل الألوان والمؤشرات:' : 'Heatmap Scale:'}</span>
            {metricMode === 'OCCUPANCY' ? (
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> 0-40% (شاغر)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-cyan-500 inline-block" /> 40-65% (متوازن)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" /> 65-85% (مرتفع)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" /> &gt;85% (حرج/متكدس)
                </span>
              </div>
            ) : metricMode === 'DENSITY' ? (
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span>0 كغم/م² (فارغ)</span>
                <div className="w-28 h-2.5 rounded bg-gradient-to-r from-yellow-300 via-orange-500 to-rose-600" />
                <span className="text-rose-400 font-bold">&gt;2200 كغم/م² (حمولة قصوى)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span>1 شليف</span>
                <div className="w-28 h-2.5 rounded bg-gradient-to-r from-blue-300 via-blue-600 to-indigo-900" />
                <span className="text-blue-300 font-bold">60 شليف (رص هرمي كامل)</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isRTL ? 'انقر على أي عنبر لفتح تفاصيل المواد وإطلاق أمر مناقلة فوري' : 'Click any bay cell to drill down or initiate transfer'}</span>
          </div>
        </div>

        {/* Selected Zone Deep-Dive Card (if clicked) */}
        {selectedZone && (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-xl space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <MapPin className="w-4 h-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-base">{selectedZone.code}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                      {selectedZone.occupancyPct}% {isRTL ? 'إشغال' : 'Occupancy'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {isRTL ? selectedZone.warehouseNameAr : selectedZone.warehouseNameEn}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                    {isRTL ? selectedZone.nameAr : selectedZone.nameEn} ({selectedZone.zone})
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onSelectLocationForTransfer && (
                  <button
                    type="button"
                    onClick={() => onSelectLocationForTransfer(selectedZone.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'مناقلة من/إلى هذا الموقع' : 'Transfer Stock'}</span>
                  </button>
                )}

                {onFilterByLocation && (
                  <button
                    type="button"
                    onClick={() => onFilterByLocation(selectedZone.code)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isRTL ? 'تصفية الجدول' : 'Filter Table'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedZone(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Zone Telemetry Metrics & Material List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'الوزن والسعة' : 'Weight & Capacity'}</span>
                <div className="text-sm font-mono font-bold text-white">
                  {(selectedZone.currentKG || 0).toLocaleString()} <span className="text-slate-400 font-normal">/ {(selectedZone.capacityKG || 0).toLocaleString()} KG</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full ${
                      selectedZone.occupancyPct > 85 ? 'bg-rose-500' : selectedZone.occupancyPct > 65 ? 'bg-amber-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${selectedZone.occupancyPct}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'الشلايف والكثافة' : 'Bags & Density'}</span>
                <div className="text-sm font-mono font-bold text-amber-300">
                  {selectedZone.bulkBagsCount} <span className="text-slate-400 font-normal">/ {selectedZone.maxBags || 60} شليف</span>
                </div>
                <div className="text-[11px] font-mono text-cyan-300">
                  {selectedZone.densityKGperM2} KG/m² {isRTL ? 'حمولة أرضية' : 'Floor Load'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'توجيه المساحة الذكي' : 'Space Advisory'}</span>
                <p className="text-[11px] text-slate-300 leading-tight">
                  {selectedZone.occupancyPct >= 85
                    ? isRTL
                      ? '⚠️ الموقع قريب من الحد الأقصى. يوصى بنقل 2-4 أكياس إلى مستودع أو ساحة أخرى.'
                      : '⚠️ Near capacity. Recommend shifting 2-4 bags to secondary buffers.'
                    : selectedZone.occupancyPct < 25
                    ? isRTL
                      ? '✓ الموقع متاح وجاهز لاستيعاب الشحنات الواردة الجديدة ذات الحجم الكبير.'
                      : '✓ High vacancy. Ideal staging zone for incoming bulk polymer shipments.'
                    : isRTL
                    ? '✓ التشغيل ضمن النطاق الأمثل لحركة المناولة والسلامة المهنية.'
                    : '✓ Operating within optimal utilization thresholds.'}
                </p>
              </div>
            </div>

            {/* Materials Breakdown Table if exists */}
            {selectedZone.materialBreakdown.length > 0 && (
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wider">
                  {isRTL ? 'الأصناف المخزنة حالياً في هذا العنبر:' : 'Materials currently in this bay:'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {selectedZone.materialBreakdown.map((mat, idx) => (
                    <div key={mat.materialCode + idx} className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white truncate max-w-[150px]">{mat.materialName}</div>
                        <div className="text-[10px] font-mono text-cyan-400">{mat.materialCode}</div>
                      </div>
                      <div className="text-end font-mono">
                        <div className="font-bold text-emerald-400">{mat.weightKG.toLocaleString()} KG</div>
                        <div className="text-[10px] text-amber-400">{mat.bagsCount} {isRTL ? 'أكياس' : 'Bags'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------- */}
      {/* SECTION 2: HISTORICAL TIME-SERIES CHART (Past 30 Days) */}
      {/* ----------------------------------------------------------- */}
      <div className="rounded-3xl bg-gradient-to-b from-[#0f1422] to-[#0a0d17] border border-indigo-500/30 shadow-2xl p-5 sm:p-6 space-y-5 relative overflow-hidden">
        {/* Subtle Ambient Backlight Glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Time-Series Header Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-indigo-400" />
                D3.JS TEMPORAL TIME-SERIES
              </span>
              <span className="text-xs text-slate-400">
                {isRTL ? 'تطور نسب الإشغال على مدار 30 يوماً' : 'Historical Occupancy Evolution (Past 30 Days)'}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              <span>{isRTL ? 'السلسلة الزمنية لتذبذب وتراكم المخزون (30 يوماً)' : '30-Day Warehouse Occupancy Dynamics & Trend'}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {isRTL
                ? 'تحليل الاتجاه الزمني لمعدلات الاستلام والاستهلاك اليومي ومقارنة التذبذبات بين مستودع الخامات ومخزن الثرم.'
                : 'Historical trend curves mapping receiving surges, shredding regeneration cycles, and production floor drains.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Time Range Chips */}
            <div className="flex items-center p-1 bg-slate-900/90 border border-slate-700/80 rounded-xl text-xs font-bold font-mono">
              {(['7D', '14D', '30D'] as TimeRangeOption[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    timeRange === r
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {r === '7D' ? (isRTL ? '7 أيام' : '7 Days') : r === '14D' ? (isRTL ? '14 يوماً' : '14 Days') : (isRTL ? '30 يوماً' : '30 Days')}
                </button>
              ))}
            </div>

            {/* Series Toggles */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveSeries((prev) => ({ ...prev, total: !prev.total }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                  activeSeries.total
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                }`}
              >
                ● {isRTL ? 'إجمالي المصنع' : 'Total Factory'}
              </button>

              <button
                type="button"
                onClick={() => setActiveSeries((prev) => ({ ...prev, wh01: !prev.wh01 }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                  activeSeries.wh01
                    ? 'bg-blue-950 text-blue-300 border-blue-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                }`}
              >
                ● WH-01 {isRTL ? 'خامات' : 'Raw'}
              </button>

              <button
                type="button"
                onClick={() => setActiveSeries((prev) => ({ ...prev, wh02: !prev.wh02 }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                  activeSeries.wh02
                    ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                }`}
              >
                ● WH-02 {isRTL ? 'ثرم' : 'Regrind'}
              </button>

              <button
                type="button"
                onClick={() => setActiveSeries((prev) => ({ ...prev, wh03_04: !prev.wh03_04 }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                  activeSeries.wh03_04
                    ? 'bg-purple-950 text-purple-300 border-purple-500/50'
                    : 'bg-slate-900 text-slate-500 border-slate-800 line-through'
                }`}
              >
                ● WH-03/04 {isRTL ? 'إنتاج' : 'Buffer'}
              </button>
            </div>
          </div>
        </div>

        {/* 30-Day Performance Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'ذروة الإشغال (Peak)' : 'Peak Occupancy'}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-mono font-black text-rose-400">{timelineStats.peakPct}%</span>
              <span className="text-[10px] text-slate-500 font-mono">{timelineStats.peakDate}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'المتوسط الشهري' : '30-Day Avg'}</span>
            <div className="text-xl font-mono font-black text-indigo-300">
              {timelineStats.avgPct}% <span className="text-xs text-slate-400 font-normal">{isRTL ? 'نسبة استغلال' : 'Utilization'}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'صافي التغير التراكمي' : 'Net Mass Delta'}</span>
            <div className="flex items-center gap-1.5 font-mono text-xl font-black">
              {timelineStats.netDelta >= 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">+{(timelineStats.netDelta / 1000).toFixed(1)} T</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span className="text-rose-400">{(timelineStats.netDelta / 1000).toFixed(1)} T</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-mono">{isRTL ? 'معدل دوران المخزون' : 'Turnover Index'}</span>
            <div className="text-xl font-mono font-black text-cyan-400">
              {timelineStats.turnoverDays} <span className="text-xs text-slate-400 font-normal">{isRTL ? 'يوماً بالمستودع' : 'Days on floor'}</span>
            </div>
          </div>
        </div>

        {/* D3 Time-Series SVG Chart Container */}
        <div ref={timelineContainerRef} className="relative w-full bg-slate-950/70 rounded-2xl border border-slate-800/80 p-2 sm:p-4">
          <svg ref={timelineSvgRef} className="w-full select-none" />

          {/* D3 Timeline Floating Tooltip */}
          <div
            ref={timelineTooltipRef}
            className="absolute transition-opacity duration-150 opacity-0 pointer-events-none z-30"
          />
        </div>

        {/* Historical Time-Series Footnote & Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 px-1">
          <div className="flex items-center gap-3 text-slate-400 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
              {isRTL ? 'نقاط الدوائر = أحداث توريد وثرم هامة' : 'Points = Milestone inventory events'}
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-4 h-0.5 bg-rose-500 inline-block border-t border-dashed" />
              {isRTL ? 'الخط المتقطع = عتبة التحذير 85%' : 'Dashed line = 85% Warning threshold'}
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            {isRTL
              ? 'مرر مؤشر الفأرة على المخطط لقراءة الأرصدة الدقيقة وتفاصيل كل مستودع في ذلك التاريخ'
              : 'Hover across the scrubber line for daily warehouse breakdowns'}
          </div>
        </div>
      </div>
    </div>
  );
};
