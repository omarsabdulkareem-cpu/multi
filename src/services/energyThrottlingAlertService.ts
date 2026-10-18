/**
 * AL-KARWAN FACTORY ENERGY MONITORING & AUTOMATION
 * Equipment Power vs Production Output Efficiency Benchmarking & Throttling Service
 *
 * Compares real-time power consumption (kW) against empirical production output benchmarks
 * (Specific Energy Consumption SEC = kWh/kg) and generates automated alerts recommending
 * machine throttling (VFD frequency reduction, infeed auto-pacing, idle standby shedding)
 * to save energy and lower industrial power tariff surcharges.
 */

import { ShredderMachineEnergyProfile, EnergyTariffWindow } from '../types';
import { getCurrentTariffWindow } from './energyEfficiencyService';

export type ThrottlingStrategy =
  | 'VFD_SPEED_THROTTLE'   // Reduce inverter drive frequency (e.g. 50Hz -> 38Hz) to optimize torque-to-throughput
  | 'INFEED_AUTO_PACING'    // Throttle conveyor feed rate to avoid motor overload & thermal friction
  | 'AUTO_IDLE_SHEDDING'    // Shed idle power during no-load intervals
  | 'PEAK_LOAD_SHED';       // Throttle non-critical heavy purges during high peak tariff hours

export interface ThrottlingProposal {
  strategy: ThrottlingStrategy;
  titleAr: string;
  titleEn: string;
  recommendedFrequencyHz: number;
  recommendedPowerKW: number;
  powerReductionKW: number;
  estimatedHourlyCostSavingsIQD: number;
  estimatedHourlyCostSavingsUSD: number;
  estimatedDailyCostSavingsIQD: number;
  estimatedDailyCostSavingsUSD: number;
  actionDirectiveAr: string;
  actionDirectiveEn: string;
  technicalStepsAr: string[];
  technicalStepsEn: string[];
}

export interface EquipmentEfficiencyAlert {
  id: string;
  machineId: string;
  machineCode: string;
  machineNameAr: string;
  machineNameEn: string;
  severity: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  currentPowerKW: number;
  currentThroughputKGHour: number;
  currentSECKWhKG: number;
  targetSECKWhKG: number;
  secBreachPct: number; // e.g. +24.5% above benchmark
  excessPowerDrawKW: number;
  hourlyCostPenaltyIQD: number;
  hourlyCostPenaltyUSD: number;
  isThrottled: boolean;
  throttlingProposal: ThrottlingProposal;
  detectedAt: string;
  reasonAr: string;
  reasonEn: string;
}

export interface EquipmentEfficiencyBenchmark {
  machineId: string;
  targetSECKWhKG: number; // Benchmark specific energy consumption (kWh / kg)
  maxAllowableSECKWhKG: number; // Critical threshold
  nominalThroughputKGHour: number;
  maxIdleAllowableKW: number;
}

export const DEFAULT_EFFICIENCY_BENCHMARKS: Record<string, EquipmentEfficiencyBenchmark> = {
  'THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)': {
    machineId: 'THERM-SHREDDER-01 (Heavy Duty Rotor 75kW)',
    targetSECKWhKG: 0.085,
    maxAllowableSECKWhKG: 0.094,
    nominalThroughputKGHour: 680,
    maxIdleAllowableKW: 6.0,
  },
  'THERM-SHREDDER-02 (Fine Regrind Granulator 55kW)': {
    machineId: 'THERM-SHREDDER-02 (Fine Regrind Granulator 55kW)',
    targetSECKWhKG: 0.090,
    maxAllowableSECKWhKG: 0.098,
    nominalThroughputKGHour: 470,
    maxIdleAllowableKW: 5.0,
  },
  'THERM-SHREDDER-03 (Cup & Edge Trimmings 45kW)': {
    machineId: 'THERM-SHREDDER-03 (Cup & Edge Trimmings 45kW)',
    targetSECKWhKG: 0.092,
    maxAllowableSECKWhKG: 0.100,
    nominalThroughputKGHour: 450,
    maxIdleAllowableKW: 4.5,
  },
};

/**
 * Evaluate factory equipment power consumption vs real-time production output
 */
