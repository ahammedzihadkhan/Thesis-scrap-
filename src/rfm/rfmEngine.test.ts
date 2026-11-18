import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  normalizeEmail,
  autoDetectColumnMapping,
  stitchAndCleanData,
} from './identityStitcher';
import {
  calculate5DRFM,
  preprocessRFM,
  calculateSkewness,
  transformSingle,
} from './rfmCalculator';
import {
  runKMeans,
  calculateClusteringMetrics,
  calculateHopkins,
  rankClustersToPersonas,
  assignEarlySegments,
  segmentEstablished,
  runAlgorithmBenchmark,
  runTemporalHoldoutCheck,
  adjustedRandIndex,
  bootstrapStabilityARI,
} from './mlClustering';
import {
  generateUCIOnlineRetailSample,
  generateBangladeshiWhatsAppShopSample,
  generateRichBangladeshiStoreSample,
} from './sampleData';
import { CustomerRFMTD } from './types';
import {
  formatE164Phone,
  generateWhatsAppBulkExport,
} from './whatsappBulkExporter';
import {
  calculateCampaignForecast,
  generateAllSegmentScenarios,
} from './campaignForecaster';
import { BANGLA_TEMPLATES, DEFAULT_CAMPAIGN_CONFIGS, EARLY_MESSAGES_BN, OFFER_OPTIONS, offerPct, offerPrice, withOfferPct } from './campaignDefaults';

test('Phone normalization handles +880, 88, 0088, and spaces', () => {
  assert.equal(normalizePhoneNumber('+8801711234567'), '01711234567');
  assert.equal(normalizePhoneNumber('8801819876543'), '01819876543');
  assert.equal(normalizePhoneNumber('008801914556677'), '01914556677');
  assert.equal(normalizePhoneNumber(' 017-5511-2233 '), '01755112233');
  assert.equal(normalizePhoneNumber('+1 (555) 123-4567'), '15551234567');
  assert.equal(normalizePhoneNumber('invalid'), undefined);
});

test('Email normalization trims and lowercases valid addresses', () => {
  assert.equal(normalizeEmail('  User@Example.COM '), 'user@example.com');
  assert.equal(normalizeEmail('invalid-email'), undefined);
  assert.equal(normalizeEmail(''), undefined);
});

test('Column auto-detection identifies UCI and WhatsApp headers', () => {
  const uciHeaders = ['InvoiceNo', 'StockCode', 'Description', 'Quantity', 'InvoiceDate', 'UnitPrice', 'CustomerID', 'Country'];
  const uciMapping = autoDetectColumnMapping(uciHeaders);
  assert.equal(uciMapping.orderIdCol, 'InvoiceNo');
  assert.equal(uciMapping.timestampCol, 'InvoiceDate');
  assert.equal(uciMapping.customerCol, 'CustomerID');
  assert.equal(uciMapping.quantityCol, 'Quantity');
  assert.equal(uciMapping.unitPriceCol, 'UnitPrice');

  const waHeaders = ['order_id', 'created_at', 'whatsapp_phone', 'customer_email', 'sku', 'total_price'];
  const waMapping = autoDetectColumnMapping(waHeaders);
  assert.equal(waMapping.orderIdCol, 'order_id');
  assert.equal(waMapping.phoneCol, 'whatsapp_phone');
  assert.equal(waMapping.emailCol, 'customer_email');

  // Amazon purchase export: no customer column is recognised, so the app must ask for it
  const amzMapping = autoDetectColumnMapping(['Order Date', 'Purchase Price Per Unit', 'Quantity', 'Shipping Address State', 'Title', 'ASIN/ISBN (Product Code)', 'Category', 'Survey ResponseID']);
  assert.equal(amzMapping.customerCol, '');
  assert.equal(amzMapping.timestampCol, 'Order Date');
  assert.equal(amzMapping.productCol, 'Title');
});

test('Identity stitching recovers repeat guest buyers and cleans invalid rows', () => {
  const waData = generateBangladeshiWhatsAppShopSample();
  const mapping = autoDetectColumnMapping(Object.keys(waData[0]));
  const { cleanedRows, stats } = stitchAndCleanData(waData, mapping);

  assert.ok(cleanedRows.length > 0, 'Cleaned rows should not be empty');
  assert.ok(stats.cancelledRowsRemoved >= 1, 'Should filter out negative/cancelled test rows');
  assert.ok(stats.repeatGuestBuyersRecovered >= 1, 'Should recover repeat guest buyers by phone/email');
  assert.ok(stats.guestOnlyCount > 0, 'Should register guest checkouts');
});

test('5D Extended RFM calculation produces valid R, F, M, T, D features', () => {
  const uciData = generateUCIOnlineRetailSample();
  const mapping = autoDetectColumnMapping(Object.keys(uciData[0]));
  const { cleanedRows } = stitchAndCleanData(uciData, mapping);
  const { customerRFMList } = calculate5DRFM(cleanedRows);

  assert.ok(customerRFMList.length > 10, 'Should produce customer RFM records');

  for (const c of customerRFMList) {
    assert.ok(c.recency >= 1, 'Recency should be >= 1');
    assert.ok(c.frequency >= 1, 'Frequency should be >= 1');
    assert.ok(c.monetary > 0, 'Monetary spend should be positive');
    assert.ok(c.interPurchaseTime >= 0, 'IPT should be >= 0');
    assert.ok(c.basketDepth >= 1, 'Basket depth should be >= 1');
  }
});

test('Skewness reduction via log1p and StandardScaler normalization', () => {
  const uciData = generateUCIOnlineRetailSample();
  const mapping = autoDetectColumnMapping(Object.keys(uciData[0]));
  const { cleanedRows } = stitchAndCleanData(uciData, mapping);
  const { customerRFMList } = calculate5DRFM(cleanedRows);

  const { featuresStandardized, scaler, stats } = preprocessRFM(customerRFMList);

  assert.equal(featuresStandardized.length, customerRFMList.length);
  assert.equal(scaler.means.length, 5);
  assert.equal(scaler.stds.length, 5);

  // Check that monetary skewness is reduced
  const monStat = stats.find((s) => s.feature === 'monetary');
  assert.ok(monStat, 'Monetary stats should be present');
  assert.ok(Math.abs(monStat!.logSkewness) <= Math.abs(monStat!.rawSkewness) + 0.1);
});

