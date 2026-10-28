import {
  CleanedTransaction,
  CustomerRFMTD,
  PreprocessingStats,
} from './types';

/**
 * Calculates Fisher-Pearson skewness coefficient
 */
export function calculateSkewness(values: number[]): { mean: number; std: number; skewness: number } {
  const n = values.length;
  if (n < 3) return { mean: 0, std: 1, skewness: 0 };

  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  let m2 = 0;
  let m3 = 0;

  for (let i = 0; i < n; i++) {
    const diff = values[i] - mean;
    m2 += diff * diff;
    m3 += diff * diff * diff;
  }

  const variance = m2 / n;
  const std = Math.sqrt(variance) || 1e-9;
  const skewness = (m3 / n) / Math.pow(variance, 1.5);

  return { mean, std, skewness };
}

/**
 * Calculates 5D Extended RFM (R, F, M, T, D) per customer
 */
export function calculate5DRFM(
  cleanedRows: CleanedTransaction[]
): {
  customerRFMList: CustomerRFMTD[];
  referenceDate: Date;
} {
  if (cleanedRows.length === 0) {
    return { customerRFMList: [], referenceDate: new Date() };
  }

  // Find max date in dataset
  let maxTime = -Infinity;
  for (const row of cleanedRows) {
    const t = row.timestamp.getTime();
    if (t > maxTime) maxTime = t;
  }

  // Reference date = max date + 1 day (standard RFM practice)
  const referenceDate = new Date(maxTime + 24 * 60 * 60 * 1000);

  // Group by customer key
  interface CustomerGroup {
    customerKey: string;
    customerName?: string;
    phone?: string;
    email?: string;
    messengerId?: string;
    facebookProfileId?: string;
    orderChannel?: 'WhatsApp' | 'Facebook Messenger' | 'Facebook Page Direct';
    isGuest: boolean;
    orders: Map<string, { timestamp: Date; amount: number }>;
    skus: Set<string>;
    totalSpend: number;
    firstDate: Date;
    lastDate: Date;
  }

  const groups = new Map<string, CustomerGroup>();

  for (const row of cleanedRows) {
    let g = groups.get(row.unifiedKey);
    if (!g) {
      g = {
        customerKey: row.unifiedKey,
        customerName: row.customerName,
        phone: row.phone,
        email: row.email,
        messengerId: row.messengerId,
        facebookProfileId: row.facebookProfileId,
        orderChannel: row.orderChannel,
        isGuest: row.isGuest,
        orders: new Map(),
        skus: new Set(),
        totalSpend: 0,
        firstDate: row.timestamp,
        lastDate: row.timestamp,
      };
      groups.set(row.unifiedKey, g);
    }

    if (!g.customerName && row.customerName) g.customerName = row.customerName;
    if (!g.phone && row.phone) g.phone = row.phone;
    if (!g.messengerId && row.messengerId) g.messengerId = row.messengerId;
    if (!g.facebookProfileId && row.facebookProfileId) g.facebookProfileId = row.facebookProfileId;
    if (row.orderChannel) g.orderChannel = row.orderChannel;

    if (row.timestamp < g.firstDate) g.firstDate = row.timestamp;
    if (row.timestamp > g.lastDate) g.lastDate = row.timestamp;

    if (!g.orders.has(row.orderId)) {
      g.orders.set(row.orderId, { timestamp: row.timestamp, amount: 0 });
    }
    const orderData = g.orders.get(row.orderId)!;
    orderData.amount += row.totalAmount;
    g.totalSpend += row.totalAmount;
    g.skus.add(row.sku);
  }

  const customerRFMList: CustomerRFMTD[] = [];

  for (const g of groups.values()) {
    // Recency: Days between last purchase and reference date
    const diffMs = referenceDate.getTime() - g.lastDate.getTime();
    const recency = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    // Frequency: Count of distinct orders
    const frequency = g.orders.size;

    // Monetary: Total spend
    const monetary = Math.round(g.totalSpend * 100) / 100;
    const avgOrderValue = frequency > 0 ? Math.round((monetary / frequency) * 100) / 100 : 0;

    // Inter-Purchase Time (T): Mean days between consecutive shopping events
    let interPurchaseTime = 0;
    if (frequency > 1) {
      const orderDates = Array.from(g.orders.values())
        .map((o) => o.timestamp.getTime())
        .sort((a, b) => a - b);

      let dayGapsSum = 0;
      let gapCount = 0;

      for (let i = 0; i < orderDates.length - 1; i++) {
        const gapDays = (orderDates[i + 1] - orderDates[i]) / (1000 * 60 * 60 * 24);
        if (gapDays > 0) {
          dayGapsSum += gapDays;
          gapCount++;
        }
      }

      interPurchaseTime = gapCount > 0 ? Math.round((dayGapsSum / gapCount) * 10) / 10 : 0;
    }

    // Basket Depth (D): Distinct products/SKUs
    const basketDepth = Math.max(1, g.skus.size);

    const messengerHandle = g.messengerId
      ? (g.messengerId.startsWith('m.me/') ? g.messengerId : `m.me/${g.messengerId.replace(/^https?:\/\/m\.me\//, '')}`)
      : (g.customerKey.startsWith('fb_')
          ? `m.me/${g.customerKey.replace('fb_', '')}`
          : (!g.phone
              ? `m.me/${g.customerKey.replace(/^(cust_|phone_|email_|guest_order_)/, '').toLowerCase().replace(/[^a-z0-9._-]/g, '.')}`
              : (g.facebookProfileId || undefined)));

    const orderChannel: 'WhatsApp' | 'Facebook Messenger' | 'Facebook Page Direct' =
      g.orderChannel || (g.phone ? 'WhatsApp' : 'Facebook Messenger');
    const preferredChannel: 'whatsapp' | 'messenger' = g.phone ? 'whatsapp' : 'messenger';

    customerRFMList.push({
      customerKey: g.customerKey,
      customerName: g.customerName,
      phone: g.phone,
      email: g.email,
      messengerId: messengerHandle,
      facebookProfileId: messengerHandle,
      orderChannel,
      preferredChannel,
      isGuest: g.isGuest,
      firstPurchaseDate: g.firstDate,
      lastPurchaseDate: g.lastDate,
      recency,
      frequency,
      monetary,
      avgOrderValue,
      interPurchaseTime,
      basketDepth,
      isSinglePurchase: frequency === 1,
    });
  }

  return { customerRFMList, referenceDate };
}

