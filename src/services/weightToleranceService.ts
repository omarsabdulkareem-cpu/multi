/**
 * AL-KARWAN FACTORY CONTROL SYSTEM
 * Real-Time Scale Weight Threshold & Tolerance Monitoring Service
 * 
 * Defines and evaluates production tolerances for:
 * 1. 'Receiving' Stage: Gross weighbridge intake, empty tare, certified net weight, and bag densities.
 * 2. 'Shredding' Stage: Granulator batch size, mass balance conservation, process loss %, and production damage %.
 */

export interface WeightTolerances {
  // Receiving Stage Limits
  minGrossWeightKG: number; // Minimum plausible loaded truck weight (e.g. 8,000 KG)
  maxGrossWeightKG: number; // Maximum axle / scale capacity limit (e.g. 48,000 KG)
  minTareWeightKG: number; // Minimum empty truck weight (e.g. 3,500 KG)
  maxTareWeightKG: number; // Maximum tare weight (e.g. 16,000 KG)
  minNetWeightKG: number; // Minimum net load per shipment (e.g. 2,500 KG)
  minBagAverageWeightKG: number; // Minimum weight per bulk bag (e.g. 400 KG)
  maxBagAverageWeightKG: number; // Maximum standard jumbo bag capacity (e.g. 1,300 KG)
  maxSupplierDiscrepancyPct: number; // Max allowed discrepancy vs delivery invoice (e.g. ±2.0%)

  // Shredding Stage Limits
  minInputBatchKG: number; // Minimum batch size for rotor thermal efficiency (e.g. 500 KG)
  maxInputBatchKG: number; // Maximum single granulator load (e.g. 10,000 KG)
  warningShreddingLossPct: number; // Warning threshold for material loss/variance (e.g. 2.5%)
  criticalShreddingLossPct: number; // Critical alarm threshold for process loss (e.g. 4.0%)
  maxProductionDamagePct: number; // Maximum acceptable production damage percentage (e.g. 2.5%)
  maxNegativeVariancePct: number; // Unphysical mass creation limit (e.g. -0.5%)

  // System Controls
  soundAlertEnabled: boolean;
}

export const DEFAULT_WEIGHT_TOLERANCES: WeightTolerances = {
  // Receiving defaults
  minGrossWeightKG: 8000,
  maxGrossWeightKG: 48000,
  minTareWeightKG: 3500,
  maxTareWeightKG: 16000,
  minNetWeightKG: 2500,
  minBagAverageWeightKG: 400,
  maxBagAverageWeightKG: 1300,
  maxSupplierDiscrepancyPct: 2.0,

  // Shredding defaults
  minInputBatchKG: 500,
  maxInputBatchKG: 10000,
  warningShreddingLossPct: 2.5,
  criticalShreddingLossPct: 4.0,
  maxProductionDamagePct: 2.5,
  maxNegativeVariancePct: -0.5,

  // Audio trigger
  soundAlertEnabled: true,
};

const TOLERANCE_STORAGE_KEY = 'alkarwan_weight_production_tolerances_v1';

export function loadWeightTolerances(): WeightTolerances {
  try {
    const raw = localStorage.getItem(TOLERANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_WEIGHT_TOLERANCES,
        ...parsed,
      };
    }
  } catch (err) {
    console.warn('Failed to load weight tolerances from localStorage', err);
  }
  return DEFAULT_WEIGHT_TOLERANCES;
}

export function saveWeightTolerances(tolerances: WeightTolerances): void {
  try {
    localStorage.setItem(TOLERANCE_STORAGE_KEY, JSON.stringify(tolerances));
  } catch (err) {
    console.warn('Failed to save weight tolerances to localStorage', err);
  }
}

export type ToleranceSeverity = 'NORMAL' | 'WARNING' | 'CRITICAL';

export interface ToleranceAlertItem {
  id: string;
  stage: 'RECEIVING' | 'SHREDDING';
  metric: string;
  metricAr: string;
  severity: ToleranceSeverity;
  actualValue: number;
  unit: string;
  minAllowed: number;
  maxAllowed: number;
  deviationValue: number;
  deviationPct: number;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  recommendationAr: string;
  recommendationEn: string;
  timestamp: string;
}

