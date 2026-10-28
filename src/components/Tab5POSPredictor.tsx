import React, { useState, useMemo } from 'react';
import {
  CustomerRFMTD,
  PersonaType,
  ClusterCentroid,
  CleanedTransaction,
} from '../rfm/types';
import { ScalerParams, transformSingle } from '../rfm/rfmCalculator';
import { euclideanDistance, PERSONA_METAS } from '../rfm/mlClustering';
import {
  generateCustomerRecommendation,
  BANGLADESHI_CATALOG,
} from '../rfm/recommendationEngine';
import {
  Zap,
  Search,
  Sliders,
  Sparkles,
  MessageSquare,
  Copy,
  Check,
  TrendingUp,
  Award,
  ArrowRight,
  ShoppingBag,
  Send,
} from 'lucide-react';

interface Tab5POSPredictorProps {
  customers: CustomerRFMTD[];
  scaler: ScalerParams;
  centroids: ClusterCentroid[];

  rawCentroidsStandardized: number[][];
  currencySymbol: string;
  cleanedRows?: CleanedTransaction[];
}

export const Tab5POSPredictor: React.FC<Tab5POSPredictorProps> = ({
  customers,
  scaler,
  centroids,
  rawCentroidsStandardized,
  currencySymbol,
  cleanedRows = [],
}) => {
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);

  // Input states
  const [recency, setRecency] = useState<number>(15);
  const [frequency, setFrequency] = useState<number>(3);
  const [monetary, setMonetary] = useState<number>(450);
  const [ipt, setIpt] = useState<number>(20);
  const [basketDepth, setBasketDepth] = useState<number>(4);
  const [phoneInput, setPhoneInput] = useState<string>('+8801711234567');

  // Handle customer picker selection
  const handleSelectCustomer = (key: string) => {
    setSelectedCustomerKey(key);
    const found = customers.find((c) => c.customerKey === key);
    if (found) {
      setRecency(found.recency);
      setFrequency(found.frequency);
      setMonetary(found.monetary);
      setIpt(found.interPurchaseTime);
      setBasketDepth(found.basketDepth);
      if (found.phone) {
        setPhoneInput(found.phone);
      } else if (found.messengerId) {
        setPhoneInput(found.messengerId);
      } else {
        setPhoneInput(`m.me/${found.customerKey.replace(/^(cust_|fb_|email_|phone_)/, '')}`);
      }
    }
  };

  // Live Prediction Computation via fitted Scaler and Centroids
  const predictionResult = useMemo(() => {
    // 1. Transform raw inputs using fitted scaler: ln(1+x) then (x - mean)/std
    const userVector = transformSingle(recency, frequency, monetary, ipt, basketDepth, scaler);

    // 2. Measure distance to each centroid in centroids array
    let minDistance = Infinity;
    let closestCentroid: ClusterCentroid = centroids[0];
    const distanceList: { centroid: ClusterCentroid; distance: number }[] = [];

    for (let i = 0; i < centroids.length; i++) {
      const c = centroids[i];
      // Get its standardized coordinates
      const cZ = [
        c.zScores.recency,
        c.zScores.frequency,
        c.zScores.monetary,
        c.zScores.interPurchaseTime,
        c.zScores.basketDepth,
      ];
      const dist = euclideanDistance(userVector, cZ);
      distanceList.push({ centroid: c, distance: dist });

      if (dist < minDistance) {
        minDistance = dist;
        closestCentroid = c;
      }
    }

    distanceList.sort((a, b) => a.distance - b.distance);

    // Distance to next tier
    const personaOrder: PersonaType[] = [
      'Hibernating / Lost Guests',
      'High-Potential / At-Risk Guests',
      'Loyal & Promising Regulars',
      'Champions (VIP Loyalists)',
    ];

    const currentRank = personaOrder.indexOf(closestCentroid.persona);
    let nextTierInfo: {
      nextPersona: PersonaType;
      spendGap: number;
      orderGap: number;
    } | null = null;

    if (currentRank < personaOrder.length - 1) {
      const nextPersona = personaOrder[currentRank + 1];
      const nextC = centroids.find((c) => c.persona === nextPersona);
      if (nextC) {
        const spendGap = Math.max(0, Math.round(nextC.monetaryMean - monetary));
        const orderGap = Math.max(0, Math.round(nextC.frequencyMean - frequency));
        nextTierInfo = { nextPersona, spendGap, orderGap };
      }
    }

    return {
      persona: closestCentroid.persona,
      distance: minDistance,
      allDistances: distanceList,
      nextTierInfo,
    };
  }, [recency, frequency, monetary, ipt, basketDepth, scaler, centroids]);

  const assignedMeta = PERSONA_METAS[predictionResult.persona];

  // Generated WhatsApp message
  const personalizedOffer = useMemo(() => {
    return assignedMeta.defaultCampaignMessage
      .replace(/{name}/g, phoneInput || 'Valued Customer')
      .replace(/{shop_name}/g, 'Our Retail Shop')
      .replace(/{discount_code}/g, assignedMeta.defaultCode)
      .replace(/{monetary}/g, `${currencySymbol}${monetary}`)
      .replace(/{recency}/g, String(recency));
  }, [assignedMeta, phoneInput, currencySymbol, monetary, recency]);

  // Dynamic Real-Time Counter Cross-Sell & Upsell Offer
  const companionRecommendation = useMemo(() => {
    const mockCustomer: CustomerRFMTD = {
      customerKey: selectedCustomerKey || 'counter_shopper',
      phone: phoneInput,
      isGuest: !selectedCustomerKey,
      firstPurchaseDate: new Date(),
      lastPurchaseDate: new Date(),
      recency,
      frequency,
      monetary,
      avgOrderValue: monetary / Math.max(1, frequency),
      interPurchaseTime: ipt,
      basketDepth,
      isSinglePurchase: frequency <= 1,
      persona: predictionResult.persona,
    };

    const pastItems = cleanedRows
      ?.filter((r) => r.unifiedKey === selectedCustomerKey)
      .map((r) => r.sku) || [];

    return generateCustomerRecommendation(
      mockCustomer,
      pastItems,
      BANGLADESHI_CATALOG,
      currencySymbol
    ).primaryRecommendation;
  }, [
    selectedCustomerKey,
    phoneInput,
    recency,
    frequency,
    monetary,
    ipt,
    basketDepth,
    predictionResult.persona,
    cleanedRows,
    currencySymbol,
  ]);

  const cleanPhone = phoneInput.replace(/[^\d]/g, '');
  const intlPhone = cleanPhone.length === 11 && cleanPhone.startsWith('01') ? `88${cleanPhone}` : cleanPhone;
  const waUrl = intlPhone && intlPhone.length >= 7 ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(personalizedOffer)}` : '';
  const cleanMessengerHandle = phoneInput.replace(/^https?:\/\/m\.me\//, '').replace(/^m\.me\//, '').replace(/^https?:\/\/www\.facebook\.com\//, '').trim();
  const isMessengerTarget = (!cleanPhone || phoneInput.includes('m.me') || phoneInput.includes('fb')) && cleanMessengerHandle.length > 2;
  const messengerUrl = isMessengerTarget ? `https://m.me/${cleanMessengerHandle}?text=${encodeURIComponent(personalizedOffer)}` : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(personalizedOffer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyPitchScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };


  return (
    <div className="space-y-6">
      {/* Title banner */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Live POS Segment Predictor
          </h2>
          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
            Real-Time Inference
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Look up an existing customer profile or adjust 5D RFM sliders to predict their segment and generate instant personalized WhatsApp offers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Customer Selection & 5D Controls */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          {/* Quick Lookup Dropdown */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Load Profile from Existing Customers</span>
            </label>
            <select
              value={selectedCustomerKey}
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden"
            >
              <option value="">-- Choose or type custom values below --</option>
              {customers.slice(0, 30).map((c) => (
                <option key={c.customerKey} value={c.customerKey}>
                  {c.customerKey} ({c.persona}) — Spend: {currencySymbol}{c.monetary.toFixed(0)}, Orders: {c.frequency}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
            <Sliders className="w-4 h-4 text-emerald-600" />
            <span>Interactive 5D RFM Parameter Sliders</span>
          </div>

          {/* Sliders Grid */}
          <div className="space-y-4 text-xs">
            {/* Recency */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Recency (R): Days Since Last Purchase</span>
                <span className="font-mono text-emerald-700 font-bold">{recency} days</span>
              </div>
              <input
                type="range"
                min="1"
                max="365"
                value={recency}
                onChange={(e) => setRecency(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>1 day (Shopped today)</span>
                <span>365 days (1 year inactive)</span>
              </div>
            </div>

            {/* Frequency */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Frequency (F): Total Orders / Invoices</span>
                <span className="font-mono text-emerald-700 font-bold">{frequency} orders</span>
              </div>
              <input
                type="range"
                min="1"
                max="35"
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>1 (Single-purchase guest)</span>
                <span>35+ orders (Ultra regular)</span>
              </div>
            </div>

            {/* Monetary */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Monetary (M): Cumulative Spend</span>
                <span className="font-mono text-emerald-700 font-bold">
                  {currencySymbol}{monetary.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="10000"
                step="50"
                value={monetary}
                onChange={(e) => setMonetary(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{currencySymbol}10</span>
                <span>{currencySymbol}10,000+</span>
              </div>
            </div>

            {/* Inter-Purchase Time */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Inter-Purchase Time (T): Mean Days Between Visits</span>
                <span className="font-mono text-emerald-700 font-bold">{ipt} days</span>
              </div>
              <input
                type="range"
                min="0"
                max="180"
                value={ipt}
                onChange={(e) => setIpt(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>0 days (Single-day shopper)</span>
                <span>180 days</span>
              </div>
            </div>

            {/* Basket Depth */}
            <div className="space-y-1">
              <div className="flex justify-between font-semibold text-slate-700">
                <span>Basket Depth (D): Distinct SKUs Purchased</span>
                <span className="font-mono text-emerald-700 font-bold">{basketDepth} SKUs</span>
              </div>
              <input
                type="range"
                min="1"
                max="40"
                value={basketDepth}
                onChange={(e) => setBasketDepth(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>1 item</span>
                <span>40 distinct items</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Output: Real-Time Persona Classification & WhatsApp Action */}
        <div className="lg:col-span-5 space-y-4">
          {/* Classification Result Card */}
          <div
            className="bg-white rounded-xl border p-5 shadow-xs space-y-4"
            style={{ borderTopWidth: '5px', borderTopColor: assignedMeta.color }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Predicted Customer Persona
              </span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: assignedMeta.bgColor,
                  color: assignedMeta.color,
                  border: `1px solid ${assignedMeta.borderColor}`,
                }}
              >
                Inference Complete
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-xs"
                style={{ backgroundColor: assignedMeta.color }}
              >
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 tracking-tight">
                  {assignedMeta.title}
                </h4>
                <p className="text-xs text-slate-500">{assignedMeta.description}</p>
              </div>
            </div>

            {/* Next Loyalty Tier Distance */}
            {predictionResult.nextTierInfo ? (
              <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                  <span>Next Loyalty Tier: {predictionResult.nextTierInfo.nextPersona}</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-snug">
                  Customer needs{' '}
                  {predictionResult.nextTierInfo.spendGap > 0 && (
                    <strong>
                      {currencySymbol}{predictionResult.nextTierInfo.spendGap.toLocaleString()} more spend{' '}
                    </strong>
                  )}
                  {predictionResult.nextTierInfo.spendGap > 0 &&
                    predictionResult.nextTierInfo.orderGap > 0 &&
                    'and '}
                  {predictionResult.nextTierInfo.orderGap > 0 && (
                    <strong>{predictionResult.nextTierInfo.orderGap} more orders </strong>
                  )}
                  to reach this higher tier!
                </p>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Customer is already in the top Champions tier!</span>
              </div>
            )}

            {/* Immediate Ready-to-Send Offer Generator */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <span>Personalized WhatsApp Offer</span>
                <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {assignedMeta.defaultCode}
                </span>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5 font-semibold">
                  Recipient Contact (WhatsApp Phone or Messenger ID / m.me)
                </label>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+88017... or m.me/username"
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-800"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans">
                {personalizedOffer}
              </div>

              <div className="flex items-center gap-2 pt-1">
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp</span>
                  </a>
                ) : messengerUrl ? (
                  <a
                    href={messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send via Messenger</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex-1 px-3 py-2 text-xs font-semibold text-slate-400 bg-slate-100 rounded-lg"
                  >
                    Enter Phone or Messenger ID to Send
                  </button>
                )}

                {waUrl && messengerUrl && (
                  <a
                    href={messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                    title="Also send via Messenger"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  onClick={copyToClipboard}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title="Copy Offer text"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: AI Counter Cross-Sell & Upsell Pitch */}
          {companionRecommendation && (
            <div className="bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/60 rounded-xl border border-amber-200/90 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Real-Time Counter Cross-Sell Suggestion</span>
                </span>
                <span className="text-[10px] font-bold bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded-full">
                  +{currencySymbol}{companionRecommendation.discountedPrice.toLocaleString()} Basket Uplift
                </span>
              </div>

              <div className="bg-white/90 rounded-lg p-3 border border-amber-200/60 flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    {companionRecommendation.category} · {companionRecommendation.affinityScorePct}% Match
                  </span>
                  <h5 className="font-extrabold text-slate-900 text-sm mt-0.5">
                    {companionRecommendation.productName}
                  </h5>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                    💡 {companionRecommendation.recommendationReason}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-black text-emerald-800">
                    {currencySymbol}{companionRecommendation.discountedPrice.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 line-through">
                    {currencySymbol}{companionRecommendation.originalPrice.toLocaleString()}
                  </div>
                  <span className="text-[10px] font-bold text-amber-800">
                    {companionRecommendation.discountCode} (-{companionRecommendation.discountPct}%)
                  </span>
                </div>
              </div>

              {/* Cashier Verbal Pitch Script */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-700">Cashier Counter Pitch Script:</span>
                  <button
                    onClick={() =>
                      copyPitchScript(
                        `"Assalamu Alaikum! As our ${assignedMeta.title.split('(')[0].trim()} shopper today, you qualify for ${companionRecommendation.discountPct}% off our ${companionRecommendation.productName} for only ${currencySymbol}${companionRecommendation.discountedPrice}! Would you like us to pack one with your receipt?"`
                      )
                    }
                    className="text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
                  >
                    {copiedPitch ? 'Copied Pitch! ✓' : 'Copy Pitch Script'}
                  </button>
                </div>
                <p className="text-xs text-slate-800 italic leading-relaxed">
                  "Assalamu Alaikum! As our {assignedMeta.title.split('(')[0].trim()} shopper today, you qualify for{' '}
                  <strong className="text-emerald-800 not-italic">{companionRecommendation.discountPct}% off</strong> our{' '}
                  <strong>{companionRecommendation.productName}</strong> for only{' '}
                  <strong className="text-emerald-800 not-italic">
                    {currencySymbol}{companionRecommendation.discountedPrice.toLocaleString()}
                  </strong>
                  ! Would you like us to pack one with your receipt?"
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
