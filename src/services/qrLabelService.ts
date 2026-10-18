import QRCode from 'qrcode';

export interface FloorQrLabelData {
  materialId: string;
  materialCode: string;
  materialNameAr: string;
  materialNameEn: string;
  category: string;
  unit: string;
  batchId: string;
  bagIndex: number;
  totalBags: number;
  weightPerBagKG: number;
  warehouseId: string;
  warehouseNameAr?: string;
  locationId: string;
  locationCode?: string;
  requiresShredding: boolean;
  productionDate: string;
  shift: string;
  operatorName: string;
  notes?: string;
}

export type QrFormatMode = 'JSON' | 'COMPACT_TEXT';

/**
 * Encodes label information into a machine-readable payload for scanners
 */
export function buildQrPayload(label: FloorQrLabelData, mode: QrFormatMode = 'JSON'): string {
  if (mode === 'JSON') {
    return JSON.stringify({
      org: 'AL-KARWAN',
      system: 'FACTORY_TRACKING',
      matCode: label.materialCode,
      matName: label.materialNameAr,
      category: label.category,
      batchId: label.batchId,
      bag: `${label.bagIndex.toString().padStart(2, '0')}/${label.totalBags.toString().padStart(2, '0')}`,
      weightKG: label.weightPerBagKG,
      unit: label.unit,
      wh: label.warehouseId,
      loc: label.locationCode || label.locationId,
      shred: label.requiresShredding ? 'YES' : 'NO',
      date: label.productionDate,
      shift: label.shift,
      op: label.operatorName,
      v: '1.0',
    });
  }

  // Compact format for simple barcode readers & camera apps
  return `AL-KARWAN | ${label.materialCode} | ${label.materialNameAr} | BATCH:${label.batchId} | BAG:${label.bagIndex}/${label.totalBags} | ${label.weightPerBagKG}KG | LOC:${label.warehouseId}-${label.locationCode || label.locationId} | ${label.productionDate}`;
}

/**
 * Generates high-contrast QR code data URL (PNG)
 */
export async function generateQrCodeDataUrl(
  text: string,
  width: number = 250
): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    return '';
  }
}

/**
 * Creates a standard factory floor batch ID: LOT-[CODE]-[YYMMDD]-[SEQ]
 */
export function generateFactoryBatchId(materialCode: string, customSeq?: number): string {
  const cleanCode = materialCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4);
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const seq = (customSeq ?? (now.getHours() * 60 + now.getMinutes()) % 99 + 1)
    .toString()
    .padStart(2, '0');
  return `LOT-${cleanCode}-${yy}${mm}${dd}-${seq}`;
}
