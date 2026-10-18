import React, { useState } from 'react';
import {
  QrCode,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Trash2,
  RotateCcw,
  Truck,
  Scale,
  Boxes,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Printer,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  AlertOctagon,
  AlertTriangle,
  Siren,
  Volume2,
  Undo2,
  CheckSquare,
  Square,
  MinusSquare,
  Database,
  Calendar,
  CalendarDays,
  CalendarRange,
  X,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { MaterialAlertInfo, playMaterialWarningAlarm } from '../services/materialAlertService';

export interface QrScanHistoryItem {
  id: string;
  timestamp: string;          // ISO string
  displayTime: string;        // Formatted time e.g. "13:10:45"
  date: string;               // e.g. "2026-09-30"
  materialId: string;         // e.g. "MAT-001"
  materialCode: string;       // e.g. "PET-FLK-01"
  materialName: string;       // e.g. "رقائق بولي إيثيلين تيريفثالات (PET Flakes)"
  qrCode: string;             // Raw scanned QR text or batch/bag code
  weightKG: number;           // e.g. 1000
  bulkBagsCount: number;      // e.g. 1
  supplierName?: string;      // e.g. "شركة الدلتا للبتروكيماويات"
  vehiclePlate?: string;      // e.g. "IQ-BAG-1082"
  targetWarehouseId?: string;
  targetLocationId?: string;
  verified: boolean;          // true
  notes?: string;
  status?: 'NORMAL' | 'QUARANTINED' | 'EXPIRED' | 'FLAGGED';
  isQuarantined?: boolean;
  isExpired?: boolean;
  alertReason?: string;
}

const TODAY_DATE_STR = typeof window !== 'undefined' ? new Date().toISOString().slice(0, 10) : '2026-10-03';

export const INITIAL_SCAN_HISTORY: QrScanHistoryItem[] = [
  {
    id: 'SCAN-HIST-01',
    timestamp: `${TODAY_DATE_STR}T13:10:45Z`,
    displayTime: '13:10:45',
    date: TODAY_DATE_STR,
    materialId: 'MAT-008',
    materialCode: 'PP-REC-Q8',
    materialName: 'حبيبات بولي بروبلين معاد تدويره (محجور / قيد الفحص)',
    qrCode: 'QR-MAT-008-Q99',
    weightKG: 1500,
    bulkBagsCount: 2,
    supplierName: 'مصنع النصر لتدوير اللدائن',
    vehiclePlate: 'IQ-BAG-1082',
    verified: true,
    isQuarantined: true,
    status: 'QUARANTINED',
    alertReason: 'حجز فحص الجودة المخبري: شوائب غير مطابقة وتلوث لوني',
    notes: '⚠️ محجور أمنياً - تم إطلاق صفارة الإنذار وتوجيه الشحنة لساحة العزل Z-09',
  },
  {
    id: 'SCAN-HIST-02',
    timestamp: `${TODAY_DATE_STR}T12:45:12Z`,
    displayTime: '12:45:12',
    date: TODAY_DATE_STR,
    materialId: 'MAT-009',
    materialCode: 'PET-EXP-09',
    materialName: 'رقائق PET مستوردة (منتهية الصلاحية / Expired Lot)',
    qrCode: 'LOT-EXP-2024-09',
    weightKG: 1200,
    bulkBagsCount: 1,
    supplierName: 'الشركة العربية لتجارة وتوزيع اللدائن',
    vehiclePlate: 'IQ-BAS-4491',
    verified: true,
    isExpired: true,
    status: 'EXPIRED',
    alertReason: 'تجاوز فترة التخزين القصوى وتأكسد البوليمر بتاريخ 2026-02-15',
    notes: '⏰ تنبيه انتهاء الصلاحية - ممنوع التغذية المباشرة لخط الألواح',
  },
  {
    id: 'SCAN-HIST-03',
    timestamp: `${TODAY_DATE_STR}T12:20:05Z`,
    displayTime: '12:20:05',
    date: TODAY_DATE_STR,
    materialId: 'MAT-001',
    materialCode: 'PET-FLK-01',
    materialName: 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)',
    qrCode: 'BAG-RCV-2024-001-01',
    weightKG: 1050,
    bulkBagsCount: 1,
    supplierName: 'شركة الدلتا للبتروكيماويات',
    vehiclePlate: 'IQ-BAG-1082',
    verified: true,
    status: 'NORMAL',
    notes: 'تم التحقق من مطابقة الوزن والمواصفات المعيارية',
  },
  {
    id: 'SCAN-HIST-04',
    timestamp: `${TODAY_DATE_STR}T11:55:30Z`,
    displayTime: '11:55:30',
    date: TODAY_DATE_STR,
    materialId: 'MAT-002',
    materialCode: 'PP-GRN-02',
    materialName: 'بولي بروبيلين حبيبات أبيض نقي (PP Granules)',
    qrCode: 'BAG-RCV-2024-001-02',
    weightKG: 1000,
    bulkBagsCount: 1,
    supplierName: 'شركة الرافدين للبتروكيماويات',
    vehiclePlate: 'IQ-BAS-4491',
    verified: true,
    status: 'NORMAL',
    notes: 'شليف معتمد برمز استجابة سريعة معياري',
  },
  {
    id: 'SCAN-HIST-05',
    timestamp: `${TODAY_DATE_STR}T11:15:18Z`,
    displayTime: '11:15:18',
    date: TODAY_DATE_STR,
    materialId: 'MAT-003',
    materialCode: 'BTL-SCR-03',
    materialName: 'سكراب وهوالك أكواب مفرومة (Batal Scrap)',
    qrCode: 'LOT-RCV-2024-003',
    weightKG: 2400,
    bulkBagsCount: 2,
    supplierName: 'مؤسسة بابل لتدوير البلاستيك',
    vehiclePlate: 'IQ-ARB-7712',
    verified: true,
    status: 'NORMAL',
    notes: 'إرسالية كاملة محددة عبر مسح كاميرا QR',
  },
  {
    id: 'SCAN-HIST-06',
    timestamp: `${TODAY_DATE_STR}T10:30:50Z`,
    displayTime: '10:30:50',
    date: TODAY_DATE_STR,
    materialId: 'MAT-001',
    materialCode: 'PET-FLK-01',
    materialName: 'رقائق بولي إيثيلين تيريفثالات (PET Flakes)',
    qrCode: 'BAG-RCV-2024-002-01',
    weightKG: 1100,
    bulkBagsCount: 1,
    supplierName: 'شركة الدلتا للبتروكيماويات',
    vehiclePlate: 'IQ-BAG-1082',
    verified: true,
    status: 'NORMAL',
    notes: 'تم المطابقة عبر باركود QR الشليف',
  },
  {
    id: 'SCAN-HIST-07',
    timestamp: `${TODAY_DATE_STR}T09:48:22Z`,
    displayTime: '09:48:22',
    date: TODAY_DATE_STR,
    materialId: 'MAT-006',
    materialCode: 'HIPS-PEL-06',
    materialName: 'حبيبات بولي ستايرين مقاوم للصدمات (HIPS Pellets)',
    qrCode: 'LOT-RCV-2024-006',
    weightKG: 1800,
    bulkBagsCount: 2,
    supplierName: 'مصنع الخليج للبلاستيك المتطور',
    vehiclePlate: 'IQ-KIR-9011',
    verified: true,
    status: 'NORMAL',
    notes: 'تم التعرف الفوري على المادة والمورد',
  },
  {
    id: 'SCAN-HIST-08',
    timestamp: `${TODAY_DATE_STR}T09:12:40Z`,
    displayTime: '09:12:40',
    date: TODAY_DATE_STR,
    materialId: 'MAT-007',
    materialCode: 'MB-WHT-07',
    materialName: 'ماسترباتش أبيض فائق التغطية (White Masterbatch)',
    qrCode: 'BAG-RCV-2024-007-01',
    weightKG: 800,
    bulkBagsCount: 1,
    supplierName: 'الشركة العربية لتجارة وتوزيع اللدائن',
    vehiclePlate: 'IQ-BAG-1082',
    verified: true,
    status: 'NORMAL',
    notes: 'صبغة مركزة لتلوين الألواح',
  },
  {
    id: 'SCAN-HIST-09',
    timestamp: `${TODAY_DATE_STR}T08:35:15Z`,
    displayTime: '08:35:15',
    date: TODAY_DATE_STR,
    materialId: 'MAT-004',
    materialCode: 'BTL-SHR-04',
    materialName: 'مفروم ومجروش أكواب بطل (Batal Shredded)',
    qrCode: 'BAG-RCV-2024-008-01',
    weightKG: 950,
    bulkBagsCount: 1,
    supplierName: 'مؤسسة بابل لتدوير البلاستيك',
    vehiclePlate: 'IQ-ARB-7712',
    verified: true,
    status: 'NORMAL',
    notes: 'شليف مفحوص ومطابق للمواصفات',
  },
  {
    id: 'SCAN-HIST-10',
    timestamp: `${TODAY_DATE_STR}T08:05:00Z`,
    displayTime: '08:05:00',
    date: TODAY_DATE_STR,
    materialId: 'MAT-002',
    materialCode: 'PP-GRN-02',
    materialName: 'بولي بروبيلين حبيبات أبيض نقي (PP Granules)',
    qrCode: 'LOT-RCV-2024-008',
    weightKG: 3000,
    bulkBagsCount: 3,
    supplierName: 'شركة الرافدين للبتروكيماويات',
    vehiclePlate: 'IQ-BAS-4491',
    verified: true,
    status: 'NORMAL',
    notes: 'استلام الصباحية - تم مسح QR وتدقيق وزن الدخول',
  },
];