test('K-Means clustering and persona ranking assign Champions to top spenders', () => {
  const uciData = generateUCIOnlineRetailSample();
  const mapping = autoDetectColumnMapping(Object.keys(uciData[0]));
  const { cleanedRows } = stitchAndCleanData(uciData, mapping);
  const { customerRFMList } = calculate5DRFM(cleanedRows);
  const { featuresStandardized } = preprocessRFM(customerRFMList);

  const k = 4;
  const { labels, centroids: kCentroids, wcss } = runKMeans(featuresStandardized, k, 5, 50);
  assert.equal(labels.length, customerRFMList.length);
  assert.ok(wcss > 0, 'WCSS should be positive');

  const { customerListWithPersonas, centroids } = rankClustersToPersonas(
    customerRFMList,
    labels,
    k,
    kCentroids
  );

  assert.equal(centroids.length, k);
  assert.equal(centroids[0].persona, 'Champions (VIP Loyalists)');
  assert.ok(
    centroids[0].monetaryMean >= centroids[centroids.length - 1].monetaryMean,
    'Champions monetary mean should be >= Hibernating monetary mean'
  );

  const metrics = calculateClusteringMetrics(featuresStandardized, labels, k, kCentroids);
  assert.ok(metrics.silhouetteScore > 0, 'Silhouette should be > 0');
  assert.ok(metrics.daviesBouldinIndex > 0, 'Davies-Bouldin should be > 0');

  const benchmark = runAlgorithmBenchmark(
    metrics.silhouetteScore,
    metrics.daviesBouldinIndex,
    metrics.calinskiHarabaszIndex,
    centroids
  );
  assert.equal(benchmark.length, 6, 'Should benchmark 6 algorithms');
  assert.equal(benchmark[0].algorithm, 'K-Means (Extended RFM)');
  assert.equal(benchmark[0].isValid, true, 'K-Means should pass 2%-80% validity check');

  const avgLink = benchmark.find((b) => b.algorithm === 'Average Linkage');
  assert.equal(avgLink?.isValid, false, 'Average linkage should fail validity check');
});

test('Temporal holdout predictive validation splits timeline and calculates repurchase', () => {
  const uciData = generateUCIOnlineRetailSample();
  const mapping = autoDetectColumnMapping(Object.keys(uciData[0]));
  const { cleanedRows } = stitchAndCleanData(uciData, mapping);
  const { customerRFMList } = calculate5DRFM(cleanedRows);
  const { featuresStandardized } = preprocessRFM(customerRFMList);
  const { labels, centroids } = runKMeans(featuresStandardized, 4, 3, 30);
  const { customerListWithPersonas } = rankClustersToPersonas(
    customerRFMList,
    labels,
    4,
    centroids
  );

  assert.ok(customerListWithPersonas.length > 0);

  const holdoutResult = runTemporalHoldoutCheck(cleanedRows, 4);
  assert.ok(holdoutResult.trainCustomerCount > 0);
  assert.ok(holdoutResult.segments.length === 4);
  // True out-of-sample: only customers seen before the split date are segmented.
  const seenBeforeSplit = new Set(cleanedRows.filter((r) => r.dateStr < holdoutResult.splitDate).map((r) => r.unifiedKey));
  assert.ok(holdoutResult.trainCustomerCount <= seenBeforeSplit.size);
});

test('Adjusted Rand Index and live bootstrap stability', () => {
  assert.equal(adjustedRandIndex([0, 0, 1, 1], [1, 1, 0, 0]), 1, 'label permutation is a perfect match');
  // Reference values from sklearn.metrics.adjusted_rand_score
  assert.ok(Math.abs(adjustedRandIndex([0, 0, 0, 1, 1, 1], [0, 1, 2, 0, 1, 2]) - -0.363636) < 1e-5);
  assert.ok(Math.abs(adjustedRandIndex([0, 0, 1, 1, 2, 2, 0, 1], [1, 1, 0, 0, 2, 0, 2, 1]) - 0.047619) < 1e-5);
  const pts = [...Array(40)].map((_, i) => (i < 20 ? [(i % 5) * 0.01, 0] : [10 + (i % 5) * 0.01, 10]));
  const { labels } = runKMeans(pts, 2, 3, 30);
  assert.ok(bootstrapStabilityARI(pts, 2, labels, 5) > 0.95, 'two far-apart blobs are perfectly stable');
});

test('Early-stage flag: new or low-history customers', () => {
  // The UCI sample has no early-stage customers, so the Bangladeshi demo shop is used to exercise both branches.
  const data = generateRichBangladeshiStoreSample();
  const { cleanedRows } = stitchAndCleanData(data, autoDetectColumnMapping(Object.keys(data[0])));
  const { customerRFMList } = calculate5DRFM(cleanedRows);
  for (const c of customerRFMList) {
    assert.equal(c.lifecycleStage === 'Early-Stage', c.tenureDays! <= 90 || c.frequency <= 2);
  }
  assert.ok(customerRFMList.some((c) => c.lifecycleStage === 'Early-Stage'), 'sample contains early-stage customers');
  assert.ok(customerRFMList.some((c) => c.lifecycleStage === 'Established'), 'sample contains established customers');
});

