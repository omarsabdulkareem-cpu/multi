import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Zap,
  TrendingDown,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  FileText,
  Boxes,
  Truck,
  Building2,
  Sliders,
  Play,
  Check,
  X,
  ExternalLink,
  Info,
  Calendar,
  Layers,
  ShoppingBag,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTenant } from '../context/TenantContext';
import { useFactory } from '../context/FactoryContext';
import { SmartInsightsService } from '../services/smart/smartInsightsService';
import { ReplenishmentRecommendationEngine } from '../services/smart/replenishmentRecommendationEngine';
import { SlowMovingInventoryService } from '../services/smart/slowMovingInventoryService';
import { AnomalyDetectionService } from '../services/smart/anomalyDetectionService';
import { BatchIntelligenceService } from '../services/smart/batchIntelligenceService';
import { SupplierPerformanceService } from '../services/smart/supplierPerformanceService';
import { WorkflowAutomationEngine } from '../services/smart/workflowAutomationEngine';
import { SmartOperationsSettingsService } from '../services/smart/smartOperationsSettingsService';
import { WarehouseAssistantModal } from './WarehouseAssistantModal';
import {
  SmartInsightItem,
  ReplenishmentRecommendation,
  SlowMovingAnalysisItem,
  AnomalyDetectionAlert,
  BatchIntelligenceRecord,
  SupplierPerformanceMetric,
  WorkflowAutomationRule,
  WorkflowExecutionLog,
  SmartOperationsSettings,
} from '../types/smartOperations';

type SmartHubTab =
  | 'INSIGHTS'
  | 'REPLENISHMENT'
  | 'SLOW_MOVING'
  | 'ANOMALIES'
  | 'BATCH_FEFO'
  | 'SUPPLIERS'
  | 'AUTOMATION'
  | 'SETTINGS';

