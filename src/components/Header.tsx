import React from 'react';
import { CurrencyCode, CURRENCIES } from '../rfm/types';
import {
  Upload,
  Database,
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Layers,
} from 'lucide-react';

interface HeaderProps {
  currentCurrency: CurrencyCode;
  onCurrencyChange: (c: CurrencyCode) => void;
  datasetName: string;
  onLoadWhatsAppSample: () => void;
  onLoadRichBDSample: () => void;
  onLoadUCISample: () => void;
  onLoadDarazSample: () => void;
  onOpenUpload: () => void;
  onOpenMapping: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentCurrency,
  onCurrencyChange,
  datasetName,
  onLoadWhatsAppSample,
  onLoadRichBDSample,
  onLoadUCISample,
  onLoadDarazSample,
  onOpenUpload,
  onOpenMapping,
  isLoading,
}) => {
  // Determine select value based on datasetName
  const getSelectedDatasetKey = () => {
    if (datasetName.includes('Daraz') || datasetName.includes('dara')) return 'daraz';
    if (datasetName.includes('Aarong') || datasetName.includes('160+') || datasetName.includes('180+')) return 'bd-rich';
    if (datasetName.includes('WhatsApp & Facebook') || datasetName.includes('Dhaka')) return 'bd-whatsapp';
    if (datasetName.includes('UCI')) return 'uci';
    return 'custom';
  };

  const handleDatasetChange = (val: string) => {
    if (val === 'daraz') onLoadDarazSample();
    else if (val === 'bd-rich') onLoadRichBDSample();
    else if (val === 'bd-whatsapp') onLoadWhatsAppSample();
    else if (val === 'uci') onLoadUCISample();
    else if (val === 'upload') onOpenUpload();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 w-full">
      <div className="w-full max-w-full mx-auto px-3 sm:px-5 lg:px-6 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-xs font-black text-sm tracking-tight">
              KP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                  <span className="text-emerald-700">KroyPulse</span>
                </h1>
                <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md">
                  Omni-Channel Retail, POS &amp; Social Intelligence
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                5D RFM Engine · Reach Anyhow (POS Phone SMS · Email · WhatsApp · Messenger) · Identity Stitching
              </p>
            </div>
          </div>

          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Unified Dataset Selector */}
            <div className="relative inline-flex items-center">
              <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 transition-colors">
                <Database className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-slate-400 font-normal hidden sm:inline">Dataset:</span>
                <select
                  value={getSelectedDatasetKey()}
                  onChange={(e) => handleDatasetChange(e.target.value)}
                  disabled={isLoading}
                  className="bg-transparent font-medium text-slate-800 focus:outline-hidden cursor-pointer pr-4"
                  aria-label="Select Dataset"
                >
                  <option value="daraz">📦 Daraz BD, Pickaboo &amp; POS Retail (1,049 Orders · SMS / Email / WA)</option>
                  <option value="bd-rich">🇧🇩 BD Omni-Channel Retail &amp; Boutique (200 Orders · POS / Email / WA / FB)</option>
                  <option value="bd-whatsapp">💬 Dhaka Retail &amp; Social Log (Tk ৳)</option>
                  <option value="uci">🌐 Canonical UCI Retail Benchmark (GBP)</option>
                  {getSelectedDatasetKey() === 'custom' && (
                    <option value="custom">📁 {datasetName}</option>
                  )}
                  <option value="upload">+ Upload Custom POS / Store File (CSV)...</option>
                </select>
              </div>
            </div>

            {/* Currency Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-lg px-2.5 py-1.5 text-xs">
              <span className="text-slate-400 font-normal">Currency:</span>
              <select
                value={currentCurrency}
                onChange={(e) => onCurrencyChange(e.target.value as CurrencyCode)}
                className="bg-transparent font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                aria-label="Select currency"
              >
                {Object.values(CURRENCIES).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Button */}
            <button
              onClick={onOpenUpload}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Upload CSV</span>
            </button>

            {/* Column Mapping Button */}
            <button
              onClick={onOpenMapping}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              title="Configure Column Mappings"
              aria-label="Configure Column Mappings"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Columns</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