test('Two-track: every early-stage customer gets one of three lifecycle segments, named by profile', () => {
  // Three clear newcomer profiles (5 each, slightly jittered) plus established customers that must stay untouched.
  const mk = (i: number, frequency: number, tenureDays: number, monetary: number, recency: number, basketDepth: number, stage: 'Early-Stage' | 'Established'): CustomerRFMTD => ({
    customerKey: `c${i}`, isGuest: false, firstPurchaseDate: new Date(), lastPurchaseDate: new Date(), recency: recency + i, frequency,
    monetary: monetary + 7 * i, avgOrderValue: monetary / frequency, interPurchaseTime: 0, basketDepth, isSinglePurchase: frequency === 1, tenureDays: tenureDays + i, lifecycleStage: stage,
  });
  const input = [
    ...[0, 1, 2, 3, 4].map((i) => mk(i, 2, 60, 1500, 10, 50, 'Early-Stage')),
    ...[5, 6, 7, 8, 9].map((i) => mk(i, 1, 20, 300, 20, 5, 'Early-Stage')),
    ...[10, 11, 12, 13, 14].map((i) => mk(i, 1, 250, 280, 250, 5, 'Early-Stage')),
    ...[15, 16, 17].map((i) => mk(i, 9, 400, 5000, 15, 80, 'Established')),
  ];
  const out = assignEarlySegments(input);
  for (const c of out) assert.equal(Boolean(c.earlySegment), c.lifecycleStage === 'Early-Stage');
  assert.deepEqual(out.slice(0, 15).map((c) => c.earlySegment), [
    ...Array(5).fill('Promising Newcomers'), ...Array(5).fill('Developing Newcomers'), ...Array(5).fill('One-and-Done Risk'),
  ]);

  // Below 9 early-stage customers the definitions are applied as rules.
  const tiny = assignEarlySegments([mk(0, 2, 200, 100, 5, 3, 'Early-Stage'), mk(1, 1, 20, 100, 20, 3, 'Early-Stage'), mk(2, 1, 300, 100, 300, 3, 'Early-Stage')]);
  assert.deepEqual(tiny.map((c) => c.earlySegment), ['Promising Newcomers', 'Developing Newcomers', 'One-and-Done Risk']);

  // Regression: big one-order buyers must not be called "Promising" ahead of customers who already ordered again.
  const mixed = assignEarlySegments([
    ...[0, 1, 2, 3, 4].map((i) => mk(i, 2, 100, 300, 30, 4, 'Early-Stage')),
    ...[5, 6, 7, 8, 9].map((i) => mk(i, 1, 20, 5000, 20, 4, 'Early-Stage')),
    ...[10, 11, 12, 13, 14].map((i) => mk(i, 1, 250, 280, 250, 4, 'Early-Stage')),
  ]);
  assert.deepEqual(mixed.map((c) => c.earlySegment), [
    ...Array(5).fill('Promising Newcomers'), ...Array(5).fill('Developing Newcomers'), ...Array(5).fill('One-and-Done Risk'),
  ]);
});

test('WhatsApp Bulk Tool Export formats E.164 phone numbers and generates WATI/AiSensy CSV', () => {
  // Test E.164 conversion
  assert.equal(formatE164Phone('01711234567'), '8801711234567');
  assert.equal(formatE164Phone('+8801819876543'), '8801819876543');
  assert.equal(formatE164Phone('008801914556677'), '8801914556677');
  assert.equal(formatE164Phone('017-5511-2233'), '8801755112233');

  const testCustomers: CustomerRFMTD[] = [
    {
      customerKey: 'cust_01',
      phone: '+8801711234567',
      isGuest: false,
      firstPurchaseDate: new Date(),
      lastPurchaseDate: new Date(),
      recency: 5,
      frequency: 6,
      monetary: 8500,
      avgOrderValue: 1416,
      interPurchaseTime: 12,
      basketDepth: 4,
      isSinglePurchase: false,
      persona: 'Champions (VIP Loyalists)',
    },
    {
      customerKey: 'phone_01819876543',
      phone: '01819876543',
      isGuest: true,
      firstPurchaseDate: new Date(),
      lastPurchaseDate: new Date(),
      recency: 120,
      frequency: 1,
      monetary: 2450,
      avgOrderValue: 2450,
      interPurchaseTime: 0,
      basketDepth: 1,
      isSinglePurchase: true,
      persona: 'Hibernating / Lost Guests',
    },
  ];

  const exportResult = generateWhatsAppBulkExport(testCustomers, {
    toolFormat: 'wati_aisensy',
    segmentFilter: 'All',
    onlyValidPhones: true,
    shopName: 'Artisan Boutique Dhaka',
    currencySymbol: 'Tk ',
    campaignConfigs: {
      'Champions (VIP Loyalists)': {
        persona: 'Champions (VIP Loyalists)',
        discountCode: 'CHAMPION20',
        discountValue: '20% VIP Early Access',
        headline: 'VIP Offer',
        messageTemplate: 'Hi {name}, use {discount_code} at {shop_name}!',
      },
      'Loyal & Promising Regulars': {
        persona: 'Loyal & Promising Regulars',
        discountCode: 'LOYAL15',
        discountValue: '15% Off',
        headline: 'Loyalty Reward',
        messageTemplate: 'Hello {name}, enjoy 15% with {discount_code}.',
      },
      'High-Potential / At-Risk Guests': {
        persona: 'High-Potential / At-Risk Guests',
        discountCode: 'COMEBACK10',
        discountValue: '10% Treat',
        headline: 'We Miss You',
        messageTemplate: 'Hi {name}, take 10% with {discount_code}.',
      },
      'Hibernating / Lost Guests': {
        persona: 'Hibernating / Lost Guests',
        discountCode: 'WINBACK25',
        discountValue: '25% Win-back',
        headline: 'Win-back Offer',
        messageTemplate: 'Hey {name}, enjoy 25% off with {discount_code}!',
      },
    },
  });

  assert.equal(exportResult.validPhoneCount, 2);
  assert.ok(exportResult.csvContent.includes('"phone_number","name","segment"'));
  assert.ok(exportResult.csvContent.includes('8801711234567'));
  assert.ok(exportResult.csvContent.includes('8801819876543'));
  assert.ok(exportResult.csvContent.includes('CHAMPION20'));

  // A customer name from an uploaded file must not become a live spreadsheet formula.
  const evil = generateWhatsAppBulkExport([{ ...testCustomers[0], customerName: '=HYPERLINK("http://x")' }], {
    toolFormat: 'clean_phone_list', segmentFilter: 'All', onlyValidPhones: true, shopName: 'S', currencySymbol: 'Tk ',
    campaignConfigs: { 'Champions (VIP Loyalists)': { persona: 'Champions (VIP Loyalists)', discountCode: 'C', discountValue: 'x', headline: 'h', messageTemplate: 'Hi {name}' } } as any,
  });
  assert.ok(!evil.csvContent.includes('"=HYPERLINK'), 'formula is neutralised');
  assert.ok(evil.csvContent.includes(`"'=HYPERLINK`), 'name is kept, as text');

  // A new customer gets the lifecycle welcome, not the Champions discount.
  const newbie = generateWhatsAppBulkExport([{ ...testCustomers[0], earlySegment: 'Developing Newcomers' }], {
    toolFormat: 'clean_phone_list', segmentFilter: 'All', onlyValidPhones: true, shopName: 'S', currencySymbol: 'Tk ',
    campaignConfigs: { 'Champions (VIP Loyalists)': { persona: 'Champions (VIP Loyalists)', discountCode: 'C', discountValue: 'x', headline: 'h', messageTemplate: 'Hi {name} OFFERMARK' } } as any,
  });
  assert.ok(newbie.csvContent.includes('Welcome to S'), 'lifecycle message used');
  assert.ok(!newbie.csvContent.includes('OFFERMARK'), 'segment offer not used');
});

