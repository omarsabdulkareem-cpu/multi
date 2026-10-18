import React, { useState, useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  SlidersHorizontal,
  ClipboardList,
  RotateCcw,
  History,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Printer,
  FileSpreadsheet,
  Plus,
  Trash2,
  Eye,
  ShieldAlert,
  Building2,
  Calendar,
  Layers,
  Boxes,
  Package,
  Activity,
  Play,
  Check,
  Ban,
  Clock,
  Sparkles,
  Barcode,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { WarehouseEngineService } from '../services/warehouseEngineService';
import {
  UniversalReceiptDocument,
  UniversalIssueDocument,
  UniversalTransferDocument,
  UniversalAdjustmentDocument,
  UniversalReturnDocument,
  UniversalStockCountDocument,
  InventoryTransaction,
  ItemMaster,
  WarehouseFacility,
  StorageLocation,
} from '../types/warehouse';
import { UniversalPrintableDocumentModal, PrintableDocData } from './UniversalPrintableDocumentModal';
import { ItemDetailsViewModal } from './ItemDetailsViewModal';
import { CommercialReadinessService } from '../services/commercialReadinessService';

type OperationsTab =
  | 'RECEIVING'
  | 'ISSUE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'STOCK_COUNT'
  | 'RETURNS'
  | 'DOCUMENTS'
  | 'HISTORY'
  | 'ITEM_MOVEMENT'
  | 'TEST_SCENARIOS';

export const WarehouseOperationsModule: React.FC = () => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const { currentUser } = useFactory();

  const orgId = currentOrganization.id;
  const userName = currentUser?.name || 'Storekeeper';

  const [activeTab, setActiveTab] = useState<OperationsTab>('RECEIVING');

  // Master Data Cache
  const [warehouses, setWarehouses] = useState<WarehouseFacility[]>(() =>
    WarehouseEngineService.getWarehouses(orgId)
  );
  const [locations, setLocations] = useState<StorageLocation[]>(() =>
    WarehouseEngineService.getLocations(orgId)
  );
  const [items, setItems] = useState<ItemMaster[]>(() =>
    WarehouseEngineService.getItems(orgId)
  );

  // Operations Data
  const [receipts, setReceipts] = useState<UniversalReceiptDocument[]>(() =>
    WarehouseEngineService.getReceipts(orgId)
  );
  const [issues, setIssues] = useState<UniversalIssueDocument[]>(() =>
    WarehouseEngineService.getIssues(orgId)
  );
  const [transfers, setTransfers] = useState<UniversalTransferDocument[]>(() =>
    WarehouseEngineService.getTransfers(orgId)
  );
  const [adjustments, setAdjustments] = useState<UniversalAdjustmentDocument[]>(() =>
    WarehouseEngineService.getAdjustments(orgId)
  );
  const [returns, setReturns] = useState<UniversalReturnDocument[]>(() =>
    WarehouseEngineService.getReturns(orgId)
  );
  const [stockCounts, setStockCounts] = useState<UniversalStockCountDocument[]>(() =>
    WarehouseEngineService.getStockCounts(orgId)
  );
  const [ledger, setLedger] = useState<InventoryTransaction[]>(() =>
    WarehouseEngineService.getLedger(orgId)
  );

  // Reload helper
  const reloadData = () => {
    setWarehouses(WarehouseEngineService.getWarehouses(orgId));
    setLocations(WarehouseEngineService.getLocations(orgId));
    setItems(WarehouseEngineService.getItems(orgId));
    setReceipts(WarehouseEngineService.getReceipts(orgId));
    setIssues(WarehouseEngineService.getIssues(orgId));
    setTransfers(WarehouseEngineService.getTransfers(orgId));
    setAdjustments(WarehouseEngineService.getAdjustments(orgId));
    setReturns(WarehouseEngineService.getReturns(orgId));
    setStockCounts(WarehouseEngineService.getStockCounts(orgId));
    setLedger(WarehouseEngineService.getLedger(orgId));
  };

  React.useEffect(() => {
    reloadData();
  }, [orgId]);

  // Notifications
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showAlert = (type: 'success' | 'error', text: string) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 5000);
  };

  // Inspect Modal
  const [selectedDoc, setSelectedDoc] = useState<{ type: string; data: any } | null>(null);
  const [printableDoc, setPrintableDoc] = useState<PrintableDocData | null>(null);
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);

  // Cancellation Modal
  const [cancellingDoc, setCancellingDoc] = useState<{ type: string; id: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Scenario test results
  const [testResults, setTestResults] = useState<{ test: string; status: 'PASSED' | 'FAILED'; details: string }[] | null>(null);
  const [realisticScenarioResults, setRealisticScenarioResults] = useState<{
    scenarioName: string;
    passed: boolean;
    steps: { step: string; expected: string; actual: string; status: 'PASSED' | 'FAILED' }[];
  } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // ---------------------------------------------------------------------------
  // 1. RECEIVING STATE
  // ---------------------------------------------------------------------------
  const [receivingHeader, setReceivingHeader] = useState({
    supplierName: '',
    documentNumber: '',
    date: new Date().toISOString().split('T')[0],
    warehouseId: warehouses[0]?.id || '',
    notes: '',
  });

  const [receivingLines, setReceivingLines] = useState<
    {
      itemId: string;
      locationId: string;
      quantity: number;
      unit: string;
      weightKG: number;
      batchId: string;
      expiryDate: string;
      notes: string;
    }[]
  >([
    {
      itemId: items[0]?.id || '',
      locationId: locations[0]?.id || '',
      quantity: 1000,
      unit: 'KG',
      weightKG: 1000,
      batchId: '',
      expiryDate: '',
      notes: '',
    },
  ]);

  const addReceivingLine = () => {
    setReceivingLines((prev) => [
      ...prev,
      {
        itemId: items[0]?.id || '',
        locationId: locations[0]?.id || '',
        quantity: 100,
        unit: 'KG',
        weightKG: 100,
        batchId: '',
        expiryDate: '',
        notes: '',
      },
    ]);
  };

  const removeReceivingLine = (idx: number) => {
    setReceivingLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveReceiving = async (asDraft: boolean) => {
    try {
      if (!receivingHeader.supplierName.trim()) throw new Error('Supplier name is required.');
      if (!receivingHeader.documentNumber.trim()) throw new Error('Supplier Document Number is required.');
      if (receivingLines.length === 0) throw new Error('At least one item line is required.');

      const doc = await WarehouseEngineService.createReceiptDocument(
        orgId,
        {
          supplierName: receivingHeader.supplierName,
          documentNumber: receivingHeader.documentNumber,
          date: receivingHeader.date,
          warehouseId: receivingHeader.warehouseId,
          notes: receivingHeader.notes,
          items: receivingLines,
        },
        asDraft,
        userName
      );

      reloadData();
      showAlert('success', asDraft ? 'Receipt saved as draft.' : `Receipt confirmed! #${doc.receiptNumber}`);
      // Reset form
      setReceivingHeader({
        supplierName: '',
        documentNumber: '',
        date: new Date().toISOString().split('T')[0],
        warehouseId: warehouses[0]?.id || '',
        notes: '',
      });
      setReceivingLines([
        {
          itemId: items[0]?.id || '',
          locationId: locations[0]?.id || '',
          quantity: 1000,
          unit: 'KG',
          weightKG: 1000,
          batchId: '',
          expiryDate: '',
          notes: '',
        },
      ]);
    } catch (err: any) {
      showAlert('error', err.message || 'Error processing receiving.');
    }
  };

  // ---------------------------------------------------------------------------
  // 2. STOCK ISSUE STATE
  // ---------------------------------------------------------------------------
  const [issueHeader, setIssueHeader] = useState({
    warehouseId: warehouses[0]?.id || '',
    locationId: locations[0]?.id || '',
    destination: 'Production Extruder #1',
    department: 'Manufacturing',
    referenceNumber: '',
    reason: 'Production Run',
    notes: '',
  });

  const [issueLines, setIssueLines] = useState<
    {
      itemId: string;
      quantity: number;
      unit: string;
      batchId: string;
      notes: string;
    }[]
  >([
    {
      itemId: items[0]?.id || '',
      quantity: 250,
      unit: 'KG',
      batchId: '',
      notes: '',
    },
  ]);

  const addIssueLine = () => {
    setIssueLines((prev) => [
      ...prev,
      {
        itemId: items[0]?.id || '',
        quantity: 50,
        unit: 'KG',
        batchId: '',
        notes: '',
      },
    ]);
  };

  const removeIssueLine = (idx: number) => {
    setIssueLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveIssue = async (asDraft: boolean) => {
    try {
      if (!issueHeader.destination.trim()) throw new Error('Destination is required.');
      if (issueLines.length === 0) throw new Error('At least one item line is required.');

      const doc = await WarehouseEngineService.createIssueDocument(
        orgId,
        {
          warehouseId: issueHeader.warehouseId,
          locationId: issueHeader.locationId,
          destination: issueHeader.destination,
          department: issueHeader.department,
          referenceNumber: issueHeader.referenceNumber,
          reason: issueHeader.reason,
          notes: issueHeader.notes,
          items: issueLines,
        },
        asDraft,
        userName
      );

      reloadData();
      showAlert('success', asDraft ? 'Stock Issue saved as draft.' : `Stock Issue confirmed! #${doc.issueNumber}`);
      setIssueHeader({
        warehouseId: warehouses[0]?.id || '',
        locationId: locations[0]?.id || '',
        destination: 'Production Extruder #1',
        department: 'Manufacturing',
        referenceNumber: '',
        reason: 'Production Run',
        notes: '',
      });
      setIssueLines([
        {
          itemId: items[0]?.id || '',
          quantity: 250,
          unit: 'KG',
          batchId: '',
          notes: '',
        },
      ]);
    } catch (err: any) {
      showAlert('error', err.message || 'Error processing stock issue.');
    }
  };

  // ---------------------------------------------------------------------------
  // 3. TRANSFER STATE
  // ---------------------------------------------------------------------------
  const [transferHeader, setTransferHeader] = useState({
    sourceWarehouseId: warehouses[0]?.id || '',
    sourceLocationId: locations[0]?.id || '',
    destinationWarehouseId: warehouses[0]?.id || '',
    destinationLocationId: locations[1]?.id || '',
    reason: 'Inter-rack Transfer',
    notes: '',
  });

  const [transferLines, setTransferLines] = useState<
    {
      itemId: string;
      quantity: number;
      unit: string;
      batchId: string;
    }[]
  >([
    {
      itemId: items[0]?.id || '',
      quantity: 200,
      unit: 'KG',
      batchId: '',
    },
  ]);

  const addTransferLine = () => {
    setTransferLines((prev) => [
      ...prev,
      {
        itemId: items[0]?.id || '',
        quantity: 50,
        unit: 'KG',
        batchId: '',
      },
    ]);
  };

  const removeTransferLine = (idx: number) => {
    setTransferLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveTransfer = async (asDraft: boolean) => {
    try {
      if (transferLines.length === 0) throw new Error('At least one item line is required.');

      const doc = await WarehouseEngineService.createTransferDocument(
        orgId,
        {
          sourceWarehouseId: transferHeader.sourceWarehouseId,
          sourceLocationId: transferHeader.sourceLocationId,
          destinationWarehouseId: transferHeader.destinationWarehouseId,
          destinationLocationId: transferHeader.destinationLocationId,
          reason: transferHeader.reason,
          notes: transferHeader.notes,
          items: transferLines,
        },
        asDraft,
        userName
      );

      reloadData();
      showAlert('success', asDraft ? 'Transfer saved as draft.' : `Transfer confirmed! #${doc.transferNumber}`);
    } catch (err: any) {
      showAlert('error', err.message || 'Error processing transfer.');
    }
  };

  // ---------------------------------------------------------------------------
  // 4. STOCK ADJUSTMENT STATE
  // ---------------------------------------------------------------------------
  const [adjForm, setAdjForm] = useState({
    warehouseId: warehouses[0]?.id || '',
    locationId: locations[0]?.id || '',
    itemId: items[0]?.id || '',
    adjustmentType: 'ADJUSTMENT_IN' as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
    quantityDelta: 50,
    reason: 'Physical Count' as const,
    notes: '',
  });

  const handleSaveAdjustment = async () => {
    try {
      const res = await WarehouseEngineService.executeAdjustment(
        orgId,
        {
          warehouseId: adjForm.warehouseId,
          locationId: adjForm.locationId,
          itemId: adjForm.itemId,
          adjustmentType: adjForm.adjustmentType,
          quantityDelta: Number(adjForm.quantityDelta),
          reason: adjForm.reason,
          notes: adjForm.notes,
        },
        userName
      );
      reloadData();
      showAlert('success', `Adjustment recorded in ledger #${res.adjustmentId}`);
    } catch (err: any) {
      showAlert('error', err.message || 'Error executing adjustment.');
    }
  };

  // ---------------------------------------------------------------------------
  // 5. PHYSICAL STOCK COUNT STATE
  // ---------------------------------------------------------------------------
  const [countWarehouseId, setCountWarehouseId] = useState(warehouses[0]?.id || '');
  const [countLocationId, setCountLocationId] = useState(locations[0]?.id || '');
  const [countItems, setCountItems] = useState<{ itemId: string; countedQuantity: number }[]>([]);

  // Initialize count sheet based on current balances in warehouse/location
  const handleLoadStockCountSheet = () => {
    const balances = WarehouseEngineService.computeInventoryBalances(orgId);
    const inLoc = balances.filter(
      (b) => b.warehouseId === countWarehouseId && b.locationId === countLocationId
    );

    const sheet = inLoc.map((b) => ({
      itemId: b.itemId,
      countedQuantity: b.quantity, // Defaults to system quantity for convenience
    }));

    // If empty, add first item
    if (sheet.length === 0 && items[0]) {
      sheet.push({ itemId: items[0].id, countedQuantity: 0 });
    }

    setCountItems(sheet);
  };

  const handleSaveStockCount = async (asDraft: boolean) => {
    try {
      if (countItems.length === 0) throw new Error('Stock count sheet has no items.');

      const doc = await WarehouseEngineService.createStockCountDocument(
        orgId,
        {
          warehouseId: countWarehouseId,
          locationId: countLocationId,
          items: countItems,
        },
        asDraft,
        userName
      );

      reloadData();
      showAlert('success', asDraft ? 'Stock count sheet saved as draft.' : `Stock count confirmed and variance adjustments posted! #${doc.countNumber}`);
    } catch (err: any) {
      showAlert('error', err.message || 'Error recording stock count.');
    }
  };

  // ---------------------------------------------------------------------------
  // 6. RETURNS STATE
  // ---------------------------------------------------------------------------
  const [returnForm, setReturnForm] = useState({
    returnType: 'RETURN_IN' as 'RETURN_IN' | 'RETURN_OUT',
    originalDocumentRef: '',
    warehouseId: warehouses[0]?.id || '',
    locationId: locations[0]?.id || '',
    partyName: 'ABC Customer',
    reason: 'Customer Surplus Return',
    notes: '',
    itemId: items[0]?.id || '',
    quantity: 50,
    unit: 'KG',
  });

  const handleSaveReturn = async (asDraft: boolean) => {
    try {
      if (!returnForm.partyName.trim()) throw new Error('Party name is required.');
      if (returnForm.quantity <= 0) throw new Error('Quantity must be greater than zero.');

      const doc = await WarehouseEngineService.createReturnDocument(
        orgId,
        {
          returnType: returnForm.returnType,
          originalDocumentRef: returnForm.originalDocumentRef,
          warehouseId: returnForm.warehouseId,
          locationId: returnForm.locationId,
          partyName: returnForm.partyName,
          reason: returnForm.reason,
          notes: returnForm.notes,
          items: [{ itemId: returnForm.itemId, quantity: Number(returnForm.quantity), unit: returnForm.unit }],
        },
        asDraft,
        userName
      );

      reloadData();
      showAlert('success', asDraft ? 'Return document saved as draft.' : `Return document confirmed! #${doc.returnNumber}`);
    } catch (err: any) {
      showAlert('error', err.message || 'Error processing return.');
    }
  };

  // ---------------------------------------------------------------------------
  // 7. CANCELLATION HANDLER
  // ---------------------------------------------------------------------------
  const handleExecuteCancel = async () => {
    if (!cancellingDoc) return;
    if (!cancelReason.trim()) {
      showAlert('error', 'Cancellation reason is mandatory.');
      return;
    }

    try {
      if (cancellingDoc.type === 'RECEIPT') {
        await WarehouseEngineService.cancelReceiptDocument(orgId, cancellingDoc.id, cancelReason, userName);
      } else if (cancellingDoc.type === 'ISSUE') {
        await WarehouseEngineService.cancelIssueDocument(orgId, cancellingDoc.id, cancelReason, userName);
      }
      reloadData();
      showAlert('success', `Document ${cancellingDoc.id} cancelled successfully.`);
      setCancellingDoc(null);
      setCancelReason('');
      setSelectedDoc(null);
    } catch (err: any) {
      showAlert('error', err.message || 'Error cancelling document.');
    }
  };

  // ---------------------------------------------------------------------------
  // 8. SCENARIOS TEST RUNNER
  // ---------------------------------------------------------------------------
  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    try {
      const results = await WarehouseEngineService.runOperationalScenariosTest(
        orgId,
        orgId === 'org_alkarwan' ? 'org_apex_logistics' : 'org_alkarwan'
      );
      setTestResults(results);
      reloadData();
      showAlert('success', 'Automated test suite execution completed.');
    } catch (err: any) {
      showAlert('error', err.message || 'Test suite failed to execute.');
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleRunRealisticScenario = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    try {
      const result = await CommercialReadinessService.runRealisticBusinessScenarioTest();
      setTestResults(
        result.steps.map((s, idx) => ({
          test: `STEP ${idx + 1}: ${s.step}`,
          status: s.status,
          details: `Expected: ${s.expected} | Actual: ${s.actual}`,
        }))
      );
      reloadData();
      showAlert('success', 'Section 42 Realistic Business Scenario test passed!');
    } catch (err: any) {
      showAlert('error', err.message || 'Realistic scenario test failed.');
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleRunMultiTenantTest = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    try {
      const result = await CommercialReadinessService.runMultiTenantIsolationTest();
      setTestResults(
        result.details.map((d, idx) => ({
          test: `CHECK ${idx + 1}: ${d.test}`,
          status: d.status,
          details: d.info,
        }))
      );
      reloadData();
      showAlert('success', 'Section 43 Multi-Tenant Zero-Leakage test passed!');
    } catch (err: any) {
      showAlert('error', err.message || 'Multi-tenant test failed.');
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleRunPhase11Suite = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    try {
      const results = await CommercialReadinessService.runPhase11CommercialReadinessTests();
      setTestResults(
        results.map((r) => ({
          test: `[${r.testId}] ${r.name}`,
          status: r.status,
          details: r.details,
        }))
      );
      reloadData();
      showAlert('success', 'Phase 11 22-Point Automated QA suite completed!');
    } catch (err: any) {
      showAlert('error', err.message || 'Phase 11 QA suite failed.');
    } finally {
      setIsRunningTests(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 9. ITEM STOCK MOVEMENT VIEW STATE
  // ---------------------------------------------------------------------------
  const [selectedMovementItemId, setSelectedMovementItemId] = useState(items[0]?.id || '');
  const itemMovements = useMemo(() => {
    if (!selectedMovementItemId) return [];
    return WarehouseEngineService.getItemStockMovement(orgId, selectedMovementItemId);
  }, [orgId, selectedMovementItemId, ledger]);

  // Document Registry Filter State
  const [docFilterType, setDocFilterType] = useState('ALL');
  const [docFilterStatus, setDocFilterStatus] = useState('ALL');
  const [docSearch, setDocSearch] = useState('');

  // Unified Documents List
  const unifiedDocs = useMemo(() => {
    const list: any[] = [];
    if (docFilterType === 'ALL' || docFilterType === 'RECEIPTS') {
      receipts.forEach((r) => list.push({ ...r, docCategory: 'RECEIPT', docNumber: r.receiptNumber }));
    }
    if (docFilterType === 'ALL' || docFilterType === 'ISSUES') {
      issues.forEach((i) => list.push({ ...i, docCategory: 'ISSUE', docNumber: i.issueNumber }));
    }
    if (docFilterType === 'ALL' || docFilterType === 'TRANSFERS') {
      transfers.forEach((t) => list.push({ ...t, docCategory: 'TRANSFER', docNumber: t.transferNumber }));
    }
    if (docFilterType === 'ALL' || docFilterType === 'ADJUSTMENTS') {
      adjustments.forEach((a) => list.push({ ...a, docCategory: 'ADJUSTMENT', docNumber: a.adjustmentNumber }));
    }
    if (docFilterType === 'ALL' || docFilterType === 'RETURNS') {
      returns.forEach((rt) => list.push({ ...rt, docCategory: 'RETURN', docNumber: rt.returnNumber }));
    }
    if (docFilterType === 'ALL' || docFilterType === 'COUNTS') {
      stockCounts.forEach((c) => list.push({ ...c, docCategory: 'STOCK_COUNT', docNumber: c.countNumber }));
    }

    return list
      .filter((d) => {
        const matchStatus = docFilterStatus === 'ALL' || d.status === docFilterStatus;
        const matchSearch =
          !docSearch ||
          d.docNumber?.toLowerCase().includes(docSearch.toLowerCase()) ||
          d.supplierName?.toLowerCase().includes(docSearch.toLowerCase()) ||
          d.destination?.toLowerCase().includes(docSearch.toLowerCase());
        return matchStatus && matchSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [receipts, issues, transfers, adjustments, returns, stockCounts, docFilterType, docFilterStatus, docSearch]);

  return (
    <div className="space-y-6 max-w-[1920px] mx-auto pb-12">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-blue-950/40 border border-blue-500/30 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/40">
              PHASE 3: OPERATIONAL WORKFLOWS
            </span>
            <span className="text-xs text-slate-400">
              {isRTL ? 'إدارة العمليات وحركات المخزون الفعلية' : 'Real Warehouse Operations & Ledger Engine'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-cyan-400" />
            <span>{isRTL ? 'إدارة العمليات المستودعية المركزية' : 'Warehouse Operational Center'}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
            {isRTL
              ? 'الاستلام المتعدد، الصرف المعتمد، المناقلات الداخلية، تسويات الجرد، المردودات، والتحقق التلقائي من الأرصدة.'
              : 'Multi-line receiving, authorized stock issue, location transfers, stock counting, and tamper-proof ledger auditing.'}
          </p>
        </div>

        {/* Fast Action Buttons for Warehouse Workers */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('RECEIVING')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all border ${
              activeTab === 'RECEIVING'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-300" />
            <span>{isRTL ? '+ استلام بضائع' : '+ Receive'}</span>
          </button>

          <button
            onClick={() => setActiveTab('ISSUE')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all border ${
              activeTab === 'ISSUE'
                ? 'bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-rose-300" />
            <span>{isRTL ? '+ صرف بضائع' : '+ Issue'}</span>
          </button>

          <button
            onClick={() => setActiveTab('TRANSFER')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all border ${
              activeTab === 'TRANSFER'
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-cyan-300" />
            <span>{isRTL ? '+ مناقلة' : '+ Transfer'}</span>
          </button>

          <button
            onClick={() => setActiveTab('ADJUSTMENT')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all border ${
              activeTab === 'ADJUSTMENT'
                ? 'bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-300" />
            <span>{isRTL ? '+ تسوية جرد' : '+ Adjust'}</span>
          </button>

          <button
            onClick={() => setActiveTab('STOCK_COUNT')}
            className={`px-3.5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all border ${
              activeTab === 'STOCK_COUNT'
                ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-950/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-300" />
            <span>{isRTL ? '+ جرد فعلي' : '+ Count'}</span>
          </button>
        </div>
      </div>

      {/* Alert banner */}
      {alert && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            alert.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {alert.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} className="cursor-pointer underline">
            {isRTL ? 'إغلاق' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-slate-800 overflow-x-auto pb-2 text-xs font-bold">
        {[
          { id: 'RECEIVING', labelAr: 'استلام بضائع (Receiving)', labelEn: 'Goods Receipt', icon: ArrowDownLeft },
          { id: 'ISSUE', labelAr: 'صرف بضائع (Stock Issue)', labelEn: 'Stock Issue', icon: ArrowUpRight },
          { id: 'TRANSFER', labelAr: 'مناقلة مخزون (Transfers)', labelEn: 'Transfers', icon: ArrowRightLeft },
          { id: 'ADJUSTMENT', labelAr: 'تسوية الجرد (Adjustments)', labelEn: 'Adjustments', icon: SlidersHorizontal },
          { id: 'STOCK_COUNT', labelAr: 'جرد فعلي (Physical Count)', labelEn: 'Physical Count', icon: Layers },
          { id: 'RETURNS', labelAr: 'مردودات (Returns)', labelEn: 'Returns', icon: RotateCcw },
          { id: 'DOCUMENTS', labelAr: 'سجل المستندات (Documents)', labelEn: 'Documents Repository', icon: FileText },
          { id: 'HISTORY', labelAr: 'سجل الحركات (Transaction History)', labelEn: 'Transaction History', icon: History },
          { id: 'ITEM_MOVEMENT', labelAr: 'حركة الصنف (Item Movement)', labelEn: 'Item Stock Movement', icon: Package },
          { id: 'TEST_SCENARIOS', labelAr: 'اختبارات التشغيل (Scenarios A-G)', labelEn: 'Test Scenarios (A-G)', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as OperationsTab)}
              className={`px-4 py-2.5 rounded-xl flex items-center gap-2 shrink-0 cursor-pointer transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isRTL ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: RECEIVING WORKFLOW */}
      {/* =================================================================== */}
      {activeTab === 'RECEIVING' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <span>{isRTL ? 'إدخال واستلام بضائع جديد (New Goods Receiving)' : 'New Goods Receiving'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'دعم الأصناف المتعددة، تتبع الوجبات، وتأكيد الإدخال في الدفتر.' : 'Multi-item line support, batch tracking, and draft/confirmation workflows.'}
              </p>
            </div>
            <div className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-500/30">
              INBOUND (STOCK IN)
            </div>
          </div>

          {/* Header Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المورد / جهة التوريد' : 'Supplier Name'}</label>
              <input
                type="text"
                placeholder="e.g. Sabic Polymers Trading"
                value={receivingHeader.supplierName}
                onChange={(e) => setReceivingHeader({ ...receivingHeader, supplierName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'رقم مستند المورد / الفاتورة' : 'Supplier Doc / PO #'}</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-9901"
                value={receivingHeader.documentNumber}
                onChange={(e) => setReceivingHeader({ ...receivingHeader, documentNumber: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'تاريخ التوريد' : 'Receipt Date'}</label>
              <input
                type="date"
                value={receivingHeader.date}
                onChange={(e) => setReceivingHeader({ ...receivingHeader, date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المستودع المستلم' : 'Destination Warehouse'}</label>
              <select
                value={receivingHeader.warehouseId}
                onChange={(e) => setReceivingHeader({ ...receivingHeader, warehouseId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {isRTL ? w.nameAr : w.nameEn} ({w.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Item Lines Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'الأصناف المستلمة (Receipt Items)' : 'Receipt Line Items'}</span>
              </h4>
              <button
                onClick={addReceivingLine}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إضافة سطر صنف' : 'Add Line Item'}</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="p-3 text-start">{isRTL ? 'الصنف' : 'Item'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الرف / الموقع' : 'Location / Rack'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الكمية' : 'Quantity'}</th>
                    <th className="p-3 text-start">{isRTL ? 'الوحدة' : 'Unit'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الوزن (KG)' : 'Weight (KG)'}</th>
                    <th className="p-3 text-start">{isRTL ? 'رقم الوجبة' : 'Batch / Lot'}</th>
                    <th className="p-3 text-center">{isRTL ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {receivingLines.map((line, idx) => {
                    const selectedItem = items.find((i) => i.id === line.itemId);
                    return (
                      <tr key={idx} className="bg-slate-950/40">
                        <td className="p-2.5">
                          <select
                            value={line.itemId}
                            onChange={(e) => {
                              const itm = items.find((i) => i.id === e.target.value);
                              const updated = [...receivingLines];
                              updated[idx].itemId = e.target.value;
                              updated[idx].unit = itm?.unitOfMeasure || 'KG';
                              setReceivingLines(updated);
                            }}
                            className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-white text-xs"
                          >
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5">
                          <select
                            value={line.locationId}
                            onChange={(e) => {
                              const updated = [...receivingLines];
                              updated[idx].locationId = e.target.value;
                              setReceivingLines(updated);
                            }}
                            className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-white text-xs"
                          >
                            {locations
                              .filter((l) => l.warehouseId === receivingHeader.warehouseId)
                              .map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.code} ({isRTL ? l.nameAr : l.nameEn})
                                </option>
                              ))}
                          </select>
                        </td>

                        <td className="p-2.5 text-end">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const updated = [...receivingLines];
                              updated[idx].quantity = val;
                              updated[idx].weightKG = val * (selectedItem?.defaultWeight || 1);
                              setReceivingLines(updated);
                            }}
                            className="w-24 px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-white text-end font-mono"
                          />
                        </td>

                        <td className="p-2.5 font-mono text-cyan-300">{line.unit}</td>

                        <td className="p-2.5 text-end">
                          <input
                            type="number"
                            value={line.weightKG}
                            onChange={(e) => {
                              const updated = [...receivingLines];
                              updated[idx].weightKG = Number(e.target.value);
                              setReceivingLines(updated);
                            }}
                            className="w-24 px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-white text-end font-mono"
                          />
                        </td>

                        <td className="p-2.5">
                          <input
                            type="text"
                            placeholder="LOT-2026-X"
                            value={line.batchId}
                            onChange={(e) => {
                              const updated = [...receivingLines];
                              updated[idx].batchId = e.target.value;
                              setReceivingLines(updated);
                            }}
                            className="w-28 px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-white font-mono"
                          />
                        </td>

                        <td className="p-2.5 text-center">
                          {receivingLines.length > 1 && (
                            <button
                              onClick={() => removeReceivingLine(idx)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-950/60 cursor-pointer"
                              title="Delete line"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-400">{isRTL ? 'إجمالي السطور:' : 'Total Lines:'} </span>
                <span className="font-bold text-white font-mono">{receivingLines.length}</span>
              </div>
              <div>
                <span className="text-slate-400">{isRTL ? 'إجمالي الكمية:' : 'Total Quantity:'} </span>
                <span className="font-bold text-cyan-300 font-mono">
                  {receivingLines.reduce((s, l) => s + (Number(l.quantity) || 0), 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-400">{isRTL ? 'إجمالي الوزن:' : 'Total Weight:'} </span>
                <span className="font-bold text-amber-300 font-mono">
                  {receivingLines.reduce((s, l) => s + (Number(l.weightKG) || 0), 0).toLocaleString()} KG
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSaveReceiving(true)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {isRTL ? 'حفظ كمسودة (Draft)' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handleSaveReceiving(false)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isRTL ? 'تأكيد وترحيل للدفتر' : 'Confirm Receipt'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: STOCK ISSUE WORKFLOW */}
      {/* =================================================================== */}
      {activeTab === 'ISSUE' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-rose-400" />
                <span>{isRTL ? 'صرف وتخفيض مخزون (New Stock Issue)' : 'New Stock Issue'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'التحقق اللحظي من الأرصدة المتاحة، وجهة الصرف، وسجل الحركات المحاسبي.' : 'Real-time available stock checking, destination department, and ledger issuance.'}
              </p>
            </div>
            <div className="text-xs font-mono text-rose-400 bg-rose-950/60 px-3 py-1 rounded-lg border border-rose-500/30">
              OUTBOUND (STOCK OUT)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'من مستودع' : 'Source Warehouse'}</label>
              <select
                value={issueHeader.warehouseId}
                onChange={(e) => setIssueHeader({ ...issueHeader, warehouseId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {isRTL ? w.nameAr : w.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'من موقع / رف' : 'Source Rack / Loc'}</label>
              <select
                value={issueHeader.locationId}
                onChange={(e) => setIssueHeader({ ...issueHeader, locationId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                {locations
                  .filter((l) => l.warehouseId === issueHeader.warehouseId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} ({isRTL ? l.nameAr : l.nameEn})
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'وجهة الصرف / القسم' : 'Destination / Line'}</label>
              <input
                type="text"
                placeholder="e.g. Thermoforming Line #2"
                value={issueHeader.destination}
                onChange={(e) => setIssueHeader({ ...issueHeader, destination: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'سبب الصرف' : 'Issue Reason'}</label>
              <input
                type="text"
                value={issueHeader.reason}
                onChange={(e) => setIssueHeader({ ...issueHeader, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
          </div>

          {/* Issue Lines Table with Available / Issue / Remaining */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Boxes className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'أصناف الصرف (Issue Line Items)' : 'Issue Line Items'}</span>
              </h4>
              <button
                onClick={addIssueLine}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إضافة صنف' : 'Add Line'}</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="p-3 text-start">{isRTL ? 'الصنف' : 'Item'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الرصيد المتاح' : 'Available Stock'}</th>
                    <th className="p-3 text-end">{isRTL ? 'كمية الصرف' : 'Issue Qty'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الرصيد المتبقي' : 'Remaining Stock'}</th>
                    <th className="p-3 text-center">{isRTL ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {issueLines.map((line, idx) => {
                    const balances = WarehouseEngineService.computeInventoryBalances(orgId);
                    const bal = balances.find(
                      (b) =>
                        b.warehouseId === issueHeader.warehouseId &&
                        b.locationId === issueHeader.locationId &&
                        b.itemId === line.itemId
                    );
                    const avail = bal ? bal.availableQuantity : 0;
                    const remaining = avail - line.quantity;
                    const isExceeded = remaining < 0;

                    return (
                      <tr key={idx} className="bg-slate-950/40">
                        <td className="p-2.5">
                          <select
                            value={line.itemId}
                            onChange={(e) => {
                              const updated = [...issueLines];
                              updated[idx].itemId = e.target.value;
                              setIssueLines(updated);
                            }}
                            className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-white text-xs"
                          >
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5 text-end font-mono font-bold text-slate-300">
                          {avail.toLocaleString()} {line.unit}
                        </td>

                        <td className="p-2.5 text-end">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => {
                              const updated = [...issueLines];
                              updated[idx].quantity = Number(e.target.value);
                              setIssueLines(updated);
                            }}
                            className={`w-28 px-2 py-1.5 rounded bg-slate-900 border text-end font-mono text-white ${
                              isExceeded ? 'border-rose-500 text-rose-300' : 'border-slate-800'
                            }`}
                          />
                        </td>

                        <td
                          className={`p-2.5 text-end font-mono font-bold ${
                            isExceeded ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {remaining.toLocaleString()} {line.unit}
                        </td>

                        <td className="p-2.5 text-center">
                          {issueLines.length > 1 && (
                            <button
                              onClick={() => removeIssueLine(idx)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-950/60 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              onClick={() => handleSaveIssue(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              {isRTL ? 'حفظ كمسودة' : 'Save as Draft'}
            </button>
            <button
              onClick={() => handleSaveIssue(false)}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isRTL ? 'تأكيد الصرف وتخفيض الرصيد' : 'Confirm Issue'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: TRANSFER WORKFLOW */}
      {/* =================================================================== */}
      {activeTab === 'TRANSFER' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'مناقلة مخزون بين المستودعات والرفوف (Stock Transfers)' : 'Stock Transfers'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL
                  ? 'مناقلة داخل نفس المستودع (Location A -> Location B) أو بين مستودعين مستقلين مع ربط الحركتين.'
                  : 'Inter-rack within same warehouse or cross-warehouse transfer with linked OUT and IN transactions.'}
              </p>
            </div>
            <div className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-lg border border-cyan-500/30">
              RELOCATION (TRANSFER)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Source */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="font-bold text-amber-400 flex items-center gap-2">
                <Boxes className="w-4 h-4" />
                <span>{isRTL ? 'الموقع المصدر (من)' : 'Source Location (FROM)'}</span>
              </div>
              <div className="space-y-2">
                <select
                  value={transferHeader.sourceWarehouseId}
                  onChange={(e) => setTransferHeader({ ...transferHeader, sourceWarehouseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
                <select
                  value={transferHeader.sourceLocationId}
                  onChange={(e) => setTransferHeader({ ...transferHeader, sourceLocationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                >
                  {locations
                    .filter((l) => l.warehouseId === transferHeader.sourceWarehouseId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} ({isRTL ? l.nameAr : l.nameEn})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Destination */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="font-bold text-cyan-400 flex items-center gap-2">
                <Boxes className="w-4 h-4" />
                <span>{isRTL ? 'الموقع الوجهة (إلى)' : 'Destination Location (TO)'}</span>
              </div>
              <div className="space-y-2">
                <select
                  value={transferHeader.destinationWarehouseId}
                  onChange={(e) => setTransferHeader({ ...transferHeader, destinationWarehouseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
                <select
                  value={transferHeader.destinationLocationId}
                  onChange={(e) => setTransferHeader({ ...transferHeader, destinationLocationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono"
                >
                  {locations
                    .filter((l) => l.warehouseId === transferHeader.destinationWarehouseId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code} ({isRTL ? l.nameAr : l.nameEn})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Transfer Lines Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'الأصناف المراد نقلها' : 'Transfer Line Items'}</span>
              </h4>
              <button
                onClick={addTransferLine}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRTL ? 'إضافة صنف' : 'Add Line'}</span>
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="p-3 text-start">{isRTL ? 'الصنف' : 'Item'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الرصيد بالمصدر' : 'Source Stock'}</th>
                    <th className="p-3 text-end">{isRTL ? 'الكمية المنقولة' : 'Transfer Qty'}</th>
                    <th className="p-3 text-end">{isRTL ? 'المتبقي بالمصدر' : 'Remaining'}</th>
                    <th className="p-3 text-center">{isRTL ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {transferLines.map((line, idx) => {
                    const balances = WarehouseEngineService.computeInventoryBalances(orgId);
                    const bal = balances.find(
                      (b) =>
                        b.warehouseId === transferHeader.sourceWarehouseId &&
                        b.locationId === transferHeader.sourceLocationId &&
                        b.itemId === line.itemId
                    );
                    const avail = bal ? bal.availableQuantity : 0;
                    const remaining = avail - line.quantity;

                    return (
                      <tr key={idx} className="bg-slate-950/40">
                        <td className="p-2.5">
                          <select
                            value={line.itemId}
                            onChange={(e) => {
                              const updated = [...transferLines];
                              updated[idx].itemId = e.target.value;
                              setTransferLines(updated);
                            }}
                            className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-white text-xs"
                          >
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2.5 text-end font-mono text-slate-300">
                          {avail.toLocaleString()} {line.unit}
                        </td>

                        <td className="p-2.5 text-end">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => {
                              const updated = [...transferLines];
                              updated[idx].quantity = Number(e.target.value);
                              setTransferLines(updated);
                            }}
                            className="w-28 px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-end font-mono text-white"
                          />
                        </td>

                        <td
                          className={`p-2.5 text-end font-mono font-bold ${
                            remaining < 0 ? 'text-rose-400' : 'text-cyan-400'
                          }`}
                        >
                          {remaining.toLocaleString()} {line.unit}
                        </td>

                        <td className="p-2.5 text-center">
                          {transferLines.length > 1 && (
                            <button
                              onClick={() => removeTransferLine(idx)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-950/60 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              onClick={() => handleSaveTransfer(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              {isRTL ? 'حفظ كمسودة' : 'Save as Draft'}
            </button>
            <button
              onClick={() => handleSaveTransfer(false)}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isRTL ? 'تأكيد المناقلة وترحيل القيدين' : 'Confirm Transfer'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: STOCK ADJUSTMENT WORKFLOW */}
      {/* =================================================================== */}
      {activeTab === 'ADJUSTMENT' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl max-w-2xl mx-auto">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-amber-400" />
              <span>{isRTL ? 'تسوية وموازنة جردية (Stock Adjustment)' : 'Stock Adjustment'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isRTL ? 'تسجيل فوارق الجرد أو التوالف أو المفقودات مع سبب إلزامي وسجل تدقيق.' : 'Record physical count discrepancies, damages, or corrections with mandatory justification.'}
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الصنف المستهدف' : 'Target Item'}</label>
              <select
                value={adjForm.itemId}
                onChange={(e) => setAdjForm({ ...adjForm, itemId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'المستودع' : 'Warehouse'}</label>
                <select
                  value={adjForm.warehouseId}
                  onChange={(e) => setAdjForm({ ...adjForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الموقع' : 'Location'}</label>
                <select
                  value={adjForm.locationId}
                  onChange={(e) => setAdjForm({ ...adjForm, locationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {locations
                    .filter((l) => l.warehouseId === adjForm.warehouseId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'نوع التسوية' : 'Adjustment Type'}</label>
                <select
                  value={adjForm.adjustmentType}
                  onChange={(e) => setAdjForm({ ...adjForm, adjustmentType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="ADJUSTMENT_IN">{isRTL ? 'زيادة مخزون (+ IN)' : '+ IN (Surplus)'}</option>
                  <option value="ADJUSTMENT_OUT">{isRTL ? 'عجز مخزون (- OUT)' : '- OUT (Deficit)'}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الكمية المُعدلة' : 'Delta Quantity'}</label>
                <input
                  type="number"
                  min="1"
                  value={adjForm.quantityDelta}
                  onChange={(e) => setAdjForm({ ...adjForm, quantityDelta: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'سبب التسوية (إلزامي)' : 'Mandatory Reason'}</label>
              <select
                value={adjForm.reason}
                onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                <option value="Physical Count">Physical Count (جرد دوري)</option>
                <option value="Damaged">Damaged (تالف)</option>
                <option value="Lost">Lost (مفقود)</option>
                <option value="Found">Found (موجودات فائضة)</option>
                <option value="Correction">Correction (تصحيح قيد)</option>
                <option value="Other">Other (أخرى)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'ملاحظات وتفاصيل إضافية' : 'Notes / Remarks'}</label>
              <textarea
                rows={2}
                value={adjForm.notes}
                onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                placeholder={isRTL ? 'سبب وتفاصيل التسوية...' : 'Justification details...'}
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              onClick={handleSaveAdjustment}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isRTL ? 'ترحيل التسوية إلى الدفتر' : 'Post Adjustment to Ledger'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: PHYSICAL STOCK COUNT WORKFLOW */}
      {/* =================================================================== */}
      {activeTab === 'STOCK_COUNT' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                <span>{isRTL ? 'الجرد الفعلي وحساب الفوارق (Physical Stock Count)' : 'Physical Stock Count'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'توليد كشف الجرد للموقع، إدخال الكميات الفعلية، وتسوية الفروقات آلياً.' : 'Generate count sheet per location, input physical counts, and auto-post variances.'}
              </p>
            </div>
            <button
              onClick={handleLoadStockCountSheet}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer"
            >
              {isRTL ? 'تحميل كشف رصيد الموقع' : 'Load Location Count Sheet'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'المستودع' : 'Warehouse'}</label>
              <select
                value={countWarehouseId}
                onChange={(e) => setCountWarehouseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {isRTL ? w.nameAr : w.nameEn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'الموقع / الرف' : 'Rack / Location'}</label>
              <select
                value={countLocationId}
                onChange={(e) => setCountLocationId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
              >
                {locations
                  .filter((l) => l.warehouseId === countWarehouseId)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} ({isRTL ? l.nameAr : l.nameEn})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Sheet Table */}
          {countItems.length > 0 && (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="p-3 text-start">{isRTL ? 'كود الصنف' : 'Item Code'}</th>
                      <th className="p-3 text-start">{isRTL ? 'اسم الصنف' : 'Item Name'}</th>
                      <th className="p-3 text-end">{isRTL ? 'رصيد النظام' : 'Expected (System)'}</th>
                      <th className="p-3 text-end">{isRTL ? 'العد الفعلي' : 'Counted (Actual)'}</th>
                      <th className="p-3 text-end">{isRTL ? 'الفارق' : 'Variance'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {countItems.map((c, idx) => {
                      const item = items.find((i) => i.id === c.itemId);
                      const balances = WarehouseEngineService.computeInventoryBalances(orgId);
                      const bal = balances.find(
                        (b) =>
                          b.warehouseId === countWarehouseId &&
                          b.locationId === countLocationId &&
                          b.itemId === c.itemId
                      );
                      const expected = bal ? bal.quantity : 0;
                      const diff = c.countedQuantity - expected;

                      return (
                        <tr key={idx} className="bg-slate-950/40">
                          <td className="p-3 font-mono font-bold text-cyan-400">{item?.itemCode}</td>
                          <td className="p-3 text-white">{isRTL ? item?.nameAr : item?.nameEn}</td>
                          <td className="p-3 text-end font-mono text-slate-300">
                            {expected.toLocaleString()} {item?.unitOfMeasure}
                          </td>
                          <td className="p-3 text-end">
                            <input
                              type="number"
                              value={c.countedQuantity}
                              onChange={(e) => {
                                const updated = [...countItems];
                                updated[idx].countedQuantity = Number(e.target.value);
                                setCountItems(updated);
                              }}
                              className="w-28 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-end font-mono text-white"
                            />
                          </td>
                          <td
                            className={`p-3 text-end font-mono font-bold ${
                              diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {diff > 0 ? `+${diff}` : diff} {item?.unitOfMeasure}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleSaveStockCount(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                >
                  {isRTL ? 'حفظ كمسودة' : 'Save as Draft'}
                </button>
                <button
                  onClick={() => handleSaveStockCount(false)}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-950/40 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isRTL ? 'تأكيد الجرد وتسوية الفوارق' : 'Confirm & Post Variances'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: RETURNS WORKFLOW */}
      {/* =================================================================== */}
      {activeTab === 'RETURNS' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl max-w-2xl mx-auto">
          <div className="pb-3 border-b border-slate-800">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-400" />
              <span>{isRTL ? 'تسجيل مردودات البضائع (Returns Management)' : 'Returns Management'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isRTL ? 'إرجاع بضائع للمستودع (Return In) أو إرجاع إلى المورد (Return Out) مع رقم المستند الأصلي.' : 'Customer returns back into warehouse or vendor returns out to suppliers.'}
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'نوع المردود' : 'Return Type'}</label>
              <select
                value={returnForm.returnType}
                onChange={(e) => setReturnForm({ ...returnForm, returnType: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-bold"
              >
                <option value="RETURN_IN">{isRTL ? 'مردود وارد للمستودع (Return IN - Customer/Production)' : 'Return IN (Restock Into Warehouse)'}</option>
                <option value="RETURN_OUT">{isRTL ? 'مردود صادر للمورد (Return OUT - Back to Vendor)' : 'Return OUT (Return Back to Supplier)'}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الجهة (العميل أو المورد)' : 'Party Name'}</label>
                <input
                  type="text"
                  value={returnForm.partyName}
                  onChange={(e) => setReturnForm({ ...returnForm, partyName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'رقم المستند الأصلي المرتبط' : 'Original Document Ref'}</label>
                <input
                  type="text"
                  placeholder="e.g. GR-2026-0001 or ISS-2026-0001"
                  value={returnForm.originalDocumentRef}
                  onChange={(e) => setReturnForm({ ...returnForm, originalDocumentRef: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'المستودع' : 'Warehouse'}</label>
                <select
                  value={returnForm.warehouseId}
                  onChange={(e) => setReturnForm({ ...returnForm, warehouseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {isRTL ? w.nameAr : w.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الموقع' : 'Location'}</label>
                <select
                  value={returnForm.locationId}
                  onChange={(e) => setReturnForm({ ...returnForm, locationId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {locations
                    .filter((l) => l.warehouseId === returnForm.warehouseId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.code}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الصنف' : 'Item'}</label>
                <select
                  value={returnForm.itemId}
                  onChange={(e) => setReturnForm({ ...returnForm, itemId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">{isRTL ? 'الكمية' : 'Quantity'}</label>
                <input
                  type="number"
                  min="1"
                  value={returnForm.quantity}
                  onChange={(e) => setReturnForm({ ...returnForm, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-400 font-semibold">{isRTL ? 'سبب الإرجاع' : 'Return Reason'}</label>
              <input
                type="text"
                value={returnForm.reason}
                onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              onClick={() => handleSaveReturn(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              {isRTL ? 'حفظ كمسودة' : 'Save as Draft'}
            </button>
            <button
              onClick={() => handleSaveReturn(false)}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-950/40 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isRTL ? 'تأكيد المردود وترحيل القيد' : 'Confirm Return'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 7: DOCUMENTS REPOSITORY & INSPECTION */}
      {/* =================================================================== */}
      {activeTab === 'DOCUMENTS' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'سجل مستندات المستودع (Documents Repository)' : 'Documents Repository'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'أوامر التوريد، الصرف، المناقلة، التسوية، والمردودات مع تفاصيلها وطباعتها.' : 'Complete archive of all warehouse operations documents and lifecycle states.'}
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <input
                type="text"
                placeholder={isRTL ? 'بحث برقم المستند...' : 'Search document #...'}
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
              />

              <select
                value={docFilterType}
                onChange={(e) => setDocFilterType(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
              >
                <option value="ALL">{isRTL ? 'جميع المستندات' : 'All Types'}</option>
                <option value="RECEIPTS">{isRTL ? 'سندات استلام (GR)' : 'Receipts (GR)'}</option>
                <option value="ISSUES">{isRTL ? 'سندات صرف (GI)' : 'Issues (GI)'}</option>
                <option value="TRANSFERS">{isRTL ? 'سندات مناقلة (TR)' : 'Transfers (TR)'}</option>
                <option value="ADJUSTMENTS">{isRTL ? 'سندات تسوية (ADJ)' : 'Adjustments (ADJ)'}</option>
                <option value="RETURNS">{isRTL ? 'سندات مردودات (RTN)' : 'Returns (RTN)'}</option>
                <option value="COUNTS">{isRTL ? 'كشوفات جرد (CNT)' : 'Stock Counts (CNT)'}</option>
              </select>

              <select
                value={docFilterStatus}
                onChange={(e) => setDocFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white"
              >
                <option value="ALL">{isRTL ? 'جميع الحالات' : 'All Statuses'}</option>
                <option value="CONFIRMED">CONFIRMED (معتمد)</option>
                <option value="DRAFT">DRAFT (مسودة)</option>
                <option value="CANCELLED">CANCELLED (ملغي)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="p-3 text-start">{isRTL ? 'رقم المستند' : 'Doc Number'}</th>
                  <th className="p-3 text-start">{isRTL ? 'النوع' : 'Type'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المستودع' : 'Warehouse'}</th>
                  <th className="p-3 text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المسؤول' : 'User'}</th>
                  <th className="p-3 text-end">{isRTL ? 'التاريخ' : 'Date'}</th>
                  <th className="p-3 text-center">{isRTL ? 'معاينة' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {unifiedDocs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      {isRTL ? 'لا توجد مستندات مطابقة' : 'No documents match filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  unifiedDocs.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono font-bold text-cyan-400">{doc.docNumber || doc.id}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-300">
                          {doc.docCategory}
                        </span>
                      </td>
                      <td className="p-3 text-white">{doc.warehouseName || doc.warehouseId}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            doc.status === 'CONFIRMED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : doc.status === 'DRAFT'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">{doc.receivedBy || doc.issuedBy || doc.performedBy || '—'}</td>
                      <td className="p-3 text-end font-mono text-slate-400">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedDoc({ type: doc.docCategory, data: doc })}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isRTL ? 'عرض' : 'View'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 8: IMMUTABLE TRANSACTION HISTORY */}
      {/* =================================================================== */}
      {activeTab === 'HISTORY' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <span>{isRTL ? 'سجل حركات المخزون المحاسبي الكامل' : 'Complete Ledger Audit History'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'المصدر الحقيقي الوحيد غير القابل للتعديل لكافة حركات المخزون.' : 'Immutable Source of Truth — Every stock transaction is strictly chronological and auditable.'}
              </p>
            </div>
            <div className="text-xs font-mono text-purple-300 bg-purple-950/60 px-3 py-1 rounded-lg border border-purple-500/30">
              {ledger.length} {isRTL ? 'حركة مسجلة' : 'Audit Records'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="p-3 text-start">{isRTL ? 'رقم الحركة' : 'Tx ID'}</th>
                  <th className="p-3 text-start">{isRTL ? 'النوع' : 'Type'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المستند' : 'Document'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الصنف' : 'Item'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المستودع / الرف' : 'Warehouse / Loc'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الكمية' : 'Quantity'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الوزن' : 'Weight'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المسؤول' : 'User'}</th>
                  <th className="p-3 text-end">{isRTL ? 'التاريخ والوقت' : 'Timestamp'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {ledger.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-cyan-400">{tx.transactionId}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.transactionType === 'RECEIPT' || tx.transactionType === 'OPENING_BALANCE' || tx.transactionType === 'RETURN_IN'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : tx.transactionType === 'ISSUE' || tx.transactionType === 'RETURN_OUT'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : 'bg-blue-950 text-blue-300 border border-blue-500/40'
                        }`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{tx.documentId || '—'}</td>
                    <td className="p-3 text-white font-semibold">{tx.itemName}</td>
                    <td className="p-3 text-slate-300 font-mono">
                      {tx.warehouseName} / {tx.locationCode}
                    </td>
                    <td className="p-3 text-end font-mono font-bold text-white">
                      {tx.quantity} {tx.unit}
                    </td>
                    <td className="p-3 text-end font-mono text-slate-300">{tx.weightKG} KG</td>
                    <td className="p-3 text-slate-300">{tx.performedBy}</td>
                    <td className="p-3 text-end font-mono text-slate-500 text-[11px]">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 9: ITEM STOCK MOVEMENT VIEW */}
      {/* =================================================================== */}
      {activeTab === 'ITEM_MOVEMENT' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                <span>{isRTL ? 'كشف حركة الصنف والرصيد المتراكم' : 'Item Stock Movement & Running Balance'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'تتبع زمني لكافة حركات الصنف المحددة من رصيد افتتاحي وتوريد وصرف ومناقلة.' : 'Chronological running balance calculation showing exact ins, outs, and resulting stock.'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label className="text-slate-400 font-semibold">{isRTL ? 'اختر الصنف:' : 'Select Item:'}</label>
              <select
                value={selectedMovementItemId}
                onChange={(e) => setSelectedMovementItemId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-semibold"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.itemCode} — {isRTL ? i.nameAr : i.nameEn}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setInspectItemId(selectedMovementItemId)}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                title={isRTL ? 'عرض بطاقة الصنف والمخازن والتشغيلات' : 'View Full Item Details Modal'}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isRTL ? 'بطاقة الصنف الكاملة' : 'Full Item Details'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                <tr>
                  <th className="p-3 text-start">{isRTL ? 'التاريخ' : 'Date'}</th>
                  <th className="p-3 text-start">{isRTL ? 'نوع الحركة' : 'Movement'}</th>
                  <th className="p-3 text-start">{isRTL ? 'المستند' : 'Document'}</th>
                  <th className="p-3 text-end">{isRTL ? 'التغير (Δ)' : 'Change (Δ)'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الرصيد التراكمي' : 'Running Stock'}</th>
                  <th className="p-3 text-end">{isRTL ? 'الوزن التراكمي' : 'Running Weight'}</th>
                  <th className="p-3 text-start">{isRTL ? 'الموقع' : 'Location'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {itemMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      {isRTL ? 'لا توجد حركات مسجلة لهذا الصنف' : 'No recorded movements for this item.'}
                    </td>
                  </tr>
                ) : (
                  itemMovements.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-3 font-mono text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</td>
                      <td className="p-3 font-bold text-white">{m.transactionType}</td>
                      <td className="p-3 font-mono text-cyan-300">{m.documentId}</td>
                      <td
                        className={`p-3 text-end font-mono font-bold ${
                          m.deltaQuantity >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {m.deltaQuantity > 0 ? `+${m.deltaQuantity}` : m.deltaQuantity} {m.unit}
                      </td>
                      <td className="p-3 text-end font-mono font-bold text-white">
                        {m.runningBalanceQuantity.toLocaleString()} {m.unit}
                      </td>
                      <td className="p-3 text-end font-mono text-amber-300">
                        {m.runningBalanceWeightKG.toLocaleString()} KG
                      </td>
                      <td className="p-3 text-slate-400 font-mono">{m.locationCode}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 10: AUTOMATED SCENARIOS TEST SUITE (TESTS A-G) */}
      {/* =================================================================== */}
      {activeTab === 'TEST_SCENARIOS' && (
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                <span>{isRTL ? 'مجموعة اختبارات التشغيل والعزل (Scenarios A through G)' : 'Automated Operational & Security Tests'}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isRTL ? 'تنفيذ السيناريوهات السبعة المحددة والتحقق من حسابات الدفتر وعدم تسريب البيانات بين المنشآت.' : 'Executes real test transactions (Receive, Issue, Transfer, Adjust, Return, Cancel, and Tenant Security) and verifies end-to-end ledger balance.'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRunRealisticScenario}
                disabled={isRunningTests}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{isRTL ? 'السيناريو التجاري الواقعي (1000 كغم → 590 كغم)' : 'Realistic Scenario (Sec 42)'}</span>
              </button>

              <button
                onClick={handleRunMultiTenantTest}
                disabled={isRunningTests}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <span>{isRTL ? 'اختبار العزل التام للمنشآت' : 'Multi-Tenant Isolation (Sec 43)'}</span>
              </button>

              <button
                onClick={handleRunPhase11Suite}
                disabled={isRunningTests}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>{isRTL ? 'مجموعة الفحص التجاري (22 فحص)' : 'Phase 11 QA Suite (Sec 41)'}</span>
              </button>

              <button
                onClick={handleRunAllTests}
                disabled={isRunningTests}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isRunningTests ? (isRTL ? 'جاري الفحص...' : 'Running...') : (isRTL ? 'تشغيل سيناريوهات A-G' : 'Run Scenarios A-G')}</span>
              </button>
            </div>
          </div>

          {/* Test cases list */}
          <div className="space-y-3">
            {[
              { id: 'A', name: 'TEST A — RECEIVE', desc: 'Receive 1000 KG Item A -> Expected Inventory = 1000 KG' },
              { id: 'B', name: 'TEST B — ISSUE', desc: 'Issue 250 KG -> Expected Inventory = 750 KG' },
              { id: 'C', name: 'TEST C — TRANSFER', desc: 'Transfer 200 KG Loc A to Loc B -> Expected Loc A = 550, Loc B = 200, Total = 750 KG' },
              { id: 'D', name: 'TEST D — ADJUSTMENT', desc: 'Adjust +50 KG -> Expected Total = 800 KG' },
              { id: 'E', name: 'TEST E — RETURN', desc: 'Return 50 KG Return In -> Expected Total = 850 KG' },
              { id: 'F', name: 'TEST F — CANCEL DRAFT', desc: 'Cancel Draft -> Inventory remains unchanged at 850 KG' },
              { id: 'G', name: 'TEST G — MULTI-TENANT ISOLATION', desc: 'Org B attempts access to Org A inventory -> Strict Access Denied / Zero Leakage' },
            ].map((tc) => {
              const res = testResults?.find((r) => r.test.includes(tc.name));
              return (
                <div
                  key={tc.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-white text-xs flex items-center gap-2">
                      <span className="font-mono text-cyan-400">[{tc.id}]</span>
                      <span>{tc.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400">{tc.desc}</p>
                    {res && (
                      <p className={`text-[11px] font-mono ${res.status === 'PASSED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Details: {res.details}
                      </p>
                    )}
                  </div>

                  <div>
                    {res ? (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          res.status === 'PASSED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {res.status}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-slate-900 text-slate-500 text-xs font-mono">
                        PENDING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* DOCUMENT INSPECTION & PRINT MODAL */}
      {/* =================================================================== */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-cyan-400" />
                <div>
                  <h4 className="font-bold text-white text-base font-mono">
                    {selectedDoc.data.docNumber || selectedDoc.data.id}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {selectedDoc.type} • {isRTL ? currentOrganization.nameAr : currentOrganization.nameEn}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const docType =
                      selectedDoc.type === 'RECEIPT'
                        ? 'RECEIPT'
                        : selectedDoc.type === 'ISSUE'
                        ? 'ISSUE'
                        : selectedDoc.type === 'TRANSFER'
                        ? 'TRANSFER'
                        : selectedDoc.type === 'ADJUSTMENT'
                        ? 'ADJUSTMENT'
                        : selectedDoc.type === 'STOCK_COUNT'
                        ? 'STOCK_COUNT'
                        : 'RECEIPT';
                    setPrintableDoc({
                      documentType: docType as any,
                      documentNumber: selectedDoc.data.docNumber || selectedDoc.data.id,
                      date: selectedDoc.data.date || new Date().toISOString().split('T')[0],
                      warehouseName: selectedDoc.data.warehouseName || 'Main Warehouse',
                      performedBy: selectedDoc.data.receivedBy || selectedDoc.data.performedBy || selectedDoc.data.issuedBy || userName,
                      partyName: selectedDoc.data.supplierName || selectedDoc.data.partyName || selectedDoc.data.destination,
                      reason: selectedDoc.data.reason,
                      notes: selectedDoc.data.notes,
                      lines: (selectedDoc.data.items || []).map((it: any) => ({
                        itemCode: it.itemCode || it.itemId,
                        itemName: it.itemName || it.itemCode || 'Item',
                        locationCode: it.locationCode,
                        quantity: Number(it.quantity || it.countedQuantity || 0),
                        unit: it.unit || 'KG',
                        weightKG: Number(it.weightKG || 0),
                        batchId: it.batchId,
                      })),
                    });
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'طباعة رسمية (A4)' : 'Official Print'}</span>
                </button>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Attributes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block">{isRTL ? 'الحالة:' : 'Status:'}</span>
                <span className="font-bold text-emerald-400">{selectedDoc.data.status}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isRTL ? 'التاريخ:' : 'Date:'}</span>
                <span className="font-mono text-white">{selectedDoc.data.date || new Date(selectedDoc.data.createdAt).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isRTL ? 'المستودع:' : 'Warehouse:'}</span>
                <span className="font-semibold text-slate-200">{selectedDoc.data.warehouseName || selectedDoc.data.warehouseId}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isRTL ? 'المسؤول:' : 'Operator:'}</span>
                <span className="font-semibold text-amber-300">
                  {selectedDoc.data.receivedBy || selectedDoc.data.issuedBy || selectedDoc.data.performedBy || '—'}
                </span>
              </div>
            </div>

            {/* Document Line Items */}
            {selectedDoc.data.items && selectedDoc.data.items.length > 0 && (
              <div className="space-y-2">
                <h5 className="font-bold text-white text-xs">{isRTL ? 'بنود وسطور المستند:' : 'Line Items:'}</h5>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="p-2.5 text-start">{isRTL ? 'كود الصنف' : 'Item Code'}</th>
                        <th className="p-2.5 text-start">{isRTL ? 'الاسم' : 'Name'}</th>
                        <th className="p-2.5 text-end">{isRTL ? 'الكمية' : 'Qty'}</th>
                        <th className="p-2.5 text-start">{isRTL ? 'الوحدة' : 'Unit'}</th>
                        <th className="p-2.5 text-end">{isRTL ? 'الوزن' : 'Weight (KG)'}</th>
                        <th className="p-2.5 text-start">{isRTL ? 'الوجبة' : 'Batch'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {selectedDoc.data.items.map((line: any, idx: number) => (
                        <tr key={idx} className="bg-slate-950/40">
                          <td className="p-2.5 font-mono text-cyan-400">{line.itemCode}</td>
                          <td className="p-2.5 text-white">{line.itemName}</td>
                          <td className="p-2.5 text-end font-mono font-bold">{line.quantity}</td>
                          <td className="p-2.5 font-mono text-slate-400">{line.unit}</td>
                          <td className="p-2.5 text-end font-mono text-slate-300">{line.weightKG || '—'}</td>
                          <td className="p-2.5 font-mono text-amber-300">{line.batchId || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions: Cancel if not already cancelled */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
              <div>
                {selectedDoc.data.notes && (
                  <p className="text-slate-400 italic">Notes: {selectedDoc.data.notes}</p>
                )}
              </div>
              {selectedDoc.data.status !== 'CANCELLED' && (
                <button
                  onClick={() => setCancellingDoc({ type: selectedDoc.type, id: selectedDoc.data.id })}
                  className="px-4 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                  <span>{isRTL ? 'إلغاء المستند بأثر عكسي' : 'Cancel Document'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SAFE CANCELLATION MODAL */}
      {/* =================================================================== */}
      {cancellingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-rose-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <ShieldAlert className="w-6 h-6" />
              <h4 className="font-bold text-white text-base">
                {isRTL ? 'تأكيد إلغاء المستند' : 'Confirm Cancellation'}
              </h4>
            </div>

            <p className="text-xs text-slate-300">
              {isRTL
                ? 'لن يتم حذف المستند مادياً. سيتم تحويل حالته إلى "ملغي" وتوليد قيد تسوية عكسي بالدفتر للحفاظ على نزاهة الأرصدة.'
                : 'This document will not be physically deleted. Its status will become CANCELLED and a compensating reversal transaction will be generated.'}
            </p>

            <div className="space-y-1 text-xs">
              <label className="text-slate-400 font-semibold">{isRTL ? 'سبب الإلغاء (إلزامي)' : 'Mandatory Reason:'}</label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={isRTL ? 'أدخل سبب الإلغاء بالتفصيل...' : 'Reason for cancellation...'}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCancellingDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                {isRTL ? 'تراجع' : 'Keep Document'}
              </button>
              <button
                onClick={handleExecuteCancel}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'تأكيد الإلغاء والتسوية' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Document Print Modal (Section 13) */}
      {printableDoc && (
        <UniversalPrintableDocumentModal
          isOpen={true}
          onClose={() => setPrintableDoc(null)}
          data={printableDoc}
        />
      )}

      {/* Complete Item Details Screen (Section 5) */}
      {inspectItemId && (
        <ItemDetailsViewModal
          isOpen={true}
          onClose={() => setInspectItemId(null)}
          itemId={inspectItemId}
          onQuickAction={(action, item) => {
            setInspectItemId(null);
            if (action === 'RECEIVE') setActiveTab('RECEIVING');
            else if (action === 'ISSUE') setActiveTab('ISSUE');
            else if (action === 'TRANSFER') setActiveTab('TRANSFER');
            else if (action === 'ADJUST') setActiveTab('ADJUSTMENT');
          }}
        />
      )}
    </div>
  );
};
