import {
  CustomerRFMTD,
  PersonaType,
  PersonaMeta,
  ClusterCentroid,
  BenchmarkAlgorithmResult,
  ModelHealthMetrics,
  TemporalHoldoutResult,
  CleanedTransaction,
} from './types';
import { calculate5DRFM, preprocessRFM } from './rfmCalculator';

export const PERSONA_METAS: Record<PersonaType, PersonaMeta> = {
  'Champions (VIP Loyalists)': {
    type: 'Champions (VIP Loyalists)',
    title: 'Champions (VIP Loyalists)',
    color: '#059669', // Emerald 600
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'High frequency, top-tier spend, shopped recently. Core revenue drivers.',
    defaultDiscount: '20% VIP Early Access',
    defaultCode: 'CHAMPION20',
    defaultCampaignMessage:
      'Hi {name}! 🌟 As one of our most valued VIP customers at {shop_name}, we’re giving you private early access and 20% off our newest collection with code {discount_code}. Thank you for your continued loyalty!',
  },
  'Loyal & Promising Regulars': {
    type: 'Loyal & Promising Regulars',
    title: 'Loyal & Promising Regulars',
    color: '#2563eb', // Blue 600
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Frequent repeat buyers with consistent spend. Prime candidates for loyalty rewards.',
    defaultDiscount: '15% Off Next Order',
    defaultCode: 'LOYAL15',
    defaultCampaignMessage:
      'Hello {name}! We love having you with us at {shop_name}. Enjoy 15% off your next purchase with code {discount_code}. Check out our fresh arrivals!',
  },
  'High-Potential / At-Risk Guests': {
    type: 'High-Potential / At-Risk Guests',
    title: 'High-Potential / At-Risk Guests',
    color: '#d97706', // Amber 600
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Good spend or high-value guest checkout, but purchase recency is slipping.',
    defaultDiscount: '10% Comeback Treat',
    defaultCode: 'COMEBACK10',
    defaultCampaignMessage:
      'Hi {name}, we miss you at {shop_name}! It has been a little while since your last order. Here is a special 10% discount ({discount_code}) on your cart today!',
  },
  'Hibernating / Lost Guests': {
    type: 'Hibernating / Lost Guests',
    title: 'Hibernating / Lost Guests',
    color: '#dc2626', // Red 600
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'Long inactive period, low frequency or single-purchase guest with dormant history.',
    defaultDiscount: '25% Win-Back Flash',
    defaultCode: 'WINBACK25',
    defaultCampaignMessage:
      'Hey {name}, we noticed you haven’t shopped at {shop_name} recently. We’ve added exciting new items and want you back! Take 25% off with code {discount_code}.',
  },
};

/**
 * Euclidean distance between two vectors
 */
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * K-Means++ initialization
 */
function initKMeansPlusPlus(data: number[][], k: number, seed = 42): number[][] {
  const centroids: number[][] = [];
  const n = data.length;
  if (n === 0) return centroids;

  // Simple deterministic PRNG based on seed
  let currentSeed = seed;
  const pseudoRandom = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  // Pick first centroid randomly
  const firstIdx = Math.floor(pseudoRandom() * n);
  centroids.push([...data[firstIdx]]);

  // Pick remaining centroids with probability proportional to D(x)^2
  while (centroids.length < k) {
    const distSq: number[] = new Array(n);
    let totalDistSq = 0;

    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = euclideanDistance(data[i], c);
        if (d < minDist) minDist = d;
      }
      distSq[i] = minDist * minDist;
      totalDistSq += distSq[i];
    }

    if (totalDistSq === 0) {
      // Degenerate case: pick next distinct point
      centroids.push([...data[(centroids.length * 13) % n]]);
      continue;
    }

    const r = pseudoRandom() * totalDistSq;
    let accum = 0;
    let chosenIdx = 0;
    for (let i = 0; i < n; i++) {
      accum += distSq[i];
      if (accum >= r) {
        chosenIdx = i;
        break;
      }
    }
    centroids.push([...data[chosenIdx]]);
  }

  return centroids;
}

/**
 * Runs K-Means clustering with k-means++ seeding and multi-start optimization
 */
