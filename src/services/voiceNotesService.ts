import { WarehouseVoiceNote } from '../types';

const STORAGE_KEY = 'factory_warehouse_voice_notes_v1';

export const INITIAL_VOICE_NOTES: WarehouseVoiceNote[] = [
  {
    id: 'vn-20260902-001',
    timestamp: '2026-09-02 07:45:00',
    date: '2026-09-02',
    shift: 'Morning Shift',
    operator: 'علي الكرخي (مشرف استلام)',
    category: 'INVENTORY_MOVEMENT',
    title: 'نقل بالات سكراب من ساحة الفرز إلى ماكينة الثرم 01',
    content: 'تم نقل 4 بالات سكراب أكواب بطل خام وزن تقديري 4,800 كغم من ساحة الفرز الخارجية إلى قمع تغذية الثرامة الثقيلة 01. الحالة ممتازة وبدأت دورة الثرم فوراً.',
    locationFrom: 'ساحة الفرز الخارجية (Holding Yard)',
    locationTo: 'ماكينة الثرم 01 (Therm Line 01)',
    materialName: 'سكراب أكواب وبالات خام (PET/PP)',
    quantityKG: 4800,
    bulkBagsCount: 4,
    audioLengthSeconds: 16,
    status: 'CONFIRMED',
    createdAt: '2026-09-02T07:45:00Z',
  },
  {
    id: 'vn-20260902-002',
    timestamp: '2026-09-02 11:20:00',
    date: '2026-09-02',
    shift: 'Morning Shift',
    operator: 'حيدر الجبوري (أمين مستودع WH-02)',
    category: 'INVENTORY_MOVEMENT',
    title: 'إيداع 5 شلايف مفروم ناعم في صوامع التخزين',
    content: 'تم استلام وتعبئة 5 شلايف مفروم شيت مجروش ناتج الثرم وجرى وزنها وتخزينها في صوامع القطاع B بمستودع WH-02 مع وضع باركود الدفعة 360.',
    locationFrom: 'خط الجرش والتحبيب 02',
    locationTo: 'مستودع المفروم WH-02 (Silo B-02)',
    materialName: 'مفروم هوالك رولات شيت (HIPS Flakes)',
    quantityKG: 5250,
    bulkBagsCount: 5,
    audioLengthSeconds: 22,
    status: 'CONFIRMED',
    createdAt: '2026-09-02T11:20:00Z',
  },
  {
    id: 'vn-20260902-003',
    timestamp: '2026-09-02 14:15:00',
    date: '2026-09-02',
    shift: 'Morning Shift',
    operator: 'عمار عبد الزهرة (رئيس الوردية الصباحية)',
    category: 'SHIFT_HANDOVER',
    title: 'محضر تسليم الوردية الصباحية إلى المسائية',
    content: 'تم إنجاز خطة ثرم البال كاملة بإنتاج 28.5 طن مفروم. خطوط البثق 1 و 2 استلمت 18.2 طن دون توقف. تم تسليم ساحة الفرز نظيفة ومستوى الصوامع في المستودع الثاني عند 72%. يرجى متابعة تفريغ الشاحنة القادمة رقم 546.',
    locationFrom: 'كافة قطاعات المصنع',
    locationTo: 'الوردية المسائية (Evening Shift)',
    materialName: 'تقرير شامل للوردية',
    quantityKG: 28500,
    bulkBagsCount: 26,
    audioLengthSeconds: 38,
    status: 'CONFIRMED',
    createdAt: '2026-09-02T14:15:00Z',
  },
  {
    id: 'vn-20260902-004',
    timestamp: '2026-09-02 16:30:00',
    date: '2026-09-02',
    shift: 'Evening Shift',
    operator: 'فاضل الساعدي (مشرف الإنتاج)',
    category: 'OPERATIONAL_ALERT',
    title: 'تنبيه: فحص نسبة رطوبة شلايف المستودع WH-02 قبل البثق',
    content: 'لوحظ وجود نسبة رطوبة طفيفة في دفعة المفروم رقم 89 المغذية لمجفف خط التشكيل. تم توجيه عمال الخزن بإبقاء الشلايف تحت مراوح التهوية لمدة ساعتين إضافيتين.',
    locationFrom: 'مستودع المفروم WH-02',
    locationTo: 'خط التشكيل الحراري (Thermoforming)',
    materialName: 'شلايف مفرومة مجففة',
    quantityKG: 2200,
    bulkBagsCount: 2,
    audioLengthSeconds: 19,
    status: 'PENDING_REVIEW',
    createdAt: '2026-09-02T16:30:00Z',
  },
];

export const getStoredVoiceNotes = (): WarehouseVoiceNote[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_VOICE_NOTES));
      return INITIAL_VOICE_NOTES;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load voice notes from localStorage:', err);
    return INITIAL_VOICE_NOTES;
  }
};

export const saveVoiceNote = (note: Omit<WarehouseVoiceNote, 'id' | 'createdAt'>): WarehouseVoiceNote => {
  const notes = getStoredVoiceNotes();
  const id = `vn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newNote: WarehouseVoiceNote = {
    ...note,
    id,
    createdAt: new Date().toISOString(),
  };

  const updated = [newNote, ...notes];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save voice note:', err);
  }
  return newNote;
};

export const deleteVoiceNote = (id: string): boolean => {
  const notes = getStoredVoiceNotes();
  const updated = notes.filter((n) => n.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
};

export const updateVoiceNoteStatus = (
  id: string,
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'RESOLVED'
): boolean => {
  const notes = getStoredVoiceNotes();
  const updated = notes.map((n) => (n.id === id ? { ...n, status } : n));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
};