test('Extended synthetic Bangladeshi retail demo generates 150+ realistic orders', () => {
  const richData = generateRichBangladeshiStoreSample();
  assert.ok(richData.length >= 150, 'Should generate 150+ orders');
  const mapping = autoDetectColumnMapping(Object.keys(richData[0]));
  const { cleanedRows, stats } = stitchAndCleanData(richData, mapping);

  assert.ok(cleanedRows.length >= 140, 'Should have 140+ valid identified orders');
  assert.ok(stats.repeatGuestBuyersRecovered >= 5, 'Should recover at least 5 repeat guest buyers via phone');
  assert.ok(stats.uniqueCustomers >= 25, 'Should have 25+ unique customers');
});

test('calculateCampaignForecast accurately projects orders, gross revenue, messaging cost, and ROAS', () => {
  const dummyCustomers: CustomerRFMTD[] = [
    {
      customerKey: 'c1',
      phone: '01711234567',
      isGuest: false,
      recency: 5,
      frequency: 4,
      monetary: 10000,
      avgOrderValue: 2500,
      interPurchaseTime: 12,
      basketDepth: 3,
      isSinglePurchase: false,
      firstPurchaseDate: new Date('2024-01-01'),
      lastPurchaseDate: new Date('2024-03-01'),
      persona: 'Champions (VIP Loyalists)',
    },
    {
      customerKey: 'c2',
      phone: '01819876543',
      isGuest: true,
      recency: 12,
      frequency: 2,
      monetary: 4000,
      avgOrderValue: 2000,
      interPurchaseTime: 20,
      basketDepth: 2,
      isSinglePurchase: false,
      firstPurchaseDate: new Date('2024-01-10'),
      lastPurchaseDate: new Date('2024-02-20'),
      persona: 'Champions (VIP Loyalists)',
    },
    {
      customerKey: 'c3',
      // No phone
      isGuest: false,
      recency: 60,
      frequency: 1,
      monetary: 1500,
      avgOrderValue: 1500,
      interPurchaseTime: 0,
      basketDepth: 1,
      isSinglePurchase: true,
      firstPurchaseDate: new Date('2024-01-01'),
      lastPurchaseDate: new Date('2024-01-01'),
      persona: 'Hibernating / Lost Guests',
    },
  ];

  // Test forecast for Champions segment with 50% conversion and AOV = 3000, cost = 0.65
  const forecast = calculateCampaignForecast(dummyCustomers, {
    targetSegment: 'Champions (VIP Loyalists)',
    conversionRatePct: 50,
    predictedAOV: 3000,
    costPerMessage: 0.65,
  });

  assert.equal(forecast.audienceSize, 2);
  assert.equal(forecast.phoneReadyCount, 2);
  // 2 phone-ready * 50% = 1 order
  assert.equal(forecast.projectedOrders, 1);
  assert.equal(forecast.grossRevenue, 3000);
  assert.equal(forecast.totalMessagingCost, 1.3); // 2 * 0.65 = 1.3
  assert.equal(forecast.netRevenueGain, 2999); // round(3000 - 1.3)
  assert.ok(forecast.roas > 2000); // 3000 / 1.3 ~ 2307.7

  // Test scenario generator
  const scenarios = generateAllSegmentScenarios(dummyCustomers);
  assert.equal(scenarios.length, 4);
  const champScen = scenarios.find((s) => s.persona === 'Champions (VIP Loyalists)');
  assert.ok(champScen);
  assert.equal(champScen!.audienceSize, 2);
  assert.ok(champScen!.historicalAOV > 0);
  assert.ok(champScen!.projectedRevenue >= 0);
});