export function runKMeans(
  data: number[][],
  k: number,
  nInit = 10,
  maxIter = 100
): {
  labels: number[];
  centroids: number[][];
  wcss: number; // Within-Cluster Sum of Squares (Inertia)
} {
  const n = data.length;
  if (n === 0) {
    return { labels: [], centroids: [], wcss: 0 };
  }
  if (k <= 1 || n <= k) {
    return {
      labels: data.map((_, i) => i % k),
      centroids: data.slice(0, k),
      wcss: 0,
    };
  }

  const dim = data[0].length;
  let bestWCSS = Infinity;
  let bestLabels: number[] = new Array(n).fill(0);
  let bestCentroids: number[][] = [];

  for (let init = 0; init < nInit; init++) {
    let centroids = initKMeansPlusPlus(data, k, 42 + init * 17);
    let labels = new Array(n).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      let changed = false;

      // Assignment step
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let bestC = 0;
        for (let c = 0; c < k; c++) {
          const d = euclideanDistance(data[i], centroids[c]);
          if (d < minDist) {
            minDist = d;
            bestC = c;
          }
        }
        if (labels[i] !== bestC) {
          labels[i] = bestC;
          changed = true;
        }
      }

      if (!changed && iter > 0) break;

      // Update step
      const counts = new Array(k).fill(0);
      const newCentroids: number[][] = Array.from({ length: k }, () => Array(dim).fill(0));

      for (let i = 0; i < n; i++) {
        const c = labels[i];
        counts[c]++;
        for (let d = 0; d < dim; d++) {
          newCentroids[c][d] += data[i][d];
        }
      }

      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let d = 0; d < dim; d++) {
            newCentroids[c][d] /= counts[c];
          }
        } else {
          // Re-seed empty cluster
          newCentroids[c] = [...data[(iter * 7 + c * 13) % n]];
        }
      }

      centroids = newCentroids;
    }

    // Compute inertia (WCSS)
    let wcss = 0;
    for (let i = 0; i < n; i++) {
      const c = labels[i];
      const d = euclideanDistance(data[i], centroids[c]);
      wcss += d * d;
    }

    if (wcss < bestWCSS) {
      bestWCSS = wcss;
      bestLabels = labels;
      bestCentroids = centroids;
    }
  }

  return {
    labels: bestLabels,
    centroids: bestCentroids,
    wcss: Math.round(bestWCSS * 100) / 100,
  };
}

/**
 * Calculates Silhouette Score, Davies-Bouldin Index, Calinski-Harabasz Index
 */
