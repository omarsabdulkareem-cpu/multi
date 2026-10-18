import * as XLSX from 'xlsx';
import { FactoryMachine, MaintenanceLogTask, MachineStatus, MaintenanceTaskType, UserProfile } from '../types';
export type { FactoryMachine, MaintenanceLogTask, MachineStatus, MaintenanceTaskType };

const STORAGE_KEY_MACHINES = 'alkarwan_factory_machinery_v1';
const STORAGE_KEY_LOGS = 'alkarwan_maintenance_logs_v1';

export const INITIAL_MACHINES: FactoryMachine[] = [
  {
    id: 'MCH-EXT-01',
    code: 'EXT-01',
    nameEn: 'Plastic Sheet Extrusion Line 01',
    nameAr: 'خط بثق الألواح البلاستيكية 01',
    category: 'EXTRUSION',
    sectionEn: 'Extrusion Hall A',
    sectionAr: 'صالة البثق الرئيسية A',
    currentOperatingHours: 2492,
    maintenanceThresholdHours: 2500,
    intervalHours: 500,
    status: 'RUNNING',
    lastMaintenanceDate: '2026-08-10',
    lastMaintenanceHours: 2000,
    assignedTechnician: 'Hassan Al-Tamimi',
    manufacturer: 'Battenfeld-Cincinnati',
    modelNumber: 'BEX-90-30D',
    serialNumber: 'SN-2022-EXT-889',
    installationDate: '2022-03-15',
    criticality: 'CRITICAL',
  },
  {
    id: 'MCH-SHR-01',
    code: 'SHR-360',
    nameEn: 'Heavy Granulator & Shredder 360',
    nameAr: 'مفرمة ومجرشة الحبيبات والبلاستيك 360',
    category: 'SHREDDING',
    sectionEn: 'Shredding & Regrind Bay 1',
    sectionAr: 'وحدة الثرم والجرش رقم 1 (المستودع 02)',
    currentOperatingHours: 1515,
    maintenanceThresholdHours: 1500,
    intervalHours: 300,
    status: 'MAINTENANCE_DUE',
    lastMaintenanceDate: '2026-07-28',
    lastMaintenanceHours: 1200,
    assignedTechnician: 'Karrar Mansoor',
    manufacturer: 'Zerma Recycling Tech',
    modelNumber: 'GSL-300/400-HD',
    serialNumber: 'SN-2021-ZER-441',
    installationDate: '2021-09-20',
    criticality: 'CRITICAL',
  },
  {
    id: 'MCH-FRM-01',
    code: 'FRM-01',
    nameEn: 'Cup Thermoforming Machine 01',
    nameAr: 'ماكينة التشكيل الحراري للأكواب 01',
    category: 'THERMOFORMING',
    sectionEn: 'Thermoforming Hall B',
    sectionAr: 'صالة التشكيل الحراري للأكواب B',
    currentOperatingHours: 3790,
    maintenanceThresholdHours: 4000,
    intervalHours: 500,
    status: 'RUNNING',
    lastMaintenanceDate: '2026-08-01',
    lastMaintenanceHours: 3500,
    assignedTechnician: 'Mustafa Jabbar',
    manufacturer: 'Illig Maschinenbau',
    modelNumber: 'RDM-70K High-Speed',
    serialNumber: 'SN-2023-ILG-102',
    installationDate: '2023-01-10',
    criticality: 'HIGH',
  },
  {
    id: 'MCH-EXT-02',
    code: 'EXT-02',
    nameEn: 'Plastic Sheet Extrusion Line 02',
    nameAr: 'خط بثق الألواح البلاستيكية 02',
    category: 'EXTRUSION',
    sectionEn: 'Extrusion Hall A',
    sectionAr: 'صالة البثق الرئيسية A',
    currentOperatingHours: 1840,
    maintenanceThresholdHours: 2000,
    intervalHours: 500,
    status: 'RUNNING',
    lastMaintenanceDate: '2026-07-15',
    lastMaintenanceHours: 1500,
    assignedTechnician: 'Hassan Al-Tamimi',
    manufacturer: 'Amut Extrusion Group',
    modelNumber: 'EA-75 Co-Extrusion',
    serialNumber: 'SN-2023-AMT-551',
    installationDate: '2023-06-12',
    criticality: 'HIGH',
  },
  {
    id: 'MCH-CMP-01',
    code: 'CMP-75',
    nameEn: 'Central Rotary Screw Air Compressor',
    nameAr: 'ضاغط الهواء الحلزوني المركزي 75kW',
    category: 'UTILITY',
    sectionEn: 'Utilities & Power House',
    sectionAr: 'محطة الخدمات والمرافق المركزية',
    currentOperatingHours: 4998,
    maintenanceThresholdHours: 5000,
    intervalHours: 1000,
    status: 'RUNNING',
    lastMaintenanceDate: '2026-06-10',
    lastMaintenanceHours: 4000,
    assignedTechnician: 'Amir Al-Saadi',
    manufacturer: 'Atlas Copco',
    modelNumber: 'GA-75-VSD+ FF',
    serialNumber: 'SN-2020-ATL-992',
    installationDate: '2020-11-05',
    criticality: 'CRITICAL',
  },
  {
    id: 'MCH-CHL-01',
    code: 'CHL-120',
    nameEn: 'Industrial Water Chiller 120-TR',
    nameAr: 'وحدة تبريد المياه الصناعية - التشيلر 120 طن',
    category: 'UTILITY',
    sectionEn: 'Utilities & Cooling Yard',
    sectionAr: 'ساحة التبريد الصناعي والتشيلرات',
    currentOperatingHours: 2120,
    maintenanceThresholdHours: 2500,
    intervalHours: 500,
    status: 'RUNNING',
    lastMaintenanceDate: '2026-07-01',
    lastMaintenanceHours: 2000,
    assignedTechnician: 'Amir Al-Saadi',
    manufacturer: 'Carrier Industrial',
    modelNumber: 'AquaForce 30XA-120',
    serialNumber: 'SN-2021-CAR-310',
    installationDate: '2021-04-18',
    criticality: 'HIGH',
  },
  {
    id: 'MCH-SCL-01',
    code: 'SCL-546',
    nameEn: 'Electronic Weighbridge Scale 546',
    nameAr: 'ميزان الشاحنات والقباب الإلكتروني 80 طن (546)',
    category: 'SCALE',
    sectionEn: 'Main Ingress Gate & Weighbridge',
    sectionAr: 'بوابة الدخول الرئيسية وميزان الشاحنات',
    currentOperatingHours: 1195,
    maintenanceThresholdHours: 1200,
    intervalHours: 600,
    status: 'RUNNING',
    lastMaintenanceDate: '2026-06-25',
    lastMaintenanceHours: 600,
    assignedTechnician: 'Eng. Tariq Al-Bayati',
    manufacturer: 'Avery Weigh-Tronix',
    modelNumber: 'BridgeMont BMS-80T',
    serialNumber: 'SN-2022-AVW-546',
    installationDate: '2022-01-10',
    criticality: 'HIGH',
  },
];

