import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Check, Copy, Tag, Building2, Calendar, Scale, Hash } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export interface BulkBagQrGeneratorProps {
  bag_id: string;
  material_name: string;
  weight_kg: number;
  transaction_number: string;
  location_code?: string;
  date?: string;
  tare_kg?: number;
  supplier?: string;
  material_code?: string;
  onClose?: () => void;
}

export const BulkBagQrGenerator: React.FC<BulkBagQrGeneratorProps> = ({
  bag_id,
  material_name,
  weight_kg,
  transaction_number,
  location_code = 'LOC-REC-01',
  date = new Date().toISOString().split('T')[0],
  tare_kg = 2.5,
  supplier = 'شركة الكروان للبلاستيك',
  material_code,
  onClose,
}) => {
  const { isRTL } = useLanguage();
  const [copied, setCopied] = React.useState(false);

  // Payload encoded in the industrial QR
  const qrPayload = JSON.stringify({
    factory: 'AL-KARWAN',
    bag_id,
    mat: material_name,
    mat_code: material_code || '',
    net_kg: weight_kg,
    tx: transaction_number,
    loc: location_code,
    dt: date,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(bag_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Screen Preview Card */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-xl space-y-4">
        {/* Action Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Tag className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isRTL ? 'بطاقة الشليف الصناعية المعيارية' : 'Industrial Bulk Bag Floor Label'}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                {bag_id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyCode}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
              title="Copy Bag ID"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[11px]">{copied ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ الكود' : 'Copy ID')}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-cyan-950 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isRTL ? 'طباعة الملصق (Thermal Label)' : 'Print Label'}</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Printable Area - Designed for 100mm x 150mm Thermal Printers */}
        <div
          id="qr-label-printable-area"
          className="bg-white text-black p-5 rounded-xl border-2 border-black max-w-md mx-auto shadow-md font-sans select-none"
          dir="rtl"
        >
          {/* Header Banner */}
          <div className="border-b-2 border-black pb-2 mb-3 text-center">
            <div className="text-[11px] font-black tracking-wider uppercase text-gray-800">
              شركة الكروان لإنتاج الألواح والأكواب البلاستيكية
            </div>
            <div className="text-[10px] font-mono tracking-widest text-gray-600">
              AL-KARWAN FACTORY • BULK BAG IDENTIFIER
            </div>
          </div>

          {/* Core Info Grid */}
          <div className="grid grid-cols-3 gap-3 items-center">
            {/* Left QR Code Container */}
            <div className="col-span-1 flex flex-col items-center justify-center p-1.5 bg-white border border-black rounded">
              <QRCodeSVG
                value={qrPayload}
                size={110}
                level="M"
                includeMargin={false}
              />
              <div className="mt-1 text-[9px] font-mono font-bold tracking-tighter text-black">
                {bag_id}
              </div>
            </div>

            {/* Right Details Container */}
            <div className="col-span-2 space-y-1.5 text-xs text-right">
              {/* Material Name */}
              <div className="border-b border-gray-400 pb-1">
                <span className="text-[10px] text-gray-600 block">اسم المادة / الخامة:</span>
                <span className="text-sm font-black text-black leading-tight block">
                  {material_name}
                </span>
                {material_code && (
                  <span className="text-[10px] font-mono font-bold text-gray-700 block">
                    كود الصنف: {material_code}
                  </span>
                )}
              </div>

              {/* Net Weight */}
              <div className="border-b border-gray-400 pb-1 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-gray-600 block">الوزن الصافي:</span>
                  <span className="text-xl font-black font-mono text-black">
                    {weight_kg.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold mr-1">كغم (KG)</span>
                </div>
                <div className="text-left text-[9px] text-gray-600 font-mono">
                  وزن الشليف: ~{tare_kg} كغم
                </div>
              </div>

              {/* Transaction & Document Reference */}
              <div className="grid grid-cols-2 gap-1 text-[10px] pt-0.5">
                <div>
                  <span className="text-gray-600 block">رقم المعاملة:</span>
                  <span className="font-mono font-bold text-black">{transaction_number}</span>
                </div>
                <div>
                  <span className="text-gray-600 block">موقع التخزين:</span>
                  <span className="font-mono font-bold text-black">{location_code}</span>
                </div>
              </div>

              {/* Date & Batch */}
              <div className="flex items-center justify-between text-[9px] font-mono text-gray-600 pt-1 border-t border-dashed border-gray-300">
                <span>تاريخ التعبئة: {date}</span>
                <span>وردية: صباحي</span>
              </div>
            </div>
          </div>

          {/* Barcode-styled footer warning for factory compliance */}
          <div className="mt-3 pt-1.5 border-t-2 border-black flex items-center justify-between text-[9px] text-gray-700 font-bold">
            <span>يحظر تحريك الشليف دون مسح الباركود</span>
            <span className="font-mono">VERIFIED BY FACTORY ENGINE</span>
          </div>
        </div>

        {/* Instructions for Operator */}
        <p className="text-[11px] text-slate-400 text-center">
          {isRTL
            ? 'اضغط زر "طباعة الملصق" لإرسال الأمر لطابعة الباركود الحرارية (Zebra / TSC) مباشرة بمقاس 100×150 مم.'
            : 'Click "Print Label" to output to industrial thermal barcode printers (100x150mm standard).'}
        </p>
      </div>
    </div>
  );
};