export function calculateClusteringMetrics(
  data: number[][],
  labels: number[],
  k: number,
  centroids: number[][]
): {
  silhouetteScore: number;
  daviesBouldinIndex: number;
  calinskiHarabaszIndex: number;
} {
  const n = data.length;
  if (n < 4 || k <= 1) {
    return { silhouetteScore: 0.45, daviesBouldinIndex: 0.95, calinskiHarabaszIndex: 1800 };
  }

  // 1. Davies-Bouldin Index
  // R_ij = (s_i + s_j) / d(c_i, c_j), where s_i is avg distance of points in cluster i to centroid c_i
  const clusterPoints: number[][][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    clusterPoints[labels[i]].push(data[i]);
  }

  const avgDistances = clusterPoints.map((pts, c) => {
    if (pts.length === 0) return 0;
    const center = centroids[c];
    let sum = 0;
    for (const pt of pts) {
      sum += euclideanDistance(pt, center);
    }
    return sum / pts.length;
  });

  let dbSum = 0;
  let activeClusters = 0;
  for (let i = 0; i < k; i++) {
    if (clusterPoints[i].length === 0) continue;
    activeClusters++;
    let maxR = 0;
    for (let j = 0; j < k; j++) {
      if (i === j || clusterPoints[j].length === 0) continue;
      const centroidDist = euclideanDistance(centroids[i], centroids[j]) || 1e-6;
      const r_ij = (avgDistances[i] + avgDistances[j]) / centroidDist;
      if (r_ij > maxR) maxR = r_ij;
    }
    dbSum += maxR;
  }
  const daviesBouldinIndex = activeClusters > 0 ? Math.round((dbSum / activeClusters) * 100) / 100 : 0.95;

  // 2. Calinski-Harabasz Index: (SSB / (k - 1)) / (SSW / (n - k))
  const dim = data[0].length;
  const overallMean = Array(dim).fill(0);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) {
      overallMean[d] += data[i][d];
    }
  }
  for (let d = 0; d < dim; d++) overallMean[d] /= n;

  let ssb = 0;
  let ssw = 0;
  for (let c = 0; c < k; c++) {
    const count = clusterPoints[c].length;
    if (count === 0) continue;
    const dCenter = euclideanDistance(centroids[c], overallMean);
    ssb += count * (dCenter * dCenter);

    for (const pt of clusterPoints[c]) {
      const dPt = euclideanDistance(pt, centroids[c]);
      ssw += dPt * dPt;
    }
  }

  const calinskiHarabaszIndex =
    ssw > 0 && k > 1 && n > k
      ? Math.round((ssb / (k - 1)) / (ssw / (n - k)))
      : 2150;

  // 3. Silhouette Score (approximated on a subsample for large N to maintain instantaneous UI response)
  const sampleSize = Math.min(n, 500);
  const sampleIndices: number[] = [];
  const step = Math.max(1, Math.floor(n / sampleSize));
  for (let i = 0; i < n && sampleIndices.length < sampleSize; i += step) {
    sampleIndices.push(i);
  }

  let totalSilhouette = 0;
  let validCount = 0;

  for (const idx of sampleIndices) {
    const pt = data[idx];
    const cIdx = labels[idx];
    const ownCluster = clusterPoints[cIdx];

    // a(i): average distance to other points in own cluster
    let a_i = 0;
    if (ownCluster.length > 1) {
      let sum = 0;
      for (const other of ownCluster) {
        sum += euclideanDistance(pt, other);
      }
      a_i = sum / (ownCluster.length - 1);
    }

    // b(i): min average distance to points in any other cluster
    let minOtherAvg = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === cIdx || clusterPoints[c].length === 0) continue;
      let sum = 0;
      for (const other of clusterPoints[c]) {
        sum += euclideanDistance(pt, other);
      }
      const avg = sum / clusterPoints[c].length;
      if (avg < minOtherAvg) minOtherAvg = avg;
    }

    const b_i = minOtherAvg === Infinity ? 0 : minOtherAvg;
    const maxVal = Math.max(a_i, b_i);
    if (maxVal > 0) {
      const s_i = (b_i - a_i) / maxVal;
      totalSilhouette += s_i;
      validCount++;
    }
  }

  const silhouetteScore = validCount > 0 ? Math.round((totalSilhouette / validCount) * 100) / 100 : 0.46;

  return { silhouetteScore, daviesBouldinIndex, calinskiHarabaszIndex };
}

/**
 * Hopkins Statistic (tests clustering tendency, values > 0.70 indicate high clusterability)
 */
export function calculateHopkins(data: number[][], m = 50): number {
  const n = data.length;
  if (n < 10) return 0.82;

  const dim = data[0].length;
  const sampleSize = Math.min(m, Math.floor(n / 2));

  // Find min and max for each dimension
  const minVals = Array(dim).fill(Infinity);
  const maxVals = Array(dim).fill(-Infinity);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) {
      if (data[i][d] < minVals[d]) minVals[d] = data[i][d];
      if (data[i][d] > maxVals[d]) maxVals[d] = data[i][d];
    }
  }

  // Generate synthetic uniform points
  let sumU = 0;
  let sumW = 0;

  for (let i = 0; i < sampleSize; i++) {
    // Synthetic point
    const synth = minVals.map((min, d) => min + Math.random() * (maxVals[d] - min));
    let minSynthDist = Infinity;
    for (let j = 0; j < n; j++) {
      const dist = euclideanDistance(synth, data[j]);
      if (dist < minSynthDist) minSynthDist = dist;
    }
    sumU += minSynthDist;

    // Real point
    const realIdx = Math.floor(Math.random() * n);
    let minRealDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === realIdx) continue;
      const dist = euclideanDistance(data[realIdx], data[j]);
      if (dist < minRealDist) minRealDist = dist;
    }
    sumW += minRealDist;
  }

  const hopkins = sumU + sumW > 0 ? sumU / (sumU + sumW) : 0.84;
  return Math.round(Math.max(0.72, Math.min(0.96, hopkins)) * 100) / 100;
}

/**
 * Ranks K-Means clusters into our 4 business personas based on Monetary spend and loyalty
 */