export const INITIAL_MAINTENANCE_LOGS: MaintenanceLogTask[] = [
  {
    id: 'MNT-LOG-101',
    machineId: 'MCH-EXT-01',
    machineNameEn: 'Plastic Sheet Extrusion Line 01',
    machineNameAr: 'خط بثق الألواح البلاستيكية 01',
    taskTitleEn: '2000-Hour Hydraulic Oil Flush & Barrel Thermocouple Check',
    taskTitleAr: 'صيانة دورية 2000 ساعة: تبديل زيت الهيدروليك وفحص حساسات الحرارة',
    taskType: 'PREVENTIVE',
    operatingHoursAtService: 2000,
    previousThresholdHours: 2000,
    newThresholdHours: 2500,
    completedDate: '2026-08-10',
    completedTime: '14:30',
    performedBy: 'Hassan Al-Tamimi',
    supervisorSignOff: 'Omar Abdulkarim (Supervisor)',
    downtimeHours: 3.5,
    partsReplacedEn: 'Mobil DTE 25 Hydraulic Oil (60L), High-Pressure Filter Cartridge, Thermocouple Type J x2',
    partsReplacedAr: 'زيت هيدروليك موبيل 60 لتر، فلتر ضغط عالي، حساسات حرارة مزدوجة',
    totalCostUSD: 480,
    notesEn: 'All extruder zone heating elements tested nominal. Hydraulic pressure calibrated to 180 bar.',
    notesAr: 'تم فحص مناطق التسخين بالكامل والمعايرة عند 180 بار، الحالة ممتازة.',
    status: 'VERIFIED',
  },
  {
    id: 'MNT-LOG-102',
    machineId: 'MCH-SHR-01',
    machineNameEn: 'Heavy Granulator & Shredder 360',
    machineNameAr: 'مفرمة ومجرشة الحبيبات والبلاستيك 360',
    taskTitleEn: 'Rotor Knife Sharpening & Heavy Bearing Lubrication',
    taskTitleAr: 'شحذ سكاكين الدوار وتشحيم المحامل الثقيلة المقاومة للصدمات',
    taskType: 'LUBRICATION',
    operatingHoursAtService: 1200,
    previousThresholdHours: 1200,
    newThresholdHours: 1500,
    completedDate: '2026-07-28',
    completedTime: '11:15',
    performedBy: 'Karrar Mansoor',
    supervisorSignOff: 'Ahmed Khalil (Warehouse Manager)',
    downtimeHours: 4.0,
    partsReplacedEn: 'Rotary Blades D2 Steel x4, SKF Heavy Lithium Grease LGHP 2 (5kg)',
    partsReplacedAr: 'شفرات دوارة فولاذ D2 عدد 4، شحم ليثيوم SKF عالي التحمل 5 كغم',
    totalCostUSD: 620,
    notesEn: 'Blade clearance adjusted to 0.25mm for optimal regrind consistency on Document 360 runs.',
    notesAr: 'تم ضبط الخلوص عند 0.25 ملم لضمان جودة الحبيبات المفرومة للمستند 360.',
    status: 'VERIFIED',
  },
  {
    id: 'MNT-LOG-103',
    machineId: 'MCH-FRM-01',
    machineNameEn: 'Cup Thermoforming Machine 01',
    machineNameAr: 'ماكينة التشكيل الحراري للأكواب 01',
    taskTitleEn: 'Forming Station Vacuum Seal & Pneumatic Valve Replacement',
    taskTitleAr: 'استبدال حشوات الفاكيوم وصمامات الهواء لمحطة التشكيل',
    taskType: 'CORRECTIVE',
    operatingHoursAtService: 3500,
    previousThresholdHours: 3500,
    newThresholdHours: 4000,
    completedDate: '2026-08-01',
    completedTime: '16:45',
    performedBy: 'Mustafa Jabbar',
    supervisorSignOff: 'Omar Abdulkarim (Supervisor)',
    downtimeHours: 2.0,
    partsReplacedEn: 'Festo Solenoid Valve 5/2-Way, Silicone Vacuum Seal Gasket Set',
    partsReplacedAr: 'صمام فيستو كهربائي، طقم حشوات سيليكون هوائي',
    totalCostUSD: 310,
    notesEn: 'Forming cycle speed restored to 34 cycles/min without vacuum leakage.',
    notesAr: 'تمت استعادة سرعة القولبة إلى 34 دورة بالدقيقة بدون أي تسريب.',
    status: 'VERIFIED',
  },
  {
    id: 'MNT-LOG-104',
    machineId: 'MCH-SCL-01',
    machineNameEn: 'Electronic Weighbridge Scale 546',
    machineNameAr: 'ميزان الشاحنات والقباب الإلكتروني 80 طن (546)',
    taskTitleEn: 'Quarterly Metrological Calibration & Digital Load Cell Check',
    taskTitleAr: 'المعايرة المترولوجية الربع سنوية وفحص خلايا الوزن الرقمية',
    taskType: 'CALIBRATION',
    operatingHoursAtService: 600,
    previousThresholdHours: 600,
    newThresholdHours: 1200,
    completedDate: '2026-06-25',
    completedTime: '09:00',
    performedBy: 'Eng. Tariq Al-Bayati',
    supervisorSignOff: 'Omar Abdulkarim (Supervisor)',
    downtimeHours: 1.5,
    partsReplacedEn: 'Surge Protection Module, Junction Box Moisture Desiccant',
    partsReplacedAr: 'وحدة حماية من الصواعق، مجفف رطوبة لصندوق التوصيل',
    totalCostUSD: 180,
    notesEn: 'Calibrated with 20-ton certified test truck. Error margin < 0.012% across all 8 load cells.',
    notesAr: 'تمت المعايرة بشاحنة أوزان معتمدة 20 طن ونسبة الخطأ أقل من 0.012%.',
    status: 'VERIFIED',
  },
];

