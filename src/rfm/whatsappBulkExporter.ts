import {
  CustomerRFMTD,
  PersonaType,
  CampaignConfig,
  WhatsAppBulkToolFormat,
  WHATSAPP_BULK_TOOL_SPECS,
} from './types';

/**
 * Standardizes phone numbers to clean international E.164 digits without leading '+'
 * as required by WhatsApp Business API & bulk sending tools (e.g. 8801712345678).
 */
export function formatE164Phone(rawPhone?: string, defaultCountryCode = '880'): string | null {
  if (!rawPhone) return null;
  const digits = String(rawPhone).replace(/[^\d]/g, '');
  if (!digits || digits.length < 7) return null;

  // Bangladeshi 11-digit numbers starting with 01X (e.g. 01711234567)
  if (digits.length === 11 && digits.startsWith('01')) {
    return `${defaultCountryCode}${digits.slice(1)}`; // 880 + 1711234567 = 8801711234567
  }

  // Already has 880 e.g. 8801711234567 (13 digits)
  if (digits.length === 13 && digits.startsWith('880')) {
    return digits;
  }

  // If starts with 00880
  if (digits.startsWith('00880')) {
    return digits.slice(2);
  }

  // Standard valid international length (7 to 15 digits)
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}

import { CustomerRecommendationProfile } from './recommendationEngine';

export interface BulkExportOptions {
  toolFormat: WhatsAppBulkToolFormat;
  segmentFilter: PersonaType | 'All';
  onlyValidPhones: boolean;
  shopName: string;
  currencySymbol: string;
  campaignConfigs: Record<PersonaType, CampaignConfig>;
  recommendationsMap?: Map<string, CustomerRecommendationProfile>;
}

export interface BulkExportResult {
  csvContent: string;
  filename: string;
  totalFiltered: number;
  validPhoneCount: number;
  skippedPhoneCount: number;
  headers: string[];
  sampleRows: Record<string, string>[];
}

/**
 * Generates formatted CSV content specifically tailored for chosen WhatsApp bulk messaging tools
 */
