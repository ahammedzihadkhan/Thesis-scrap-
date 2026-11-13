import { CampaignConfig, PersonaType } from './types';

/** Default message template per established segment (editable in Send messages); also used by the AI evaluation. */
export const DEFAULT_CAMPAIGN_CONFIGS: Record<PersonaType, CampaignConfig> = {
  'Champions (VIP Loyalists)': {
    persona: 'Champions (VIP Loyalists)',
    discountCode: 'VIP-CURATED20',
    discountValue: '20% VIP Early Access',
    headline: 'Private VIP Early Access',
    messageTemplate:
      'Hi {name}! 🌟 As our top VIP buyer at {shop_name}, we curated "{suggested_product}" at 20% privilege ({suggested_price}) with code {discount_code}. Reserve yours today!',
  },
  'Loyal & Promising Regulars': {
    persona: 'Loyal & Promising Regulars',
    discountCode: 'PAIR-IT15',
    discountValue: '15% Off Next Purchase',
    headline: 'Loyalty Reward Voucher',
    messageTemplate:
      'Hello {name}! Complete your set at {shop_name} with "{suggested_product}" for only {suggested_price} with code {discount_code}.',
  },
  'High-Potential / At-Risk Guests': {
    persona: 'High-Potential / At-Risk Guests',
    discountCode: 'REVIVE-GIFT15',
    discountValue: '15% Comeback Treat',
    headline: 'We Miss You!',
    messageTemplate:
      'Hi {name}, we miss you at {shop_name}! It’s been {recency} days since your last order. Here is 15% off "{suggested_product}" ({suggested_price}) with code {discount_code}!',
  },
  'Hibernating / Lost Guests': {
    persona: 'Hibernating / Lost Guests',
    discountCode: 'WINBACK25',
    discountValue: '25% Win-Back Flash',
    headline: '25% Exclusive Re-Activation',
    messageTemplate:
      'Hey {name}, we noticed you haven’t shopped at {shop_name} recently. Take 25% off "{suggested_product}" (now {suggested_price}) with code {discount_code} and see what’s new!',
  },
};