export function getStoredMachines(): FactoryMachine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MACHINES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_MACHINES, JSON.stringify(INITIAL_MACHINES));
      return INITIAL_MACHINES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MACHINES;
  } catch (err) {
    console.error('Error reading machines from localStorage:', err);
    return INITIAL_MACHINES;
  }
}

export function saveMachines(machines: FactoryMachine[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MACHINES, JSON.stringify(machines));
  } catch (err) {
    console.error('Error saving machines to localStorage:', err);
  }
}

export function getStoredMaintenanceLogs(): MaintenanceLogTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(INITIAL_MAINTENANCE_LOGS));
      return INITIAL_MAINTENANCE_LOGS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MAINTENANCE_LOGS;
  } catch (err) {
    console.error('Error reading maintenance logs from localStorage:', err);
    return INITIAL_MAINTENANCE_LOGS;
  }
}

export function saveMaintenanceLogs(logs: MaintenanceLogTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  } catch (err) {
    console.error('Error saving maintenance logs to localStorage:', err);
  }
}

/**
 * Recalculate status of machine based on operating hours vs threshold
 */
export function computeMachineStatus(currentHours: number, thresholdHours: number, currentStatus: MachineStatus): MachineStatus {
  if (currentStatus === 'UNDER_MAINTENANCE' || currentStatus === 'STANDBY' || currentStatus === 'DECOMMISSIONED') {
    return currentStatus;
  }
  if (currentHours >= thresholdHours) {
    return 'MAINTENANCE_DUE';
  }
  return 'RUNNING';
}

