import React from 'react';
import {
  ShieldAlert,
  AlertOctagon,
  Volume2,
  VolumeX,
  X,
  ExternalLink,
  RotateCw,
  Siren,
  ArrowRight,
} from 'lucide-react';
import { MaterialAlertInfo, playMaterialWarningAlarm, stopMaterialWarningAlarm } from '../services/materialAlertService';
import { useLanguage } from '../context/LanguageContext';

export interface MaterialAlertBannerProps {
  alert: MaterialAlertInfo | null;
  onOpenDetails: () => void;
  onDismiss: () => void;
}

export const MaterialAlertBanner: React.FC<MaterialAlertBannerProps> = ({
  alert,
  onOpenDetails,
  onDismiss,
}) => {
  const { isRTL } = useLanguage();

  if (!alert) return null;

  const isQuarantine = alert.type === 'QUARANTINED' || alert.type === 'BOTH';

  const handleReplayAlarm = (e: React.MouseEvent) => {
    e.stopPropagation();
    playMaterialWarningAlarm(alert.type === 'EXPIRED' ? 'EXPIRED' : 'QUARANTINED');
  };

  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border-2 ${
        isQuarantine
          ? 'bg-gradient-to-r from-red-950 via-slate-950 to-rose-950/80 border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.25)]'
          : 'bg-gradient-to-r from-amber-950 via-slate-950 to-orange-950/80 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
      } flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top duration-300`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-start sm:items-center gap-3">
        <div
          className={`p-2.5 rounded-xl ${
            isQuarantine ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
          } shrink-0 animate-pulse`}
        >
          <Siren className="w-5 h-5 text-red-400 animate-spin" />
        </div>

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono uppercase tracking-wider ${
                isQuarantine ? 'bg-red-500 text-white' : 'bg-amber-500 text-slate-950'
              }`}
            >
              {isQuarantine
                ? isRTL ? '⚠️ تنبيه خامة محجورة' : '⚠️ QUARANTINE ALERT'
                : isRTL ? '⏰ تنبيه خامة منتهية الصلاحية' : '⏰ EXPIRED ALERT'}
            </span>
            <span className="font-mono text-xs font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
              {alert.materialCode} ({alert.materialId})
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {isRTL ? alert.materialNameAr : alert.materialNameEn}
            </span>
          </div>

          <p className="text-xs text-red-200 mt-1 leading-snug font-medium line-clamp-1">
            {isRTL ? alert.reasonAr : alert.reason}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          type="button"
          onClick={handleReplayAlarm}
          className="px-2.5 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition"
          title={isRTL ? 'إعادة تشغيل صوت صفارة الإنذار' : 'Replay warning siren'}
        >
          <Volume2 className="w-3.5 h-3.5 text-red-400" />
          <span className="hidden md:inline">{isRTL ? 'صفارة الإنذار' : 'Siren'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenDetails}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition active:scale-95"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-white" />
          <span>{isRTL ? 'تقرير الحجر والإجراءات' : 'View Quarantine Report'}</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
          title={isRTL ? 'إغلاق الشريط' : 'Dismiss banner'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MaterialAlertBanner;