export function evaluateEquipmentEfficiencyAlerts(
  machines: ShredderMachineEnergyProfile[],
  tariffWindow?: EnergyTariffWindow,
  throttledMachineIds: Set<string> = new Set()
): EquipmentEfficiencyAlert[] {
  const tariff = tariffWindow || getCurrentTariffWindow();
  const alerts: EquipmentEfficiencyAlert[] = [];

  machines.forEach((m) => {
    const benchmark = DEFAULT_EFFICIENCY_BENCHMARKS[m.machineId] || {
      machineId: m.machineId,
      targetSECKWhKG: m.targetSECKWhKG || 0.088,
      maxAllowableSECKWhKG: (m.targetSECKWhKG || 0.088) * 1.12,
      nominalThroughputKGHour: m.throughputKGHour || 500,
      maxIdleAllowableKW: 5.0,
    };

    const isThrottled = throttledMachineIds.has(m.machineId);

    // CASE 1: IDLE POWER WASTE (Machine running idle drawing power with 0 output)
    if (m.state === 'RUNNING_IDLE' && m.activePowerKW > benchmark.maxIdleAllowableKW) {
      const excessKW = Math.round((m.activePowerKW - 2.5) * 10) / 10;
      const hourlyPenaltyIQD = Math.round(excessKW * tariff.rateIQDPerKWh);
      const hourlyPenaltyUSD = parseFloat((hourlyPenaltyIQD / 1300).toFixed(2));
      const dailyPenaltyIQD = hourlyPenaltyIQD * 16;
      const dailyPenaltyUSD = parseFloat((dailyPenaltyIQD / 1300).toFixed(2));

      alerts.push({
        id: `ALERT-IDLE-${m.code}`,
        machineId: m.machineId,
        machineCode: m.code,
        machineNameAr: m.nameAr,
        machineNameEn: m.nameEn,
        severity: 'CRITICAL',
        currentPowerKW: m.activePowerKW,
        currentThroughputKGHour: 0,
        currentSECKWhKG: 0,
        targetSECKWhKG: benchmark.targetSECKWhKG,
        secBreachPct: 100,
        excessPowerDrawKW: excessKW,
        hourlyCostPenaltyIQD: hourlyPenaltyIQD,
        hourlyCostPenaltyUSD: hourlyPenaltyUSD,
        isThrottled,
        reasonAr: `هدر طاقة كلي: المفرمة تعمل بحالة دوران فارغ (IDLE) دون إنتاج فعلي، مع استهلاك ${m.activePowerKW} ك.واط وتيار ${m.currentAmps} أمبير.`,
        reasonEn: `Idle Power Loss: Machine running unladen with 0 kg/h production output, wasting ${m.activePowerKW} kW active power.`,
        throttlingProposal: {
          strategy: 'AUTO_IDLE_SHEDDING',
          titleAr: 'تفعيل إيقاف السكون الذكي وخنق محرك الدوار (Auto-Idle Shedding)',
          titleEn: 'Engage Deep Idle Shedding / Standby Trip',
          recommendedFrequencyHz: 0,
          recommendedPowerKW: 1.5,
          powerReductionKW: excessKW,
          estimatedHourlyCostSavingsIQD: hourlyPenaltyIQD,
          estimatedHourlyCostSavingsUSD: hourlyPenaltyUSD,
          estimatedDailyCostSavingsIQD: dailyPenaltyIQD,
          estimatedDailyCostSavingsUSD: dailyPenaltyUSD,
          actionDirectiveAr: `خنق طاقة الدوران الفارغ وتخفيض ${excessKW} ك.واط فوراً`,
          actionDirectiveEn: `Shed ${excessKW} kW idle draw into sleep standby`,
          technicalStepsAr: [
            'فصل قواطع محرك السحب الرئيسي وتفعيل وضع السكون (Standby Mode)',
            'تنشيط حساس التلقيم الضوئي لإعادة التشغيل تلقائياً عند وصول كتل السكراب',
            `توفير ${hourlyPenaltyIQD.toLocaleString()} د.ع في كل ساعة دوران فارغ`,
          ],
          technicalStepsEn: [
            'Disengage rotor main drive contactors into low-power sleep state',
            'Arm optical infeed hopper sensor for auto-wake upon scrap arrival',
            `Save ${hourlyPenaltyIQD.toLocaleString()} IQD per idle running hour`,
          ],
        },
        detectedAt: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      });
      return;
    }

    // CASE 2: REAL-TIME SEC EXCEEDS BENCHMARK (Overconsumption relative to production throughput)
    if (m.state === 'RUNNING_LOAD' && m.throughputKGHour > 0) {
      const currentSEC = Math.round((m.activePowerKW / m.throughputKGHour) * 1000) / 1000;
      const benchmarkPowerKW = Math.round(m.throughputKGHour * benchmark.targetSECKWhKG * 10) / 10;
      const excessKW = Math.max(0, Math.round((m.activePowerKW - benchmarkPowerKW) * 10) / 10);
      const breachPct = Math.round(((currentSEC - benchmark.targetSECKWhKG) / benchmark.targetSECKWhKG) * 100);

      // Trigger if SEC exceeds target by >= 8% or active power is at least 3.5 kW above benchmark
      if (currentSEC > benchmark.maxAllowableSECKWhKG || breachPct >= 8) {
        const severity: 'CRITICAL' | 'WARNING' = breachPct >= 18 || m.bladeWearPct >= 65 ? 'CRITICAL' : 'WARNING';
        const hourlyPenaltyIQD = Math.round(excessKW * tariff.rateIQDPerKWh);
        const hourlyPenaltyUSD = parseFloat((hourlyPenaltyIQD / 1300).toFixed(2));
        const dailyPenaltyIQD = hourlyPenaltyIQD * 16;
        const dailyPenaltyUSD = parseFloat((dailyPenaltyIQD / 1300).toFixed(2));

        // Suggested throttling: VFD frequency reduction
        const recommendedPowerKW = Math.max(benchmarkPowerKW, Math.round((m.activePowerKW - excessKW) * 10) / 10);
        const freqRatio = Math.max(0.74, Math.min(0.92, recommendedPowerKW / m.nominalMotorKW));
        const recommendedHz = Math.round(freqRatio * 50 * 10) / 10;

        alerts.push({
          id: `ALERT-SEC-${m.code}`,
          machineId: m.machineId,
          machineCode: m.code,
          machineNameAr: m.nameAr,
          machineNameEn: m.nameEn,
          severity,
          currentPowerKW: m.activePowerKW,
          currentThroughputKGHour: m.throughputKGHour,
          currentSECKWhKG: currentSEC,
          targetSECKWhKG: benchmark.targetSECKWhKG,
          secBreachPct: breachPct,
          excessPowerDrawKW: excessKW,
          hourlyCostPenaltyIQD: hourlyPenaltyIQD,
          hourlyCostPenaltyUSD: hourlyPenaltyUSD,
          isThrottled,
          reasonAr: `تجاوز معيار الطاقة النوعية: استهلاك المفرمة (${currentSEC} kWh/kg) يتجاوز المعيار القياسي (${benchmark.targetSECKWhKG} kWh/kg) بنسبة +${breachPct}%. استهلاك طاقة فائض قدره ${excessKW} ك.واط لإنتاج ${m.throughputKGHour} كغم/ساعة.`,
          reasonEn: `SEC Benchmark Exceeded: Current ${currentSEC} kWh/kg is +${breachPct}% above optimal benchmark (${benchmark.targetSECKWhKG} kWh/kg). Excess power draw is ${excessKW} kW for ${m.throughputKGHour} kg/h throughput.`,
          throttlingProposal: {
            strategy: 'VFD_SPEED_THROTTLE',
            titleAr: `خنق تردد مغير السرعة VFD إلى ${recommendedHz}Hz وتعديل سرعة التلقيم`,
            titleEn: `Throttle VFD Frequency to ${recommendedHz}Hz & Pace Infeed`,
            recommendedFrequencyHz: recommendedHz,
            recommendedPowerKW,
            powerReductionKW: excessKW,
            estimatedHourlyCostSavingsIQD: hourlyPenaltyIQD,
            estimatedHourlyCostSavingsUSD: hourlyPenaltyUSD,
            estimatedDailyCostSavingsIQD: dailyPenaltyIQD,
            estimatedDailyCostSavingsUSD: dailyPenaltyUSD,
            actionDirectiveAr: `خنق القدرة إلى ${recommendedPowerKW} ك.واط وخفض ${excessKW} ك.واط`,
            actionDirectiveEn: `Throttle active power to ${recommendedPowerKW} kW (-${excessKW} kW)`,
            technicalStepsAr: [
              `خفض تردد عاكس التردد (Inverter VFD) من 50.0Hz إلى ${recommendedHz}Hz للحد من مقاومة القص الزائدة`,
              'تثبيت معدل تدفق ناقل السكراب لتفادي القفزات اللحظية لتيار المحرك (Amps Spikes)',
              `توفير ${hourlyPenaltyIQD.toLocaleString()} د.ع/ساعة (${dailyPenaltyIQD.toLocaleString()} د.ع/يومياً) دون خفض الإنتاجية الإجمالية`,
            ],
            technicalStepsEn: [
              `Ramp down VFD inverter output frequency from 50.0Hz to ${recommendedHz}Hz to match torque demand`,
              'Throttle scrap infeed conveyor velocity to smooth motor amp spikes and avoid rotor choke',
              `Save ${hourlyPenaltyIQD.toLocaleString()} IQD/hour (${dailyPenaltyIQD.toLocaleString()} IQD/day) at rated capacity`,
            ],
          },
          detectedAt: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        });
      }
    }
  });

  return alerts;
}

