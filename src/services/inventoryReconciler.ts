/**
 * AL-KARWAN FACTORY CONTROL SYSTEM
 * Automated Inventory Reconciler Service
 *
 * Performs real-time automated consistency checks between the movement ledger and current stock.
 * Specifically computes and outputs discrepancies for materials where:
 *   Theoretical Balance = (Opening + Receipts + Returns) - (Issues + Damage + Shredding)
 * does not match the Stored Inventory Balance.
 */

import {
  MaterialItem,
  InventoryMovement,
  InventoryBalance,
  MaterialReconciliationItem,
  InventoryReconciliationSummary,
  SystemInventoryCode,
} from '../types';
import { resolveMovementInternalCode } from './systemCodesService';

export interface InternalCodeBreakdownItem {
  code: string;
  count: number;
  totalKG: number;
  inflowKG: number;
  outflowKG: number;
  movementsCount: number;
}

/**
 * Groups and analyzes inventory movements by configurable internal inventory codes (e.g. 167, 546, 360, 352).
 */
export function calculateInternalCodeBreakdown(
  movements: InventoryMovement[],
  systemCodes?: SystemInventoryCode[]
): Record<string, InternalCodeBreakdownItem> {
  const breakdown: Record<string, InternalCodeBreakdownItem> = {};

  movements.forEach((m) => {
    if (m.status === 'DUPLICATE' || m.status === 'Reversed' || m.status === 'Cancelled') return;

    // Resolve code from internalInventoryCode, legacyDocRef prefix, or fallback resolution
    const assignedCode =
      m.internalInventoryCode ||
      (m.legacyDocumentNumber ? m.legacyDocumentNumber.split('/')[0] : '') ||
      resolveMovementInternalCode(m.source || '', m.movementType, systemCodes);

    if (!breakdown[assignedCode]) {
      breakdown[assignedCode] = {
        code: assignedCode,
        count: 0,
        totalKG: 0,
        inflowKG: 0,
        outflowKG: 0,
        movementsCount: 0,
      };
    }

    const qty = Math.abs(Number(m.quantityKG) || 0);
    const item = breakdown[assignedCode];
    item.count += 1;
    item.movementsCount += 1;
    item.totalKG += qty;

    const t = m.movementType;
    if (t === 'RECEIPT' || t === 'RECEIVING' || t === 'OPENING_BALANCE' || t.includes('RETURN') || t === 'SHREDDING_OUTPUT') {
      item.inflowKG += qty;
    } else {
      item.outflowKG += qty;
    }
  });

  return breakdown;
}

