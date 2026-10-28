import React, { useState, useMemo } from 'react';
import { CleanedTransaction, CustomerRFMTD, DataHygieneStats } from '../rfm/types';
import {
  TrendingUp,
  Users,
  DollarSign,
  ShoppingBag,
  Percent,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
} from 'lucide-react';

interface Tab1StoreOverviewProps {
  cleanedRows: CleanedTransaction[];
  customers: CustomerRFMTD[];
  hygieneStats: DataHygieneStats;
  currencySymbol: string;
}

export const Tab1StoreOverview: React.FC<Tab1StoreOverviewProps> = ({
  cleanedRows,
  customers,
  hygieneStats,
  currencySymbol,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 8;

  // KPI calculations
  const totalRevenue = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.monetary, 0);
  }, [customers]);

  const uniqueCustomersCount = customers.length;

  const singlePurchaseCount = useMemo(() => {
    return customers.filter((c) => c.frequency === 1).length;
  }, [customers]);

  const singlePurchaseSharePct = uniqueCustomersCount > 0
    ? (singlePurchaseCount / uniqueCustomersCount) * 100
    : 0;

  const totalOrders = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.frequency, 0);
  }, [customers]);

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Top 10% Pareto Revenue Share
  const top10RevenueShare = useMemo(() => {
    if (customers.length === 0) return 0;
    const sorted = [...customers].sort((a, b) => b.monetary - a.monetary);
    const top10Count = Math.max(1, Math.ceil(sorted.length * 0.1));
    const top10Sum = sorted.slice(0, top10Count).reduce((sum, c) => sum + c.monetary, 0);
    return totalRevenue > 0 ? (top10Sum / totalRevenue) * 100 : 0;
  }, [customers, totalRevenue]);

  // Monthly Revenue Trend
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; orders: Set<string> }>();
    for (const r of cleanedRows) {
      const monthKey = r.dateStr.slice(0, 7); // YYYY-MM
      if (!map.has(monthKey)) {
        map.set(monthKey, { month: monthKey, revenue: 0, orders: new Set() });
      }
      const entry = map.get(monthKey)!;
      entry.revenue += r.totalAmount;
      entry.orders.add(r.orderId);
    }
    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({
        month: m.month,
        revenue: Math.round(m.revenue),
        orderCount: m.orders.size,
      }));
  }, [cleanedRows]);

  const maxMonthRev = Math.max(1, ...monthlyData.map((m) => m.revenue));

  // Filtered rows for data table preview
  const filteredRows = useMemo(() => {
    if (!searchTerm) return cleanedRows;
    const term = searchTerm.toLowerCase();
    return cleanedRows.filter(
      (r) =>
        r.orderId.toLowerCase().includes(term) ||
        r.unifiedKey.toLowerCase().includes(term) ||
        (r.customerName && r.customerName.toLowerCase().includes(term)) ||
        (r.phone && r.phone.includes(term)) ||
        (r.messengerId && r.messengerId.toLowerCase().includes(term)) ||
        (r.email && r.email.toLowerCase().includes(term)) ||
        r.sku.toLowerCase().includes(term)
    );
  }, [cleanedRows, searchTerm]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div className="space-y-6">
      {/* 5 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Revenue */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Revenue</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {currencySymbol}{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" /> {totalOrders.toLocaleString()} verified orders
          </span>
        </div>

        {/* Unique Customers */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unique Customers</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {uniqueCustomersCount.toLocaleString()}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Stitched from phone, email & accounts
          </span>
        </div>

        {/* Single-Purchase Guest Share */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Single-Purchase Guests</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <ShoppingBag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {singlePurchaseSharePct.toFixed(1)}%
          </div>
          <span className="text-[11px] text-amber-700 font-medium mt-1 block">
            {singlePurchaseCount} single-order buyers (F = 1)
          </span>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Average Order Value</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {currencySymbol}{avgOrderValue.toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Per completed checkout
          </span>
        </div>

        {/* Top 10% Pareto Revenue Share */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Top 10% Pareto Share</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Percent className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {top10RevenueShare.toFixed(1)}%
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            Top decile drives 39%+ store spend
          </span>
        </div>
      </div>

      {/* Visual Charts Row: Monthly Trend & Guest vs Repeat Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Revenue Bar Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Monthly Revenue & Order Volume</h3>
              <p className="text-xs text-slate-500">Historical performance timeline of identified transactions</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              {monthlyData.length} Active Months
            </span>
          </div>

          {monthlyData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No monthly transactions found
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {monthlyData.slice(-6).map((m) => {
                const pct = (m.revenue / maxMonthRev) * 100;
                return (
                  <div key={m.month} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-700">{m.month}</span>
                      <div className="flex gap-3 text-slate-600">
                        <span className="text-slate-400">{m.orderCount} orders</span>
                        <span className="font-bold text-slate-900">
                          {currencySymbol}{m.revenue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                      <div
                        className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Customer Composition: Guest vs Repeat Regulars */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Customer Composition</h3>
            <p className="text-xs text-slate-500">Guest checkouts vs Repeat regular buyers</p>

            <div className="mt-6 flex flex-col items-center">
              {/* Donut representation via conic-gradient */}
              <div
                className="w-36 h-36 rounded-full flex items-center justify-center shadow-inner relative"
                style={{
                  background: `conic-gradient(#059669 0% ${100 - singlePurchaseSharePct}%, #f59e0b ${100 - singlePurchaseSharePct}% 100%)`,
                }}
              >
                <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-xs">
                  <span className="text-xl font-bold text-slate-900">
                    {uniqueCustomersCount}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total</span>
                </div>
              </div>

              {/* Legend */}
              <div className="w-full mt-6 space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="font-medium text-emerald-950">Repeat Regulars (F ≥ 2)</span>
                  </div>
                  <span className="font-bold text-emerald-900">
                    {(uniqueCustomersCount - singlePurchaseCount)} ({((100 - singlePurchaseSharePct)).toFixed(1)}%)
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="font-medium text-amber-950">Single-Purchase (F = 1)</span>
                  </div>
                  <span className="font-bold text-amber-900">
                    {singlePurchaseCount} ({singlePurchaseSharePct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{hygieneStats.repeatGuestBuyersRecovered} repeat guest buyers stitched via phone numbers</span>
          </div>
        </div>
      </div>

      {/* Cleaned Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Cleaned & Stitched Transactions Explorer</h3>
            <p className="text-xs text-slate-500">
              Showing {filteredRows.length} valid order line items with unified customer keys
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search order ID, phone, email, SKU..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-4">Order / Invoice</th>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Unified Customer Key</th>
                <th className="py-2.5 px-4">Phone / WhatsApp</th>
                <th className="py-2.5 px-4">Product / SKU</th>
                <th className="py-2.5 px-4 text-right">Qty</th>
                <th className="py-2.5 px-4 text-right">Price</th>
                <th className="py-2.5 px-4 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No matching transactions found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, idx) => (
                  <tr key={`${r.orderId}_${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900">{r.orderId}</td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">{r.dateStr}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{r.customerName || r.unifiedKey}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-slate-500 text-[10px]">{r.unifiedKey}</span>
                        {r.isGuest ? (
                          <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200/60 px-1 py-0.2 rounded font-medium">
                            Guest
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-600 bg-slate-100 px-1 py-0.2 rounded font-medium">
                            Account
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px]">
                      {r.phone ? (
                        <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>{r.phone}</span>
                        </div>
                      ) : r.messengerId ? (
                        <div className="flex items-center gap-1 text-blue-700 font-semibold" title="Ordered via Facebook Messenger">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          <span>{r.messengerId}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-[200px] truncate" title={r.sku}>
                      {r.sku}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium text-slate-700">{r.quantity}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">
                      {currencySymbol}{r.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                      {currencySymbol}{r.totalAmount.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-slate-200/80 flex items-center justify-between bg-slate-50/70 text-xs">
          <span className="text-slate-500">
            Showing {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, filteredRows.length)} of {filteredRows.length} transactions
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded-md bg-white border border-slate-200 font-medium text-slate-700 disabled:opacity-40 hover:bg-slate-50 cursor-pointer shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