export function generateWhatsAppBulkExport(
  customers: CustomerRFMTD[],
  options: BulkExportOptions
): BulkExportResult {
  const spec = WHATSAPP_BULK_TOOL_SPECS[options.toolFormat];
  const { segmentFilter, onlyValidPhones, shopName, currencySymbol, campaignConfigs, recommendationsMap } = options;

  let filtered = customers.filter((c) => {
    if (segmentFilter !== 'All' && c.persona !== segmentFilter) return false;
    return true;
  });

  let validCount = 0;
  let skippedCount = 0;
  const outputRows: Record<string, string>[] = [];

  for (const c of filtered) {
    const persona = c.persona || 'Champions (VIP Loyalists)';
    const cfg = campaignConfigs[persona];
    const e164 = formatE164Phone(c.phone);

    const isMessengerFormat = options.toolFormat === 'manychat_messenger' || options.toolFormat === 'fcommerce_multichannel';

    if (!e164) {
      skippedCount++;
      if (onlyValidPhones && !isMessengerFormat) continue;
    } else {
      validCount++;
    }

    const customerName = c.customerKey.startsWith('cust_')
      ? `Customer #${c.customerKey.replace('cust_', '')}`
      : c.phone || 'Valued Shopper';

    const recProfile = recommendationsMap?.get(c.customerKey);
    const suggestedProduct = recProfile?.primaryRecommendation.productName || 'Handcrafted Featured Collection';
    const suggestedPrice = recProfile?.primaryRecommendation.discountedPrice
      ? `${currencySymbol}${recProfile.primaryRecommendation.discountedPrice}`
      : `${currencySymbol}${Math.round(c.avgOrderValue * 0.85)}`;
    const personalizedOffer = recProfile?.primaryRecommendation.recommendationReason
      ? `${recProfile.primaryRecommendation.discountPct}% Off (${recProfile.primaryRecommendation.recommendationReason})`
      : cfg.discountValue;

    // Build personalized message body with dynamic merge tags
    const message = cfg.messageTemplate
      .replace(/{name}/g, customerName)
      .replace(/{shop_name}/g, shopName)
      .replace(/{discount_code}/g, cfg.discountCode)
      .replace(/{monetary}/g, `${currencySymbol}${c.monetary.toFixed(0)}`)
      .replace(/{recency}/g, String(c.recency))
      .replace(/{suggested_product}/g, suggestedProduct)
      .replace(/{suggested_price}/g, suggestedPrice)
      .replace(/{personalized_offer}/g, personalizedOffer);

    const phoneStr = e164 || c.phone || '';
    const cleanHandle = c.messengerId || c.facebookProfileId || (c.customerKey.startsWith('cust_') ? `m.me/buyer_${c.customerKey.replace('cust_', '')}` : `m.me/${c.customerKey.toLowerCase().replace(/\s+/g, '.')}`);
    const messengerLink = cleanHandle.startsWith('http') ? cleanHandle : cleanHandle.startsWith('m.me') ? `https://${cleanHandle}` : `https://m.me/${cleanHandle}`;
    const channelType = e164 ? 'WhatsApp' : 'Facebook Messenger';
    const dispatchUrl = e164
      ? `https://wa.me/${e164}?text=${encodeURIComponent(message)}`
      : `${messengerLink}?text=${encodeURIComponent(message)}`;

    let rowData: Record<string, string> = {};

    switch (options.toolFormat) {
      case 'manychat_messenger':
        rowData = {
          user_id: cleanHandle.replace(/^https?:\/\/m\.me\//, '').replace(/^m\.me\//, ''),
          first_name: customerName,
          channel: channelType,
          messenger_link: messengerLink,
          segment: persona,
          suggested_product: suggestedProduct,
          suggested_price: suggestedPrice,
          discount_code: cfg.discountCode,
          message_content: message,
        };
        break;

      case 'fcommerce_multichannel':
        rowData = {
          customer_name: customerName,
          channel: channelType,
          target_identifier: e164 || cleanHandle,
          whatsapp_phone: phoneStr,
          messenger_id: cleanHandle,
          dispatch_url: dispatchUrl,
          segment: persona,
          suggested_product: suggestedProduct,
          suggested_price: suggestedPrice,
          discount_code: cfg.discountCode,
          message_text: message,
        };
        break;

      case 'wati_aisensy':
        rowData = {
          phone_number: phoneStr,
          name: customerName,
          segment: persona,
          discount_code: cfg.discountCode,
          discount_value: cfg.discountValue,
          suggested_product: suggestedProduct,
          suggested_price: suggestedPrice,
          personalized_offer: personalizedOffer,
          shop_name: shopName,
          recency_days: String(c.recency),
          frequency_orders: String(c.frequency),
          monetary_spend: `${c.monetary.toFixed(0)}`,
          template_name: `promo_${cfg.discountCode.toLowerCase()}`,
          custom_message: message,
        };
        break;

      case 'generic_extension':
        rowData = {
          Phone: phoneStr,
          Name: customerName,
          Message: message,
          Suggested_Product: suggestedProduct,
          Var1: cfg.discountCode,
          Var2: shopName,
          Var3: suggestedPrice,
          Var4: `${c.recency} days`,
        };
        break;

      case 'gallabox_quickreply':
        rowData = {
          Phone: phoneStr,
          'First Name': customerName,
          Tags: `${persona}, ${c.isGuest ? 'Guest' : 'Account'}, RFM, ${channelType}`,
          Segment: persona,
          PromoCode: cfg.discountCode,
          Suggested_Product: suggestedProduct,
          Offer_Price: suggestedPrice,
          'Message Content': message,
        };
        break;

      case 'clean_phone_list':
      default:
        rowData = {
          Phone: phoneStr || cleanHandle,
          Customer_Name: customerName,
          Segment_Persona: persona,
          Suggested_Product: suggestedProduct,
          Message_Text: message,
        };
        break;
    }

    outputRows.push(rowData);
  }

  // Build CSV string with proper escaping
  const csvHeaders = spec.headers;
  const escapeCSV = (val: string) => {
    if (val === undefined || val === null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headerLine = csvHeaders.map(escapeCSV).join(',');
  const rowLines = outputRows.map((row) =>
    csvHeaders.map((h) => escapeCSV(row[h] || '')).join(',')
  );

  const csvContent = [headerLine, ...rowLines].join('\n');
  const cleanSeg = segmentFilter === 'All' ? 'All_Segments' : segmentFilter.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `WhatsApp_Bulk_${options.toolFormat}_${cleanSeg}_${dateStr}.csv`;

  return {
    csvContent,
    filename,
    totalFiltered: filtered.length,
    validPhoneCount: validCount,
    skippedPhoneCount: skippedCount,
    headers: csvHeaders,
    sampleRows: outputRows.slice(0, 5),
  };
}