export function calculateMaterialReconciliation(
  material: MaterialItem,
  movements: InventoryMovement[],
  balances: InventoryBalance[]
): MaterialReconciliationItem {
  // Filter active movements for this material (by ID or exact Code)
  const matMovements = movements.filter(
    (m) =>
      (m.materialId === material.id || m.materialCode === material.code) &&
      m.status !== 'DUPLICATE' &&
      m.status !== 'Reversed' &&
      m.status !== 'Cancelled'
  );

  let openingKG = 0;
  let openingBags = 0;

  let receiptsKG = 0;
  let receiptsBags = 0;

  let returnsKG = 0;
  let returnsBags = 0;

  let issuesKG = 0;
  let issuesBags = 0;

  let damageKG = 0;
  let damageBags = 0;

  let shreddingKG = 0;
  let shreddingBags = 0;

  let adjustmentsKG = 0;
  let adjustmentsBags = 0;

  let transfersInKG = 0;
  let transfersInBags = 0;

  let transfersOutKG = 0;
  let transfersOutBags = 0;

  let lastMovementDate = '---';

  matMovements.forEach((mov) => {
    const qty = Number(mov.quantityKG) || 0;
    const bags = Number(mov.bulkBagsCount) || 0;

    if (mov.date && (!lastMovementDate || mov.date > lastMovementDate)) {
      lastMovementDate = mov.date;
    }

    const type = mov.movementType;

    // 1. Opening Balance
    if (type === 'OPENING_BALANCE') {
      openingKG += qty;
      openingBags += bags;
    }
    // 2. Receipts (Scale In / Inward Shipments Doc 546)
    else if (type === 'RECEIPT' || type === 'RECEIVING') {
      receiptsKG += qty;
      receiptsBags += bags;
    }
    // 3. Returns (Production Returns, Shredding Returns, Reclaim Output)
    else if (
      type === 'RETURN' ||
      type === 'PRODUCTION_RETURN' ||
      type === 'SHREDDING_RETURN' ||
      type === 'SHREDDING_OUTPUT'
    ) {
      returnsKG += qty;
      returnsBags += bags;
    }
    // 4. Issues (Production Issues Doc 167)
    else if (type === 'ISSUE' || type === 'PRODUCTION_ISSUE' || type === 'PRODUCTION ISSUE') {
      issuesKG += qty;
      issuesBags += bags;
    }
    // 5. Damage (Production Damage / Scrap تالف إنتاج)
    else if (type === 'DAMAGE' || type === 'PRODUCTION_DAMAGE') {
      damageKG += qty;
      damageBags += bags;
    }
    // 6. Shredding (Therm Feed / Shredding Input)
    else if (
      type === 'SHREDDING_INPUT' ||
      type === 'SHREDDING ISSUE' ||
      type === 'SHREDDING_ISSUE'
    ) {
      shreddingKG += qty;
      shreddingBags += bags;
    }
    // 7. Adjustments (Authorized Audit Corrections)
    else if (type === 'ADJUSTMENT') {
      adjustmentsKG += qty;
      adjustmentsBags += bags;
    }
    // 8. Location Transfers
    else if (type === 'TRANSFER_IN') {
      transfersInKG += qty;
      transfersInBags += bags;
    } else if (type === 'TRANSFER_OUT') {
      transfersOutKG += qty;
      transfersOutBags += bags;
    }
  });

  // Calculate Inflows: (Opening + Receipts + Returns)
  const totalInflowKG = openingKG + receiptsKG + returnsKG;
  const totalInflowBags = openingBags + receiptsBags + returnsBags;

  // Calculate Outflows: (Issues + Damage + Shredding)
  const totalOutflowKG = issuesKG + damageKG + shreddingKG;
  const totalOutflowBags = issuesBags + damageBags + shreddingBags;

  // Exact Formula Breakdown: (Opening + Receipts + Returns) - (Issues + Damage + Shredding)
  const formulaCalculatedKG = Math.round((totalInflowKG - totalOutflowKG) * 100) / 100;
  const formulaCalculatedBags = totalInflowBags - totalOutflowBags;

  const transfersNetKG = transfersInKG - transfersOutKG;
  const transfersNetBags = transfersInBags - transfersOutBags;

  // Full Theoretical Ledger Balance including adjustments
  const theoreticalLedgerKG = Math.round((formulaCalculatedKG + adjustmentsKG + transfersNetKG) * 100) / 100;
  const theoreticalLedgerBags = formulaCalculatedBags + adjustmentsBags + transfersNetBags;

  // Stored Inventory Balance across active warehouse locations
  const matBalances = balances.filter((b) => b.materialId === material.id);
  const storedInventoryKG =
    Math.round(matBalances.reduce((sum, b) => sum + (Number(b.availableKG) || 0), 0) * 100) / 100;
  const storedInventoryBags = matBalances.reduce((sum, b) => sum + (Number(b.bulkBagsCount) || 0), 0);

  // Discrepancy between Stored Balance and Formula Calculated Balance:
  // Target Equation: (Opening + Receipts + Returns) - (Issues + Damage + Shredding) == Stored Inventory Balance
  const discrepancyKG = Math.round((storedInventoryKG - formulaCalculatedKG) * 100) / 100;
  const discrepancyBags = storedInventoryBags - formulaCalculatedBags;

  const hasDiscrepancy = Math.abs(discrepancyKG) >= 0.01 || discrepancyBags !== 0;

  return {
    materialId: material.id,
    materialCode: material.code,
    materialName: material.nameAr,
    category: material.category,
    unit: material.unit || 'KG',

    openingKG,
    openingBags,
    receiptsKG,
    receiptsBags,
    returnsKG,
    returnsBags,
    totalInflowKG,
    totalInflowBags,

    issuesKG,
    issuesBags,
    damageKG,
    damageBags,
    shreddingKG,
    shreddingBags,
    totalOutflowKG,
    totalOutflowBags,

    adjustmentsKG,
    adjustmentsBags,
    transfersNetKG,
    transfersNetBags,

    formulaCalculatedKG,
    formulaCalculatedBags,
    theoreticalLedgerKG,
    theoreticalLedgerBags,

    storedInventoryKG,
    storedInventoryBags,

    discrepancyKG,
    discrepancyBags,
    hasDiscrepancy,
    status: hasDiscrepancy ? 'DISCREPANCY' : 'MATCH',

    movementsCount: matMovements.length,
    lastMovementDate,
  };
}