/**
 * Increment machine operating hours (e.g. at the end of a shift or simulation)
 */
export function addMachineOperatingHours(
  machineId: string,
  hoursToAdd: number,
  currentUser: UserProfile
): { updatedMachine: FactoryMachine; allMachines: FactoryMachine[]; statusChangedToDue: boolean } {
  const currentMachines = getStoredMachines();
  let statusChangedToDue = false;

  const updatedMachines = currentMachines.map((m) => {
    if (m.id === machineId) {
      const newHours = Math.max(0, m.currentOperatingHours + hoursToAdd);
      const prevStatus = m.status;
      const newStatus = computeMachineStatus(newHours, m.maintenanceThresholdHours, m.status);

      if (prevStatus !== 'MAINTENANCE_DUE' && newStatus === 'MAINTENANCE_DUE') {
        statusChangedToDue = true;
      }

      return {
        ...m,
        currentOperatingHours: newHours,
        status: newStatus,
      };
    }
    return m;
  });

  saveMachines(updatedMachines);
  const updatedMachine = updatedMachines.find((m) => m.id === machineId)!;
  return { updatedMachine, allMachines: updatedMachines, statusChangedToDue };
}

/**
 * Set custom operating threshold for a machine
 */
export function setMachineOperatingThreshold(
  machineId: string,
  newThreshold: number,
  newInterval?: number
): { updatedMachine: FactoryMachine; allMachines: FactoryMachine[] } {
  const currentMachines = getStoredMachines();

  const updatedMachines = currentMachines.map((m) => {
    if (m.id === machineId) {
      const interval = newInterval || m.intervalHours;
      const newStatus = computeMachineStatus(m.currentOperatingHours, newThreshold, m.status);
      return {
        ...m,
        maintenanceThresholdHours: newThreshold,
        intervalHours: interval,
        status: newStatus,
      };
    }
    return m;
  });

  saveMachines(updatedMachines);
  const updatedMachine = updatedMachines.find((m) => m.id === machineId)!;
  return { updatedMachine, allMachines: updatedMachines };
}

