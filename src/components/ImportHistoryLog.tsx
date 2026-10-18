import React, { useState, useMemo } from 'react';
import {
  Search,
  FileSpreadsheet,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Sparkles,
  Filter,
  ArrowUpDown,
  Eye,
  Download,
  ShieldCheck,
  FileText,
  X,
  ExternalLink,
  Layers,
  Calendar,
  ChevronDown,
  Hash,
  Database,
  Check,
  FileJson,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { ImportBatch, ImportBatchStatus } from '../types';

// Helper to Export Import Batches to CSV with UTF-8 BOM
export const exportImportHistoryToCSV = (batches: ImportBatch[], isRTL = true) => {
  if (!batches || batches.length === 0) return false;

  const headers = isRTL
    ? [
        'معرف الدفعة (Batch ID)',
        'اسم ملف الإكسل (File Name)',
        'تاريخ ووقت الرفع (Upload Timestamp)',
        'المستخدم والمسؤول (Uploaded By)',
        'حالة الترحيل (Status)',
        'إجمالي الصفوف (Rows Read)',
        'الصفوف المقبولة (Rows Accepted)',
        'التحذيرات (Warnings)',
        'الأخطاء (Errors)',
        'صافي الوزن كغم (Total Net KG)',
        'الشلايف الكبيرة (Bulk Bags)',
        'طبيعة ونوع المستند (Document Type)',
        'أوراق العمل (Worksheets)',
        'بصمة التدقيق (Fingerprint)',
        'الملاحظات الجنائية (Audit Notes)',
      ]
    : [
        'Batch ID',
        'File Name',
        'Upload Date Time',
        'Uploaded By',
        'Status',
        'Rows Read',
        'Rows Accepted',
        'Rows Warning',
        'Rows Error',
        'Total KG',
        'Total Bags',
        'Document Type',
        'Sheets',
        'Fingerprint',
        'Notes',
      ];

  const rows = batches.map((b) => [
    `"${b.id || ''}"`,
    `"${(b.fileName || '').replace(/"/g, '""')}"`,
    `"${b.uploadDateTime || ''}"`,
    `"${(b.uploadedBy || '').replace(/"/g, '""')}"`,
    `"${b.status || ''}"`,
    b.rowsRead || 0,
    b.rowsAccepted || 0,
    b.rowsWarning || 0,
    b.rowsError || 0,
    b.totalKG || 0,
    b.totalBags || 0,
    `"${b.docType || ''}"`,
    `"${(b.sheets || []).join('; ')}"`,
    `"${b.fingerprint || b.id || ''}"`,
    `"${(b.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `alkarwan_import_history_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

interface ImportHistoryLogProps {
  batches?: ImportBatch[];
  onSelectBatch?: (batch: ImportBatch) => void;
  className?: string;
}

export const ImportHistoryLog: React.FC<ImportHistoryLogProps> = ({
  batches: propBatches,
  onSelectBatch,
  className = '',
}) => {
  const { isRTL } = useLanguage();
  const { importBatches } = useFactory();

  // Active data source: props or context
  const sourceBatches = propBatches || importBatches || [];

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'NEEDS_REVIEW' | 'FAILED'>('ALL');
  const [sortOption, setSortOption] = useState<'DATE_DESC' | 'DATE_ASC' | 'NAME_ASC' | 'ROWS_DESC' | 'WEIGHT_DESC'>('DATE_DESC');
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter & Search Logic
  const filteredBatches = useMemo(() => {
    return sourceBatches.filter((b) => {
      // 1. Search Query: Matches filename OR user identity (also batch ID or sheet name)
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const matchesFileName = (b.fileName || '').toLowerCase().includes(query);
        const matchesUser = (b.uploadedBy || '').toLowerCase().includes(query);
        const matchesBatchId = (b.id || '').toLowerCase().includes(query);
        const matchesDocType = (b.docType || '').toLowerCase().includes(query);
        const matchesNotes = (b.notes || '').toLowerCase().includes(query);
        const matchesSheets = (b.sheets || []).some((s) => s.toLowerCase().includes(query));

        if (!matchesFileName && !matchesUser && !matchesBatchId && !matchesDocType && !matchesNotes && !matchesSheets) {
          return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === 'COMPLETED') {
        if (b.status !== 'COMPLETED') return false;
      } else if (statusFilter === 'PENDING') {
        if (b.status !== 'ANALYZING' && b.status !== 'IMPORTING' && b.status !== 'READY') return false;
      } else if (statusFilter === 'NEEDS_REVIEW') {
        if (b.status !== 'NEEDS_REVIEW' && b.status !== 'PARTIALLY_IMPORTED') return false;
      } else if (statusFilter === 'FAILED') {
        if (b.status !== 'FAILED') return false;
      }

      return true;
    }).sort((a, b) => {
      switch (sortOption) {
        case 'DATE_DESC':
          return new Date(b.uploadDateTime || 0).getTime() - new Date(a.uploadDateTime || 0).getTime();
        case 'DATE_ASC':
          return new Date(a.uploadDateTime || 0).getTime() - new Date(b.uploadDateTime || 0).getTime();
        case 'NAME_ASC':
          return (a.fileName || '').localeCompare(b.fileName || '');
        case 'ROWS_DESC':
          return (b.rowsRead || 0) - (a.rowsRead || 0);
        case 'WEIGHT_DESC':
          return (b.totalKG || 0) - (a.totalKG || 0);
        default:
          return 0;
      }
    });
  }, [sourceBatches, searchTerm, statusFilter, sortOption]);

  // Aggregate Metrics for Header
  const metrics = useMemo(() => {
    const totalCount = sourceBatches.length;
    const completedCount = sourceBatches.filter((b) => b.status === 'COMPLETED').length;
    const pendingCount = sourceBatches.filter((b) => b.status === 'ANALYZING' || b.status === 'IMPORTING' || b.status === 'READY').length;
    const reviewCount = sourceBatches.filter((b) => b.status === 'NEEDS_REVIEW' || b.status === 'PARTIALLY_IMPORTED').length;
    const failedCount = sourceBatches.filter((b) => b.status === 'FAILED').length;
    const totalAcceptedRows = sourceBatches.reduce((acc, b) => acc + (b.rowsAccepted || 0), 0);
    const totalWeightKG = sourceBatches.reduce((acc, b) => acc + (b.totalKG || 0), 0);

    return {
      totalCount,
      completedCount,
      pendingCount,
      reviewCount,
      failedCount,
      totalAcceptedRows,
      totalWeightKG,
    };
  }, [sourceBatches]);

  // Copy Batch ID helper
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export Filtered Table as CSV
  const handleExportCSV = () => {
    exportImportHistoryToCSV(filteredBatches, isRTL);
  };

  // Helper for Status Badge Styling (Color-coded chips with icons and dot indicators for optimal readability)
  const renderStatusBadge = (status: ImportBatchStatus) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono tracking-tight bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950/40 transition-all select-none whitespace-nowrap"
            title={isRTL ? 'العملية ناجحة ومكتملة الاعتماد' : 'Operation completed successfully'}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/80 flex-shrink-0" />
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>{isRTL ? 'ناجح • Success' : 'Success'}</span>
          </span>
        );
      case 'ANALYZING':
      case 'IMPORTING':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono tracking-tight bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950/40 transition-all select-none whitespace-nowrap"
            title={isRTL ? 'العملية قيد الانتظار والمعالجة' : 'Operation pending execution / processing'}
          >
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin flex-shrink-0" />
            <span>{isRTL ? 'قيد الانتظار • Pending' : 'Pending'}</span>
          </span>
        );
      case 'READY':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono tracking-tight bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-950/40 transition-all select-none whitespace-nowrap"
            title={isRTL ? 'جاهز للاعتماد والترحيل' : 'Ready for migration commit'}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>{isRTL ? 'جاهز • Ready' : 'Pending (Ready)'}</span>
          </span>
        );
      case 'NEEDS_REVIEW':
      case 'PARTIALLY_IMPORTED':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono tracking-tight bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-950/40 transition-all select-none whitespace-nowrap"
            title={isRTL ? 'يحتوي على تنبيهات أو فروقات تحتاج تدقيق' : 'Contains warnings requiring supervisor review'}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>{isRTL ? 'يتطلب مراجعة • Review' : 'Needs Review'}</span>
          </span>
        );
      case 'FAILED':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono tracking-tight bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-950/40 transition-all select-none whitespace-nowrap"
            title={isRTL ? 'فشلت عملية الاستيراد لوجود أخطاء جسيمة' : 'Import failed due to validation errors'}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400 shadow-sm shadow-rose-400/80 flex-shrink-0" />
            <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span>{isRTL ? 'فاشل • Failed' : 'Failed'}</span>
          </span>
        );
      case 'CANCELLED':
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono tracking-tight bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 shadow-sm transition-all select-none whitespace-nowrap"
            title={isRTL ? 'تم إلغاء العملية من قبل المستخدم' : 'Operation cancelled'}
          >
            <span className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0" />
            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{isRTL ? 'ملغى • Cancelled' : 'Cancelled'}</span>
          </span>
        );
    }
  };

  return (
    <div className={`bg-[#0f1115] border border-white/10 rounded-xl p-5 sm:p-6 space-y-6 shadow-xl ${className}`}>
      {/* Header with Title & Aggregate KPIs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                {isRTL ? 'سجل عمليات الاستيراد والتدقيق التاريخي' : 'Historical Ingestion Audit Log'}
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {metrics.totalCount} {isRTL ? 'ملفات' : 'Files'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'سجل جنائي وتدقيقي لكافة ملفات الإكسل المرفوعة سابقاً، هوية المستخدمين، وتاريخ وحالة نجاح الترحيل المخزني.'
                  : 'Forensic audit log of uploaded Excel workbooks, user identity attribution, upload timestamps, and ingestion verification status.'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions (Export CSV) */}
        <div className="flex items-center gap-2.5 self-start md:self-center">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredBatches.length === 0}
            className="px-3.5 py-2 rounded-lg text-xs font-bold font-mono bg-slate-900 hover:bg-slate-800 text-slate-200 border border-white/10 hover:border-cyan-500/50 shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRTL ? 'تصدير السجل بتنسيق CSV' : 'Export log as CSV'}
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>{isRTL ? 'تصدير السجل (CSV)' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* KPI Counters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            {isRTL ? 'إجمالي الملفات المرفوعة' : 'Total Uploaded'}
          </div>
          <div className="text-lg font-bold font-mono text-white">{metrics.totalCount}</div>
        </div>

        <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1">
          <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isRTL ? 'معتمدة ومكتملة' : 'Successfully Ingested'}
          </div>
          <div className="text-lg font-bold font-mono text-emerald-300">
            {metrics.completedCount}
            <span className="text-xs text-emerald-500/80 mr-1 ml-1">
              ({metrics.totalCount > 0 ? Math.round((metrics.completedCount / metrics.totalCount) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 space-y-1">
          <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            {isRTL ? 'إجمالي الصفوف المقبولة' : 'Accepted Data Rows'}
          </div>
          <div className="text-lg font-bold font-mono text-cyan-300">
            {metrics.totalAcceptedRows.toLocaleString()}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            {isRTL ? 'الوزن المرحل (كغم)' : 'Migrated Net Weight'}
          </div>
          <div className="text-lg font-bold font-mono text-amber-300">
            {metrics.totalWeightKG > 0 ? `${metrics.totalWeightKG.toLocaleString()} KG` : '0 KG'}
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2">
        {/* Search Input Field (Requirement: filter by filename or user identity) */}
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3.5' : 'left-3.5'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isRTL
                ? 'بحث باسم ملف الإكسل (مثلاً: خامات 9) أو هوية المستخدم (مثلاً: أحمد خليل أو المشرف)...'
                : 'Search by Excel filename (e.g. RAW_STORE_9) or user identity (e.g. Ahmed, Supervisor)...'
            }
            className={`w-full bg-slate-900 border border-white/10 focus:border-cyan-400 rounded-lg py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
              isRTL ? 'pr-10 pl-9 text-right' : 'pl-10 pr-9 text-left'
            }`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer ${
                isRTL ? 'left-2.5' : 'right-2.5'
              }`}
              title={isRTL ? 'مسح البحث' : 'Clear search'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-cyan-500 text-black font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {isRTL ? 'الكل' : 'All'} ({sourceBatches.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {isRTL ? 'ناجح (مكتمل)' : 'Success'} ({metrics.completedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'PENDING'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {isRTL ? 'قيد الانتظار' : 'Pending'} ({metrics.pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('NEEDS_REVIEW')}
            className={`px-3 py-1.5 rounded-lg font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'NEEDS_REVIEW'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {isRTL ? 'مراجعة' : 'Needs Review'} ({metrics.reviewCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('FAILED')}
            className={`px-3 py-1.5 rounded-lg font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
              statusFilter === 'FAILED'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {isRTL ? 'فشل' : 'Failed'} ({metrics.failedCount})
          </button>

          {/* Sort Selector */}
          <div className="relative inline-block ml-auto">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="DATE_DESC">{isRTL ? 'الأحدث أولاً' : 'Newest First'}</option>
              <option value="DATE_ASC">{isRTL ? 'الأقدم أولاً' : 'Oldest First'}</option>
              <option value="NAME_ASC">{isRTL ? 'اسم الملف (أ-ي)' : 'Filename (A-Z)'}</option>
              <option value="ROWS_DESC">{isRTL ? 'الأعلى صفوفاً' : 'Highest Rows'}</option>
              <option value="WEIGHT_DESC">{isRTL ? 'الأعلى وزناً' : 'Highest Weight'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active Search / Filter Feedback Bar */}
      {(searchTerm || statusFilter !== 'ALL') && (
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-900/40 px-3 py-2 rounded-lg border border-white/5">
          <div className="flex items-center gap-2">
            <span>
              {isRTL ? 'تم العثور على' : 'Found'}{' '}
              <strong className="text-cyan-400">{filteredBatches.length}</strong>{' '}
              {isRTL ? 'سجل من أصل' : 'records out of'}{' '}
              <strong className="text-white">{sourceBatches.length}</strong>
            </span>
            {searchTerm && (
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[11px]">
                {isRTL ? 'بحث:' : 'Search:'} "{searchTerm}"
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 text-[11px]">
                {statusFilter}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
          >
            {isRTL ? 'إعادة ضبط التصفية' : 'Reset filters'}
          </button>
        </div>
      )}

      {/* IMPORT HISTORY AUDIT TABLE */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40">
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-slate-900/80 text-[11px] font-mono text-slate-400">
              <th className={`p-3.5 font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? 'ملف الإكسل وحجمه' : 'Excel File & Volume'}
              </th>
              <th className={`p-3.5 font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? 'تاريخ ووقت الرفع' : 'Timestamp'}
              </th>
              <th className={`p-3.5 font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? 'هوية المستخدم / المسؤول' : 'User Identity'}
              </th>
              <th className="p-3.5 font-bold text-center">
                {isRTL ? 'حالة الترحيل' : 'Status'}
              </th>
              <th className={`p-3.5 font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? 'إحصائيات التدقيق المخزني' : 'Audit Ingestion Metrics'}
              </th>
              <th className="p-3.5 font-bold text-center">
                {isRTL ? 'الإجراءات' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-xs">
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500">
                      <Search className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {searchTerm
                        ? isRTL
                          ? `لا توجد سجلات مطابقة للبحث "${searchTerm}"`
                          : `No import logs match "${searchTerm}"`
                        : isRTL
                        ? 'لا توجد دفعات استيراد مسجلة حتى الآن'
                        : 'No import batches recorded yet'}
                    </div>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {searchTerm
                        ? isRTL
                          ? 'جرب البحث باسم ملف آخر أو اسم مستخدم مختلف، أو انقر مسح البحث لإظهار كافة الدفعات.'
                          : 'Try searching with a different filename or user identifier, or reset filters.'
                        : isRTL
                        ? 'عند قيام المستخدمين برفع ملفات إكسل أو تنفيذ عمليات الترحيل التاريخي، سيتم توثيقها تلقائياً هنا.'
                        : 'When users upload Excel sheets or execute migrations, their forensic logs will automatically appear here.'}
                    </p>
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono bg-cyan-600 hover:bg-cyan-500 text-white transition-all cursor-pointer"
                      >
                        {isRTL ? 'مسح عبارة البحث' : 'Clear Search Query'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredBatches.map((batch) => {
                const isSelected = selectedBatch?.id === batch.id;
                const dateObj = batch.uploadDateTime ? new Date(batch.uploadDateTime) : null;
                const formattedDate = dateObj && !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString(isRTL ? 'ar-IQ' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : batch.uploadDateTime || 'N/A';
                const formattedTime = dateObj && !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleTimeString(isRTL ? 'ar-IQ' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <tr
                    key={batch.id}
                    className={`hover:bg-slate-900/50 transition-colors ${
                      isSelected ? 'bg-cyan-950/20' : ''
                    }`}
                  >
                    {/* Excel File Column */}
                    <td className="p-3.5">
                      <div className="flex items-start gap-2.5">
                        <div className="p-2 rounded-lg bg-slate-900 border border-white/10 text-cyan-400 flex-shrink-0 mt-0.5">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{batch.fileName}</span>
                            {batch.docType && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-slate-300">
                                {batch.docType}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                            <span>{batch.fileSize || '38.4 KB'}</span>
                            <span>•</span>
                            <span title={(batch.sheets || []).join(', ')}>
                              {(batch.sheets || []).length}{' '}
                              {isRTL ? 'أوراق عمل' : 'Sheets'}
                            </span>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={() => handleCopyId(batch.id)}
                              className="text-[10px] text-slate-500 hover:text-cyan-400 flex items-center gap-0.5 cursor-pointer"
                              title={isRTL ? 'نسخ معرف الدفعة' : 'Copy Batch ID'}
                            >
                              {copiedId === batch.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Hash className="w-3 h-3" />
                              )}
                              <span>{batch.id}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Timestamp Column */}
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="text-white font-mono flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formattedDate}</span>
                        </div>
                        {formattedTime && (
                          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{formattedTime}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* User Identity Column */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-cyan-400 font-bold font-mono text-xs flex-shrink-0">
                          {batch.uploadedBy ? batch.uploadedBy.charAt(0) : 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-white text-xs">
                            {batch.uploadedBy || (isRTL ? 'مستخدم النظام' : 'System User')}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {batch.uploadedBy?.includes('مدير') || batch.uploadedBy?.includes('مشرف')
                              ? (isRTL ? 'صلاحية إدارية عليا' : 'Supervisor Clearance')
                              : (isRTL ? 'مدخل بيانات معتمد' : 'Authorized Ingestor')}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Success Status Column */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      {renderStatusBadge(batch.status)}
                    </td>

                    {/* Ingestion & Audit Metrics */}
                    <td className="p-3.5">
                      <div className="space-y-1 font-mono text-[11px]">
                        <div className="flex items-center justify-between gap-4 text-slate-300">
                          <span>{isRTL ? 'الصفوف المقبولة:' : 'Accepted:'}</span>
                          <span className="font-bold text-white">
                            {batch.rowsAccepted ?? batch.importedRowsCount ?? 0} / {batch.rowsRead || 0}
                          </span>
                        </div>
                        {batch.totalKG ? (
                          <div className="flex items-center justify-between gap-4 text-amber-300">
                            <span>{isRTL ? 'صافي الوزن:' : 'Net KG:'}</span>
                            <span className="font-bold">+{batch.totalKG.toLocaleString()} KG</span>
                          </div>
                        ) : null}
                        {((batch.rowsWarning || 0) > 0 || (batch.rowsError || 0) > 0) && (
                          <div className="flex items-center gap-2 text-[10px]">
                            {batch.rowsWarning ? (
                              <span className="text-amber-400">
                                {batch.rowsWarning} {isRTL ? 'تحذير' : 'Warn'}
                              </span>
                            ) : null}
                            {batch.rowsError ? (
                              <span className="text-rose-400">
                                {batch.rowsError} {isRTL ? 'خطأ' : 'Err'}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Action Column */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedBatch(batch)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/40 transition-all cursor-pointer"
                          title={isRTL ? 'معاينة التفاصيل الجنائية للدفعة' : 'Inspect batch details'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {onSelectBatch && (
                          <button
                            type="button"
                            onClick={() => onSelectBatch(batch)}
                            className="px-2 py-1 rounded-lg text-[11px] font-mono bg-cyan-600/80 hover:bg-cyan-500 text-white transition-all cursor-pointer"
                            title={isRTL ? 'تحميل في نافذة الفحص' : 'Open in Migration Inspector'}
                          >
                            {isRTL ? 'فحص' : 'Inspect'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* DETAILED BATCH INSPECTION MODAL */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-[#0f1115] border border-white/20 rounded-2xl p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedBatch.fileName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-0.5">
                    <span>{selectedBatch.id}</span>
                    <span>•</span>
                    <span>{selectedBatch.fileSize || 'N/A'}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ingestion Status & Attribution Banner */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-white/10">
              <div className="space-y-1">
                <div className="text-[11px] font-mono text-slate-400">{isRTL ? 'حالة الترحيل' : 'Status'}</div>
                <div>{renderStatusBadge(selectedBatch.status)}</div>
              </div>

              <div className="space-y-1 text-end">
                <div className="text-[11px] font-mono text-slate-400">{isRTL ? 'المسؤول والموثق' : 'Uploaded By'}</div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5 justify-end">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  {selectedBatch.uploadedBy}
                </div>
              </div>
            </div>

            {/* Quantitative Ingestion Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1 text-center">
                <div className="text-[10px] font-mono text-slate-400">{isRTL ? 'إجمالي الصفوف' : 'Total Read'}</div>
                <div className="text-base font-bold font-mono text-white">{selectedBatch.rowsRead || 0}</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 space-y-1 text-center">
                <div className="text-[10px] font-mono text-emerald-400">{isRTL ? 'الصفوف المقبولة' : 'Accepted'}</div>
                <div className="text-base font-bold font-mono text-emerald-300">{selectedBatch.rowsAccepted || 0}</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1 text-center">
                <div className="text-[10px] font-mono text-slate-400">{isRTL ? 'أخطاء / تحذيرات' : 'Errors / Warns'}</div>
                <div className="text-base font-bold font-mono text-amber-300">
                  {(selectedBatch.rowsWarning || 0) + (selectedBatch.rowsError || 0)}
                </div>
              </div>
            </div>

            {/* Inventory Ledger Impact Summary */}
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
              <div className="text-xs font-bold font-mono text-slate-300 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                {isRTL ? 'أثر حركة المخزون المترتبة' : 'Ledger Ingestion Impact'}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs font-mono">
                <div className="p-2 rounded bg-slate-950 border border-white/5">
                  <div className="text-[10px] text-slate-400">{isRTL ? 'صافي الوزن المرحل' : 'Net Weight Added'}</div>
                  <div className="text-sm font-bold text-amber-300">
                    +{selectedBatch.totalKG ? selectedBatch.totalKG.toLocaleString() : '0'} KG
                  </div>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-white/5">
                  <div className="text-[10px] text-slate-400">{isRTL ? 'عدد الأكياس الكبيرة (Bulk Bags)' : 'Bulk Bags'}</div>
                  <div className="text-sm font-bold text-cyan-300">
                    +{selectedBatch.totalBags || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Included Sheets in Workbook */}
            <div className="space-y-2">
              <div className="text-xs font-bold font-mono text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                {isRTL ? 'أوراق العمل المكتشفة في المصنف' : 'Worksheets in Workbook'}
              </div>
              <div className="flex flex-wrap gap-2">
                {(selectedBatch.sheets || []).map((sheet, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-900 border border-white/10 text-slate-200"
                  >
                    {sheet}
                  </span>
                ))}
              </div>
            </div>

            {/* Ingestion Notes / Audit Trail */}
            {selectedBatch.notes && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold font-mono text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  {isRTL ? 'ملاحظات وتوثيق التدقيق' : 'Audit Ingestion Notes'}
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 text-xs text-slate-300 font-mono leading-relaxed">
                  {selectedBatch.notes}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="text-[11px] font-mono text-slate-500">
                {isRTL ? 'بصمة التدقيق:' : 'Fingerprint:'} {selectedBatch.fingerprint || selectedBatch.id}
              </div>
              <button
                type="button"
                onClick={() => setSelectedBatch(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold font-mono bg-cyan-600 hover:bg-cyan-500 text-white transition-all cursor-pointer"
              >
                {isRTL ? 'إغلاق المعاينة' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