export function performAutomatedInventoryReconciliation(
  materials: MaterialItem[],
  movements: InventoryMovement[],
  balances: InventoryBalance[]
): InventoryReconciliationSummary {
  const allReportItems: MaterialReconciliationItem[] = materials.map((mat) =>
    calculateMaterialReconciliation(mat, movements, balances)
  );

  // Filter specifically materials where formula does not match stored balance
  const discrepancyItems = allReportItems.filter((item) => item.hasDiscrepancy);

  let totalOpeningKG = 0;
  let totalReceiptsKG = 0;
  let totalReturnsKG = 0;
  let totalInflowsKG = 0;
  let totalIssuesKG = 0;
  let totalDamageKG = 0;
  let totalShreddingKG = 0;
  let totalOutflowsKG = 0;
  let totalTheoreticalKG = 0;
  let totalStoredKG = 0;
  let netDiscrepancyKG = 0;

  allReportItems.forEach((item) => {
    totalOpeningKG += item.openingKG;
    totalReceiptsKG += item.receiptsKG;
    totalReturnsKG += item.returnsKG;
    totalInflowsKG += item.totalInflowKG;
    totalIssuesKG += item.issuesKG;
    totalDamageKG += item.damageKG;
    totalShreddingKG += item.shreddingKG;
    totalOutflowsKG += item.totalOutflowKG;
    totalTheoreticalKG += item.formulaCalculatedKG;
    totalStoredKG += item.storedInventoryKG;
    netDiscrepancyKG += item.discrepancyKG;
  });

  const now = new Date();
  const auditTimestamp = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 5)}`;

  return {
    totalMaterials: materials.length,
    balancedCount: materials.length - discrepancyItems.length,
    discrepanciesCount: discrepancyItems.length,
    totalOpeningKG: Math.round(totalOpeningKG * 100) / 100,
    totalReceiptsKG: Math.round(totalReceiptsKG * 100) / 100,
    totalReturnsKG: Math.round(totalReturnsKG * 100) / 100,
    totalInflowsKG: Math.round(totalInflowsKG * 100) / 100,
    totalIssuesKG: Math.round(totalIssuesKG * 100) / 100,
    totalDamageKG: Math.round(totalDamageKG * 100) / 100,
    totalShreddingKG: Math.round(totalShreddingKG * 100) / 100,
    totalOutflowsKG: Math.round(totalOutflowsKG * 100) / 100,
    totalTheoreticalKG: Math.round(totalTheoreticalKG * 100) / 100,
    totalStoredKG: Math.round(totalStoredKG * 100) / 100,
    netDiscrepancyKG: Math.round(netDiscrepancyKG * 100) / 100,
    auditTimestamp,
    discrepancyItems,
    allReportItems,
  };
}

export function exportReconciliationCSV(summary: InventoryReconciliationSummary): string {
  const headers = [
    'Material Code',
    'Material Name',
    'Category',
    'Opening (KG)',
    'Receipts (KG)',
    'Returns (KG)',
    'Total Inflow (KG)',
    'Issues (KG)',
    'Damage (KG)',
    'Shredding (KG)',
    'Total Outflow (KG)',
    'Formula Balance (KG)',
    'Stored Balance (KG)',
    'Discrepancy (KG)',
    'Stored Bags',
    'Expected Bags',
    'Status',
  ];

  const rows = summary.allReportItems.map((item) => [
    `"${item.materialCode}"`,
    `"${item.materialName.replace(/"/g, '""')}"`,
    `"${item.category}"`,
    item.openingKG,
    item.receiptsKG,
    item.returnsKG,
    item.totalInflowKG,
    item.issuesKG,
    item.damageKG,
    item.shreddingKG,
    item.totalOutflowKG,
    item.formulaCalculatedKG,
    item.storedInventoryKG,
    item.discrepancyKG,
    item.storedInventoryBags,
    item.formulaCalculatedBags,
    `"${item.status}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
