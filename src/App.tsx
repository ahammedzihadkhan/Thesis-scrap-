import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CurrencyCode,
  CURRENCIES,
  RawTransaction,
  ColumnMapping,
  CleanedTransaction,
  DataHygieneStats,
  CustomerRFMTD,
  PreprocessingStats,
  ClusterCentroid,
  BenchmarkAlgorithmResult,
  ModelHealthMetrics,
  TemporalHoldoutResult,
} from './rfm/types';
import {
  autoDetectColumnMapping,
  stitchAndCleanData,
} from './rfm/identityStitcher';
import {
  calculate5DRFM,
  preprocessRFM,
  computePCA,
  ScalerParams,
} from './rfm/rfmCalculator';
import {
  runKMeans,
  calculateClusteringMetrics,
  calculateHopkins,
  rankClustersToPersonas,
  assignEarlySegments,
  runAlgorithmBenchmark,
  runTemporalHoldoutCheck,
  bootstrapStabilityARI,
} from './rfm/mlClustering';
import Papa from 'papaparse';
import {
  generateBangladeshiWhatsAppShopSample,
  generateRichBangladeshiStoreSample,
  generateUCIOnlineRetailSample,
} from './rfm/sampleData';
import {
  BANGLADESHI_WHATSAPP_SHOP_ORDERS,
  convertRawRowsToWhatsAppShopOrders,
  WhatsAppShopOrder,
} from './data/bangladeshiWhatsAppShopData';
import {
  DARAZ_BD_ORDERS,
  DARAZ_BD_RAW_TRANSACTIONS,
} from './data/darazSampleData';

import { Header } from './components/Header';
import { DataHygieneBar } from './components/DataHygieneBar';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { FileUploadModal } from './components/FileUploadModal';
import { Tab1StoreOverview } from './components/Tab1StoreOverview';
import { Tab2SegmentsExplorer } from './components/Tab2SegmentsExplorer';
import { Tab3MLValidation } from './components/Tab3MLValidation';
import { Tab4CampaignStudio } from './components/Tab4CampaignStudio';
import { Tab5POSPredictor } from './components/Tab5POSPredictor';
import { WhatsAppShopSection } from './components/WhatsAppShopSection';
import { DataCleanerTab } from './components/DataCleanerTab';
import { HomeTab } from './components/HomeTab';
import { autoCleanDataset } from './rfm/dataCleaner';

import {
  LayoutDashboard,
  Box,
  BrainCircuit,
  MessageSquareShare,
  Calculator,
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  Package,
  Sparkles,
  Upload,
  Wand2,
  Home,
} from 'lucide-react';