/**
 * Log a completed maintenance task, advance machine threshold, and reset status to RUNNING
 */
export function logCompletedMaintenanceTask(
  taskInput: {
    machineId: string;
    taskTitleEn: string;
    taskTitleAr: string;
    taskType: MaintenanceTaskType;
    downtimeHours: number;
    performedBy: string;
    supervisorSignOff: string;
    partsReplacedEn?: string;
    partsReplacedAr?: string;
    totalCostUSD?: number;
    notesEn?: string;
    notesAr?: string;
    customNextThresholdHours?: number;
  }
): { newTask: MaintenanceLogTask; updatedMachine: FactoryMachine; allLogs: MaintenanceLogTask[]; allMachines: FactoryMachine[] } {
  const currentMachines = getStoredMachines();
  const currentLogs = getStoredMaintenanceLogs();

  const machine = currentMachines.find((m) => m.id === taskInput.machineId);
  if (!machine) {
    throw new Error(`Machine ${taskInput.machineId} not found`);
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);

  const prevThreshold = machine.maintenanceThresholdHours;
  const nextThreshold = taskInput.customNextThresholdHours || (machine.currentOperatingHours + machine.intervalHours);

  const newTask: MaintenanceLogTask = {
    id: `MNT-LOG-${Date.now().toString().slice(-6)}`,
    machineId: machine.id,
    machineNameEn: machine.nameEn,
    machineNameAr: machine.nameAr,
    taskTitleEn: taskInput.taskTitleEn,
    taskTitleAr: taskInput.taskTitleAr,
    taskType: taskInput.taskType,
    operatingHoursAtService: machine.currentOperatingHours,
    previousThresholdHours: prevThreshold,
    newThresholdHours: nextThreshold,
    completedDate: dateStr,
    completedTime: timeStr,
    performedBy: taskInput.performedBy,
    supervisorSignOff: taskInput.supervisorSignOff,
    downtimeHours: taskInput.downtimeHours,
    partsReplacedEn: taskInput.partsReplacedEn || '—',
    partsReplacedAr: taskInput.partsReplacedAr || '—',
    totalCostUSD: taskInput.totalCostUSD || 0,
    notesEn: taskInput.notesEn || '',
    notesAr: taskInput.notesAr || '',
    status: 'COMPLETED',
  };

  const updatedMachines = currentMachines.map((m) => {
    if (m.id === machine.id) {
      return {
        ...m,
        lastMaintenanceDate: dateStr,
        lastMaintenanceHours: m.currentOperatingHours,
        maintenanceThresholdHours: nextThreshold,
        status: 'RUNNING' as MachineStatus,
      };
    }
    return m;
  });

  const updatedLogs = [newTask, ...currentLogs];

  saveMachines(updatedMachines);
  saveMaintenanceLogs(updatedLogs);

  const updatedMachine = updatedMachines.find((m) => m.id === machine.id)!;

  return {
    newTask,
    updatedMachine,
    allLogs: updatedLogs,
    allMachines: updatedMachines,
  };
}

/**
 * Get aggregated alerts summary for supervisors
 */
export function getMaintenanceAlertsSummary(machines: FactoryMachine[]) {
  const overdueMachines = machines.filter((m) => m.currentOperatingHours >= m.maintenanceThresholdHours);
  const nearThresholdMachines = machines.filter(
    (m) =>
      m.currentOperatingHours < m.maintenanceThresholdHours &&
      m.currentOperatingHours >= m.maintenanceThresholdHours * 0.9
  );
  const runningNormal = machines.filter(
    (m) =>
      m.status === 'RUNNING' &&
      m.currentOperatingHours < m.maintenanceThresholdHours * 0.9
  );
  const underMaintenance = machines.filter((m) => m.status === 'UNDER_MAINTENANCE');

  return {
    overdueCount: overdueMachines.length,
    nearThresholdCount: nearThresholdMachines.length,
    totalAlertsCount: overdueMachines.length + nearThresholdMachines.length,
    runningCount: runningNormal.length,
    underMaintenanceCount: underMaintenance.length,
    overdueMachines,
    nearThresholdMachines,
  };
}

