import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const translations: Record<string, { ar: string; en: string }> = {
  // App Title & Brand
  appName: {
    ar: 'شركة الكروان لإنتاج الألواح والأكواب البلاستيكية',
    en: 'AL-KARWAN Factory for Plastic Sheets & Cups',
  },
  systemTitle: {
    ar: 'نظام إدارة ومراقبة المصنع والمستودعات | CONTROL SYSTEM',
    en: 'Enterprise Factory & Warehouse Control System',
  },
  shortBrand: {
    ar: 'الكروان - إدارة المصنع',
    en: 'AL-KARWAN CONTROL',
  },

  // Main Actions & Nav
  dashboard: { ar: 'لوحة القيادة والمراقبة', en: 'Command Center' },
  receive: { ar: 'استلام', en: 'Receive' },
  scaleOut: { ar: 'الميزان بعد التفريغ', en: 'Scale Out' },
  unloading: { ar: 'التفريغ', en: 'Unloading' },
  shredIt: { ar: 'الثرم', en: 'Shred It (Therm)' },
  storage: { ar: 'الخزن', en: 'Storage' },
  sendToProduction: { ar: 'صرف للإنتاج', en: 'Send to Production' },
  inventory: { ar: 'المخزون', en: 'Inventory' },
  pendingActions: { ar: 'المعاملات غير المكتملة', en: 'Pending Actions' },
  movementLedger: { ar: 'سجل حركات المخزون', en: 'Movement Ledger' },
  materialCard: { ar: 'بطاقة الصنف', en: 'Material Card' },
  materialsMaster: { ar: 'دليل المواد والأصناف', en: 'Materials Master' },
  suppliers: { ar: 'سجل الموردين', en: 'Suppliers Register' },
  warehouses: { ar: 'المستودعات والمواقع', en: 'Warehouses & Locations' },
  reports: { ar: 'التقارير التحليلية', en: 'Analytical Reports' },
  excelImport: { ar: 'استيراد إكسل', en: 'Excel Import' },
  auditLog: { ar: 'سجل التدقيق والعمليات', en: 'Audit Log' },

  // Factory Terms
  bulkBag: { ar: 'شليف', en: 'Bulk Bag' },
  bulkBags: { ar: 'شلايف', en: 'Bulk Bags' },
  productionDamage: { ar: 'تالف إنتاج', en: 'Production Damage' },
  variance: { ar: 'فرق الثرم / الهدر', en: 'Variance / Loss' },
  netWeight: { ar: 'الوزن الصافي', en: 'Net Weight' },
  scaleInWeight: { ar: 'وزن الدخول (قائم)', en: 'Scale In Weight' },
  scaleOutWeight: { ar: 'وزن الخروج (فارغ)', en: 'Scale Out Weight' },
  unloadWeight: { ar: 'وزن التفريغ المقدر', en: 'Unload Weight' },
  requiresShredding: { ar: 'هل المادة تتطلب ثرم؟', en: 'Requires Shredding?' },
  availableKG: { ar: 'الكمية المتاحة (كغم)', en: 'Available (KG)' },
  reservedKG: { ar: 'الكمية المحجوزة (كغم)', en: 'Reserved (KG)' },
  totalBalanceKG: { ar: 'الرصيد الإجمالي (كغم)', en: 'Total Balance (KG)' },

  // Legacy Documents
  doc167: { ar: 'مستند 167 - صادر مواد خامات', en: 'Doc 167 - Raw Material Issue' },
  doc546: { ar: 'مستند 546 - استلام مواد خامات', en: 'Doc 546 - Raw Material Receipt' },
  doc360: { ar: 'مستند 360 - استلام مخزن الثرم', en: 'Doc 360 - Shredding Store Receipt' },
  doc352: { ar: 'مستند 352 - نقل وحركة مخزن الثرم', en: 'Doc 352 - Shredding Storage Transfer' },
  legacyDocNumber: { ar: 'رقم المستند الدفتري / القديم', en: 'Legacy Document Ref #' },

  // Statuses
  status_Draft: { ar: 'مسودة', en: 'Draft' },
  status_ScaleInCompleted: { ar: 'تم وزن الدخول', en: 'Scale In Completed' },
  status_UnloadingCompleted: { ar: 'تم التفريغ', en: 'Unloading Completed' },
  status_ScaleOutCompleted: { ar: 'تم وزن الخروج', en: 'Scale Out Completed' },
  status_Received: { ar: 'تم الاستلام بنجاح', en: 'Received' },
  status_WaitingForShredding: { ar: 'بانتظار الثرم', en: 'Waiting for Shredding' },
  status_InShredding: { ar: 'قيد عملية الثرم', en: 'In Shredding' },
  status_ShreddingCompleted: { ar: 'اكتمل الثرم', en: 'Shredding Completed' },
  status_ReturnedToStorage: { ar: 'تم الإرجاع للمخزن', en: 'Returned to Storage' },
  status_ReadyForProduction: { ar: 'جاهز للإنتاج', en: 'Ready for Production' },
  status_IssuedToProduction: { ar: 'تم الصرف للإنتاج', en: 'Issued to Production' },
  status_Completed: { ar: 'مكتمل نهائياً', en: 'Completed' },
  status_Cancelled: { ar: 'ملغي', en: 'Cancelled' },

  // Workflow Stages
  stage_truckArrives: { ar: 'وصول الشاحنة', en: 'Truck Arrives' },
  stage_scaleIn: { ar: 'وزن الدخول (قائم)', en: 'Scale In' },
  stage_unloading: { ar: 'تفريغ الحمولة', en: 'Unloading' },
  stage_scaleOut: { ar: 'وزن الخروج (فارغ)', en: 'Scale Out' },
  stage_receiving: { ar: 'تأكيد الاستلام والتوجيه', en: 'Receiving Confirmation' },
  stage_shredding: { ar: 'مرحلة الثرم (THERM)', en: 'Shredding Stage' },
  stage_storage: { ar: 'إيداع بالمستودع', en: 'Warehouse Storage' },
  stage_production: { ar: 'صرف لخط الإنتاج', en: 'Production Issue' },

  // Dashboard Telemetry
  todayReceipts: { ar: 'إرساليات اليوم', en: "Today's Receipts" },
  todayKGReceived: { ar: 'صافي المستلم اليوم (كغم)', en: "Today's Received KG" },
  todayShredding: { ar: 'عمليات الثرم اليوم', en: "Today's Shredding Ops" },
  todayShreddedKG: { ar: 'المثروم اليوم (كغم)', en: "Today's Shredded KG" },
  todayProductionIssues: { ar: 'المنصرف للإنتاج (كغم)', en: "Today's Production Issue" },
  currentInventoryKG: { ar: 'إجمالي المخزون (كغم)', en: 'Total Stock (KG)' },
  bulkBagsInStorage: { ar: 'إجمالي الشلايف بالمخزن', en: 'Bulk Bags in Stock' },
  pendingActionsCount: { ar: 'معاملات غير مكتملة', en: 'Pending Actions' },
  productionDamageTotal: { ar: 'إجمالي تالف الإنتاج', en: 'Total Prod Damage' },
  varianceAlerts: { ar: 'تنبيهات الفروقات', en: 'Variance Alerts' },

  // Common UI
  search: { ar: 'بحث سريع بالرقم أو الصنف أو المورد أو الشاحنة...', en: 'Quick search by Ref, Material, Supplier, Plate...' },
  actions: { ar: 'الإجراءات', en: 'Actions' },
  save: { ar: 'حفظ وتأكيد', en: 'Save & Confirm' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  exportExcel: { ar: 'تصدير إكسل Excel', en: 'Export to Excel' },
  importExcel: { ar: 'استيراد ملف إكسل', en: 'Import Excel' },
  filter: { ar: 'تصفية', en: 'Filter' },
  reset: { ar: 'إعادة تعيين', en: 'Reset' },
  refresh: { ar: 'تحديث البيانات', en: 'Refresh Data' },
  date: { ar: 'التاريخ', en: 'Date' },
  time: { ar: 'الوقت', en: 'Time' },
  operator: { ar: 'المشغل / الموظف', en: 'Operator' },
  supervisor: { ar: 'المشرف المسؤول', en: 'Supervisor' },
  notes: { ar: 'ملاحظات', en: 'Notes' },
  status: { ar: 'الحالة', en: 'Status' },
  priority: { ar: 'الأولوية', en: 'Priority' },
  all: { ar: 'الكل', en: 'All' },
  success: { ar: 'عملية ناجحة', en: 'Operation Successful' },
  error: { ar: 'خطأ بالبيانات', en: 'Validation Error' },
  warning: { ar: 'تحذير تشغيلي', en: 'Operational Warning' },
  material: { ar: 'المادة / الصنف', en: 'Material' },
  materialCode: { ar: 'رمز الصنف', en: 'Material Code' },
  supplier: { ar: 'المورد', en: 'Supplier' },
  vehiclePlate: { ar: 'رقم الشاحنة / المركبة', en: 'Vehicle / Plate #' },
  driverName: { ar: 'اسم السائق', en: 'Driver Name' },
  warehouse: { ar: 'المستودع', en: 'Warehouse' },
  location: { ar: 'الموقع / الرف', en: 'Location / Rack' },
  machineLine: { ar: 'الماكينة / خط الإنتاج', en: 'Machine / Line' },
  productionOrder: { ar: 'أمر الإنتاج', en: 'Production Order' },
  executeAction: { ar: 'استكمال المعاملة', en: 'Resolve Action' },
  viewDetails: { ar: 'عرض التفاصيل', en: 'View Details' },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('alkarwan_language');
    return saved === 'en' ? 'en' : 'ar'; // Default Arabic as requested
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('alkarwan_language', lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language];
    }
    return key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isRTL: language === 'ar',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