/**
 * Apply suggested throttling action to a specific machine profile
 */
export function applyThrottlingToMachine(
  machines: ShredderMachineEnergyProfile[],
  machineId: string,
  proposal: ThrottlingProposal
): ShredderMachineEnergyProfile[] {
  return machines.map((m) => {
    if (m.machineId !== machineId) return m;

    if (proposal.strategy === 'AUTO_IDLE_SHEDDING') {
      return {
        ...m,
        state: 'STOPPED',
        activePowerKW: 1.2,
        currentAmps: 3.1,
        loadPercentage: 2.5,
        throughputKGHour: 0,
        idleLossKWhToday: Math.max(0, m.idleLossKWhToday - 4.5),
        lastReadingTime: 'مخفّض لوضع السكون (Throttled Standby)',
      };
    }

    // VFD throttling
    const newPowerKW = Math.round(proposal.recommendedPowerKW * 10) / 10;
    const newLoadPct = Math.round((newPowerKW / m.nominalMotorKW) * 1000) / 10;
    const newAmps = Math.round((m.currentAmps * (newPowerKW / Math.max(1, m.activePowerKW))) * 10) / 10;
    const newSEC = m.throughputKGHour > 0 ? Math.round((newPowerKW / m.throughputKGHour) * 1000) / 1000 : m.targetSECKWhKG;

    return {
      ...m,
      activePowerKW: newPowerKW,
      loadPercentage: newLoadPct,
      currentAmps: newAmps,
      specificEnergyConsumptionKWhKG: newSEC,
      lastReadingTime: `مخنوق إلى ${proposal.recommendedFrequencyHz}Hz (VFD Throttled)`,
    };
  });
}

