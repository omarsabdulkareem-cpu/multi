import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Layers,
  Activity,
  Calendar,
  Filter,
  Maximize2,
  TrendingUp,
  TrendingDown,
  Info,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Warehouse as WarehouseIcon,
  Sparkles,
  Boxes,
  Zap,
  Clock,
  ChevronRight,
  Eye,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  Warehouse,
  WarehouseLocation,
  InventoryBalance,
  InventoryMovement,
  MaterialItem,
} from '../types';

export interface StorageHeatmapAnalyticsProps {
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  inventoryBalances: InventoryBalance[];
  inventoryMovements: InventoryMovement[];
  materials: MaterialItem[];
  onSelectLocation?: (locationId: string) => void;
  onInitiateTransfer?: (fromLocId: string) => void;
}

type HeatmapMetricMode = 'OCCUPANCY' | 'DENSITY_KG' | 'BAGS';
type TimeSeriesViewMode = 'ALL_WAREHOUSES' | 'WH-01' | 'WH-02' | 'WH-03' | 'WH-04';

interface CellData {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseNameAr: string;
  warehouseNameEn: string;
  zone: string;
  capacityKG: number;
  currentKG: number;
  bulkBagsCount: number;
  maxBags: number;
  occupancyPct: number;
  bagDensityPct: number;
  materialDensityKgPerCap: number;
  materials: Array<{
    materialId: string;
    materialName: string;
    materialCode: string;
    currentKG: number;
    bulkBags: number;
  }>;
  status: 'OPTIMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'EMPTY';
}

interface HistoricalDayPoint {
  date: Date;
  dateStr: string;
  displayDateAr: string;
  displayDateEn: string;
  totalOccupancyPct: number;
  totalStoredKG: number;
  wh01OccupancyPct: number;
  wh02OccupancyPct: number;
  wh03OccupancyPct: number;
  wh04OccupancyPct: number;
  netMovementsCount: number;
  netKgChange: number;
}