export interface ScalerParams {
  means: number[];
  stds: number[];
}

/**
 * Preprocesses 5D features with np.log1p followed by StandardScaler (z-score)
 */
export function preprocessRFM(customerRFMList: CustomerRFMTD[]): {
  featuresStandardized: number[][];
  scaler: ScalerParams;
  stats: PreprocessingStats[];
} {
  const n = customerRFMList.length;
  if (n === 0) {
    return {
      featuresStandardized: [],
      scaler: { means: [0, 0, 0, 0, 0], stds: [1, 1, 1, 1, 1] },
      stats: [],
    };
  }

  const rawRecency = customerRFMList.map((c) => c.recency);
  const rawFrequency = customerRFMList.map((c) => c.frequency);
  const rawMonetary = customerRFMList.map((c) => c.monetary);
  const rawIPT = customerRFMList.map((c) => c.interPurchaseTime);
  const rawBasket = customerRFMList.map((c) => c.basketDepth);

  // Apply log1p: ln(1 + x)
  const logRecency = rawRecency.map((x) => Math.log1p(Math.max(0, x)));
  const logFrequency = rawFrequency.map((x) => Math.log1p(Math.max(0, x)));
  const logMonetary = rawMonetary.map((x) => Math.log1p(Math.max(0, x)));
  const logIPT = rawIPT.map((x) => Math.log1p(Math.max(0, x)));
  const logBasket = rawBasket.map((x) => Math.log1p(Math.max(0, x)));

  // Calculate skewness and stats
  const recStats = calculateSkewness(rawRecency);
  const logRecStats = calculateSkewness(logRecency);

  const freqStats = calculateSkewness(rawFrequency);
  const logFreqStats = calculateSkewness(logFrequency);

  const monStats = calculateSkewness(rawMonetary);
  const logMonStats = calculateSkewness(logMonetary);

  const iptStats = calculateSkewness(rawIPT);
  const logIptStats = calculateSkewness(logIPT);

  const basketStats = calculateSkewness(rawBasket);
  const logBasketStats = calculateSkewness(logBasket);

  const stats: PreprocessingStats[] = [
    {
      feature: 'recency',
      label: 'Recency (R)',
      rawMean: recStats.mean,
      rawStd: recStats.std,
      rawSkewness: recStats.skewness,
      logMean: logRecStats.mean,
      logStd: logRecStats.std,
      logSkewness: logRecStats.skewness,
    },
    {
      feature: 'frequency',
      label: 'Frequency (F)',
      rawMean: freqStats.mean,
      rawStd: freqStats.std,
      rawSkewness: freqStats.skewness,
      logMean: logFreqStats.mean,
      logStd: logFreqStats.std,
      logSkewness: logFreqStats.skewness,
    },
    {
      feature: 'monetary',
      label: 'Monetary (M)',
      rawMean: monStats.mean,
      rawStd: monStats.std,
      rawSkewness: monStats.skewness,
      logMean: logMonStats.mean,
      logStd: logMonStats.std,
      logSkewness: logMonStats.skewness,
    },
    {
      feature: 'interPurchaseTime',
      label: 'Inter-Purchase Time (T)',
      rawMean: iptStats.mean,
      rawStd: iptStats.std,
      rawSkewness: iptStats.skewness,
      logMean: logIptStats.mean,
      logStd: logIptStats.std,
      logSkewness: logIptStats.skewness,
    },
    {
      feature: 'basketDepth',
      label: 'Basket Depth (D)',
      rawMean: basketStats.mean,
      rawStd: basketStats.std,
      rawSkewness: basketStats.skewness,
      logMean: logBasketStats.mean,
      logStd: logBasketStats.std,
      logSkewness: logBasketStats.skewness,
    },
  ];

  const means = [
    logRecStats.mean,
    logFreqStats.mean,
    logMonStats.mean,
    logIptStats.mean,
    logBasketStats.mean,
  ];

  const stds = [
    logRecStats.std || 1,
    logFreqStats.std || 1,
    logMonStats.std || 1,
    logIptStats.std || 1,
    logBasketStats.std || 1,
  ];

  const featuresStandardized: number[][] = [];
  for (let i = 0; i < n; i++) {
    featuresStandardized.push([
      (logRecency[i] - means[0]) / stds[0],
      (logFrequency[i] - means[1]) / stds[1],
      (logMonetary[i] - means[2]) / stds[2],
      (logIPT[i] - means[3]) / stds[3],
      (logBasket[i] - means[4]) / stds[4],
    ]);
  }

  return {
    featuresStandardized,
    scaler: { means, stds },
    stats,
  };
}

