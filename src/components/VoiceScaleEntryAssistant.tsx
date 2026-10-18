import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  HelpCircle,
  Radio,
  ChevronDown,
  ChevronUp,
  Settings2,
  Sliders,
  X,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { parseVoiceScaleEntry, ParsedVoiceScaleData } from '../utils/speechWeightParser';

export interface VoiceScaleEntryAssistantProps {
  mode: 'GROSS' | 'TARE';
  targetLabel?: string;
  currentValue?: number;
  onApplyWeight: (weightKG: number, bagsCount?: number | null) => void;
  onApplyPlate?: (plate: string) => void;
  className?: string;
  compact?: boolean;
}

// Built-in audio chime synthesizer for scale feedback
function playChime(success = true) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1); // G5
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(329.63, ctx.currentTime); // E4
      osc.frequency.setValueAtTime(261.63, ctx.currentTime + 0.1); // C4
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {}
}

export const VoiceScaleEntryAssistant: React.FC<VoiceScaleEntryAssistantProps> = ({
  mode,
  targetLabel,
  currentValue,
  onApplyWeight,
  onApplyPlate,
  className = '',
  compact = false,
}) => {
  const { isRTL } = useLanguage();
  const [autoApply, setAutoApply] = useState(true);
  const [audioFeedback, setAudioFeedback] = useState(true);
  const [lastAppliedWeight, setLastAppliedWeight] = useState<number | null>(null);
  const [appliedFlash, setAppliedFlash] = useState(false);
  const [showQuickSamples, setShowQuickSamples] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!compact);

  const {
    isListening,
    transcript,
    interimTranscript,
    language,
    setLanguage,
    error,
    isSupported,
    volumeLevel,
    startListening,
    stopListening,
    clearTranscript,
    setTranscript,
  } = useSpeechRecognition({
    initialLanguage: 'ar-IQ',
  });

  // Combine final and interim transcripts for real-time responsiveness
  const activeTranscript = useMemo(() => {
    return (transcript + ' ' + interimTranscript).trim();
  }, [transcript, interimTranscript]);

  // Parse spoken weight in real-time
  const parsedData: ParsedVoiceScaleData = useMemo(() => {
    if (!activeTranscript) {
      return {
        weightKG: null,
        bulkBagsCount: null,
        vehiclePlate: null,
        rawText: '',
        matchedPattern: null,
        explanationAr: '',
        explanationEn: '',
        confidence: 0,
      };
    }
    return parseVoiceScaleEntry(activeTranscript, mode);
  }, [activeTranscript, mode]);

  // Auto-apply logic when a confident weight is detected
  useEffect(() => {
    if (!autoApply) return;
    if (parsedData.weightKG && parsedData.weightKG !== lastAppliedWeight) {
      const w = parsedData.weightKG;
      // Prevent rapid re-triggering of the exact same weight
      setLastAppliedWeight(w);
      onApplyWeight(w, parsedData.bulkBagsCount);
      if (parsedData.vehiclePlate && onApplyPlate) {
        onApplyPlate(parsedData.vehiclePlate);
      }
      if (audioFeedback) playChime(true);
      setAppliedFlash(true);
      const timer = setTimeout(() => setAppliedFlash(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [parsedData.weightKG, parsedData.bulkBagsCount, parsedData.vehiclePlate, autoApply, lastAppliedWeight, onApplyWeight, onApplyPlate, audioFeedback]);

  const handleManualApply = useCallback(() => {
    if (!parsedData.weightKG) return;
    onApplyWeight(parsedData.weightKG, parsedData.bulkBagsCount);
    if (parsedData.vehiclePlate && onApplyPlate) {
      onApplyPlate(parsedData.vehiclePlate);
    }
    if (audioFeedback) playChime(true);
    setLastAppliedWeight(parsedData.weightKG);
    setAppliedFlash(true);
    setTimeout(() => setAppliedFlash(false), 2000);
  }, [parsedData, onApplyWeight, onApplyPlate, audioFeedback]);

  const handleSimulateSpeech = (phrase: string) => {
    clearTranscript();
    setTranscript(phrase);
    const parsed = parseVoiceScaleEntry(phrase, mode);
    if (parsed.weightKG) {
      if (autoApply) {
        setLastAppliedWeight(parsed.weightKG);
        onApplyWeight(parsed.weightKG, parsed.bulkBagsCount);
        if (parsed.vehiclePlate && onApplyPlate) onApplyPlate(parsed.vehiclePlate);
        if (audioFeedback) playChime(true);
        setAppliedFlash(true);
        setTimeout(() => setAppliedFlash(false), 2000);
      }
    }
  };

  const samplePhrases = useMemo(() => {
    if (mode === 'GROSS') {
      return [
        { labelAr: '28,500 كغم', phrase: 'ثمانية وعشرين ألف وخمسمية كغم', val: 28500 },
        { labelAr: '29.25 طن', phrase: 'تسعة وعشرين طن وربع', val: 29250 },
        { labelAr: '31,400 كغم + 24 شليف', phrase: 'الوزن واحد وثلاثين ألف وأربعمائة و24 شليف', val: 31400 },
        { labelAr: '34,200 كغم', phrase: 'أربعة وثلاثين ألف وميتين كغم', val: 34200 },
      ];
    } else {
      return [
        { labelAr: '12,800 كغم فارغ', phrase: 'اثناعش ألف وثمانمية كغم', val: 12800 },
        { labelAr: '13.5 طن فارغ', phrase: 'ثلاثتعش طن ونص فارغ', val: 13500 },
        { labelAr: '14,200 كغم', phrase: 'أربعة عشر ألف ومائتين', val: 14200 },
        { labelAr: '11,450 كغم', phrase: 'أحد عشر ألف وأربعمائة وخمسين كغم', val: 11450 },
      ];
    }
  }, [mode]);

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isListening
          ? 'bg-gradient-to-b from-cyan-950/80 via-slate-900 to-slate-950 border-cyan-400 shadow-xl shadow-cyan-950/40 ring-1 ring-cyan-500/50'
          : appliedFlash
          ? 'bg-emerald-950/60 border-emerald-400/80 shadow-lg shadow-emerald-950/40'
          : 'bg-slate-900/95 border-slate-800 shadow-md'
      } ${className}`}
    >
      {/* Header Strip */}
      <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl transition-all ${
              isListening
                ? 'bg-cyan-500 text-slate-950 animate-pulse shadow-md shadow-cyan-500/50'
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
            }`}
          >
            <Mic className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                {isRTL ? 'إملاء الوزن صوتياً' : 'Voice-to-Text Scale Input'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  mode === 'GROSS'
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                }`}
              >
                {mode === 'GROSS' ? (isRTL ? 'ميزان الدخول (قائم)' : 'Gross Scale') : (isRTL ? 'ميزان الخروج (فارغ)' : 'Tare Scale')}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {targetLabel ||
                (isRTL
                  ? 'انطق وزن الشاحنة (مثال: "28500" أو "ثمانية وعشرين ألف وخمسمية")'
                  : 'Call out weight in Arabic or English to auto-populate')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setLanguage('ar-IQ')}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                language === 'ar-IQ'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="اللهجة العراقية / Iraqi Arabic"
            >
              العراق
            </button>
            <button
              type="button"
              onClick={() => setLanguage('ar-SA')}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                language === 'ar-SA'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="العربية الفصحى"
            >
              فصحى
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en-US')}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                language === 'en-US'
                  ? 'bg-cyan-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="English (US)"
            >
              EN
            </button>
          </div>

          {/* Toggle Expand */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Interactive Body */}
      {isExpanded && (
        <div className="p-3.5 sm:p-4 space-y-3.5">
          {/* Mic Trigger Row & Sound Wave Visualizer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`relative px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 animate-pulse'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>{isRTL ? 'إيقاف الاستماع' : 'Stop Listening'}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>{isRTL ? 'بدء الاستماع الصوتي' : 'Start Voice Input'}</span>
                  </>
                )}
              </button>

              {/* Status indicator */}
              <div className="text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isListening
                        ? 'bg-rose-500 animate-ping'
                        : isSupported
                        ? 'bg-emerald-400'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-bold text-slate-200">
                    {isListening
                      ? isRTL
                        ? 'الميكروفون نشط، انطق الوزن الآن...'
                        : 'Listening... speak weight now'
                      : isRTL
                      ? 'بانتظار نداء المشغل'
                      : 'Standby'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {autoApply
                    ? isRTL
                      ? 'التطبيق التلقائي مفعل'
                      : 'Auto-apply active'
                    : isRTL
                    ? 'تأكيد يدوي'
                    : 'Manual confirm'}
                </div>
              </div>
            </div>

            {/* Audio Wave & Volume Level */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {isListening && (
                <div className="flex items-center gap-1 h-6 px-2.5 py-1 bg-slate-900 rounded-lg border border-cyan-500/30">
                  <span className="text-[10px] font-mono text-cyan-400 me-1">dB:</span>
                  {[0.2, 0.5, 0.8, 1.0, 0.7, 0.4].map((multiplier, idx) => {
                    const height = Math.max(3, Math.min(22, Math.round((volumeLevel * multiplier) / 3)));
                    return (
                      <span
                        key={idx}
                        className="w-1 bg-cyan-400 rounded-full transition-all duration-75"
                        style={{ height: `${height}px` }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Quick Settings Toggles */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoApply((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                    autoApply
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                  title={isRTL ? 'تطبيق الوزن تلقائياً فور التعرف عليه' : 'Auto-apply weight upon detection'}
                >
                  <Zap className="w-3 h-3 inline me-1" />
                  {isRTL ? 'تلقائي' : 'Auto'}
                </button>

                <button
                  type="button"
                  onClick={() => setAudioFeedback((prev) => !prev)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    audioFeedback
                      ? 'bg-slate-900 text-cyan-400 border-cyan-500/40'
                      : 'bg-slate-950 text-slate-500 border-slate-800'
                  }`}
                  title={audioFeedback ? 'Mute Chime' : 'Enable Chime'}
                >
                  {audioFeedback ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickSamples((prev) => !prev)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono border transition-all cursor-pointer ${
                    showQuickSamples
                      ? 'bg-slate-800 text-white border-slate-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                  title={isRTL ? 'أمثلة نداءات سريعة لتجربة التعرف الصوتي' : 'Sample speech test phrases'}
                >
                  <Sparkles className="w-3 h-3 inline me-1 text-amber-400" />
                  {isRTL ? 'أمثلة' : 'Samples'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Simulation Chips */}
          {showQuickSamples && (
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-bold text-slate-300">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  {isRTL ? 'اختبار التعرف الصوتي (نداءات شائعة بالورشة والميزان):' : 'Speech test chips (click to simulate):'}
                </span>
                <span className="text-[10px] text-slate-500">
                  {isRTL ? 'محاكاة النداء في بيئة الورشة الصاخبة' : 'Simulate spoken input'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {samplePhrases.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSimulateSpeech(s.phrase)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950 border border-slate-700 hover:border-cyan-500/60 text-slate-300 hover:text-cyan-300 text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>{s.labelAr}</span>
                    <span className="text-[10px] text-slate-500">"{s.phrase}"</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Transcript & Real-time Extracted Weight Display */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Transcript Bubble */}
            <div className="sm:col-span-7 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>{isRTL ? 'النص المسموع (Voice Stream):' : 'Speech Stream:'}</span>
                {activeTranscript && (
                  <button
                    type="button"
                    onClick={clearTranscript}
                    className="text-slate-500 hover:text-slate-300 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>{isRTL ? 'مسح' : 'Clear'}</span>
                  </button>
                )}
              </div>
              <div className="min-h-12 text-xs font-mono text-white flex items-center">
                {activeTranscript ? (
                  <p className="leading-relaxed">
                    <span className="text-white">{transcript}</span>
                    {interimTranscript && (
                      <span className="text-cyan-400/80 italic ps-1 animate-pulse">
                        {interimTranscript}
                      </span>
                    )}
                  </p>
                ) : (
                  <span className="text-slate-500 italic text-[11px]">
                    {isRTL
                      ? 'انقر على زر الميكروفون أعلاه وقل مثلاً: "ثمانية وعشرين ألف وخمسمية كغم"...'
                      : 'Click start and say e.g., "twenty eight thousand five hundred kilograms"...'}
                  </span>
                )}
              </div>
            </div>

            {/* Extracted Weight Card */}
            <div
              className={`sm:col-span-5 p-3 rounded-xl border flex flex-col justify-between transition-all ${
                parsedData.weightKG
                  ? 'bg-gradient-to-br from-cyan-950/70 to-slate-950 border-cyan-400/70 shadow-md'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">{isRTL ? 'الوزن المستخرج:' : 'Extracted Weight:'}</span>
                  {parsedData.confidence > 0 && (
                    <span className="text-emerald-400 font-bold">
                      {Math.round(parsedData.confidence * 100)}% {isRTL ? 'دقة' : 'match'}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-baseline gap-1.5">
                  <span
                    className={`text-2xl font-black font-mono tracking-tight ${
                      parsedData.weightKG ? 'text-cyan-300' : 'text-slate-600'
                    }`}
                  >
                    {parsedData.weightKG ? parsedData.weightKG.toLocaleString() : '---'}
                  </span>
                  <span className="text-xs font-bold text-slate-400">KG</span>
                </div>

                {parsedData.bulkBagsCount !== null && (
                  <div className="text-[11px] font-mono text-amber-300 font-bold mt-0.5">
                    {parsedData.bulkBagsCount} {isRTL ? 'شليف (Bulk Bags)' : 'Bags'}
                  </div>
                )}
              </div>

              {/* Action Button */}
              {parsedData.weightKG && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleManualApply}
                    className="w-full py-1.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {appliedFlash
                        ? isRTL
                          ? '✓ تم تثبيت الوزن'
                          : '✓ Weight Applied'
                        : isRTL
                        ? 'تطبيق الوزن بالحقل'
                        : 'Apply to Field'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Browser Permission or Error Warning if any */}
          {error && (
            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">{isRTL ? 'تنبيه التعرف الصوتي:' : 'Voice Notice:'} </span>
                <span>{error}</span>
                <div className="text-[11px] text-amber-300/80 mt-0.5">
                  {isRTL
                    ? 'يمكنك دائماً النقر على أزرار "أمثلة نداءات" السريعة للتجربة السلسة دون قيود الميكروفون.'
                    : 'You can also use the sample speech chips to simulate scale calls directly.'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
