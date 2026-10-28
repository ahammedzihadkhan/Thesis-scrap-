export type CurrencyCode = 'USD' | 'BDT' | 'GBP' | 'EUR' | 'INR';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  rateToUSD: number; // For conversions if needed
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', rateToUSD: 1 },
  BDT: { code: 'BDT', symbol: 'Tk ', name: 'Bangladeshi Taka', rateToUSD: 0.0085 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', rateToUSD: 1.28 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rateToUSD: 1.08 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', rateToUSD: 0.012 },
};

export interface RawTransaction {
  [key: string]: any;
}

export interface ColumnMapping {
  orderIdCol: string;
  timestampCol: string;
  customerCol: string;
  phoneCol: string;
  emailCol: string;
  messengerCol?: string; // e.g. "facebookProfileId", "messenger_id", "facebook_id"
  productCol: string;
  revenueMode: 'quantity_price' | 'total_amount';
  quantityCol: string;
  unitPriceCol: string;
  totalAmountCol: string;
}

export interface CleanedTransaction {
  orderId: string;
  timestamp: Date;
  dateStr: string;
  customerName?: string;
  customerId?: string;
  phone?: string;
  normalizedPhone?: string;
  email?: string;
  normalizedEmail?: string;
  messengerId?: string;
  facebookProfileId?: string;
  orderChannel?: 'WhatsApp' | 'Facebook Messenger' | 'Facebook Page Direct';
  preferredChannel?: 'whatsapp' | 'messenger';
  unifiedKey: string;
  isGuest: boolean;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}

export interface FilteredRecordDetail {
  orderId: string;
  reason: 'cancelled_order' | 'negative_amount' | 'zero_amount' | 'invalid_date' | 'missing_order_id' | 'corrupt_data';
  reasonLabel: string;
  rawSnippet: string;
}

export interface RecoveredGuestDetail {
  unifiedKey: string;
  customerName?: string;
  channel: 'WhatsApp' | 'Facebook Messenger' | 'Email' | 'Guest Order';
  identifier: string;
  orderCount: number;
  totalSpent: number;
  firstOrderDate: string;
  lastOrderDate: string;
}

export interface DataHygieneStats {
  totalRawRows: number;
  validIdentifiedRows: number;
  cancelledRowsRemoved: number;
  duplicateOrInvalidRowsRemoved: number;
  uniqueCustomers: number;
  repeatGuestBuyersRecovered: number;
  guestOnlyCount: number;
  registeredUserCount: number;
  guestSharePct: number;
  // Dynamic extended statistics:
  phoneIdentifiedCount: number;
  messengerIdentifiedCount: number;
  emailIdentifiedCount: number;
  registeredAccountIdCount: number;
  fallbackGuestCount: number;
  dataPurityPct: number;
  filteredRecords: FilteredRecordDetail[];
  recoveredGuests: RecoveredGuestDetail[];
}

export interface CustomerRFMTD {
  customerKey: string;
  customerName?: string;
  phone?: string;
  email?: string;
  messengerId?: string;
  facebookProfileId?: string;
  orderChannel?: 'WhatsApp' | 'Facebook Messenger' | 'Facebook Page Direct';
  preferredChannel?: 'whatsapp' | 'messenger';
  isGuest: boolean;
  firstPurchaseDate: Date;
  lastPurchaseDate: Date;
  recency: number; // Days since max(date) + 1
  frequency: number; // Count of distinct invoices
  monetary: number; // Total spend
  avgOrderValue: number;
  interPurchaseTime: number; // Mean calendar days between consecutive orders
  basketDepth: number; // Distinct products/SKUs
  isSinglePurchase: boolean; // F = 1
  cluster?: number;
  persona?: PersonaType;
  pc1?: number;
  pc2?: number;
}

export type PersonaType =
  | 'Champions (VIP Loyalists)'
  | 'Loyal & Promising Regulars'
  | 'High-Potential / At-Risk Guests'
  | 'Hibernating / Lost Guests';

export interface PersonaMeta {
  type: PersonaType;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeClass: string;
  description: string;
  defaultDiscount: string;
  defaultCode: string;
  defaultCampaignMessage: string;
}

export interface PreprocessingStats {
  feature: 'recency' | 'frequency' | 'monetary' | 'interPurchaseTime' | 'basketDepth';
  label: string;
  rawMean: number;
  rawStd: number;
  rawSkewness: number;
  logMean: number;
  logStd: number;
  logSkewness: number;
}