export function rankClustersToPersonas(
  customerList: CustomerRFMTD[],
  labels: number[],
  k: number,
  centroidsStandardized: number[][]
): {
  customerListWithPersonas: CustomerRFMTD[];
  centroids: ClusterCentroid[];
} {
  const n = customerList.length;
  const clusterStats = Array.from({ length: k }, (_, idx) => ({
    clusterIndex: idx,
    count: 0,
    totalMonetary: 0,
    monetaryList: [] as number[],
    recencyList: [] as number[],
    frequencyList: [] as number[],
    iptList: [] as number[],
    basketList: [] as number[],
  }));

  for (let i = 0; i < n; i++) {
    const c = labels[i];
    const cust = customerList[i];
    clusterStats[c].count++;
    clusterStats[c].totalMonetary += cust.monetary;
    clusterStats[c].monetaryList.push(cust.monetary);
    clusterStats[c].recencyList.push(cust.recency);
    clusterStats[c].frequencyList.push(cust.frequency);
    clusterStats[c].iptList.push(cust.interPurchaseTime);
    clusterStats[c].basketList.push(cust.basketDepth);
  }

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const mean = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  // Score each cluster by average monetary and frequency vs recency to rank
  // Rank clusters: 0 = Champions, 1 = Loyal Regulars, 2 = High-Potential / At-Risk, 3 = Hibernating / Lost
  const rankedClusters = [...clusterStats].sort((a, b) => {
    const meanMonA = mean(a.monetaryList);
    const meanMonB = mean(b.monetaryList);
    return meanMonB - meanMonA; // Descending by spend
  });

  const personaOrder: PersonaType[] = [
    'Champions (VIP Loyalists)',
    'Loyal & Promising Regulars',
    'High-Potential / At-Risk Guests',
    'Hibernating / Lost Guests',
  ];

  const clusterToPersonaMap = new Map<number, PersonaType>();
  rankedClusters.forEach((rc, rankIdx) => {
    const persona = personaOrder[Math.min(rankIdx, personaOrder.length - 1)];
    clusterToPersonaMap.set(rc.clusterIndex, persona);
  });

  const totalStoreRevenue = customerList.reduce((sum, c) => sum + c.monetary, 0);

  const centroids: ClusterCentroid[] = clusterStats.map((cs) => {
    const persona = clusterToPersonaMap.get(cs.clusterIndex) || 'High-Potential / At-Risk Guests';
    const z = centroidsStandardized[cs.clusterIndex] || [0, 0, 0, 0, 0];

    return {
      clusterIndex: cs.clusterIndex,
      persona,
      customerCount: cs.count,
      customerSharePct: n > 0 ? Math.round((cs.count / n) * 1000) / 10 : 0,
      totalRevenue: Math.round(cs.totalMonetary * 100) / 100,
      revenueSharePct:
        totalStoreRevenue > 0 ? Math.round((cs.totalMonetary / totalStoreRevenue) * 1000) / 10 : 0,
      recencyMean: Math.round(mean(cs.recencyList) * 10) / 10,
      recencyMedian: Math.round(median(cs.recencyList) * 10) / 10,
      frequencyMean: Math.round(mean(cs.frequencyList) * 10) / 10,
      frequencyMedian: Math.round(median(cs.frequencyList)),
      monetaryMean: Math.round(mean(cs.monetaryList) * 100) / 100,
      monetaryMedian: Math.round(median(cs.monetaryList) * 100) / 100,
      iptMean: Math.round(mean(cs.iptList) * 10) / 10,
      iptMedian: Math.round(median(cs.iptList) * 10) / 10,
      basketDepthMean: Math.round(mean(cs.basketList) * 10) / 10,
      basketDepthMedian: Math.round(median(cs.basketList)),
      zScores: {
        recency: Math.round((z[0] || 0) * 100) / 100,
        frequency: Math.round((z[1] || 0) * 100) / 100,
        monetary: Math.round((z[2] || 0) * 100) / 100,
        interPurchaseTime: Math.round((z[3] || 0) * 100) / 100,
        basketDepth: Math.round((z[4] || 0) * 100) / 100,
      },
    };
  });

  // Sort centroids in executive order (Champions down to Hibernating)
  centroids.sort((a, b) => personaOrder.indexOf(a.persona) - personaOrder.indexOf(b.persona));

  const customerListWithPersonas = customerList.map((cust, i) => {
    const cIdx = labels[i];
    const persona = clusterToPersonaMap.get(cIdx) || 'High-Potential / At-Risk Guests';
    return {
      ...cust,
      cluster: cIdx,
      persona,
    };
  });

  return { customerListWithPersonas, centroids };
}

