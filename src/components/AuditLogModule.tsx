import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User,
  Activity,
  Layers,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Mic,
  MicOff,
  Volume2,
  Copy,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  AlertTriangle,
  Flame,
  Scale,
  Boxes,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { exportAuditLogsToExcel } from '../services/dataIntegrityService';
import { VoiceAuditObservationModal } from './VoiceAuditObservationModal';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export const AuditLogModule: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { auditLogs, currentUser, logAudit } = useFactory();

  const [searchTerm, setSearchTerm] = useState('');
  const [exportedMsg, setExportedMsg] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<
    'ALL' | 'VOICE_OBSERVATION' | 'RECEIVING' | 'SHREDDING' | 'STORAGE' | 'PRODUCTION'
  >('ALL');
  const [isQuickBarOpen, setIsQuickBarOpen] = useState(false);
  const [quickCopiedId, setQuickCopiedId] = useState<string | null>(null);

  // Quick inline voice dictation state
  const {
    isListening: isQuickListening,
    transcript: quickTranscript,
    interimTranscript: quickInterim,
    language: quickLang,
    setLanguage: setQuickLang,
    volumeLevel: quickVolume,
    startListening: startQuickListening,
    stopListening: stopQuickListening,
    clearTranscript: clearQuickTranscript,
  } = useSpeechRecognition({ initialLanguage: 'ar-IQ' });

  const [quickShift, setQuickShift] = useState('صباحية (06:00 - 14:00)');
  const [quickArea, setQuickArea] = useState('ساحة الفرز والميزان (DOC-546)');
  const [quickSuccess, setQuickSuccess] = useState(false);

  const handleExport = () => {
    const res = exportAuditLogsToExcel(auditLogs, currentUser);
    logAudit(
      'Audit Log Manual Export (Excel)',
      'تصدير يدوي لسجل التدقيق الشامل',
      'SystemAudit',
      res.checksum.slice(0, 16),
      'None',
      `Exported ${res.recordsCount} entries to ${res.fileName}`,
      `Exported from Audit Log Module by ${currentUser.nameAr}`
    );
    setExportedMsg(true);
    setTimeout(() => setExportedMsg(false), 4000);
  };

  const handleQuickCommit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = (quickTranscript + ' ' + quickInterim).trim();
    if (!text) return;

    const obsId = `VOX-${Date.now().toString().slice(-6)}`;
    logAudit(
      'Verbal Shift Observation: Supervisor Field Note',
      'رصد ميداني وملاحظة صوتية: تفتيش الوردية المباشر',
      'VOICE_OBSERVATION',
      obsId,
      'Field Verbal Intake',
      `Logged by ${currentUser.nameAr} (${currentUser.role})`,
      `[${quickShift}] [Area: ${quickArea}] - ${text}`
    );

    clearQuickTranscript();
    setQuickSuccess(true);
    setTimeout(() => setQuickSuccess(false), 3500);
  };

  const handleCopyNote = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setQuickCopiedId(id);
    setTimeout(() => setQuickCopiedId(null), 2500);
  };

  // Filter logs
  const filteredLogs = auditLogs.filter((log) => {
    // Category filter
    if (activeCategoryFilter !== 'ALL') {
      const eType = log.entityType.toUpperCase();
      const act = log.action.toUpperCase();
      if (activeCategoryFilter === 'VOICE_OBSERVATION') {
        const isVoice =
          eType === 'VOICE_OBSERVATION' ||
          act.includes('VOICE') ||
          act.includes('VERBAL') ||
          (log.actionAr && log.actionAr.includes('صوت'));
        if (!isVoice) return false;
      } else if (activeCategoryFilter === 'RECEIVING') {
        if (!eType.includes('RECEIV') && !act.includes('RECEIV') && !act.includes('SCALE')) return false;
      } else if (activeCategoryFilter === 'SHREDDING') {
        if (!eType.includes('SHRED') && !act.includes('SHRED') && !act.includes('THERM')) return false;
      } else if (activeCategoryFilter === 'STORAGE') {
        if (!eType.includes('STORAGE') && !eType.includes('WAREHOUSE') && !act.includes('STOCK')) return false;
      } else if (activeCategoryFilter === 'PRODUCTION') {
        if (!eType.includes('PROD') && !act.includes('PROD')) return false;
      }
    }

    const detailsText = (log.notes || (log as any).details || '').toLowerCase();
    const actionAr = (log.actionAr || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(term) ||
      actionAr.includes(term) ||
      log.entityType.toLowerCase().includes(term) ||
      log.entityId.toLowerCase().includes(term) ||
      log.userName.toLowerCase().includes(term) ||
      detailsText.includes(term)
    );
  });

  const voiceLogsCount = auditLogs.filter(
    (l) =>
      l.entityType === 'VOICE_OBSERVATION' ||
      l.action.toUpperCase().includes('VOICE') ||
      l.action.toUpperCase().includes('VERBAL') ||
      (l.actionAr && l.actionAr.includes('صوت'))
  ).length;

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-blue-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
              TAMPER-EVIDENT AUDIT TRAIL
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'سجل التدقيق الأمني والعملياتي غير القابل للتعديل' : 'Compliance & Governance Journal'}
            </span>
            {voiceLogsCount > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                <Mic className="w-3 h-3 text-cyan-400" />
                <span>{voiceLogsCount} {isRTL ? 'ملاحظة صوتية موثقة' : 'Voice Notes'}</span>
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'سجل التدقيق الشامل وحركات المستخدمين' : 'Enterprise Audit Trail & System Logs'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'توثيق كل حركة وزن، استلام، ثرم، صرف، أو ملاحظة تفتيش شفوية للمشرفين بالصوت والنص والوقت.'
              : 'Permanent forensic log of every scale weigh-in, unload, shred, transfer, and supervisor verbal shift observation.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Record Voice Observation Button */}
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-950 flex items-center gap-2 cursor-pointer group"
          >
            <Mic className="w-4 h-4 text-cyan-200 group-hover:scale-110 transition-transform animate-pulse" />
            <span>{isRTL ? 'تسجيل ملاحظة تفتيش صوتية' : 'Record Voice Observation'}</span>
          </button>

          <button
            onClick={handleExport}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-700 flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'تصدير (.xlsx)' : 'Export (.xlsx)'}</span>
          </button>

          {exportedMsg && (
            <span className="text-xs text-emerald-400 font-bold animate-fadeIn">
              {isRTL ? 'تم التصدير بنجاح ✓' : 'Exported ✓'}
            </span>
          )}
        </div>
      </div>

      {/* Inline Quick Voice Observation Studio (Fast Dictation Bar) */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white text-xs">
              {isRTL ? 'شريط الإملاء الصوتي المباشر للمشرفين (Quick Shift Observation Deck)' : 'Real-Time Voice Dictation Deck for Shift Supervisors'}
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              ({isRTL ? 'تسجيل فوري بدون فتح نوافذ' : 'Fast 1-click dictation'})
            </span>
          </div>

          <button
            onClick={() => setIsQuickBarOpen(!isQuickBarOpen)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <span>{isQuickBarOpen ? (isRTL ? 'إخفاء الشريط' : 'Hide Deck') : (isRTL ? 'فتح الإملاء الصوتي' : 'Open Dictation')}</span>
            {isQuickBarOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {quickSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 font-bold animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{isRTL ? 'تم قيد الملاحظة الصوتية بنجاح في سجل التدقيق أدناه ✓' : 'Voice observation successfully logged to audit trail below ✓'}</span>
          </div>
        )}

        {isQuickBarOpen && (
          <form onSubmit={handleQuickCommit} className="space-y-3 pt-1 border-t border-slate-800/80 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={isQuickListening ? stopQuickListening : startQuickListening}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isQuickListening
                      ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30'
                      : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>
                    {isQuickListening
                      ? isRTL
                        ? 'إيقاف التسجيل'
                        : 'Stop Recording'
                      : isRTL
                      ? 'بدء التحدث الصوتي'
                      : 'Start Dictation'}
                  </span>
                </button>

                <select
                  value={quickLang}
                  onChange={(e) => setQuickLang(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                >
                  <option value="ar-IQ">العربية (العراق ar-IQ)</option>
                  <option value="ar-SA">العربية (الفصحى ar-SA)</option>
                  <option value="en-US">English (en-US)</option>
                </select>

                <select
                  value={quickShift}
                  onChange={(e) => setQuickShift(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                >
                  <option value="صباحية (06:00 - 14:00)">{isRTL ? 'وردية صباحية' : 'Morning Shift'}</option>
                  <option value="مسائية (14:00 - 22:00)">{isRTL ? 'وردية مسائية' : 'Afternoon Shift'}</option>
                  <option value="ليلية (22:00 - 06:00)">{isRTL ? 'وردية ليلية' : 'Night Shift'}</option>
                </select>

                <select
                  value={quickArea}
                  onChange={(e) => setQuickArea(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-slate-300 rounded-xl px-2.5 py-1.5 text-xs outline-none"
                >
                  <option value="ساحة الفرز والميزان (DOC-546)">{isRTL ? 'ساحة الفرز والميزان' : 'Weighbridge Yard'}</option>
                  <option value="وحدة الثرم والجرش 360 (DOC-360)">{isRTL ? 'وحدة الثرم 360' : 'Shredding 360'}</option>
                  <option value="مستودع الخزن WH-02 (DOC-352)">{isRTL ? 'مستودع WH-02' : 'Warehouse WH-02'}</option>
                  <option value="خط البثق والتشكيل">{isRTL ? 'خط البثق والتشكيل' : 'Extrusion Line'}</option>
                </select>
              </div>

              {isQuickListening && (
                <div className="flex items-center gap-2 text-cyan-300 text-[11px] animate-pulse">
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>{isRTL ? 'التقاط الصوت نشط...' : 'Audio live...'} ({quickVolume}%)</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={quickTranscript + (quickInterim ? ` [${quickInterim}]` : '')}
                onChange={(e) => {}}
                placeholder={
                  isRTL
                    ? 'انقر "بدء التحدث الصوتي" للتكلم، وسيتحول صوتك لنص تلقائياً...'
                    : 'Click "Start Dictation" and speak into microphone...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs outline-none focus:border-cyan-400"
              />

              <button
                type="submit"
                disabled={!quickTranscript.trim()}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{isRTL ? 'تثبيت في السجل' : 'Commit Log'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Search & Category Filter Navigation */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute top-3.5 right-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isRTL
                ? 'بحث بالحدث، المستخدم، الكيان، الكلمات المنطوقة، رقم المستند...'
                : 'Search Action, User, Entity, Spoken Text, Reference...'
            }
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:border-cyan-400 font-sans"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>{isRTL ? 'تصفية النوع:' : 'Filter:'}</span>
          </span>

          <button
            onClick={() => setActiveCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer ${
              activeCategoryFilter === 'ALL'
                ? 'bg-blue-950 text-blue-300 border border-blue-500/50 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {isRTL ? 'جميع الحركات' : 'All Entries'} ({auditLogs.length})
          </button>

          <button
            onClick={() => setActiveCategoryFilter('VOICE_OBSERVATION')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeCategoryFilter === 'VOICE_OBSERVATION'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Mic className="w-3 h-3 text-cyan-400" />
            <span>{isRTL ? 'الملاحظات والرصد الصوتي' : 'Voice Observations'}</span>
            <span className="px-1.5 py-0.2 rounded bg-cyan-900/60 font-mono text-[10px] text-cyan-300">
              {voiceLogsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveCategoryFilter('RECEIVING')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeCategoryFilter === 'RECEIVING'
                ? 'bg-blue-950 text-blue-300 border border-blue-500/50 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Scale className="w-3 h-3 text-blue-400" />
            <span>{isRTL ? 'الاستلام والميزان (546)' : 'Weighbridge & Receiving'}</span>
          </button>

          <button
            onClick={() => setActiveCategoryFilter('SHREDDING')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeCategoryFilter === 'SHREDDING'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Flame className="w-3 h-3 text-emerald-400" />
            <span>{isRTL ? 'الثرم والجرش (360)' : 'Shredding Runs'}</span>
          </button>

          <button
            onClick={() => setActiveCategoryFilter('STORAGE')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeCategoryFilter === 'STORAGE'
                ? 'bg-teal-950 text-teal-300 border border-teal-500/50 shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Boxes className="w-3 h-3 text-teal-400" />
            <span>{isRTL ? 'المستودع والتخزين (352)' : 'Storage & Warehouse'}</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs font-mono">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase">
              <tr>
                <th className="p-3.5 text-start">{isRTL ? 'التاريخ والوقت' : 'Timestamp'}</th>
                <th className="p-3.5 text-start font-sans">{isRTL ? 'المشرف والمستخدم' : 'User & Role'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'العملية والنوع' : 'Action & Type'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'الكيان والمعرف' : 'Entity & Ref'}</th>
                <th className="p-3.5 text-start font-sans">{isRTL ? 'الملاحظات والكلمات المنطوقة' : 'Observations & Spoken Notes'}</th>
                <th className="p-3.5 text-center font-sans w-20">{isRTL ? 'إجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                    {isRTL ? 'لا توجد سجلات مطابقة لمعايير البحث الحالية.' : 'No audit entries match the current search filters.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isVoiceObservation =
                    log.entityType === 'VOICE_OBSERVATION' ||
                    log.action.toUpperCase().includes('VOICE') ||
                    log.action.toUpperCase().includes('VERBAL') ||
                    (log.actionAr && log.actionAr.includes('صوت'));

                  const detailsText = log.notes || (log as any).details || '—';

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isVoiceObservation ? 'bg-cyan-950/15' : ''
                      }`}
                    >
                      <td className="p-3.5 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{(log as any).timestamp || `${log.date} ${log.time}`}</span>
                        </div>
                      </td>

                      <td className="p-3.5 font-sans text-white">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>{log.userName}</span>
                          {isVoiceObservation && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400" title="Verbal observation" />
                          )}
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono">{log.userRole}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isVoiceObservation ? (
                            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold text-[10px] flex items-center gap-1">
                              <Mic className="w-3 h-3 text-cyan-400" />
                              <span>{isRTL ? 'رصد شفوي صوتي' : 'Voice Observation'}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/40 font-bold text-[10px]">
                              {log.action}
                            </span>
                          )}
                        </div>
                        {log.actionAr && (
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                            {log.actionAr}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-200 font-bold">
                        <span className="text-slate-400 text-[10px] block font-mono">{log.entityType}</span>
                        <span className="font-mono text-cyan-300">{log.entityId}</span>
                      </td>

                      <td className="p-3.5 font-sans text-slate-300 max-w-lg">
                        <div
                          className={`p-2 rounded-xl text-xs leading-relaxed ${
                            isVoiceObservation
                              ? 'bg-slate-950/80 border border-cyan-500/30 text-cyan-100 shadow-sm'
                              : 'text-slate-300'
                          }`}
                        >
                          {detailsText}
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleCopyNote(detailsText, log.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title={isRTL ? 'نسخ نص الملاحظة' : 'Copy text'}
                        >
                          {quickCopiedId === log.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voice Audit Observation Dictation Modal */}
      {isVoiceModalOpen && (
        <VoiceAuditObservationModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
        />
      )}
    </div>
  );
};

