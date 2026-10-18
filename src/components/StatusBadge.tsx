import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export interface StatusBadgeProps {
  status: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showDot?: boolean;
  showIcon?: boolean;
}

interface StatusConfig {
  labelAr: string;
  labelEn: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Receiving / Scale Statuses
  Draft: {
    labelAr: 'مسودة / بانتظار الوزن الأول',
    labelEn: 'Draft / Scale In Pending',
    bgClass: 'bg-slate-800/80',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-600/60',
    dotClass: 'bg-slate-400',
  },
  SCALE_IN: {
    labelAr: 'بانتظار الوزن الأول (ممتلئة)',
    labelEn: 'Awaiting Scale In (Full)',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  ScaleIn: {
    labelAr: 'تم الوزن الأول (ممتلئة)',
    labelEn: 'Scale In Completed',
    bgClass: 'bg-sky-500/15',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-500/40',
    dotClass: 'bg-sky-400',
  },
  SCALE_IN_COMPLETED: {
    labelAr: 'تم الوزن الأول (ممتلئة)',
    labelEn: 'Scale In Completed',
    bgClass: 'bg-sky-500/15',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-500/40',
    dotClass: 'bg-sky-400',
  },
  UNLOADING: {
    labelAr: 'جاري التفريغ بالساحة',
    labelEn: 'Unloading In Progress',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  InUnloading: {
    labelAr: 'جاري التفريغ بالساحة',
    labelEn: 'Unloading In Progress',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  UNLOADED: {
    labelAr: 'تم التفريغ / بانتظار الوزن الثاني',
    labelEn: 'Unloaded / Awaiting Scale Out',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-300',
    borderClass: 'border-purple-500/40',
    dotClass: 'bg-purple-400',
  },
  SCALE_OUT: {
    labelAr: 'بانتظار الوزن الثاني (فارغة)',
    labelEn: 'Awaiting Scale Out (Empty)',
    bgClass: 'bg-indigo-500/15',
    textClass: 'text-indigo-300',
    borderClass: 'border-indigo-500/40',
    dotClass: 'bg-indigo-400 animate-pulse',
  },
  SCALE_OUT_COMPLETED: {
    labelAr: 'اكتمل الوزنان / بانتظار التوجيه',
    labelEn: 'Scale Out Completed',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  ScaleOut: {
    labelAr: 'اكتمل الوزنان / بانتظار التوجيه',
    labelEn: 'Scale Out Completed',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  RECEIVED: {
    labelAr: 'مستلم ومعتمد بالمستودع',
    labelEn: 'Received & Stored',
    bgClass: 'bg-emerald-500/20',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/50',
    dotClass: 'bg-emerald-400',
  },
  Completed: {
    labelAr: 'مكتمل ومعتمد',
    labelEn: 'Completed & Certified',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  COMPLETED: {
    labelAr: 'مكتمل ومعتمد',
    labelEn: 'Completed',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  SENT_TO_THERM: {
    labelAr: 'موجه لخط الثرم (إعادة تدوير)',
    labelEn: 'Sent to Therm / Shredding',
    bgClass: 'bg-cyan-500/15',
    textClass: 'text-cyan-300',
    borderClass: 'border-cyan-500/40',
    dotClass: 'bg-cyan-400',
  },
  ISSUED_TO_PRODUCTION: {
    labelAr: 'منصرف مباشرة للإنتاج (167)',
    labelEn: 'Issued to Production (167)',
    bgClass: 'bg-violet-500/15',
    textClass: 'text-violet-300',
    borderClass: 'border-violet-500/40',
    dotClass: 'bg-violet-400',
  },

  // Shredding Statuses
  SCHEDULED: {
    labelAr: 'مجدول للتشغيل',
    labelEn: 'Scheduled',
    bgClass: 'bg-slate-700/50',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-500/40',
    dotClass: 'bg-slate-400',
  },
  IN_PROGRESS: {
    labelAr: 'قيد التشغيل والثرم',
    labelEn: 'In Progress / Shredding',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  RETURNED_TO_STORAGE: {
    labelAr: 'تم إرجاع المفروم للمخزن',
    labelEn: 'Returned to Storage',
    bgClass: 'bg-teal-500/15',
    textClass: 'text-teal-300',
    borderClass: 'border-teal-500/40',
    dotClass: 'bg-teal-400',
  },

  // Movement Ledger Types
  RECEIPT: {
    labelAr: 'وارد استلام (دفتر 546)',
    labelEn: 'Receiving Inflow (546)',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  RECEIVING: {
    labelAr: 'وارد استلام (دفتر 546)',
    labelEn: 'Receiving Inflow (546)',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  ISSUE: {
    labelAr: 'صرف مواد',
    labelEn: 'Issue',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-300',
    borderClass: 'border-blue-500/40',
    dotClass: 'bg-blue-400',
  },
  PRODUCTION_ISSUE: {
    labelAr: 'صرف للإنتاج (دفتر 167)',
    labelEn: 'Production Issue (167)',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-300',
    borderClass: 'border-blue-500/40',
    dotClass: 'bg-blue-400',
  },
  'PRODUCTION ISSUE': {
    labelAr: 'صرف للإنتاج (دفتر 167)',
    labelEn: 'Production Issue (167)',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-300',
    borderClass: 'border-blue-500/40',
    dotClass: 'bg-blue-400',
  },
  SHREDDING_INPUT: {
    labelAr: 'صرف لماكينة الثرم (دفتر 360)',
    labelEn: 'Shredder Input (360)',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    dotClass: 'bg-amber-400',
  },
  'SHREDDING ISSUE': {
    labelAr: 'صرف لماكينة الثرم (دفتر 360)',
    labelEn: 'Shredder Input (360)',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/40',
    dotClass: 'bg-amber-400',
  },
  SHREDDING_OUTPUT: {
    labelAr: 'وارد مفروم معتمد (دفتر 360)',
    labelEn: 'Shredded Output (360)',
    bgClass: 'bg-cyan-500/15',
    textClass: 'text-cyan-300',
    borderClass: 'border-cyan-500/40',
    dotClass: 'bg-cyan-400',
  },
  'SHREDDING RETURN': {
    labelAr: 'وارد مفروم معتمد (دفتر 360)',
    labelEn: 'Shredded Output (360)',
    bgClass: 'bg-cyan-500/15',
    textClass: 'text-cyan-300',
    borderClass: 'border-cyan-500/40',
    dotClass: 'bg-cyan-400',
  },
  TRANSFER: {
    labelAr: 'مناقلة داخلية (دفتر 352)',
    labelEn: 'Internal Transfer (352)',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-300',
    borderClass: 'border-purple-500/40',
    dotClass: 'bg-purple-400',
  },
  TRANSFER_OUT: {
    labelAr: 'صادر مناقلة (دفتر 352)',
    labelEn: 'Transfer Out (352)',
    bgClass: 'bg-rose-500/15',
    textClass: 'text-rose-300',
    borderClass: 'border-rose-500/40',
    dotClass: 'bg-rose-400',
  },
  TRANSFER_IN: {
    labelAr: 'وارد مناقلة (دفتر 352)',
    labelEn: 'Transfer In (352)',
    bgClass: 'bg-teal-500/15',
    textClass: 'text-teal-300',
    borderClass: 'border-teal-500/40',
    dotClass: 'bg-teal-400',
  },
  ADJUSTMENT: {
    labelAr: 'تسوية جرد دفتري',
    labelEn: 'Inventory Adjustment',
    bgClass: 'bg-yellow-500/15',
    textClass: 'text-yellow-300',
    borderClass: 'border-yellow-500/40',
    dotClass: 'bg-yellow-400',
  },
  DAMAGE: {
    labelAr: 'تالف إنتاج',
    labelEn: 'Production Damage',
    bgClass: 'bg-rose-500/15',
    textClass: 'text-rose-300',
    borderClass: 'border-rose-500/40',
    dotClass: 'bg-rose-400',
  },
  PRODUCTION_DAMAGE: {
    labelAr: 'تالف إنتاج',
    labelEn: 'Production Damage',
    bgClass: 'bg-rose-500/15',
    textClass: 'text-rose-300',
    borderClass: 'border-rose-500/40',
    dotClass: 'bg-rose-400',
  },
  OPENING_BALANCE: {
    labelAr: 'رصيد افتتاحي',
    labelEn: 'Opening Balance',
    bgClass: 'bg-slate-700/50',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-500/40',
    dotClass: 'bg-slate-400',
  },

  // Consistency and Audit Statuses
  MATCH: {
    labelAr: 'مطابق 100% (توازن تام)',
    labelEn: 'Match (100% Consistent)',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    dotClass: 'bg-emerald-400',
  },
  DISCREPANCY: {
    labelAr: 'فارق تدقيق دفتري',
    labelEn: 'Discrepancy Detected',
    bgClass: 'bg-rose-500/15',
    textClass: 'text-rose-300',
    borderClass: 'border-rose-500/40',
    dotClass: 'bg-rose-400 animate-pulse',
  },
  DUPLICATE: {
    labelAr: 'مكرر ومستبعد',
    labelEn: 'Duplicate / Excluded',
    bgClass: 'bg-rose-500/15',
    textClass: 'text-rose-300',
    borderClass: 'border-rose-500/40',
    dotClass: 'bg-rose-400',
  },
  CANCELLED: {
    labelAr: 'ملغي ومستبعد',
    labelEn: 'Cancelled',
    bgClass: 'bg-slate-800/80',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-700',
    dotClass: 'bg-slate-500',
  },
  Cancelled: {
    labelAr: 'ملغي ومستبعد',
    labelEn: 'Cancelled',
    bgClass: 'bg-slate-800/80',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-700',
    dotClass: 'bg-slate-500',
  },
};

const DEFAULT_CONFIG: StatusConfig = {
  labelAr: 'حالة نظام',
  labelEn: 'Status',
  bgClass: 'bg-slate-800/80',
  textClass: 'text-slate-300',
  borderClass: 'border-slate-600/50',
  dotClass: 'bg-slate-400',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
  showDot = true,
}) => {
  const { language } = useLanguage();
  const config = STATUS_MAP[status] || {
    ...DEFAULT_CONFIG,
    labelAr: status,
    labelEn: status,
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[9px]',
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  const dotSizes = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded border tracking-wide whitespace-nowrap ${
        config.bgClass
      } ${config.textClass} ${config.borderClass} ${sizeClasses[size]} ${className}`}
    >
      {showDot && (
        <span className={`rounded-full shrink-0 ${config.dotClass} ${dotSizes[size]}`} />
      )}
      <span>{language === 'ar' ? config.labelAr : config.labelEn}</span>
    </span>
  );
};