/**
 * Simulate an efficiency spike anomaly on a machine for test and verification
 */
export function simulateEfficiencySpike(
  machines: ShredderMachineEnergyProfile[],
  machineId: string
): ShredderMachineEnergyProfile[] {
  return machines.map((m) => {
    if (m.machineId !== machineId) return m;

    // Spike power by +16 kW and degrade SEC
    const spikedKW = Math.min(m.nominalMotorKW * 0.96, Math.round((m.activePowerKW + 16.5) * 10) / 10);
    const spikedAmps = Math.min(m.ratedAmps * 1.05, Math.round((m.currentAmps + 26) * 10) / 10);
    const loadPct = Math.round((spikedKW / m.nominalMotorKW) * 1000) / 10;
    const sec = m.throughputKGHour > 0 ? Math.round((spikedKW / m.throughputKGHour) * 1000) / 1000 : 0.125;

    return {
      ...m,
      activePowerKW: spikedKW,
      currentAmps: spikedAmps,
      loadPercentage: loadPct,
      specificEnergyConsumptionKWhKG: sec,
      temperatureC: Math.min(85, m.temperatureC + 6),
      lastReadingTime: 'طفرة استهلاك محاكاة (Simulated Spike)',
    };
  });
}

/**
 * Restore nominal unthrottled parameters to a machine
 */
export function restoreMachineNominal(
  machines: ShredderMachineEnergyProfile[],
  machineId: string,
  initialProfiles: ShredderMachineEnergyProfile[]
): ShredderMachineEnergyProfile[] {
  const original = initialProfiles.find((o) => o.machineId === machineId);
  if (!original) return machines;

  return machines.map((m) => (m.machineId === machineId ? { ...original, lastReadingTime: 'تمت استعادة القدرة الاسمية' } : m));
}
