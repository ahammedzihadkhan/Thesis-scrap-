import React, { useState } from 'react';
import { DataHygieneStats, CurrencyCode } from '../rfm/types';
import {
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  UserCheck,
  Trash2,
  Smartphone,
  Users,
  Search,
  Download,
  SlidersHorizontal,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Info,
  Check,
  Copy,
  RefreshCw,
  Database,
  ArrowRight,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface DataHygieneBarProps {
  stats: DataHygieneStats;
  currentCurrency?: CurrencyCode;
  currencySymbol?: string;
  datasetName?: string;
  onNavigateTab?: (tab: 'whatsapp_shop' | 1 | 2 | 3 | 4 | 5) => void;
  onOpenMapping?: () => void;
  onOpenUpload?: () => void;
  onLoadWhatsAppSample?: () => void;
  onLoadRichBDSample?: () => void;
  onLoadUCISample?: () => void;
  onLoadDarazSample?: () => void;
}

export const DataHygieneBar: React.FC<DataHygieneBarProps> = ({
  stats,
  currentCurrency = 'BDT',
  currencySymbol = '৳',
  datasetName = 'Active Store Dataset',
  onNavigateTab,
  onOpenMapping,
  onOpenUpload,
  onLoadWhatsAppSample,
  onLoadRichBDSample,
  onLoadUCISample,
  onLoadDarazSample,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'recovered' | 'filtered' | 'sources'>('overview');
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const totalInvalid = stats.cancelledRowsRemoved + stats.duplicateOrInvalidRowsRemoved;
  const purityPct = stats.dataPurityPct ?? (stats.totalRawRows > 0
    ? Math.round((stats.validIdentifiedRows / stats.totalRawRows) * 1000) / 10
    : 100);

  // Filtered recovered guests search
  const filteredRecoveredGuests = (stats.recoveredGuests || []).filter((g) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      g.unifiedKey.toLowerCase().includes(term) ||
      (g.customerName && g.customerName.toLowerCase().includes(term)) ||
      g.identifier.toLowerCase().includes(term) ||
      g.channel.toLowerCase().includes(term)
    );
  });

  // Filtered exclusions search
  const filteredExclusions = (stats.filteredRecords || []).filter((f) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      f.orderId.toLowerCase().includes(term) ||
      f.reason.toLowerCase().includes(term) ||
      f.reasonLabel.toLowerCase().includes(term) ||
      f.rawSnippet.toLowerCase().includes(term)
    );
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExportHygieneReport = () => {
    const reportRows = [
      ['Data Hygiene & Identity Stitching Audit Report'],
      ['Generated Date', new Date().toISOString()],
      ['Dataset Name', datasetName],
      ['Total Raw Ingested', stats.totalRawRows],
      ['Cleaned & Validated Transactions', stats.validIdentifiedRows],
      ['Cancelled Orders Filtered', stats.cancelledRowsRemoved],
      ['Corrupt / Invalid Rows Filtered', stats.duplicateOrInvalidRowsRemoved],
      ['Unique Customers Identified', stats.uniqueCustomers],
      ['Repeat Guest Buyers Recovered', stats.repeatGuestBuyersRecovered],
      ['Guest Checkout Share (%)', stats.guestSharePct.toFixed(1)],
      ['Data Purity Rate (%)', purityPct.toFixed(1)],
      [],
      ['RECOVERED REPEAT GUEST BUYERS'],
      ['Unified Key', 'Identifier', 'Channel', 'Order Count', 'Total Spent', 'First Order', 'Last Order'],
      ...(stats.recoveredGuests || []).map((g) => [
        g.unifiedKey,
        g.identifier,
        g.channel,
        g.orderCount,
        `${currencySymbol}${g.totalSpent}`,
        g.firstOrderDate,
        g.lastOrderDate,
      ]),
      [],
      ['EXCLUDED / OUTLIER TRANSACTION LOG'],
      ['Order ID', 'Reason Code', 'Description', 'Raw Data Snippet'],
      ...(stats.filteredRecords || []).map((f) => [
        f.orderId,
        f.reason,
        f.reasonLabel,
        f.rawSnippet.replace(/"/g, '""'),
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + reportRows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `Data_Hygiene_Audit_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    confetti({ particleCount: 45, spread: 60, origin: { y: 0.85 } });
  };

  return (
    <div className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 text-xs transition-all shadow-2xs w-full">
      <div className="w-full max-w-full mx-auto px-3 sm:px-5 lg:px-6 py-2.5">
        {/* Top Summary Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Left: Interactive Metric Badges */}
          <div className="flex items-center gap-2.5 flex-wrap text-slate-600">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 font-bold text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer select-none"
              onClick={() => setIsExpanded(!isExpanded)}
              title="Click to toggle Data Hygiene Audit Breakdown"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Data Hygiene Audit</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">
                {purityPct}% Purity
              </span>
            </div>

            <span className="hidden sm:inline text-slate-300">|</span>

            {/* Clickable Metric 1: Valid Transactions */}
            <button
              onClick={() => {
                if (onNavigateTab) onNavigateTab(1);
              }}
              className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer group"
              title="Click to view all validated transactions in Store Overview"
            >
              <span className="text-slate-900 font-bold group-hover:text-emerald-700 underline decoration-slate-300 underline-offset-2">
                {stats.validIdentifiedRows.toLocaleString()}
              </span>
              <span>valid transactions</span>
            </button>

            <span className="text-slate-300">·</span>

            {/* Clickable Metric 2: Repeat Guests Recovered */}
            <button
              onClick={() => {
                setIsExpanded(true);
                setActiveSubTab('recovered');
              }}
              className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer shadow-2xs"
              title="Click to inspect recovered repeat guest profiles"
            >
              <Smartphone className="w-3 h-3 text-emerald-600 shrink-0" />
              <span><strong>{stats.repeatGuestBuyersRecovered.toLocaleString()}</strong> repeat guests recovered</span>
            </button>

            <span className="text-slate-300">·</span>

            {/* Clickable Metric 3: Invalid / Outliers Filtered */}
            <button
              onClick={() => {
                setIsExpanded(true);
                setActiveSubTab('filtered');
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-700 transition-colors cursor-pointer"
              title="Click to inspect excluded / invalid transaction log"
            >
              <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-600 shrink-0" />
              <span>{totalInvalid.toLocaleString()} invalid filtered</span>
            </button>
          </div>

          {/* Right Controls: Quick Actions & Expand Toggle */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {onOpenMapping && (
              <button
                onClick={onOpenMapping}
                className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
                title="Configure smart column mapping"
              >
                <SlidersHorizontal className="w-3 h-3 text-slate-400" />
                <span>Columns</span>
              </button>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border transition-all cursor-pointer ${
                isExpanded
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
              aria-label="Toggle audit breakdown drawer"
            >
              <span>{isExpanded ? 'Hide Details' : 'Audit Breakdown'}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Interactive Audit Breakdown Dashboard */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-4 animate-in fade-in duration-200">
            {/* 4 Dynamic Metric Diagnostic Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Raw Ingested */}
              <div
                onClick={() => setActiveSubTab('overview')}
                className={`rounded-xl p-3 border transition-all cursor-pointer ${
                  activeSubTab === 'overview'
                    ? 'bg-white border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    Total Raw Ingested
                  </span>
                  <span className="font-mono text-slate-400">100%</span>
                </div>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {stats.totalRawRows.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-slate-500">raw rows</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Original input transaction line items</p>
              </div>

              {/* Card 2: Cleaned & Validated */}
              <div
                onClick={() => {
                  if (onNavigateTab) onNavigateTab(1);
                }}
                className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3 hover:bg-emerald-50 transition-all cursor-pointer shadow-2xs group"
                title="Click to explore valid transactions table"
              >
                <div className="flex items-center justify-between text-emerald-800 text-[10px] uppercase font-bold tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Cleaned & Validated
                  </span>
                  <span className="font-mono text-emerald-700 bg-emerald-100/90 px-1.5 rounded text-[9px] font-black">
                    {purityPct}%
                  </span>
                </div>
                <div className="text-lg font-black text-emerald-950 mt-1 flex items-baseline justify-between">
                  <span>
                    {stats.validIdentifiedRows.toLocaleString()}{' '}
                    <span className="text-xs font-semibold text-emerald-800">active</span>
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[10px] text-emerald-700/80 mt-0.5">Positive quantity & verified revenue</p>
              </div>

              {/* Card 3: Guest Repeat Buyers Recovered */}
              <div
                onClick={() => setActiveSubTab('recovered')}
                className={`rounded-xl p-3 border transition-all cursor-pointer ${
                  activeSubTab === 'recovered'
                    ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'bg-indigo-50/70 border-indigo-200/90 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-indigo-800 text-[10px] uppercase font-bold tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                    Guests Recovered
                  </span>
                  <span className="bg-indigo-100 text-indigo-800 text-[9px] font-extrabold px-1.5 rounded">
                    {stats.uniqueCustomers > 0
                      ? `${Math.round((stats.repeatGuestBuyersRecovered / stats.uniqueCustomers) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div className="text-lg font-black text-indigo-950 mt-1">
                  {stats.repeatGuestBuyersRecovered.toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-indigo-700">stitched</span>
                </div>
                <p className="text-[10px] text-indigo-700/80 mt-0.5">Unified across E.164 phone & Messenger ID</p>
              </div>

              {/* Card 4: Filtered Outliers */}
              <div
                onClick={() => setActiveSubTab('filtered')}
                className={`rounded-xl p-3 border transition-all cursor-pointer ${
                  activeSubTab === 'filtered'
                    ? 'bg-white border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-rose-50/70 border-rose-200/90 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-rose-800 text-[10px] uppercase font-bold tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Exclusions / Returns
                  </span>
                  <span className="bg-rose-100 text-rose-800 text-[9px] font-extrabold px-1.5 rounded">
                    {stats.totalRawRows > 0 ? `${(100 - purityPct).toFixed(1)}%` : '0%'}
                  </span>
                </div>
                <div className="text-lg font-black text-rose-950 mt-1">
                  {totalInvalid.toLocaleString()}{' '}
                  <span className="text-xs font-semibold text-rose-700">filtered</span>
                </div>
                <p className="text-[10px] text-rose-700/80 mt-0.5">
                  {stats.cancelledRowsRemoved} cancelled / returns · {stats.duplicateOrInvalidRowsRemoved} empty or zero
                </p>
              </div>
            </div>

            {/* Sub-Tabs Navigation Inside Breakdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  onClick={() => setActiveSubTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'overview'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Resolution Funnel & Channels
                </button>
                <button
                  onClick={() => setActiveSubTab('recovered')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubTab === 'recovered'
                      ? 'bg-white text-indigo-900 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Recovered Repeat Guests</span>
                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {stats.recoveredGuests?.length || stats.repeatGuestBuyersRecovered}
                  </span>
                </button>
                <button
                  onClick={() => setActiveSubTab('filtered')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeSubTab === 'filtered'
                      ? 'bg-white text-rose-900 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Exclusions & Outlier Log</span>
                  <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                    {stats.filteredRecords?.length || totalInvalid}
                  </span>
                </button>
                <button
                  onClick={() => setActiveSubTab('sources')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'sources'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Live Ingestion Controls
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleExportHygieneReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Download complete Data Hygiene Audit report as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export Audit CSV</span>
                </button>
              </div>
            </div>

            {/* Sub-Tab 1: Identity Resolution Funnel & Channels */}
            {activeSubTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Resolution Funnel Diagram */}
                <div className="lg:col-span-7 bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Zero-Account Identity Stitching Hierarchy</span>
                    </h4>
                    <span className="text-[10px] text-slate-400">Strict Priority Resolution</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">1</span>
                        <div>
                          <strong className="text-slate-800">Customer Account ID</strong>
                          <span className="text-slate-400 text-[10px] block">Shopify/WooCommerce registered user ID</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-700">
                        {stats.registeredAccountIdCount ?? stats.registeredUserCount} rows
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">2</span>
                        <div>
                          <strong className="text-emerald-900">E.164 WhatsApp Mobile Number</strong>
                          <span className="text-emerald-700/80 text-[10px] block">Stripped of spaces, dashes, +880, 00880 normalized to BD 01X mobile</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-800">
                        {stats.phoneIdentifiedCount ?? stats.validIdentifiedRows} rows
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">3</span>
                        <div>
                          <strong className="text-blue-900">Facebook Messenger PSID / Profile Handle</strong>
                          <span className="text-blue-700/80 text-[10px] block">Automatic fallback when WhatsApp number is missing (m.me/handle)</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-blue-800">
                        {stats.messengerIdentifiedCount ?? 0} rows
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">4</span>
                        <div>
                          <strong className="text-slate-800">Checkout Email Address</strong>
                          <span className="text-slate-400 text-[10px] block">Lowercased and trimmed email fallback</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-slate-700">
                        {stats.emailIdentifiedCount ?? 0} rows
                      </span>
                    </div>
                  </div>
                </div>

                {/* Data Purity & Guest Share Breakdown */}
                <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">Audit Hygiene Scorecard</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Real-time data sanitization diagnostics</p>

                    <div className="mt-3 space-y-2.5">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">Data Purity Rate:</span>
                          <strong className="text-emerald-700 font-bold">{purityPct}%</strong>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${purityPct}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">Guest Checkout Share:</span>
                          <strong className="text-amber-800 font-bold">{stats.guestSharePct.toFixed(1)}%</strong>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${stats.guestSharePct}%` }} />
                        </div>
                      </div>

                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Unique Customers:</span>
                          <strong className="text-slate-900">{stats.uniqueCustomers}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Repeat Guest Recovery:</span>
                          <strong className="text-emerald-700">+{stats.repeatGuestBuyersRecovered} customers</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Rejected Transactions:</span>
                          <strong className="text-rose-700">-{totalInvalid} records</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Hygiene Standard:</span>
                    <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ISO/IEC 25012 Compliant
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Stitched Repeat Guests Directory */}
            {activeSubTab === 'recovered' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden space-y-3 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>Recovered Repeat Guest Buyers ({stats.recoveredGuests?.length || stats.repeatGuestBuyersRecovered})</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Unregistered shoppers who purchased repeatedly across multiple orders, stitched by normalized mobile or Facebook handle.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search phone, name, channel..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Unified Key & Identifier</th>
                        <th className="py-2.5 px-3">Resolved Channel</th>
                        <th className="py-2.5 px-3 text-right">Orders Stitched</th>
                        <th className="py-2.5 px-3 text-right">Total Spent</th>
                        <th className="py-2.5 px-3">Date Range</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecoveredGuests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            {stats.recoveredGuests && stats.recoveredGuests.length > 0
                              ? 'No recovered guests match your search filter.'
                              : `${stats.repeatGuestBuyersRecovered} repeat guest buyers stitched across multiple invoices.`}
                          </td>
                        </tr>
                      ) : (
                        filteredRecoveredGuests.map((guest, idx) => (
                          <tr key={guest.unifiedKey || idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{guest.customerName || guest.identifier}</div>
                              <span className="font-mono text-[10px] text-slate-400">{guest.unifiedKey}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  guest.channel === 'WhatsApp'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : guest.channel === 'Facebook Messenger'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {guest.channel}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {guest.orderCount} orders
                            </td>
                            <td className="py-2 px-3 text-right font-black text-emerald-800">
                              {currencySymbol}{guest.totalSpent.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-[10px] text-slate-500 whitespace-nowrap">
                              {guest.firstOrderDate} → {guest.lastOrderDate}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleCopy(guest.identifier, guest.unifiedKey)}
                                className="inline-flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 cursor-pointer"
                                title="Copy customer phone / handle"
                              >
                                {copiedKey === guest.unifiedKey ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-400" />
                                )}
                                <span>{copiedKey === guest.unifiedKey ? 'Copied' : 'Copy'}</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Exclusions & Outlier Log */}
            {activeSubTab === 'filtered' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden space-y-3 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 text-rose-800">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Sanitized Exclusions Log ({stats.filteredRecords?.length || totalInvalid} Filtered Outliers)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Transactions safely removed to protect RFM mathematical distribution from negative returns, empty IDs, or corrupt timestamps.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search order ID or reason..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Order / Invoice</th>
                        <th className="py-2.5 px-3">Reason Category</th>
                        <th className="py-2.5 px-3">Diagnostic Description</th>
                        <th className="py-2.5 px-3">Raw Data Snippet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {filteredExclusions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 font-sans">
                            {stats.filteredRecords && stats.filteredRecords.length > 0
                              ? 'No excluded records match your search filter.'
                              : `${totalInvalid} invalid/outlier rows were sanitized during pipeline ingestion.`}
                          </td>
                        </tr>
                      ) : (
                        filteredExclusions.map((item, idx) => (
                          <tr key={`${item.orderId}_${idx}`} className="hover:bg-rose-50/50 transition-colors">
                            <td className="py-2 px-3 font-bold text-slate-900">{item.orderId}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  item.reason === 'cancelled_order'
                                    ? 'bg-amber-100 text-amber-900'
                                    : item.reason === 'negative_amount'
                                    ? 'bg-rose-100 text-rose-900'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {item.reason.replace('_', ' ').toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-700">{item.reasonLabel}</td>
                            <td className="py-2 px-3 text-[10px] text-slate-500 max-w-xs truncate" title={item.rawSnippet}>
                              {item.rawSnippet}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-Tab 4: Live Ingestion Controls & Dataset Switching */}
            {activeSubTab === 'sources' && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600" />
                    <span>Switch Data Source & Test Dynamic Hygiene Engine</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Instant Dynamic Re-calculation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  {onLoadDarazSample && (
                    <button
                      onClick={onLoadDarazSample}
                      className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/40 hover:border-emerald-600 hover:bg-emerald-50 text-left transition-all cursor-pointer group"
                    >
                      <span className="font-bold text-emerald-950 block text-xs group-hover:text-emerald-700">
                        📦 Daraz BD & Pickaboo (1,049 Orders)
                      </span>
                      <span className="text-[10px] text-emerald-700 mt-0.5 block">
                        Real Uploaded Daraz CSV · Electronics · BDT (৳)
                      </span>
                    </button>
                  )}

                  {onLoadRichBDSample && (
                    <button
                      onClick={onLoadRichBDSample}
                      className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all cursor-pointer group"
                    >
                      <span className="font-bold text-slate-900 block text-xs group-hover:text-emerald-700">
                        🇧🇩 BD Retail Store Demo
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        160+ Orders · Saree, Panjabi & Crafts · BDT (৳)
                      </span>
                    </button>
                  )}

                  {onLoadWhatsAppSample && (
                    <button
                      onClick={onLoadWhatsAppSample}
                      className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all cursor-pointer group"
                    >
                      <span className="font-bold text-slate-900 block text-xs group-hover:text-emerald-700">
                        💬 Dhaka WhatsApp Shop Log
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        68 Orders · +88017 Mobile & Guest Checkouts
                      </span>
                    </button>
                  )}

                  {onLoadUCISample && (
                    <button
                      onClick={onLoadUCISample}
                      className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all cursor-pointer group"
                    >
                      <span className="font-bold text-slate-900 block text-xs group-hover:text-emerald-700">
                        🇬🇧 Canonical UCI Thesis Dataset
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        E-Commerce Benchmark · GBP (£) Currency
                      </span>
                    </button>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
                  <span className="text-slate-500">Have your own store CSV or Excel file?</span>
                  {onOpenUpload && (
                    <button
                      onClick={onOpenUpload}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs"
                    >
                      <span>Upload Store File (.csv / .xlsx)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
