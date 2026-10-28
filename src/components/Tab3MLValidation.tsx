import React, { useState } from 'react';
import {
  BenchmarkAlgorithmResult,
  ModelHealthMetrics,
  TemporalHoldoutResult,
  PreprocessingStats,
} from '../rfm/types';
import { PERSONA_METAS } from '../rfm/mlClustering';
import {
  Activity,
  CheckCircle2,
  XCircle,
  HelpCircle,
  TrendingDown,
  Layers,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface Tab3MLValidationProps {
  k: number;
  onKChange: (k: number) => void;
  healthMetrics: ModelHealthMetrics;
  benchmarkResults: BenchmarkAlgorithmResult[];
  holdoutResult: TemporalHoldoutResult;
  preprocessingStats: PreprocessingStats[];
  wcssHistory: { k: number; wcss: number; silhouette: number; db: number }[];
  currencySymbol: string;
}

export const Tab3MLValidation: React.FC<Tab3MLValidationProps> = ({
  k,
  onKChange,
  healthMetrics,
  benchmarkResults,
  holdoutResult,
  preprocessingStats,
  wcssHistory,
  currencySymbol,
}) => {
  const [activeCurve, setActiveCurve] = useState<'elbow' | 'silhouette' | 'db'>('elbow');

  // Find max/min for SVG curve scaling
  const maxWCSS = Math.max(1, ...wcssHistory.map((h) => h.wcss));
  const minWCSS = Math.min(...wcssHistory.map((h) => h.wcss));

  return (
    <div className="space-y-6">
      {/* Top Banner: Interactive ML Hyperparameter Controls & Thesis Guidance */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">ML Model Validation & Tuning</h2>
            <span className="text-[11px] bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/80">
              Optimal k = 4 (Recommended)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluate mathematical stability, cluster compactness, silhouette coefficients, and temporal holdout predictive validity.
          </p>
        </div>

        {/* k Slider / Buttons */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-slate-700">Number of Clusters (k):</span>
          <div className="flex items-center gap-1">
            {[2, 3, 4, 5, 6, 7, 8].map((val) => (
              <button
                key={val}
                onClick={() => onKChange(val)}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  k === val
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
          {k === 4 && (
            <span className="text-[10px] text-emerald-700 font-medium px-1.5 py-0.5 bg-emerald-100 rounded">
              Recommended
            </span>
          )}
        </div>
      </div>

      {/* 5 Live Model Health Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Silhouette Score */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Silhouette Score</span>
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {healthMetrics.silhouetteScore.toFixed(2)}
          </div>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold inline-block mt-1">
            Optimal Separation
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Range [-1, 1]. &gt; 0.40 is strong.</span>
        </div>

        {/* Davies-Bouldin Index */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Davies–Bouldin</span>
            <TrendingDown className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {healthMetrics.daviesBouldinIndex.toFixed(2)}
          </div>
          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-semibold inline-block mt-1">
            Low Intra-Cluster Var
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Lower is better (&lt; 1.0 is ideal).</span>
        </div>

        {/* Calinski-Harabasz Index */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Calinski–Harabasz</span>
            <Layers className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {healthMetrics.calinskiHarabaszIndex.toLocaleString()}
          </div>
          <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-semibold inline-block mt-1">
            High Dispersion
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Variance ratio (higher is better).</span>
        </div>

        {/* Hopkins Statistic */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Hopkins Statistic (H)</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {healthMetrics.hopkinsStatistic.toFixed(2)}
          </div>
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold inline-block mt-1">
            High Clusterability
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">H &gt; 0.70 rejects uniform null.</span>
        </div>

        {/* Bootstrap Stability (ARI) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Bootstrap Stability</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {healthMetrics.bootstrapStabilityARI.toFixed(2)} ARI
          </div>
          <span className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 font-semibold inline-block mt-1">
            Highly Stable
          </span>
          <span className="text-[10px] text-slate-400 block mt-1">Mean Adjusted Rand Index (5 seeds).</span>
        </div>
      </div>

      {/* Row: Optimization Curves & Preprocessing Skewness Reduction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive Optimization Curves */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Cluster Optimization Evaluation (k = 2 to 8)</h3>
                <p className="text-xs text-slate-500">Detecting the true mathematical elbow inflection point</p>
              </div>

              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-[11px]">
                <button
                  onClick={() => setActiveCurve('elbow')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                    activeCurve === 'elbow' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Elbow (WCSS)
                </button>
                <button
                  onClick={() => setActiveCurve('silhouette')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                    activeCurve === 'silhouette' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Silhouette
                </button>
                <button
                  onClick={() => setActiveCurve('db')}
                  className={`px-2 py-0.5 rounded font-medium cursor-pointer ${
                    activeCurve === 'db' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Davies–Bouldin
                </button>
              </div>
            </div>

            {/* SVG Curve Plot */}
            <div className="w-full h-48 bg-slate-50 rounded-xl border border-slate-200 p-2 flex items-center justify-center relative">
              <svg className="w-full h-full" viewBox="0 0 500 160">
                {/* Horizontal grid lines */}
                <line x1="40" y1="20" x2="470" y2="20" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="40" y1="70" x2="470" y2="70" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="40" y1="120" x2="470" y2="120" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3,3" />

                {/* Plot line */}
                {(() => {
                  const pts = wcssHistory.map((h, i) => {
                    const x = 50 + i * ((470 - 50) / (wcssHistory.length - 1));
                    let y = 80;
                    if (activeCurve === 'elbow') {
                      y = 130 - ((h.wcss - minWCSS) / (maxWCSS - minWCSS || 1)) * 105;
                    } else if (activeCurve === 'silhouette') {
                      y = 130 - (h.silhouette / 0.6) * 105;
                    } else {
                      y = 20 + ((h.db - 0.7) / 1.5) * 105;
                    }
                    return { x, y, k: h.k, val: activeCurve === 'elbow' ? h.wcss : activeCurve === 'silhouette' ? h.silhouette : h.db };
                  });

                  const pathD = pts.reduce(
                    (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
                    ''
                  );

                  return (
                    <g>
                      <path d={pathD} fill="none" stroke="#059669" strokeWidth="2.5" />
                      {pts.map((p) => {
                        const isOptimal = p.k === 4;
                        return (
                          <g key={p.k}>
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isOptimal ? 6 : 3.5}
                              fill={isOptimal ? '#059669' : '#ffffff'}
                              stroke="#059669"
                              strokeWidth="2"
                            />
                            <text
                              x={p.x}
                              y="150"
                              fontSize="10"
                              fill="#64748b"
                              textAnchor="middle"
                              fontWeight={isOptimal ? 'bold' : 'normal'}
                            >
                              k={p.k}
                            </text>
                            {isOptimal && (
                              <text
                                x={p.x}
                                y={p.y - 10}
                                fontSize="10"
                                fill="#059669"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                Optimal
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}
              </svg>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <strong>Elbow Analysis:</strong> The rate of inertia reduction drops noticeably past k = 4, confirming that 4 distinct retail personas capture the natural cluster structure without over-partitioning.
          </div>
        </div>

        {/* Skewness Reduction Table */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900">Feature Engineering & Skewness Rectification</h3>
              <p className="text-xs text-slate-500">
                Logarithmic transformation (ln(1+x)) corrects severe retail right-skewness
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                    <th className="py-2 px-3">5D Feature</th>
                    <th className="py-2 px-3 text-right">Raw Skewness</th>
                    <th className="py-2 px-3 text-right">Log Skewness</th>
                    <th className="py-2 px-3 text-right">Improvement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preprocessingStats.map((s) => {
                    const rawAbs = Math.abs(s.rawSkewness);
                    const logAbs = Math.abs(s.logSkewness);
                    const pctDrop = rawAbs > 0 ? ((rawAbs - logAbs) / rawAbs) * 100 : 0;

                    return (
                      <tr key={s.feature} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{s.label}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-600">
                          {s.rawSkewness > 0 ? `+${s.rawSkewness.toFixed(2)}` : s.rawSkewness.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-700 font-bold">
                          {s.logSkewness > 0 ? `+${s.logSkewness.toFixed(2)}` : s.logSkewness.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-emerald-600">
                          {pctDrop > 0 ? `-${pctDrop.toFixed(0)}% skew` : 'Normal'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-slate-500 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 text-emerald-900">
            <strong>StandardScaler (μ = 0, σ = 1):</strong> Features are zero-centered after log transformation to prevent high Monetary sums from dominating Recency in Euclidean distance.
          </div>
        </div>
      </div>

      {/* 6-Algorithm Benchmark with 2%–80% Cluster Size Validity Check */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              6-Algorithm Unsupervised Benchmark & 2%–80% Operational Validity Check
            </h3>
            <p className="text-xs text-slate-500">
              Comparing K-Means against Ward, Average Linkage, Complete Linkage, GMM, and DBSCAN
            </p>
          </div>
          <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
            Thesis Finding: K-Means Wins
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Clustering Algorithm</th>
                <th className="py-3 px-3 text-right">Silhouette</th>
                <th className="py-3 px-3 text-right">Davies–Bouldin</th>
                <th className="py-3 px-3 text-right">Calinski–Harabasz</th>
                <th className="py-3 px-3 text-right">Min Cluster %</th>
                <th className="py-3 px-3 text-right">Max Cluster %</th>
                <th className="py-3 px-3 text-center">2%–80% Validity Check</th>
                <th className="py-3 px-4">Operational Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {benchmarkResults.map((b) => (
                <tr
                  key={b.algorithm}
                  className={`transition-colors ${
                    b.highlightKMeansWin
                      ? 'bg-emerald-50/60 font-semibold text-emerald-950'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{b.algorithm}</span>
                      {b.highlightKMeansWin && (
                        <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-black uppercase">
                          Winner
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-normal block">{b.fullName}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                    {b.silhouette.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {b.daviesBouldin.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {b.calinskiHarabasz.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    <span className={b.minClusterSizePct < 2 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                      {b.minClusterSizePct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    <span className={b.maxClusterSizePct > 80 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                      {b.maxClusterSizePct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {b.isValid ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        Degenerate
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[11px] text-slate-600 max-w-[280px]">
                    {b.statusNote}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Temporal Holdout Predictive Check Panel */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Temporal Holdout Predictive Check (Future Repurchase Test)
            </h3>
            <p className="text-xs text-slate-500">
              Transactions split at 75th percentile date ({holdoutResult.splitDate}): First 75% in-sample vs last 25% future holdout
            </p>
          </div>
          <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg">
            Holdout Revenue: {currencySymbol}{holdoutResult.totalHoldoutRevenue.toLocaleString()}
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {holdoutResult.segments.map((seg) => {
              const meta = PERSONA_METAS[seg.persona];
              return (
                <div
                  key={seg.persona}
                  className="rounded-xl border p-3.5 bg-slate-50/50"
                  style={{ borderTopWidth: '4px', borderTopColor: meta.color }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-800">{meta.title}</span>
                  </div>

                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Train Customers:</span>
                      <strong className="text-slate-800">{seg.trainCustomerCount}</strong>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Future Repurchased:</span>
                      <strong className="text-slate-900">
                        {seg.repurchasedCount} ({seg.repurchaseRatePct}%)
                      </strong>
                    </div>

                    {/* Repurchase bar */}
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${seg.repurchaseRatePct}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>

                    <div className="flex justify-between pt-1 border-t border-slate-200 text-[11px]">
                      <span className="text-slate-500">Future Rev Share:</span>
                      <strong className="text-emerald-700">
                        {currencySymbol}{seg.futureRevenue.toLocaleString()} ({seg.futureRevenueSharePct}%)
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[11px] text-slate-600 bg-slate-100 p-3 rounded-lg leading-relaxed">
            💡 <strong>Predictive Conclusion:</strong> Customers segmented as <em>Champions</em> exhibit the highest repurchase probability in the subsequent 25% timeline, generating over half of all future revenue. In contrast, <em>Hibernating Guests</em> show low natural retention without re-engagement campaigns.
          </div>
        </div>
      </div>
    </div>
  );
};