export interface ReceivingScanHistoryTableProps {
  history: QrScanHistoryItem[];
  onClearHistory?: () => void;
  onRestoreDefaults?: () => void;
  onApplyToScaleIn?: (item: QrScanHistoryItem) => void;
  onOpenBatchLifecycle?: (payload: { batchId?: string; bagId?: string; materialId?: string; rawText?: string }) => void;
  onPrintLabel?: (item: QrScanHistoryItem) => void;
  onInspectAlert?: (item: QrScanHistoryItem) => void;
  onUndoLastScan?: () => void;
  onBulkUndo?: (selectedIds: string[]) => void;
  onUndoSingleScan?: (item: QrScanHistoryItem) => void;
  isCompact?: boolean;
}

export const ReceivingScanHistoryTable: React.FC<ReceivingScanHistoryTableProps> = ({
  history,
  onClearHistory,
  onRestoreDefaults,
  onApplyToScaleIn,
  onOpenBatchLifecycle,
  onPrintLabel,
  onInspectAlert,
  onUndoLastScan,
  onBulkUndo,
  onUndoSingleScan,
  isCompact = false,
}) => {
  const { isRTL } = useLanguage();
  const { currentUser } = useFactory();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExported, setIsExported] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ALERTS_ONLY' | 'NORMAL'>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [undoFeedback, setUndoFeedback] = useState<string | null>(null);

  // Date range filter state for custom time intervals
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const isDateFilterActive = Boolean(startDate || endDate);

  const handleSetPresetToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(today);
  };

  const handleSetPresetLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  const handleSetPresetThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(now.toISOString().slice(0, 10));
  };

  const handleClearDateFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  // Filter items based on search term, alert status filter, and custom date range
  const displayedItems = history
    .filter((item) => {
      const isQ = item.isQuarantined || item.status === 'QUARANTINED';
      const isE = item.isExpired || item.status === 'EXPIRED';

      if (statusFilter === 'ALERTS_ONLY' && !isQ && !isE) return false;
      if (statusFilter === 'NORMAL' && (isQ || isE)) return false;

      // Custom date-range interval filtering
      const itemDate = item.date || (item.timestamp ? item.timestamp.slice(0, 10) : '');
      if (startDate && itemDate && itemDate < startDate) {
        return false;
      }
      if (endDate && itemDate && itemDate > endDate) {
        return false;
      }

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.materialId.toLowerCase().includes(term) ||
        item.materialCode.toLowerCase().includes(term) ||
        item.materialName.toLowerCase().includes(term) ||
        item.qrCode.toLowerCase().includes(term) ||
        (item.supplierName && item.supplierName.toLowerCase().includes(term)) ||
        (item.vehiclePlate && item.vehiclePlate.toLowerCase().includes(term)) ||
        (item.notes && item.notes.toLowerCase().includes(term))
      );
    })
    .slice(0, isDateFilterActive || searchTerm ? 30 : 10);

  // Selection state helpers
  const isAllSelected =
    displayedItems.length > 0 &&
    displayedItems.every((item) => selectedIds.includes(item.id));
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(displayedItems.map((item) => item.id));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleTriggerUndoLast = () => {
    if (history.length === 0) return;
    const targetItem = history[0];
    if (onUndoLastScan) {
      onUndoLastScan();
    } else if (onUndoSingleScan) {
      onUndoSingleScan(targetItem);
    } else if (onBulkUndo) {
      onBulkUndo([targetItem.id]);
    }
    setSelectedIds((prev) => prev.filter((id) => id !== targetItem.id));
    setUndoFeedback(
      isRTL
        ? `✓ تم التراجع عن آخر إدخال مسح (${targetItem.materialCode || targetItem.materialId}) وتحديث IndexedDB بنجاح.`
        : `✓ Reverted last mistake scan (${targetItem.materialCode || targetItem.materialId}) and updated IndexedDB.`
    );
    setTimeout(() => setUndoFeedback(null), 4000);
  };

  const handleTriggerBulkUndo = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (onBulkUndo) {
      onBulkUndo(selectedIds);
    } else if (onUndoSingleScan) {
      const targets = history.filter((i) => selectedIds.includes(i.id));
      targets.forEach((t) => onUndoSingleScan(t));
    }
    setSelectedIds([]);
    setUndoFeedback(
      isRTL
        ? `✓ تم التراجع المجمّع وحذف ${count} مدخلات مسح من قاعدة بيانات IndexedDB والعرض بنجاح.`
        : `✓ Bulk Undo: Reverted ${count} scan entries from local IndexedDB and display successfully.`
    );
    setTimeout(() => setUndoFeedback(null), 4500);
  };

  const handleInlineUndo = (item: QrScanHistoryItem) => {
    if (onUndoSingleScan) {
      onUndoSingleScan(item);
    } else if (onBulkUndo) {
      onBulkUndo([item.id]);
    }
    setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    setUndoFeedback(
      isRTL
        ? `✓ تم التراجع عن المسح (${item.materialCode || item.materialId}) وتحديث IndexedDB.`
        : `✓ Reverted scan entry (${item.materialCode || item.materialId}) and updated IndexedDB.`
    );
    setTimeout(() => setUndoFeedback(null), 3500);
  };

  const handleCopyMaterialId = (matId: string, id: string) => {
    navigator.clipboard.writeText(matId);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export scan log records as a formatted CSV file for warehouse managers
  const handleExportToCSV = () => {
    // Current view records: if checkboxes selected, export selected; otherwise export active displayed items
    const isExportingSelectedOnly = selectedIds.length > 0;
    const itemsToExport = isExportingSelectedOnly
      ? history.filter((i) => selectedIds.includes(i.id))
      : displayedItems.length > 0
      ? displayedItems
      : history.slice(0, 10);

    if (itemsToExport.length === 0) return;

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    // Calculate executive KPIs for warehouse managers
    const totalNetWeightKG = itemsToExport.reduce((acc, item) => acc + (item.weightKG || 0), 0);
    const totalBulkBags = itemsToExport.reduce((acc, item) => acc + (item.bulkBagsCount || 1), 0);
    const quarantinedLots = itemsToExport.filter(
      (item) => item.isQuarantined || item.status === 'QUARANTINED'
    ).length;
    const expiredLots = itemsToExport.filter(
      (item) => item.isExpired || item.status === 'EXPIRED'
    ).length;
    const verifiedNormalLots = itemsToExport.length - quarantinedLots - expiredLots;
    const avgBagWeightKG =
      totalBulkBags > 0 ? Math.round(totalNetWeightKG / totalBulkBags) : 0;

    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timeStamp = now.toTimeString().slice(0, 5).replace(':', '');
    const readableTime = now.toLocaleTimeString('en-GB', { hour12: false });
    const operatorName =
      currentUser?.nameAr || currentUser?.name || 'مشغل الميزان / Scale Operator';
    const operatorRole = currentUser?.role || 'المستودع والميزان / Receiving Dept';

    const filterScopeDesc = isExportingSelectedOnly
      ? `عناصر محددة يدوياً بواسطة مدير المستودع (${selectedIds.length} شحنة / شليف)`
      : statusFilter === 'ALERTS_ONLY'
      ? 'تصفية العرض الحالية: شحنات وخامات محجورة ومنتهية الصلاحية فقط (Flagged Alerts Only)'
      : statusFilter === 'NORMAL'
      ? 'تصفية العرض الحالية: خامات مطابقة وسليمة فقط (Verified Pass Only)'
      : 'تصفية العرض الحالية: كافة سجلات المسح الأخيرة (All View Items)';

    const dateScopeDesc = isDateFilterActive
      ? startDate && endDate
        ? `من ${startDate} إلى ${endDate}`
        : startDate
        ? `ابتداءً من تاريخ ${startDate}`
        : `حتى تاريخ ${endDate}`
      : 'كافة الفترات الزمنية المسجلة (بدون تصفية تاريخ)';

    const searchScopeDesc = searchTerm.trim()
      ? `بحث مخصص بالكلمة المفتاحية: "${searchTerm.trim()}"`
      : 'بدون تصفية بحث نصية';

    // Executive Formatted CSV Header Block for Warehouse Managers
    const headerBlock = [
      escapeCsv('===================================================================================================='),
      escapeCsv('AL-KARWAN FACTORY FOR PLASTICS INDUSTRY - WAREHOUSE INTAKE & QUALITY CONTROL MANAGEMENT'),
      escapeCsv('شركة ومصنع الكروان للصناعات البلاستيكية - إدارة المستودعات والرقابة النوعية على الاستلام (مستند 546)'),
      escapeCsv('===================================================================================================='),
      `${escapeCsv('REPORT TITLE / اسم التقرير:')},${escapeCsv('سجل مسح QR واستلام المواد الخام - تقرير مدراء المستودع المعتمد (Warehouse Manager Intake Report)')}`,
      `${escapeCsv('ISSUANCE DATE & TIME / تاريخ ووقت الإصدار:')},${escapeCsv(`${dateStamp} ${readableTime}`)}`,
      `${escapeCsv('PREPARED BY / أُعد بواسطة:')},${escapeCsv(`${operatorName} - ${operatorRole}`)}`,
      `${escapeCsv('REPORT SCOPE & VIEW FILTER / نطاق وتصفية العرض:')},${escapeCsv(filterScopeDesc)}`,
      `${escapeCsv('DATE FILTER INTERVAL / نطاق التصفية الزمني:')},${escapeCsv(dateScopeDesc)}`,
      `${escapeCsv('ACTIVE SEARCH TERM / كلمة البحث في العرض:')},${escapeCsv(searchScopeDesc)}`,
      `${escapeCsv('TOTAL RECORDS IN REPORT / إجمالي السجلات المستخرجة:')},${itemsToExport.length}`,
      `${escapeCsv('TOTAL NET WEIGHT (KG) / إجمالي الوزن الصافي:')},${escapeCsv(`${totalNetWeightKG.toLocaleString()} KG (${(totalNetWeightKG / 1000).toFixed(2)} TON)`)}`,
      `${escapeCsv('TOTAL BULK BAGS / إجمالي عدد الشلايف:')},${totalBulkBags}`,
      `${escapeCsv('AVG BAG WEIGHT / معدل وزن الشليف:')},${escapeCsv(`${avgBagWeightKG.toLocaleString()} KG`)}`,
      `${escapeCsv('QUARANTINED LOTS / وجبات محجورة:')},${quarantinedLots}`,
      `${escapeCsv('EXPIRED LOTS / وجبات منتهية الصلاحية:')},${expiredLots}`,
      `${escapeCsv('CLEAR & VERIFIED / وجبات سليمة ومطابقة:')},${verifiedNormalLots}`,
      `${escapeCsv('OFFLINE PERSISTENCE ENGINE / نظام التخزين والحفظ المحلي:')},${escapeCsv('IndexedDB (AlKarwanReceivingDB / scan_history) + LocalStorage Sync')}`,
      escapeCsv('===================================================================================================='),
      '', // Blank line separating metadata from data columns
    ];

    // Data Columns Headers
    const dataHeaders = [
      '#',
      isRTL ? 'تاريخ المسح' : 'Scan Date',
      isRTL ? 'وقت المسح' : 'Scan Time',
      isRTL ? 'كود المادة' : 'Material Code',
      isRTL ? 'معرف النظام' : 'System Material ID',
      isRTL ? 'اسم الخامة' : 'Material Name',
      isRTL ? 'كود QR المحقق' : 'Verified QR Code',
      isRTL ? 'الوزن الصافي (كغم)' : 'Net Weight (KG)',
      isRTL ? 'عدد الشلايف' : 'Bags Count',
      isRTL ? 'معدل الشليف (كغم)' : 'Avg Bag KG',
      isRTL ? 'المورد المعتمد' : 'Supplier',
      isRTL ? 'رقم الشاحنة' : 'Vehicle Plate',
      isRTL ? 'حالة الجودة والسلامة' : 'Quality & Safety Status',
      isRTL ? 'سبب التنبيه / الحجر' : 'Alert / Quarantine Reason',
      isRTL ? 'توجيهات مدير المستودع' : 'Manager Directives',
      isRTL ? 'ملاحظات المشغل' : 'Operator Notes',
    ];

    const dataRows = itemsToExport.map((item, index) => {
      const isQ = item.isQuarantined || item.status === 'QUARANTINED';
      const isE = item.isExpired || item.status === 'EXPIRED';

      let statusStr = isRTL ? '✓ سليم ومطابق للمواصفات' : 'VERIFIED (PASS)';
      let managerDirective = isRTL
        ? 'معتمد للتخزين المباشر في مستودع الخامات أو التوجيه لخط الثرم'
        : 'Approved for raw materials warehouse intake or shredding feed';

      if (isQ) {
        statusStr = isRTL ? '⚠️ محجور رقابياً (QUARANTINED)' : '⚠️ QUARANTINED (FLAGGED)';
        managerDirective = isRTL
          ? 'عزل فوري في ساحة الحجر Z-09 ويمنع الصرف أو الخلط بالإنتاج'
          : 'Strict isolation in Quarantine Yard Z-09; prohibit warehouse intake';
      } else if (isE) {
        statusStr = isRTL ? '⏰ منتهي الصلاحية (EXPIRED)' : '⏰ EXPIRED (REJECTED)';
        managerDirective = isRTL
          ? 'خامة منتهية - يمنع استخدامها في خط الألواح، يعاد فحصها أو تدويرها'
          : 'Expired polymer lot - rejected for extrusion; route to testing/recycling';
      }

      const itemAvgBag =
        item.bulkBagsCount && item.bulkBagsCount > 0
          ? Math.round(item.weightKG / item.bulkBagsCount)
          : item.weightKG;

      return [
        index + 1,
        escapeCsv(item.date),
        escapeCsv(item.displayTime),
        escapeCsv(item.materialCode),
        escapeCsv(item.materialId),
        escapeCsv(item.materialName),
        escapeCsv(item.qrCode),
        item.weightKG || 0,
        item.bulkBagsCount || 1,
        itemAvgBag || 0,
        escapeCsv(item.supplierName || 'شركة الكروان للبلاستيك'),
        escapeCsv(item.vehiclePlate || 'IQ-BAG-1082'),
        escapeCsv(statusStr),
        escapeCsv(
          item.alertReason ||
            (isQ ? 'حجز فحص الجودة المخبري' : isE ? 'تجاوز فترة الصلاحية والتخزين' : 'مطابق للمواصفات المعيارية')
        ),
        escapeCsv(managerDirective),
        escapeCsv(item.notes || 'تم التحقق من رمز QR بنجاح عبر الكاميرا'),
      ];
    });

    // Executive Summary Totals Row
    const totalsRow = [
      escapeCsv(isRTL ? 'الإجمالي العام / TOTALS' : 'TOTALS / SUMMARY'),
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      totalNetWeightKG,
      totalBulkBags,
      avgBagWeightKG,
      '""',
      '""',
      escapeCsv(
        quarantinedLots > 0 || expiredLots > 0
          ? `${quarantinedLots + expiredLots} شحنات عليها إنذار حجر/صلاحية`
          : 'كافة الشحنات سليمة ومطابقة'
      ),
      '""',
      '""',
      '""',
    ];

    // Manager Audit Sign-Off Block
    const signOffBlock = [
      '',
      escapeCsv('----------------------------------------------------------------------------------------------------'),
      escapeCsv('WAREHOUSE MANAGER AUDIT & QUALITY CLEARANCE / مصادقة وتدقيق إدارة المستودعات والرقابة النوعية'),
      `${escapeCsv('Manager In-Charge / مدير المستودع المسؤول:')},${escapeCsv(operatorName)}`,
      `${escapeCsv('Audit Timestamp / تاريخ وتوقيت المصادقة:')},${escapeCsv(`${dateStamp} ${readableTime}`)}`,
      `${escapeCsv('Manager Signature / توقيع المدير:')},${escapeCsv('_________________________________________')}`,
      `${escapeCsv('Audit Clearance / قرار الرقابة:')},${escapeCsv(quarantinedLots > 0 ? '[  ] Approved with Quarantine Isolation   [  ] Rejected' : '[X] Fully Approved for Warehouse Intake')}`,
      escapeCsv('----------------------------------------------------------------------------------------------------'),
    ];

    const allLines = [
      ...headerBlock,
      dataHeaders.join(','),
      ...dataRows.map((r) => r.join(',')),
      totalsRow.join(','),
      ...signOffBlock,
    ];

    const csvContent = allLines.join('\r\n');
    // Prepend UTF-8 BOM (\uFEFF) to guarantee Arabic text renders correctly in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `alkarwan_warehouse_scan_report_${dateStamp}_${timeStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExported(true);
    setUndoFeedback(
      isRTL
        ? `✓ تم تصدير تقرير المستودع بتنسيق CSV للمدراء (${itemsToExport.length} سجلات) بنجاح.`
        : `✓ Exported formatted manager CSV report (${itemsToExport.length} records) successfully.`
    );
    setTimeout(() => {
      setIsExported(false);
      setUndoFeedback(null);
    }, 4000);
  };

  const quarantinedCount = history.filter((i) => i.isQuarantined || i.status === 'QUARANTINED').length;
  const expiredCount = history.filter((i) => i.isExpired || i.status === 'EXPIRED').length;
  const totalAlertsCount = quarantinedCount + expiredCount;

  return (
    <div className="rounded-2xl bg-slate-900/95 border border-cyan-500/30 shadow-xl overflow-hidden space-y-3">
      {/* Header Bar */}
      <div className="p-4 sm:p-4.5 border-b border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
            <QrCode className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <span>{isRTL ? 'سجل المسح الضوئي (QR Scan History)' : 'Scan History (QR)'}</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                {isRTL ? `آخر 10 مواد محققة` : `Last 10 Verified`}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                <Database className="w-3 h-3 text-cyan-400" />
                <span>IndexedDB</span>
              </span>
              {totalAlertsCount > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-300 border border-red-500/50 animate-pulse">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  <span>
                    {totalAlertsCount} {isRTL ? 'تنبيهات حجر وصلاحية' : 'Alerts Flagged'}
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isRTL
                ? 'توثيق المواد والشلايف التي تم التعرف عليها ومسحها عبر الكاميرا مع كشف الخامات المحجورة والمنتهية فوراً وتحديث IndexedDB'
                : 'Log of materials successfully identified via camera QR scanner with instant quarantine/expiry alerts and IndexedDB persistence'}
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Undo Last Mistake Scan */}
          <button
            type="button"
            onClick={handleTriggerUndoLast}
            disabled={history.length === 0}
            className="px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              isRTL
                ? 'التراجع عن آخر إدخال مسح خاطئ وحذفه من قاعدة بيانات IndexedDB والعرض'
                : 'Undo last mistake scan entry and update IndexedDB and table display'
            }
          >
            <Undo2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRTL ? 'تراجع عن الأخير' : 'Undo Last'}</span>
          </button>

          {/* Bulk Undo for Multiple Selected Items */}
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleTriggerBulkUndo}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-700 via-amber-700 to-rose-600 hover:from-rose-600 hover:to-amber-600 border border-rose-400/50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950/60 cursor-pointer transition-all active:scale-95 animate-pulse"
              title={
                isRTL
                  ? `التراجع المجمّع وحذف ${selectedIds.length} مدخلات مسح محددة من IndexedDB والعرض`
                  : `Bulk Undo: Revert ${selectedIds.length} selected entries from IndexedDB and display`
              }
            >
              <Undo2 className="w-3.5 h-3.5 text-white" />
              <span>{isRTL ? `تراجع مجمّع (${selectedIds.length})` : `Bulk Undo (${selectedIds.length})`}</span>
            </button>
          )}

          {/* Quick Filter: All vs Alerts */}
          <div className="flex items-center rounded-xl bg-slate-950 p-0.5 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                statusFilter === 'ALL'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isRTL ? 'الكل' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ALERTS_ONLY')}
              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 transition ${
                statusFilter === 'ALERTS_ONLY'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-red-400 hover:text-red-300'
              }`}
            >
              <ShieldAlert className="w-3 h-3" />
              <span>{isRTL ? 'المحجورة/المنتهية' : 'Flagged Alerts'}</span>
              {totalAlertsCount > 0 && (
                <span className="px-1 rounded bg-black/40 text-[9px] font-mono">{totalAlertsCount}</span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isRTL ? 'بحث برمز المادة أو QR...' : 'Search material ID or QR...'}
              className="ps-8 pe-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none w-36 sm:w-48"
            />
          </div>

          {/* Export to CSV Button */}
          <button
            type="button"
            onClick={handleExportToCSV}
            disabled={displayedItems.length === 0 && history.length === 0}
            className="px-3 py-1.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRTL ? 'تصدير سجل المسح الضوئي إلى ملف CSV للتقارير دون اتصال' : 'Export scan history to CSV file for offline reporting'}
          >
            {isExported ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRTL ? 'تم التصدير' : 'Exported'}</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRTL ? 'تصدير CSV' : 'Export to CSV'}</span>
              </>
            )}
          </button>

          {onRestoreDefaults && (
            <button
              type="button"
              onClick={onRestoreDefaults}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title={isRTL ? 'استعادة السجل التجريبي وحفظه في IndexedDB' : 'Restore Demo History in IndexedDB'}
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">{isRTL ? 'استعادة' : 'Reset'}</span>
            </button>
          )}

          {onClearHistory && (
            <button
              type="button"
              onClick={onClearHistory}
              className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              title={isRTL ? 'مسح سجل المسح الضوئي وتفريغ IndexedDB' : 'Clear Scan History and flush IndexedDB'}
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">{isRTL ? 'مسح' : 'Clear'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Range Filter Bar for Custom Time Intervals */}
      <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
            <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{isRTL ? 'تصفية الفترة الزمنية:' : 'Date Range Interval:'}</span>
          </div>

          {/* Start Date (From) */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-700/80 focus-within:border-cyan-400 transition-colors">
            <span className="text-[10px] text-slate-400 font-semibold">
              {isRTL ? 'من:' : 'From:'}
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-white text-xs outline-none cursor-pointer [color-scheme:dark]"
              title={isRTL ? 'تاريخ البداية (من)' : 'Start Date (From)'}
            />
          </div>

          {/* End Date (To) */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1 rounded-xl border border-slate-700/80 focus-within:border-cyan-400 transition-colors">
            <span className="text-[10px] text-slate-400 font-semibold">
              {isRTL ? 'إلى:' : 'To:'}
            </span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-white text-xs outline-none cursor-pointer [color-scheme:dark]"
              title={isRTL ? 'تاريخ النهاية (إلى)' : 'End Date (To)'}
            />
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSetPresetToday}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                startDate === new Date().toISOString().slice(0, 10) && endDate === new Date().toISOString().slice(0, 10)
                  ? 'bg-cyan-600 text-white font-bold shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {isRTL ? 'اليوم' : 'Today'}
            </button>
            <button
              type="button"
              onClick={handleSetPresetLast7Days}
              className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer"
            >
              {isRTL ? 'آخر 7 أيام' : 'Last 7 Days'}
            </button>
            <button
              type="button"
              onClick={handleSetPresetThisMonth}
              className="px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition cursor-pointer hidden sm:inline"
            >
              {isRTL ? 'هذا الشهر' : 'This Month'}
            </button>

            {isDateFilterActive && (
              <button
                type="button"
                onClick={handleClearDateFilter}
                className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 flex items-center gap-1 transition cursor-pointer active:scale-95"
                title={isRTL ? 'إلغاء تصفية التاريخ وعرض كافة السجلات' : 'Clear date range filter'}
              >
                <X className="w-3 h-3 text-rose-400" />
                <span>{isRTL ? 'إلغاء التصفية' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Filter Status & Record Counter */}
        <div className="flex items-center gap-2">
          {isDateFilterActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 animate-pulse">
              <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {isRTL
                  ? `عرض ${displayedItems.length} من أصل ${history.length} سجلات مطابقة للفترة`
                  : `Showing ${displayedItems.length} of ${history.length} records in range`}
              </span>
            </span>
          ) : (
            <span className="text-slate-500 text-[10px] hidden sm:inline">
              {isRTL ? 'كافة السجلات الزمنية معروضة' : 'All date intervals displayed'}
            </span>
          )}
        </div>
      </div>

      {/* Undo Operation Feedback Toast */}
      {undoFeedback && (
        <div className="mx-4 p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-amber-400 shrink-0" />
            <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="font-semibold">{undoFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setUndoFeedback(null)}
            className="text-amber-400 hover:text-white font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-start text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px]">
              {/* Master Checkbox for Bulk Undo Selection */}
              <th className="p-3 text-center w-10">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                  title={
                    isAllSelected
                      ? isRTL
                        ? 'إلغاء تحديد الكل'
                        : 'Deselect All'
                      : isRTL
                      ? 'تحديد الكل للتراجع المجمّع'
                      : 'Select All for Bulk Undo'
                  }
                >
                  {isAllSelected ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                  ) : isSomeSelected ? (
                    <MinusSquare className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                </button>
              </th>
              <th className="p-3 text-center w-12">#</th>
              <th className="p-3 text-start">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isRTL ? 'وقت وتاريخ المسح' : 'Scan Timestamp'}</span>
                </div>
              </th>
              <th className="p-3 text-start">{isRTL ? 'معرف المادة (Material ID)' : 'Material ID'}</th>
              <th className="p-3 text-start">{isRTL ? 'اسم الخامة / الصنف' : 'Material Name'}</th>
              <th className="p-3 text-start">{isRTL ? 'كود QR المحقق' : 'Scanned QR Code'}</th>
              <th className="p-3 text-end">{isRTL ? 'الوزن (صافي)' : 'Net Weight'}</th>
              <th className="p-3 text-start">{isRTL ? 'المورد / الشاحنة' : 'Supplier / Truck'}</th>
              <th className="p-3 text-center">{isRTL ? 'حالة الأمان والتحقق' : 'Status & Alert'}</th>
              <th className="p-3 text-center">{isRTL ? 'إجراءات سريعة' : 'Quick Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {displayedItems.length > 0 ? (
              displayedItems.map((item, idx) => {
                const isQ = item.isQuarantined || item.status === 'QUARANTINED';
                const isE = item.isExpired || item.status === 'EXPIRED';
                const isSelected = selectedIds.includes(item.id);

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors group ${
                      isSelected
                        ? 'bg-cyan-950/40 border-s-4 border-cyan-400'
                        : isQ
                        ? 'bg-red-950/20 hover:bg-red-950/35 border-s-4 border-red-500'
                        : isE
                        ? 'bg-amber-950/20 hover:bg-amber-950/35 border-s-4 border-amber-500'
                        : 'hover:bg-cyan-950/20'
                    }`}
                  >
                    {/* Row Checkbox for Bulk Undo */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectItem(item.id)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        title={
                          isSelected
                            ? isRTL
                              ? 'إلغاء التحديد'
                              : 'Deselect'
                            : isRTL
                            ? 'تحديد للتراجع المجمّع'
                            : 'Select for Bulk Undo'
                        }
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                    </td>

                    {/* Row Index */}
                    <td className="p-3 text-center font-mono font-bold text-slate-500">
                      {idx + 1}
                    </td>

                    {/* Timestamp */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className={`w-3.5 h-3.5 shrink-0 ${isQ ? 'text-red-400' : isE ? 'text-amber-400' : 'text-cyan-400'}`} />
                        <div>
                          <div className={`font-mono font-bold text-xs ${isQ ? 'text-red-300' : isE ? 'text-amber-300' : 'text-cyan-300'}`}>
                            {item.displayTime}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.date}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Material ID (with quick copy) */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-1 rounded-lg font-mono font-bold text-xs shadow-sm ${
                            isQ
                              ? 'bg-red-950/90 border border-red-500/60 text-red-300'
                              : isE
                              ? 'bg-amber-950/90 border border-amber-500/60 text-amber-300'
                              : 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300'
                          }`}
                        >
                          {item.materialCode || item.materialId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyMaterialId(item.materialCode || item.materialId, item.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
                          title={isRTL ? 'نسخ معرف المادة' : 'Copy Material ID'}
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400 group-hover:text-cyan-300" />
                          )}
                        </button>
                      </div>
                      {item.materialId !== item.materialCode && (
                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                          ID: {item.materialId}
                        </div>
                      )}
                    </td>

                    {/* Material Name */}
                    <td className="p-3">
                      <div className={`font-bold text-xs leading-tight ${isQ ? 'text-red-200' : isE ? 'text-amber-200' : 'text-white'}`}>
                        {item.materialName}
                      </div>
                      {(item.alertReason || item.notes) && (
                        <div className={`text-[10px] truncate max-w-xs mt-0.5 ${isQ ? 'text-red-300/80' : isE ? 'text-amber-300/80' : 'text-slate-400'}`}>
                          {item.alertReason ? `⚠️ ${item.alertReason}` : item.notes}
                        </div>
                      )}
                    </td>

                    {/* Scanned QR Code */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="font-mono text-xs text-indigo-300 font-bold bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
                          {item.qrCode}
                        </span>
                      </div>
                    </td>

                    {/* Weight */}
                    <td className="p-3 text-end whitespace-nowrap">
                      <div className="font-mono font-bold text-amber-300 text-xs">
                        {item.weightKG.toLocaleString()} KG
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.bulkBagsCount || 1} {isRTL ? 'شليف' : 'Bag(s)'}
                      </div>
                    </td>

                    {/* Supplier & Truck */}
                    <td className="p-3 whitespace-nowrap">
                      <div className="text-white text-xs truncate max-w-xs">
                        {item.supplierName || '---'}
                      </div>
                      {item.vehiclePlate && (
                        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mt-0.5">
                          <Truck className="w-3 h-3 text-slate-500" />
                          <span>{item.vehiclePlate}</span>
                        </div>
                      )}
                    </td>

                    {/* Status Badge with Quarantine / Expiration Warning */}
                    <td className="p-3 text-center whitespace-nowrap">
                      {isQ ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onInspectAlert) onInspectAlert(item);
                            playMaterialWarningAlarm('QUARANTINED');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black font-mono bg-red-950 text-red-300 border border-red-500/60 shadow-sm shadow-red-950 animate-pulse cursor-pointer hover:bg-red-900 transition"
                          title={isRTL ? 'خامة محجورة - انقر لعرض تقرير الإنذار والتفاصيل' : 'Quarantined Material - Click for Alert Report'}
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                          <span>{isRTL ? '⚠️ محجور' : '⚠️ QUARANTINED'}</span>
                        </button>
                      ) : isE ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onInspectAlert) onInspectAlert(item);
                            playMaterialWarningAlarm('EXPIRED');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black font-mono bg-amber-950 text-amber-300 border border-amber-500/60 shadow-sm shadow-amber-950 cursor-pointer hover:bg-amber-900 transition"
                          title={isRTL ? 'خامة منتهية الصلاحية - انقر لعرض التفاصيل' : 'Expired Material - Click for details'}
                        >
                          <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isRTL ? '⏰ منتهي الصلاحية' : '⏰ EXPIRED'}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{isRTL ? 'سليم ومطابق' : 'VERIFIED'}</span>
                        </span>
                      )}
                    </td>

                    {/* Quick Action Buttons */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* If Quarantined or Expired, allow clicking Alert Report */}
                        {(isQ || isE) && onInspectAlert && (
                          <button
                            type="button"
                            onClick={() => onInspectAlert(item)}
                            className="px-2 py-1 rounded bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                            title={isRTL ? 'عرض تقرير الإنذار الأمني' : 'View Alert Report'}
                          >
                            <Siren className="w-3 h-3 text-red-400" />
                            <span>{isRTL ? 'تقرير الحجر' : 'Alert'}</span>
                          </button>
                        )}

                        {/* Apply to Scale In ticket (Blocked or warning for Quarantined unless overridden) */}
                        {onApplyToScaleIn && (
                          <button
                            type="button"
                            onClick={() => onApplyToScaleIn(item)}
                            disabled={isQ}
                            className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition ${
                              isQ
                                ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 cursor-pointer active:scale-95'
                            }`}
                            title={
                              isQ
                                ? isRTL
                                  ? 'محظور: المادة محجورة ولا يمكن تعبئة استمارة دخول عادية'
                                  : 'Blocked: Quarantined material cannot enter normal scale'
                                : isRTL
                                ? 'تطبيق المادة والوزن على استمارة الدخول'
                                : 'Apply material & weight to Scale-In ticket'
                            }
                          >
                            <ArrowRight className="w-3 h-3 text-cyan-400 rtl:rotate-180" />
                            <span>{isRTL ? 'تعبئة استمارة' : 'Scale In'}</span>
                          </button>
                        )}

                        {/* View Lifecycle */}
                        {onOpenBatchLifecycle && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenBatchLifecycle({
                                batchId: item.qrCode,
                                bagId: item.qrCode,
                                materialId: item.materialId,
                                rawText: item.qrCode,
                              })
                            }
                            className="px-2 py-1 rounded bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                            title={isRTL ? 'عرض دورة حياة المادة' : 'View Material Lifecycle'}
                          >
                            <Clock className="w-3 h-3 text-indigo-400" />
                            <span>{isRTL ? 'دورة' : 'Cycle'}</span>
                          </button>
                        )}

                        {/* Print Label */}
                        {onPrintLabel && (
                          <button
                            type="button"
                            onClick={() => onPrintLabel(item)}
                            className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                            title={isRTL ? 'طباعة ملصق الباركود الحراري' : 'Print Thermal QR Label'}
                          >
                            <Printer className="w-3 h-3 text-emerald-400" />
                            <span>{isRTL ? 'ملصق' : 'Label'}</span>
                          </button>
                        )}

                        {/* Inline Undo for this specific entry */}
                        <button
                          type="button"
                          onClick={() => handleInlineUndo(item)}
                          className="px-2 py-1 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                          title={isRTL ? 'التراجع عن هذا الإدخال وحذفه من IndexedDB' : 'Undo this entry from IndexedDB'}
                        >
                          <Undo2 className="w-3 h-3 text-amber-400" />
                          <span>{isRTL ? 'تراجع' : 'Undo'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    {isDateFilterActive ? (
                      <CalendarDays className="w-8 h-8 text-cyan-500/60" />
                    ) : (
                      <QrCode className="w-8 h-8 text-slate-600" />
                    )}
                    <p className="text-xs text-slate-300 font-medium">
                      {isDateFilterActive
                        ? isRTL
                          ? `لا توجد أي سجلات مسح مسجلة للفترة المحددة (${startDate || '...'} إلى ${endDate || '...'})`
                          : `No scan records found for the selected date interval (${startDate || '...'} to ${endDate || '...'})`
                        : isRTL
                        ? 'لم يتم العثور على أي نتائج مسح مطابقة لمعايير البحث'
                        : 'No QR scan records matched the current filter or search'}
                    </p>
                    {isDateFilterActive && (
                      <button
                        type="button"
                        onClick={handleClearDateFilter}
                        className="mt-1 px-3 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-semibold cursor-pointer transition active:scale-95"
                      >
                        {isRTL ? 'إلغاء تصفية التاريخ وعرض كافة السجلات' : 'Reset Date Filter to View All'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReceivingScanHistoryTable;
