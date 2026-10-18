import React, { useEffect } from 'react';
import { X, Cpu } from 'lucide-react';
import { WorkbookAnalysis, SheetAnalysis } from '../../services/smartExcelParser';
import { ImportWorkflowStep } from './excelTypes';
import { ExcelParserDiagnosticsView } from './ExcelParserDiagnosticsView';

export interface ExcelParserDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: WorkbookAnalysis;
  currentSheet: SheetAnalysis;
  activeSheetIdx: number;
  onSelectSheetIdx: (idx: number) => void;
  onNavigate: (step: ImportWorkflowStep) => void;
  onLoadPreset?: (presetId: string) => void;
  isRTL: boolean;
}

/**
 * ExcelParserDebugModal Component
 *
 * Dedicated modal window displaying the live technical diagnostic dashboard and
 * Final Parser Health summary view. Can be summoned over any import stage
 * without mutating or resetting existing state.
 */
export const ExcelParserDebugModal: React.FC<ExcelParserDebugModalProps> = ({
  isOpen,
  onClose,
  analysis,
  currentSheet,
  activeSheetIdx,
  onSelectSheetIdx,
  onNavigate,
  onLoadPreset,
  isRTL,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-7xl max-h-[94vh] flex flex-col bg-slate-950 border-2 border-amber-500/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">Excel Parser Debug Dashboard & Health Summary</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/50">
                  DEBUG MODAL
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                  HEALTH VERIFIED
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-sans">
                {analysis.fileName} • {currentSheet.sheetName} ({currentSheet.usedRange}) • {currentSheet.totalRows} Total Rows
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Close debug modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content Scroll Area */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(94vh-56px)] space-y-6">
          <ExcelParserDiagnosticsView
            analysis={analysis}
            currentSheet={currentSheet}
            activeSheetIdx={activeSheetIdx}
            onSelectSheetIdx={onSelectSheetIdx}
            onNavigate={(step) => {
              onClose();
              onNavigate(step);
            }}
            onCloseDiagnostics={onClose}
            onLoadPreset={onLoadPreset}
            isRTL={isRTL}
            isModal={true}
          />
        </div>
      </div>
    </div>
  );
};
