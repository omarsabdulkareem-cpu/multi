import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Printer,
  FileDown,
  X,
  Tag,
  CheckSquare,
  Square,
  Layers,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Scale,
  Building2,
  Calendar,
  Grid2X2,
  FileText,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { BulkBag } from '../types';

export interface BatchBulkBagLabelModalProps {
  bags: BulkBag[];
  isOpen: boolean;
  onClose: () => void;
}

export type LabelPageFormat = 'thermal_100x150' | 'thermal_100x100' | 'a4_sheet_4up';

export const BatchBulkBagLabelModal: React.FC<BatchBulkBagLabelModalProps> = ({
  bags,
  isOpen,
  onClose,
}) => {
  const { isRTL } = useLanguage();

  // Local state for active bags to print (allows removing single bag before print)
  const [selectedBags, setSelectedBags] = useState<BulkBag[]>(bags);
  const [labelFormat, setLabelFormat] = useState<LabelPageFormat>('thermal_100x150');

  // Print customization options
  const [showHeader, setShowHeader] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showComplianceWarning, setShowComplianceWarning] = useState(true);
  const [showTareWeight, setShowTareWeight] = useState(true);

  // PDF Generation Progress
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [pdfSuccess, setPdfSuccess] = useState(false);

  // Sync selectedBags whenever the incoming bags prop changes
  React.useEffect(() => {
    setSelectedBags(bags);
  }, [bags]);

  if (!isOpen) return null;

  const handleToggleBag = (bagId: string) => {
    if (selectedBags.some((b) => b.id === bagId)) {
      setSelectedBags(selectedBags.filter((b) => b.id !== bagId));
    } else {
      const originalBag = bags.find((b) => b.id === bagId);
      if (originalBag) {
        setSelectedBags([...selectedBags, originalBag]);
      }
    }
  };

  const handleSelectAll = () => {
    setSelectedBags(bags);
  };

  const handleClearAll = () => {
    setSelectedBags([]);
  };

  const totalWeight = selectedBags.reduce((sum, b) => sum + (b.weightKG || 0), 0);

  // Direct Browser Print
  const handleDirectPrint = () => {
    window.print();
  };

  // Generate Multi-Page PDF using jsPDF + html2canvas
  const handleGeneratePdf = async () => {
    if (selectedBags.length === 0) return;

    setIsGeneratingPdf(true);
    setPdfSuccess(false);

    try {
      if (labelFormat === 'thermal_100x150') {
        // Standard Industrial Thermal Roll: 100mm wide x 150mm high
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [100, 150],
        });

        const total = selectedBags.length;
        setGenerationProgress({ current: 0, total });

        for (let i = 0; i < selectedBags.length; i++) {
          setGenerationProgress({ current: i + 1, total });
          const element = document.getElementById(`batch-label-preview-${selectedBags[i].id}`);
          if (!element) continue;

          const canvas = await html2canvas(element, {
            scale: 2.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });

          if (i > 0) {
            pdf.addPage([100, 150], 'portrait');
          }

          const imgData = canvas.toDataURL('image/png');
          // Fill 100x150 mm canvas with 2mm safety margins
          pdf.addImage(imgData, 'PNG', 2, 2, 96, 146, undefined, 'FAST');
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        pdf.save(`AlKarwan_BulkBag_Labels_100x150_${selectedBags.length}bags_${dateStr}.pdf`);
      } else if (labelFormat === 'thermal_100x100') {
        // Square Thermal Roll: 100mm x 100mm
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [100, 100],
        });

        const total = selectedBags.length;
        setGenerationProgress({ current: 0, total });

        for (let i = 0; i < selectedBags.length; i++) {
          setGenerationProgress({ current: i + 1, total });
          const element = document.getElementById(`batch-label-preview-${selectedBags[i].id}`);
          if (!element) continue;

          const canvas = await html2canvas(element, {
            scale: 2.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });

          if (i > 0) {
            pdf.addPage([100, 100], 'portrait');
          }

          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', 2, 2, 96, 96, undefined, 'FAST');
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        pdf.save(`AlKarwan_BulkBag_Labels_100x100_${selectedBags.length}bags_${dateStr}.pdf`);
      } else {
        // A4 Sheet: 4 labels per page (2 columns x 2 rows)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4', // 210 x 297 mm
        });

        const total = selectedBags.length;
        setGenerationProgress({ current: 0, total });

        const labelWidth = 98; // mm
        const labelHeight = 138; // mm
        const leftMargin = 5;
        const topMargin = 7;
        const colSpacing = 6;
        const rowSpacing = 6;

        let pageIndex = 0;

        for (let i = 0; i < selectedBags.length; i++) {
          setGenerationProgress({ current: i + 1, total });
          const element = document.getElementById(`batch-label-preview-${selectedBags[i].id}`);
          if (!element) continue;

          const canvas = await html2canvas(element, {
            scale: 2.2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
          });

          const posInPage = i % 4;
          if (i > 0 && posInPage === 0) {
            pdf.addPage('a4', 'portrait');
            pageIndex++;
          }

          const col = posInPage % 2; // 0 or 1
          const row = Math.floor(posInPage / 2); // 0 or 1

          const posX = leftMargin + col * (labelWidth + colSpacing);
          const posY = topMargin + row * (labelHeight + rowSpacing);

          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', posX, posY, labelWidth, labelHeight, undefined, 'FAST');
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        pdf.save(`AlKarwan_BulkBag_Labels_A4Sheet_${selectedBags.length}bags_${dateStr}.pdf`);
      }

      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 4000);
    } catch (error) {
      console.error('Batch PDF generation failed:', error);
      alert(isRTL ? 'حدث خطأ أثناء توليد ملف الـ PDF. يرجى المحاولة ثانية.' : 'Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Printer className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {isRTL ? 'طباعة دفعة ملصقات الشلايف' : 'Batch Bulk Bag Floor Labels'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                  {selectedBags.length} {isRTL ? 'شليف محدد' : 'Bags'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? `إجمالي الوزن: ${totalWeight.toLocaleString()} كغم • توليد ملف PDF متعدد الصفحات أو طباعة فورية لطابعات الباركود الحرارية`
                  : `Total Net: ${totalWeight.toLocaleString()} KG • Generate multi-page PDF or direct industrial thermal print`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={isRTL ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Customization Controls */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Format Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              {isRTL ? 'مقاس الورق:' : 'Format:'}
            </span>
            <div className="flex items-center rounded-xl bg-slate-900 p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setLabelFormat('thermal_100x150')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  labelFormat === 'thermal_100x150'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="100mm x 150mm Standard Thermal Roll (Zebra/TSC)"
              >
                100×150 mm ({isRTL ? 'حراري فردي' : 'Thermal Roll'})
              </button>
              <button
                type="button"
                onClick={() => setLabelFormat('a4_sheet_4up')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  labelFormat === 'a4_sheet_4up'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="A4 Sheet (4 labels per page)"
              >
                A4 ({isRTL ? '4 ملصقات/ورقة' : '4-Up Sheet'})
              </button>
              <button
                type="button"
                onClick={() => setLabelFormat('thermal_100x100')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  labelFormat === 'thermal_100x100'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="100mm x 100mm Square Thermal Roll"
              >
                100×100 mm ({isRTL ? 'مربع' : 'Square'})
              </button>
            </div>
          </div>

          {/* Label Content Toggles */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showHeader}
                onChange={(e) => setShowHeader(e.target.checked)}
                className="rounded border-slate-700 text-cyan-600 focus:ring-0"
              />
              <span>{isRTL ? 'شعار المصنع' : 'Header'}</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showLocation}
                onChange={(e) => setShowLocation(e.target.checked)}
                className="rounded border-slate-700 text-cyan-600 focus:ring-0"
              />
              <span>{isRTL ? 'موقع الرف' : 'Rack Loc'}</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTareWeight}
                onChange={(e) => setShowTareWeight(e.target.checked)}
                className="rounded border-slate-700 text-cyan-600 focus:ring-0"
              />
              <span>{isRTL ? 'وزن الشليف' : 'Tare'}</span>
            </label>

            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showComplianceWarning}
                onChange={(e) => setShowComplianceWarning(e.target.checked)}
                className="rounded border-slate-700 text-cyan-600 focus:ring-0"
              />
              <span>{isRTL ? 'تحذير الحركة' : 'Compliance'}</span>
            </label>
          </div>

          {/* Quick Select/Deselect Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
            >
              {isRTL ? 'تحديد الكل' : 'Select All'} ({bags.length})
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px]"
            >
              {isRTL ? 'إلغاء التحديد' : 'Deselect'}
            </button>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <span className="font-mono text-cyan-400 font-bold">{selectedBags.length}</span>
            <span>{isRTL ? 'ملصق جاهز للطباعة والتوليد' : 'labels queued for multi-page export'}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Direct Thermal Browser Print */}
            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={selectedBags.length === 0 || isGeneratingPdf}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              title="Print via Browser / Connected Printer"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>{isRTL ? 'طباعة فورية للطابعة' : 'Direct Print'}</span>
            </button>

            {/* Multi-Page PDF Download */}
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={selectedBags.length === 0 || isGeneratingPdf}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black flex items-center gap-2 shadow-lg shadow-cyan-950 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {isRTL
                      ? `جاري توليد صفحة ${generationProgress.current} من ${generationProgress.total}...`
                      : `Generating page ${generationProgress.current} of ${generationProgress.total}...`}
                  </span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>
                    {isRTL
                      ? `تنزيل ملف PDF (${selectedBags.length} صفحة)`
                      : `Download Multi-Page PDF (${selectedBags.length} pgs)`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {pdfSuccess && (
          <div className="px-6 py-2.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              {isRTL
                ? 'تم إنشاء وتحميل ملف الـ PDF متعدد الصفحات بنجاح! جاهز للإرسال إلى طابعات المستودع.'
                : 'Multi-page PDF generated and downloaded successfully! Ready for warehouse label printing.'}
            </span>
          </div>
        )}

        {/* Preview Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 space-y-6">
          {selectedBags.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm">
                {isRTL
                  ? 'لم يتم تحديد أي شليف للطباعة. يرجى تحديد شليف واحد على الأقل.'
                  : 'No bags selected for printing. Please select at least one bulk bag.'}
              </p>
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold"
              >
                {isRTL ? 'تحديد كل الشلايف المتاحة' : 'Select All Available Bags'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start justify-center">
              {selectedBags.map((bag, index) => {
                const qrPayload = JSON.stringify({
                  factory: 'AL-KARWAN',
                  bag_id: bag.bagId,
                  mat: bag.materialName,
                  mat_code: bag.materialCode || '',
                  net_kg: bag.weightKG,
                  tx: bag.transactionNumber || '',
                  loc: bag.locationCode || '',
                  dt: bag.createdAt || new Date().toISOString().slice(0, 10),
                });

                const formattedDate =
                  bag.createdAt && typeof bag.createdAt === 'string'
                    ? bag.createdAt.includes('T')
                      ? bag.createdAt.split('T')[0]
                      : bag.createdAt.split(' ')[0]
                    : new Date().toISOString().slice(0, 10);

                return (
                  <div
                    key={bag.id}
                    className="relative group rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl space-y-3"
                  >
                    {/* Badge & Quick Remove */}
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-[10px]">
                          {index + 1}
                        </span>
                        <span className="font-mono font-bold text-white">{bag.bagId}</span>
                        <span className="text-[11px] text-slate-400">({bag.materialName})</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleBag(bag.id)}
                        className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold transition-colors cursor-pointer"
                        title="Remove from batch"
                      >
                        {isRTL ? 'إزالة من الدفعة' : 'Remove'}
                      </button>
                    </div>

                    {/* Standard Sticker Representation (White background for thermal paper) */}
                    <div
                      id={`batch-label-preview-${bag.id}`}
                      className="bg-white text-black p-4 rounded-xl border-2 border-black max-w-[380px] mx-auto shadow-md font-sans select-none"
                      dir="rtl"
                    >
                      {/* Header Banner */}
                      {showHeader && (
                        <div className="border-b-2 border-black pb-1.5 mb-2.5 text-center">
                          <div className="text-[10.5px] font-black tracking-wider uppercase text-gray-900">
                            شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
                          </div>
                          <div className="text-[9px] font-mono tracking-widest text-gray-600">
                            AL-KARWAN FACTORY • BULK BAG IDENTIFIER
                          </div>
                        </div>
                      )}

                      {/* Main Grid: QR & Key Specs */}
                      <div className="grid grid-cols-3 gap-2.5 items-center">
                        {/* QR Code Container */}
                        <div className="col-span-1 flex flex-col items-center justify-center p-1 bg-white border border-black rounded">
                          <QRCodeSVG
                            value={qrPayload}
                            size={100}
                            level="M"
                            includeMargin={false}
                          />
                          <div className="mt-1 text-[8.5px] font-mono font-bold tracking-tighter text-black">
                            {bag.bagId}
                          </div>
                        </div>

                        {/* Right Details Column */}
                        <div className="col-span-2 space-y-1.5 text-xs text-right">
                          {/* Material */}
                          <div className="border-b border-gray-400 pb-1">
                            <span className="text-[9px] text-gray-600 block leading-tight">
                              اسم المادة / الخامة:
                            </span>
                            <span className="text-xs font-black text-black leading-tight block">
                              {bag.materialName}
                            </span>
                            {bag.materialCode && (
                              <span className="text-[9px] font-mono font-bold text-gray-700 block">
                                كود: {bag.materialCode}
                              </span>
                            )}
                          </div>

                          {/* Net Weight */}
                          <div className="border-b border-gray-400 pb-1 flex items-baseline justify-between">
                            <div>
                              <span className="text-[9px] text-gray-600 block leading-tight">
                                الوزن الصافي:
                              </span>
                              <span className="text-lg font-black font-mono text-black">
                                {(bag.weightKG ?? 0).toLocaleString()}
                              </span>
                              <span className="text-[10px] font-bold mr-1">كغم (KG)</span>
                            </div>
                            {showTareWeight && (
                              <div className="text-left text-[8.5px] text-gray-600 font-mono">
                                وزن الشليف: ~{bag.tareKG || 2.5} كغم
                              </div>
                            )}
                          </div>

                          {/* Reference & Location */}
                          <div className="grid grid-cols-2 gap-1 text-[9px] pt-0.5">
                            <div>
                              <span className="text-gray-600 block">رقم المعاملة:</span>
                              <span className="font-mono font-bold text-black truncate block">
                                {bag.transactionNumber || 'TX-N/A'}
                              </span>
                            </div>
                            {showLocation && (
                              <div>
                                <span className="text-gray-600 block">موقع التخزين:</span>
                                <span className="font-mono font-bold text-black truncate block">
                                  {bag.locationCode || 'LOC-01'}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Batch & Timestamp */}
                          <div className="flex items-center justify-between text-[8.5px] font-mono text-gray-600 pt-1 border-t border-dashed border-gray-300">
                            <span>تاريخ: {formattedDate}</span>
                            {bag.batchNumber && (
                              <span className="truncate max-w-[100px]">تشغيلة: {bag.batchNumber}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Warning */}
                      {showComplianceWarning && (
                        <div className="mt-2.5 pt-1 border-t-2 border-black flex items-center justify-between text-[8px] text-gray-800 font-bold">
                          <span>يحظر تحريك الشليف دون مسح الباركود</span>
                          <span className="font-mono">VERIFIED BY FACTORY ENGINE</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dedicated Hidden Print Area for Native Browser Direct Print (window.print()) */}
        <div id="batch-qr-labels-printable-area" className="hidden">
          {selectedBags.map((bag, index) => {
            const qrPayload = JSON.stringify({
              factory: 'AL-KARWAN',
              bag_id: bag.bagId,
              mat: bag.materialName,
              mat_code: bag.materialCode || '',
              net_kg: bag.weightKG,
              tx: bag.transactionNumber || '',
              loc: bag.locationCode || '',
              dt: bag.createdAt || new Date().toISOString().slice(0, 10),
            });

            const formattedDate =
              bag.createdAt && typeof bag.createdAt === 'string'
                ? bag.createdAt.includes('T')
                  ? bag.createdAt.split('T')[0]
                  : bag.createdAt.split(' ')[0]
                : new Date().toISOString().slice(0, 10);

            return (
              <div
                key={`print-${bag.id}`}
                className="page-break-after-label p-4 bg-white text-black font-sans border-2 border-black"
                style={{ width: '100mm', minHeight: '145mm', boxSizing: 'border-box' }}
                dir="rtl"
              >
                {showHeader && (
                  <div className="border-b-2 border-black pb-1.5 mb-2 text-center">
                    <div className="text-xs font-black uppercase text-gray-900">
                      شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
                    </div>
                    <div className="text-[10px] font-mono tracking-widest text-gray-600">
                      AL-KARWAN FACTORY • BULK BAG IDENTIFIER
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 items-center">
                  <div className="col-span-1 flex flex-col items-center justify-center p-1 bg-white border border-black rounded">
                    <QRCodeSVG value={qrPayload} size={110} level="M" includeMargin={false} />
                    <div className="mt-1 text-[9px] font-mono font-bold text-black">{bag.bagId}</div>
                  </div>

                  <div className="col-span-2 space-y-2 text-xs text-right">
                    <div className="border-b border-gray-400 pb-1">
                      <span className="text-[10px] text-gray-600 block">اسم المادة / الخامة:</span>
                      <span className="text-sm font-black text-black leading-tight block">
                        {bag.materialName}
                      </span>
                      {bag.materialCode && (
                        <span className="text-[10px] font-mono font-bold text-gray-700 block">
                          كود الصنف: {bag.materialCode}
                        </span>
                      )}
                    </div>

                    <div className="border-b border-gray-400 pb-1 flex items-baseline justify-between">
                      <div>
                        <span className="text-[10px] text-gray-600 block">الوزن الصافي:</span>
                        <span className="text-xl font-black font-mono text-black">
                          {(bag.weightKG ?? 0).toLocaleString()}
                        </span>
                        <span className="text-xs font-bold mr-1">كغم (KG)</span>
                      </div>
                      {showTareWeight && (
                        <div className="text-left text-[9px] text-gray-600 font-mono">
                          وزن الشليف: ~{bag.tareKG || 2.5} كغم
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
                      <div>
                        <span className="text-gray-600 block">رقم المعاملة:</span>
                        <span className="font-mono font-bold text-black">{bag.transactionNumber}</span>
                      </div>
                      {showLocation && (
                        <div>
                          <span className="text-gray-600 block">موقع التخزين:</span>
                          <span className="font-mono font-bold text-black">{bag.locationCode}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[9px] font-mono text-gray-600 pt-1 border-t border-dashed border-gray-300">
                      <span>تاريخ: {formattedDate}</span>
                      {bag.batchNumber && <span>تشغيلة: {bag.batchNumber}</span>}
                    </div>
                  </div>
                </div>

                {showComplianceWarning && (
                  <div className="mt-3 pt-1.5 border-t-2 border-black flex items-center justify-between text-[9px] text-gray-800 font-bold">
                    <span>يحظر تحريك الشليف دون مسح الباركود</span>
                    <span className="font-mono">VERIFIED BY FACTORY ENGINE</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
