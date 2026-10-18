import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  RotateCcw,
  Check,
  X,
  Volume2,
  FileText,
  Clock,
  User,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Sparkles,
  Layers,
  Copy,
  Flame,
  Scale,
  Boxes,
  HelpCircle,
} from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { saveVoiceNote } from '../services/voiceNotesService';

interface VoiceAuditObservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onObservationSaved?: () => void;
}

export type ObservationCategory =
  | 'QUALITY_INSPECTION'
  | 'SAFETY_OBSERVATION'
  | 'SHREDDING_OPERATION'
  | 'WEIGHBRIDGE_LOGISTICS'
  | 'STORAGE_INVENTORY'
  | 'SHIFT_HANDOVER'
  | 'MAINTENANCE_FLAG';

export const VoiceAuditObservationModal: React.FC<VoiceAuditObservationModalProps> = ({
  isOpen,
  onClose,
  onObservationSaved,
}) => {
  const { isRTL, t } = useLanguage();
  const { currentUser, logAudit } = useFactory();

  // Observation metadata
  const [category, setCategory] = useState<ObservationCategory>('QUALITY_INSPECTION');
  const [shift, setShift] = useState<string>('صباحية (06:00 - 14:00)');
  const [location, setLocation] = useState<string>('ساحة الفرز والميزان (DOC-546)');
  const [severity, setSeverity] = useState<'ROUTINE' | 'ATTENTION' | 'CRITICAL'>('ROUTINE');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Speech Recognition Hook
  const {
    isListening,
    transcript,
    interimTranscript,
    language,
    setLanguage,
    error: speechError,
    isSupported,
    volumeLevel,
    startListening,
    stopListening,
    clearTranscript,
    setTranscript,
    appendText,
  } = useSpeechRecognition({
    initialLanguage: 'ar-IQ',
  });

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isListening) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isListening]);

  // Audio chime feedback using Web Audio API
  const playAudioCue = (frequency = 600, duration = 0.15) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  const handleStartListening = () => {
    playAudioCue(800, 0.12);
    setRecordingSeconds(0);
    startListening();
  };

  const handleStopListening = () => {
    playAudioCue(440, 0.15);
    stopListening();
  };

  const handleCopyTranscript = () => {
    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (fullText) {
      navigator.clipboard.writeText(fullText).catch(() => {});
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // Quick template phrases for supervisors
  const quickTemplatePhrases = [
    {
      ar: 'فحص جودة الشلايف الواردة: البالات نظيفة ومفرزة وبدون شوائب معدنية أو رطوبة.',
      en: 'Incoming quality check: clean sorted bales with zero moisture or metal debris.',
    },
    {
      ar: 'ملاحظة تشغيل الثرم 360: صوت حواف السكاكين طبيعي وحرارة المحامل ضمن المعدل الآمن.',
      en: 'Shredder 360 observation: knife cutting sound normal, bearing temps safe.',
    },
    {
      ar: 'ملاحظة تفريغ الشاحنة: تم مطابقة بطاقة الوزن 546 والتوجيه لساحة التخزين.',
      en: 'Unloading note: Doc 546 weight matched manifest, routed to storage.',
    },
    {
      ar: 'تنبيه سلامة: رصد تكتل حبيبات ناعمة بالقرب من خط الجرش؛ جرى تنظيف الموقع.',
      en: 'Safety note: Fine dust accumulation near shred line cleared and secured.',
    },
  ];

  // Submit and commit to immutable Audit Log
  const handleCommitObservation = (e: React.FormEvent) => {
    e.preventDefault();
    const finalContent = (transcript + ' ' + interimTranscript).trim();
    if (!finalContent && !customTitle) return;

    const observationText = finalContent || customTitle;
    const observationId = `VOX-${Date.now().toString().slice(-6)}`;
    const categoryTitle = customTitle.trim() || getDefaultCategoryTitle(category, isRTL);

    // 1. Commit to factory audit trail
    logAudit(
      `Verbal Shift Observation: ${categoryTitle}`,
      `رصد ميداني وملاحظة صوتية: ${categoryTitle}`,
      'VOICE_OBSERVATION',
      observationId,
      'Pending Shift Inspection',
      `Logged by ${currentUser.nameAr} (${currentUser.role}) [Severity: ${severity}]`,
      `[${shift}] [Area: ${location}] [Category: ${category}] - ${observationText}`
    );

    // 2. Also save to voice notes service for factory operational records
    try {
      saveVoiceNote({
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
        shift,
        operator: `${currentUser.nameAr} (${currentUser.role})`,
        category: category === 'SHIFT_HANDOVER' ? 'SHIFT_HANDOVER' : category === 'SAFETY_OBSERVATION' ? 'OPERATIONAL_ALERT' : 'INVENTORY_MOVEMENT',
        title: categoryTitle,
        content: observationText,
        locationFrom: location,
        locationTo: 'Audit Trail Journal',
        materialName: 'Supervisor Verbal Inspection Note',
        quantityKG: 0,
        bulkBagsCount: 0,
        audioLengthSeconds: Math.max(5, recordingSeconds),
        status: 'CONFIRMED',
      });
    } catch {}

    playAudioCue(1040, 0.2);
    setSaveSuccessMsg(true);

    if (onObservationSaved) {
      onObservationSaved();
    }

    setTimeout(() => {
      setSaveSuccessMsg(false);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1117] border border-cyan-500/40 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto text-xs animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
              <Mic className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {isRTL ? 'تسجيل رصد ميداني وملاحظة تفتيش صوتية' : 'Voice Shift Observation & Inspection Dictation'}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  VOICE-TO-AUDIT
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isRTL
                  ? 'تسجيل الملاحظات الشفوية للمشرفين وتحويلها فوراً إلى نص موثق في سجل التدقيق الأمني'
                  : 'Real-time voice-to-text recording directly committing verbal shift notes to the immutable audit trail.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success toast */}
        {saveSuccessMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 flex items-center gap-2 font-bold animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>
              {isRTL
                ? 'تم توثيق الملاحظة الصوتية بنجاح وتضمينها في سجل التدقيق الشامل ✓'
                : 'Verbal observation committed to the audit trail successfully ✓'}
            </span>
          </div>
        )}

        <form onSubmit={handleCommitObservation} className="space-y-4">
          {/* Metadata selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Category */}
            <div>
              <label className="block text-slate-400 font-semibold text-[11px] mb-1">
                {isRTL ? 'نوع الملاحظة والتفتيش:' : 'Observation Type:'}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ObservationCategory)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
              >
                <option value="QUALITY_INSPECTION">{isRTL ? '🔍 فحص جودة وفرز المواد' : 'Quality & Sorting Inspection'}</option>
                <option value="SAFETY_OBSERVATION">{isRTL ? '⚠️ ملاحظة سلامة وأمان الموقع' : 'Safety & Hazard Observation'}</option>
                <option value="SHREDDING_OPERATION">{isRTL ? '⚡ ملاحظة خط الثرم والجرش 360' : 'Shredding 360 Operation'}</option>
                <option value="WEIGHBRIDGE_LOGISTICS">{isRTL ? '⚖️ حركة الميزان وتفريغ الشاحنات' : 'Weighbridge & Truck Logistics'}</option>
                <option value="STORAGE_INVENTORY">{isRTL ? '📦 ملاحظة مستودع الخزن والصوامع' : 'Storage Warehouse & Silos'}</option>
                <option value="SHIFT_HANDOVER">{isRTL ? '📋 تسليم واستلام الوردية' : 'Shift Handover Notes'}</option>
                <option value="MAINTENANCE_FLAG">{isRTL ? '🛠️ رصد عطل أو صيانة ميكانيكية' : 'Mechanical Maintenance Flag'}</option>
              </select>
            </div>

            {/* Shift */}
            <div>
              <label className="block text-slate-400 font-semibold text-[11px] mb-1">
                {isRTL ? 'الوردية التشغيلية:' : 'Shift:'}
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
              >
                <option value="صباحية (06:00 - 14:00)">{isRTL ? 'صباحية (06:00 - 14:00)' : 'Morning Shift (06:00 - 14:00)'}</option>
                <option value="مسائية (14:00 - 22:00)">{isRTL ? 'مسائية (14:00 - 22:00)' : 'Afternoon Shift (14:00 - 22:00)'}</option>
                <option value="ليلية (22:00 - 06:00)">{isRTL ? 'ليلية (22:00 - 06:00)' : 'Night Shift (22:00 - 06:00)'}</option>
              </select>
            </div>

            {/* Area / Location */}
            <div>
              <label className="block text-slate-400 font-semibold text-[11px] mb-1">
                {isRTL ? 'الموقع أو الخط الميداني:' : 'Factory Area:'}
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none focus:border-cyan-400"
              >
                <option value="ساحة الفرز والميزان (DOC-546)">{isRTL ? 'ساحة الفرز والميزان (DOC-546)' : 'Weighbridge & Staging Yard'}</option>
                <option value="وحدة الثرم والجرش 360 (DOC-360)">{isRTL ? 'وحدة الثرم والجرش 360 (DOC-360)' : 'Shredding & Regrind Line 360'}</option>
                <option value="مستودع الخزن WH-02 (DOC-352)">{isRTL ? 'مستودع الخزن WH-02 (DOC-352)' : 'Flakes Storage Warehouse WH-02'}</option>
                <option value="خط البثق والتشكيل الحراري">{isRTL ? 'خط البثق والتشكيل الحراري' : 'Extrusion & Thermoforming Line'}</option>
                <option value="ورشة الصيانة والمرافق العامة">{isRTL ? 'ورشة الصيانة والمرافق العامة' : 'Maintenance Workshop & Utilities'}</option>
              </select>
            </div>
          </div>

          {/* Priority / Severity Level */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px] font-semibold">
              {isRTL ? 'درجة الأهمية:' : 'Priority Level:'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSeverity('ROUTINE')}
                className={`px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  severity === 'ROUTINE'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {isRTL ? 'روتينية (اعتيادية)' : 'Routine'}
              </button>
              <button
                type="button"
                onClick={() => setSeverity('ATTENTION')}
                className={`px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  severity === 'ATTENTION'
                    ? 'bg-amber-950 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {isRTL ? 'تنبيه متابعة' : 'Attention'}
              </button>
              <button
                type="button"
                onClick={() => setSeverity('CRITICAL')}
                className={`px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                  severity === 'CRITICAL'
                    ? 'bg-rose-950 text-rose-300 border-rose-500/60 shadow-sm animate-pulse'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                {isRTL ? 'عاجلة / حرجة' : 'Critical'}
              </button>
            </div>
          </div>

          {/* Title input (optional custom heading) */}
          <div>
            <label className="block text-slate-400 font-semibold text-[11px] mb-1">
              {isRTL ? 'عنوان الملاحظة (اختياري، يملأ تلقائياً):' : 'Observation Title (Optional):'}
            </label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={getDefaultCategoryTitle(category, isRTL)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs outline-none focus:border-cyan-400"
            />
          </div>

          {/* Interactive Microphone & Voice Recording Studio Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-[#121622] border border-cyan-500/30 shadow-inner space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              {/* Mic Status & Timer */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={isListening ? handleStopListening : handleStartListening}
                  className={`p-3.5 rounded-2xl transition-all shadow-xl flex items-center justify-center cursor-pointer ${
                    isListening
                      ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/30'
                      : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white'
                  }`}
                  title={isListening ? (isRTL ? 'إيقاف التسجيل' : 'Stop Recording') : (isRTL ? 'بدء التحدث' : 'Start Dictation')}
                >
                  {isListening ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-xs">
                      {isListening
                        ? isRTL
                          ? 'جاري الاستماع الصوتي وتسجيل الكلمات...'
                          : 'Listening and transcribing...'
                        : isRTL
                        ? 'انقر على الميكروفون لبدء التسجيل الشفوي'
                        : 'Click microphone to start voice recording'}
                    </span>
                    {isListening && (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="font-mono text-cyan-300 font-bold">
                      {formatTime(recordingSeconds)}
                    </span>
                    <span>·</span>
                    <span>{isRTL ? 'المشرف:' : 'Supervisor:'} {currentUser.nameAr}</span>
                  </div>
                </div>
              </div>

              {/* Language Switcher & Controls */}
              <div className="flex items-center gap-2">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-300 rounded-lg px-2 py-1 text-[11px] outline-none"
                >
                  <option value="ar-IQ">العربية (العراق ar-IQ)</option>
                  <option value="ar-SA">العربية (الفصحى ar-SA)</option>
                  <option value="en-US">English (en-US)</option>
                </select>

                <button
                  type="button"
                  onClick={clearTranscript}
                  disabled={!transcript && !interimTranscript}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
                  title={isRTL ? 'مسح النص' : 'Clear'}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Audio Wave / Volume Visualizer */}
            {isListening && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-cyan-400" />
                    <span>{isRTL ? 'مستوى التقاط الصوت:' : 'Voice Input Level:'}</span>
                  </span>
                  <span className="font-mono text-cyan-300">{volumeLevel}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 rounded-full transition-all duration-75"
                    style={{ width: `${Math.max(5, volumeLevel)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Live Transcript Textarea with Interim Stream */}
            <div className="relative">
              <textarea
                value={transcript + (interimTranscript ? ` [${interimTranscript}]` : '')}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  isRTL
                    ? 'سيظهر الكلام المنطوق هنا مباشرة... يمكنك التحدث باللغة العربية أو الإنجليزية أو التعديل يدوياً بالكيبورد.'
                    : 'Spoken words appear here in real-time... You may speak in Arabic or English, or edit manually.'
                }
                rows={4}
                className="w-full p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-white placeholder-slate-600 text-xs sm:text-sm leading-relaxed outline-none focus:border-cyan-400 resize-none font-sans"
              />

              {/* Word Count & Copy */}
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] text-slate-500 pointer-events-none">
                <span className="pointer-events-auto">
                  {transcript.split(/\s+/).filter(Boolean).length} {isRTL ? 'كلمة' : 'words'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTranscript}
                  className="pointer-events-auto text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded border border-white/5"
                >
                  <Copy className="w-3 h-3" />
                  <span>{isCopied ? (isRTL ? 'تم النسخ ✓' : 'Copied') : (isRTL ? 'نسخ' : 'Copy')}</span>
                </button>
              </div>
            </div>

            {speechError && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{speechError}</span>
              </div>
            )}
          </div>

          {/* Quick Inspection Prompts Insertion */}
          <div className="space-y-1.5">
            <span className="text-slate-400 text-[11px] font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isRTL ? 'عبارات تفتيش نمطية جاهزة للإدراج السريع:' : 'Quick Template Inspection Statements:'}</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {quickTemplatePhrases.map((phrase, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => appendText(isRTL ? phrase.ar : phrase.en)}
                  className="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-300 text-[11px] text-left rtl:text-right transition-colors cursor-pointer truncate"
                  title={isRTL ? phrase.ar : phrase.en}
                >
                  + {isRTL ? phrase.ar : phrase.en}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={!transcript.trim() && !customTitle.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-cyan-950 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isRTL ? 'تثبيت وحفظ في سجل التدقيق الأمني' : 'Commit Observation to Audit Trail'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function getDefaultCategoryTitle(cat: ObservationCategory, isRTL: boolean): string {
  switch (cat) {
    case 'QUALITY_INSPECTION':
      return isRTL ? 'فحص جودة وفرز المواد الخامات' : 'Raw Materials Quality & Sorting Inspection';
    case 'SAFETY_OBSERVATION':
      return isRTL ? 'ملاحظة السلامة والأمان الميداني' : 'Factory Safety & Hazard Observation';
    case 'SHREDDING_OPERATION':
      return isRTL ? 'رصد تشغيل وسكاكين مفرمة الثرم 360' : 'Shredder 360 Operational Observation';
    case 'WEIGHBRIDGE_LOGISTICS':
      return isRTL ? 'رصد حركة الميزان وتفريغ الشاحنات' : 'Weighbridge Intake & Truck Discharge Log';
    case 'STORAGE_INVENTORY':
      return isRTL ? 'فحص صوامع وشلايف مستودع WH-02' : 'Warehouse WH-02 Storage Silos Inspection';
    case 'SHIFT_HANDOVER':
      return isRTL ? 'محضر تسليم واستلام الوردية الشفوي' : 'Verbal Shift Handover Observation';
    case 'MAINTENANCE_FLAG':
      return isRTL ? 'رصد تآكل أو عطل ميكانيكي بالماكينات' : 'Mechanical Maintenance Telemetry Observation';
    default:
      return isRTL ? 'رصد ميداني للمشرف' : 'Supervisor Field Observation';
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