export interface ClusterCentroid {
  clusterIndex: number;
  persona: PersonaType;
  customerCount: number;
  customerSharePct: number;
  totalRevenue: number;
  revenueSharePct: number;
  recencyMean: number;
  recencyMedian: number;
  frequencyMean: number;
  frequencyMedian: number;
  monetaryMean: number;
  monetaryMedian: number;
  iptMean: number;
  iptMedian: number;
  basketDepthMean: number;
  basketDepthMedian: number;
  // Normalized z-score centroid for radar/bar
  zScores: {
    recency: number;
    frequency: number;
    monetary: number;
    interPurchaseTime: number;
    basketDepth: number;
  };
}

export interface BenchmarkAlgorithmResult {
  algorithm: string;
  fullName: string;
  silhouette: number;
  daviesBouldin: number;
  calinskiHarabasz: number;
  minClusterSizePct: number;
  maxClusterSizePct: number;
  isValid: boolean; // Cluster size within 2% - 80%
  statusNote: string;
  highlightKMeansWin?: boolean;
}

export interface ModelHealthMetrics {
  silhouetteScore: number;
  daviesBouldinIndex: number;
  calinskiHarabaszIndex: number;
  hopkinsStatistic: number;
  bootstrapStabilityARI: number;
}

export interface TemporalHoldoutResult {
  splitDate: string;
  trainCustomerCount: number;
  holdoutCustomerCount: number;
  totalHoldoutRevenue: number;
  segments: {
    persona: PersonaType;
    trainCustomerCount: number;
    repurchasedCount: number;
    repurchaseRatePct: number;
    futureRevenue: number;
    futureRevenueSharePct: number;
  }[];
}

export interface CampaignConfig {
  persona: PersonaType;
  discountCode: string;
  discountValue: string;
  headline: string;
  messageTemplate: string;
}

export type WhatsAppBulkToolFormat =
  | 'wati_aisensy'
  | 'generic_extension'
  | 'gallabox_quickreply'
  | 'clean_phone_list'
  | 'manychat_messenger'
  | 'fcommerce_multichannel';

export interface WhatsAppBulkToolSpec {
  id: WhatsAppBulkToolFormat;
  name: string;
  description: string;
  headers: string[];
}

export const WHATSAPP_BULK_TOOL_SPECS: Record<WhatsAppBulkToolFormat, WhatsAppBulkToolSpec> = {
  wati_aisensy: {
    id: 'wati_aisensy',
    name: 'WATI / AiSensy / Interakt (WhatsApp Cloud API)',
    description: 'Standard format for official WhatsApp Business Cloud API tools with custom parameter variables',
    headers: [
      'phone_number',
      'name',
      'segment',
      'discount_code',
      'discount_value',
      'suggested_product',
      'suggested_price',
      'personalized_offer',
      'shop_name',
      'recency_days',
      'frequency_orders',
      'monetary_spend',
      'template_name',
      'custom_message',
    ],
  },
  generic_extension: {
    id: 'generic_extension',
    name: 'WA Sender / Chrome Extension Broadcaster',
    description: 'Formatted with Phone, Name, Message and positional {var1}, {var2} placeholders for bulk sender plugins',
    headers: ['Phone', 'Name', 'Message', 'Suggested_Product', 'Var1', 'Var2', 'Var3', 'Var4'],
  },
  gallabox_quickreply: {
    id: 'gallabox_quickreply',
    name: 'Gallabox / QuickReply / ManyChat Format',
    description: 'Includes contact tags, custom fields, and personalized offer text',
    headers: ['Phone', 'First Name', 'Tags', 'Segment', 'PromoCode', 'Suggested_Product', 'Offer_Price', 'Message Content'],
  },
  clean_phone_list: {
    id: 'clean_phone_list',
    name: 'Clean Phone & Message Dispatch List',
    description: 'Simple 5-column CSV with international E.164 phone numbers, suggested product, and ready copy',
    headers: ['Phone', 'Customer_Name', 'Segment_Persona', 'Suggested_Product', 'Message_Text'],
  },
  manychat_messenger: {
    id: 'manychat_messenger',
    name: 'ManyChat / Meta Messenger Broadcast (FB ID / Username)',
    description: 'Target customers without WhatsApp phone via Facebook Messenger PSID, username, or profile handle',
    headers: ['user_id', 'first_name', 'channel', 'messenger_link', 'segment', 'suggested_product', 'suggested_price', 'discount_code', 'message_content'],
  },
  fcommerce_multichannel: {
    id: 'fcommerce_multichannel',
    name: 'Bangladeshi F-Commerce Unified List (WhatsApp + Messenger Auto-Fallback)',
    description: 'Complete multi-channel ledger with automatic fallback to Messenger when WhatsApp number is missing',
    headers: ['customer_name', 'channel', 'target_identifier', 'whatsapp_phone', 'messenger_id', 'dispatch_url', 'segment', 'suggested_product', 'suggested_price', 'discount_code', 'message_text'],
  },
};


