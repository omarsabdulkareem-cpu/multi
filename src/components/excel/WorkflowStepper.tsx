import React from 'react';
import {
  Upload,
  FileSpreadsheet,
  Layers,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  FileText,
  TrendingUp,
  FileCheck,
  Check,
  Activity,
} from 'lucide-react';
import { ImportWorkflowStep, WORKFLOW_STEPS } from './excelTypes';

interface WorkflowStepperProps {
  currentStep: ImportWorkflowStep;
  onSelectStep: (step: ImportWorkflowStep) => void;
  isWorkbookLoaded: boolean;
  isRTL: boolean;
}

const STEP_ICONS: Record<ImportWorkflowStep, React.ElementType> = {
  UPLOAD: Upload,
  WORKBOOK_ANALYSIS: FileSpreadsheet,
  DATA_DETECTION: Layers,
  MAP_COLUMNS: SlidersHorizontal,
  MATERIAL_MATCH: Sparkles,
  VALIDATION: ShieldCheck,
  DATA_PREVIEW: FileText,
  INVENTORY_IMPACT: TrendingUp,
  COMMIT_MIGRATION: FileCheck,
  DIAGNOSTICS: Activity,
};

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  onSelectStep,
  isWorkbookLoaded,
  isRTL,
}) => {
  const currentStepIdx = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl overflow-x-auto">
      <div className="flex items-center justify-between min-w-[860px] gap-1.5">
        {WORKFLOW_STEPS.map((s, idx) => {
          const isActive = currentStep === s.id;
          const isCompleted = currentStepIdx > idx;
          const Icon = STEP_ICONS[s.id];
          const isDisabled = !isWorkbookLoaded && s.id !== 'UPLOAD';

          return (
            <button
              key={s.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectStep(s.id)}
              className={`flex-1 flex flex-col items-center text-center p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-slate-800 border-2 border-cyan-500/70 shadow-lg shadow-cyan-950/60 scale-[1.02]'
                  : isCompleted
                  ? 'hover:bg-slate-800/70 bg-slate-950/40 border border-slate-800/80 text-slate-300'
                  : 'bg-slate-950/30 border border-transparent text-slate-500 hover:text-slate-400 hover:bg-slate-900/40'
              }`}
              title={isRTL ? s.shortDescAr : s.shortDescEn}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold transition-all ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-400/50 shadow-md shadow-cyan-950'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3 text-emerald-400" /> : s.stepNum}
                </div>
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive
                      ? 'text-cyan-400'
                      : isCompleted
                      ? 'text-emerald-400'
                      : 'text-slate-600'
                  }`}
                />
              </div>

              <span
                className={`text-[11px] sm:text-xs font-bold truncate max-w-[95px] ${
                  isActive ? 'text-white' : isCompleted ? 'text-slate-200' : 'text-slate-400'
                }`}
              >
                {isRTL ? s.titleAr : s.titleEn}
              </span>

              <span className="text-[9px] font-mono text-slate-500 hidden xl:block truncate max-w-[95px] mt-0.5">
                {s.stepNum}/9
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
