import React from 'react';
import {
  Truck,
  Scale,
  PackageCheck,
  CheckCircle2,
  Flame,
  Boxes,
  Factory,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { TransactionStatus } from '../types';

interface WorkflowProgressTrackerProps {
  currentStatus?: TransactionStatus;
  requiresShredding?: boolean;
  interactive?: boolean;
  onStepClick?: (step: string) => void;
}

export const WorkflowProgressTracker: React.FC<WorkflowProgressTrackerProps> = ({
  currentStatus = 'Received',
  requiresShredding = false,
  interactive = false,
  onStepClick,
}) => {
  const { isRTL } = useLanguage();

  interface Step {
    id: string;
    labelAr: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
    isCompleted: boolean;
    isCurrent: boolean;
    isOptional?: boolean;
  }

  // Normalize status for resilient matching across both code format and title format
  const norm = (currentStatus || '').toUpperCase().replace(/\s+/g, '_');

  // Determine stage flags based on transaction status
  const isScaleInDone = [
    'SCALE_IN_COMPLETED',
    'UNLOADING',
    'UNLOADING_COMPLETED',
    'SCALE_OUT_COMPLETED',
    'RECEIVED',
    'WAITING_FOR_SHREDDING',
    'IN_SHREDDING',
    'SHREDDING_COMPLETED',
    'RETURNED_TO_STORAGE',
    'READY_FOR_PRODUCTION',
    'ISSUED_TO_PRODUCTION',
    'COMPLETED',
  ].includes(norm);

  const isUnloadDone = [
    'UNLOADING_COMPLETED',
    'SCALE_OUT_COMPLETED',
    'RECEIVED',
    'WAITING_FOR_SHREDDING',
    'IN_SHREDDING',
    'SHREDDING_COMPLETED',
    'RETURNED_TO_STORAGE',
    'READY_FOR_PRODUCTION',
    'ISSUED_TO_PRODUCTION',
    'COMPLETED',
  ].includes(norm);

  const isScaleOutDone = [
    'SCALE_OUT_COMPLETED',
    'RECEIVED',
    'WAITING_FOR_SHREDDING',
    'IN_SHREDDING',
    'SHREDDING_COMPLETED',
    'RETURNED_TO_STORAGE',
    'READY_FOR_PRODUCTION',
    'ISSUED_TO_PRODUCTION',
    'COMPLETED',
  ].includes(norm);

  const isReceivedDone = [
    'RECEIVED',
    'WAITING_FOR_SHREDDING',
    'IN_SHREDDING',
    'SHREDDING_COMPLETED',
    'RETURNED_TO_STORAGE',
    'READY_FOR_PRODUCTION',
    'ISSUED_TO_PRODUCTION',
    'COMPLETED',
  ].includes(norm);

  const isShreddingDone = [
    'SHREDDING_COMPLETED',
    'RETURNED_TO_STORAGE',
    'READY_FOR_PRODUCTION',
    'ISSUED_TO_PRODUCTION',
    'COMPLETED',
  ].includes(norm);

  const isStorageDone = [
    'RETURNED_TO_STORAGE',
    'READY_FOR_PRODUCTION',
    'ISSUED_TO_PRODUCTION',
    'COMPLETED',
  ].includes(norm);

  const isProductionDone = norm === 'ISSUED_TO_PRODUCTION' || norm === 'COMPLETED';

  const steps: Step[] = [
    {
      id: 'truck_arrival',
      labelAr: 'وصول الشاحنة',
      labelEn: 'Truck Arrival',
      icon: Truck,
      isCompleted: isScaleInDone,
      isCurrent: norm === 'DRAFT',
    },
    {
      id: 'scale_in',
      labelAr: 'وزن الدخول (قائم)',
      labelEn: 'Scale In',
      icon: Scale,
      isCompleted: isScaleInDone,
      isCurrent: norm === 'DRAFT',
    },
    {
      id: 'unloading',
      labelAr: 'تفريغ الحمولة',
      labelEn: 'Unloading',
      icon: PackageCheck,
      isCompleted: isUnloadDone,
      isCurrent: norm === 'SCALE_IN_COMPLETED' || norm === 'UNLOADING',
    },
    {
      id: 'scale_out',
      labelAr: 'الميزان فارغ (الصافي)',
      labelEn: 'Scale Out',
      icon: Scale,
      isCompleted: isScaleOutDone,
      isCurrent: norm === 'UNLOADING_COMPLETED',
    },
    {
      id: 'receiving',
      labelAr: 'تأكيد الاستلام',
      labelEn: 'Receiving Confirmed',
      icon: CheckCircle2,
      isCompleted: isReceivedDone,
      isCurrent: norm === 'SCALE_OUT_COMPLETED',
    },
    ...(requiresShredding
      ? [
          {
            id: 'shredding',
            labelAr: 'الثرم (THERM)',
            labelEn: 'Shredding (Therm)',
            icon: Flame,
            isCompleted: isShreddingDone,
            isCurrent: norm === 'WAITING_FOR_SHREDDING' || norm === 'IN_SHREDDING',
          },
        ]
      : []),
    {
      id: 'storage',
      labelAr: 'الخزن بالمستودع',
      labelEn: 'Warehouse Storage',
      icon: Boxes,
      isCompleted: isStorageDone || (!requiresShredding && isReceivedDone),
      isCurrent: norm === 'SHREDDING_COMPLETED',
    },
    {
      id: 'production',
      labelAr: 'صرف للإنتاج (167)',
      labelEn: 'Production Issue',
      icon: Factory,
      isCompleted: isProductionDone,
      isCurrent: norm === 'READY_FOR_PRODUCTION',
    },
  ];

  return (
    <div className="w-full bg-[#111218] border border-white/5 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="font-mono font-bold text-slate-300 uppercase tracking-widest text-[10px]">
            {isRTL ? 'مسار تتبع حركة المادة الصناعية' : 'MATERIAL FLOW PIPELINE TRACKER'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{isRTL ? 'حالة المعاملة:' : 'Status:'}</span>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            {currentStatus}
          </span>
        </div>
      </div>

      {/* Stepper horizontal row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 lg:grid-cols-7 gap-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              onClick={() => interactive && onStepClick && onStepClick(step.id)}
              className={`relative flex flex-col items-center text-center p-2.5 rounded-lg border transition-all ${
                interactive ? 'cursor-pointer hover:border-cyan-500/40' : ''
              } ${
                step.isCompleted
                  ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-300'
                  : step.isCurrent
                  ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                  : 'bg-[#0f1115] border-white/5 text-slate-400'
              }`}
            >
              {/* Step indicator badge */}
              <div
                className={`w-7 h-7 rounded flex items-center justify-center mb-1.5 transition-colors ${
                  step.isCompleted
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : step.isCurrent
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-white/5 text-slate-400'
                }`}
              >
                {step.isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              <span className="text-[11px] font-bold leading-tight line-clamp-1 text-slate-200">
                {isRTL ? step.labelAr : step.labelEn}
              </span>

              <span className="text-[9px] font-mono mt-1 text-slate-500">
                {step.isCompleted
                  ? isRTL ? 'مكتمل ✓' : 'DONE ✓'
                  : step.isCurrent
                  ? isRTL ? 'قيد التنفيذ ●' : 'ACTIVE ●'
                  : isRTL ? 'معلق ○' : 'PENDING ○'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
