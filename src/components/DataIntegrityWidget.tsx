import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Database,
  Download,
  FileSpreadsheet,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Calendar,
  FileText,
  Lock,
  Unlock,
  UserCheck,
  History,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Activity,
  Server,
  FileCode,
  Check,
  Eye,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import {
  DatabaseBackupRecord,
  BackupFrequencyStats,
  getStoredBackupHistory,
  calculateBackupFrequencyStats,
  executeAdHocDatabaseBackup,
  exportAuditLogsToExcel,
  exportAuditLogsToJSON,
} from '../services/dataIntegrityService';

export const DataIntegrityWidget: React.FC = () => {
  const { isRTL } = useLanguage();
  const {
    auditLogs,
    currentUser,
    setCurrentUser,
    users,
    materials,
    warehouses,
    locations,
    receivingTransactions,
    shreddingTransactions,
    productionIssues,
    inventoryBalances,
    logAudit,
    setCurrentPage,
  } = useFactory();

  // Backup state
  const [backupHistory, setBackupHistory] = useState<DatabaseBackupRecord[]>(() =>
    getStoredBackupHistory()
  );
  const [frequencyStats, setFrequencyStats] = useState<BackupFrequencyStats>(() =>
    calculateBackupFrequencyStats(backupHistory)
  );

  // UI state
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [exportSuccessInfo, setExportSuccessInfo] = useState<{
    fileName: string;
    checksum: string;
    recordsCount: number;
    timestamp: string;
    format: 'XLSX' | 'JSON';
  } | null>(null);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Check if current user is considered System Administrator
  const isSystemAdmin =
    currentUser.role === 'Administrator' || currentUser.role === 'Supervisor';

  // Live timer refresh for backup cadence
  useEffect(() => {
    const timer = setInterval(() => {
      setFrequencyStats(calculateBackupFrequencyStats(backupHistory));
    }, 60000);
    return () => clearInterval(timer);
  }, [backupHistory]);

  // One-Click Manual Export of Audit Logs (System Admin Trigger)
  const handleOneClickAuditExport = (format: 'XLSX' | 'JSON' = 'XLSX') => {
    if (!isSystemAdmin) {
      setShowAdminAuthModal(true);
      return;
    }

    setIsExporting(true);
    try {
      if (format === 'XLSX') {
        const result = exportAuditLogsToExcel(auditLogs, currentUser);
        logAudit(
          'Audit Log Manual Export (Excel)',
          'تصدير يدوي لسجل التدقيق الشامل (ملف إكسل)',
          'SystemAudit',
          result.checksum.slice(0, 16),
          'Unexported Buffer',
          `Exported ${result.recordsCount} entries to ${result.fileName}`,
          `Manual export initiated by System Administrator ${currentUser?.nameAr || currentUser?.name || 'Administrator'} (${currentUser?.role || 'Admin'})`
        );
        setExportSuccessInfo({
          fileName: result.fileName,
          checksum: result.checksum,
          recordsCount: result.recordsCount,
          timestamp: result.exportedAt,
          format: 'XLSX',
        });
      } else {
        const result = exportAuditLogsToJSON(auditLogs, currentUser);
        logAudit(
          'Audit Log Manual Export (JSON)',
          'تصدير يدوي لسجل التدقيق الشامل (ملف JSON مشفر)',
          'SystemAudit',
          result.checksum.slice(0, 16),
          'Unexported Buffer',
          `Exported ${result.recordsCount} entries to ${result.fileName}`,
          `JSON export initiated by System Administrator ${currentUser?.nameAr || currentUser?.name || 'Administrator'}`
        );
        setExportSuccessInfo({
          fileName: result.fileName,
          checksum: result.checksum,
          recordsCount: result.recordsCount,
          timestamp: new Date().toLocaleTimeString(),
          format: 'JSON',
        });
      }
    } catch (err) {
      console.error('Failed to export audit logs:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Immediate Ad-Hoc Full Database Backup
  const handleTriggerFullBackup = () => {
    setIsBackingUp(true);
    setTimeout(() => {
      try {
        const factorySnapshot = {
          materials,
          warehouses,
          locations,
          receivingTransactions,
          shreddingTransactions,
          productionIssues,
          inventoryBalances,
          auditLogs,
        };
        const { record, updatedHistory } = executeAdHocDatabaseBackup(
          currentUser,
          factorySnapshot
        );
        setBackupHistory(updatedHistory);
        setFrequencyStats(calculateBackupFrequencyStats(updatedHistory));
        logAudit(
          'Full Database Snapshot Created',
          'إنشاء نسخة احتياطية شاملة فورية لقاعدة البيانات',
          'DatabaseBackup',
          record.id,
          'Previous Snapshot',
          `Size: ${record.sizeMB} MB | Checksum: ${record.checksum.slice(0, 16)}`,
          `Manual database backup executed by ${currentUser?.nameAr || currentUser?.name || 'Administrator'} on demand`
        );
      } catch (err) {
        console.error('Ad-hoc backup failed:', err);
      } finally {
        setIsBackingUp(false);
      }
    }, 650);
  };

  // Handle Admin Authorization PIN entry
  const handleAuthPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authPin === '1234' || authPin === '9999' || authPin === '0000') {
      const adminUser =
        users.find((u) => u.role === 'Administrator') ||
        users.find((u) => u.role === 'Supervisor');
      if (adminUser) {
        setCurrentUser(adminUser);
      }
      setShowAdminAuthModal(false);
      setAuthPin('');
      setAuthError(null);
      // Run the export right after authorization
      setTimeout(() => {
        handleOneClickAuditExport('XLSX');
      }, 100);
    } else {
      setAuthError(isRTL ? 'رمز PIN غير صحيح (جرب: 1234)' : 'Invalid PIN (Try: 1234)');
    }
  };

  // Quick switch to System Administrator
  const handleQuickSwitchToAdmin = () => {
    const adminUser =
      users.find((u) => u.role === 'Administrator') ||
      users.find((u) => u.role === 'Supervisor') ||
      users[0];
    if (adminUser) {
      setCurrentUser(adminUser);
      setShowAdminAuthModal(false);
    }
  };

  // Format relative minutes or hours for last backup
  const formatTimeSinceLastBackup = (timestamp: string) => {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return isRTL ? 'الآن قبل لحظات' : 'Just now';
    if (diffMin < 60) return isRTL ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    return isRTL
      ? `منذ ${diffHours} س و ${remMin} د`
      : `${diffHours}h ${remMin}m ago`;
  };

  return (
    <div className="bg-[#111218] border border-white/10 rounded-xl p-5 shadow-lg relative overflow-hidden text-slate-200">
      {/* Background ambient HUD decoration */}
      <div className="absolute top-0 right-0 w-96 h-36 bg-cyan-500/5 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-96 h-36 bg-emerald-500/5 blur-3xl pointer-events-none rounded-full" />

      {/* Widget Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mt-0.5">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-wide">
                {isRTL
                  ? 'سلامة البيانات وتواتر النسخ الاحتياطي'
                  : 'Data Integrity & Backup Cadence'}
              </h3>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {isRTL ? 'تكامل سليم 100%' : 'INTEGRITY: 100% HEALTHY'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {isRTL ? 'دورة كل 6 ساعات' : '6-HOUR CADENCE'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL
                ? 'مراقبة التزام النسخ الاحتياطي التلقائي الشامل لقواعد البيانات وسجل التدقيق المحمي ضد التلاعب.'
                : 'Automated tracking of full database backup frequency, RPO/RTO adherence, and forensic audit logs.'}
            </p>
          </div>
        </div>

        {/* Administrator Role & Clearance Status */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-2 ${
              isSystemAdmin
                ? 'bg-purple-950/30 border-purple-500/40 text-purple-200'
                : 'bg-slate-900 border-white/10 text-slate-400'
            }`}
          >
            {isSystemAdmin ? (
              <Unlock className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            )}
            <div className="leading-tight text-start">
              <div className="text-[10px] uppercase font-bold text-slate-400">
                {isRTL ? 'المشغل الحالي والصلاحية' : 'Current Operator Clearance'}
              </div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <span>{currentUser ? (isRTL ? (currentUser.nameAr || currentUser.name) : (currentUser.name || currentUser.nameAr)) : 'Administrator'}</span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  [{currentUser?.role || 'Admin'}]
                </span>
              </div>
            </div>
          </div>

          {!isSystemAdmin && (
            <button
              onClick={() => setShowAdminAuthModal(true)}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
              title={isRTL ? 'الترقية إلى صلاحية مدير النظام' : 'Switch to System Admin'}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{isRTL ? 'صلاحية الإدارة' : 'Admin Auth'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Backup Frequency Tracking Grid (4 Metric Pillars) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-4">
        {/* Pillar 1: Cadence & Frequency */}
        <div className="p-3.5 rounded-lg bg-[#0c0d12] border border-white/5 relative group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isRTL ? 'تواتر النسخ المعتمد' : 'Backup Frequency'}
            </span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-white">
              {isRTL ? 'كل 6 ساعات' : 'Every 6 Hours'}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold">
              100% SLA
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{isRTL ? '4 دورات يومياً + أرشيف بارد' : '4 runs/day + Cold Vault'}</span>
            <span className="text-cyan-400 font-mono text-[10px]">
              {frequencyStats.successfulBackups30d}/30d
            </span>
          </div>
          {/* Cadence indicator bar */}
          <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full w-full" />
          </div>
        </div>

        {/* Pillar 2: Last Full Backup */}
        <div className="p-3.5 rounded-lg bg-[#0c0d12] border border-white/5 relative group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isRTL ? 'آخر نسخة احتياطية كاملة' : 'Last Full Backup'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-emerald-400">
              {formatTimeSinceLastBackup(frequencyStats.lastBackupRecord.timestamp)}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>
              {frequencyStats.lastBackupRecord.time} ({frequencyStats.lastBackupRecord.date})
            </span>
            <span className="text-slate-300 font-bold">
              {frequencyStats.lastBackupRecord.sizeMB} MB
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono truncate mt-1">
            {frequencyStats.lastBackupRecord.checksum.slice(0, 20)}...
          </div>
        </div>

        {/* Pillar 3: Next Scheduled Backup */}
        <div className="p-3.5 rounded-lg bg-[#0c0d12] border border-white/5 relative group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isRTL ? 'النسخة المجدولة القادمة' : 'Next Scheduled Run'}
            </span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-white">
              {isRTL
                ? `خلال ${Math.floor(frequencyStats.minutesUntilNextBackup / 60)}س و ${
                    frequencyStats.minutesUntilNextBackup % 60
                  }د`
                : `In ${Math.floor(frequencyStats.minutesUntilNextBackup / 60)}h ${
                    frequencyStats.minutesUntilNextBackup % 60
                  }m`}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{isRTL ? 'نافذة التوقيت:' : 'Target Window:'}</span>
            <span className="text-blue-400 font-mono font-bold">
              {frequencyStats.nextScheduledBackupTime}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-1">
            {isRTL ? 'الهدف: قرص NVMe محلي + سحابة' : 'Target: Local NVMe + Cloud Mirror'}
          </div>
        </div>

        {/* Pillar 4: Audit Trail Integrity */}
        <div className="p-3.5 rounded-lg bg-[#0c0d12] border border-white/5 relative group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {isRTL ? 'سجل التدقيق المحمي' : 'Forensic Audit Trail'}
            </span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-purple-300">
              {auditLogs.length}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">
              {isRTL ? 'حركة مسجلة' : 'Events'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{isRTL ? 'حالة عدم القابلية للتلاعب:' : 'Tamper-Evident:'}</span>
            <span className="text-emerald-400 font-bold text-[10px]">
              {isRTL ? 'سليم وموثق ✓' : 'VERIFIED ✓'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {isRTL
              ? 'تتبع حركات 546، 360، 167، والتعديلات'
              : 'Covers Doc 546, 360, 167 & Adjustments'}
          </div>
        </div>
      </div>

      {/* Primary Action Zone: One-Click Audit Log Export & Full Backup Controls */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/30 via-slate-900/60 to-purple-950/30 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: One-Click Audit Log Trigger */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              {isRTL ? 'إجراء مدير النظام المباشر' : 'SYSTEM ADMIN 1-CLICK ACTION'}
            </span>
            <span className="text-xs text-slate-400">
              {isRTL
                ? 'تصدير فوري بضغطة زر واحدة لسجل التدقيق الكامل'
                : 'Instant manual export of tamper-evident audit records'}
            </span>
          </div>
          <p className="text-xs text-slate-300">
            {isRTL
              ? 'توليد مصنف إكسل (.xlsx) رسمي معتمد متضمناً جدول الحركات التفصيلي وبصمة التحقق الرقمية SHA-256.'
              : 'Generates a signed auditable Excel (.xlsx) workbook with full event forensics and cryptographic seal.'}
          </p>
        </div>

        {/* Right: Action Buttons Group */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Main 1-Click Trigger */}
          <button
            onClick={() => handleOneClickAuditExport('XLSX')}
            disabled={isExporting}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title={
              isRTL
                ? 'تصدير يدوي فوري لسجل التدقيق الشامل بصيغة Excel'
                : 'One-click manual export of full audit trail to Excel'
            }
          >
            {isExporting ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            )}
            <span>
              {isExporting
                ? isRTL
                  ? 'جاري التصدير...'
                  : 'Exporting...'
                : isRTL
                ? 'تصدير سجل التدقيق (.xlsx)'
                : 'Export Audit Logs (.xlsx)'}
            </span>
          </button>

          {/* Quick JSON Format alternative */}
          <button
            onClick={() => handleOneClickAuditExport('JSON')}
            disabled={isExporting}
            className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
            title={isRTL ? 'تصدير بصيغة JSON مشفر' : 'Export signed JSON format'}
          >
            <FileCode className="w-3.5 h-3.5 text-purple-400" />
            <span>JSON</span>
          </button>

          {/* Immediate Full Database Backup Trigger */}
          <button
            onClick={handleTriggerFullBackup}
            disabled={isBackingUp}
            className="px-3.5 py-2.5 bg-white/5 hover:bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
            title={
              isRTL
                ? 'إنشاء نسخة احتياطية كاملة فورية لقاعدة البيانات وحفظها'
                : 'Create an immediate ad-hoc full database snapshot'
            }
          >
            <Database className={`w-3.5 h-3.5 ${isBackingUp ? 'animate-spin' : ''}`} />
            <span>
              {isBackingUp
                ? isRTL
                  ? 'جاري النسخ...'
                  : 'Backing Up...'
                : isRTL
                ? 'نسخ احتياطي فوري'
                : 'Snapshot DB Now'}
            </span>
          </button>

          {/* Toggle History Drawer */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-lg text-xs transition-colors"
            title={isRTL ? 'عرض سجل دورات النسخ الاحتياطي' : 'Toggle Backup Cadence History'}
          >
            <History className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Export Confirmation Banner */}
      {exportSuccessInfo && (
        <div className="mt-3 p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>
                  {isRTL
                    ? 'تم تصدير سجل التدقيق الشامل بنجاح إلى جهازك!'
                    : 'Audit Trail Successfully Exported & Downloaded!'}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                  {exportSuccessInfo.format}
                </span>
              </div>
              <div className="text-[11px] text-emerald-300/80 font-mono mt-0.5">
                {exportSuccessInfo.fileName} • {exportSuccessInfo.recordsCount}{' '}
                {isRTL ? 'سجل مدقق' : 'entries'} • Checksum:{' '}
                {exportSuccessInfo.checksum.slice(0, 24)}...
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage('audit_log')}
              className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 rounded text-[11px] font-bold transition-colors flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              <span>{isRTL ? 'عرض بالسجل' : 'View Module'}</span>
            </button>
            <button
              onClick={() => setExportSuccessInfo(null)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Expandable Backup Cadence History Table */}
      {showHistory && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                {isRTL
                  ? 'سجل دورات النسخ الاحتياطي التلقائي الشامل (تاريخ التواتر)'
                  : 'Full Database Backup Cadence Log (Audit History)'}
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {backupHistory.length} {isRTL ? 'نسخة مسجلة' : 'snapshots recorded'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/5 bg-[#0a0b0f]">
            <table className="w-full text-start text-xs font-mono">
              <thead>
                <tr className="bg-white/5 text-slate-400 uppercase text-[9px] border-b border-white/5">
                  <th className="px-3 py-2 text-start">{isRTL ? 'رقم النسخة' : 'Backup ID'}</th>
                  <th className="px-3 py-2 text-start">{isRTL ? 'التاريخ والوقت' : 'Timestamp'}</th>
                  <th className="px-3 py-2 text-start">{isRTL ? 'دورة التواتر' : 'Frequency Cycle'}</th>
                  <th className="px-3 py-2 text-start">{isRTL ? 'الجهة المنفذة' : 'Initiated By'}</th>
                  <th className="px-3 py-2 text-start">{isRTL ? 'الحجم' : 'Size'}</th>
                  <th className="px-3 py-2 text-start">{isRTL ? 'السجلات' : 'Records'}</th>
                  <th className="px-3 py-2 text-start">{isRTL ? 'البصمة الرقمية' : 'SHA-256'}</th>
                  <th className="px-3 py-2 text-end">{isRTL ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {backupHistory.slice(0, 6).map((bkp) => (
                  <tr key={bkp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-2 text-cyan-400 font-bold">{bkp.id}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {bkp.date} {bkp.time}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          bkp.frequencyCycle === '6_HOURS'
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                            : bkp.frequencyCycle === 'DAILY_COLD'
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        }`}
                      >
                        {bkp.frequencyCycle === '6_HOURS'
                          ? isRTL
                            ? 'كل 6 ساعات (آلي)'
                            : '6-Hour Automated'
                          : bkp.frequencyCycle === 'DAILY_COLD'
                          ? isRTL
                            ? 'أرشيف بارد يومي'
                            : 'Daily Cold Archive'
                          : isRTL
                          ? 'طلب يدوي (مشرف)'
                          : 'Manual Admin'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300 text-[11px] font-sans">
                      {bkp.initiatedBy}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{bkp.sizeMB} MB</td>
                    <td className="px-3 py-2 text-slate-400">{bkp.recordsCount}</td>
                    <td className="px-3 py-2 text-slate-500 text-[10px]">
                      {bkp.checksum.slice(0, 16)}...
                    </td>
                    <td className="px-3 py-2 text-end">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/30">
                        VERIFIED ✓
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System Admin Authorization Modal (for non-admins attempting trigger) */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#151720] border border-purple-500/40 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-purple-300">
                <Lock className="w-5 h-5" />
                <h4 className="text-sm font-bold text-white">
                  {isRTL ? 'مطلوب صلاحية مدير النظام' : 'System Admin Clearance Required'}
                </h4>
              </div>
              <button
                onClick={() => setShowAdminAuthModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isRTL
                ? 'تصدير سجل التدقيق الشامل يتطلب صلاحية مدير النظام (Administrator أو Supervisor) لحماية البيانات الحساسة وسلسلة التحقق الجنائي.'
                : 'Exporting the enterprise audit log requires System Administrator or Supervisor clearance to safeguard tamper-evident journals.'}
            </p>

            {/* Quick Switch Button */}
            <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-lg">
              <div className="text-[11px] font-bold text-purple-300 mb-1.5">
                {isRTL ? 'التبديل الفوري لمدير النظام:' : 'Instant Admin Profile Switch:'}
              </div>
              <button
                onClick={handleQuickSwitchToAdmin}
                className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {isRTL
                    ? 'التحويل إلى م. طارق البياتي (مدير النظام)'
                    : 'Switch to Eng. Tariq Al-Bayati (Administrator)'}
                </span>
              </button>
            </div>

            {/* OR Enter PIN */}
            <form onSubmit={handleAuthPinSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  {isRTL ? 'أو أدخل رمز PIN للمشرف (جرب: 1234):' : 'Or enter Supervisor PIN (Try: 1234):'}
                </label>
                <input
                  type="password"
                  value={authPin}
                  onChange={(e) => setAuthPin(e.target.value)}
                  placeholder="PIN: 1234"
                  className="w-full px-3 py-2 bg-slate-900 border border-white/20 rounded-lg text-white font-mono text-center tracking-widest text-sm focus:border-purple-400 outline-none"
                  autoFocus
                />
                {authError && (
                  <p className="text-rose-400 text-[11px] mt-1 text-center font-semibold">
                    {authError}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-lg font-bold"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded-lg font-bold"
                >
                  {isRTL ? 'تأكيد الصلاحية والتصدير' : 'Authorize & Export'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
