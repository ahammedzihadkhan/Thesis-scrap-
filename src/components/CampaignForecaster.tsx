import React, { useState, useMemo, useEffect } from 'react';
import { CustomerRFMTD, PersonaType } from '../rfm/types';
import { PERSONA_METAS } from '../rfm/mlClustering';
import {
  calculateCampaignForecast,
  generateAllSegmentScenarios,
} from '../rfm/campaignForecaster';
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Percent,
  Sparkles,
  ArrowRight,
  RefreshCw,
  PhoneCall,
  CheckCircle2,
  Coins,
} from 'lucide-react';

interface CampaignForecasterProps {
  customers: CustomerRFMTD[];
  currencySymbol: string;
  onApplySegmentFilter?: (persona: PersonaType | 'All') => void;
  selectedSegmentFilter?: PersonaType | 'All';
}

export const CampaignForecaster: React.FC<CampaignForecasterProps> = ({
  customers,
  currencySymbol,
  onApplySegmentFilter,
  selectedSegmentFilter = 'All',
}) => {
  // State for forecaster
  const [selectedSegment, setSelectedSegment] = useState<PersonaType | 'All'>(
    selectedSegmentFilter
  );
  const [conversionRatePct, setConversionRatePct] = useState<number>(12);
  const [customAOV, setCustomAOV] = useState<number | null>(null);
  const [costPerMessage, setCostPerMessage] = useState<number>(0.65); // standard BD WhatsApp rate ~0.65 BDT
  const [showAdvancedCost, setShowAdvancedCost] = useState(false);

  // Sync external filter if changed
  useEffect(() => {
    if (selectedSegmentFilter) {
      setSelectedSegment(selectedSegmentFilter);
    }
  }, [selectedSegmentFilter]);

  // Compute segment historical AOV
  const segmentHistoricalAOV = useMemo(() => {
    const subset = customers.filter(
      (c) => selectedSegment === 'All' || c.persona === selectedSegment
    );
    let totalSpend = 0;
    let totalOrders = 0;
    for (const c of subset) {
      totalSpend += c.monetary;
      totalOrders += c.frequency;
    }
    return totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 2500;
  }, [customers, selectedSegment]);

  // Active AOV used in forecast
  const activeAOV = customAOV !== null ? customAOV : segmentHistoricalAOV;

  // Forecast calculation
  const forecast = useMemo(() => {
    return calculateCampaignForecast(customers, {
      targetSegment: selectedSegment,
      conversionRatePct,
      predictedAOV: activeAOV,
      costPerMessage,
    });
  }, [customers, selectedSegment, conversionRatePct, activeAOV, costPerMessage]);

  // Multi-segment benchmark scenarios
  const scenarios = useMemo(() => {
    return generateAllSegmentScenarios(customers);
  }, [customers]);

  // Handlers
  const handleSelectSegment = (seg: PersonaType | 'All') => {
    setSelectedSegment(seg);
    setCustomAOV(null); // reset custom AOV to segment historical
    if (seg !== 'All') {
      const benchmark = scenarios.find((s) => s.persona === seg);
      if (benchmark) {
        setConversionRatePct(benchmark.defaultConversionPct);
      }
    } else {
      setConversionRatePct(12);
    }
  };

  const handleApplyToQueue = (seg: PersonaType | 'All') => {
    if (onApplySegmentFilter) {
      onApplySegmentFilter(seg);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-xs">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              WhatsApp Campaign Revenue Forecaster
            </h3>
            <p className="text-xs text-slate-500">
              Forecast conversion rate, average order value (AOV), and projected revenue return before dispatching.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            ROI Forecaster
          </span>
        </div>
      </div>

      {/* Main Grid: Inputs on Left, Output Cards on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-4 bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
            <Target className="w-3.5 h-3.5 text-emerald-700" />
            <span>Campaign Parameters</span>
          </div>

          {/* 1. Target Segment Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Target Customer Segment
            </label>
            <select
              value={selectedSegment}
              onChange={(e) => handleSelectSegment(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="All">All Segments Combined ({customers.length} buyers)</option>
              {Object.keys(PERSONA_METAS).map((k) => {
                const count = customers.filter((c) => c.persona === k).length;
                return (
                  <option key={k} value={k}>
                    {k} ({count} buyers)
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Predicted Conversion Rate Slider & Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Percent className="w-3 h-3 text-emerald-600" />
                Predicted Conversion Rate
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.5"
                  value={conversionRatePct}
                  onChange={(e) => setConversionRatePct(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-16 px-2 py-0.5 bg-white border border-slate-200 rounded font-bold text-xs text-right text-emerald-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-xs font-semibold text-slate-500">%</span>
              </div>
            </div>

            <input
              type="range"
              min="0.5"
              max="40"
              step="0.5"
              value={conversionRatePct}
              onChange={(e) => setConversionRatePct(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />

            {/* Quick preset chips */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-slate-400 font-medium">Presets:</span>
              {[
                { label: '5% Win-Back', val: 5 },
                { label: '10% Comeback', val: 10 },
                { label: '15% Regular', val: 15 },
                { label: '25% VIP Club', val: 25 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setConversionRatePct(p.val)}
                  className={`text-[10px] px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    conversionRatePct === p.val
                      ? 'bg-emerald-700 text-white font-semibold shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Predicted Average Order Value (AOV) Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-600" />
                Predicted Average Order Value (AOV)
              </label>
              <button
                type="button"
                onClick={() => setCustomAOV(null)}
                className="text-[10px] text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer flex items-center gap-1"
                title="Reset to historical segment baseline"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                Reset: {currencySymbol}{segmentHistoricalAOV.toLocaleString()}
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-semibold text-slate-400">
                {currencySymbol}
              </span>
              <input
                type="number"
                min="0"
                step="50"
                value={activeAOV}
                onChange={(e) => setCustomAOV(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                placeholder="2500"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Historical segment spend: <strong>{currencySymbol}{segmentHistoricalAOV.toLocaleString()}</strong> per order
            </p>
          </div>

          {/* Optional: WhatsApp Cost per Message */}
          <div className="pt-2 border-t border-slate-200/60">
            <button
              type="button"
              onClick={() => setShowAdvancedCost(!showAdvancedCost)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center justify-between w-full cursor-pointer"
            >
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3 text-slate-400" />
                Messaging Cost Config (Optional)
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">
                {showAdvancedCost ? 'Hide' : `${currencySymbol}${costPerMessage}/msg`}
              </span>
            </button>

            {showAdvancedCost && (
              <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Cost per message:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs">{currencySymbol}</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      value={costPerMessage}
                      onChange={(e) => setCostPerMessage(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-16 px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold text-right"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Standard Meta WhatsApp Business API conversation rate for Bangladesh marketing messages is approx. Tk 0.65.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Revenue Impact Display Cards (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Metric 1: Segment Reach */}
            <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-3.5">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-medium text-[11px]">Audience Reach</span>
                <Users className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">
                  {forecast.phoneReadyCount}
                </span>
                <span className="text-[11px] text-slate-400">
                  / {forecast.audienceSize}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-emerald-700 font-medium">
                {forecast.audienceSize > 0
                  ? `${Math.round((forecast.phoneReadyCount / forecast.audienceSize) * 100)}% WhatsApp Ready`
                  : 'No audience'}
              </div>
            </div>

            {/* Metric 2: Projected Orders */}
            <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-3.5">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-medium text-[11px]">Projected Orders</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="mt-1">
                <span className="text-xl font-bold text-slate-900">
                  {forecast.projectedOrders}
                </span>
                <span className="text-[11px] text-slate-500 ml-1">orders</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                At {conversionRatePct}% conversion
              </p>
            </div>

            {/* Metric 3: Return on Spend (ROAS) */}
            <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-3.5">
              <div className="flex items-center justify-between text-slate-500 text-xs">
                <span className="font-medium text-[11px]">Projected ROAS</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="mt-1">
                <span className="text-xl font-bold text-emerald-700">
                  {forecast.roas > 0 ? `${forecast.roas}x` : '—'}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400">
                Revenue / message cost
              </p>
            </div>
          </div>

          {/* Big Highlight Card: Projected Gross Revenue & Net Gain */}
          <div className="bg-slate-900 rounded-xl p-5 text-white shadow-sm border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                  Forecasted Gross Revenue Impact
                </span>
                <div className="text-3xl font-black tracking-tight mt-0.5 text-white">
                  {currencySymbol}{forecast.grossRevenue.toLocaleString()}
                </div>
                <div className="mt-1.5 text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                  <span>
                    Est. Cost: <strong className="text-white">{currencySymbol}{forecast.totalMessagingCost.toFixed(1)}</strong>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span>
                    Net Gain: <strong className="text-emerald-300">{currencySymbol}{forecast.netRevenueGain.toLocaleString()}</strong>
                  </span>
                </div>
              </div>

              {/* Action Button: Filter Queue to Segment */}
              {selectedSegment !== 'All' && onApplySegmentFilter && (
                <button
                  type="button"
                  onClick={() => handleApplyToQueue(selectedSegment)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
                >
                  <span>Filter Queue to Segment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Segment Comparison Matrix */}
          <div className="bg-slate-50/60 rounded-xl border border-slate-200/80 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                Segment Potential Matrix
              </span>
              <span className="text-[10px] text-slate-400">
                Click a segment to simulate
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {scenarios.map((scen) => {
                const meta = PERSONA_METAS[scen.persona];
                const isCurrent = selectedSegment === scen.persona;
                return (
                  <button
                    key={scen.persona}
                    type="button"
                    onClick={() => handleSelectSegment(scen.persona)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isCurrent
                        ? 'border-emerald-600 bg-white ring-1 ring-emerald-600 shadow-2xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="font-semibold text-slate-900 truncate text-[11px]">
                          {meta.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {scen.audienceSize} buyers · {scen.defaultConversionPct}% conv
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-900 text-xs">
                        {currencySymbol}{scen.projectedRevenue.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-700 font-medium">
                        ~{scen.projectedOrders} orders
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
