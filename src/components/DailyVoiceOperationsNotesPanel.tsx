import React, { useState, useMemo } from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Trash2,
  Filter,
  Search,
  Clock,
  User,
  Boxes,
  Truck,
  Flame,
  Factory,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Printer,
  CheckCircle2,
  Radio,
  FileText,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { WarehouseVoiceNote } from '../types';
import {
  getStoredVoiceNotes,
  deleteVoiceNote,
  updateVoiceNoteStatus,
} from '../services/voiceNotesService';
import { VoiceOperationsDictationModal } from './VoiceOperationsDictationModal';

interface DailyVoiceOperationsNotesPanelProps {
  selectedDate: string;
  selectedShift: string;
}

export const DailyVoiceOperationsNotesPanel: React.FC<DailyVoiceOperationsNotesPanelProps> = ({
  selectedDate,
  selectedShift,
}) => {
  const { isRTL } = useLanguage();
  const [notes, setNotes] = useState<WarehouseVoiceNote[]>(() => getStoredVoiceNotes());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Refresh notes from store
  const refreshNotes = () => {
    setNotes(getStoredVoiceNotes());
  };

  // Filter notes based on selected date, shift, category, and search query
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // Date filter (allow if matches or if note is from today's active shift)
      if (selectedDate && n.date !== selectedDate) {
        // If no notes on this specific day, allow fallback to see notes
      }
      if (selectedShift !== 'ALL' && n.shift !== selectedShift) {
        // Shift filter
      }
      if (activeCategory !== 'ALL' && n.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = n.title.toLowerCase().includes(q);
        const matchContent = n.content.toLowerCase().includes(q);
        const matchOperator = n.operator.toLowerCase().includes(q);
        const matchMat = (n.materialName || '').toLowerCase().includes(q);
        const matchLoc = ((n.locationFrom || '') + (n.locationTo || '')).toLowerCase().includes(q);
        return matchTitle || matchContent || matchOperator || matchMat || matchLoc;
      }
      return true;
    });
  }, [notes, selectedDate, selectedShift, activeCategory, searchQuery]);

  // Audio Text-to-Speech Playback
  const handleToggleSpeak = (note: WarehouseVoiceNote) => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis not supported in your browser.');
      return;
    }

    if (speakingId === note.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(note.content);
    // Prefer Arabic voice if available
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find((v) => v.lang.startsWith('ar'));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
      utterance.lang = arabicVoice.lang;
    } else {
      utterance.lang = 'ar-SA';
    }
    utterance.rate = 0.95;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(note.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopy = (note: WarehouseVoiceNote) => {
    navigator.clipboard.writeText(
      `[${note.category}] ${note.title}\n${note.timestamp} | ${note.operator}\n${note.content}`
    );
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    if (confirm(isRTL ? 'هل أنت متأكد من حذف هذه الملاحظة الصوتية؟' : 'Delete this voice note?')) {
      deleteVoiceNote(id);
      refreshNotes();
    }
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'CONFIRMED' ? 'RESOLVED' : 'CONFIRMED';
    updateVoiceNoteStatus(id, nextStatus as any);
    refreshNotes();
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'INVENTORY_MOVEMENT':
        return {
          label: isRTL ? 'حركة مخزنية' : 'Inventory Movement',
          icon: <Boxes className="w-3.5 h-3.5" />,
          color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        };
      case 'SHIFT_HANDOVER':
        return {
          label: isRTL ? 'تسليم وردية' : 'Shift Handover',
          icon: <Clock className="w-3.5 h-3.5" />,
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
      case 'OPERATIONAL_ALERT':
        return {
          label: isRTL ? 'تنبيه تشغيلي' : 'Operational Alert',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      default:
        return {
          label: category,
          icon: <FileText className="w-3.5 h-3.5" />,
          color: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
        };
    }
  };

  return (
    <div
      id="daily-voice-operations-notes-section"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl text-slate-100"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/40 text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                {isRTL
                  ? 'سجل الملاحظات الصوتية ومحاضر تسليم الوردية'
                  : 'Voice Operations Notes & Shift Handover Logs'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                {filteredNotes.length} {isRTL ? 'تسجيل' : 'Entries'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRTL
                ? 'توثيق فوري عبر الميكروفون لحركات الشلايف، الصوامع، ونقل المهام بين الورديات'
                : 'Microphone-enabled voice-to-text dictation for warehouse moves and shift handovers'}
            </p>
          </div>
        </div>

        {/* Big Record Voice Note Action Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02] transition-all cursor-pointer"
        >
          <Mic className="w-4 h-4" />
          <span>{isRTL ? 'تسجيل إملاء صوتي جديد' : 'Dictate New Voice Note'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 my-4">
        {/* Category Pills */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs font-bold">
          <button
            onClick={() => setActiveCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeCategory === 'ALL'
                ? 'bg-white/10 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {isRTL ? 'كافة التسجيلات' : 'All Notes'}
          </button>
          <button
            onClick={() => setActiveCategory('INVENTORY_MOVEMENT')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'INVENTORY_MOVEMENT'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>{isRTL ? 'حركات مخزنية' : 'Movements'}</span>
          </button>
          <button
            onClick={() => setActiveCategory('SHIFT_HANDOVER')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'SHIFT_HANDOVER'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isRTL ? 'محاضر الوردية' : 'Handovers'}</span>
          </button>
          <button
            onClick={() => setActiveCategory('OPERATIONAL_ALERT')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === 'OPERATIONAL_ALERT'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isRTL ? 'تنبيهات تشغيلية' : 'Alerts'}</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? 'بحث في التسجيلات الصوتية...' : 'Search voice notes...'}
            className="w-full ps-9 pe-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:border-cyan-500 outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Voice Notes List */}
      {filteredNotes.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-950/60 border border-dashed border-white/10 text-center flex flex-col items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-white/5 text-slate-500">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-300">
              {isRTL ? 'لا توجد ملاحظات صوتية مطابقة' : 'No matching voice notes'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {isRTL
                ? 'استخدم زر الإملاء الصوتي السريع لتسجيل حركات المخزن أو تسليم المهام للوردية القادمة.'
                : 'Click dictate above to record live voice notes or shift handover reports.'}
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-cyan-300 text-xs font-bold transition-all cursor-pointer"
          >
            {isRTL ? '+ تسجيل ملاحظة الآن' : '+ Record Note Now'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredNotes.map((note) => {
            const badge = getCategoryBadge(note.category);
            const isSpeaking = speakingId === note.id;

            return (
              <div
                key={note.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isSpeaking
                    ? 'bg-slate-950 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.15)]'
                    : 'bg-slate-950/70 border-white/5 hover:border-white/15'
                }`}
              >
                <div>
                  {/* Top Note Strip */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{note.timestamp}</span>
                    </div>
                  </div>

                  {/* Title & Operator */}
                  <h4 className="text-sm font-black text-white leading-snug">{note.title}</h4>

                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{note.operator}</span>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-slate-300 text-[11px]">{note.shift}</span>
                  </div>

                  {/* Audio Wave & Dictated Transcript Quote Box */}
                  <div className="mt-3 p-3 rounded-lg bg-black/40 border border-white/5 relative">
                    <div className="flex items-center justify-between gap-2 mb-1.5 text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-cyan-400">
                        <Radio className="w-3 h-3" />
                        <span>{isRTL ? 'النص الصوتي المفرغ:' : 'Voice Transcript:'}</span>
                      </span>
                      {note.audioLengthSeconds && (
                        <span>~{note.audioLengthSeconds} {isRTL ? 'ثانية' : 'sec'}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium whitespace-pre-line">
                      "{note.content}"
                    </p>
                  </div>

                  {/* Context Metrics Tag Strip (Weight, Bags, Locations) */}
                  {(note.quantityKG || note.locationFrom || note.materialName) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      {note.materialName && (
                        <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5 truncate max-w-xs">
                          {note.materialName}
                        </span>
                      )}

                      {note.quantityKG !== undefined && note.quantityKG > 0 && (
                        <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                          {note.quantityKG.toLocaleString()} KG
                        </span>
                      )}

                      {note.bulkBagsCount !== undefined && note.bulkBagsCount > 0 && (
                        <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                          {note.bulkBagsCount} {isRTL ? 'شليف' : 'Bags'}
                        </span>
                      )}

                      {note.locationFrom && note.locationTo && (
                        <div className="px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5 flex items-center gap-1 font-mono text-[10px]">
                          <span>{note.locationFrom}</span>
                          <ArrowRight className="w-2.5 h-2.5 text-slate-500" />
                          <span className="text-slate-200">{note.locationTo}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer Controls & Actions */}
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2 text-xs">
                  {/* Status Indicator */}
                  <button
                    onClick={() => handleToggleStatus(note.id, note.status)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      note.status === 'CONFIRMED'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                    }`}
                    title={isRTL ? 'تغيير حالة الاعتماد' : 'Toggle Confirmation Status'}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      {note.status === 'CONFIRMED'
                        ? isRTL ? 'معتمد ومؤكد' : 'Confirmed'
                        : isRTL ? 'قيد المراجعة' : 'Pending'}
                    </span>
                  </button>

                  {/* Actions: Speak, Copy, Delete */}
                  <div className="flex items-center gap-1 text-slate-400">
                    {/* Read Aloud Button */}
                    <button
                      onClick={() => handleToggleSpeak(note)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isSpeaking
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'hover:bg-white/10 hover:text-white'
                      }`}
                      title={isSpeaking ? 'Stop Speaking' : 'Read Aloud with Voice (Text-to-Speech)'}
                    >
                      {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>

                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopy(note)}
                      className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      title={isRTL ? 'نسخ الملاحظة' : 'Copy Text'}
                    >
                      {copiedId === note.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-950/50 hover:text-rose-400 transition-colors cursor-pointer"
                      title={isRTL ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Voice Dictation Modal Integration */}
      <VoiceOperationsDictationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onNoteCreated={() => {
          refreshNotes();
        }}
        defaultDate={selectedDate}
        defaultShift={selectedShift === 'ALL' ? 'Morning Shift' : selectedShift}
      />
    </div>
  );
};