export interface ToleranceEvaluationReport {
  stage: 'RECEIVING' | 'SHREDDING';
  overallSeverity: ToleranceSeverity;
  hasDeviation: boolean;
  alerts: ToleranceAlertItem[];
  evaluatedAt: string;
  summaryAr: string;
  summaryEn: string;
}

/**
 * Real-time evaluator for Receiving stage scale readings (Gross, Tare, Net, Bags)
 */
export function evaluateReceivingWeightTolerances(
  params: {
    scaleInWeightKG?: number;
    scaleOutWeightKG?: number;
    bulkBagsCount?: number;
    invoiceNetWeightKG?: number;
  },
  customTolerances?: WeightTolerances
): ToleranceEvaluationReport {
  const tolerances = customTolerances || loadWeightTolerances();
  const alerts: ToleranceAlertItem[] = [];
  const now = new Date().toISOString();

  const scaleIn = params.scaleInWeightKG ? Number(params.scaleInWeightKG) : 0;
  const scaleOut = params.scaleOutWeightKG ? Number(params.scaleOutWeightKG) : 0;
  const bags = params.bulkBagsCount ? Number(params.bulkBagsCount) : 0;
  const invoiceNet = params.invoiceNetWeightKG ? Number(params.invoiceNetWeightKG) : 0;

  // 1. Gross Scale-In Weight Check
  if (scaleIn > 0) {
    if (scaleIn > tolerances.maxGrossWeightKG) {
      alerts.push({
        id: 'RCV-GROSS-OVERLOAD',
        stage: 'RECEIVING',
        metric: 'Gross Weight (Scale In)',
        metricAr: 'وزن الدخول (قائم)',
        severity: 'CRITICAL',
        actualValue: scaleIn,
        unit: 'KG',
        minAllowed: tolerances.minGrossWeightKG,
        maxAllowed: tolerances.maxGrossWeightKG,
        deviationValue: scaleIn - tolerances.maxGrossWeightKG,
        deviationPct: Number(((scaleIn - tolerances.maxGrossWeightKG) / tolerances.maxGrossWeightKG * 100).toFixed(1)),
        titleAr: 'تجاوز حرج للوزن القائم (حمل زائد على الميزان)',
        titleEn: 'Critical Gross Overload (Scale Capacity Exceeded)',
        messageAr: `وزن الدخول (${scaleIn.toLocaleString()} كغم) يتجاوز الحد الأقصى المسموح للحمولة المحورية (${tolerances.maxGrossWeightKG.toLocaleString()} كغم).`,
        messageEn: `Gross weight (${scaleIn.toLocaleString()} KG) exceeds maximum bridge capacity (${tolerances.maxGrossWeightKG.toLocaleString()} KG).`,
        recommendationAr: 'إعادة تدقيق استقرار المنصة والتأكد من عدم وجود أكثر من محور شاحنة في نفس الوقت.',
        recommendationEn: 'Verify axle placement and re-zero scale bridge.',
        timestamp: now,
      });
    } else if (scaleIn < tolerances.minGrossWeightKG && scaleIn > 500) {
      alerts.push({
        id: 'RCV-GROSS-UNDERWEIGHT',
        stage: 'RECEIVING',
        metric: 'Gross Weight (Scale In)',
        metricAr: 'وزن الدخول (قائم)',
        severity: 'WARNING',
        actualValue: scaleIn,
        unit: 'KG',
        minAllowed: tolerances.minGrossWeightKG,
        maxAllowed: tolerances.maxGrossWeightKG,
        deviationValue: tolerances.minGrossWeightKG - scaleIn,
        deviationPct: Number(((tolerances.minGrossWeightKG - scaleIn) / tolerances.minGrossWeightKG * 100).toFixed(1)),
        titleAr: 'وزن شاحنة منخفض دون الحد الأدنى التجاري',
        titleEn: 'Gross Weight Below Normal Commercial Load',
        messageAr: `وزن الدخول (${scaleIn.toLocaleString()} كغم) أقل من الحد الأدنى للشاحنات المحملة (${tolerances.minGrossWeightKG.toLocaleString()} كغم). قد تكون الشاحنة فارغة أو محملة جزئياً.`,
        messageEn: `Gross weight (${scaleIn.toLocaleString()} KG) is below normal minimum (${tolerances.minGrossWeightKG.toLocaleString()} KG).`,
        recommendationAr: 'التأكد من حمولة الشاحنة ومطابقتها مع إرسالية المورد قبل التفريغ.',
        recommendationEn: 'Confirm cargo manifest with driver before unloading.',
        timestamp: now,
      });
    }
  }

  // 2. Tare Scale-Out Weight Check
  if (scaleOut > 0) {
    if (scaleIn > 0 && scaleOut >= scaleIn) {
      alerts.push({
        id: 'RCV-TARE-EXCEEDS-GROSS',
        stage: 'RECEIVING',
        metric: 'Tare vs Gross',
        metricAr: 'وزن الخروج مقابل الدخول',
        severity: 'CRITICAL',
        actualValue: scaleOut,
        unit: 'KG',
        minAllowed: 0,
        maxAllowed: scaleIn - 1,
        deviationValue: scaleOut - scaleIn,
        deviationPct: 100,
        titleAr: 'خطأ فيزيائي: وزن الخروج أكبر أو يساوي وزن الدخول',
        titleEn: 'Physical Error: Tare Exceeds Gross Weight',
        messageAr: `وزن الخروج الفارغ (${scaleOut.toLocaleString()} كغم) لا يمكن أن يكون مساوياً أو أكبر من وزن الدخول القائم (${scaleIn.toLocaleString()} كغم). الصافي سيكون سالباً أو صفراً!`,
        messageEn: `Tare weight (${scaleOut.toLocaleString()} KG) is >= Gross (${scaleIn.toLocaleString()} KG), resulting in negative net!`,
        recommendationAr: 'إعادة وزن الشاحنة فوراً والتحقق من رقم اللوحة ومعايرة نقطة الصفر.',
        recommendationEn: 'Re-weigh truck tare and inspect scale zero-point calibration.',
        timestamp: now,
      });
    } else if (scaleOut > tolerances.maxTareWeightKG) {
      alerts.push({
        id: 'RCV-TARE-HIGH',
        stage: 'RECEIVING',
        metric: 'Tare Weight (Scale Out)',
        metricAr: 'وزن الخروج (فارغ)',
        severity: 'WARNING',
        actualValue: scaleOut,
        unit: 'KG',
        minAllowed: tolerances.minTareWeightKG,
        maxAllowed: tolerances.maxTareWeightKG,
        deviationValue: scaleOut - tolerances.maxTareWeightKG,
        deviationPct: Number(((scaleOut - tolerances.maxTareWeightKG) / tolerances.maxTareWeightKG * 100).toFixed(1)),
        titleAr: 'وزن فارغ مرتفع عن المعتاد',
        titleEn: 'Abnormally High Tare Weight',
        messageAr: `وزن الشاحنة الفارغة (${scaleOut.toLocaleString()} كغم) يتجاوز الحد المعتاد لنفس فئة الهيكل (${tolerances.maxTareWeightKG.toLocaleString()} كغم).`,
        messageEn: `Tare weight (${scaleOut.toLocaleString()} KG) is higher than normal limit (${tolerances.maxTareWeightKG.toLocaleString()} KG).`,
        recommendationAr: 'التأكد من تفريغ كافة الشلايف والمواد بالكامل من صندوق الشاحنة قبل الخروج.',
        recommendationEn: 'Ensure truck bed was completely emptied before tare recording.',
        timestamp: now,
      });
    }
  }

  // 3. Net Weight & Average Bulk Bag Tolerance Check
  if (scaleIn > 0 && scaleOut > 0 && scaleIn > scaleOut) {
    const netWeight = scaleIn - scaleOut;

    if (netWeight < tolerances.minNetWeightKG) {
      alerts.push({
        id: 'RCV-NET-UNDERWEIGHT',
        stage: 'RECEIVING',
        metric: 'Certified Net Weight',
        metricAr: 'الوزن الصافي المستلم',
        severity: 'WARNING',
        actualValue: netWeight,
        unit: 'KG',
        minAllowed: tolerances.minNetWeightKG,
        maxAllowed: tolerances.maxGrossWeightKG,
        deviationValue: tolerances.minNetWeightKG - netWeight,
        deviationPct: Number(((tolerances.minNetWeightKG - netWeight) / tolerances.minNetWeightKG * 100).toFixed(1)),
        titleAr: 'صافي الإرسالية منخفض جداً',
        titleEn: 'Net Shipment Weight Under Minimum',
        messageAr: `الصافي المحتسب (${netWeight.toLocaleString()} كغم) أقل من حد التشغيل الأدنى (${tolerances.minNetWeightKG.toLocaleString()} كغم).`,
        messageEn: `Net weight (${netWeight.toLocaleString()} KG) is below operating minimum (${tolerances.minNetWeightKG.toLocaleString()} KG).`,
        recommendationAr: 'مراجعة أمر الشراء والتأكد مما إذا كانت الإرسالية جزئية معتمدة.',
        recommendationEn: 'Verify purchase reference for accepted partial delivery.',
        timestamp: now,
      });
    }

    // Average Weight Per Bulk Bag (شليف)
    if (bags > 0) {
      const avgBagKG = Math.round(netWeight / bags);
      if (avgBagKG > tolerances.maxBagAverageWeightKG) {
        alerts.push({
          id: 'RCV-BAG-OVERLOAD',
          stage: 'RECEIVING',
          metric: 'Average Bag Weight',
          metricAr: 'متوسط وزن الشليف',
          severity: 'CRITICAL',
          actualValue: avgBagKG,
          unit: 'KG/bag',
          minAllowed: tolerances.minBagAverageWeightKG,
          maxAllowed: tolerances.maxBagAverageWeightKG,
          deviationValue: avgBagKG - tolerances.maxBagAverageWeightKG,
          deviationPct: Number(((avgBagKG - tolerances.maxBagAverageWeightKG) / tolerances.maxBagAverageWeightKG * 100).toFixed(1)),
          titleAr: 'تجاوز خطير لمتوسط وزن الشليف (خطر تمزق الأكياس)',
          titleEn: 'Critical Bulk Bag Density (Risk of Bag Rupture)',
          messageAr: `متوسط وزن الشليف الواحد (${avgBagKG.toLocaleString()} كغم) يتجاوز سعة التحمل المعيارية (${tolerances.maxBagAverageWeightKG.toLocaleString()} كغم/شليف). خطر سلامة أثناء الرفع بالرافعة الشوكية!`,
          messageEn: `Average bag weight (${avgBagKG.toLocaleString()} KG) exceeds safe rating (${tolerances.maxBagAverageWeightKG.toLocaleString()} KG/bag). Forklift handling hazard!`,
          recommendationAr: 'فحص سلامة أشرطة التعليق وتوزيع الحمولة على أكياس إضافية إن أمكن.',
          recommendationEn: 'Inspect bag lifting loops and avoid double stacking on high racks.',
          timestamp: now,
        });
      } else if (avgBagKG < tolerances.minBagAverageWeightKG) {
        alerts.push({
          id: 'RCV-BAG-UNDERFILLED',
          stage: 'RECEIVING',
          metric: 'Average Bag Weight',
          metricAr: 'متوسط وزن الشليف',
          severity: 'WARNING',
          actualValue: avgBagKG,
          unit: 'KG/bag',
          minAllowed: tolerances.minBagAverageWeightKG,
          maxAllowed: tolerances.maxBagAverageWeightKG,
          deviationValue: tolerances.minBagAverageWeightKG - avgBagKG,
          deviationPct: Number(((tolerances.minBagAverageWeightKG - avgBagKG) / tolerances.minBagAverageWeightKG * 100).toFixed(1)),
          titleAr: 'شلايف ناقصة التعبئة دون المعيار',
          titleEn: 'Underfilled Bulk Bags Detected',
          messageAr: `متوسط وزن الشليف (${avgBagKG.toLocaleString()} كغم) أقل من المعيار الصناعي المعتمد (${tolerances.minBagAverageWeightKG.toLocaleString()} كغم/شليف).`,
          messageEn: `Average bag weight (${avgBagKG.toLocaleString()} KG) is underfilled (< ${tolerances.minBagAverageWeightKG.toLocaleString()} KG/bag).`,
          recommendationAr: 'التأكد من صحة عدد الشلايف المدخلة في استمارة الاستلام.',
          recommendationEn: 'Recheck counted bulk bags in truck bed.',
          timestamp: now,
        });
      }
    }

    // 4. Discrepancy vs Invoice Weight (if provided)
    if (invoiceNet > 0) {
      const diffKG = Math.abs(netWeight - invoiceNet);
      const diffPct = Number(((diffKG / invoiceNet) * 100).toFixed(2));
      if (diffPct > tolerances.maxSupplierDiscrepancyPct) {
        alerts.push({
          id: 'RCV-INVOICE-DISCREPANCY',
          stage: 'RECEIVING',
          metric: 'Supplier Invoice Variance',
          metricAr: 'فارق وزن فاتورة المورد',
          severity: diffPct > 5.0 ? 'CRITICAL' : 'WARNING',
          actualValue: netWeight,
          unit: 'KG',
          minAllowed: Math.round(invoiceNet * (1 - tolerances.maxSupplierDiscrepancyPct / 100)),
          maxAllowed: Math.round(invoiceNet * (1 + tolerances.maxSupplierDiscrepancyPct / 100)),
          deviationValue: diffKG,
          deviationPct: diffPct,
          titleAr: `فارق وزن مع فاتورة المورد (${diffPct}% - ${diffKG.toLocaleString()} كغم)`,
          titleEn: `Supplier Invoice Weight Variance (${diffPct}%)`,
          messageAr: `الوزن الصافي (${netWeight.toLocaleString()} كغم) ينحرف عن الفاتورة (${invoiceNet.toLocaleString()} كغم) بنسبة ${diffPct}% (الحد المسموح ±${tolerances.maxSupplierDiscrepancyPct}%).`,
          messageEn: `Scale net (${netWeight.toLocaleString()} KG) deviates from manifest (${invoiceNet.toLocaleString()} KG) by ${diffPct}% (tolerance ±${tolerances.maxSupplierDiscrepancyPct}%).`,
          recommendationAr: 'تسجيل فارق الوزن في محضر الاستلام الرسمي لمطالبة المورد أو تعديل الفاتورة.',
          recommendationEn: 'Flag receipt for procurement review before releasing payment.',
          timestamp: now,
        });
      }
    }
  }

  // Determine Overall Severity
  let overallSeverity: ToleranceSeverity = 'NORMAL';
  if (alerts.some((a) => a.severity === 'CRITICAL')) {
    overallSeverity = 'CRITICAL';
  } else if (alerts.some((a) => a.severity === 'WARNING')) {
    overallSeverity = 'WARNING';
  }

  return {
    stage: 'RECEIVING',
    overallSeverity,
    hasDeviation: alerts.length > 0,
    alerts,
    evaluatedAt: now,
    summaryAr:
      overallSeverity === 'CRITICAL'
        ? `تنبيه حرج: تم رصد ${alerts.length} انحراف وزني يتجاوز حدود السلامة والتحمل المعتمدة للاستلام!`
        : overallSeverity === 'WARNING'
        ? `تحذير تسامح: توجد ${alerts.length} ملاحظة انحراف وزني تتطلب تدقيق مشغل الميزان.`
        : 'أوزان الاستلام والميزان الجسري تقع تماماً ضمن حدود التسامح المعيارية للمصنع.',
    summaryEn:
      overallSeverity === 'CRITICAL'
        ? `Critical tolerance alert: ${alerts.length} scale deviation(s) breach safety standards!`
        : overallSeverity === 'WARNING'
        ? `Tolerance warning: ${alerts.length} scale metric(s) deviate from standard bounds.`
        : 'Scale intake readings are strictly within certified production tolerances.',
  };
}