test('WhatsApp Shop KPIs calculate authentic Bangladeshi BDT metrics correctly', async () => {
  const {
    BANGLADESHI_WHATSAPP_SHOP_ORDERS,
    calculateWhatsAppShopKPIs,
    convertWhatsAppShopOrdersToRawRows,
    buildWhatsAppChatUrl,
  } = await import('../data/bangladeshiWhatsAppShopData');

  const kpis = calculateWhatsAppShopKPIs(BANGLADESHI_WHATSAPP_SHOP_ORDERS);

  // Assertions on realistic business ranges for BD F-commerce
  assert.ok(kpis.totalRevenueBDT > 50000, 'Total revenue in BDT should be substantial');
  assert.ok(kpis.totalOrders >= 40, 'Should have 40+ order records');
  assert.ok(kpis.uniqueCustomers >= 15, 'Should have multiple unique customers');
  assert.ok(kpis.repeatCustomers >= 5, 'Should identify repeat buyers across WhatsApp numbers');
  assert.ok(kpis.repeatCustomerRatePct > 0 && kpis.repeatCustomerRatePct < 100);
  assert.ok(kpis.avgOrderValueBDT > 1000, 'Average order value in BDT should be > 1000');
  assert.ok(kpis.prepaidSharePct > 0, 'Should have prepaid bKash/Nagad transactions');
  assert.ok(kpis.codCount > 0, 'Should have COD transactions');
  assert.ok(kpis.rtoCount >= 1, 'Should track RTO returned parcels for risk shield');

  // Test raw conversion for 5D RFM Engine
  const rawRows = convertWhatsAppShopOrdersToRawRows(BANGLADESHI_WHATSAPP_SHOP_ORDERS);
  assert.equal(rawRows.length, BANGLADESHI_WHATSAPP_SHOP_ORDERS.length);
  assert.ok(rawRows[0].order_id);
  assert.ok(rawRows[0].customer_name);
  assert.ok(rawRows[0].whatsapp_phone);
  assert.ok(rawRows[0].total_price > 0);

  // Test WhatsApp Click-to-chat URL Builder
  const chatUrl = buildWhatsAppChatUrl('01711234567', 'order_confirm', {
    customerName: 'Nusrat Jahan',
    items: 'Dhakai Jamdani Saree',
    totalAmountBDT: 6500,
    advancePaidBDT: 6500,
    dueAmountBDT: 0,
  });

  assert.ok(chatUrl.startsWith('https://wa.me/8801711234567?text='));
  assert.ok(decodeURIComponent(chatUrl).includes('Nusrat Jahan'));
  assert.ok(decodeURIComponent(chatUrl).includes('Dhakai Jamdani Saree'));
  assert.ok(decodeURIComponent(chatUrl).includes('6500'));
});

test('Personalized Recommendation Engine derives next-best product and segment offers', async () => {
  const {
    generateCustomerRecommendation,
    generateBulkRecommendations,
    getPersonaDiscountConfig,
    buildPersonalizedPitchScripts,
    BANGLADESHI_CATALOG,
  } = await import('./recommendationEngine');

  // 1. Discount config validation
  const vipConfig = getPersonaDiscountConfig('Champions (VIP Loyalists)');
  assert.equal(vipConfig.discountPct, 20);
  assert.equal(vipConfig.discountCode, 'VIP-CURATED20');

  const winbackConfig = getPersonaDiscountConfig('Hibernating / Lost Guests');
  assert.equal(winbackConfig.discountPct, 25);
  assert.equal(winbackConfig.discountCode, 'WINBACK25');

  // 2. Customer having bought a Jamdani Saree should receive complementary recommendation (Accessories / Dupatta)
  const mockSareeCustomer: CustomerRFMTD = {
    customerKey: 'cust_nusrat',
    phone: '+8801711234567',
    isGuest: false,
    firstPurchaseDate: new Date('2024-01-01'),
    lastPurchaseDate: new Date('2024-10-18'),
    recency: 8,
    frequency: 5,
    monetary: 22000,
    avgOrderValue: 4400,
    interPurchaseTime: 45,
    basketDepth: 4,
    isSinglePurchase: false,
    persona: 'Champions (VIP Loyalists)',
  };

  const pastItems = ['Handloom Dhakai Jamdani Saree (Royal Navy)'];
  const rec = generateCustomerRecommendation(mockSareeCustomer, pastItems, BANGLADESHI_CATALOG, '৳');

  assert.ok(rec.primaryRecommendation);
  assert.equal(rec.persona, 'Champions (VIP Loyalists)');
  assert.equal(rec.primaryRecommendation.discountPct, 20);
  assert.equal(rec.primaryRecommendation.discountCode, 'VIP-CURATED20');
  // It shouldn't recommend the exact same Saree since she just bought it
  assert.notEqual(rec.primaryRecommendation.sku, 'JAM-DHK-01');
  // The recommended price should be discounted by 20%
  const expectedPrice = Math.round(rec.primaryRecommendation.originalPrice * 0.8);
  assert.equal(rec.primaryRecommendation.discountedPrice, expectedPrice);
  assert.ok(rec.primaryRecommendation.bundleSavings > 0);
  assert.ok(rec.primaryRecommendation.affinityScorePct >= 70);

  // 3. Pitch scripts should contain valid discount code and price
  assert.ok(rec.primaryRecommendation.pitchSnippetEn.includes('VIP-CURATED20'));
  assert.ok(rec.primaryRecommendation.pitchSnippetBn.includes('VIP-CURATED20'));
  assert.ok(rec.primaryRecommendation.pitchSnippetEn.includes('৳'));

  // 4. Bulk recommendations map
  const mockCustList: CustomerRFMTD[] = [mockSareeCustomer];
  const bulkMap = generateBulkRecommendations(mockCustList, [], BANGLADESHI_CATALOG, '৳');
  assert.ok(bulkMap.has('cust_nusrat'));
  assert.equal(bulkMap.get('cust_nusrat')?.primaryRecommendation.sku, rec.primaryRecommendation.sku);
});

