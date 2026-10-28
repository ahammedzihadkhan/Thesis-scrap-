import React, { useState } from 'react';
import { CustomerRFMTD, ClusterCentroid, PersonaType } from '../rfm/types';
import { PERSONA_METAS } from '../rfm/mlClustering';
import { ScatterPlot3D } from './ScatterPlot3D';
import {
  Crown,
  UserCheck,
  AlertTriangle,
  Moon,
  TrendingUp,
  BarChart2,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';

interface Tab2SegmentsExplorerProps {
  customers: CustomerRFMTD[];
  centroids: ClusterCentroid[];
  pcaProjections: { pc1: number; pc2: number }[];
  pcaVariance: [number, number];
  currencySymbol: string;
}

export const Tab2SegmentsExplorer: React.FC<Tab2SegmentsExplorerProps> = ({
  customers,
  centroids,
  pcaProjections,
  pcaVariance,
  currencySymbol,
}) => {
  const [selectedPersona, setSelectedPersona] = useState<PersonaType | 'All'>('All');
  const [activeView, setActiveView] = useState<'3d' | 'pca'>('3d');

  const filteredCustomers = React.useMemo(() => {
    if (selectedPersona === 'All') return customers;
    return customers.filter((c) => c.persona === selectedPersona);
  }, [customers, selectedPersona]);

  const personaIcons: Record<PersonaType, React.ReactNode> = {
    'Champions (VIP Loyalists)': <Crown className="w-5 h-5 text-emerald-600" />,
    'Loyal & Promising Regulars': <UserCheck className="w-5 h-5 text-blue-600" />,
    'High-Potential / At-Risk Guests': <AlertTriangle className="w-5 h-5 text-amber-600" />,
    'Hibernating / Lost Guests': <Moon className="w-5 h-5 text-rose-600" />,
  };

  // Find min/max for PCA plot bounds
  const pcaBounds = React.useMemo(() => {
    let minX = -3, maxX = 3, minY = -3, maxY = 3;
    for (const p of pcaProjections) {
      if (p.pc1 < minX) minX = p.pc1;
      if (p.pc1 > maxX) maxX = p.pc1;
      if (p.pc2 < minY) minY = p.pc2;
      if (p.pc2 > maxY) maxY = p.pc2;
    }
    return { minX, maxX, minY, maxY };
  }, [pcaProjections]);

  return (
    <div className="space-y-6">
      {/* 4 Segment Persona Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {centroids.map((c) => {
          const meta = PERSONA_METAS[c.persona];
          const isSelected = selectedPersona === c.persona;

          return (
            <div
              key={c.persona}
              onClick={() => setSelectedPersona(isSelected ? 'All' : c.persona)}
              className={`rounded-xl border p-4.5 cursor-pointer transition-all duration-200 shadow-xs ${
                isSelected
                  ? 'ring-2 ring-emerald-500 shadow-md bg-white'
                  : 'bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
              style={{ borderLeftWidth: '5px', borderLeftColor: meta.color }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {meta.title}
                </span>
                {personaIcons[c.persona]}
              </div>

              <div className="flex items-baseline justify-between mt-1">
                <div>
                  <span className="text-2xl font-black text-slate-900">{c.customerCount}</span>
                  <span className="text-xs text-slate-500 ml-1">({c.customerSharePct}%)</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">
                    {currencySymbol}{c.totalRevenue.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500 block">({c.revenueSharePct}% rev)</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{meta.description}</p>

              <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1 text-[10px] text-slate-600">
                <div>
                  <span className="text-slate-400 block">Avg R</span>
                  <strong className="text-slate-800">{c.recencyMean} d</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Avg F</span>
                  <strong className="text-slate-800">{c.frequencyMean} ord</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Avg M</span>
                  <strong className="text-slate-800">{currencySymbol}{c.monetaryMean.toFixed(0)}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Exploration Space: 3D vs 2D PCA Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Interactive Spatial Cluster Visualization</h3>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                {selectedPersona === 'All' ? 'Showing All Personas' : `Filtering: ${selectedPersona}`}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Explore customer separation across Recency, Frequency, Monetary and Basket dimensions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView('3d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === '3d'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>3D Extended Space</span>
            </button>

            <button
              onClick={() => setActiveView('pca')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeView === 'pca'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>2D PCA Projection</span>
            </button>
          </div>
        </div>

        {activeView === '3d' ? (
          <ScatterPlot3D customers={filteredCustomers} currencySymbol={currencySymbol} />
        ) : (
          <div className="relative w-full h-[460px] bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span className="font-semibold text-slate-700">
                Principal Component Analysis: PC1 ({(pcaVariance[0] * 100).toFixed(0)}% var) vs PC2 ({(pcaVariance[1] * 100).toFixed(0)}% var)
              </span>
              <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                Total 2D Explained Variance: {((pcaVariance[0] + pcaVariance[1]) * 100).toFixed(0)}%
              </span>
            </div>

            {/* SVG PCA Scatter */}
            <div className="relative flex-1 w-full flex items-center justify-center my-2">
              <svg className="w-full h-full max-w-[650px] max-h-[380px]" viewBox="0 0 600 340">
                {/* Axes */}
                <line x1="40" y1="170" x2="560" y2="170" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
                <line x1="300" y1="20" x2="300" y2="320" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />

                <text x="540" y="165" fontSize="10" fill="#94a3b8" textAnchor="end">PC1 →</text>
                <text x="305" y="30" fontSize="10" fill="#94a3b8">↑ PC2</text>

                {/* Points */}
                {customers.map((c, i) => {
                  const p = pcaProjections[i] || { pc1: 0, pc2: 0 };
                  const rangeX = pcaBounds.maxX - pcaBounds.minX || 1;
                  const rangeY = pcaBounds.maxY - pcaBounds.minY || 1;
                  const sx = 50 + ((p.pc1 - pcaBounds.minX) / rangeX) * 500;
                  const sy = 310 - ((p.pc2 - pcaBounds.minY) / rangeY) * 280;

                  const meta = c.persona ? PERSONA_METAS[c.persona] : null;
                  const color = meta ? meta.color : '#3b82f6';
                  const isMatch = selectedPersona === 'All' || selectedPersona === c.persona;

                  return (
                    <circle
                      key={c.customerKey}
                      cx={sx}
                      cy={sy}
                      r={isMatch ? 4.5 : 2}
                      fill={color}
                      opacity={isMatch ? 0.85 : 0.2}
                      stroke="#ffffff"
                      strokeWidth="0.8"
                    >
                      <title>{`${c.customerKey} (${c.persona})\nR: ${c.recency}d, F: ${c.frequency}, M: ${currencySymbol}${c.monetary}`}</title>
                    </circle>
                  );
                })}
              </svg>
            </div>

            {/* PCA Legend */}
            <div className="flex flex-wrap gap-3 justify-center text-xs pt-1 border-t border-slate-200">
              {Object.values(PERSONA_METAS).map((meta) => (
                <div key={meta.type} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="text-[11px] font-medium text-slate-700">{meta.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row: Customer Share vs Revenue Share Pareto + Standardized Z-Score Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Share vs Revenue Share Pareto Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Customer Share vs. Revenue Share (Pareto Inequality)
            </h3>
            <p className="text-xs text-slate-500">
              Demonstrates why Champions and Loyal Regulars must be protected
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {centroids.map((c) => {
              const meta = PERSONA_METAS[c.persona];
              return (
                <div key={c.persona} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                      {meta.title}
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      {c.customerCount} cust ({c.customerSharePct}%) ➔ {currencySymbol}{c.totalRevenue.toLocaleString()} ({c.revenueSharePct}%)
                    </span>
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-slate-400">Cust Share</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-slate-400 h-2 rounded-full"
                          style={{ width: `${c.customerSharePct}%` }}
                        />
                      </div>
                      <span className="w-10 text-right font-medium text-slate-600">{c.customerSharePct}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-16 text-emerald-600 font-semibold">Rev Share</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${c.revenueSharePct}%`,
                            backgroundColor: meta.color,
                          }}
                        />
                      </div>
                      <span className="w-10 text-right font-bold text-slate-900">{c.revenueSharePct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Standardized Z-Score Segment Profile Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Standardized Z-Score Segment Profiles (μ = 0, σ = 1)</h3>
            <p className="text-xs text-slate-500">
              Normalized deviations on Recency, Frequency, Monetary, IPT, and Basket Depth
            </p>
          </div>

          <div className="space-y-3 pt-2 text-xs">
            {centroids.map((c) => {
              const meta = PERSONA_METAS[c.persona];
              const z = c.zScores;
              const features = [
                { name: 'R (Recency)', val: z.recency },
                { name: 'F (Frequency)', val: z.frequency },
                { name: 'M (Monetary)', val: z.monetary },
                { name: 'T (IPT)', val: z.interPurchaseTime },
                { name: 'D (Basket)', val: z.basketDepth },
              ];

              return (
                <div key={c.persona} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                  <div className="font-semibold text-slate-800 text-[11px] mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                      {meta.title}
                    </span>
                    <span className="text-[10px] text-slate-400">Mean z-score vector</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                    {features.map((f) => {
                      const isPositive = f.val >= 0;
                      return (
                        <div key={f.name} className="bg-white rounded p-1 border border-slate-200">
                          <span className="block text-slate-400 font-mono text-[9px]">{f.name.split(' ')[0]}</span>
                          <span
                            className={`font-mono font-bold ${
                              isPositive ? 'text-emerald-700' : 'text-slate-600'
                            }`}
                          >
                            {isPositive ? `+${f.val.toFixed(2)}` : f.val.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Centroid Summary Tables: Mean & Median RFM+T+D */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Cluster Centroid Behavioral Summary Table</h3>
            <p className="text-xs text-slate-500">Un-normalized real store metrics (Mean & Median values)</p>
          </div>
          <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
            5D RFM Engine
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Segment Persona</th>
                <th className="py-2.5 px-4 text-right">Customers</th>
                <th className="py-2.5 px-4 text-right">Revenue</th>
                <th className="py-2.5 px-4 text-right">Recency (R)</th>
                <th className="py-2.5 px-4 text-right">Frequency (F)</th>
                <th className="py-2.5 px-4 text-right">Monetary (M)</th>
                <th className="py-2.5 px-4 text-right">IPT (T)</th>
                <th className="py-2.5 px-4 text-right">Basket Depth (D)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {centroids.map((c) => {
                const meta = PERSONA_METAS[c.persona];
                return (
                  <tr key={c.persona} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                      <span>{meta.title}</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-slate-800">
                      {c.customerCount} ({c.customerSharePct}%)
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                      {currencySymbol}{c.totalRevenue.toLocaleString()} ({c.revenueSharePct}%)
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700">
                      <strong>{c.recencyMean} d</strong> <span className="text-slate-400">({c.recencyMedian}d med)</span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700">
                      <strong>{c.frequencyMean}</strong> <span className="text-slate-400">({c.frequencyMedian} med)</span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700 font-semibold">
                      {currencySymbol}{c.monetaryMean.toFixed(0)} <span className="text-slate-400 font-normal">({currencySymbol}{c.monetaryMedian.toFixed(0)})</span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700">
                      {c.iptMean} d
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-700">
                      {c.basketDepthMean} SKUs
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
