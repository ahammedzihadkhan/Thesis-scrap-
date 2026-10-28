import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  WhatsAppShopOrder,
  WhatsAppShopKPIs,
  calculateWhatsAppShopKPIs,
  downloadWhatsAppShopExcelTemplate,
  buildWhatsAppChatUrl,
  buildMessengerChatUrl,
  buildFCommerceDispatchUrl,
  BANGLADESHI_WHATSAPP_SHOP_ORDERS,
  convertWhatsAppShopOrdersToRawRows,
  convertRawRowsToWhatsAppShopOrders,
} from '../data/bangladeshiWhatsAppShopData';
import { DARAZ_BD_ORDERS, DARAZ_BD_RAW_TRANSACTIONS } from '../data/darazSampleData';
import { RawTransaction, CustomerRFMTD } from '../rfm/types';
import {
  generateCustomerRecommendation,
  BANGLADESHI_CATALOG,
  CustomerRecommendationProfile,
  ProductRecommendation,
} from '../rfm/recommendationEngine';
import {
  Download,
  Upload,
  MessageSquare,
  PhoneCall,
  Mail,
  Smartphone,
  Store,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
  Sparkles,
  Search,
  Filter,
  ExternalLink,
  Send,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Copy,
  Check,
  Building2,
  Users,
  WalletCards,
  Gift,
  Tag,
  Zap,
  Package,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface WhatsAppShopSectionProps {
  onSyncWithRFMEngine: (rawRows: RawTransaction[], datasetLabel: string) => void;
  currencySymbol?: string;
  initialOrders?: WhatsAppShopOrder[];
  initialDatasetLabel?: string;
}

function getCustomerUnifiedKey(o: WhatsAppShopOrder): string {
  const anyPhone = o.whatsappPhone || o.smsPhone;
  if (anyPhone && anyPhone.trim().length > 5) {
    return anyPhone.replace(/[^\d]/g, '');
  }
  return o.customerEmail || o.facebookProfileId || o.customerName;
}

function getEffectiveChannel(o: WhatsAppShopOrder): 'whatsapp' | 'sms' | 'email' | 'messenger' {
  if (o.preferredChannel) return o.preferredChannel;
  if (o.whatsappPhone && o.whatsappPhone.trim().length > 5) return 'whatsapp';
  if (o.smsPhone && o.smsPhone.trim().length > 5) return 'sms';
  if (o.customerEmail && o.customerEmail.includes('@')) return 'email';
  return 'messenger';
}

export const WhatsAppShopSection: React.FC<WhatsAppShopSectionProps> = ({
  onSyncWithRFMEngine,
  currencySymbol = '৳',
  initialOrders,
  initialDatasetLabel,
}) => {
  // View mode: Orders Ledger vs AI Personalized Offers Studio
  const [viewMode, setViewMode] = useState<'orders' | 'personalized_offers'>('orders');

  // Store orders in local state
  const [orders, setOrders] = useState<WhatsAppShopOrder[]>(() =>
    initialOrders && initialOrders.length > 0
      ? initialOrders
      : [...DARAZ_BD_ORDERS]
  );
  const [activeDatasetLabel, setActiveDatasetLabel] = useState<string>(
    initialDatasetLabel || 'Daraz BD & Pickaboo Electronics (1,049 Orders · BDT ৳)'
  );

  // Sync when initialOrders from parent updates
  useEffect(() => {
    if (initialOrders && initialOrders.length > 0) {
      setOrders(initialOrders);
      if (initialDatasetLabel) setActiveDatasetLabel(initialDatasetLabel);
      setCurrentPage(1);
    }
  }, [initialOrders, initialDatasetLabel]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'whatsapp' | 'sms' | 'email' | 'messenger'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'repeat_first'>('date_desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, channelFilter, paymentFilter, statusFilter, districtFilter, sortBy]);

  // Universal 4-Channel Dispatch Modal State (WhatsApp, Phone SMS, Email, Messenger)
  const [selectedOrderForChat, setSelectedOrderForChat] = useState<WhatsAppShopOrder | null>(null);
  const [chatTemplate, setChatTemplate] = useState<
    'order_confirm' | 'courier_dispatch' | 'eid_offer' | 'review_request' | 'personalized_offer'
  >('order_confirm');
  const [modalChannel, setModalChannel] = useState<'whatsapp' | 'sms' | 'email' | 'messenger'>('whatsapp');
  const [messageLang, setMessageLang] = useState<'bn' | 'en'>('en');
  const [copiedLink, setCopiedLink] = useState(false);
  const [syncSuccessToast, setSyncSuccessToast] = useState(false);

  // File Upload Handling
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);

  // Calculate KPIs
  const kpis: WhatsAppShopKPIs = useMemo(() => {
    return calculateWhatsAppShopKPIs(orders);
  }, [orders]);

  // Customer repeat map for quick repeat status badge across Phone, Email, or Social ID
  const repeatPhoneSet = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((o) => {
      const k = getCustomerUnifiedKey(o);
      counts.set(k, (counts.get(k) || 0) + 1);
    });
    const repeats = new Set<string>();
    counts.forEach((c, k) => {
      if (c > 1) repeats.add(k);
    });
    return repeats;
  }, [orders]);

  // Pre-calculate Next-Best Product and Personalized Offer for each customer across POS, E-Com, and Social
  const customerRecs = useMemo(() => {
    type RecEntry = {
      profile: CustomerRecommendationProfile;
      orders: WhatsAppShopOrder[];
      totalSpend: number;
      customerName: string;
      whatsappPhone?: string;
      smsPhone?: string;
      customerEmail?: string;
      facebookProfileId?: string;
      preferredChannel: 'whatsapp' | 'sms' | 'email' | 'messenger';
    };
    const map = new Map<string, RecEntry>();

    orders.forEach((o) => {
      const key = getCustomerUnifiedKey(o);
      const entry: RecEntry = map.get(key) || {
        profile: {} as any,
        orders: [] as WhatsAppShopOrder[],
        totalSpend: 0,
        customerName: o.customerName,
        whatsappPhone: o.whatsappPhone,
        smsPhone: o.smsPhone,
        customerEmail: o.customerEmail,
        facebookProfileId: o.facebookProfileId,
        preferredChannel: getEffectiveChannel(o),
      };
      entry.orders.push(o);
      entry.totalSpend += o.totalAmountBDT;
      if (!entry.whatsappPhone && o.whatsappPhone) entry.whatsappPhone = o.whatsappPhone;
      if (!entry.smsPhone && o.smsPhone) entry.smsPhone = o.smsPhone;
      if (!entry.customerEmail && o.customerEmail) entry.customerEmail = o.customerEmail;
      if (!entry.facebookProfileId && o.facebookProfileId) entry.facebookProfileId = o.facebookProfileId;
      map.set(key, entry);
    });

    map.forEach((entry, key) => {
      const isRepeat = entry.orders.length > 1;
      const persona =
        entry.totalSpend >= 10000 || entry.orders.length >= 4
          ? 'Champions (VIP Loyalists)'
          : isRepeat
          ? 'Loyal & Promising Regulars'
          : entry.orders[0]?.deliveryStatus === 'RTO / Returned'
          ? 'Hibernating / Lost Guests'
          : 'High-Potential / At-Risk Guests';

      const mockRFM: CustomerRFMTD = {
        customerKey: entry.customerName || key,
        phone: entry.whatsappPhone || entry.smsPhone,
        isGuest: true,
        firstPurchaseDate: new Date(entry.orders[entry.orders.length - 1].orderDate),
        lastPurchaseDate: new Date(entry.orders[0].orderDate),
        recency: 10,
        frequency: entry.orders.length,
        monetary: entry.totalSpend,
        avgOrderValue: entry.totalSpend / entry.orders.length,
        interPurchaseTime: 30,
        basketDepth: entry.orders.length,
        isSinglePurchase: !isRepeat,
        persona,
      };

      const pastItems = entry.orders.map((o) => o.items);
      const profile = generateCustomerRecommendation(
        mockRFM,
        pastItems,
        BANGLADESHI_CATALOG,
        currencySymbol
      );
      entry.profile = profile;
    });

    return map;
  }, [orders, currencySymbol]);


  // Unique districts for filter dropdown
  const districtList = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      if (o.deliveryDistrict) set.add(o.deliveryDistrict.split('(')[0]?.trim());
    });
    return Array.from(set).sort();
  }, [orders]);

  // Filtered & Sorted orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            o.customerName.toLowerCase().includes(q) ||
            (o.whatsappPhone && o.whatsappPhone.toLowerCase().includes(q)) ||
            (o.smsPhone && o.smsPhone.toLowerCase().includes(q)) ||
            (o.customerEmail && o.customerEmail.toLowerCase().includes(q)) ||
            (o.facebookProfileId && o.facebookProfileId.toLowerCase().includes(q)) ||
            o.orderId.toLowerCase().includes(q) ||
            o.items.toLowerCase().includes(q) ||
            o.deliveryDistrict.toLowerCase().includes(q) ||
            (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Omni-Channel Reach filter (WhatsApp, Phone SMS, Email, Messenger)
        if (channelFilter !== 'ALL') {
          const eff = getEffectiveChannel(o);
          if (eff !== channelFilter) return false;
        }

        // Payment filter
        if (paymentFilter !== 'ALL') {
          if (!o.paymentMethod.toLowerCase().includes(paymentFilter.toLowerCase())) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== 'ALL') {
          if (o.deliveryStatus !== statusFilter) return false;
        }

        // District filter
        if (districtFilter !== 'ALL') {
          if (!o.deliveryDistrict.toLowerCase().includes(districtFilter.toLowerCase())) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime();
        }
        if (sortBy === 'date_asc') {
          return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
        }
        if (sortBy === 'amount_desc') {
          return b.totalAmountBDT - a.totalAmountBDT;
        }
        if (sortBy === 'repeat_first') {
          const aKey = getCustomerUnifiedKey(a);
          const bKey = getCustomerUnifiedKey(b);
          const aRepeat = repeatPhoneSet.has(aKey) ? 1 : 0;
          const bRepeat = repeatPhoneSet.has(bKey) ? 1 : 0;
          return bRepeat - aRepeat;
        }
        return 0;
      });
  }, [orders, searchQuery, channelFilter, paymentFilter, statusFilter, districtFilter, sortBy, repeatPhoneSet]);

  // Paginated orders for ultra-fast smooth rendering
  const totalFiltered = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Handle Loading Bangladeshi Demo
  const handleLoadBangladeshiDemo = () => {
    setOrders([...BANGLADESHI_WHATSAPP_SHOP_ORDERS]);
    setActiveDatasetLabel('Dhakaiya Omni-Channel Retail & POS Demo (200 Orders · BDT ৳)');
    setUploadError(null);
    setCurrentPage(1);
    const rawRows = convertWhatsAppShopOrdersToRawRows(BANGLADESHI_WHATSAPP_SHOP_ORDERS);
    onSyncWithRFMEngine(rawRows, 'Dhakaiya Omni-Channel Retail & POS Demo (200 Orders)');
  };

  // Handle Loading Daraz BD & Pickaboo Sample (1,049 Orders)
  const handleLoadDarazDemo = () => {
    setIsUploading(true);
    setUploadError(null);
    setTimeout(() => {
      setOrders(DARAZ_BD_ORDERS);
      const label = `Daraz BD, Pickaboo & Retail POS (${DARAZ_BD_ORDERS.length} orders · BDT ৳)`;
      setActiveDatasetLabel(label);
      setIsUploading(false);
      setUploadError(null);
      setCurrentPage(1);
      onSyncWithRFMEngine(DARAZ_BD_RAW_TRANSACTIONS, label);
      setSyncSuccessToast(true);
      setTimeout(() => setSyncSuccessToast(false), 3500);
    }, 150);
  };

  // Handle Excel or CSV file upload (POS Systems, Daraz BD, Pickaboo, Shopify, WooCommerce, Excel)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buffer = evt.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rawData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

          if (rawData.length === 0) {
            setUploadError('The uploaded Excel sheet contains no order rows.');
            setIsUploading(false);
            return;
          }

          const validRows = rawData.filter((r: any) => r && typeof r === 'object');
          const mappedOrders = convertRawRowsToWhatsAppShopOrders(validRows);

          setOrders(mappedOrders);
          const label = `Uploaded Excel: ${fileName} (${mappedOrders.length} orders)`;
          setActiveDatasetLabel(label);
          setIsUploading(false);
          setCurrentPage(1);

          // Auto-sync with 5D RFM Engine
          const rawRows = convertWhatsAppShopOrdersToRawRows(mappedOrders);
          onSyncWithRFMEngine(rawRows, label);
          setSyncSuccessToast(true);
          setTimeout(() => setSyncSuccessToast(false), 3500);
        } catch (err: any) {
          setUploadError(`Failed to parse Excel file: ${err.message || 'Unknown error'}`);
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV parser (POS, Daraz BD, WooCommerce, custom)
      Papa.parse<any>(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            setUploadError('The uploaded CSV file is empty.');
            setIsUploading(false);
            return;
          }

          const validRows = results.data.filter((r: any) => r && (r.order_id || r['Order ID'] || r['Order Number'] || r.product_name || r.items));
          const rowsToMap = validRows.length > 0 ? validRows : results.data;
          const mappedOrders = convertRawRowsToWhatsAppShopOrders(rowsToMap);

          setOrders(mappedOrders);
          const label = `Uploaded File: ${fileName} (${mappedOrders.length} orders)`;
          setActiveDatasetLabel(label);
          setIsUploading(false);
          setUploadError(null);
          setCurrentPage(1);

          // Auto-sync with 5D RFM Engine
          const rawRows = convertWhatsAppShopOrdersToRawRows(mappedOrders);
          onSyncWithRFMEngine(rawRows, label);
          setSyncSuccessToast(true);
          setTimeout(() => setSyncSuccessToast(false), 3500);
        },
        error: (err) => {
          setUploadError(`Error parsing CSV: ${err.message}`);
          setIsUploading(false);
        },
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Sync to 5D RFM Engine
  const handlePushToRFM = () => {
    const rawRows = convertWhatsAppShopOrdersToRawRows(orders);
    onSyncWithRFMEngine(rawRows, `Omni-Channel Retail Hub · ${activeDatasetLabel}`);
    setSyncSuccessToast(true);
    setTimeout(() => setSyncSuccessToast(false), 3500);
  };

  // Export current filtered list as CSV
  const handleExportFilteredCSV = () => {
    const exportData = filteredOrders.map((o) => ({
      'Order ID': o.orderId,
      'Order Date': o.orderDate,
      'Customer Name': o.customerName,
      'Store Channel': o.orderChannel,
      'Preferred Reach': getEffectiveChannel(o),
      'WhatsApp Phone': o.whatsappPhone || '',
      'Phone (SMS/POS)': o.smsPhone || o.whatsappPhone || '',
      'Customer Email': o.customerEmail || '',
      'Facebook Messenger': o.facebookProfileId || '',
      'Items': o.items,
      'Category': o.category,
      'Total Amount (BDT)': o.totalAmountBDT,
      'Payment Method': o.paymentMethod,
      'Advance Paid (BDT)': o.advancePaidBDT,
      'Due COD (BDT)': o.dueAmountBDT,
      'District': o.deliveryDistrict,
      'Courier': o.courierPartner,
      'Status': o.deliveryStatus,
      'Tracking': o.trackingNumber,
      'Notes': o.customerNotes || '',
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `OmniChannel_Retail_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Center */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl p-6 sm:p-7 lg:p-8 shadow-md border border-emerald-700/50 space-y-5">
        {/* Title, Badge & Explanation Block */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Omni-Channel Retail, Offline POS, E-Commerce & Social Hub · Reach Every Customer Anyhow (BDT ৳)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white whitespace-normal">
              Omni-Channel Retail, POS & Customer Reach Hub
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 shadow-2xs whitespace-nowrap">
              <Zap className="w-3.5 h-3.5 text-slate-950" />
              <span>4-Channel &ldquo;Anyhow Reach&rdquo; Engine Active</span>
            </span>
          </div>

          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-5xl">
            Built for <strong className="text-white">every kind of shop</strong> — Offline Retail &amp; POS Stores (who log customer name &amp; mobile number at checkout), E-Commerce &amp; Marketplaces (Daraz, Pickaboo, Shopify, WooCommerce), and Social Sellers. If a customer has no WhatsApp or Facebook Messenger ID, the platform automatically routes personalized offers to their{' '}
            <strong className="text-amber-300 font-bold">Phone Number via Direct SMS (<code className="bg-emerald-950/70 px-1.5 py-0.5 rounded text-amber-200 font-mono text-xs">sms:+880...</code>)</strong>{' '}
            or their{' '}
            <strong className="text-sky-300 font-bold">Email Address (<code className="bg-emerald-950/70 px-1.5 py-0.5 rounded text-sky-200 font-mono text-xs">mailto:...</code>)</strong>{' '}
            so you reach 100% of your buyers with personalized offers!
          </p>

          {/* 4-Channel Priority & Fallback Visual Pill Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-emerald-300 font-bold uppercase tracking-wider text-[10px]">
              Auto-Reach Channels:
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-600/50 text-emerald-200 px-2.5 py-1 rounded-lg font-semibold">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>1. WhatsApp (wa.me)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-indigo-950/80 border border-indigo-400/50 text-indigo-200 px-2.5 py-1 rounded-lg font-semibold">
              <Smartphone className="w-3.5 h-3.5 text-indigo-300" />
              <span>2. POS / Phone SMS (No WA/FB)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-sky-950/80 border border-sky-400/50 text-sky-200 px-2.5 py-1 rounded-lg font-semibold">
              <Mail className="w-3.5 h-3.5 text-sky-300" />
              <span>3. Direct Email Offer</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-blue-950/80 border border-blue-400/50 text-blue-200 px-2.5 py-1 rounded-lg font-semibold">
              <Send className="w-3.5 h-3.5 text-blue-300" />
              <span>4. FB Messenger (m.me)</span>
            </span>
          </div>
        </div>

        {/* Quick Action Toolbar Shelf - Responsive Full-Width Bar */}
        <div className="pt-4 border-t border-emerald-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Download Excel Template */}
            <button
              onClick={() => downloadWhatsAppShopExcelTemplate(orders)}
              className="inline-flex items-center gap-2 bg-white text-emerald-900 hover:bg-emerald-50 px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer border border-emerald-100"
              title="Download standardized .xlsx Excel order tracking template for POS, E-Commerce & Social"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Download Excel Template (.xlsx)</span>
            </button>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />

            {/* Upload Shop Excel / CSV Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer border border-emerald-600"
              title="Upload your POS, E-Commerce, Daraz, or Social Shop Excel/CSV sheet (.xlsx, .xls, .csv)"
            >
              <Upload className="w-4 h-4 text-emerald-200" />
              <span>{isUploading ? 'Parsing...' : 'Upload POS / Shop CSV or Excel'}</span>
            </button>

            {/* Load 1,049 Orders Daraz BD & Pickaboo Demo */}
            <button
              onClick={handleLoadDarazDemo}
              disabled={isUploading}
              className="inline-flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-amber-100 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-amber-400/40"
              title="Load full 1,049-order Daraz BD, Pickaboo & POS dataset with Phone SMS, Email & WhatsApp channels"
            >
              <Package className="w-4 h-4 text-amber-300" />
              <span>Load 📦 Daraz &amp; POS (1,049 Orders)</span>
            </button>

            {/* Load Dhakaiya Boutique Demo */}
            <button
              onClick={handleLoadBangladeshiDemo}
              className="inline-flex items-center gap-2 bg-emerald-950/70 hover:bg-emerald-950 text-emerald-200 hover:text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border border-emerald-600/40"
              title="Load 200-order Omni-Channel Retail, POS, Email, WhatsApp & Messenger demo"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>Load 🇧🇩 Retail &amp; Boutique (200 Orders)</span>
            </button>
          </div>

          {/* Primary CTA: Push to 5D RFM Engine */}
          <button
            onClick={handlePushToRFM}
            className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-black shadow-sm hover:shadow-md transition-all cursor-pointer shrink-0 self-start md:self-auto"
            title="Push current store ledger into full 5D RFM segmentation & campaign forecaster"
          >
            <TrendingUp className="w-4 h-4 text-slate-950" />
            <span>Analyze in 5D RFM Engine</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dataset Label and Live 4-Channel Metrics */}
        <div className="pt-3 border-t border-emerald-800/40 flex flex-wrap items-center justify-between text-xs text-emerald-200/80 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-emerald-300 font-semibold">Active Ledger:</span>
            <span className="bg-emerald-950/80 px-2.5 py-0.5 rounded-md font-mono text-emerald-100 border border-emerald-700/50 text-[11px]">
              {activeDatasetLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-emerald-200">
            <span className="flex items-center gap-1">⚡ <strong>{orders.length}</strong> orders</span>
            <span className="text-emerald-500/50">·</span>
            <span className="flex items-center gap-1">🟢 <strong>{kpis.whatsappOrderCount}</strong> WhatsApp</span>
            <span className="text-emerald-500/50">·</span>
            <span className="flex items-center gap-1">📱 <strong>{kpis.smsReachableCount}</strong> Phone SMS (POS)</span>
            <span className="text-emerald-500/50">·</span>
            <span className="flex items-center gap-1">✉️ <strong>{kpis.emailReachableCount}</strong> Email</span>
            <span className="text-emerald-500/50">·</span>
            <span className="flex items-center gap-1">🔵 <strong>{kpis.messengerOrderCount}</strong> Messenger</span>
          </div>
        </div>

        {isUploading && (
          <div className="mt-3 p-3 bg-amber-500/20 border border-amber-300/50 rounded-xl text-xs text-amber-100 font-semibold flex items-center gap-2.5 animate-pulse">
            <RotateCcw className="w-4 h-4 text-amber-300 animate-spin shrink-0" />
            <span>
              Processing dataset in real-time: Parsing transactions, mapping Phone SMS / Email / WhatsApp / Messenger reach, and synchronizing with 5D RFM Engine...
            </span>
          </div>
        )}

        {uploadError && (
          <div className="mt-3 p-3 bg-rose-900/60 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {syncSuccessToast && (
          <div className="mt-3 p-3 bg-emerald-700 border border-emerald-400 rounded-xl text-xs text-white font-medium flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>
                Successfully synced {orders.length} omni-channel retail orders to the 5D RFM Engine! Check Store Overview, Customer Segments, and Campaign Studio.
              </span>
            </div>
            <button
              onClick={() => setSyncSuccessToast(false)}
              className="text-xs text-emerald-200 hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 4 Omni-Channel Retail KPI Cards (BDT ৳) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Shop Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              ৳
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {currencySymbol} {kpis.totalRevenueBDT.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Avg Order: {currencySymbol} {Math.round(kpis.avgOrderValueBDT).toLocaleString()}</span>
              <span className="font-semibold text-emerald-700">
                Adv: {currencySymbol} {kpis.advanceCollectedBDT.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: 4-Channel Customer Reach ("Anyhow Reach") */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Omni-Channel Customer Reach
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-1.5">
              <span>{kpis.uniqueCustomers}</span>
              <span className="text-xs font-semibold text-slate-400">buyers ({kpis.totalOrders} ord)</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded" title="Reachable via WhatsApp">
                🟢 WA: {kpis.whatsappOrderCount}
              </span>
              <span className="text-indigo-800 font-bold bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded" title="POS / Walk-in / Mobile Number without WhatsApp -> Direct Phone SMS">
                📱 SMS/POS: {kpis.smsReachableCount}
              </span>
              <span className="text-sky-800 font-bold bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded" title="Reachable via Personalized Email Offer">
                ✉️ Email: {kpis.emailReachableCount}
              </span>
              {kpis.messengerOrderCount > 0 && (
                <span className="text-blue-800 font-bold bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded" title="Reachable via Facebook Messenger">
                  🔵 FB: {kpis.messengerOrderCount}
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              <span>Repeat Rate: <strong className="text-teal-700">{kpis.repeatCustomerRatePct.toFixed(1)}%</strong> ({kpis.repeatCustomers} regular buyers)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Prepaid vs COD Cash Flow Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Prepaid (bKash/Nagad/POS)
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <WalletCards className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-indigo-950 tracking-tight flex items-baseline gap-2">
              <span>{kpis.prepaidSharePct.toFixed(0)}%</span>
              <span className="text-xs font-normal text-slate-500">
                ({currencySymbol} {kpis.prepaidRevenueBDT.toLocaleString()})
              </span>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${kpis.prepaidSharePct}%` }}
                title="Prepaid via bKash, Nagad, POS Card or Bank"
              />
              <div
                className="bg-amber-400 h-full"
                style={{ width: `${100 - kpis.prepaidSharePct}%` }}
                title="Cash on Delivery (COD)"
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
              <span>bKash/Nagad/Card: {kpis.prepaidCount} ord</span>
              <span>COD: {kpis.codCount} ord</span>
            </div>
          </div>
        </div>

        {/* Card 4: COD RTO Shield & Courier Loss Rate */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              COD Return (RTO) Rate
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpis.rtoCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
              <span className={kpis.rtoRatePct > 5 ? 'text-rose-600' : 'text-emerald-700'}>
                {kpis.rtoRatePct.toFixed(1)}%
              </span>
              <span className="text-xs font-normal text-slate-500">
                ({kpis.rtoCount} parcels)
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Lost Value: {currencySymbol} {kpis.rtoLostRevenueBDT.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-sm">
                Shield Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Retail & POS Reach Guide Banner */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
            <Store className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h4 className="font-bold text-amber-900">
              Universal Retail &amp; Offline POS Reach Shield: Never Lose a Customer Due to Missing Social Handles
            </h4>
            <p className="text-amber-800/90 mt-0.5 leading-relaxed">
              Whether your shop is an <strong>Offline POS Store</strong> (recording only Customer Name &amp; Phone Number), an <strong>E-Commerce Marketplace</strong> (Daraz/Pickaboo with Phone &amp; Email), or a <strong>Facebook/WhatsApp Page</strong>: if a buyer doesn&apos;t use WhatsApp or Messenger, click <strong>📱 Phone SMS</strong> to text their mobile number directly or <strong>✉️ Email</strong> to send a personalized discount voucher!
            </p>
          </div>
        </div>
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setChannelFilter(channelFilter === 'sms' ? 'ALL' : 'sms')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border ${
              channelFilter === 'sms'
                ? 'bg-indigo-700 text-white border-indigo-700'
                : 'text-indigo-900 bg-indigo-100/80 hover:bg-indigo-200/80 border-indigo-200'
            }`}
          >
            📱 POS / Phone SMS ({kpis.smsReachableCount})
          </button>
          <button
            onClick={() => setChannelFilter(channelFilter === 'email' ? 'ALL' : 'email')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border ${
              channelFilter === 'email'
                ? 'bg-sky-700 text-white border-sky-700'
                : 'text-sky-900 bg-sky-100/80 hover:bg-sky-200/80 border-sky-200'
            }`}
          >
            ✉️ Email Reach ({kpis.emailReachableCount})
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'RTO / Returned' ? 'ALL' : 'RTO / Returned')}
            className="text-xs font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            RTO Parcels ({kpis.rtoCount})
          </button>
        </div>
      </div>

      {/* Sub-view Switcher: Orders Ledger vs AI Personalized Offers & Suggestions Studio */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setViewMode('orders')}
          className={`pb-3 px-4 font-bold text-xs inline-flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            viewMode === 'orders'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Omni-Channel Order Ledger ({orders.length})</span>
        </button>

        <button
          onClick={() => setViewMode('personalized_offers')}
          className={`pb-3 px-4 font-bold text-xs inline-flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            viewMode === 'personalized_offers'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>✨ Personalized Offers Studio ({customerRecs.size} Buyers · SMS / Email / WA / FB)</span>
          <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full font-extrabold">
            Anyhow Reach
          </span>
        </button>
      </div>

      {viewMode === 'orders' ? (
        /* Orders Ledger & Customer Directory */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Ledger Header & Toolbar */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                  <span>Universal Retail, POS, E-Commerce &amp; Social Order Book</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {filteredOrders.length} orders
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracks every buyer across POS Walk-In (Phone SMS), E-Commerce (Email/Phone), WhatsApp &amp; Messenger with 1-click personalized offer dispatch
                </p>
              </div>

            <div className="flex items-center gap-2">
              {channelFilter !== 'ALL' && (
                <button
                  onClick={() => setChannelFilter('ALL')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  <span>Showing: {channelFilter.toUpperCase()}</span>
                  <span className="ml-1">✕</span>
                </button>
              )}
              <button
                onClick={handleExportFilteredCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Export currently filtered list as CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export Filtered CSV</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            {/* Search Input */}
            <div className="relative col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search customer, phone, email, item, district, tracking..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* 4-Channel Customer Reach Filter */}
            <div>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">🌐 All Reach Channels ({orders.length})</option>
                <option value="whatsapp">🟢 WhatsApp Reach ({kpis.whatsappOrderCount})</option>
                <option value="sms">📱 POS / Phone SMS ({kpis.smsReachableCount})</option>
                <option value="email">✉️ Email Reach ({kpis.emailReachableCount})</option>
                <option value="messenger">🔵 FB Messenger ({kpis.messengerOrderCount})</option>
              </select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">💳 All Payment Methods</option>
                <option value="bKash">bKash (Merchant &amp; Personal)</option>
                <option value="Nagad">Nagad</option>
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="Bank">Bank / POS Card</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">📦 All Delivery Statuses</option>
                <option value="Delivered">Delivered</option>
                <option value="In Transit">In Transit</option>
                <option value="Pending Confirmation">Pending Confirmation</option>
                <option value="RTO / Returned">RTO / Returned</option>
              </select>
            </div>

            {/* District Filter */}
            <div>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">📍 All Districts ({districtList.length})</option>
                {districtList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto text-left text-xs">
            <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-2.5 lg:px-3">Customer &amp; Contact Channel</th>
                <th className="py-2.5 px-2.5 lg:px-3">Order &amp; Source</th>
                <th className="py-2.5 px-2.5 lg:px-3">Items / Products</th>
                <th className="py-2.5 px-2.5 lg:px-3">Amount &amp; Payment</th>
                <th className="py-2.5 px-2.5 lg:px-3">Advance / Due</th>
                <th className="py-2.5 px-2.5 lg:px-3">District &amp; Courier</th>
                <th className="py-2.5 px-2.5 lg:px-3">Status</th>
                <th className="py-2.5 px-2.5 lg:px-3 text-right">Reach Anyhow Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-semibold">No orders found matching your filters</p>
                    <p className="text-xs mt-1">Try clearing your search query or reset filter options.</p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order, idx) => {
                  const uKey = getCustomerUnifiedKey(order);
                  const isRepeat = repeatPhoneSet.has(uKey);
                  const effChannel = getEffectiveChannel(order);

                  return (
                    <tr key={`${order.orderId}-${order.trackingNumber || ''}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      {/* Customer Name & 4-Channel Contact */}
                      <td className="py-2.5 px-2.5 lg:px-3 min-w-[155px] max-w-[215px]">
                        <div className="font-bold text-slate-900 flex items-center gap-1 flex-wrap">
                          <span className="truncate max-w-[130px]" title={order.customerName}>{order.customerName}</span>
                          {isRepeat && (
                            <span className="bg-teal-100 text-teal-800 text-[9px] font-black px-1 py-0.2 rounded-sm shrink-0" title="Repeat Customer across multiple orders!">
                              REPEAT
                            </span>
                          )}
                        </div>

                        {effChannel === 'whatsapp' && (
                          <div className="mt-0.5">
                            <div className="text-[11px] font-mono text-emerald-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              <span className="truncate">{order.whatsappPhone || order.smsPhone}</span>
                              <span className="text-[9px] bg-emerald-50 text-emerald-800 px-1 rounded font-bold border border-emerald-200 shrink-0">WA</span>
                            </div>
                            {order.customerEmail && (
                              <span className="text-[9px] text-slate-400 truncate block" title={order.customerEmail}>
                                ✉️ {order.customerEmail}
                              </span>
                            )}
                          </div>
                        )}

                        {effChannel === 'sms' && (
                          <div className="mt-0.5">
                            <div className="text-[11px] font-mono text-indigo-800 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                              <span className="truncate">{order.smsPhone || order.whatsappPhone}</span>
                              <span className="text-[9px] bg-indigo-50 text-indigo-800 px-1 rounded font-bold border border-indigo-200 shrink-0">SMS</span>
                            </div>
                            <span className="text-[9px] text-indigo-700 font-medium bg-indigo-50/80 px-1 rounded-sm mt-0.5 inline-block">
                              POS / Phone Only · Direct SMS
                            </span>
                          </div>
                        )}

                        {effChannel === 'email' && (
                          <div className="mt-0.5">
                            <div className="text-[11px] font-mono text-sky-800 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                              <span className="truncate max-w-[145px]" title={order.customerEmail}>{order.customerEmail}</span>
                              <span className="text-[9px] bg-sky-50 text-sky-800 px-1 rounded font-bold border border-sky-200 shrink-0">EMAIL</span>
                            </div>
                            <span className="text-[9px] text-sky-700 font-medium bg-sky-50/80 px-1 rounded-sm mt-0.5 inline-block">
                              {order.smsPhone ? `📱 ${order.smsPhone} · Email` : 'No WA/FB · Email Offer'}
                            </span>
                          </div>
                        )}

                        {effChannel === 'messenger' && (
                          <div className="mt-0.5">
                            <div className="text-[11px] font-mono text-blue-700 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                              <span className="truncate max-w-[140px]" title={order.facebookProfileId || 'm.me/buyer'}>{order.facebookProfileId || 'm.me/buyer'}</span>
                              <span className="text-[9px] bg-blue-50 text-blue-800 px-1 rounded font-bold border border-blue-200 shrink-0">FB</span>
                            </div>
                            <span className="text-[9px] text-amber-700 font-medium bg-amber-50 px-1 rounded-sm mt-0.5 inline-block">
                              No Phone · Messenger
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Order ID, Date & Store Source */}
                      <td className="py-2.5 px-2.5 lg:px-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 block text-[11px]">{order.orderId}</span>
                        <span className="text-[10px] text-slate-500 block">{order.orderDate}</span>
                        <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          {order.orderChannel || 'Retail'}
                        </span>
                      </td>

                      {/* Items & Category */}
                      <td className="py-2.5 px-2.5 lg:px-3 min-w-[150px] max-w-[240px] xl:max-w-[320px]">
                        <span className="font-medium text-slate-800 line-clamp-1 text-xs" title={order.items}>
                          {order.items}
                        </span>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <span className="text-[10px] text-slate-400">{order.category}</span>
                          {(() => {
                            const r = customerRecs.get(uKey)?.profile?.primaryRecommendation;
                            return r ? (
                              <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-1 rounded-sm inline-flex items-center gap-0.5 max-w-[175px]" title={`Suggested: ${r.productName} at ${currencySymbol}${r.discountedPrice}`}>
                                <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                <span className="truncate">Pair: {r.productName.split('(')[0]?.trim()}</span>
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </td>

                      {/* Amount & Payment Method */}
                      <td className="py-2.5 px-2.5 lg:px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-xs">
                          {currencySymbol} {order.totalAmountBDT.toLocaleString()}
                        </div>
                        <div className="mt-0.5">
                          {order.paymentMethod.includes('bKash') && (
                            <span className="bg-pink-100 text-pink-800 font-bold text-[10px] px-1.5 py-0.5 rounded-sm">
                              {order.paymentMethod}
                            </span>
                          )}
                          {order.paymentMethod.includes('Nagad') && (
                            <span className="bg-orange-100 text-orange-800 font-bold text-[10px] px-1.5 py-0.5 rounded-sm">
                              Nagad
                            </span>
                          )}
                          {order.paymentMethod.includes('COD') && (
                            <span className="bg-amber-100 text-amber-800 font-bold text-[10px] px-1.5 py-0.5 rounded-sm">
                              COD (Cash on Del.)
                            </span>
                          )}
                          {order.paymentMethod.includes('Bank') && (
                            <span className="bg-blue-100 text-blue-800 font-bold text-[10px] px-1.5 py-0.5 rounded-sm">
                              Bank / POS Card
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Advance Paid vs Due */}
                      <td className="py-2.5 px-2.5 lg:px-3 whitespace-nowrap text-[11px]">
                        <div>
                          <span className="text-slate-400">Paid: </span>
                          <strong className="text-emerald-700">{currencySymbol} {order.advancePaidBDT}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400">Due: </span>
                          <strong className={order.dueAmountBDT > 0 ? 'text-amber-800' : 'text-slate-400'}>
                            {currencySymbol} {order.dueAmountBDT}
                          </strong>
                        </div>
                      </td>

                      {/* District & Courier */}
                      <td className="py-2.5 px-2.5 lg:px-3 max-w-[165px]">
                        <div className="text-slate-800 font-medium text-[11px] truncate" title={order.deliveryDistrict}>{order.deliveryDistrict}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate" title={`${order.courierPartner} (${order.trackingNumber})`}>
                            {order.courierPartner} ({order.trackingNumber})
                          </span>
                        </div>
                      </td>

                      {/* Delivery Status */}
                      <td className="py-2.5 px-2.5 lg:px-3 whitespace-nowrap">
                        {order.deliveryStatus === 'Delivered' && (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Delivered</span>
                          </span>
                        )}
                        {order.deliveryStatus === 'In Transit' && (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Truck className="w-3 h-3 shrink-0" />
                            <span>In Transit</span>
                          </span>
                        )}
                        {order.deliveryStatus === 'Pending Confirmation' && (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>Pending</span>
                          </span>
                        )}
                        {order.deliveryStatus === 'RTO / Returned' && (
                          <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full" title={order.customerNotes || 'Parcel returned by courier'}>
                            <RotateCcw className="w-3 h-3 shrink-0" />
                            <span>RTO / Returned</span>
                          </span>
                        )}
                      </td>

                      {/* 1-Click "Anyhow Reach" Action Button & Personalized Offer */}
                      <td className="py-2.5 px-2.5 lg:px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {(() => {
                            const r = customerRecs.get(uKey)?.profile?.primaryRecommendation;
                            return r ? (
                              <button
                                onClick={() => {
                                  setSelectedOrderForChat(order);
                                  setChatTemplate('personalized_offer');
                                  setModalChannel(effChannel);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer"
                                title={`Send personalized offer via ${effChannel.toUpperCase()}: ${r.productName} (${currencySymbol}${r.discountedPrice})`}
                              >
                                <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Offer</span>
                              </button>
                            ) : null;
                          })()}

                          {effChannel === 'whatsapp' && (
                            <button
                              onClick={() => {
                                setSelectedOrderForChat(order);
                                setModalChannel('whatsapp');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Reach customer via WhatsApp with personalized offers & templates"
                            >
                              <MessageSquare className="w-3 h-3 shrink-0" />
                              <span>WhatsApp</span>
                            </button>
                          )}

                          {effChannel === 'sms' && (
                            <button
                              onClick={() => {
                                setSelectedOrderForChat(order);
                                setModalChannel('sms');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title={`POS / Mobile Phone Customer (No WhatsApp/FB) — Send Personalized Offer via Direct Phone SMS (${order.smsPhone || order.whatsappPhone})`}
                            >
                              <Smartphone className="w-3 h-3 shrink-0" />
                              <span>Phone SMS</span>
                            </button>
                          )}

                          {effChannel === 'email' && (
                            <button
                              onClick={() => {
                                setSelectedOrderForChat(order);
                                setModalChannel('email');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title={`Send Personalized Offer via Email (${order.customerEmail})`}
                            >
                              <Mail className="w-3 h-3 shrink-0" />
                              <span>Email</span>
                            </button>
                          )}

                          {effChannel === 'messenger' && (
                            <button
                              onClick={() => {
                                setSelectedOrderForChat(order);
                                setModalChannel('messenger');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              title={`No Phone/Email — Target customer via Facebook Messenger (${order.facebookProfileId || 'm.me/buyer'})`}
                            >
                              <Send className="w-3 h-3 shrink-0" />
                              <span>Messenger</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalFiltered > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Showing{' '}
                <strong className="text-slate-900 font-bold">
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalFiltered)}
                </strong>{' '}
                of <strong className="text-slate-900 font-bold">{totalFiltered}</strong> orders
              </span>
              <span className="text-slate-300 hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1 font-semibold text-slate-700 cursor-pointer"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="px-2 font-bold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1 font-semibold text-slate-700 cursor-pointer"
                aria-label="Next Page"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
      ) : (
        /* Omni-Channel Personalized Product Suggestions & Offers Studio */
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-sm border border-emerald-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Next-Best-Product (NBP) &amp; 4-Channel &ldquo;Anyhow Reach&rdquo; Offer Engine
                </span>
                <h3 className="text-xl font-black text-white tracking-tight">
                  Omni-Channel Personalized Cross-Sell Studio (Phone SMS · Email · WhatsApp · Messenger)
                </h3>
                <p className="text-xs text-emerald-100/90 mt-1 max-w-2xl leading-relaxed">
                  Automatically pairs every customer&apos;s purchase history with high-affinity complementary products, custom promo codes, and ready-to-send offers via <strong>Phone SMS (for POS/offline buyers)</strong>, <strong>Email</strong>, <strong>WhatsApp</strong>, or <strong>Facebook Messenger</strong>.
                </p>
              </div>

              {/* Quick metrics banner */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
                  <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Reachable Shoppers</span>
                  <span className="text-lg font-black text-white">{customerRecs.size} Profiles (100%)</span>
                </div>
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/15">
                  <span className="text-[10px] text-amber-200 block font-semibold uppercase">Potential Basket Uplift</span>
                  <span className="text-lg font-black text-amber-300">
                    {currencySymbol} {Array.from(customerRecs.values()).reduce((sum, c) => sum + (c.profile?.primaryRecommendation?.discountedPrice || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Category Basket Synergy Guide */}
            <div className="mt-5 pt-4 border-t border-emerald-800/80 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wide">
                Top Basket Synergies:
              </span>
              <span className="bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg text-emerald-100 flex items-center gap-1.5">
                <span>👗 Dhakai Jamdani Saree</span>
                <ArrowRight className="w-3 h-3 text-amber-300" />
                <strong className="text-white">Silk Katan Dupatta / Clutch (96%)</strong>
              </span>
              <span className="bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg text-emerald-100 flex items-center gap-1.5">
                <span>👔 Festive Silk Panjabi</span>
                <ArrowRight className="w-3 h-3 text-amber-300" />
                <strong className="text-white">Full Cowhide Leather Wallet (92%)</strong>
              </span>
              <span className="bg-white/10 border border-white/15 px-2.5 py-1 rounded-lg text-emerald-100 flex items-center gap-1.5">
                <span>🍯 Sundarban Honey / Mustard Oil</span>
                <ArrowRight className="w-3 h-3 text-amber-300" />
                <strong className="text-white">Dinajpur Aromatic Rice (94%)</strong>
              </span>
            </div>
          </div>

          {/* Customer Recommendation Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from(customerRecs.entries()).map(([key, entry]) => {
              const rec = entry.profile?.primaryRecommendation;
              if (!rec) return null;
              const firstOrder = entry.orders[0];
              const pref = entry.preferredChannel;

              return (
                <div
                  key={key}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all p-4.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{entry.customerName}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {entry.whatsappPhone && (
                            <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
                              🟢 WA: {entry.whatsappPhone}
                            </span>
                          )}
                          {!entry.whatsappPhone && entry.smsPhone && (
                            <span className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-mono">
                              📱 SMS: {entry.smsPhone}
                            </span>
                          )}
                          {entry.customerEmail && (
                            <span className="text-[10px] text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded font-mono truncate max-w-[165px]" title={entry.customerEmail}>
                              ✉️ {entry.customerEmail}
                            </span>
                          )}
                          {!entry.whatsappPhone && !entry.smsPhone && !entry.customerEmail && entry.facebookProfileId && (
                            <span className="text-[10px] text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded font-mono">
                              🔵 {entry.facebookProfileId}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        {entry.profile.persona.split('(')[0]?.trim()}
                      </span>
                    </div>

                    {/* Past Order Summary */}
                    <div className="text-[11px] bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 space-y-1">
                      <div className="flex justify-between text-slate-500">
                        <span>Past Activity:</span>
                        <strong className="text-slate-800 font-medium">
                          {entry.orders.length} order{entry.orders.length > 1 ? 's' : ''} · {currencySymbol}{entry.totalSpend.toLocaleString()}
                        </strong>
                      </div>
                      <div className="text-slate-600 truncate">
                        <span className="text-slate-400">Bought: </span>
                        <span className="font-medium">{entry.orders[0]?.items}</span>
                      </div>
                    </div>

                    {/* Next-Best Recommendation Card */}
                    <div className="p-3.5 bg-gradient-to-br from-amber-50/70 to-emerald-50/50 border border-amber-200/80 rounded-xl space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>Recommended Companion</span>
                          </span>
                          <h5 className="font-extrabold text-slate-900 text-xs mt-0.5">
                            {rec.productName}
                          </h5>
                          <span className="text-[10px] text-slate-500 block">
                            💡 {rec.recommendationReason}
                          </span>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-sm shrink-0">
                          {rec.affinityScorePct}% Match
                        </span>
                      </div>

                      {/* Pricing & Promo Code */}
                      <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black text-emerald-800 text-sm">
                            {currencySymbol}{rec.discountedPrice.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400 line-through ml-1.5">
                            {currencySymbol}{rec.originalPrice.toLocaleString()}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-300 text-amber-900">
                          {rec.discountCode} (-{rec.discountPct}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Channel Offer Dispatch Buttons */}
                  <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center gap-1.5">
                      {firstOrder && (
                        <button
                          onClick={() => {
                            setSelectedOrderForChat(firstOrder);
                            setChatTemplate('personalized_offer');
                            setModalChannel(pref);
                            setMessageLang('en');
                          }}
                          className={`flex-1 py-2 px-2.5 text-white font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer ${
                            pref === 'sms'
                              ? 'bg-indigo-600 hover:bg-indigo-700'
                              : pref === 'email'
                              ? 'bg-sky-600 hover:bg-sky-700'
                              : pref === 'messenger'
                              ? 'bg-blue-600 hover:bg-blue-700'
                              : 'bg-emerald-600 hover:bg-emerald-700'
                          }`}
                          title="Send personalized offer via customer's best channel"
                        >
                          {pref === 'sms' && <Smartphone className="w-3.5 h-3.5" />}
                          {pref === 'email' && <Mail className="w-3.5 h-3.5" />}
                          {pref === 'messenger' && <Send className="w-3.5 h-3.5" />}
                          {pref === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5" />}
                          <span>
                            {pref === 'sms'
                              ? 'Send via Phone SMS'
                              : pref === 'email'
                              ? 'Send via Email'
                              : pref === 'messenger'
                              ? 'Send via Messenger'
                              : 'Send via WhatsApp'}
                          </span>
                        </button>
                      )}

                      {firstOrder && (
                        <button
                          onClick={() => {
                            setSelectedOrderForChat(firstOrder);
                            setChatTemplate('personalized_offer');
                            setModalChannel(pref);
                            setMessageLang('bn');
                          }}
                          className="p-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                          title="Open in Bangla (বাংলা)"
                        >
                          বাংলা
                        </button>
                      )}
                    </div>

                    {/* Quick Alternative Channel Fallback Row */}
                    {firstOrder && (
                      <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500">
                        <span>Reach Anyhow:</span>
                        <div className="flex items-center gap-1">
                          {(entry.smsPhone || entry.whatsappPhone) && (
                            <button
                              onClick={() => {
                                setSelectedOrderForChat(firstOrder);
                                setChatTemplate('personalized_offer');
                                setModalChannel('sms');
                              }}
                              className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-bold cursor-pointer"
                              title="Send Direct Phone SMS"
                            >
                              📱 SMS
                            </button>
                          )}
                          {entry.customerEmail && (
                            <button
                              onClick={() => {
                                setSelectedOrderForChat(firstOrder);
                                setChatTemplate('personalized_offer');
                                setModalChannel('email');
                              }}
                              className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold cursor-pointer"
                              title="Send Personalized Email"
                            >
                              ✉️ Email
                            </button>
                          )}
                          {(entry.whatsappPhone || entry.smsPhone) && (
                            <button
                              onClick={() => {
                                setSelectedOrderForChat(firstOrder);
                                setChatTemplate('personalized_offer');
                                setModalChannel('whatsapp');
                              }}
                              className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold cursor-pointer"
                              title="Send WhatsApp Message"
                            >
                              🟢 WA
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedOrderForChat(firstOrder);
                              setChatTemplate('personalized_offer');
                              setModalChannel('messenger');
                            }}
                            className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold cursor-pointer"
                            title="Send Facebook Messenger Message"
                          >
                            🔵 FB
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Universal 4-Channel Message Preview & Dispatch Modal (WhatsApp · Phone SMS · Email · Messenger) */}
      {selectedOrderForChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            {(() => {
              const headerColors: Record<typeof modalChannel, string> = {
                whatsapp: 'bg-gradient-to-r from-emerald-800 to-teal-900',
                sms: 'bg-gradient-to-r from-indigo-800 to-violet-900',
                email: 'bg-gradient-to-r from-sky-800 to-cyan-900',
                messenger: 'bg-gradient-to-r from-blue-700 to-indigo-800',
              };
              const headerTitles: Record<typeof modalChannel, string> = {
                whatsapp: 'WhatsApp Direct Dispatch',
                sms: 'Direct Phone SMS Dispatch (POS / Mobile)',
                email: 'Personalized Email Campaign Dispatch',
                messenger: 'Facebook Messenger Dispatch',
              };
              const targetContact =
                modalChannel === 'sms'
                  ? (selectedOrderForChat.smsPhone || selectedOrderForChat.whatsappPhone || '+8801700000000')
                  : modalChannel === 'email'
                  ? (selectedOrderForChat.customerEmail || `${selectedOrderForChat.customerName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@gmail.com`)
                  : modalChannel === 'messenger'
                  ? (selectedOrderForChat.facebookProfileId || 'm.me/buyer')
                  : (selectedOrderForChat.whatsappPhone || selectedOrderForChat.smsPhone || '+8801700000000');

              return (
                <div className={`px-6 py-4 text-white space-y-3 ${headerColors[modalChannel]}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white/15">
                        {modalChannel === 'whatsapp' && <MessageSquare className="w-5 h-5 text-emerald-200" />}
                        {modalChannel === 'sms' && <Smartphone className="w-5 h-5 text-indigo-200" />}
                        {modalChannel === 'email' && <Mail className="w-5 h-5 text-sky-200" />}
                        {modalChannel === 'messenger' && <Send className="w-5 h-5 text-blue-200" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">
                            {headerTitles[modalChannel]}
                          </h3>
                        </div>
                        <p className="text-xs text-white/85 mt-0.5 font-mono">
                          Recipient: {selectedOrderForChat.customerName} ({targetContact})
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedOrderForChat(null)}
                      className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 4-Channel Switcher Bar inside Modal ("Anyhow Reach Them") */}
                  <div className="pt-2 border-t border-white/15 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                      Switch Reach Channel:
                    </span>
                    <div className="bg-black/25 p-1 rounded-xl flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setModalChannel('whatsapp')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                          modalChannel === 'whatsapp' ? 'bg-white text-emerald-900 shadow-2xs' : 'text-white/85 hover:text-white'
                        }`}
                      >
                        🟢 WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalChannel('sms')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                          modalChannel === 'sms' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-white/85 hover:text-white'
                        }`}
                      >
                        📱 Phone SMS
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalChannel('email')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                          modalChannel === 'email' ? 'bg-white text-sky-900 shadow-2xs' : 'text-white/85 hover:text-white'
                        }`}
                      >
                        ✉️ Email
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalChannel('messenger')}
                        className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${
                          modalChannel === 'messenger' ? 'bg-white text-blue-900 shadow-2xs' : 'text-white/85 hover:text-white'
                        }`}
                      >
                        🔵 Messenger
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    Select Pre-filled Message Template
                  </label>
                  {/* Language Switcher */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    <button
                      onClick={() => setMessageLang('en')}
                      className={`px-2.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        messageLang === 'en'
                          ? 'bg-white text-emerald-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setMessageLang('bn')}
                      className={`px-2.5 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        messageLang === 'bn'
                          ? 'bg-white text-emerald-800 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      BN (Bangla)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setChatTemplate('personalized_offer')}
                    className={`col-span-2 p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      chatTemplate === 'personalized_offer'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block font-bold flex items-center gap-1.5 text-emerald-800">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>✨ Personalized Offer &amp; Next-Best Product Pitch</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {messageLang === 'bn' ? 'আগের ক্রয়ের ভিত্তিতে সাজেস্টেড আইটেম ও স্পেশাল ছাড়' : 'Next-best complementary cross-sell pitch with custom discount code'}
                    </span>
                  </button>

                  <button
                    onClick={() => setChatTemplate('order_confirm')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      chatTemplate === 'order_confirm'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">📦 Order Confirmation</span>
                    <span className="text-[10px] text-slate-500">
                      {messageLang === 'bn' ? 'অর্ডার কনফার্মেশন ও bKash রিকোয়েস্ট' : 'Order receipt & confirmation'}
                    </span>
                  </button>

                  <button
                    onClick={() => setChatTemplate('courier_dispatch')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      chatTemplate === 'courier_dispatch'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">🚚 Courier Dispatched</span>
                    <span className="text-[10px] text-slate-500">
                      {messageLang === 'bn' ? 'কুরিয়ার বুকিং ও ট্র্যাকিং কোড' : 'Tracking ID & payable COD'}
                    </span>
                  </button>

                  <button
                    onClick={() => setChatTemplate('eid_offer')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      chatTemplate === 'eid_offer'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">🎁 VIP Loyalist Offer</span>
                    <span className="text-[10px] text-slate-500">
                      {messageLang === 'bn' ? 'স্পেশাল লয়ালটি ভাউচার' : '15% repeat buyer discount'}
                    </span>
                  </button>

                  <button
                    onClick={() => setChatTemplate('review_request')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                      chatTemplate === 'review_request'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block font-bold">💬 Review &amp; Feedback</span>
                    <span className="text-[10px] text-slate-500">
                      {messageLang === 'bn' ? 'ডেলিভারি রিভিউ ও ছবি' : 'Post-purchase rating'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Message Box */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Message Preview ({messageLang === 'en' ? 'English' : 'বাংলা'})
                  </label>
                  <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    Merge tags auto-filled
                  </span>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-sans">
                  {(() => {
                    const cKey = getCustomerUnifiedKey(selectedOrderForChat);
                    const r = customerRecs.get(cKey)?.profile?.primaryRecommendation;

                    if (chatTemplate === 'personalized_offer' && r) {
                      return messageLang === 'en' ? r.pitchSnippetEn : r.pitchSnippetBn;
                    }

                    if (messageLang === 'en') {
                      if (chatTemplate === 'order_confirm') {
                        return (
                          <>
                            Hello {selectedOrderForChat.customerName}! 🌸
                            {'\n\n'}Thank you for shopping with us. Your order details:
                            {'\n'}📦 Items: {selectedOrderForChat.items}
                            {'\n'}💰 Total Amount: Tk {selectedOrderForChat.totalAmountBDT}
                            {'\n'}💳 Advance Received: Tk {selectedOrderForChat.advancePaidBDT}
                            {'\n'}💵 Due on Delivery (COD): Tk {selectedOrderForChat.dueAmountBDT}
                            {'\n\n'}Please reply to confirm your delivery address ({selectedOrderForChat.deliveryDistrict}) and phone number. Thank you! ✨
                          </>
                        );
                      }
                      if (chatTemplate === 'courier_dispatch') {
                        return (
                          <>
                            Dear {selectedOrderForChat.customerName}, 🚚
                            {'\n\n'}Your parcel has been dispatched via {selectedOrderForChat.courierPartner}!
                            {'\n'}📍 Consignment / Tracking ID: {selectedOrderForChat.trackingNumber}
                            {'\n'}💵 Payable on Delivery (COD): Tk {selectedOrderForChat.dueAmountBDT}
                            {'\n\n'}The delivery rider will contact you within 24-48 hours. Feel free to reach out if you need any assistance! 🛍️
                          </>
                        );
                      }
                      if (chatTemplate === 'eid_offer') {
                        return (
                          <>
                            Hello {selectedOrderForChat.customerName}! 🌟
                            {'\n\n'}As a valued VIP customer of our store, enjoy an exclusive 15% discount on our new collection!
                            {'\n'}🎁 Promo Code: EIDVIP15
                            {'\n\n'}Visit our store or reply to redeem your voucher before stock runs out! 🌙✨
                          </>
                        );
                      }
                      if (chatTemplate === 'review_request') {
                        return (
                          <>
                            Hi {selectedOrderForChat.customerName}! 😊
                            {'\n\n'}We hope you received your purchase ({selectedOrderForChat.items}) and love it!
                            {'\n\n'}Could you share a brief review or photo with us? Your feedback means the world to our store! ❤️
                          </>
                        );
                      }
                    } else {
                      if (chatTemplate === 'order_confirm') {
                        return (
                          <>
                            আসসালামু আলাইকুম {selectedOrderForChat.customerName}! 🌸
                            {'\n\n'}আমাদের শপ থেকে আপনার অর্ডারটি রিসিভ করা হয়েছে:
                            {'\n'}📦 প্রোডাক্ট: {selectedOrderForChat.items}
                            {'\n'}💰 মোট মূল্য: Tk {selectedOrderForChat.totalAmountBDT}
                            {'\n'}💳 অ্যাডভান্স পেমেন্ট: Tk {selectedOrderForChat.advancePaidBDT}
                            {'\n'}💵 ক্যাশ অন ডেলিভারি বাকি: Tk {selectedOrderForChat.dueAmountBDT}
                            {'\n\n'}আপনার ঠিকানা ({selectedOrderForChat.deliveryDistrict}) এবং ফোন নম্বর নিশ্চিত করতে দয়া করে এই মেসেজের উত্তর দিন। ধন্যবাদ! ✨
                          </>
                        );
                      }
                      if (chatTemplate === 'courier_dispatch') {
                        return (
                          <>
                            প্রিয় {selectedOrderForChat.customerName}, 🚚
                            {'\n\n'}আপনার পার্সেলটি সফলভাবে {selectedOrderForChat.courierPartner} এ বুক করা হয়েছে!
                            {'\n'}📍 ট্র্যাকিং নাম্বার: {selectedOrderForChat.trackingNumber}
                            {'\n'}💵 বাকি অ্যামাউন্ট (COD): Tk {selectedOrderForChat.dueAmountBDT}
                            {'\n\n'}আগামী ২৪-৪৮ ঘণ্টার মধ্যে ডেলিভারি রাইডার আপনার সাথে যোগাযোগ করবেন। যেকোনো প্রয়োজনে আমাদের জানান। ধন্যবাদ! 🛍️
                          </>
                        );
                      }
                      if (chatTemplate === 'eid_offer') {
                        return (
                          <>
                            আসসালামু আলাইকুম {selectedOrderForChat.customerName}! 🌟
                            {'\n\n'}আমাদের প্রিয় লয়াল কাস্টমার হিসেবে আপনার জন্য নতুন কালেকশনে স্পেশাল ১৫% ছাড় ভাউচার!
                            {'\n'}🎁 ডিসকাউন্ট কোড: EIDVIP15
                            {'\n\n'}আমাদের শপ ও ক্যাটালগ দেখতে বা অর্ডার করতে এখনই আমাদের জানান। অফারটি সীমিত সময়ের জন্য! 🌙✨
                          </>
                        );
                      }
                      if (chatTemplate === 'review_request') {
                        return (
                          <>
                            হ্যালো {selectedOrderForChat.customerName}! 😊
                            {'\n\n'}আশা করি আপনার পার্সেলটি ({selectedOrderForChat.items}) হাতে পেয়েছেন এবং ভালো লেগেছে! 🎁
                            {'\n\n'}আমাদের প্রডাক্ট এবং সার্ভিস সম্পর্কে আপনার মূল্যবান রিভিউ বা ছবি শেয়ার করলে আমরা অত্যন্ত কৃতজ্ঞ থাকবো! ❤️
                          </>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-between gap-3">
                {(() => {
                  const cKey = getCustomerUnifiedKey(selectedOrderForChat);
                  const r = customerRecs.get(cKey)?.profile?.primaryRecommendation;
                  const customText = chatTemplate === 'personalized_offer' && r
                    ? (messageLang === 'en' ? r.pitchSnippetEn : r.pitchSnippetBn)
                    : undefined;

                  const dispatchInfo = buildFCommerceDispatchUrl(
                    selectedOrderForChat,
                    chatTemplate,
                    {
                      customerName: selectedOrderForChat.customerName,
                      items: selectedOrderForChat.items,
                      totalAmountBDT: selectedOrderForChat.totalAmountBDT,
                      advancePaidBDT: selectedOrderForChat.advancePaidBDT,
                      dueAmountBDT: selectedOrderForChat.dueAmountBDT,
                      trackingNumber: selectedOrderForChat.trackingNumber,
                      courierPartner: selectedOrderForChat.courierPartner,
                      promoCode: r?.discountCode || 'EIDVIP15',
                      discountPct: r?.discountPct || 15,
                      suggestedProduct: r?.productName,
                      discountedPrice: r?.discountedPrice,
                      customMessage: customText,
                      lang: messageLang,
                    },
                    modalChannel
                  );

                  const url = dispatchInfo.url;

                  return (
                    <>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="px-3 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                        <span>
                          {copiedLink
                            ? 'Copied!'
                            : modalChannel === 'sms'
                            ? 'Copy SMS Link'
                            : modalChannel === 'email'
                            ? 'Copy mailto Link'
                            : modalChannel === 'messenger'
                            ? 'Copy m.me Link'
                            : 'Copy wa.me Link'}
                        </span>
                      </button>

                      <a
                        href={url}
                        target={modalChannel === 'sms' || modalChannel === 'email' ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className={`px-4 py-2 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                          modalChannel === 'sms'
                            ? 'bg-indigo-600 hover:bg-indigo-500'
                            : modalChannel === 'email'
                            ? 'bg-sky-600 hover:bg-sky-500'
                            : modalChannel === 'messenger'
                            ? 'bg-blue-600 hover:bg-blue-500'
                            : 'bg-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        {modalChannel === 'sms' && <Smartphone className="w-4 h-4" />}
                        {modalChannel === 'email' && <Mail className="w-4 h-4" />}
                        {modalChannel === 'messenger' && <Send className="w-4 h-4" />}
                        {modalChannel === 'whatsapp' && <MessageSquare className="w-4 h-4" />}
                        <span>
                          {modalChannel === 'sms'
                            ? 'Send Direct Phone SMS Offer'
                            : modalChannel === 'email'
                            ? 'Send Personalized Email Offer'
                            : modalChannel === 'messenger'
                            ? 'Launch Facebook Messenger (m.me)'
                            : 'Launch WhatsApp Web / App'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-white/80" />
                      </a>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