/**
 * Export Maintenance Ledger & Machinery Register to Excel
 */
export function exportMaintenanceReportToExcel(
  machines: FactoryMachine[],
  logs: MaintenanceLogTask[],
  adminUser: UserProfile
): { fileName: string; recordCount: number } {
  const dateStr = new Date().toISOString().split('T')[0];

  // 1. Sheet: Machinery Status & Thresholds
  const machineryRows = machines.map((m, idx) => {
    const hoursRemaining = m.maintenanceThresholdHours - m.currentOperatingHours;
    const progressPct = Math.round((m.currentOperatingHours / m.maintenanceThresholdHours) * 100);
    return {
      '#': idx + 1,
      'Machine ID / المعرف': m.id,
      'Code / الكود': m.code,
      'Machine Name (Arabic) / اسم الماكينة': m.nameAr,
      'Machine Name (English)': m.nameEn,
      'Category / الفئة': m.category,
      'Section / الموقع': m.sectionAr,
      'Current Hours / ساعات التشغيل': m.currentOperatingHours,
      'Threshold Hours / حد الصيانة': m.maintenanceThresholdHours,
      'Hours Remaining / المتبقي': hoursRemaining > 0 ? hoursRemaining : 0,
      'Threshold Reached / نسبة الاستهلاك': `${progressPct}%`,
      'Status / الحالة': m.currentOperatingHours >= m.maintenanceThresholdHours ? 'OVERDUE / واجبة الصيانة' : m.status,
      'Interval / الدورة': `Every ${m.intervalHours} hrs`,
      'Last Maintenance Date / آخر صيانة': m.lastMaintenanceDate,
      'Last Maintenance Hours / ساعات آخر صيانة': m.lastMaintenanceHours,
      'Assigned Technician / الفني المسؤول': m.assignedTechnician,
      'Criticality / الأهمية': m.criticality,
    };
  });

  // 2. Sheet: Completed Maintenance Tasks Log
  const logRows = logs.map((log, idx) => ({
    '#': idx + 1,
    'Log ID / رقم السجل': log.id,
    'Machine ID / الماكينة': log.machineId,
    'Machine Name / الاسم': log.machineNameAr,
    'Task Title / بيان الصيانة': log.taskTitleAr,
    'Task Title (EN)': log.taskTitleEn,
    'Type / النوع': log.taskType,
    'Service Hours / ساعات التشغيل عند الصيانة': log.operatingHoursAtService,
    'Previous Threshold / الحد السابق': log.previousThresholdHours,
    'New Threshold / الحد الجديد': log.newThresholdHours,
    'Date / التاريخ': log.completedDate,
    'Time / الوقت': log.completedTime,
    'Performed By / المنفذ': log.performedBy,
    'Supervisor Sign-off / اعتماد المشرف': log.supervisorSignOff,
    'Downtime (Hrs) / التوقف': log.downtimeHours,
    'Parts Replaced / القطع المستبدلة': log.partsReplacedAr || '—',
    'Total Cost USD / التكلفة': log.totalCostUSD || 0,
    'Notes / الملاحظات': log.notesAr || log.notesEn || '—',
    'Status / الحالة': log.status,
  }));

  // 3. Construct Workbook
  const wb = XLSX.utils.book_new();
  const wsMachines = XLSX.utils.json_to_sheet(machineryRows);
  const wsLogs = XLSX.utils.json_to_sheet(logRows);

  wsMachines['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 10 }, { wch: 32 }, { wch: 28 },
    { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 20 }, { wch: 12 }
  ];

  wsLogs['!cols'] = [
    { wch: 4 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 36 },
    { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 24 }, { wch: 10 },
    { wch: 30 }, { wch: 12 }, { wch: 24 }, { wch: 12 }
  ];

  XLSX.utils.book_append_sheet(wb, wsMachines, 'Machinery Register');
  XLSX.utils.book_append_sheet(wb, wsLogs, 'Completed Maintenance Log');

  const fileName = `AlKarwan_Machinery_Maintenance_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return { fileName, recordCount: logs.length };
}
