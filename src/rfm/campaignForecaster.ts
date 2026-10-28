import { PersonaType, CustomerRFMTD, CurrencyCode } from './types';
import { formatE164Phone } from './whatsappBulkExporter';

export interface CampaignForecastInput {
  targetSegment: PersonaType | 'All';
  conversionRatePct: number; // e.g. 15 for 15%
  predictedAOV: number; // Currency units
  costPerMessage?: number; // Cost per WhatsApp message (e.g. 0.65 BDT or 0.01 USD)
}

export interface CampaignForecastOutput {
  audienceSize: number;
  phoneReadyCount: number;
  projectedOrders: number;
  grossRevenue: number;
  totalMessagingCost: number;
  netRevenueGain: number;
  roas: number; // Return on Ad/Messaging Spend (e.g. 24.5x)
}

export interface SegmentBenchmarkScenario {
  persona: PersonaType;
  audienceSize: number;
  defaultConversionPct: number;
  historicalAOV: number;
  projectedOrders: number;
  projectedRevenue: number;
}

/**
 * Calculates campaign revenue forecast for a given customer segment
 */
export function calculateCampaignForecast(
  customers: CustomerRFMTD[],
  input: CampaignForecastInput
): CampaignForecastOutput {
  const { targetSegment, conversionRatePct, predictedAOV, costPerMessage = 0.65 } = input;

  const filtered = customers.filter(
    (c) => targetSegment === 'All' || c.persona === targetSegment
  );

  const audienceSize = filtered.length;
  const phoneReadyCount = filtered.filter((c) => Boolean(formatE164Phone(c.phone))).length;

  // Use phone-ready count for realistic messaging reach, fallback to audience size if 0
  const effectiveReach = phoneReadyCount > 0 ? phoneReadyCount : audienceSize;

  const convRateDecimal = Math.max(0, Math.min(100, conversionRatePct)) / 100;
  const projectedOrders = Math.round(effectiveReach * convRateDecimal);
  const grossRevenue = Math.round(projectedOrders * Math.max(0, predictedAOV));
  const totalMessagingCost = Math.round(effectiveReach * costPerMessage * 100) / 100;
  const netRevenueGain = Math.round(grossRevenue - totalMessagingCost);
  const roas = totalMessagingCost > 0 ? Math.round((grossRevenue / totalMessagingCost) * 10) / 10 : 0;

  return {
    audienceSize,
    phoneReadyCount,
    projectedOrders,
    grossRevenue,
    totalMessagingCost,
    netRevenueGain,
    roas,
  };
}

/**
 * Generates automated benchmark scenarios across all 4 customer personas
 */
export function generateAllSegmentScenarios(
  customers: CustomerRFMTD[]
): SegmentBenchmarkScenario[] {
  const personaDefaults: Record<PersonaType, number> = {
    'Champions (VIP Loyalists)': 22.0, // High engagement rate for VIPs
    'Loyal & Promising Regulars': 14.0, // Steady repeat conversion
    'High-Potential / At-Risk Guests': 8.5, // Slipping recency comeback
    'Hibernating / Lost Guests': 4.5, // Win-back reactivation
  };

  const personaOrder: PersonaType[] = [
    'Champions (VIP Loyalists)',
    'Loyal & Promising Regulars',
    'High-Potential / At-Risk Guests',
    'Hibernating / Lost Guests',
  ];

  return personaOrder.map((persona) => {
    const segmentCusts = customers.filter((c) => c.persona === persona);
    const audienceSize = segmentCusts.length;

    // Calculate historical AOV for this segment
    let totalSpend = 0;
    let totalOrders = 0;
    for (const c of segmentCusts) {
      totalSpend += c.monetary;
      totalOrders += c.frequency;
    }
    const historicalAOV = totalOrders > 0 ? Math.round(totalSpend / totalOrders) : 2500;

    const defaultConversionPct = personaDefaults[persona];
    const phoneReady = segmentCusts.filter((c) => Boolean(formatE164Phone(c.phone))).length;
    const reach = phoneReady > 0 ? phoneReady : audienceSize;
    const projectedOrders = Math.round(reach * (defaultConversionPct / 100));
    const projectedRevenue = projectedOrders * historicalAOV;

    return {
      persona,
      audienceSize,
      defaultConversionPct,
      historicalAOV,
      projectedOrders,
      projectedRevenue,
    };
  });
}
