import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  Volume2,
  VolumeX,
  X,
  Check,
  RotateCcw,
  Sparkles,
  QrCode,
  Scan,
  Database,
  Search,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { MaterialItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { playMaterialWarningAlarm, stopMaterialWarningAlarm } from '../services/materialAlertService';

export interface MaterialQuarantineTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: MaterialItem[];
  onToggleMaterialQuarantine: (materialId: string, isQuarantined: boolean, reason?: string) => void;
  onToggleMaterialExpired: (materialId: string, isExpired: boolean, expiryDate?: string) => void;
  onSimulateScan: (scannedText: string) => void;
}

export const MaterialQuarantineTestModal: React.FC<MaterialQuarantineTestModalProps> = ({
  isOpen,
  onClose,
  materials,
  onToggleMaterialQuarantine,
  onToggleMaterialExpired,
  onSimulateScan,
}) => {
  const { isRTL } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [testReason, setTestReason] = useState('حجز فحص الجودة: وجود شوائب بصرية وتلوث لوني غير مطابق');

  if (!isOpen) return null;

  const filteredMaterials = materials.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.id.toLowerCase().includes(term) ||
      m.code.toLowerCase().includes(term) ||
      (m.nameAr && m.nameAr.toLowerCase().includes(term)) ||
      (m.nameEn && m.nameEn.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{isRTL ? 'إدارة حالات الحجر والصلاحية وفحص نظام الإنذار' : 'Material Quarantine & Expiry Alert Simulator'}</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {isRTL
                  ? 'اختبار فوري لصفارة الإنذار والتنبيه المرئي، أو تعديل حالة المواد في قاعدة البيانات'
                  : 'Test visual/audio sirens or flag/unflag materials as quarantined or expired in the database'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Quick Siren Audio Testing Controls */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/50 via-slate-900 to-amber-950/50 border border-red-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-red-400 animate-pulse" />
                <span className="text-xs font-bold text-white">
                  {isRTL ? 'تجربة صفارات الإنذار الصوتية (Web Audio API):' : 'Test Audio Sirens & Vibrations:'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => stopMaterialWarningAlarm()}
                className="text-[10px] text-slate-400 hover:text-white underline"
              >
                {isRTL ? 'إيقاف الصوت' : 'Stop Audio'}
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => playMaterialWarningAlarm('QUARANTINED')}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-950 cursor-pointer transition active:scale-95"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>{isRTL ? '🔊 إنذار خامة محجورة (Siren A)' : '🔊 Quarantine Siren'}</span>
              </button>

              <button
                type="button"
                onClick={() => playMaterialWarningAlarm('EXPIRED')}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-950 cursor-pointer transition active:scale-95"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>{isRTL ? '🔊 إنذار خامة منتهية (Siren B)' : '🔊 Expired Buzzer'}</span>
              </button>

              {/* Instant Scan Simulation Buttons for Demo Items */}
              <button
                type="button"
                onClick={() => {
                  onSimulateScan('MAT-008');
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                title={isRTL ? 'محاكاة مسح كود الخامة المحجورة MAT-008' : 'Simulate scanning quarantined MAT-008'}
              >
                <Scan className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isRTL ? '⚡ مسح كود محجور (MAT-008)' : '⚡ Scan Quarantined'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSimulateScan('MAT-009');
                  onClose();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-950 hover:bg-amber-900 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                title={isRTL ? 'محاكاة مسح كود خامة منتهية الصلاحية MAT-009' : 'Simulate scanning expired MAT-009'}
              >
                <Scan className="w-3.5 h-3.5 text-amber-400" />
                <span>{isRTL ? '⚡ مسح كود منتهي (MAT-009)' : '⚡ Scan Expired'}</span>
              </button>
            </div>
          </div>

          {/* Search Materials */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute start-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isRTL ? 'بحث في دليل الخامات لتغيير حالة الحجر...' : 'Search material catalog to toggle status...'}
                className="w-full ps-8 pe-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
              />
            </div>
          </div>

          {/* Materials List */}
          <div className="space-y-2 divide-y divide-slate-800/60">
            {filteredMaterials.map((mat) => {
              const isQ = mat.isQuarantined || mat.status === 'QUARANTINED';
              const isE = mat.isExpired || mat.status === 'EXPIRED';

              return (
                <div
                  key={mat.id}
                  className={`pt-2.5 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2 rounded-xl ${
                    isQ
                      ? 'bg-red-950/20 border border-red-500/30'
                      : isE
                      ? 'bg-amber-950/20 border border-amber-500/30'
                      : 'hover:bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {mat.code}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200">
                        {isRTL ? mat.nameAr : mat.nameEn}
                      </h4>
                      {isQ && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-red-950 text-red-400 border border-red-500/40 animate-pulse">
                          {isRTL ? '⚠️ محجور' : 'QUARANTINED'}
                        </span>
                      )}
                      {isE && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-950 text-amber-400 border border-amber-500/40">
                          {isRTL ? '⏰ منتهي الصلاحية' : 'EXPIRED'}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      ID: {mat.id} • {mat.category}
                      {mat.quarantineReason && ` • السبب: ${mat.quarantineReason}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    {/* Toggle Quarantine */}
                    <button
                      type="button"
                      onClick={() => onToggleMaterialQuarantine(mat.id, !isQ, testReason)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                        isQ
                          ? 'bg-red-950 text-red-300 border border-red-500/50 hover:bg-red-900'
                          : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-red-950/60 hover:text-red-300'
                      }`}
                    >
                      <ShieldAlert className="w-3 h-3" />
                      <span>{isQ ? (isRTL ? 'إلغاء الحجر' : 'Unflag') : (isRTL ? 'حجز فحص' : 'Quarantine')}</span>
                    </button>

                    {/* Toggle Expiry */}
                    <button
                      type="button"
                      onClick={() => onToggleMaterialExpired(mat.id, !isE, '2026-02-15')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition ${
                        isE
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/50 hover:bg-amber-900'
                          : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-amber-950/60 hover:text-amber-300'
                      }`}
                    >
                      <AlertOctagon className="w-3 h-3" />
                      <span>{isE ? (isRTL ? 'صالح' : 'Valid') : (isRTL ? 'تحديد كمنتهي' : 'Expire')}</span>
                    </button>

                    {/* Simulate Scan */}
                    <button
                      type="button"
                      onClick={() => {
                        onSimulateScan(mat.code);
                        onClose();
                      }}
                      className="p-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 cursor-pointer"
                      title={isRTL ? 'محاكاة مسح QR هذه الخامة' : 'Simulate scanning this QR'}
                    >
                      <Scan className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
          >
            {isRTL ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaterialQuarantineTestModal;
