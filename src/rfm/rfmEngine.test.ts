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
  runAlgorithmBenchmark,
  runTemporalHoldoutCheck,
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

  const customerMap = new Map(
    customerListWithPersonas.map((c) => [c.customerKey, c.persona!])
  );

  const holdoutResult = runTemporalHoldoutCheck(cleanedRows, customerMap);
  assert.ok(holdoutResult.trainCustomerCount > 0);
  assert.ok(holdoutResult.segments.length === 4);
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