test('F-Commerce Messenger fallback targets Facebook ID when WhatsApp phone is missing', async () => {
  const {
    buildMessengerChatUrl,
    buildFCommerceDispatchUrl,
  } = await import('../data/bangladeshiWhatsAppShopData');
  const { normalizeMessengerId } = await import('./identityStitcher');

  // 1. Messenger ID normalization
  assert.equal(normalizeMessengerId('https://m.me/tanvir.dhaka'), 'm.me/tanvir.dhaka');
  assert.equal(normalizeMessengerId('https://www.facebook.com/sadia.crafts'), 'm.me/sadia.crafts');
  assert.equal(normalizeMessengerId('m.me/tanjina.style.bd'), 'm.me/tanjina.style.bd');
  assert.equal(normalizeMessengerId('rezaul.karim.bd'), 'm.me/rezaul.karim.bd');

  // 2. Direct Messenger chat URL builder
  const messengerUrl = buildMessengerChatUrl('m.me/tanvir.dhaka', 'order_confirm', {
    customerName: 'Tanvir Ahmed',
    items: 'Handloom Dhakai Jamdani Saree',
    totalAmountBDT: 6500,
    advancePaidBDT: 150,
    dueAmountBDT: 6350,
  });
  assert.ok(messengerUrl.startsWith('https://m.me/tanvir.dhaka?text='));
  assert.ok(decodeURIComponent(messengerUrl).includes('Tanvir Ahmed'));
  assert.ok(decodeURIComponent(messengerUrl).includes('6500'));

  // 3. Smart F-Commerce Dispatcher: When WhatsApp is missing, automatically fallback to Messenger!
  const orderWithoutPhone = {
    orderId: 'DHK-FC-999',
    orderDate: '2024-10-24',
    customerName: 'Tanjina Akhter',
    orderChannel: 'Facebook Messenger' as const,
    whatsappPhone: '', // MISSING WHATSAPP PHONE!
    facebookProfileId: 'm.me/tanjina.style.bd',
    preferredChannel: 'messenger' as const,
    items: 'Handloom Dhakai Jamdani Saree',
    category: "Women's Ethnic",
    quantity: 1,
    unitPrice: 6500,
    totalAmountBDT: 6500,
    paymentMethod: 'bKash Personal' as const,
    advancePaidBDT: 6500,
    dueAmountBDT: 0,
    deliveryDistrict: 'Dhaka',
    courierPartner: 'Pathao Courier' as const,
    deliveryStatus: 'In Transit' as const,
    trackingNumber: 'PTH-999',
  };

  const dispatch = buildFCommerceDispatchUrl(orderWithoutPhone, 'order_confirm', {
    customerName: 'Tanjina Akhter',
    items: 'Handloom Dhakai Jamdani Saree',
    totalAmountBDT: 6500,
  });

  assert.equal(dispatch.channel, 'Facebook Messenger');
  assert.ok(dispatch.url.startsWith('https://m.me/tanjina.style.bd?text='));
  assert.equal(dispatch.identifier, 'tanjina.style.bd');

  // 4. When WhatsApp phone is present, prefer WhatsApp
  const orderWithPhone = {
    ...orderWithoutPhone,
    whatsappPhone: '+8801711234567',
    orderChannel: 'WhatsApp' as const,
    preferredChannel: 'whatsapp' as const,
  };

  const waDispatch = buildFCommerceDispatchUrl(orderWithPhone, 'order_confirm', {
    customerName: 'Tanjina Akhter',
  });
  assert.equal(waDispatch.channel, 'WhatsApp');
  assert.ok(waDispatch.url.startsWith('https://wa.me/8801711234567?text='));
});

test('Dynamic Data Hygiene Audit calculates purity rate, exclusion log, and recovered guest records', () => {
  const sampleData = generateRichBangladeshiStoreSample();
  const mapping = autoDetectColumnMapping(Object.keys(sampleData[0]));
  const { cleanedRows, stats } = stitchAndCleanData(sampleData, mapping);

  assert.ok(stats.dataPurityPct >= 90, 'Purity percentage should be >= 90%');
  assert.ok(stats.filteredRecords.length >= 1, 'Should record filtered exclusion items');
  assert.ok(stats.filteredRecords[0].orderId, 'Should have orderId for filtered item');
  assert.ok(stats.filteredRecords[0].reasonLabel, 'Should have human-readable reasonLabel');
  assert.ok(stats.recoveredGuests.length >= 1, 'Should have detailed recovered guest records');
  assert.ok(stats.recoveredGuests[0].orderCount >= 2, 'Recovered guest should have >= 2 orders');
  assert.ok(stats.recoveredGuests[0].totalSpent > 0, 'Recovered guest should have total spend recorded');
  assert.ok(stats.phoneIdentifiedCount > 0, 'Should track phone identified count');
});

// Regressions found by running the app on the real UCI Online Retail file.
test('Established track: one-order buyers cannot empty the four groups (UCI showed groups of 4 and 1 customers)', () => {
  const mk = (i: number, f: number, m: number, r: number, d: number, t: number, stage: 'Early-Stage' | 'Established'): CustomerRFMTD => ({
    customerKey: `c${i}`, isGuest: false, firstPurchaseDate: new Date(), lastPurchaseDate: new Date(),
    recency: r + (i % 5), frequency: f, monetary: m * (1 + (i % 7) / 50), avgOrderValue: m / f, interPurchaseTime: t,
    basketDepth: d + (i % 4), isSinglePurchase: f === 1, tenureDays: 300, lifecycleStage: stage,
  });
  const customers = [
    ...Array.from({ length: 10 }, (_, i) => mk(i, 30, 20000, 5, 200, 10, 'Established')),
    ...Array.from({ length: 10 }, (_, i) => mk(10 + i, 10, 4000, 25, 100, 30, 'Established')),
    ...Array.from({ length: 10 }, (_, i) => mk(20 + i, 5, 1500, 80, 60, 60, 'Established')),
    ...Array.from({ length: 10 }, (_, i) => mk(30 + i, 4, 1000, 200, 20, 90, 'Established')),
    ...Array.from({ length: 300 }, (_, i) => mk(40 + i, 1, 50 + (i * 97) % 5000, 1 + (i * 37) % 370, 1 + (i * 13) % 150, 0, 'Early-Stage')),
  ];
  const out = segmentEstablished(customers, 4).customers;
  const established = (p: string) => out.filter((c) => c.lifecycleStage === 'Established' && c.persona === p).length;
  for (const p of ['Champions (VIP Loyalists)', 'Loyal & Promising Regulars', 'High-Potential / At-Risk Guests', 'Hibernating / Lost Guests']) {
    assert.equal(established(p), 10, p);
  }
  assert.ok(out.every((c) => c.persona), 'every customer gets the nearest group');
});