export const SmartWarehouseHub: React.FC = () => {
  const { isRTL } = useLanguage();
  const { currentOrganization } = useTenant();
  const { currentUser, showToast, setCurrentPage } = useFactory();

  const [activeTab, setActiveTab] = useState<SmartHubTab>('INSIGHTS');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [insights, setInsights] = useState<SmartInsightItem[]>([]);
  const [recommendations, setRecommendations] = useState<ReplenishmentRecommendation[]>([]);
  const [slowMovingItems, setSlowMovingItems] = useState<SlowMovingAnalysisItem[]>([]);
  const [slowPeriod, setSlowPeriod] = useState<30 | 60 | 90 | 180>(60);
  const [anomalies, setAnomalies] = useState<AnomalyDetectionAlert[]>([]);
  const [batchData, setBatchData] = useState<{
    records: BatchIntelligenceRecord[];
    summary: any;
  }>({ records: [], summary: {} });
  const [supplierMetrics, setSupplierMetrics] = useState<SupplierPerformanceMetric[]>([]);
  const [automationRules, setAutomationRules] = useState<WorkflowAutomationRule[]>([]);
  const [automationLogs, setAutomationLogs] = useState<WorkflowExecutionLog[]>([]);
  const [settings, setSettings] = useState<SmartOperationsSettings>(() =>
    SmartOperationsSettingsService.getSettings(currentOrganization?.id || 'org_alkarwan')
  );

  // Conversion state for PR modal
  const [convertingRec, setConvertingRec] = useState<ReplenishmentRecommendation | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Review anomaly modal
  const [reviewingAnomaly, setReviewingAnomaly] = useState<AnomalyDetectionAlert | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const orgId = currentOrganization?.id || 'org_alkarwan';

  const reloadAll = () => {
    setIsLoading(true);
    try {
      setInsights(SmartInsightsService.generateInsights(orgId));
      setRecommendations(ReplenishmentRecommendationEngine.generateRecommendations(orgId));
      setSlowMovingItems(SlowMovingInventoryService.analyzeInventory(orgId, { periodDays: slowPeriod }));
      setAnomalies(AnomalyDetectionService.scanForAnomalies(orgId));
      setBatchData(BatchIntelligenceService.getBatchIntelligence(orgId));
      setSupplierMetrics(SupplierPerformanceService.getSupplierMetrics(orgId));
      setAutomationRules(WorkflowAutomationEngine.getRules(orgId));
      setAutomationLogs(WorkflowAutomationEngine.getExecutionLogs(orgId));
      setSettings(SmartOperationsSettingsService.getSettings(orgId));
    } catch (e: any) {
      console.warn('[SmartWarehouseHub] Error loading smart data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, [orgId, slowPeriod]);

  // Convert recommendation to PR
  const handleConfirmConvertToPr = async () => {
    if (!convertingRec) return;
    setIsConverting(true);
    try {
      const res = await ReplenishmentRecommendationEngine.convertToDraftPurchaseRequest(
        orgId,
        convertingRec,
        { id: currentUser.id || 'usr_lead', name: currentUser.name || 'Warehouse Lead' }
      );
      showToast(
        isRTL
          ? `تم إنشاء مسودة طلب شراء #${res.requestNumber} بنجاح!`
          : `Draft Purchase Request #${res.requestNumber} created successfully!`,
        'success'
      );
      setConvertingRec(null);
      reloadAll();
    } catch (e: any) {
      showToast(e.message || 'Error converting recommendation', 'error');
    } finally {
      setIsConverting(false);
    }
  };

  // Run automation evaluation manually
  const handleTriggerAutomation = async () => {
    setIsLoading(true);
    try {
      const result = await WorkflowAutomationEngine.evaluateRules(orgId);
      showToast(
        isRTL
          ? `اكتمل فحص قواعد الأتمتة (${result.evaluated} مفحوصة، ${result.executed} منفذة، ${result.skipped} في فترة التهدئة)`
          : `Automation evaluated (${result.evaluated} evaluated, ${result.executed} executed, ${result.skipped} in cooldown)`,
        'success'
      );
      reloadAll();
    } catch (e: any) {
      showToast(e.message || 'Error running automation', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle rule
  const handleToggleRule = (ruleId: string, currentVal: boolean) => {
    WorkflowAutomationEngine.toggleRule(orgId, ruleId, !currentVal, {
      id: currentUser.id || 'usr_lead',
      name: currentUser.name || 'Warehouse Lead',
    });
    setAutomationRules(WorkflowAutomationEngine.getRules(orgId));
  };

  // Save Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    SmartOperationsSettingsService.saveSettings(orgId, settings, {
      id: currentUser.id || 'usr_lead',
      name: currentUser.name || 'Warehouse Lead',
    });
    showToast(isRTL ? 'تم حفظ إعدادات العمليات الذكية بنجاح!' : 'Smart Operations settings saved!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-purple-950/40 border border-indigo-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-500/40">
              PHASE 13 INTELLIGENCE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>TENANT SCOPED • ZERO HALLUCINATION</span>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            <span>
              {isRTL
                ? 'مركز ذكاء المستودع والأتمتة التشغيلية'
                : 'Smart Warehouse Intelligence & Automation Hub'}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            {isRTL
              ? 'محرك تحليلات متقدم، توصيات إعادة الطلب بالمعايير الحقيقية، مراقبة الانحرافات، حوكمة الصلاحية (FEFO)، والأتمتة الآمنة.'
              : 'Empirical replenishment engine, velocity analytics, anomaly alerts, FEFO batch governance, and deterministic rules automation.'}
          </p>
        </div>

        {/* Top Right Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950 transition transform hover:-translate-y-0.5"
          >
            <Bot className="w-4 h-4" />
            <span>{isRTL ? 'المساعد الذكي للمستودع' : 'Warehouse Assistant'}</span>
          </button>

          <button
            onClick={reloadAll}
            disabled={isLoading}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-bold scrollbar-none">
        {[
          { id: 'INSIGHTS', labelEn: 'Live Insights', labelAr: 'الرؤى المباشرة', count: insights.length },
          { id: 'REPLENISHMENT', labelEn: 'Replenishment Engine', labelAr: 'محرك إعادة الطلب', count: recommendations.length },
          { id: 'SLOW_MOVING', labelEn: 'Slow-Moving & Excess', labelAr: 'المخزون الراكد والفائض', count: slowMovingItems.filter((s) => s.classification !== 'FAST_MOVING').length },
          { id: 'ANOMALIES', labelEn: 'Anomaly Detection', labelAr: 'رصد الانحرافات', count: anomalies.filter((a) => a.status === 'OPEN').length },
          { id: 'BATCH_FEFO', labelEn: 'Batch & FEFO Picking', labelAr: 'الشحنات وأولوية FEFO', count: batchData.records.length },
          { id: 'SUPPLIERS', labelEn: 'Supplier Reliability', labelAr: 'أداء الموردين', count: supplierMetrics.length },
          { id: 'AUTOMATION', labelEn: 'Workflow Rules', labelAr: 'قواعد الأتمتة', count: automationRules.length },
          { id: 'SETTINGS', labelEn: 'Smart Settings', labelAr: 'إعدادات العمليات الذكية' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-950 font-black'
                  : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
              }`}
            >
              <span>{isRTL ? tab.labelAr : tab.labelEn}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-indigo-950 text-indigo-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: LIVE INSIGHTS */}
      {/* ===================================================================== */}
      {activeTab === 'INSIGHTS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.map((item) => {
              const isCritical = item.severity === 'CRITICAL';
              const isWarning = item.severity === 'WARNING';

              const borderClass = isCritical
                ? 'border-rose-500/40 bg-gradient-to-br from-slate-900 to-rose-950/20'
                : isWarning
                ? 'border-amber-500/40 bg-gradient-to-br from-slate-900 to-amber-950/20'
                : 'border-cyan-500/30 bg-gradient-to-br from-slate-900 to-cyan-950/20';

              const badgeBg = isCritical
                ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                : isWarning
                ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                : 'bg-cyan-950 text-cyan-300 border-cyan-500/40';

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border ${borderClass} flex flex-col justify-between gap-3 shadow-lg`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${badgeBg}`}>
                        {item.severity}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.affectedEntityCode || item.affectedEntityType}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-white leading-snug">
                      {isRTL ? item.titleAr : item.titleEn}
                    </h4>

                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {isRTL ? item.explanationAr : item.explanationEn}
                    </p>

                    <div className="mt-3 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] space-y-1">
                      <div className="text-slate-300">
                        <span className="font-bold text-slate-400">
                          {isRTL ? 'الأساس الواقعي:' : 'Factual Basis:'}{' '}
                        </span>
                        <span>{item.factsVsEstimates.factualBasis}</span>
                      </div>
                      {item.factsVsEstimates.assumptions && (
                        <div className="text-amber-400/90 italic">
                          <span className="font-bold">
                            {isRTL ? 'الافتراض المتبع:' : 'Assumption:'}{' '}
                          </span>
                          <span>{item.factsVsEstimates.assumptions}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500">
                      {item.warehouseName || 'All Facilities'}
                    </span>
                    <button
                      onClick={() => setCurrentPage(item.linkPage)}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition"
                    >
                      <span>{isRTL ? 'فتح السجل' : 'Open Record'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: REPLENISHMENT RECOMMENDATION ENGINE */}
      {/* ===================================================================== */}
      {activeTab === 'REPLENISHMENT' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-white">
                {isRTL ? 'معادلة حساب إعادة الطلب:' : 'Replenishment Formula:'}{' '}
              </span>
              <span className="font-mono text-indigo-300">
                Effective Position = Available Stock (Physical - Reserved) + Incoming (Open POs + Draft Receipts)
              </span>
            </div>
            <span className="text-[11px] text-slate-400 italic">
              {isRTL
                ? 'لا يتم إنشاء أوامر شراء فعلية دون اعتماد بشري معتمد.'
                : 'No purchase orders are placed without explicit human sign-off.'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                  <th className="p-3.5 font-bold">Item SKU</th>
                  <th className="p-3.5 font-bold">Current Stock</th>
                  <th className="p-3.5 font-bold">Reserved</th>
                  <th className="p-3.5 font-bold">Incoming (POs)</th>
                  <th className="p-3.5 font-bold">Reorder Point</th>
                  <th className="p-3.5 font-bold text-indigo-400">Suggested Qty</th>
                  <th className="p-3.5 font-bold">Runway</th>
                  <th className="p-3.5 font-bold">Priority</th>
                  <th className="p-3.5 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {recommendations.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                      {isRTL ? 'جميع الأصناف في وضع مخزني آمن' : 'All materials at healthy stock positions'}
                    </td>
                  </tr>
                ) : (
                  recommendations.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-800/40">
                      <td className="p-3.5">
                        <div className="font-bold text-white">{rec.itemCode}</div>
                        <div className="text-[11px] text-slate-400">{rec.itemName}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {rec.currentAvailableStock.toLocaleString()} {rec.unit}
                      </td>
                      <td className="p-3.5 font-mono text-amber-300">
                        {rec.reservedStock > 0 ? `${rec.reservedStock.toLocaleString()} ${rec.unit}` : '0'}
                      </td>
                      <td className="p-3.5 font-mono text-cyan-300">
                        +{rec.openPurchaseOrdersQty.toLocaleString()} {rec.unit}
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {rec.reorderPoint.toLocaleString()} {rec.unit}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-indigo-400">
                        {rec.suggestedReplenishmentQty.toLocaleString()} {rec.unit}
                      </td>
                      <td className="p-3.5 font-mono text-slate-300">
                        {rec.runwayDays < 999 ? `${rec.runwayDays} days` : 'Adequate'}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            rec.suggestedPriority === 'URGENT'
                              ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                              : rec.suggestedPriority === 'HIGH'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                          }`}
                        >
                          {rec.suggestedPriority}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setConvertingRec(rec)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow transition"
                        >
                          {isRTL ? 'إنشاء مسودة طلب...' : 'Draft PR...'}
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

      {/* ===================================================================== */}
      {/* TAB 3: SLOW-MOVING & EXCESS INVENTORY */}
      {/* ===================================================================== */}
      {activeTab === 'SLOW_MOVING' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex-wrap">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-bold">{isRTL ? 'فترة التحليل:' : 'Analysis Window:'}</span>
              {[30, 60, 90, 180].map((days) => (
                <button
                  key={days}
                  onClick={() => setSlowPeriod(days as any)}
                  className={`px-3 py-1 rounded-xl transition cursor-pointer font-bold ${
                    slowPeriod === days
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {days} {isRTL ? 'يوماً' : 'Days'}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 italic">
              {isRTL
                ? 'عدم الحركة يعكس نمط الاستهلاك الفعلي ولا يعني بالضرورة تقادم المادة أو تلفها.'
                : 'Inactivity reflects current demand velocity, not definitive material obsolescence.'}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                  <th className="p-3.5 font-bold">Item Code</th>
                  <th className="p-3.5 font-bold">Category</th>
                  <th className="p-3.5 font-bold">On-Hand Stock</th>
                  <th className="p-3.5 font-bold">Consumed ({slowPeriod}d)</th>
                  <th className="p-3.5 font-bold">Turnover Ratio</th>
                  <th className="p-3.5 font-bold">Days Dormant</th>
                  <th className="p-3.5 font-bold">Classification</th>
                  <th className="p-3.5 font-bold">Excess Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {slowMovingItems.map((item) => (
                  <tr key={item.itemId} className="hover:bg-slate-800/40">
                    <td className="p-3.5">
                      <div className="font-bold text-white">{item.itemCode}</div>
                      <div className="text-[11px] text-slate-400">{item.itemName}</div>
                    </td>
                    <td className="p-3.5 text-slate-300">{item.category}</td>
                    <td className="p-3.5 font-mono text-slate-200">
                      {item.currentStock.toLocaleString()} {item.unit}
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {item.totalConsumedInPeriod.toLocaleString()} {item.unit}
                    </td>
                    <td className="p-3.5 font-mono text-indigo-300 font-bold">{item.turnoverRatio}</td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {item.daysSinceLastMovement < 999 ? `${item.daysSinceLastMovement} days` : 'No tx'}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          item.classification === 'NO_RECENT_MOVEMENT'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : item.classification === 'SLOW_MOVING'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {item.classification}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-amber-400 font-bold">
                      {item.isExcessStock ? `+${item.excessQuantity.toLocaleString()} ${item.unit}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: ANOMALY & UNUSUAL TRANSACTION DETECTION */}
      {/* ===================================================================== */}
      {activeTab === 'ANOMALIES' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {isRTL
                  ? 'التنبيهات مؤشرات محايدة للتدقيق البشري وليست إثباتاً للخطأ أو المخالفة.'
                  : 'Alerts are neutral indicators for human supervisor review, not proof of misconduct.'}
              </span>
            </div>
            <span className="font-mono text-slate-400">
              {anomalies.filter((a) => a.status === 'OPEN').length} Open Reviews
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {anomalies.map((anom) => (
              <div
                key={anom.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3 shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        anom.severity === 'HIGH'
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {anom.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        anom.status === 'OPEN'
                          ? 'bg-amber-900/60 text-amber-300'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {anom.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-white">{isRTL ? anom.titleAr : anom.titleEn}</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                    {isRTL ? anom.descriptionAr : anom.descriptionEn}
                  </p>

                  <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] grid grid-cols-2 gap-2 font-mono">
                    <div>
                      <span className="text-slate-400 block">{isRTL ? 'القيمة المرصودة:' : 'Observed:'}</span>
                      <span className="text-amber-400 font-bold">{anom.observedValue}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isRTL ? 'الحد المعتمد:' : 'Threshold:'}</span>
                      <span className="text-slate-300">{anom.thresholdValue}</span>
                    </div>
                  </div>

                  {anom.reviewNotes && (
                    <div className="mt-2 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200">
                      <span className="font-bold">{isRTL ? 'ملاحظة المشرف:' : 'Supervisor Note:'} </span>
                      <span>{anom.reviewNotes}</span> ({anom.reviewedBy})
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(anom.timestamp).toLocaleDateString()}
                  </span>
                  {anom.status === 'OPEN' && (
                    <button
                      onClick={() => setReviewingAnomaly(anom)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer transition"
                    >
                      {isRTL ? 'تسجيل المراجعة...' : 'Review Alert...'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: BATCH & FEFO INTELLIGENCE */}
      {/* ===================================================================== */}
      {activeTab === 'BATCH_FEFO' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs text-slate-400 block">{isRTL ? 'إجمالي الشحنات' : 'Total Lots'}</span>
              <span className="text-xl font-black text-white font-mono">{batchData.summary.totalBatches || 0}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30">
              <span className="text-xs text-rose-300 block">{isRTL ? 'منتهية الصلاحية' : 'Expired Lots'}</span>
              <span className="text-xl font-black text-rose-400 font-mono">{batchData.summary.expiredCount || 0}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30">
              <span className="text-xs text-amber-300 block">{isRTL ? 'تقترب من الانتهاء' : 'Expiring Soon'}</span>
              <span className="text-xl font-black text-amber-400 font-mono">{batchData.summary.expiringSoonCount || 0}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900 border border-purple-500/30">
              <span className="text-xs text-purple-300 block">{isRTL ? 'تحت الحجر (QC)' : 'Quarantined'}</span>
              <span className="text-xl font-black text-purple-400 font-mono">{batchData.summary.quarantinedCount || 0}</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                  <th className="p-3.5 font-bold">FEFO Rank</th>
                  <th className="p-3.5 font-bold">Batch Number</th>
                  <th className="p-3.5 font-bold">Material</th>
                  <th className="p-3.5 font-bold">Warehouse</th>
                  <th className="p-3.5 font-bold">Quantity</th>
                  <th className="p-3.5 font-bold">Expiry Date</th>
                  <th className="p-3.5 font-bold">Days Left</th>
                  <th className="p-3.5 font-bold">Policy Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {batchData.records.map((b) => (
                  <tr key={b.batchId} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono font-bold">
                      {b.fefoPriorityRank < 900 ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          #{b.fefoPriorityRank} FEFO
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40">
                          LOCKED
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-white">{b.batchNumber}</td>
                    <td className="p-3.5">
                      <div className="text-slate-200 font-bold">{b.itemCode}</div>
                      <div className="text-[11px] text-slate-400">{b.itemName}</div>
                    </td>
                    <td className="p-3.5 text-slate-300">{b.warehouseName}</td>
                    <td className="p-3.5 font-mono font-bold text-slate-200">
                      {b.currentQuantity.toLocaleString()} {b.unit}
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">{b.expiryDate}</td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {b.daysUntilExpiry < 0 ? (
                        <span className="text-rose-400 font-bold">Expired</span>
                      ) : (
                        `${b.daysUntilExpiry} days`
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          b.status === 'EXPIRED'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                            : b.status === 'EXPIRING_SOON'
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            : b.status === 'QUARANTINED'
                            ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: SUPPLIER RELIABILITY & PERFORMANCE */}
      {/* ===================================================================== */}
      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supplierMetrics.map((sm) => (
              <div
                key={sm.supplierId}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-base font-black text-white">{sm.supplierName}</h4>
                    <span className="text-xs font-mono text-slate-400">{sm.supplierCode}</span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono ${
                      sm.reliabilityStatus === 'EXCELLENT'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                        : sm.reliabilityStatus === 'GOOD'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                        : sm.reliabilityStatus === 'NEEDS_ATTENTION'
                        ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {sm.reliabilityStatus}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {isRTL ? sm.explanationAr : sm.explanationEn}
                </p>

                {sm.hasSufficientData ? (
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono">
                    <div>
                      <span className="text-slate-400 block">{isRTL ? 'مدة التوريد:' : 'Avg Delivery:'}</span>
                      <span className="text-white font-bold">{sm.averageRecordedDeliveryDays}d</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isRTL ? 'في الموعد:' : 'On-Time:'}</span>
                      <span className="text-emerald-400 font-bold">{sm.onTimeDeliveryRate}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isRTL ? 'فارق الكمية:' : 'Qty Variance:'}</span>
                      <span className="text-slate-300 font-bold">{sm.quantityDiscrepancyRate}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 italic">
                    {isRTL
                      ? 'البيانات غير كافية لحساب متوسط الأداء الفعلي.'
                      : 'Insufficient empirical transactions to compute reliable delivery statistics.'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 7: WORKFLOW AUTOMATION ENGINE */}
      {/* ===================================================================== */}
      {activeTab === 'AUTOMATION' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
            <div>
              <h3 className="text-base font-black text-white">
                {isRTL ? 'محرك الأتمتة وقواعد سير العمل الآمنة' : 'Workflow Automation Rules & Triggers'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRTL
                  ? 'قواعد محكمة تمنع التكرار والحلقات اللانهائية، ولا تسمح بتعديل الأرصدة دون قيد رسمي.'
                  : 'Deterministic triggers protected against recursive loops and duplicate bursts.'}
              </p>
            </div>

            <button
              onClick={handleTriggerAutomation}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black flex items-center gap-2 cursor-pointer shadow transition"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isRTL ? 'تشغيل فحص القواعد الآن' : 'Evaluate Rules Now'}</span>
            </button>
          </div>

          <div className="space-y-3">
            {automationRules.map((rule) => (
              <div
                key={rule.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                      WHEN {rule.trigger}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                      THEN {rule.action}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-white">{isRTL ? rule.nameAr : rule.nameEn}</h4>
                  <p className="text-xs text-slate-400">{isRTL ? rule.descriptionAr : rule.descriptionEn}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-[11px] font-mono text-slate-400">
                    <div>Executions: {rule.executionCount}</div>
                    <div className="text-[10px] text-slate-500">Cooldown: {rule.cooldownMinutes}m</div>
                  </div>

                  <button
                    onClick={() => handleToggleRule(rule.id, rule.enabled)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      rule.enabled
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    {rule.enabled ? (isRTL ? 'مفعلة' : 'Enabled') : (isRTL ? 'معطلة' : 'Disabled')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Execution History */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h4 className="text-sm font-black text-white">
              {isRTL ? 'سجل تشغيل قواعد الأتمتة' : 'Recent Automation Execution Audit Logs'}
            </h4>
            <div className="divide-y divide-slate-800/80 font-mono text-xs">
              {automationLogs.length === 0 ? (
                <div className="p-4 text-center text-slate-500 italic">No execution logs yet</div>
              ) : (
                automationLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-indigo-400 font-bold">{log.ruleName}</span>
                      <span className="text-slate-400 text-[11px] block">{log.reason}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{new Date(log.triggeredAt).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 8: SMART OPERATIONS SETTINGS */}
      {/* ===================================================================== */}
      {activeTab === 'SETTINGS' && (
        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-black text-white">
              {isRTL ? 'إعدادات العمليات الذكية ومحددات الإنذار' : 'Smart Operations Policies & Threshold Settings'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isRTL
                ? 'تخصيص نسب التحذير، فترات تقييم المخزون الراكد، حدود الإنذار بالانحرافات، وتفضيلات الإشعارات.'
                : 'Configure inventory velocity windows, anomaly detection multipliers, and alerting rules per organization.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'نسبة حد النقص الحرج (%)' : 'Critical Stock Threshold (%)'}
              </label>
              <input
                type="number"
                min="5"
                max="50"
                value={settings.criticalStockThresholdPercent}
                onChange={(e) =>
                  setSettings({ ...settings, criticalStockThresholdPercent: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'معامل مخزون الأمان (Safety Multiplier)' : 'Safety Stock Multiplier'}
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="3.0"
                value={settings.safetyStockMultiplier}
                onChange={(e) =>
                  setSettings({ ...settings, safetyStockMultiplier: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'فترة فحص الركود القياسية (أيام)' : 'Default Slow-Moving Period (Days)'}
              </label>
              <select
                value={settings.slowMovingDaysPeriod}
                onChange={(e) =>
                  setSettings({ ...settings, slowMovingDaysPeriod: Number(e.target.value) as any })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-400"
              >
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
                <option value={180}>180 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'أيام الإنذار باقتراب انتهاء الصلاحية' : 'Expiry Warning Horizon (Days)'}
              </label>
              <input
                type="number"
                min="7"
                max="180"
                value={settings.expiryWarningDays}
                onChange={(e) => setSettings({ ...settings, expiryWarningDays: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'معامل صرف الحجم الاستثنائي' : 'Large Issue Anomaly Multiplier'}
              </label>
              <input
                type="number"
                step="0.5"
                min="2.0"
                max="10.0"
                value={settings.anomalyLargeIssueMultiplier}
                onChange={(e) =>
                  setSettings({ ...settings, anomalyLargeIssueMultiplier: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                {isRTL ? 'فارق الجرد الموجب للإنذار (كغم)' : 'Stocktake Variance Threshold (KG)'}
              </label>
              <input
                type="number"
                min="10"
                max="500"
                value={settings.anomalyVarianceThresholdKG}
                onChange={(e) =>
                  setSettings({ ...settings, anomalyVarianceThresholdKG: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-950 cursor-pointer transition"
            >
              {isRTL ? 'حفظ إعدادات العمليات الذكية' : 'Save Smart Operations Settings'}
            </button>
          </div>
        </form>
      )}

      {/* Assistant Modal */}
      <WarehouseAssistantModal isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />

      {/* PR Confirmation Modal */}
      {convertingRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-400" />
              <span>{isRTL ? 'تحويل التوصية إلى مسودة طلب شراء' : 'Convert Recommendation to Draft PR'}</span>
            </h3>

            <p className="text-xs text-slate-300">
              {isRTL
                ? `سيتم إنشاء مسودة طلب شراء جديدة للصنف ${convertingRec.itemCode} بالكمية المقترحة (${convertingRec.suggestedReplenishmentQty} ${convertingRec.unit}).`
                : `A new draft Purchase Request will be created for ${convertingRec.itemCode} with suggested quantity (${convertingRec.suggestedReplenishmentQty} ${convertingRec.unit}).`}
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs font-mono">
              <div>Stock on hand: {convertingRec.currentAvailableStock} {convertingRec.unit}</div>
              <div>Reorder Point: {convertingRec.reorderPoint} {convertingRec.unit}</div>
              <div className="text-indigo-400 font-bold">Suggested: {convertingRec.suggestedReplenishmentQty} {convertingRec.unit}</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isConverting}
                onClick={() => setConvertingRec(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                disabled={isConverting}
                onClick={handleConfirmConvertToPr}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shadow flex items-center gap-2"
              >
                {isConverting && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isRTL ? 'تأكيد وإنشاء المسودة' : 'Confirm & Create Draft'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Anomaly Modal */}
      {reviewingAnomaly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white">
              {isRTL ? 'تسجيل مراجعة المشرف للتنبيه' : 'Supervisor Anomaly Review'}
            </h3>

            <p className="text-xs text-slate-300">
              {reviewingAnomaly.titleEn}
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                {isRTL ? 'ملاحظات التحقق الفني:' : 'Verification Notes:'}
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="e.g. Verified with scale operator, calibration drift re-adjusted."
                rows={3}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReviewingAnomaly(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  AnomalyDetectionService.updateAlertStatus(
                    reviewingAnomaly.id,
                    'REVIEWED',
                    { id: currentUser.id || 'usr_lead', name: currentUser.name || 'Supervisor' },
                    reviewNotes
                  );
                  showToast(isRTL ? 'تم تسجيل المراجعة بنجاح' : 'Alert review logged', 'success');
                  setReviewingAnomaly(null);
                  setReviewNotes('');
                  reloadAll();
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                {isRTL ? 'اعتماد كمراجع' : 'Mark as Reviewed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
