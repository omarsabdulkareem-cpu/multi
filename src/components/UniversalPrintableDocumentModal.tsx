import React, { useRef } from 'react';
import {
  Printer,
  X,
  FileText,
  Boxes,
  Building2,
  Calendar,
  User,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Download,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';

export type PrintableDocumentType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'STOCK_COUNT'
  | 'PURCHASE_ORDER'
  | 'MATERIAL_CARD'
  | 'INVENTORY_REPORT';

export interface PrintableDocLine {
  itemCode: string;
  itemName: string;
  locationCode?: string;
  quantity: number;
  unit: string;
  weightKG?: number;
  unitPrice?: number;
  totalPrice?: number;
  batchId?: string;
  expiryDate?: string;
  notes?: string;
}

export interface PrintableDocData {
  documentType: PrintableDocumentType;
  documentNumber: string;
  date: string;
  warehouseName: string;
  partyName?: string; // Supplier, Customer, Department
  performedBy: string;
  approvedBy?: string;
  referenceNumber?: string;
  reason?: string;
  notes?: string;
  lines: PrintableDocLine[];
}

interface UniversalPrintableDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PrintableDocData | null;
}

export const UniversalPrintableDocumentModal: React.FC<UniversalPrintableDocumentModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const getDocTitles = (type: PrintableDocumentType) => {
    switch (type) {
      case 'RECEIPT':
        return {
          ar: 'مستند استلام بضاعة رسمي (GRN)',
          en: 'OFFICIAL GOODS RECEIPT NOTE (GRN)',
          subAr: 'قسم الاستلام والمستودعات المركزية',
          subEn: 'Central Receiving & Quality Inspection Dept.',
        };
      case 'ISSUE':
        return {
          ar: 'إذن صرف مواد ومهمات (Delivery Note)',
          en: 'STOCK ISSUE & DELIVERY VOUCHER',
          subAr: 'صرف خامات ومستلزمات الإنتاج والتوزيع',
          subEn: 'Production & Outbound Dispatch Department',
        };
      case 'TRANSFER':
        return {
          ar: 'مذكرة مناقلة مخزنية بين المواقع',
          en: 'INTER-WAREHOUSE TRANSFER WAYBILL',
          subAr: 'نقل وتوزيع الأرصدة الداخلية',
          subEn: 'Internal Facility Stock Relocation Note',
        };
      case 'ADJUSTMENT':
        return {
          ar: 'إذن تسوية فروقات مخزنية معتمد',
          en: 'STOCK ADJUSTMENT VOUCHER',
          subAr: 'تسوية الجرد والفروقات المعتمدة',
          subEn: 'Inventory Reconciliation & Audit Adjustment',
        };
      case 'STOCK_COUNT':
        return {
          ar: 'كشف جرد ومطابقة دورية معتمد',
          en: 'PHYSICAL STOCKTAKE RECONCILIATION SHEET',
          subAr: 'المقارنة بين الفعلي والدفتري ونسب الهدر',
          subEn: 'Physical Cycle Count vs Ledger Variance Analysis',
        };
      case 'PURCHASE_ORDER':
        return {
          ar: 'أمر توريد وشراء رسمي (PO)',
          en: 'OFFICIAL PURCHASE ORDER (PO)',
          subAr: 'قسم المشتريات والعقود وسلاسل الإمداد',
          subEn: 'Procurement & Supply Chain Management',
        };
      case 'MATERIAL_CARD':
        return {
          ar: 'كشف حركة بطاقة الصنف والمخزون',
          en: 'MATERIAL SUBLEDGER STATEMENT CARD',
          subAr: 'سجل الحركات التراكمية والرصيد الدفتري',
          subEn: 'Cumulative Stock In/Out & Balance Ledger',
        };
      case 'INVENTORY_REPORT':
        return {
          ar: 'تقرير جرد وأرصدة وتقييم المخزون',
          en: 'INVENTORY VALUATION & BALANCE REPORT',
          subAr: 'الأرصدة الحالية في كافة المواقع والمستودعات',
          subEn: 'Live Stock Balances Across All Facilities',
        };
      default:
        return {
          ar: 'مستند مخزني رسمي',
          en: 'OFFICIAL WAREHOUSE DOCUMENT',
          subAr: 'إدارة المستودعات',
          subEn: 'Warehouse Management',
        };
    }
  };

  const titles = getDocTitles(data.documentType);
  const totalQty = data.lines.reduce((sum, l) => sum + (l.quantity || 0), 0);
  const totalWeight = data.lines.reduce((sum, l) => sum + (l.weightKG || 0), 0);
  const totalAmount = data.lines.reduce((sum, l) => sum + (l.totalPrice || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-slate-900 border border-white/20 rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:bg-white print:max-h-none print:max-w-none print:w-full">
        {/* Modal Top Control Bar (Hidden on print) */}
        <div className="p-4 bg-slate-950 border-b border-white/10 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <FileText className="w-5 h-5" />
            <span>
              {isRTL ? `معاينة الطباعة: ${data.documentNumber}` : `Document Print Preview: #${data.documentNumber}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-950 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isRTL ? 'طباعة المستند (A4)' : 'Print Document (A4)'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div
          ref={printRef}
          className="flex-1 overflow-y-auto p-8 sm:p-12 bg-white text-slate-900 font-sans print:p-6 print:m-0 print:overflow-visible"
        >
          {/* Header Banner */}
          <div className="border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              {/* Organization Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-slate-900 flex items-center justify-center text-white font-black text-sm">
                    {currentOrganization.nameEn?.slice(0, 2) || 'WH'}
                  </div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {isRTL ? currentOrganization.nameAr : currentOrganization.nameEn}
                  </h1>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  {currentOrganization.industry} • Universal Warehouse Management Platform
                </p>
                <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-1">
                  <span>{currentOrganization.phone || '+964 770 123 4567'}</span>
                  <span>•</span>
                  <span>{currentOrganization.email || 'support@warehouse-saas.com'}</span>
                </div>
              </div>

              {/* Document Identity & QR Verification */}
              <div className="text-end space-y-1">
                <div className="inline-block px-3 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-sm text-slate-900">
                  #{data.documentNumber}
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {isRTL ? 'التاريخ:' : 'Date:'} <span className="font-bold text-slate-800">{data.date}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {isRTL ? 'المستودع:' : 'Facility:'}{' '}
                  <span className="font-bold text-slate-800">{data.warehouseName}</span>
                </div>
              </div>
            </div>

            {/* Document Title Header */}
            <div className="mt-6 pt-4 border-t border-slate-200 text-center">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
                {isRTL ? titles.ar : titles.en}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{isRTL ? titles.subAr : titles.subEn}</p>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-6">
            {data.partyName && (
              <div>
                <span className="block text-slate-500 font-semibold">
                  {data.documentType === 'RECEIPT' || data.documentType === 'PURCHASE_ORDER'
                    ? isRTL
                      ? 'المورد / الجهة:'
                      : 'Supplier / Vendor:'
                    : isRTL
                    ? 'العميل / المستلم:'
                    : 'Recipient / Client:'}
                </span>
                <span className="font-bold text-slate-900">{data.partyName}</span>
              </div>
            )}

            {data.referenceNumber && (
              <div>
                <span className="block text-slate-500 font-semibold">{isRTL ? 'المرجع / السند:' : 'Ref Doc #:'}</span>
                <span className="font-bold font-mono text-slate-900">{data.referenceNumber}</span>
              </div>
            )}

            <div>
              <span className="block text-slate-500 font-semibold">{isRTL ? 'المسؤول / المنفذ:' : 'Issued By:'}</span>
              <span className="font-bold text-slate-900">{data.performedBy}</span>
            </div>

            {data.reason && (
              <div>
                <span className="block text-slate-500 font-semibold">{isRTL ? 'الغرض / السبب:' : 'Reason / Note:'}</span>
                <span className="font-bold text-slate-900">{data.reason}</span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-bold text-start">
                  <th className="p-2.5 text-center w-10">#</th>
                  <th className="p-2.5 text-start">{isRTL ? 'كود الصنف' : 'Item Code'}</th>
                  <th className="p-2.5 text-start">{isRTL ? 'الوصف / اسم الصنف' : 'Description'}</th>
                  <th className="p-2.5 text-center">{isRTL ? 'الموقع' : 'Location'}</th>
                  <th className="p-2.5 text-end">{isRTL ? 'الكمية' : 'Quantity'}</th>
                  <th className="p-2.5 text-center">{isRTL ? 'الوحدة' : 'UOM'}</th>
                  {totalWeight > 0 && <th className="p-2.5 text-end">{isRTL ? 'الوزن (كغم)' : 'Weight (KG)'}</th>}
                  {totalAmount > 0 && <th className="p-2.5 text-end">{isRTL ? 'الإجمالي' : 'Total'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 border-b border-slate-300">
                {data.lines.map((line, idx) => (
                  <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                    <td className="p-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="p-2.5 font-mono font-bold text-slate-900">{line.itemCode}</td>
                    <td className="p-2.5">
                      <div className="font-bold text-slate-900">{line.itemName}</div>
                      {line.batchId && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          {isRTL ? 'تشغيلة:' : 'Batch:'} {line.batchId}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center font-mono">{line.locationCode || '-'}</td>
                    <td className="p-2.5 text-end font-bold font-mono text-slate-900">
                      {line.quantity.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-center text-slate-600">{line.unit}</td>
                    {totalWeight > 0 && (
                      <td className="p-2.5 text-end font-mono">
                        {(line.weightKG || line.quantity).toLocaleString()}
                      </td>
                    )}
                    {totalAmount > 0 && (
                      <td className="p-2.5 text-end font-mono font-bold">
                        {(line.totalPrice || 0).toLocaleString()} {currentOrganization.currency || 'USD'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {/* Grand Totals */}
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                  <td colSpan={4} className="p-2.5 text-end font-bold uppercase tracking-wider">
                    {isRTL ? 'الإجمالي العام للمستند:' : 'Grand Totals:'}
                  </td>
                  <td className="p-2.5 text-end font-mono text-sm text-slate-900">
                    {totalQty.toLocaleString()}
                  </td>
                  <td></td>
                  {totalWeight > 0 && (
                    <td className="p-2.5 text-end font-mono text-sm text-slate-900">
                      {totalWeight.toLocaleString()} KG
                    </td>
                  )}
                  {totalAmount > 0 && (
                    <td className="p-2.5 text-end font-mono text-sm text-slate-900">
                      {totalAmount.toLocaleString()} {currentOrganization.currency || 'USD'}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes / Instructions */}
          {data.notes && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 mb-8">
              <span className="font-bold block mb-0.5">{isRTL ? 'ملاحظات المستند:' : 'Document Notes:'}</span>
              <p>{data.notes}</p>
            </div>
          )}

          {/* Signatures & Approvals (3 Columns) */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-slate-200 text-center text-xs text-slate-700">
            <div className="space-y-12">
              <div className="font-bold text-slate-900">{isRTL ? 'أمين المستودع / المنفذ' : 'Prepared By (Storekeeper)'}</div>
              <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-500">
                {data.performedBy}
              </div>
            </div>

            <div className="space-y-12">
              <div className="font-bold text-slate-900">{isRTL ? 'مدير المستودعات / الاعتماد' : 'Warehouse Manager Approval'}</div>
              <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-500">
                {data.approvedBy || (isRTL ? 'اعتماد النظام الإلكتروني' : 'System Verified')}
              </div>
            </div>

            <div className="space-y-12">
              <div className="font-bold text-slate-900">{isRTL ? 'المستلم / الناقل' : 'Received By / Carrier'}</div>
              <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-500">
                ..........................................
              </div>
            </div>
          </div>

          {/* Footer Security Watermark */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>
              {isRTL
                ? 'مستند نظام إلكتروني صادر عن منصة إدارة المستودعات المركزية • تدقيق مشفر غير قابل للتعديل'
                : 'Universal Warehouse Management SaaS • Immutable Subledger Transaction Record'}
            </span>
            <span>Doc Fingerprint: #{data.documentNumber}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