test('Real data: anonymous orders are dropped, no Messenger handle is invented, unreachable customers are not counted as reach', () => {
  const rows = [
    { InvoiceNo: '1', InvoiceDate: '2024-01-05 10:00', CustomerID: '17850', StockCode: 'A1', Description: 'T-LIGHT HOLDER', Quantity: '2', UnitPrice: '3' },
    { InvoiceNo: '2', InvoiceDate: '2024-01-06 10:00', CustomerID: '', StockCode: 'A1', Description: 'T-LIGHT HOLDER', Quantity: '1', UnitPrice: '3' },
  ];
  const { cleanedRows, stats } = stitchAndCleanData(rows, autoDetectColumnMapping(Object.keys(rows[0])));
  assert.equal(cleanedRows.length, 1);
  assert.ok(stats.filteredRecords.some((f) => f.reason === 'no_customer_identity'));
  assert.equal(cleanedRows[0].productName, 'T-LIGHT HOLDER');

  const cust = { ...calculate5DRFM(cleanedRows).customerRFMList[0], persona: 'Champions (VIP Loyalists)' as const };
  assert.equal(cust.messengerId, undefined, 'no m.me handle guessed from the customer ID');
  const exported = generateWhatsAppBulkExport([cust], {
    toolFormat: 'fcommerce_multichannel', segmentFilter: 'All', onlyValidPhones: false, shopName: 'Shop', currencySymbol: '£', campaignConfigs: DEFAULT_CAMPAIGN_CONFIGS,
  });
  assert.equal(exported.rows.length, 0, 'no phone and no Messenger ID: not in the send list');
  assert.equal(calculateCampaignForecast([cust], { targetSegment: 'All', conversionRatePct: 50, predictedAOV: 100 }).projectedOrders, 0);
});

test("Shop catalog: suggestions name the shop's own best sellers, not demo products", async () => {
  const { buildShopCatalog, generateBulkRecommendations } = await import('./recommendationEngine');
  const line = (key: string, sku: string, name: string, price: number) => ({
    orderId: key + sku, timestamp: new Date(), dateStr: '2024-01-01', unifiedKey: key, isGuest: false, sku, productName: name, quantity: 1, unitPrice: price, totalAmount: price,
  });
  const rows = [line('a', 'P1', 'LANTERN', 4), line('b', 'P1', 'LANTERN', 4), line('c', 'P1', 'LANTERN', 4), line('a', 'P2', 'MUG', 2), line('b', 'P2', 'MUG', 2), line('c', 'P3', 'BAG', 9)];
  const catalog = buildShopCatalog(rows);
  assert.deepEqual(catalog.map((c) => c.name), ['LANTERN', 'MUG', 'BAG']);
  const customer: CustomerRFMTD = {
    customerKey: 'c', isGuest: false, firstPurchaseDate: new Date(), lastPurchaseDate: new Date(), recency: 5, frequency: 2, monetary: 13,
    avgOrderValue: 6.5, interPurchaseTime: 10, basketDepth: 2, isSinglePurchase: false, persona: 'Loyal & Promising Regulars',
  };
  // c has LANTERN and BAG; the two other LANTERN buyers also bought MUG, so MUG is suggested.
  assert.equal(generateBulkRecommendations([customer], rows, catalog, '£').get('c')!.primaryRecommendation.productName, 'MUG');
});

test('Related products: an electronics buyer is offered what buyers of the same product chose, led by recent purchases', async () => {
  const { buildShopCatalog, generateBulkRecommendations, exploresOtherTypes } = await import('./recommendationEngine');
  const day = (n: number) => new Date(Date.UTC(2024, 0, 1) + n * 86_400_000);
  const line = (key: string, name: string, price: number, n: number) => ({
    orderId: key + name, timestamp: day(n), dateStr: '', unifiedKey: key, isGuest: false, sku: name, productName: name, quantity: 1, unitPrice: price, totalAmount: price,
  });
  const rows = [
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => line(`s${i}`, 'Jamdani Saree', 3000, 300)), // the shop's best seller
    ...[0, 1, 2].flatMap((i) => [line(`p${i}`, 'Smart Phone A10', 15000, 300), line(`p${i}`, 'Fast Charger 25W', 900, 300)]),
    ...[0, 1, 2].flatMap((i) => [line(`r${i}`, 'Chinigura Rice 5kg', 700, 300), line(`r${i}`, 'Masoor Lentils 1kg', 150, 300)]),
  ];
  const keys = Array.from({ length: 12 }, (_, i) => `buyer${i}`);
  const regular = keys.find((k) => !exploresOtherTypes(k))!;
  const explorer = keys.find((k) => exploresOtherTypes(k))!;
  // Both bought rice two years ago and the phone last week.
  for (const k of [regular, explorer]) rows.push(line(k, 'Chinigura Rice 5kg', 700, 0), line(k, 'Smart Phone A10', 15000, 730));
  const cust = (customerKey: string): CustomerRFMTD => ({
    customerKey, isGuest: false, firstPurchaseDate: day(0), lastPurchaseDate: day(730), recency: 1, frequency: 2, monetary: 15700,
    avgOrderValue: 7850, interPurchaseTime: 730, basketDepth: 2, isSinglePurchase: false, persona: 'Loyal & Promising Regulars',
  });
  const recs = generateBulkRecommendations([cust(regular), cust(explorer)], rows, buildShopCatalog(rows), 'Tk ');
  const r = recs.get(regular)!.primaryRecommendation;
  assert.deepEqual([r.productName, r.suggestionKind, r.basisProduct], ['Fast Charger 25W', 'bought together', 'Smart Phone A10'],
    'the recent phone leads (not the old rice), and other phone buyers chose the charger over the more popular saree');
  const e = recs.get(explorer)!.primaryRecommendation;
  assert.equal(e.suggestionKind, 'something new');
  assert.notEqual(e.productName, 'Fast Charger 25W', 'an explorer is offered another type of product');
});

test('Related products: about one customer in four is offered another type of product, always the same ones', async () => {
  const { exploresOtherTypes } = await import('./recommendationEngine');
  const keys = Array.from({ length: 4000 }, (_, i) => `customer-${i}`);
  const share = keys.filter(exploresOtherTypes).length / keys.length;
  assert.ok(share > 0.22 && share < 0.28, `share ${share}`);
  assert.deepEqual(keys.slice(0, 50).map(exploresOtherTypes), keys.slice(0, 50).map(exploresOtherTypes));
});