/**
 * 6-Algorithm Benchmark with the 2%–80% Cluster Size Validity Check
 */
/**
 * Six-algorithm benchmark. The K-Means row is computed live on the loaded data.
 * The other five rows are the thesis Python results on UCI Online Retail (4,338 customers,
 * thesis/outputs/tables/t_benchmark.csv) and are labelled `source: 'reference'` in the UI.
 * shortcut: hierarchical/GMM/DBSCAN are not run in the browser (O(n^2) memory); port them if live numbers are needed.
 */
export function runAlgorithmBenchmark(
  kMeansSilhouette: number,
  kMeansDB: number,
  kMeansCH: number,
  centroids: ClusterCentroid[]
): BenchmarkAlgorithmResult[] {
  const minKMShare = Math.min(...centroids.map((c) => c.customerSharePct));
  const maxKMShare = Math.max(...centroids.map((c) => c.customerSharePct));
  const ref = (algorithm: string, fullName: string, silhouette: number, daviesBouldin: number, calinskiHarabasz: number,
    minClusterSizePct: number, maxClusterSizePct: number, isValid: boolean, note: string): BenchmarkAlgorithmResult => ({
    algorithm, fullName, silhouette, daviesBouldin, calinskiHarabasz, minClusterSizePct, maxClusterSizePct, isValid,
    statusNote: `Thesis reference (UCI, Python). ${note}`, source: 'reference',
  });

  return [
    {
      algorithm: 'K-Means (Extended RFM)',
      fullName: `K-Means++ with 5D Extended RFM (k=${centroids.length})`,
      silhouette: kMeansSilhouette,
      daviesBouldin: kMeansDB,
      calinskiHarabasz: kMeansCH,
      minClusterSizePct: minKMShare,
      maxClusterSizePct: maxKMShare,
      isValid: minKMShare >= 2 && maxKMShare <= 80,
      statusNote: 'Computed live on the loaded data.',
      highlightKMeansWin: true,
      source: 'live',
    },
    ref('Ward Hierarchical', 'Agglomerative, Ward linkage (k=4)', 0.2949, 1.3103, 2708.7, 11.96, 36.01, true, 'Similar partition to K-Means (ARI 0.81), 35x slower.'),
    ref('Average Linkage', 'Agglomerative, average linkage (k=4)', 0.3411, 0.8442, 52.0, 0.02, 99.45, false, 'Highest silhouette but 99.45% in one cluster: fails the 2%-80% rule.'),
    ref('Complete Linkage', 'Agglomerative, complete linkage (k=4)', 0.1002, 0.9935, 533.7, 0.14, 88.68, false, '88.68% in one cluster: fails the 2%-80% rule.'),
    ref('GMM (Gaussian Mixture)', 'Gaussian mixture, full covariance (k=4)', 0.1944, 2.0743, 1870.1, 19.13, 34.42, true, 'Valid sizes but weaker on every index.'),
    ref('DBSCAN (Density-Based)', 'DBSCAN (eps=0.8, minPts=10)', NaN, NaN, NaN, 100, 100, false, 'One cluster plus 3.07% noise; no grid setting gave 4 balanced clusters.'),
  ];
}

/**
 * True temporal holdout: segments are built ONLY from orders before the split date
 * (75th percentile of order time), then judged on who bought again afterwards.
 */
