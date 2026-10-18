import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  RotateCcw,
  Check,
  X,
  Sparkles,
  Volume2,
  FileText,
  Boxes,
  Truck,
  ArrowRightLeft,
  Calendar,
  Clock,
  User,
  AlertCircle,
  HelpCircle,
  Layers,
  Flame,
  Factory,
  Save,
  Copy,
} from 'lucide-react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { saveVoiceNote } from '../services/voiceNotesService';
import { WarehouseVoiceNote } from '../types';

interface VoiceOperationsDictationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteCreated: (note: WarehouseVoiceNote) => void;
  defaultDate?: string;
  defaultShift?: string;
}

export const VoiceOperationsDictationModal: React.FC<VoiceOperationsDictationModalProps> = ({
  isOpen,
  onClose,
  onNoteCreated,
  defaultDate = '2026-09-02',
  defaultShift = 'Morning Shift',
}) => {
  const { isRTL } = useLanguage();
  const { addShiftHandover, materials } = useFactory();

  // Mode: Inventory Movement Note vs Shift Handover Report
  const [activeTab, setActiveTab] = useState<'MOVEMENT' | 'HANDOVER'>('MOVEMENT');

  // Shared Form Fields
  const [date, setDate] = useState(defaultDate);
  const [shift, setShift] = useState(defaultShift);
  const [operator, setOperator] = useState('حيدر الكرخي (أمين المستودع)');
  const [copied, setCopied] = useState(false);

  // Movement Note Specific Fields
  const [movementTitle, setMovementTitle] = useState('نقل شلايف مفرومة إلى مستودع WH-02');
  const [locationFrom, setLocationFrom] = useState('ساحة الفرز (Staging Yard)');
  const [locationTo, setLocationTo] = useState('مستودع المفروم WH-02 (Silo B)');
  const [selectedMaterial, setSelectedMaterial] = useState('سكراب أكواب وبالات خام (PET/PP)');
  const [quantityKG, setQuantityKG] = useState('3200');
  const [bulkBagsCount, setBulkBagsCount] = useState('3');

  // Handover Report Specific Fields
  const [handoverTitle, setHandoverTitle] = useState('محضر تسليم الوردية - المستودع وخطوط المعالجة');
  const [departingSupervisor, setDepartingSupervisor] = useState('عمار عبد الزهرة');
  const [incomingSupervisor, setIncomingSupervisor] = useState('فاضل الساعدي');
  const [operationalArea, setOperationalArea] = useState('المستودع الرئيسي ووحدة الثرم');

  // Web Speech Recognition Hook
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

  // Sound effects using Web Audio API synthesis
  const playBeep = (freq = 600, duration = 0.12) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  };

  const handleToggleListening = () => {
    if (isListening) {
      playBeep(440, 0.15);
      stopListening();
    } else {
      playBeep(880, 0.15);
      startListening();
    }
  };

  // Quick punctuation buttons
  const handleInsertPunctuation = (punct: string) => {
    appendText(punct);
  };

  // Factory Voice Templates for one-tap voice input
  const voicePresetsMovement = [
    {
      label: 'نقل مفروم للصوامع',
      labelEn: 'Move Flakes to Silos',
      text: 'تم نقل 3 شلايف مفروم ناعم من ماكينة الثرم 01 إلى صوامع مستودع WH-02 قطاع B والوزن الإجمالي 3,250 كغم.',
    },
    {
      label: 'استلام بالات سكراب',
      labelEn: 'Receive Scrap Bales',
      text: 'شاحنة المورد أفرغت 5 بالات سكراب أكواب بطل في ساحة الفرز الخارجية بانتظار الفرز والوزن الثاني.',
    },
    {
      label: 'صرف خامات لخط البثق',
      labelEn: 'Issue Material to Extruder',
      text: 'تم صرف شليفين مفروم مجفف وشليف حبيبات بكر إلى قمع خط البثق رقم 1 وفق مستند الصرف 167.',
    },
    {
      label: 'تنبيه كيس تالف',
      labelEn: 'Damaged Bag Alert',
      text: 'تنبيه: تم رصد تمزق في شليف مفروم بالرف A-04 ويحتاج إلى إعادة تعبئة وفحص باركود فوري.',
    },
  ];

  const voicePresetsHandover = [
    {
      label: 'تسليم اعتيادي مكتمل',
      labelEn: 'Normal Shift Handover',
      text: 'تم إنجاز خطة الوردية الصباحية بنجاح وثرم 24 طن. صوامع WH-02 جاهزة بنسبة 75% وخطوط البثق مستمرة بالعمل دون أي توقفات ميكانيكية.',
    },
    {
      label: 'تنبيه صيانة ثرامة',
      labelEn: 'Shredder Maintenance Alert',
      text: 'ماكينة الثرم 02 بحاجة إلى تبديل شفرات السكاكين الدوارة بعد انتهاء الوردية الحالية لوجود اهتزاز خفيف.',
    },
    {
      label: 'متابعة شاحنة مسائية',
      labelEn: 'Follow-up Evening Intake',
      text: 'يرجى من الوردية المسائية استكمال وزن وخروج الشاحنة رقم 546 ومطابقة قراءة الميزان البسكول.',
    },
  ];

  // Auto-detect numbers in transcript if user spoke quantities
  useEffect(() => {
    if (!transcript) return;
    const kgMatch = transcript.match(/(\d+[\d,.]*)\s*(كغم|كيلو|كيلوغرام|kg|طن|tons?)/i);
    if (kgMatch && kgMatch[1]) {
      const cleanNum = kgMatch[1].replace(/,/g, '');
      const numVal = parseFloat(cleanNum);
      if (!isNaN(numVal)) {
        if (kgMatch[2].includes('طن') || kgMatch[2].toLowerCase().includes('ton')) {
          setQuantityKG((numVal * 1000).toString());
        } else {
          setQuantityKG(Math.round(numVal).toString());
        }
      }
    }

    const bagMatch = transcript.match(/(\d+)\s*(شليف|شلايف|أكياس|كيس|bags?|bulk)/i);
    if (bagMatch && bagMatch[1]) {
      setBulkBagsCount(bagMatch[1]);
    }
  }, [transcript]);

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) stopListening();

    const finalNoteText = transcript.trim() || interimTranscript.trim();
    if (!finalNoteText) {
      alert(isRTL ? 'يرجى إملاء الملاحظة الصوتية أو كتابتها أولاً' : 'Please dictate or enter note text first');
      return;
    }

    if (activeTab === 'MOVEMENT') {
      const created = saveVoiceNote({
        date,
        shift,
        operator,
        category: 'INVENTORY_MOVEMENT',
        title: movementTitle,
        content: finalNoteText,
        locationFrom,
        locationTo,
        materialName: selectedMaterial,
        quantityKG: parseFloat(quantityKG) || 0,
        bulkBagsCount: parseInt(bulkBagsCount) || 1,
        status: 'CONFIRMED',
        timestamp: `${date} ${new Date().toLocaleTimeString('en-US', { hour12: false })}`,
        audioLengthSeconds: Math.max(5, Math.min(60, Math.round(finalNoteText.split(' ').length * 0.4))),
      });

      onNoteCreated(created);
      onClose();
    } else {
      // Shift Handover Mode
      const created = saveVoiceNote({
        date,
        shift,
        operator: departingSupervisor,
        category: 'SHIFT_HANDOVER',
        title: handoverTitle,
        content: `المشرف المسلم: ${departingSupervisor} | المستلم: ${incomingSupervisor}\nالقطاع: ${operationalArea}\nتقرير الوردية: ${finalNoteText}`,
        locationFrom: operationalArea,
        locationTo: incomingSupervisor,
        materialName: 'محضر تسليم واستلام الوردية الرسمي',
        quantityKG: parseFloat(quantityKG) || 0,
        bulkBagsCount: parseInt(bulkBagsCount) || 0,
        status: 'CONFIRMED',
        timestamp: `${date} ${new Date().toLocaleTimeString('en-US', { hour12: false })}`,
        audioLengthSeconds: Math.max(8, Math.min(90, Math.round(finalNoteText.split(' ').length * 0.4))),
      });

      // Synchronize with official ShiftHandoverRecord in FactoryContext
      addShiftHandover({
        date,
        shiftFrom: shift,
        shiftTo: shift.includes('Morning') ? 'Evening Shift' : 'Night Shift',
        departingSupervisor,
        incomingSupervisor,
        timestamp: `${date} ${new Date().toLocaleTimeString('en-US', { hour12: false })}`,
        completedTasks: [finalNoteText],
        inProgressTasks: [`تسليم وإشراف ${operationalArea}`],
        remainingWork: ['متابعة سير صوامع المفروم والشلايف المخزنة'],
        pendingActionsSummary: 'تم التوثيق عبر الإملاء الصوتي السريع لغرفة العمليات',
        reportedProblems: [],
        nextShiftInstructions: finalNoteText,
        status: 'SUBMITTED',
      });

      onNoteCreated(created);
      onClose();
    }
  };

  const handleCopy = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div
        className="relative w-full max-w-3xl bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 my-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/60 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Mic className={`w-5 h-5 ${isListening ? 'animate-pulse text-rose-400' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  {isRTL ? 'الإملاء الصوتي السريع للمستودع والعمليات' : 'Warehouse Voice-to-Text Dictation'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  AI VOICE ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'تسجيل الملاحظات وحركات المخازن ومحاضر تسليم الوردية عبر الميكروفون'
                  : 'Dictate inventory movements, bulk bag relocations & shift handover reports'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-2 bg-slate-950/80 border-b border-white/5 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('MOVEMENT')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'MOVEMENT'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>{isRTL ? 'ملاحظة حركة مخزنية سريعة' : 'Inventory Movement Note'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HANDOVER')}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'HANDOVER'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{isRTL ? 'تقرير تسليم الوردية الصوتي' : 'Shift Handover Voice Report'}</span>
          </button>
        </div>

        {/* Modal Body & Voice Studio */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Top Metadata Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-bold mb-1">
                {isRTL ? 'التاريخ:' : 'Date:'}
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">
                {isRTL ? 'الوردية:' : 'Shift:'}
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-cyan-500 outline-none"
              >
                <option value="Morning Shift">{isRTL ? 'الوردية الصباحية (07:00 - 15:00)' : 'Morning Shift'}</option>
                <option value="Evening Shift">{isRTL ? 'الوردية المسائية (15:00 - 23:00)' : 'Evening Shift'}</option>
                <option value="Night Shift">{isRTL ? 'الوردية الليلية (23:00 - 07:00)' : 'Night Shift'}</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">
                {isRTL ? 'المشرف / المسؤول:' : 'Operator / Supervisor:'}
              </label>
              <input
                type="text"
                value={activeTab === 'MOVEMENT' ? operator : departingSupervisor}
                onChange={(e) =>
                  activeTab === 'MOVEMENT' ? setOperator(e.target.value) : setDepartingSupervisor(e.target.value)
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-cyan-500 outline-none"
                placeholder="اسم المسؤول"
              />
            </div>
          </div>

          {/* Context Fields based on Active Tab */}
          {activeTab === 'MOVEMENT' ? (
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'عنوان الحركة المخزنية:' : 'Movement Title:'}
                  </label>
                  <input
                    type="text"
                    value={movementTitle}
                    onChange={(e) => setMovementTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'المادة المنقولة:' : 'Material:'}
                  </label>
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-cyan-500 outline-none"
                  >
                    <option value="سكراب أكواب وبالات خام (PET/PP)">سكراب أكواب وبالات خام (PET/PP)</option>
                    <option value="مفروم هوالك رولات شيت (HIPS Flakes)">مفروم هوالك رولات شيت (HIPS Flakes)</option>
                    <option value="حبيبات بكر وماسترباتش ملون">حبيبات بكر وماسترباتش ملون</option>
                    <option value="شلايف مفرومة مجروشة جاهزة">شلايف مفرومة مجروشة جاهزة</option>
                    <option value="قصاصات وأطراف ألواح تشكيل">قصاصات وأطراف ألواح تشكيل</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'من موقع:' : 'From:'}
                  </label>
                  <input
                    type="text"
                    value={locationFrom}
                    onChange={(e) => setLocationFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'إلى موقع:' : 'To:'}
                  </label>
                  <input
                    type="text"
                    value={locationTo}
                    onChange={(e) => setLocationTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'الوزن (كغم):' : 'Weight (KG):'}
                  </label>
                  <input
                    type="number"
                    value={quantityKG}
                    onChange={(e) => setQuantityKG(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-emerald-400 font-mono font-bold focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'عدد الشلايف:' : 'Bulk Bags:'}
                  </label>
                  <input
                    type="number"
                    value={bulkBagsCount}
                    onChange={(e) => setBulkBagsCount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-cyan-400 font-mono font-bold focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'عنوان التقرير:' : 'Report Title:'}
                  </label>
                  <input
                    type="text"
                    value={handoverTitle}
                    onChange={(e) => setHandoverTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'المشرف المستلم:' : 'Incoming Supervisor:'}
                  </label>
                  <input
                    type="text"
                    value={incomingSupervisor}
                    onChange={(e) => setIncomingSupervisor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">
                    {isRTL ? 'القطاع / المنطقة التشغيلية:' : 'Operational Area:'}
                  </label>
                  <input
                    type="text"
                    value={operationalArea}
                    onChange={(e) => setOperationalArea(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* MAIN VOICE DICTATION STUDIO CARD */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#0e111a] to-[#08090e] border border-cyan-500/30 shadow-inner">
            {/* Studio Top Control Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  {isListening && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isListening ? 'bg-rose-500' : 'bg-slate-600'
                    }`}
                  />
                </span>
                <span className="text-xs font-bold text-slate-200">
                  {isListening
                    ? isRTL ? 'جاري الاستماع وتسجيل الصوت...' : 'Listening & transcribing...'
                    : isRTL ? 'جاهز للتسجيل الصوتي' : 'Ready to record voice'}
                </span>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">{isRTL ? 'لغة الإملاء:' : 'Language:'}</span>
                <div className="flex bg-black/60 p-0.5 rounded-lg border border-white/10 font-bold text-[11px]">
                  <button
                    type="button"
                    onClick={() => setLanguage('ar-IQ')}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${
                      language === 'ar-IQ'
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    العراق (ar-IQ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('ar-SA')}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${
                      language === 'ar-SA'
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    العربية (ar-SA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en-US')}
                    className={`px-2 py-1 rounded transition-all cursor-pointer ${
                      language === 'en-US'
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>

            {/* Central Microphone Big Pulsing Button & Audio Visualizer */}
            <div className="py-6 flex flex-col items-center justify-center gap-4">
              <div className="relative flex items-center justify-center">
                {/* Audio Wave Visualizer Rings */}
                {isListening && (
                  <>
                    <div
                      className="absolute rounded-full border border-cyan-400/40 animate-ping"
                      style={{
                        width: `${80 + volumeLevel * 0.8}px`,
                        height: `${80 + volumeLevel * 0.8}px`,
                      }}
                    />
                    <div
                      className="absolute rounded-full bg-cyan-500/10 transition-all duration-100"
                      style={{
                        width: `${75 + volumeLevel * 0.5}px`,
                        height: `${75 + volumeLevel * 0.5}px`,
                      }}
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={handleToggleListening}
                  className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-xl ${
                    isListening
                      ? 'bg-gradient-to-tr from-rose-600 to-rose-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.5)] scale-105'
                      : 'bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white hover:scale-105 shadow-[0_0_25px_rgba(6,182,212,0.3)]'
                  }`}
                  title={isListening ? 'Stop Recording' : 'Start Voice Dictation'}
                >
                  {isListening ? (
                    <>
                      <Square className="w-7 h-7 fill-white" />
                      <span className="text-[10px] font-bold mt-1 uppercase">
                        {isRTL ? 'إيقاف' : 'Stop'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-8 h-8" />
                      <span className="text-[10px] font-bold mt-0.5 uppercase">
                        {isRTL ? 'تحدث' : 'Speak'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Volume Bar Visualizer */}
              {isListening && (
                <div className="w-48 h-2 bg-black/50 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-rose-500 rounded-full transition-all duration-75"
                    style={{ width: `${Math.min(100, Math.max(5, volumeLevel))}%` }}
                  />
                </div>
              )}

              <p className="text-xs text-slate-400 text-center max-w-md">
                {isListening
                  ? isRTL
                    ? 'تحدث بوضوح في الميكروفون لتدوين التقرير وحركات الشلايف والأرصدة...'
                    : 'Speak clearly into the microphone to dictate your report...'
                  : isRTL
                  ? 'اضغط على زر الميكروفون لبدء الإملاء الصوتي المباشر'
                  : 'Click the microphone button to start real-time voice dictation'}
              </p>
            </div>

            {/* Live Dictated Textarea & Interim Preview */}
            <div className="relative">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={4}
                placeholder={
                  isRTL
                    ? 'سيظهر النص المنطوق هنا تلقائياً أثناء حديثك، أو يمكنك كتابة الملاحظة يدوياً...'
                    : 'Your dictated speech will appear here in real-time...'
                }
                className="w-full p-3.5 rounded-xl bg-slate-950/90 border border-white/10 text-white text-sm leading-relaxed focus:border-cyan-400 outline-none resize-none font-medium"
              />

              {/* Interim Real-time live transcript bubble */}
              {interimTranscript && (
                <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center gap-2 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{interimTranscript}</span>
                </div>
              )}

              {/* Error Notice */}
              {speechError && (
                <div className="mt-2 p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{speechError}</span>
                </div>
              )}
            </div>

            {/* Quick Action Buttons for Dictation */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-white/10 text-xs">
              {/* Punctuation Tools */}
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[11px] font-bold">{isRTL ? 'إدراج سريع:' : 'Insert:'}</span>
                <button
                  type="button"
                  onClick={() => handleInsertPunctuation('،')}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white font-bold cursor-pointer"
                >
                  ، فاصلة
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertPunctuation('.')}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white font-bold cursor-pointer"
                >
                  . نقطة
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertPunctuation('\n')}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white font-bold cursor-pointer"
                >
                  ↵ سطر
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!transcript}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ النص' : 'Copy')}</span>
                </button>

                <button
                  type="button"
                  onClick={clearTranscript}
                  disabled={!transcript && !interimTranscript}
                  className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'مسح' : 'Clear'}</span>
                </button>
              </div>
            </div>

            {/* Quick Warehouse Speech Preset Chips */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isRTL
                    ? 'نماذج صوتية سريعة بنقرة واحدة (Quick Speech Templates):'
                    : 'One-Click Warehouse Dictation Templates:'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(activeTab === 'MOVEMENT' ? voicePresetsMovement : voicePresetsHandover).map(
                  (preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        playBeep(520, 0.1);
                        setTranscript(preset.text);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 border border-white/5 hover:border-cyan-500/40 text-[11px] font-medium transition-all cursor-pointer"
                      title={preset.text}
                    >
                      {isRTL ? preset.label : preset.labelEn}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                activeTab === 'MOVEMENT'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>
                {activeTab === 'MOVEMENT'
                  ? isRTL ? 'حفظ ملاحظة الحركة المخزنية' : 'Save Movement Note'
                  : isRTL ? 'اعتماد وحفظ محضر تسليم الوردية' : 'Submit & Save Shift Handover'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