test('Shop ledger: line items become one order, returns are dropped, nothing is invented', async () => {
  const { convertRawRowsToWhatsAppShopOrders } = await import('../data/bangladeshiWhatsAppShopData');
  const orders = convertRawRowsToWhatsAppShopOrders([
    { InvoiceNo: '536365', InvoiceDate: '2010-12-01 08:26', CustomerID: '17850', Description: 'LANTERN', Quantity: '2', UnitPrice: '3' },
    { InvoiceNo: '536365', InvoiceDate: '2010-12-01 08:26', CustomerID: '17850', Description: 'MUG', Quantity: '1', UnitPrice: '5' },
    { InvoiceNo: 'C536379', InvoiceDate: '2010-12-01 09:41', CustomerID: '17850', Description: 'MUG', Quantity: '-1', UnitPrice: '5' },
  ]);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].totalAmountBDT, 11);
  assert.equal(orders[0].customerName, 'Customer 17850');
  assert.equal(orders[0].paymentMethod, 'Not recorded');
  assert.equal(orders[0].deliveryDistrict, 'Not recorded');
  assert.equal(orders[0].facebookProfileId, undefined);
});





test('Behaviour prediction: BG/NBD and Gamma-Gamma match the published CDNOW results and recover simulated customers', async () => {
  const bm = await import('./behaviourModel');
  assert.ok(Math.abs(bm.lnGamma(5) - Math.log(24)) < 1e-10);
  assert.ok(Math.abs(bm.lnGamma(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-10);
  // Fader, Hardie & Lee (2005): with r 0.243, alpha 4.414, a 0.793, b 2.426, a customer with x = 2, t_x = 30.43, T = 38.86
  // weeks is expected to make 1.226 purchases in the next 39 weeks.
  const paper = { r: 0.243, alpha: 4.414, a: 0.793, b: 2.426 };
  const c = { customerKey: 'k', x: 2, tx: 30.43, T: 38.86, purchases: 3, avgValue: 1 };
  assert.equal(bm.expectedPurchases(paper, c, 39).toFixed(3), '1.226');

  // Simulate 1,500 customers from known BG/NBD parameters (weeks), then check the fit gets them back.
  let seed = 7;
  const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  const gamma = (shape: number, scale: number): number => { // Marsaglia-Tsang
    if (shape < 1) return gamma(shape + 1, scale) * Math.pow(rand(), 1 / shape);
    const d = shape - 1 / 3, k = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number, v: number;
      do { const u1 = rand(), u2 = rand(); x = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); v = 1 + k * x; } while (v <= 0);
      v = v * v * v; const u = rand();
      if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v * scale;
    }
  };
  const beta = (a: number, b: number) => { const x = gamma(a, 1); return x / (x + gamma(b, 1)); };
  const truth = { r: 0.8, alpha: 6, a: 1.5, b: 4 };
  const data = Array.from({ length: 1500 }, (_, i) => {
    const lambda = gamma(truth.r, 1 / truth.alpha), p = beta(truth.a, truth.b), T = 52;
    let t = 0, last = 0, x = 0;
    for (;;) {
      t += -Math.log(rand()) / lambda;
      if (t > T) break;
      x++; last = t;
      if (rand() < p) break; // becomes inactive after this purchase
    }
    return { customerKey: String(i), x, tx: last, T, purchases: x + 1, avgValue: 1 };
  });
  const fit = bm.fitBgNbd(data);
  for (const k of ['r', 'alpha', 'a', 'b'] as const) assert.ok(Math.abs(Math.log(fit[k] / truth[k])) < 0.5, `${k}: ${fit[k]}`);

  assert.equal(bm.rocAuc([0.1, 0.4, 0.35, 0.8], [false, false, true, true]), 0.75);
  // On the shop's own orders: a finite accuracy and predictions for every customer.
  const { cleanedRows } = stitchAndCleanData(generateUCIOnlineRetailSample(), autoDetectColumnMapping(Object.keys(generateUCIOnlineRetailSample()[0])));
  const model = bm.predictBehaviour(cleanedRows, 90);
  assert.ok(model && model.customers.length > 0);
  for (const p of model!.customers) assert.ok(p.pActive >= 0 && p.pActive <= 1 && p.expectedOrders >= 0 && Number.isFinite(p.predictedSpend));
});

test('picking a suggested discount updates the offer, code, message and price together', () => {
  for (const [persona, o] of Object.entries(OFFER_OPTIONS)) assert.ok(o.options.includes(o.suggested), persona);
  const vip = DEFAULT_CAMPAIGN_CONFIGS['Champions (VIP Loyalists)'];
  assert.equal(offerPct(vip), 20);
  const five = withOfferPct(vip, 5);
  assert.equal(five.discountValue, '5% VIP Early Access');
  assert.equal(five.discountCode, 'VIP-CURATED5');
  assert.ok(five.messageTemplate.includes('5% privilege') && !five.messageTemplate.includes('20%'));
  assert.equal(offerPrice(1000, 800, five), 950);
  assert.equal(offerPrice(undefined, 800, five), 800);
  assert.equal(withOfferPct({ ...vip, discountValue: 'Free delivery', discountCode: 'FREE' }, 10).discountValue, '10% Off Free delivery');
});

test('Bangla messages carry the same percentage and fill-in words as the English ones', () => {
  for (const [persona, cfg] of Object.entries(DEFAULT_CAMPAIGN_CONFIGS)) {
    const bn = BANGLA_TEMPLATES[persona as keyof typeof BANGLA_TEMPLATES];
    assert.ok(bn.includes(`${offerPct(cfg)}%`), `${persona}: percentage`);
    for (const tag of ['{name}', '{shop_name}', '{suggested_product}', '{suggested_price}', '{discount_code}']) assert.ok(bn.includes(tag), `${persona}: ${tag}`);
    assert.ok(withOfferPct({ ...cfg, messageTemplate: bn }, 5).messageTemplate.includes('5%'));
  }
  for (const m of Object.values(EARLY_MESSAGES_BN)) assert.ok(m.includes('{name}') && m.includes('{shop_name}'));
});
