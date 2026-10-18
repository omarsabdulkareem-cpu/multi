import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  Volume2,
  VolumeX,
  X,
  Copy,
  Check,
  Building2,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  Lock,
  FileCheck,
  ChevronRight,
  ArrowRight,
  Radio,
  Siren,
} from 'lucide-react';
import { MaterialAlertInfo, playMaterialWarningAlarm, stopMaterialWarningAlarm } from '../services/materialAlertService';
import { useLanguage } from '../context/LanguageContext';

export interface MaterialAlertModalProps {
  alert: MaterialAlertInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onRouteToQuarantine?: (alert: MaterialAlertInfo) => void;
  onSupervisorOverride?: (alert: MaterialAlertInfo, notes: string) => void;
}

export const MaterialAlertModal: React.FC<MaterialAlertModalProps> = ({
  alert,
  isOpen,
  onClose,
  onRouteToQuarantine,
  onSupervisorOverride,
}) => {
  const { isRTL } = useLanguage();
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideNotes, setOverrideNotes] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);

  if (!isOpen || !alert) return null;

  const isQuarantine = alert.type === 'QUARANTINED' || alert.type === 'BOTH';
  const isExpired = alert.type === 'EXPIRED' || alert.type === 'BOTH';

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      playMaterialWarningAlarm(alert.type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED');
    } else {
      setIsMuted(true);
      stopMaterialWarningAlarm();
    }
  };

  const handleReplayAlarm = () => {
    setIsMuted(false);
    playMaterialWarningAlarm(alert.type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED');
  };

  const handleCopyDetails = () => {
    const text = `[AL-KARWAN FACTORY ALERT]
Material ID: ${alert.materialId} (${alert.materialCode})
Name: ${alert.materialNameAr} / ${alert.materialNameEn}
Status: ${alert.status}
Reason: ${alert.reasonAr}
Flagged By: ${alert.flaggedBy}
Quarantine Bay: ${alert.quarantineBayAr}
Timestamp: ${alert.timestamp}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorPin.trim()) {
      setOverrideError(isRTL ? 'يرجى إدخال رمز التفويض الإداري' : 'Please enter supervisor PIN');
      return;
    }
    // PIN 1234 or standard factory auth
    if (supervisorPin.trim() !== '1234' && supervisorPin.trim() !== '9999') {
      setOverrideError(isRTL ? 'رمز التفويض غير صحيح! (استخدم 1234 للاختبار)' : 'Invalid PIN! (Use 1234 for demo)');
      return;
    }
    if (onSupervisorOverride) {
      onSupervisorOverride(alert, overrideNotes || 'استثناء رقابي معتمد من مدير الجودة');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-2xl rounded-3xl bg-slate-950 border-2 ${
          isQuarantine ? 'border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)]' : 'border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.4)]'
        } overflow-hidden flex flex-col my-auto`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Animated Warning Hazard Banner Header */}
        <div
          className={`p-4 sm:p-5 ${
            isQuarantine
              ? 'bg-gradient-to-r from-red-950 via-rose-900 to-red-950 border-b border-red-500/50'
              : 'bg-gradient-to-r from-amber-950 via-orange-900 to-amber-950 border-b border-amber-500/50'
          }`}
        >
          {/* Pulsing Hazard Stripes Indicator Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-400 to-red-500 rounded-full mb-3 animate-pulse" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  isQuarantine
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-lg shadow-red-950'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/50 shadow-lg shadow-amber-950'
                } animate-bounce shrink-0`}
              >
                {isQuarantine ? <ShieldAlert className="w-8 h-8" /> : <AlertOctagon className="w-8 h-8" />}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black font-mono uppercase tracking-wider ${
                      isQuarantine ? 'bg-red-500 text-white' : 'bg-amber-500 text-slate-950'
                    } flex items-center gap-1 shadow`}
                  >
                    <Siren className="w-3.5 h-3.5 animate-spin" />
                    <span>
                      {isQuarantine
                        ? isRTL ? 'إنذار حجر أمني وفحص مخبري' : 'QUARANTINE SECURITY ALERT'
                        : isRTL ? 'إنذار انتهاء الصلاحية' : 'EXPIRATION WARNING ALERT'}
                    </span>
                  </span>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-black/60 text-slate-300 border border-slate-700">
                    {alert.materialCode || alert.materialId}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-black text-white mt-1 leading-snug">
                  {isRTL
                    ? isQuarantine
                      ? '⚠️ تنبيه عاجل: تم رصد خامة محجورة وممنوعة من الصرف!'
                      : '⏰ تنبيه عاجل: تم رصد خامة منتهية الصلاحية!'
                    : isQuarantine
                    ? 'CRITICAL ALERT: Quarantined Material Identified in Database!'
                    : 'CRITICAL ALERT: Expired Material Identified in Database!'}
                </h2>
              </div>
            </div>

            {/* Sound Controls & Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleToggleMute}
                className={`p-2 rounded-xl border cursor-pointer transition ${
                  isMuted
                    ? 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    : 'bg-red-500/30 border-red-400 text-red-300 hover:bg-red-500/40 animate-pulse'
                }`}
                title={isMuted ? (isRTL ? 'تشغيل صوت الإنذار' : 'Unmute alarm') : (isRTL ? 'كتم صوت الإنذار' : 'Mute alarm')}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-black/40 hover:bg-black/70 text-slate-400 hover:text-white border border-slate-700/60 transition cursor-pointer"
                title={isRTL ? 'إغلاق التنبيه' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Material Identity Card */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">
                  {isRTL ? 'معرف الخامة المسجلة' : 'Target Material Record'}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-base font-black text-white">
                    {isRTL ? alert.materialNameAr : alert.materialNameEn}
                  </h3>
                  <span className="px-2 py-0.5 rounded-lg bg-red-950 border border-red-500/40 text-red-300 font-mono font-bold text-xs">
                    {alert.materialCode}
                  </span>
                </div>
                <span className="text-xs text-slate-400 mt-0.5 block font-mono">
                  Database ID: {alert.materialId}
                </span>
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleCopyDetails}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{copied ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ البلاغ' : 'Copy Report')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleReplayAlarm}
                  className="px-2.5 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                  title={isRTL ? 'إعادة تشغيل صفارة الإنذار' : 'Replay warning siren'}
                >
                  <RotateCw className="w-3.5 h-3.5 text-red-400" />
                  <span>{isRTL ? 'صفارة الإنذار' : 'Replay Siren'}</span>
                </button>
              </div>
            </div>

            {/* Grid of Quarantine / Expiry Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block font-semibold mb-1">
                  {isRTL ? '⚠️ سبب الحظر / الفحص المخبري:' : '⚠️ Reason for Quarantine / Flag:'}
                </span>
                <p className="text-red-300 font-bold leading-relaxed">
                  {isRTL ? alert.reasonAr : alert.reason}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{isRTL ? 'حالة السجل:' : 'Status:'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-red-950 text-red-400 border border-red-500/50">
                    {alert.status}
                  </span>
                </div>
                {alert.expiryDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{isRTL ? 'تاريخ انتهاء الصلاحية:' : 'Expiry Date:'}</span>
                    <span className="font-mono font-bold text-amber-300">{alert.expiryDate}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{isRTL ? 'جهة التقييد:' : 'Flagged By:'}</span>
                  <span className="text-slate-300 font-medium">{alert.flaggedBy}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{isRTL ? 'موقع العزل المعتمد:' : 'Quarantine Bay:'}</span>
                  <span className="font-mono text-cyan-400 font-bold">{isRTL ? alert.quarantineBayAr : alert.quarantineBay}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Safety Directive */}
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200 space-y-1">
              <span className="font-black text-red-300 block">
                {isRTL ? 'إجراءات السلامة الإلزامية لمأمور الميزان والاستلام:' : 'Mandatory Weighbridge Safety Directives:'}
              </span>
              <p className="leading-relaxed">
                {isRTL ? alert.directiveAr : alert.directiveEn}
              </p>
            </div>
          </div>

          {/* Supervisor Override Form (Collapsible) */}
          {showOverrideForm && (
            <form onSubmit={handleExecuteOverride} className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-3 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>{isRTL ? 'إقرار تفويض وتجاوز إداري (Supervisor Override)' : 'Supervisor Authorization & Override'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOverrideForm(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>

              {overrideError && (
                <div className="p-2 rounded-lg bg-red-950 border border-red-500 text-red-300 text-xs font-bold">
                  {overrideError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                    {isRTL ? 'رمز تفويض مدير الجودة (PIN)' : 'Quality Manager PIN'}
                  </label>
                  <input
                    type="password"
                    value={supervisorPin}
                    onChange={(e) => setSupervisorPin(e.target.value)}
                    placeholder="1234"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/40 text-white font-mono text-xs focus:border-amber-400 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">{isRTL ? 'الرمز التجريبي: 1234' : 'Demo PIN: 1234'}</span>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                    {isRTL ? 'ملاحظات الاستثناء والمسؤول' : 'Override Notes & Justification'}
                  </label>
                  <input
                    type="text"
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    placeholder={isRTL ? 'استثناء خاص للاختبار المعملي' : 'Special exemption for lab assay'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:border-amber-400 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <FileCheck className="w-4 h-4 text-slate-950" />
                  <span>{isRTL ? 'تأكيد التجاوز ومتابعة الاستلام' : 'Confirm Override & Proceed'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Primary Action: Route to Quarantine Bay */}
            {onRouteToQuarantine && (
              <button
                type="button"
                onClick={() => {
                  onRouteToQuarantine(alert);
                  onClose();
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-950 cursor-pointer transition active:scale-95"
              >
                <ShieldAlert className="w-4 h-4 text-white" />
                <span>{isRTL ? '🛑 توجيه فوري لساحة الحجر Z-09' : '🛑 Route to Quarantine Bay Z-09'}</span>
              </button>
            )}

            {/* Toggle Supervisor Override Form */}
            {!showOverrideForm && (
              <button
                type="button"
                onClick={() => setShowOverrideForm(true)}
                className="w-full sm:w-auto px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRTL ? 'طلب استثناء إداري' : 'Supervisor Override'}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition shadow"
          >
            {isRTL ? 'إقرار واستمرار (Acknowledge)' : 'Acknowledge & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialAlertModal;