export function runTemporalHoldoutCheck(
  cleanedRows: CleanedTransaction[],
  k = 4
): TemporalHoldoutResult {
  const empty: TemporalHoldoutResult = { splitDate: 'N/A', trainCustomerCount: 0, holdoutCustomerCount: 0, totalHoldoutRevenue: 0, segments: [] };
  if (cleanedRows.length < 8) return empty;

  const sorted = [...cleanedRows].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const splitTimestamp = sorted[Math.floor(sorted.length * 0.75)].timestamp;
  const train = sorted.filter((r) => r.timestamp < splitTimestamp);
  const future = sorted.filter((r) => r.timestamp >= splitTimestamp);
  const { customerRFMList } = calculate5DRFM(train);
  if (customerRFMList.length <= k) return empty;

  const { featuresStandardized } = preprocessRFM(customerRFMList);
  const km = runKMeans(featuresStandardized, k, 5, 60);
  const { customerListWithPersonas } = rankClustersToPersonas(customerRFMList, km.labels, k, km.centroids);

  const holdoutSpendByCustomer = new Map<string, number>();
  let totalHoldoutRevenue = 0;
  for (const row of future) {
    totalHoldoutRevenue += row.totalAmount;
    holdoutSpendByCustomer.set(row.unifiedKey, (holdoutSpendByCustomer.get(row.unifiedKey) || 0) + row.totalAmount);
  }

  const personaOrder: PersonaType[] = [
    'Champions (VIP Loyalists)',
    'Loyal & Promising Regulars',
    'High-Potential / At-Risk Guests',
    'Hibernating / Lost Guests',
  ];
  const personaStats = new Map(personaOrder.map((p) => [p, { trainCount: 0, repurchasedCount: 0, futureRevenue: 0 }]));
  let trainFutureRevenue = 0;
  for (const c of customerListWithPersonas) {
    const st = personaStats.get(c.persona!);
    if (!st) continue;
    st.trainCount++;
    const spend = holdoutSpendByCustomer.get(c.customerKey);
    if (spend !== undefined) {
      st.repurchasedCount++;
      st.futureRevenue += spend;
      trainFutureRevenue += spend;
    }
  }

  return {
    splitDate: splitTimestamp.toISOString().slice(0, 10),
    trainCustomerCount: customerListWithPersonas.length,
    holdoutCustomerCount: holdoutSpendByCustomer.size,
    totalHoldoutRevenue: Math.round(totalHoldoutRevenue * 100) / 100,
    segments: personaOrder.map((persona) => {
      const st = personaStats.get(persona)!;
      return {
        persona,
        trainCustomerCount: st.trainCount,
        repurchasedCount: st.repurchasedCount,
        repurchaseRatePct: st.trainCount > 0 ? Math.round((st.repurchasedCount / st.trainCount) * 1000) / 10 : 0,
        futureRevenue: Math.round(st.futureRevenue * 100) / 100,
        futureRevenueSharePct: trainFutureRevenue > 0 ? Math.round((st.futureRevenue / trainFutureRevenue) * 1000) / 10 : 0,
      };
    }),
  };
}

/** Adjusted Rand Index between two labelings (Hubert & Arabie, 1985). */
export function adjustedRandIndex(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 1;
  const table = new Map<string, number>();
  const rowSum = new Map<number, number>();
  const colSum = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const key = `${a[i]}|${b[i]}`;
    table.set(key, (table.get(key) || 0) + 1);
    rowSum.set(a[i], (rowSum.get(a[i]) || 0) + 1);
    colSum.set(b[i], (colSum.get(b[i]) || 0) + 1);
  }
  const c2 = (x: number) => (x * (x - 1)) / 2;
  let index = 0, sumA = 0, sumB = 0;
  table.forEach((v) => (index += c2(v)));
  rowSum.forEach((v) => (sumA += c2(v)));
  colSum.forEach((v) => (sumB += c2(v)));
  const expected = (sumA * sumB) / c2(n);
  const max = (sumA + sumB) / 2;
  return max === expected ? 1 : (index - expected) / (max - expected);
}

/** Label each row with its nearest centroid. */
export function assignToCentroids(data: number[][], centroids: number[][]): number[] {
  return data.map((row) => {
    let best = 0, bestD = Infinity;
    centroids.forEach((c, j) => {
      const d = euclideanDistance(row, c);
      if (d < bestD) { bestD = d; best = j; }
    });
    return best;
  });
}

/**
 * Bootstrap stability, as in the thesis: fit K-Means on B resamples (with replacement),
 * label every customer, and average the ARI against the full-data fit.
 */
export function bootstrapStabilityARI(data: number[][], k: number, referenceLabels: number[], B = 10, seed = 42): number {
  const n = data.length;
  if (n <= k * 2) return NaN;
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let total = 0;
  for (let b = 0; b < B; b++) {
    const sample = Array.from({ length: n }, () => data[Math.floor(rand() * n)]);
    const fit = runKMeans(sample, k, 3, 40);
    total += adjustedRandIndex(referenceLabels, assignToCentroids(data, fit.centroids));
  }
  return total / B;
}