/**
 * Real-time evaluator for Shredding stage scale readings (Input, Output, Damage, Variance)
 */
export function evaluateShreddingWeightTolerances(
  params: {
    inputKG: number;
    outputKG: number;
    productionDamageKG?: number;
    inputBags?: number;
    outputBags?: number;
  },
  customTolerances?: WeightTolerances
): ToleranceEvaluationReport {
  const tolerances = customTolerances || loadWeightTolerances();
  const alerts: ToleranceAlertItem[] = [];
  const now = new Date().toISOString();

  const inputKG = Number(params.inputKG) || 0;
  const outputKG = Number(params.outputKG) || 0;
  const damageKG = Number(params.productionDamageKG) || 0;

  // 1. Batch Input Size Check
  if (inputKG > 0) {
    if (inputKG < tolerances.minInputBatchKG) {
      alerts.push({
        id: 'THM-BATCH-TOO-SMALL',
        stage: 'SHREDDING',
        metric: 'Batch Input Load',
        metricAr: 'حجم دفعة التغذية للثرم',
        severity: 'WARNING',
        actualValue: inputKG,
        unit: 'KG',
        minAllowed: tolerances.minInputBatchKG,
        maxAllowed: tolerances.maxInputBatchKG,
        deviationValue: tolerances.minInputBatchKG - inputKG,
        deviationPct: Number(((tolerances.minInputBatchKG - inputKG) / tolerances.minInputBatchKG * 100).toFixed(1)),
        titleAr: 'دفعة ثرم صغيرة دون الحد الحراري الاقتصادي',
        titleEn: 'Shredding Batch Size Below Thermal Minimum',
        messageAr: `الكمية المدخلة (${inputKG.toLocaleString()} كغم) أقل من الحد الأدنى للتشغيل (${tolerances.minInputBatchKG.toLocaleString()} كغم). تشغيل الماكينة بأحمال منخفضة يهدر الطاقة بنسبة تصل لـ 35%.`,
        messageEn: `Batch size (${inputKG.toLocaleString()} KG) is below thermal efficiency minimum (${tolerances.minInputBatchKG.toLocaleString()} KG).`,
        recommendationAr: 'تجميع كميات إضافية للوصول لدفعة كاملة قبل تدوير شفرات المحرك.',
        recommendationEn: 'Batch materials to full rotor capacity before running motor.',
        timestamp: now,
      });
    } else if (inputKG > tolerances.maxInputBatchKG) {
      alerts.push({
        id: 'THM-BATCH-TOO-LARGE',
        stage: 'SHREDDING',
        metric: 'Batch Input Load',
        metricAr: 'حجم دفعة التغذية للثرم',
        severity: 'CRITICAL',
        actualValue: inputKG,
        unit: 'KG',
        minAllowed: tolerances.minInputBatchKG,
        maxAllowed: tolerances.maxInputBatchKG,
        deviationValue: inputKG - tolerances.maxInputBatchKG,
        deviationPct: Number(((inputKG - tolerances.maxInputBatchKG) / tolerances.maxInputBatchKG * 100).toFixed(1)),
        titleAr: 'حمولة زائدة على قادوس ماكينة الثرم',
        titleEn: 'Granulator Hopper Overload Hazard',
        messageAr: `الكمية المدخلة (${inputKG.toLocaleString()} كغم) تتجاوز الطاقة الاستيعابية القصوى للدورة (${tolerances.maxInputBatchKG.toLocaleString()} كغم). خطر انحشار المحرك وتوقف الإنتاج!`,
        messageEn: `Input load (${inputKG.toLocaleString()} KG) exceeds granulator batch limit (${tolerances.maxInputBatchKG.toLocaleString()} KG). Motor stall hazard!`,
        recommendationAr: 'تقسيم الدفعة إلى دورتين متتاليتين لحماية ناقل الحركة.',
        recommendationEn: 'Split load into two consecutive cycles to prevent drive trip.',
        timestamp: now,
      });
    }
  }

  // 2. Mass Balance & Variance Checks (When Output is Recorded)
  if (inputKG > 0 && outputKG > 0) {
    const totalAccountedOut = outputKG + damageKG;
    const varianceKG = inputKG - totalAccountedOut;
    const variancePct = Number(((varianceKG / inputKG) * 100).toFixed(2));

    // A. Unphysical Mass Creation (Output + Damage > Input)
    if (variancePct < tolerances.maxNegativeVariancePct) {
      alerts.push({
        id: 'THM-NEGATIVE-VARIANCE',
        stage: 'SHREDDING',
        metric: 'Mass Balance (Variance)',
        metricAr: 'معادلة حفظ الكتلة (الفارق)',
        severity: 'CRITICAL',
        actualValue: varianceKG,
        unit: 'KG',
        minAllowed: 0,
        maxAllowed: Math.round(inputKG * (tolerances.criticalShreddingLossPct / 100)),
        deviationValue: Math.abs(varianceKG),
        deviationPct: Math.abs(variancePct),
        titleAr: 'خطأ فيزيائي: مخرجات الثرم تتجاوز المدخلات (كتلة مستحدثة)',
        titleEn: 'Physical Anomaly: Outputs Exceed Inputs',
        messageAr: `إجمالي المخرجات والتالف (${totalAccountedOut.toLocaleString()} كغم) أكبر من المدخلات (${inputKG.toLocaleString()} كغم) بفارق (+${Math.abs(varianceKG).toLocaleString()} كغم / ${Math.abs(variancePct)}%). هذا يخالف مبادئ حفظ الكتلة!`,
        messageEn: `Total output & damage (${totalAccountedOut.toLocaleString()} KG) exceeds input (${inputKG.toLocaleString()} KG) by +${Math.abs(varianceKG).toLocaleString()} KG!`,
        recommendationAr: 'إعادة تصفير ميزان المخرجات، والتأكد من عدم خلط مفروم من دورة سابقة في القادوس.',
        recommendationEn: 'Re-zero floor scale and ensure no residual regrind from previous batch was added.',
        timestamp: now,
      });
    }
    // B. Critical Material Loss / Leakage (Variance > Critical Threshold e.g. 4.0%)
    else if (variancePct > tolerances.criticalShreddingLossPct) {
      alerts.push({
        id: 'THM-CRITICAL-LOSS',
        stage: 'SHREDDING',
        metric: 'Process Loss Variance',
        metricAr: 'نسبة الفاقد والهوالك بالثرم',
        severity: 'CRITICAL',
        actualValue: varianceKG,
        unit: 'KG',
        minAllowed: 0,
        maxAllowed: Math.round(inputKG * (tolerances.warningShreddingLossPct / 100)),
        deviationValue: varianceKG - Math.round(inputKG * (tolerances.criticalShreddingLossPct / 100)),
        deviationPct: variancePct,
        titleAr: `فاقد حرج بالثرم (${variancePct}% - ${varianceKG.toLocaleString()} كغم)`,
        titleEn: `Critical Shredding Loss (${variancePct}% - ${varianceKG.toLocaleString()} KG)`,
        messageAr: `نسبة الفاقد المفقود (${variancePct}%) تتجاوز الحد الحرج المسموح به قطاعياً (${tolerances.criticalShreddingLossPct}%). قد يشير إلى تسرب حبيبات، تراكم تحت الشفرات، أو خطأ وزني فادح.`,
        messageEn: `Loss variance (${variancePct}%) breaches critical tolerance (${tolerances.criticalShreddingLossPct}%). Indicates filter leakage or scale drift.`,
        recommendationAr: 'فحص فلاتر الشفط الهوائي، تفقد أسفل الغربال، والتحقق من عدم وجود بواقي عالقة.',
        recommendationEn: 'Inspect cyclone vacuum filters and check beneath sieve screen for clogs.',
        timestamp: now,
      });
    }
    // C. Warning Material Loss (Variance > Warning Threshold e.g. 2.5%)
    else if (variancePct > tolerances.warningShreddingLossPct) {
      alerts.push({
        id: 'THM-WARNING-LOSS',
        stage: 'SHREDDING',
        metric: 'Process Loss Variance',
        metricAr: 'نسبة فاقد الثرم',
        severity: 'WARNING',
        actualValue: varianceKG,
        unit: 'KG',
        minAllowed: 0,
        maxAllowed: Math.round(inputKG * (tolerances.warningShreddingLossPct / 100)),
        deviationValue: varianceKG - Math.round(inputKG * (tolerances.warningShreddingLossPct / 100)),
        deviationPct: variancePct,
        titleAr: `ارتفاع فاقد الثرم عن النسبة المستهدفة (${variancePct}%)`,
        titleEn: `Shredding Variance Above Warning Bound (${variancePct}%)`,
        messageAr: `نسبة الفارق (${variancePct}%) أعلى من النسبة المثالية (${tolerances.warningShreddingLossPct}%). يلزم كتابة سبب الفارق في التقرير.`,
        messageEn: `Shredding variance (${variancePct}%) is above target tolerance (${tolerances.warningShreddingLossPct}%). Justification required.`,
        recommendationAr: 'توثيق سبب الفاقد (غبار/رطوبة/أكياس ممزقة) واعتماد المشرف.',
        recommendationEn: 'Log detailed reason (dust/moisture/packaging) in legacy form 360.',
        timestamp: now,
      });
    }

    // 3. Production Damage Check
    if (damageKG > 0) {
      const damagePct = Number(((damageKG / inputKG) * 100).toFixed(2));
      if (damagePct > tolerances.maxProductionDamagePct) {
        alerts.push({
          id: 'THM-HIGH-DAMAGE',
          stage: 'SHREDDING',
          metric: 'Production Damage',
          metricAr: 'تالف إنتاج دورة الثرم',
          severity: damagePct > 5.0 ? 'CRITICAL' : 'WARNING',
          actualValue: damageKG,
          unit: 'KG',
          minAllowed: 0,
          maxAllowed: Math.round(inputKG * (tolerances.maxProductionDamagePct / 100)),
          deviationValue: damageKG - Math.round(inputKG * (tolerances.maxProductionDamagePct / 100)),
          deviationPct: damagePct,
          titleAr: `ارتفاع تالف الثرم (${damagePct}% - ${damageKG.toLocaleString()} كغم)`,
          titleEn: `High Production Damage (${damagePct}%)`,
          messageAr: `نسبة التالف (${damagePct}%) تتجاوز سقف التسامح المقبول (${tolerances.maxProductionDamagePct}%). يشير إلى وجود مواد معدنية أو شوائب صلبة أضرت بجودة الحبيبات.`,
          messageEn: `Production damage (${damagePct}%) exceeds tolerance (${tolerances.maxProductionDamagePct}%). Contaminants suspected.`,
          recommendationAr: 'فحص فواصل المغناطيس على خط التغذية للتأكد من خلو البلاستيك من الشوائب المعدنية.',
          recommendationEn: 'Inspect magnetic cross-belt separator on intake conveyor.',
          timestamp: now,
        });
      }
    }
  }

  // Determine Overall Severity
  let overallSeverity: ToleranceSeverity = 'NORMAL';
  if (alerts.some((a) => a.severity === 'CRITICAL')) {
    overallSeverity = 'CRITICAL';
  } else if (alerts.some((a) => a.severity === 'WARNING')) {
    overallSeverity = 'WARNING';
  }

  return {
    stage: 'SHREDDING',
    overallSeverity,
    hasDeviation: alerts.length > 0,
    alerts,
    evaluatedAt: now,
    summaryAr:
      overallSeverity === 'CRITICAL'
        ? `إنذار حرج في قسم الثرم: تم رصد ${alerts.length} انحراف في موازنة الكتلة والفاقد يتطلب إيقاف الاعتماد فوراً!`
        : overallSeverity === 'WARNING'
        ? `تنبيه تسامح بالثرم: توجد ${alerts.length} قراءة تحتاج لمراجعة المشرف قبل إيداع المفروم بالمخزن.`
        : 'موازنة أوزان الثرم ونسب الفاقد متوافقة 100% مع المعايير الفيزيائية للمصنع.',
    summaryEn:
      overallSeverity === 'CRITICAL'
        ? `Critical granulator alert: ${alerts.length} mass balance breach(es) detected!`
        : overallSeverity === 'WARNING'
        ? `Granulator warning: ${alerts.length} weight metric(s) deviate from standard limits.`
        : 'Shredder mass conservation and variance are within ISO production bounds.',
  };
}