export default function App() {
  // Global settings & currency
  const [currency, setCurrency] = useState<CurrencyCode>('BDT');
  const [activeTab, setActiveTab] = useState<'home' | 'whatsapp_shop' | 'cleaner' | 1 | 2 | 3 | 4 | 5>('home');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toLocaleTimeString());

  // Active dataset state - initialized with the uploaded 1,049-Order Daraz BD & Pickaboo dataset!
  const [datasetName, setDatasetName] = useState<string>(
    'Daraz BD & Pickaboo Electronics (1,049 Orders · BDT ৳)'
  );
  const [rawRows, setRawRows] = useState<RawTransaction[]>(() =>
    DARAZ_BD_RAW_TRANSACTIONS
  );
  const [headers, setHeaders] = useState<string[]>(() =>
    Object.keys(DARAZ_BD_RAW_TRANSACTIONS[0])
  );
  const [mapping, setMapping] = useState<ColumnMapping>(() =>
    autoDetectColumnMapping(Object.keys(DARAZ_BD_RAW_TRANSACTIONS[0]))
  );

  // Synchronized WhatsApp Shop orders state - initialized with Daraz BD 1,049 orders!
  const [shopOrders, setShopOrders] = useState<WhatsAppShopOrder[]>(() => [
    ...DARAZ_BD_ORDERS,
  ]);
  const [shopDatasetLabel, setShopDatasetLabel] = useState<string>(
    'Daraz BD & Pickaboo Electronics (1,049 Orders · BDT ৳)'
  );

  // Modals
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // ML Hyperparameters
  const [k, setK] = useState<number>(4);

  // Step 1: Clean transactions & Stitch Zero-Account Guest Identities
  const { cleanedRows, stats: hygieneStats } = useMemo(() => {
    return stitchAndCleanData(rawRows, mapping);
  }, [rawRows, mapping]);

  // Step 2: 5D Extended RFM (R, F, M, T, D)
  const { customerRFMList } = useMemo(() => {
    return calculate5DRFM(cleanedRows);
  }, [cleanedRows]);

  // Step 3: Preprocessing (Log1p & StandardScaler)
  const { featuresStandardized, scaler, stats: preprocessingStats } = useMemo(() => {
    return preprocessRFM(customerRFMList);
  }, [customerRFMList]);

  // Step 4: 2D PCA Projection
  const { projections: pcaProjections, explainedVarianceRatio: pcaVariance } = useMemo(() => {
    return computePCA(featuresStandardized);
  }, [featuresStandardized]);

  // Step 5: K-Means Clustering & Persona Ranking
  const {
    customerListWithPersonas,
    centroids,
    rawCentroidsStandardized,
    wcss,
    healthMetrics,
    benchmarkResults,
    holdoutResult,
    wcssHistory,
  } = useMemo(() => {
    const kmResult = runKMeans(featuresStandardized, k, 10, 80);
    const ranked = rankClustersToPersonas(customerRFMList, kmResult.labels, k, kmResult.centroids);
    const centroids = ranked.centroids;
    // Two-track: early-stage customers additionally get their own three lifecycle segments.
    const customerListWithPersonas = assignEarlySegments(ranked.customerListWithPersonas);

    const metrics = calculateClusteringMetrics(
      featuresStandardized,
      kmResult.labels,
      k,
      kmResult.centroids
    );
    const hopkins = calculateHopkins(featuresStandardized, 40);

    const fullHealth: ModelHealthMetrics = {
      silhouetteScore: metrics.silhouetteScore,
      daviesBouldinIndex: metrics.daviesBouldinIndex,
      calinskiHarabaszIndex: metrics.calinskiHarabaszIndex,
      hopkinsStatistic: hopkins,
      bootstrapStabilityARI: bootstrapStabilityARI(featuresStandardized, k, kmResult.labels),
    };

    const benchmark = runAlgorithmBenchmark(
      metrics.silhouetteScore,
      metrics.daviesBouldinIndex,
      metrics.calinskiHarabaszIndex,
      centroids
    );

    const holdout = runTemporalHoldoutCheck(cleanedRows, k);

    // Calculate optimization curves across k=2 to 8
    const history: { k: number; wcss: number; silhouette: number; db: number }[] = [];
    for (let testK = 2; testK <= 8; testK++) {
      const res = runKMeans(featuresStandardized, testK, 3, 30);
      const m = calculateClusteringMetrics(featuresStandardized, res.labels, testK, res.centroids);
      history.push({
        k: testK,
        wcss: res.wcss,
        silhouette: m.silhouetteScore,
        db: m.daviesBouldinIndex,
      });
    }

    return {
      customerListWithPersonas,
      centroids,
      rawCentroidsStandardized: kmResult.centroids,
      wcss: kmResult.wcss,
      healthMetrics: fullHealth,
      benchmarkResults: benchmark,
      holdoutResult: holdout,
      wcssHistory: history,
    };
  }, [featuresStandardized, customerRFMList, k, cleanedRows]);

  // Ingestion Handlers (100% Two-Way Synchronized between 5D RFM Engine & F-Commerce Hub)
  const handleLoadRichBDSample = useCallback(() => {
    setIsLoading(true);
    setProcessingMessage('Processing 200+ Bangladeshi F-Commerce orders · Stitching WhatsApp & Messenger identities...');
    setTimeout(() => {
      const data = generateRichBangladeshiStoreSample();
      const keys = Object.keys(data[0]);
      const label = 'Bangladeshi F-Commerce & Social Shop Demo (180+ Orders · Messenger + WA)';
      setRawRows(data);
      setHeaders(keys);
      setMapping(autoDetectColumnMapping(keys));
      setDatasetName(label);
      setCurrency('BDT');
      setShopOrders([...BANGLADESHI_WHATSAPP_SHOP_ORDERS]);
      setShopDatasetLabel(label);
      setK(4);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setIsLoading(false);
      setProcessingMessage(null);
    }, 250);
  }, []);

  const handleLoadWhatsAppSample = useCallback(() => {
    setIsLoading(true);
    setProcessingMessage('Processing Dhaka F-Commerce Shop Log · Running 5D RFM & Guest Identity Stitching...');
    setTimeout(() => {
      const data = generateBangladeshiWhatsAppShopSample();
      const keys = Object.keys(data[0]);
      const label = 'Bangladeshi WhatsApp & Facebook Shop Log (Dhaka Boutique)';
      const converted = convertRawRowsToWhatsAppShopOrders(data);
      setRawRows(data);
      setHeaders(keys);
      setMapping(autoDetectColumnMapping(keys));
      setDatasetName(label);
      setCurrency('BDT');
      setShopOrders(converted);
      setShopDatasetLabel(`${label} (${converted.length} orders · BDT ৳)`);
      setK(4);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setIsLoading(false);
      setProcessingMessage(null);
    }, 250);
  }, []);

  const handleLoadUCISample = useCallback(() => {
    setIsLoading(true);
    setProcessingMessage('Processing Canonical UCI Online Retail Benchmark · Computing 5D RFM Clusters...');
    setTimeout(() => {
      const data = generateUCIOnlineRetailSample();
      const keys = Object.keys(data[0]);
      const label = 'Canonical UCI Online Retail Thesis Benchmark Dataset';
      const converted = convertRawRowsToWhatsAppShopOrders(data);
      setRawRows(data);
      setHeaders(keys);
      setMapping(autoDetectColumnMapping(keys));
      setDatasetName(label);
      setCurrency('GBP');
      setShopOrders(converted);
      setShopDatasetLabel(`${label} (${converted.length} orders · GBP £)`);
      setK(4);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setIsLoading(false);
      setProcessingMessage(null);
    }, 250);
  }, []);

  // Load 1,049 Orders Daraz BD & Pickaboo electronics dataset
  const handleLoadDarazSample = useCallback(() => {
    setIsLoading(true);
    setProcessingMessage('Processing 1,049 Daraz BD & Pickaboo Orders · Running Real-Time 5D RFM & Identity Stitching...');
    setTimeout(() => {
      const keys = Object.keys(DARAZ_BD_RAW_TRANSACTIONS[0]);
      setRawRows(DARAZ_BD_RAW_TRANSACTIONS);
      setHeaders(keys);
      setMapping(autoDetectColumnMapping(keys));
      const label = 'Daraz BD & Pickaboo Electronics (1,049 Orders · BDT ৳)';
      setDatasetName(label);
      setCurrency('BDT');
      setShopOrders(DARAZ_BD_ORDERS);
      setShopDatasetLabel(label);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setIsLoading(false);
      setProcessingMessage(null);
    }, 250);
  }, []);

  const handleCustomDataLoaded = useCallback((uploaded: RawTransaction[], fileName: string) => {
    // Every upload is auto-cleaned first (formats dates, prices, phones; drops empty / duplicate rows).
    const data = autoCleanDataset(uploaded).rows;
    if (data.length === 0) return;
    setIsLoading(true);
    setProcessingMessage(`Processing uploaded file "${fileName}" (${data.length.toLocaleString()} rows) in real-time...`);
    setTimeout(() => {
      const keys = Object.keys(data[0]);
      const detectedMapping = autoDetectColumnMapping(keys);
      const converted = convertRawRowsToWhatsAppShopOrders(data);
      const label = `Uploaded File: ${fileName} (${converted.length.toLocaleString()} Orders · BDT ৳)`;
      setRawRows(data);
      setHeaders(keys);
      setMapping(detectedMapping);
      setDatasetName(label);
      setCurrency('BDT');
      setShopOrders(converted);
      setShopDatasetLabel(label);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setIsLoading(false);
      setProcessingMessage(null);

      // Verify if required fields were resolved
      const hasRequired = Boolean(
        detectedMapping.orderIdCol &&
        detectedMapping.timestampCol &&
        (
          (detectedMapping.revenueMode === 'quantity_price' && detectedMapping.quantityCol && detectedMapping.unitPriceCol) ||
          (detectedMapping.revenueMode === 'total_amount' && detectedMapping.totalAmountCol)
        )
      );
      if (!hasRequired) {
        setIsMappingOpen(true);
      }
    }, 250);
  }, []);

  const handleSyncFromWhatsAppShop = useCallback((rows: RawTransaction[], label: string) => {
    if (rows.length === 0) return;
    setIsLoading(true);
    setProcessingMessage(`Synchronizing ${rows.length.toLocaleString()} orders across 5D RFM Engine & F-Commerce Hub...`);
    setTimeout(() => {
      const keys = Object.keys(rows[0]);
      const converted = convertRawRowsToWhatsAppShopOrders(rows);
      setRawRows(rows);
      setHeaders(keys);
      setMapping(autoDetectColumnMapping(keys));
      setDatasetName(label);
      setCurrency('BDT');
      setShopOrders(converted);
      setShopDatasetLabel(label);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setIsLoading(false);
      setProcessingMessage(null);
    }, 200);
  }, []);

  const currencySymbol = CURRENCIES[currency].symbol;
  const totalValidatedRevenue = useMemo(
    () => Math.round(cleanedRows.reduce((sum, r) => sum + r.totalAmount, 0)),
    [cleanedRows]
  );

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-100/70 text-slate-900 flex flex-col font-sans relative">
      {/* Real-Time Processing Overlay Banner when switching or uploading datasets */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-200 max-w-md w-full p-6 text-center space-y-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">
              Real-Time Data Processing & 5D RFM Sync
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {processingMessage || 'Processing order transactions, stitching guest identities, and updating all 6 intelligence tabs...'}
            </p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-600 h-full w-3/4 animate-pulse rounded-full"></div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header with Ingestion Buttons & Currency */}
      <Header
        currentCurrency={currency}
        onCurrencyChange={setCurrency}
        datasetName={datasetName}
        onLoadRichBDSample={handleLoadRichBDSample}
        onLoadWhatsAppSample={handleLoadWhatsAppSample}
        onLoadUCISample={handleLoadUCISample}
        onLoadDarazSample={handleLoadDarazSample}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenMapping={() => setIsMappingOpen(true)}
        isLoading={isLoading}
      />

      {/* Feature B: Data Hygiene & Guest Recovery Metric Bar */}
      {activeTab !== 'home' && (
      <DataHygieneBar
        stats={hygieneStats}
        currentCurrency={currency}
        currencySymbol={currencySymbol}
        datasetName={datasetName}
        onNavigateTab={setActiveTab}
        onOpenMapping={() => setIsMappingOpen(true)}
        onOpenUpload={() => setIsUploadOpen(true)}
        onLoadWhatsAppSample={handleLoadWhatsAppSample}
        onLoadRichBDSample={handleLoadRichBDSample}
        onLoadUCISample={handleLoadUCISample}
        onLoadDarazSample={handleLoadDarazSample}
      />
      )}

      {/* Main Tabbed Interface */}
      <main className="w-full max-w-full mx-auto px-3 sm:px-5 lg:px-6 py-4 flex-1 space-y-4">
        {/* Navigation: four plain-language steps; expert screens behind "Advanced" */}
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
          {([
            ['home', 'Home', Home],
            ['cleaner', 'Clean data', Wand2],
            [2, 'Customer groups', Box],
            [4, 'Send messages', MessageSquareShare],
          ] as const).map(([tab, label, Icon]) => (
            <button
              key={String(tab)}
              onClick={() => setActiveTab(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                activeTab === tab ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
          <span className="flex-1" />
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <BrainCircuit className="w-4 h-4" /> {showAdvanced ? 'Hide advanced tools' : 'Advanced tools'}
          </button>
          {showAdvanced && (
            <div className="w-full flex flex-wrap gap-1.5 pt-1">
              {([
                [1, 'Store overview', LayoutDashboard],
                [3, `Model check (k=${k} · ${healthMetrics.silhouetteScore.toFixed(2)})`, BrainCircuit],
                [5, 'Customer lookup', Calculator],
                ['whatsapp_shop', 'Shop ledger & WhatsApp', ShoppingBag],
              ] as const).map(([tab, label, Icon]) => (
                <button
                  key={String(tab)}
                  onClick={() => setActiveTab(tab)}
                  aria-current={activeTab === tab ? 'page' : undefined}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
                    activeTab === tab ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          )}
        </nav>

        {activeTab === 'home' && (
          <HomeTab
            customers={customerListWithPersonas}
            datasetName={datasetName}
            validOrders={hygieneStats.validIdentifiedRows}
            revenue={totalValidatedRevenue}
            currencySymbol={currencySymbol}
            onUpload={() => setIsUploadOpen(true)}
            onLoadSample={handleLoadRichBDSample}
            onNavigate={setActiveTab}
          />
        )}

        {/* Dedicated Tab 0: WhatsApp Shop (BDT ৳ & Excel Hub) */}
        {activeTab === 'whatsapp_shop' && (
          <WhatsAppShopSection
            onSyncWithRFMEngine={handleSyncFromWhatsAppShop}
            currencySymbol={currencySymbol}
            initialOrders={shopOrders}
            initialDatasetLabel={shopDatasetLabel}
          />
        )}

        {activeTab === 'cleaner' && (
          <DataCleanerTab
            currentRows={rawRows}
            currentName={datasetName}
            onUseCleaned={(rows, label) => { handleSyncFromWhatsAppShop(rows, label); setActiveTab(2); }}
          />
        )}

        {/* Tab 1: Store Overview & Data Hygiene */}
        {activeTab === 1 && (
          <Tab1StoreOverview
            cleanedRows={cleanedRows}
            customers={customerListWithPersonas}
            hygieneStats={hygieneStats}
            currencySymbol={currencySymbol}
          />
        )}

        {/* Tab 2: Extended RFM Segments & 3D Explorer */}
        {activeTab === 2 && (
          <Tab2SegmentsExplorer
            customers={customerListWithPersonas}
            centroids={centroids}
            pcaProjections={pcaProjections}
            pcaVariance={pcaVariance}
            currencySymbol={currencySymbol}
          />
        )}

        {/* Tab 3: ML Validation, Benchmark & Future Repurchase Test */}
        {activeTab === 3 && (
          <Tab3MLValidation
            k={k}
            onKChange={setK}
            healthMetrics={healthMetrics}
            benchmarkResults={benchmarkResults}
            holdoutResult={holdoutResult}
            preprocessingStats={preprocessingStats}
            wcssHistory={wcssHistory}
            currencySymbol={currencySymbol}
          />
        )}

        {/* Tab 4: Automated WhatsApp & Email Campaign Studio */}
        {activeTab === 4 && (
          <Tab4CampaignStudio
            customers={customerListWithPersonas}
            currencySymbol={currencySymbol}
            cleanedRows={cleanedRows}
          />
        )}

        {/* Tab 5: Live POS / Single-Customer Segment Predictor */}
        {activeTab === 5 && (
          <Tab5POSPredictor
            customers={customerListWithPersonas}
            scaler={scaler}
            centroids={centroids}
            rawCentroidsStandardized={rawCentroidsStandardized}
            currencySymbol={currencySymbol}
            cleanedRows={cleanedRows}
          />
        )}
      </main>

      {/* Modals */}
      <ColumnMappingModal
        isOpen={isMappingOpen}
        onClose={() => setIsMappingOpen(false)}
        headers={headers}
        mapping={mapping}
        onSaveMapping={setMapping}
      />

      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataLoaded={handleCustomDataLoaded}
      />
    </div>
  );
}
