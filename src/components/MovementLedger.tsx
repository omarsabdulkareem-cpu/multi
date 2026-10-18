import React, { useState } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  Download,
  Upload,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Flame,
  Factory,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useFactory } from '../context/FactoryContext';
import { MovementType } from '../types';
import { StatusBadge } from './StatusBadge';

export const MovementLedger: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { inventoryMovements, materials, setCurrentPage } = useFactory();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');
  const [selectedTraceMovement, setSelectedTraceMovement] = useState<any | null>(null);

  const filteredMovements = inventoryMovements.filter((m) => {
    const sTerm = (searchTerm || '').toLowerCase();
    const matchesSearch =
      (m.movementNumber || '').toLowerCase().includes(sTerm) ||
      (m.referenceDocNumber || '').toLowerCase().includes(sTerm) ||
      (m.legacyDocumentNumber ? m.legacyDocumentNumber.toLowerCase().includes(sTerm) : false) ||
      (m.materialName || '').toLowerCase().includes(sTerm) ||
      (m.sourceLocation || '').toLowerCase().includes(sTerm) ||
      (m.destinationLocation || '').toLowerCase().includes(sTerm) ||
      (m.importBatchId ? m.importBatchId.toLowerCase().includes(sTerm) : false);

    const matchesType = typeFilter === 'ALL' || m.movementType === typeFilter;
    const matchesMaterial = materialFilter === 'ALL' || m.materialId === materialFilter;

    return matchesSearch && matchesType && matchesMaterial;
  });

  const getMovementBadge = (type: MovementType) => {
    switch (type) {
      case 'RECEIVING':
        return {
          label: isRTL ? 'استلام وميزان (546)' : 'Receiving (546)',
          color: 'bg-cyan-950 text-cyan-300 border-cyan-500/40',
        };
      case 'OPENING_BALANCE':
        return {
          label: isRTL ? 'رصيد افتتاحي تاريخي' : 'Historical Opening',
          color: 'bg-blue-950 text-blue-300 border-blue-400/40',
        };
      case 'SHREDDING RETURN':
        return {
          label: isRTL ? 'إيداع ثرم (360)' : 'Shredding Return (360)',
          color: 'bg-emerald-950 text-emerald-300 border-emerald-500/40',
        };
      case 'PRODUCTION ISSUE':
        return {
          label: isRTL ? 'صرف إنتاج (167)' : 'Prod Issue (167)',
          color: 'bg-purple-950 text-purple-300 border-purple-500/40',
        };
      case 'TRANSFER':
        return {
          label: isRTL ? 'نقل بين المواقع' : 'Transfer',
          color: 'bg-indigo-950 text-indigo-300 border-indigo-500/40',
        };
      case 'DAMAGE':
        return {
          label: isRTL ? 'تالف إنتاج' : 'Damage',
          color: 'bg-rose-950 text-rose-300 border-rose-500/40',
        };
      default:
        return {
          label: type,
          color: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  const exportToCSV = () => {
    const headers = ['Movement #', 'Legacy Doc', 'Date', 'Time', 'Type', 'Material', 'Quantity KG', 'Bulk Bags', 'Source', 'Destination', 'Operator'];
    const rows = filteredMovements.map((m) => [
      m.movementNumber,
      m.legacyDocumentNumber || '',
      m.date,
      m.time,
      m.movementType,
      m.materialName,
      m.quantityKG,
      m.bulkBagsCount,
      m.sourceLocation,
      m.destinationLocation,
      m.operator,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AL_KARWAN_MOVEMENT_LEDGER_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/40 border border-blue-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
              IMMUTABLE TRANSACTION LEDGER
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'دفتر حركات الأستاذ العام للمواد' : 'General Material Movement Journal'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            {isRTL ? 'سجل حركات المخزون والمستندات الدفترية' : 'Comprehensive Inventory Movement Ledger'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {isRTL
              ? 'سجل غير قابل للتعديل لكافة حركات الاستلام (546)، الثرم (360)، الصرف (167)، والنقل الداخلي.'
              : 'Audit-ready immutable log of receipts (546), shredding (360), production issues (167), and transfers.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setCurrentPage('historical_migration')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-bold text-xs border border-cyan-500/40 hover:border-cyan-400 shadow-lg cursor-pointer transition-all"
            title={isRTL ? 'مركز ترحيل البيانات التاريخية للمصنع' : 'Historical Data Migration Center'}
          >
            <Upload className="w-4 h-4" />
            <span>{isRTL ? 'ترحيل البيانات التاريخية' : 'Historical Migration'}</span>
          </button>

          <button
            onClick={() => setCurrentPage('excel_import')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-emerald-300 font-bold text-xs border border-emerald-500/40 hover:border-emerald-400 shadow-lg cursor-pointer transition-all"
            title={isRTL ? 'استيراد وترحيل سجلات من ملف Excel' : 'Import records from Excel spreadsheet'}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isRTL ? 'معالج ملفات Excel' : 'Excel Import'}</span>
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs border border-slate-700 hover:border-cyan-400 shadow-lg cursor-pointer transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isRTL ? 'تصدير إلى Excel / CSV' : 'Export Excel / CSV'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute top-3.5 right-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              isRTL
                ? 'بحث برقم الحركة، مستند (546, 167, 360, 352)، المادة، دفعة الاستيراد...'
                : 'Search Movement #, Doc (546, 167, 360), Material, Import Batch...'
            }
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs sm:text-sm outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
          >
            <option value="ALL">{isRTL ? 'كافة أنواع الحركات' : 'All Movement Types'}</option>
            <option value="RECEIVING">{isRTL ? 'استلام وميزان (546)' : 'Receiving (546)'}</option>
            <option value="OPENING_BALANCE">{isRTL ? 'رصيد افتتاحي تاريخي' : 'Historical Opening'}</option>
            <option value="SHREDDING RETURN">{isRTL ? 'إيداع ثرم (360)' : 'Shredding Return (360)'}</option>
            <option value="PRODUCTION ISSUE">{isRTL ? 'صرف إنتاج (167)' : 'Production Issue (167)'}</option>
            <option value="TRANSFER">{isRTL ? 'تحويل مواقع' : 'Transfer'}</option>
          </select>

          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value)}
            className="p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs outline-none"
          >
            <option value="ALL">{isRTL ? 'كافة المواد' : 'All Materials'}</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code} - {isRTL ? m.nameAr : m.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono uppercase">
              <tr>
                <th className="p-3.5 text-start">{isRTL ? 'رقم الحركة' : 'Movement #'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'المستند الدفتري' : 'Legacy Doc'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'التاريخ والوقت' : 'Date / Time'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'نوع الحركة' : 'Movement Type'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'المادة والصنف' : 'Material'}</th>
                <th className="p-3.5 text-end font-bold">{isRTL ? 'الكمية (كغم)' : 'Quantity (KG)'}</th>
                <th className="p-3.5 text-center text-amber-400 font-bold">{isRTL ? 'الشلايف' : 'Bags'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'المصدر ➔ الوجهة' : 'Source ➔ Destination'}</th>
                <th className="p-3.5 text-start">{isRTL ? 'التتبع والمشغل' : 'Trace / Operator'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredMovements.map((m) => {
                const badge = getMovementBadge(m.movementType);
                const isInflow =
                  m.movementType === 'RECEIVING' ||
                  m.movementType === 'SHREDDING RETURN' ||
                  m.movementType === 'RETURN' ||
                  m.movementType === 'OPENING_BALANCE';

                return (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition-colors font-mono">
                    <td className="p-3.5 font-bold text-white">
                      <div>{m.movementNumber}</div>
                      {m.importBatchId && (
                        <button
                          onClick={() => setSelectedTraceMovement(m)}
                          className="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1 font-mono"
                        >
                          <span>{m.importBatchId}</span>
                        </button>
                      )}
                    </td>
                    <td className="p-3.5 text-cyan-400 font-bold">{m.legacyDocumentNumber || '---'}</td>
                    <td className="p-3.5 text-slate-300">
                      <div>{m.date}</div>
                      <div className="text-[10px] text-slate-400">{m.time}</div>
                    </td>
                    <td className="p-3.5 font-sans">
                      <StatusBadge status={m.movementType} size="sm" showIcon />
                    </td>
                    <td className="p-3.5 text-slate-200 font-sans">
                      <div className="font-semibold">{m.materialName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{m.materialCode}</div>
                    </td>
                    <td
                      className={`p-3.5 text-end font-black text-sm ${
                        isInflow ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isInflow ? '+' : '-'}{(m.quantityKG ?? 0).toLocaleString()} KG
                    </td>
                    <td className="p-3.5 text-center font-bold text-amber-400">{m.bulkBagsCount}</td>
                    <td className="p-3.5 text-slate-300 font-sans text-[11px]">
                      <div className="flex items-center gap-1.5 truncate max-w-xs">
                        <span className="truncate">{m.sourceLocation}</span>
                        <span>➔</span>
                        <span className="truncate text-white font-semibold">{m.destinationLocation}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400 font-sans">
                      <div>{m.operator}</div>
                      {m.sourceFileName && (
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">
                          {m.sourceFileName}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Traceability Explorer Modal (Requirement 13) */}
      {selectedTraceMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans">
          <div className="bg-[#0f1115] border border-cyan-500/40 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-cyan-400" />
                {isRTL ? 'بطاقة التتبع التاريخي للحركة' : 'Movement Historical Traceability Card'}
              </h3>
              <button
                onClick={() => setSelectedTraceMovement(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">LEDGER RECORD ID:</span>
                <span className="text-white font-bold">{selectedTraceMovement.id}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-900">
                <span className="text-slate-400">MOVEMENT TYPE:</span>
                <StatusBadge status={selectedTraceMovement.movementType} size="xs" showIcon />
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">MOVEMENT NUMBER:</span>
                <span className="text-cyan-400 font-bold">{selectedTraceMovement.movementNumber}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">IMPORT BATCH ID:</span>
                <span className="text-amber-400 font-bold">{selectedTraceMovement.importBatchId || 'MANUAL'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">SOURCE WORKBOOK:</span>
                <span className="text-white font-semibold">{selectedTraceMovement.sourceFileName || 'System Entry'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">EXCEL SHEET NAME:</span>
                <span>{selectedTraceMovement.sourceSheetName || '---'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">EXCEL ROW NUMBER:</span>
                <span className="text-emerald-400 font-bold">{selectedTraceMovement.sourceRowNumber || '---'}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">ORIGINAL EXCEL TEXT:</span>
                <span className="text-white font-sans">{selectedTraceMovement.originalMaterialText || selectedTraceMovement.materialName}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">RECORDED WEIGHT:</span>
                <span className="text-emerald-400 font-bold">{selectedTraceMovement.quantityKG?.toLocaleString()} KG</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-slate-900">
                <span className="text-slate-400">RECORDED BULK BAGS:</span>
                <span className="text-amber-400 font-bold">{selectedTraceMovement.bulkBagsCount}</span>
              </div>
              {selectedTraceMovement.fingerprint && (
                <div className="p-2 rounded bg-slate-900">
                  <div className="text-slate-400 text-[10px]">DIGITAL FINGERPRINT:</div>
                  <div className="text-slate-400 text-[10px] break-all mt-0.5">{selectedTraceMovement.fingerprint}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTraceMovement(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