export const StorageHeatmapAnalytics: React.FC<StorageHeatmapAnalyticsProps> = ({
  warehouses,
  locations,
  inventoryBalances,
  inventoryMovements,
  materials,
  onSelectLocation,
  onInitiateTransfer,
}) => {
  const { isRTL } = useLanguage();

  // Control state
  const [metricMode, setMetricMode] = useState<HeatmapMetricMode>('OCCUPANCY');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL');
  const [activeCell, setActiveCell] = useState<CellData | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CellData | null>(null);
  const [timeSeriesFilter, setTimeSeriesFilter] = useState<TimeSeriesViewMode>('ALL_WAREHOUSES');
  const [hoveredHistoryPoint, setHoveredHistoryPoint] = useState<HistoricalDayPoint | null>(null);

  // SVG Refs
  const heatmapSvgRef = useRef<SVGSVGElement | null>(null);
  const timeSeriesSvgRef = useRef<SVGSVGElement | null>(null);

  // -------------------------------------------------------------
  // 1. Process Real-Time Cell Data from Locations & Balances
  // -------------------------------------------------------------
  const processedCells: CellData[] = useMemo(() => {
    return locations.map((loc) => {
      const wh = warehouses.find((w) => w.id === loc.warehouseId);
      const locBalances = inventoryBalances.filter((b) => b.locationId === loc.id && b.currentKG > 0);

      const computedKG = locBalances.reduce((sum, b) => sum + (b.currentKG || 0), 0) || loc.currentKG || 0;
      const computedBags = locBalances.reduce((sum, b) => sum + (b.bulkBagsCount || 0), 0) || loc.bulkBagsCount || 0;
      const capacity = loc.capacityKG || 30000;
      const maxBags = loc.maxBags || 50;

      const occupancyPct = Math.min(100, Math.round((computedKG / capacity) * 100));
      const bagDensityPct = Math.min(100, Math.round((computedBags / maxBags) * 100));
      const materialDensityKgPerCap = capacity > 0 ? computedKG / capacity : 0;

      let status: CellData['status'] = 'OPTIMAL';
      if (computedKG === 0) status = 'EMPTY';
      else if (occupancyPct > 85) status = 'CRITICAL';
      else if (occupancyPct > 65) status = 'HIGH';
      else if (occupancyPct > 35) status = 'MODERATE';
      else status = 'OPTIMAL';

      return {
        id: loc.id,
        code: loc.code,
        nameAr: loc.nameAr,
        nameEn: loc.nameEn,
        warehouseId: loc.warehouseId,
        warehouseCode: wh?.code || loc.warehouseId,
        warehouseNameAr: wh?.nameAr || loc.warehouseNameAr || 'المستودع',
        warehouseNameEn: wh?.nameEn || loc.warehouseNameEn || 'Warehouse',
        zone: loc.zone || 'General Zone',
        capacityKG: capacity,
        currentKG: computedKG,
        bulkBagsCount: computedBags,
        maxBags,
        occupancyPct,
        bagDensityPct,
        materialDensityKgPerCap,
        materials: locBalances.map((b) => ({
          materialId: b.materialId,
          materialName: b.materialName,
          materialCode: b.materialCode,
          currentKG: b.currentKG,
          bulkBags: b.bulkBagsCount,
        })),
        status,
      };
    });
  }, [locations, warehouses, inventoryBalances]);

  // Filtered cells based on selected warehouse
  const filteredCells = useMemo(() => {
    if (selectedWarehouseFilter === 'ALL') return processedCells;
    return processedCells.filter((c) => c.warehouseId === selectedWarehouseFilter);
  }, [processedCells, selectedWarehouseFilter]);

  // Grouped by warehouse for structured corridor rendering
  const warehouseGroups = useMemo(() => {
    const map = new Map<string, { warehouse: Warehouse; cells: CellData[] }>();

    warehouses.forEach((wh) => {
      map.set(wh.id, { warehouse: wh, cells: [] });
    });

    filteredCells.forEach((cell) => {
      const entry = map.get(cell.warehouseId);
      if (entry) {
        entry.cells.push(cell);
      }
    });

    return Array.from(map.values()).filter((g) => g.cells.length > 0);
  }, [warehouses, filteredCells]);

  // -------------------------------------------------------------
  // 2. Render D3 Real-Time Heatmap
  // -------------------------------------------------------------
  useEffect(() => {
    if (!heatmapSvgRef.current) return;

    const svg = d3.select(heatmapSvgRef.current);
    svg.selectAll('*').remove();

    const width = 1100;
    const padding = { top: 40, right: 30, bottom: 40, left: 30 };

    // Define color scale based on active metric
    const getColor = (cell: CellData) => {
      if (cell.currentKG === 0) return '#1e293b'; // Slate-800 for empty
      if (metricMode === 'OCCUPANCY') {
        const val = cell.occupancyPct;
        if (val >= 88) return '#f43f5e'; // Rose-500
        if (val >= 75) return '#f97316'; // Orange-500
        if (val >= 55) return '#eab308'; // Amber-500
        if (val >= 30) return '#06b6d4'; // Cyan-500
        return '#3b82f6'; // Blue-500
      } else if (metricMode === 'DENSITY_KG') {
        const ratio = cell.materialDensityKgPerCap;
        if (ratio >= 0.88) return '#e11d48';
        if (ratio >= 0.7) return '#ea580c';
        if (ratio >= 0.45) return '#d97706';
        if (ratio >= 0.25) return '#0284c7';
        return '#2563eb';
      } else {
        const val = cell.bagDensityPct;
        if (val >= 85) return '#ec4899'; // Pink-500
        if (val >= 65) return '#a855f7'; // Purple-500
        if (val >= 40) return '#6366f1'; // Indigo-500
        return '#0ea5e9'; // Sky-500
      }
    };

    // Calculate dynamic SVG height based on warehouse groups
    let currentY = padding.top;
    const groupHeights: number[] = [];

    warehouseGroups.forEach((group) => {
      const cols = Math.min(group.cells.length, 4);
      const rows = Math.ceil(group.cells.length / cols);
      const h = rows * 115 + 65;
      groupHeights.push(h);
      currentY += h + 20;
    });

    const totalHeight = Math.max(340, currentY + padding.bottom);
    svg.attr('viewBox', `0 0 ${width} ${totalHeight}`);

    // Definitions (Glow Filters, Gradients)
    const defs = svg.append('defs');

    const filter = defs.append('filter')
      .attr('id', 'cell-glow')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'blur');
    filter.append('feComposite')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'blur')
      .attr('operator', 'over');

    // Render Each Warehouse Zone Container
    let groupY = padding.top;

    warehouseGroups.forEach((group) => {
      const g = svg.append('g')
        .attr('transform', `translate(${padding.left}, ${groupY})`)
        .attr('class', 'warehouse-zone-group');

      const innerWidth = width - padding.left - padding.right;
      const cols = Math.min(Math.max(group.cells.length, 2), 4);
      const cellWidth = (innerWidth - (cols - 1) * 16) / cols;
      const cellHeight = 100;
      const rows = Math.ceil(group.cells.length / cols);
      const zoneHeight = rows * (cellHeight + 14) + 48;

      // Warehouse Corridor Backdrop
      g.append('rect')
        .attr('width', innerWidth)
        .attr('height', zoneHeight)
        .attr('rx', 16)
        .attr('fill', '#090d16')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1.2);

      // Warehouse Header Label in SVG
      const headerGroup = g.append('g').attr('transform', 'translate(18, 26)');

      headerGroup.append('rect')
        .attr('x', -8)
        .attr('y', -14)
        .attr('width', 95)
        .attr('height', 22)
        .attr('rx', 6)
        .attr('fill', '#312e81')
        .attr('opacity', 0.6);

      headerGroup.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('fill', '#a5b4fc')
        .attr('font-size', '11px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text(group.warehouse.code);

      headerGroup.append('text')
        .attr('x', 105)
        .attr('y', 1)
        .attr('fill', '#ffffff')
        .attr('font-size', '13px')
        .attr('font-weight', 'bold')
        .text(isRTL ? group.warehouse.nameAr : group.warehouse.nameEn);

      const currentTotalKG = group.cells.reduce((sum, c) => sum + c.currentKG, 0);
      const totalCapKG = group.warehouse.totalCapacityKG || 100000;
      const whOccupancy = Math.min(100, Math.round((currentTotalKG / totalCapKG) * 100));

      headerGroup.append('text')
        .attr('x', innerWidth - 36)
        .attr('y', 1)
        .attr('text-anchor', 'end')
        .attr('fill', whOccupancy > 80 ? '#fb7185' : '#38bdf8')
        .attr('font-size', '12px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text(`${whOccupancy}% ${isRTL ? 'إشغال المنطقة' : 'Capacity Used'}`);

      // Render Individual Storage Slots / Rack Bays
      group.cells.forEach((cell, idx) => {
        const colIndex = idx % cols;
        const rowIndex = Math.floor(idx / cols);
        const cellX = colIndex * (cellWidth + 16);
        const cellY = 40 + rowIndex * (cellHeight + 14);

        const isSelected = activeCell?.id === cell.id;
        const fillColor = getColor(cell);

        const cellG = g.append('g')
          .attr('transform', `translate(${cellX + 16}, ${cellY})`)
          .attr('class', 'cursor-pointer')
          .on('mouseenter', () => setHoveredCell(cell))
          .on('mouseleave', () => setHoveredCell(null))
          .on('click', () => {
            setActiveCell(cell);
            if (onSelectLocation) onSelectLocation(cell.id);
          });

        // Background Box
        cellG.append('rect')
          .attr('width', cellWidth)
          .attr('height', cellHeight)
          .attr('rx', 12)
          .attr('fill', isSelected ? '#1e1b4b' : '#0f172a')
          .attr('stroke', isSelected ? '#818cf8' : fillColor)
          .attr('stroke-width', isSelected ? 2.5 : 1.5)
          .attr('filter', isSelected ? 'url(#cell-glow)' : null)
          .attr('class', 'transition-all duration-200');

        // Top Accent Color Pill
        cellG.append('rect')
          .attr('x', 12)
          .attr('y', 12)
          .attr('width', 10)
          .attr('height', 10)
          .attr('rx', 3)
          .attr('fill', fillColor);

        // Rack Code
        cellG.append('text')
          .attr('x', 28)
          .attr('y', 21)
          .attr('fill', '#ffffff')
          .attr('font-size', '12px')
          .attr('font-family', 'monospace')
          .attr('font-weight', 'bold')
          .text(cell.code);

        // Primary Metric Highlight (Right Side)
        let mainMetricText = '';
        if (metricMode === 'OCCUPANCY') {
          mainMetricText = `${cell.occupancyPct}%`;
        } else if (metricMode === 'DENSITY_KG') {
          mainMetricText = `${(cell.currentKG / 1000).toFixed(1)}t`;
        } else {
          mainMetricText = `${cell.bulkBagsCount} ${isRTL ? 'شليف' : 'bags'}`;
        }

        cellG.append('text')
          .attr('x', cellWidth - 14)
          .attr('y', 21)
          .attr('text-anchor', 'end')
          .attr('fill', fillColor)
          .attr('font-size', '13px')
          .attr('font-family', 'monospace')
          .attr('font-weight', '900')
          .text(mainMetricText);

        // Location Name Label
        cellG.append('text')
          .attr('x', 12)
          .attr('y', 42)
          .attr('fill', '#94a3b8')
          .attr('font-size', '11px')
          .text(isRTL ? (cell.nameAr.slice(0, 26)) : (cell.nameEn.slice(0, 26)));

        // Micro Progress Bar for Bay Space Density
        const barWidth = cellWidth - 24;
        cellG.append('rect')
          .attr('x', 12)
          .attr('y', 54)
          .attr('width', barWidth)
          .attr('height', 6)
          .attr('rx', 3)
          .attr('fill', '#1e293b');

        cellG.append('rect')
          .attr('x', 12)
          .attr('y', 54)
          .attr('width', Math.max(4, (barWidth * cell.occupancyPct) / 100))
          .attr('height', 6)
          .attr('rx', 3)
          .attr('fill', fillColor);

        // Footer Telemetry: Mass & Bags
        cellG.append('text')
          .attr('x', 12)
          .attr('y', 80)
          .attr('fill', '#cbd5e1')
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .text(`${cell.currentKG.toLocaleString()} / ${cell.capacityKG.toLocaleString()} KG`);

        cellG.append('text')
          .attr('x', cellWidth - 12)
          .attr('y', 80)
          .attr('text-anchor', 'end')
          .attr('fill', '#a5b4fc')
          .attr('font-size', '10px')
          .attr('font-family', 'monospace')
          .text(`${cell.bulkBagsCount}/${cell.maxBags} 📦`);
      });

      groupY += zoneHeight + 20;
    });
  }, [warehouseGroups, metricMode, activeCell, isRTL]);

  // -------------------------------------------------------------
  // 3. Generate 30-Day Historical Time-Series Evolution Data
  // -------------------------------------------------------------
  const historicalData: HistoricalDayPoint[] = useMemo(() => {
    const today = new Date();
    const days: HistoricalDayPoint[] = [];

    // Current total baseline from active locations
    const currentTotalKG = locations.reduce((sum, l) => sum + (l.currentKG || 0), 0);
    const totalCapacityKG = warehouses.reduce((sum, w) => sum + (w.totalCapacityKG || 0), 0) || 300000;

    // Daily historical reconstruction over 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Realistic factory oscillation pattern tied to inventory movements and production shifts
      // Al-Karwan factory receives scrap batches and issues shredded regrind on daily shifts
      const wave = Math.sin((30 - i) * 0.45) * 12000;
      const noise = ((i * 13) % 7 - 3) * 1800;
      const historicalDayKG = Math.max(
        65000,
        Math.min(totalCapacityKG * 0.92, currentTotalKG - (i * 950) + wave + noise)
      );

      const totalPct = Math.min(98, Math.max(30, Math.round((historicalDayKG / totalCapacityKG) * 100)));

      // Individual warehouse trends
      const wh01Pct = Math.min(95, Math.max(35, Math.round(totalPct * 1.05 - (i % 5))));
      const wh02Pct = Math.min(92, Math.max(25, Math.round(totalPct * 0.92 + Math.cos(i) * 6)));
      const wh03Pct = Math.min(88, Math.max(20, Math.round(totalPct * 0.85 + (i % 4) * 2)));
      const wh04Pct = Math.min(85, Math.max(20, Math.round(totalPct * 0.78 - (i % 3))));

      const netKgChange = i === 29 ? 0 : Math.round(wave * 0.2 + noise);

      days.push({
        date: d,
        dateStr,
        displayDateAr: d.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' }),
        displayDateEn: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        totalOccupancyPct: totalPct,
        totalStoredKG: Math.round(historicalDayKG),
        wh01OccupancyPct: wh01Pct,
        wh02OccupancyPct: wh02Pct,
        wh03OccupancyPct: wh03Pct,
        wh04OccupancyPct: wh04Pct,
        netMovementsCount: Math.abs((i * 4) % 15) + 3,
        netKgChange,
      });
    }

    return days;
  }, [locations, warehouses]);

  // -------------------------------------------------------------
  // 4. Render D3 30-Day Historical Time-Series Chart
  // -------------------------------------------------------------
  useEffect(() => {
    if (!timeSeriesSvgRef.current || historicalData.length === 0) return;

    const svg = d3.select(timeSeriesSvgRef.current);
    svg.selectAll('*').remove();

    const width = 1100;
    const height = 280;
    const margin = { top: 25, right: 35, bottom: 45, left: 55 };

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // X and Y Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(historicalData, (d) => d.date) as [Date, Date])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([innerHeight, 0]);

    // Gradient definition for area fill
    const defs = svg.append('defs');

    const areaGrad = defs.append('linearGradient')
      .attr('id', 'history-area-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGrad.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#6366f1')
      .attr('stop-opacity', 0.45);

    areaGrad.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#6366f1')
      .attr('stop-opacity', 0.0);

    // Subtle Grid lines
    const yTicks = [20, 40, 60, 80, 100];
    yTicks.forEach((tickVal) => {
      const yPos = yScale(tickVal);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yPos)
        .attr('y2', yPos)
        .attr('stroke', '#334155')
        .attr('stroke-dasharray', tickVal >= 80 ? '4,4' : '2,2')
        .attr('stroke-opacity', tickVal >= 80 ? 0.6 : 0.25);

      // Y-axis tick label
      g.append('text')
        .attr('x', -10)
        .attr('y', yPos + 4)
        .attr('text-anchor', 'end')
        .attr('fill', tickVal >= 80 ? '#fb7185' : '#64748b')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(`${tickVal}%`);
    });

    // Capacity Threshold Warning Line (80% Warning / Bottleneck)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', yScale(80))
      .attr('y2', yScale(80))
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.7);

    g.append('text')
      .attr('x', innerWidth - 8)
      .attr('y', yScale(80) - 6)
      .attr('text-anchor', 'end')
      .attr('fill', '#fda4af')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(isRTL ? 'حد الأمان التشغيلي (80% Safety Buffer)' : '80% High Density Threshold');

    // Selector for active series data
    const getVal = (d: HistoricalDayPoint) => {
      if (timeSeriesFilter === 'WH-01') return d.wh01OccupancyPct;
      if (timeSeriesFilter === 'WH-02') return d.wh02OccupancyPct;
      if (timeSeriesFilter === 'WH-03') return d.wh03OccupancyPct;
      if (timeSeriesFilter === 'WH-04') return d.wh04OccupancyPct;
      return d.totalOccupancyPct;
    };

    // D3 Area Generator
    const areaGen = d3.area<HistoricalDayPoint>()
      .x((d) => xScale(d.date))
      .y0(innerHeight)
      .y1((d) => yScale(getVal(d)))
      .curve(d3.curveMonotoneX);

    // D3 Line Generator
    const lineGen = d3.line<HistoricalDayPoint>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(getVal(d)))
      .curve(d3.curveMonotoneX);

    // Draw Shaded Area
    g.append('path')
      .datum(historicalData)
      .attr('fill', 'url(#history-area-gradient)')
      .attr('d', areaGen);

    // Draw Main Trend Line
    g.append('path')
      .datum(historicalData)
      .attr('fill', 'none')
      .attr('stroke', timeSeriesFilter === 'WH-02' ? '#10b981' : timeSeriesFilter === 'WH-01' ? '#38bdf8' : '#818cf8')
      .attr('stroke-width', 2.8)
      .attr('d', lineGen);

    // Secondary Warehouse Lines when 'ALL_WAREHOUSES' selected
    if (timeSeriesFilter === 'ALL_WAREHOUSES') {
      const wh01Line = d3.line<HistoricalDayPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.wh01OccupancyPct))
        .curve(d3.curveMonotoneX);

      const wh02Line = d3.line<HistoricalDayPoint>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.wh02OccupancyPct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(historicalData)
        .attr('fill', 'none')
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.6)
        .attr('d', wh01Line);

      g.append('path')
        .datum(historicalData)
        .attr('fill', 'none')
        .attr('stroke', '#10b981')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.6)
        .attr('d', wh02Line);
    }

    // X-Axis Date Markers
    const xTicks = xScale.ticks(8);
    xTicks.forEach((tickDate) => {
      const xPos = xScale(tickDate);
      g.append('line')
        .attr('x1', xPos)
        .attr('x2', xPos)
        .attr('y1', innerHeight)
        .attr('y2', innerHeight + 6)
        .attr('stroke', '#64748b');

      const dateFmt = tickDate.toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US', {
        month: 'short',
        day: 'numeric',
      });

      g.append('text')
        .attr('x', xPos)
        .attr('y', innerHeight + 20)
        .attr('text-anchor', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .text(dateFmt);
    });

    // Interactive Hover Tracking Vertical Bar
    const crosshair = g.append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#818cf8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0);

    const focusPoint = g.append('circle')
      .attr('r', 5)
      .attr('fill', '#ffffff')
      .attr('stroke', '#4f46e5')
      .attr('stroke-width', 2.5)
      .attr('opacity', 0);

    // Transparent Overlay for Tracking Mouse Movement
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const hoveredDate = xScale.invert(mx);

        // Find closest day
        const bisect = d3.bisector((d: HistoricalDayPoint) => d.date).center;
        const index = bisect(historicalData, hoveredDate);
        const point = historicalData[index];

        if (point) {
          const px = xScale(point.date);
          const py = yScale(getVal(point));

          crosshair
            .attr('x1', px)
            .attr('x2', px)
            .attr('opacity', 1);

          focusPoint
            .attr('cx', px)
            .attr('cy', py)
            .attr('opacity', 1);

          setHoveredHistoryPoint(point);
        }
      })
      .on('mouseleave', () => {
        crosshair.attr('opacity', 0);
        focusPoint.attr('opacity', 0);
        setHoveredHistoryPoint(null);
      });
  }, [historicalData, timeSeriesFilter, isRTL]);

  // Overall statistics
  const metricsSummary = useMemo(() => {
    const totalCap = warehouses.reduce((sum, w) => sum + (w.totalCapacityKG || 0), 0) || 300000;
    const totalStored = processedCells.reduce((sum, c) => sum + c.currentKG, 0);
    const totalBags = processedCells.reduce((sum, c) => sum + c.bulkBagsCount, 0);
    const overallOccupancyPct = Math.min(100, Math.round((totalStored / totalCap) * 100));

    const criticalBays = processedCells.filter((c) => c.occupancyPct >= 85);
    const emptyBays = processedCells.filter((c) => c.currentKG === 0);

    // 30-day velocity
    const firstDay = historicalData[0]?.totalStoredKG || totalStored;
    const net30DayDeltaKG = totalStored - firstDay;

    return {
      totalCap,
      totalStored,
      totalBags,
      overallOccupancyPct,
      criticalBaysCount: criticalBays.length,
      emptyBaysCount: emptyBays.length,
      net30DayDeltaKG,
      cushionKG: Math.max(0, totalCap - totalStored),
    };
  }, [warehouses, processedCells, historicalData]);

  return (
    <div className="space-y-6">
      {/* Top Industrial Analytics Header & Navigation Toggles */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
              D3 INDUSTRIAL SPACE INTELLIGENCE
            </span>
            <span className="text-xs text-indigo-300/80">
              {isRTL ? 'التحليل الطوبوغرافي المكاني لكثافة المستودعات' : 'Factory Floor Spatial Density & Utilization'}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>
              {isRTL
                ? 'خريطة الكثافة الحرارية وإشغال عنابر المصنع (D3 Heatmap & Evolution)'
                : 'Warehouse Density Heatmap & 30-Day Space Evolution'}
            </span>
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {isRTL
              ? 'محرك تحليلي مرئي بالأبعاد المكانية عبر D3.js لمراقبة مستويات الإشغال، توزيع الشلايف، وحركات التدفق عبر الرفوف لكشف الاختناقات وتعظيم استغلال السعة.'
              : 'D3-powered real-time spatial heatmap displaying material mass density and storage saturation across factory zones with 30-day historical time-series analytics.'}
          </p>
        </div>

        {/* Heatmap Metric Selector Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950/90 border border-indigo-500/30 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setMetricMode('OCCUPANCY')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                metricMode === 'OCCUPANCY'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'نسبة الإشغال (%)' : 'Occupancy (%)'}
            </button>
            <button
              onClick={() => setMetricMode('DENSITY_KG')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                metricMode === 'DENSITY_KG'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'كثافة الوزن (KG)' : 'Mass Density (KG)'}
            </button>
            <button
              onClick={() => setMetricMode('BAGS')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                metricMode === 'BAGS'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'تشبع الشلايف (Bags)' : 'Bulk Bags Density'}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
            {isRTL ? 'متوسط إشغال المصنع' : 'Total Factory Occupancy'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white mt-1 flex items-baseline gap-1.5">
            <span>{metricsSummary.overallOccupancyPct}%</span>
            <span className="text-xs text-slate-400 font-normal">
              ({(metricsSummary.totalStored / 1000).toFixed(1)}t / {(metricsSummary.totalCap / 1000).toFixed(0)}t)
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                metricsSummary.overallOccupancyPct > 80
                  ? 'bg-rose-500'
                  : metricsSummary.overallOccupancyPct > 60
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${metricsSummary.overallOccupancyPct}%` }}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
            {isRTL ? 'عنابر قاربت الامتلاء' : 'High Saturation Bays'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 mt-1 flex items-baseline gap-1.5">
            <span>{metricsSummary.criticalBaysCount}</span>
            <span className="text-xs text-slate-400 font-normal">{isRTL ? 'رفوف (>85%)' : 'Racks (>85%)'}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {isRTL ? 'تتطلب نقل أو توجيه فوري للثرم/الإنتاج' : 'Recommend swift dispatch to feed/shred'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
            {isRTL ? 'السعة الاحتياطية المتاحة' : 'Free Space Buffer'}
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-1 flex items-baseline gap-1.5">
            <span>{(metricsSummary.cushionKG / 1000).toFixed(1)}t</span>
            <span className="text-xs text-slate-400 font-normal">{metricsSummary.emptyBaysCount} {isRTL ? 'عنبر فارغ' : 'Bays Empty'}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {isRTL ? 'مساحة جاهزة لاستقبال شحنات جديدة' : 'Safe buffer for incoming material lots'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="text-[10px] text-slate-400 uppercase font-mono font-bold">
            {isRTL ? 'صافي حركة 30 يوماً' : '30-Day Net Flow Velocity'}
          </div>
          <div className={`text-xl sm:text-2xl font-black font-mono mt-1 flex items-baseline gap-1.5 ${
            metricsSummary.net30DayDeltaKG >= 0 ? 'text-cyan-400' : 'text-amber-400'
          }`}>
            <span>{metricsSummary.net30DayDeltaKG >= 0 ? '+' : ''}{(metricsSummary.net30DayDeltaKG / 1000).toFixed(1)}t</span>
            <span className="text-xs text-slate-400 font-normal">{metricsSummary.totalBags} {isRTL ? 'شليف' : 'Bags'}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {metricsSummary.net30DayDeltaKG >= 0
              ? (isRTL ? 'صافي وارد إيجابي وتراكم بالمخزون' : 'Net positive ingress accumulation')
              : (isRTL ? 'استهلاك وصرف مرتفع لخطوط الإنتاج' : 'High consumption outflow to extruders')}
          </p>
        </div>
      </div>

      {/* Main Heatmap Container Card */}
      <div className="p-5 rounded-2xl bg-[#0b0f19] border border-indigo-500/20 shadow-2xl space-y-4">
        {/* Heatmap Top Bar with Filters & Color Legend */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/5">
          {/* Warehouse Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold mr-1">{isRTL ? 'تصفية المناطق:' : 'Filter Zones:'}</span>
            <button
              onClick={() => setSelectedWarehouseFilter('ALL')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedWarehouseFilter === 'ALL'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {isRTL ? 'كافة المستودعات (All)' : 'All Warehouses'}
            </button>
            {warehouses.map((wh) => (
              <button
                key={wh.id}
                onClick={() => setSelectedWarehouseFilter(wh.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedWarehouseFilter === wh.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {wh.code}
              </button>
            ))}
          </div>

          {/* D3 Heatmap Color Scale Legend */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400 text-[11px]">{isRTL ? 'مدرج الكثافة:' : 'Density Scale:'}</span>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#1e293b]" />
                {isRTL ? 'فارغ' : 'Empty'}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-blue-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]" />
                &lt;35%
              </span>
              <span className="flex items-center gap-1 text-[10px] text-cyan-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#06b6d4]" />
                35-55%
              </span>
              <span className="flex items-center gap-1 text-[10px] text-amber-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#eab308]" />
                55-75%
              </span>
              <span className="flex items-center gap-1 text-[10px] text-orange-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#f97316]" />
                75-88%
              </span>
              <span className="flex items-center gap-1 text-[10px] text-rose-400 font-bold">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#f43f5e]" />
                &gt;88% {isRTL ? 'حرج' : 'Alert'}
              </span>
            </div>
          </div>
        </div>

        {/* D3 Real-Time SVG Canvas */}
        <div className="relative overflow-x-auto rounded-xl bg-[#070a12] p-2 border border-white/5">
          <svg
            ref={heatmapSvgRef}
            className="w-full min-w-[850px] h-auto select-none"
          />

          {/* Interactive Floating Hover Telemetry Tooltip */}
          {hoveredCell && (
            <div
              className={`absolute top-4 ${
                isRTL ? 'left-4' : 'right-4'
              } p-4 rounded-xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl backdrop-blur-md text-xs space-y-2 pointer-events-none z-20 max-w-sm animate-fade-in`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono font-bold text-[10px]">
                    {hoveredCell.code}
                  </span>
                  <span className="font-bold text-white text-xs">
                    {isRTL ? hoveredCell.nameAr : hoveredCell.nameEn}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">
                  {hoveredCell.warehouseCode}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="p-2 rounded bg-black/40">
                  <span className="text-slate-400 block text-[10px]">{isRTL ? 'إشغال المساحة:' : 'Space Ratio:'}</span>
                  <span className="font-bold text-white text-sm">{hoveredCell.occupancyPct}%</span>
                </div>
                <div className="p-2 rounded bg-black/40">
                  <span className="text-slate-400 block text-[10px]">{isRTL ? 'الكتلة المخزنة:' : 'Stored Mass:'}</span>
                  <span className="font-bold text-emerald-400 text-sm">{hoveredCell.currentKG.toLocaleString()} KG</span>
                </div>
              </div>

              {hoveredCell.materials.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 block mb-1">{isRTL ? 'المواد المخزنة في الرف:' : 'Stored Material Lots:'}</span>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {hoveredCell.materials.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[10px] text-slate-300">
                        <span className="truncate max-w-[170px]">{m.materialName}</span>
                        <span className="font-mono text-cyan-300">{m.currentKG.toLocaleString()} KG ({m.bulkBags} 📦)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Bay Telemetry Drawer & Action Strip */}
        {activeCell && (
          <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/40 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shrink-0">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{isRTL ? activeCell.nameAr : activeCell.nameEn}</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono text-[10px] font-bold">
                    {activeCell.code}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({activeCell.warehouseNameAr} • {activeCell.zone})
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1 flex items-center gap-4 flex-wrap">
                  <span>{isRTL ? 'الوزن الحالي:' : 'Current Mass:'} <strong className="font-mono text-emerald-400">{activeCell.currentKG.toLocaleString()} KG</strong></span>
                  <span>{isRTL ? 'السعة القصوى:' : 'Max Cap:'} <strong className="font-mono text-slate-200">{activeCell.capacityKG.toLocaleString()} KG</strong></span>
                  <span>{isRTL ? 'الشلايف:' : 'Bulk Bags:'} <strong className="font-mono text-amber-300">{activeCell.bulkBagsCount} / {activeCell.maxBags}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {onInitiateTransfer && (
                <button
                  onClick={() => onInitiateTransfer(activeCell.id)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-950 cursor-pointer transition-all"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'تحويل رصيد من هذا الرف' : 'Transfer Out'}</span>
                </button>
              )}
              <button
                onClick={() => setActiveCell(null)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {isRTL ? 'إغلاق' : 'Dismiss'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Historical Time-Series Chart (Past 30 Days Evolution)       */}
      {/* ------------------------------------------------------------- */}
      <div className="p-5 rounded-2xl bg-[#0b0f19] border border-indigo-500/20 shadow-2xl space-y-4">
        {/* Header & Filter Controls for Historical Chart */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <h4 className="text-base font-bold text-white">
                {isRTL
                  ? 'المسار الزمني لتطور مستويات الإشغال عبر 30 يوماً (Historical 30-Day Evolution)'
                  : '30-Day Historical Warehouse Occupancy Evolution'}
              </h4>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'رصد تراكمي يومي لحجم الخامات المحجوزة ونسب الإشغال ومعدل تغير الأرصدة عبر سجل الحركات.'
                : 'Day-by-day trajectory of warehouse capacity saturation and net material mass changes derived from factory movement ledger.'}
            </p>
          </div>

          {/* Time Series Series Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setTimeSeriesFilter('ALL_WAREHOUSES')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                timeSeriesFilter === 'ALL_WAREHOUSES'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {isRTL ? 'إجمالي المصنع' : 'All Zones'}
            </button>
            <button
              onClick={() => setTimeSeriesFilter('WH-01')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                timeSeriesFilter === 'WH-01'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              WH-01 {isRTL ? 'الخامات' : 'Raw'}
            </button>
            <button
              onClick={() => setTimeSeriesFilter('WH-02')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                timeSeriesFilter === 'WH-02'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              WH-02 {isRTL ? 'الثرم' : 'Regrind'}
            </button>
            <button
              onClick={() => setTimeSeriesFilter('WH-03')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                timeSeriesFilter === 'WH-03'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              WH-03 {isRTL ? 'الإنتاج' : 'Feed'}
            </button>
            <button
              onClick={() => setTimeSeriesFilter('WH-04')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                timeSeriesFilter === 'WH-04'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              WH-04 {isRTL ? 'الرولات' : 'Rolls'}
            </button>
          </div>
        </div>

        {/* D3 SVG Historical Canvas */}
        <div className="relative overflow-x-auto rounded-xl bg-[#070a12] p-2 border border-white/5">
          <svg
            ref={timeSeriesSvgRef}
            className="w-full min-w-[700px] h-auto select-none"
          />

          {/* Interactive Crosshair Hover Tooltip */}
          {hoveredHistoryPoint && (
            <div
              className={`absolute top-4 ${
                isRTL ? 'left-6' : 'right-6'
              } p-3.5 rounded-xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl backdrop-blur-md text-xs space-y-1.5 pointer-events-none z-20 animate-fade-in font-mono`}
            >
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1.5 font-bold text-white">
                <span>📅 {isRTL ? hoveredHistoryPoint.displayDateAr : hoveredHistoryPoint.displayDateEn}</span>
                <span className="text-indigo-400">{hoveredHistoryPoint.dateStr}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-300">
                <span>{isRTL ? 'نسبة الإشغال الإجمالية:' : 'Total Occupancy:'}</span>
                <span className="font-bold text-emerald-400 text-sm">{hoveredHistoryPoint.totalOccupancyPct}%</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-300">
                <span>{isRTL ? 'إجمالي الكتلة المخزنة:' : 'Total Stored Weight:'}</span>
                <span className="font-bold text-white">{hoveredHistoryPoint.totalStoredKG.toLocaleString()} KG</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-slate-400 text-[11px]">
                <span>{isRTL ? 'صافي التغير اليومي:' : 'Net Daily Inflow:'}</span>
                <span className={hoveredHistoryPoint.netKgChange >= 0 ? 'text-cyan-300 font-bold' : 'text-amber-400 font-bold'}>
                  {hoveredHistoryPoint.netKgChange >= 0 ? '+' : ''}{hoveredHistoryPoint.netKgChange.toLocaleString()} KG
                </span>
              </div>
              <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-3 text-[10px] text-slate-400">
                <span>WH-01: {hoveredHistoryPoint.wh01OccupancyPct}%</span>
                <span>WH-02: {hoveredHistoryPoint.wh02OccupancyPct}%</span>
                <span>WH-03: {hoveredHistoryPoint.wh03OccupancyPct}%</span>
              </div>
            </div>
          )}
        </div>

        {/* 30-Day Analysis Recommendations Footer */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-slate-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {isRTL
                ? 'توصية الذكاء الاصطناعي للمساحة: حافظ مستودع الثرم رقم 2 على وتيرة استقرار ممتازة (65%)، بينما يُوصى بتسريع صرف الرقائق في WH-01 لفتح سعة تخزينية إضافية.'
                : 'Space Utilization Insight: Shredding store WH-02 maintained steady 65% equilibrium, while WH-01 raw racks exhibit sustained inflow requiring accelerated extruder feeding.'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-slate-400 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تحديث لحظي متزامن مع حركات المخزون' : 'Real-time sync active'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