/**
 * Transforms a single customer's raw 5D values using fitted scaler
 */
export function transformSingle(
  r: number,
  f: number,
  m: number,
  t: number,
  d: number,
  scaler: ScalerParams
): number[] {
  const logValues = [
    Math.log1p(Math.max(0, r)),
    Math.log1p(Math.max(0, f)),
    Math.log1p(Math.max(0, m)),
    Math.log1p(Math.max(0, t)),
    Math.log1p(Math.max(0, d)),
  ];

  return logValues.map((v, i) => (v - scaler.means[i]) / scaler.stds[i]);
}

/**
 * 2D Principal Component Analysis (PCA) on standardized 5D data
 */
export function computePCA(data: number[][]): {
  projections: { pc1: number; pc2: number }[];
  explainedVarianceRatio: [number, number];
  components: number[][]; // 2 x 5 principal eigenvectors
} {
  const n = data.length;
  if (n < 2) {
    return {
      projections: data.map(() => ({ pc1: 0, pc2: 0 })),
      explainedVarianceRatio: [0.5, 0.3],
      components: [
        [0.44, 0.44, 0.44, 0.44, 0.44],
        [-0.44, 0.44, 0.44, -0.44, 0.44],
      ],
    };
  }

  const d = data[0].length; // 5 features

  // 1. Covariance matrix (data is already zero-mean standardized)
  const cov: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
  for (let i = 0; i < n; i++) {
    const row = data[i];
    for (let j = 0; j < d; j++) {
      for (let k = 0; k < d; k++) {
        cov[j][k] += row[j] * row[k];
      }
    }
  }
  for (let j = 0; j < d; j++) {
    for (let k = 0; k < d; k++) {
      cov[j][k] /= n - 1;
    }
  }

  // 2. Power iteration for 1st eigenvector
  function powerIteration(matrix: number[][], maxIter = 100): number[] {
    let v = Array.from({ length: d }, (_, i) => Math.sin(i + 1) + 0.1);
    // normalize
    let norm = Math.hypot(...v);
    v = v.map((x) => x / norm);

    for (let iter = 0; iter < maxIter; iter++) {
      const nextV = Array(d).fill(0);
      for (let r = 0; r < d; r++) {
        for (let c = 0; c < d; c++) {
          nextV[r] += matrix[r][c] * v[c];
        }
      }
      norm = Math.hypot(...nextV);
      if (norm < 1e-9) break;
      v = nextV.map((x) => x / norm);
    }
    return v;
  }

  const v1 = powerIteration(cov);

  // Eigenvalue 1
  let lambda1 = 0;
  for (let r = 0; r < d; r++) {
    for (let c = 0; c < d; c++) {
      lambda1 += v1[r] * cov[r][c] * v1[c];
    }
  }

  // Deflate matrix for 2nd eigenvector: Cov' = Cov - lambda1 * (v1 * v1^T)
  const covDeflated: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
  for (let r = 0; r < d; r++) {
    for (let c = 0; c < d; c++) {
      covDeflated[r][c] = cov[r][c] - lambda1 * v1[r] * v1[c];
    }
  }

  const v2 = powerIteration(covDeflated);

  // Eigenvalue 2
  let lambda2 = 0;
  for (let r = 0; r < d; r++) {
    for (let c = 0; c < d; c++) {
      lambda2 += v2[r] * covDeflated[r][c] * v2[c];
    }
  }

  // Total variance is trace of cov
  let totalVar = 0;
  for (let i = 0; i < d; i++) totalVar += cov[i][i];
  if (totalVar <= 0) totalVar = 1;

  const ev1 = Math.min(1, Math.max(0.1, lambda1 / totalVar));
  const ev2 = Math.min(1 - ev1, Math.max(0.05, lambda2 / totalVar));

  // Project data
  const projections = data.map((row) => {
    let pc1 = 0;
    let pc2 = 0;
    for (let j = 0; j < d; j++) {
      pc1 += row[j] * v1[j];
      pc2 += row[j] * v2[j];
    }
    return {
      pc1: Math.round(pc1 * 1000) / 1000,
      pc2: Math.round(pc2 * 1000) / 1000,
    };
  });

  return {
    projections,
    explainedVarianceRatio: [Math.round(ev1 * 100) / 100, Math.round(ev2 * 100) / 100],
    components: [v1, v2],
  };
}
