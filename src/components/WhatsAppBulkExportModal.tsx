import React, { useState, useMemo } from 'react';
import {
  CustomerRFMTD,
  PersonaType,
  CampaignConfig,
  WhatsAppBulkToolFormat,
  WHATSAPP_BULK_TOOL_SPECS,
} from '../rfm/types';
import {
  generateWhatsAppBulkExport,
  formatE164Phone,
} from '../rfm/whatsappBulkExporter';
import { PERSONA_METAS } from '../rfm/mlClustering';
import {
  X,
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  Smartphone,
  Info,
  Layers,
  Sparkles,
  PhoneCall,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';

import { CustomerRecommendationProfile } from '../rfm/recommendationEngine';

interface WhatsAppBulkExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: CustomerRFMTD[];
  shopName: string;
  currencySymbol: string;
  campaignConfigs: Record<PersonaType, CampaignConfig>;
  recommendationsMap?: Map<string, CustomerRecommendationProfile>;
}

export const WhatsAppBulkExportModal: React.FC<WhatsAppBulkExportModalProps> = ({
  isOpen,
  onClose,
  customers,
  shopName,
  currencySymbol,
  campaignConfigs,
  recommendationsMap,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<WhatsAppBulkToolFormat>('wati_aisensy');
  const [selectedSegment, setSelectedSegment] = useState<PersonaType | 'All'>('All');
  const [onlyValidPhones, setOnlyValidPhones] = useState(true);
  const [copiedPhones, setCopiedPhones] = useState(false);

  // Generate export preview & file content
  const exportData = useMemo(() => {
    return generateWhatsAppBulkExport(customers, {
      toolFormat: selectedFormat,
      segmentFilter: selectedSegment,
      onlyValidPhones,
      shopName,
      currencySymbol,
      campaignConfigs,
      recommendationsMap,
    });
  }, [
    customers,
    selectedFormat,
    selectedSegment,
    onlyValidPhones,
    shopName,
    currencySymbol,
    campaignConfigs,
    recommendationsMap,
  ]);


  if (!isOpen) return null;

  const handleDownload = () => {
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(exportData.csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', exportData.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
  };

  const handleCopyPhoneNumbers = () => {
    const numbers = exportData.sampleRows
      .map((r) => r.phone_number || r.Phone || '')
      .filter(Boolean);

    // Get all valid phones from full filtered set
    const allFilteredPhones = customers
      .filter((c) => selectedSegment === 'All' || c.persona === selectedSegment)
      .map((c) => formatE164Phone(c.phone))
      .filter(Boolean);

    navigator.clipboard.writeText(allFilteredPhones.join(', '));
    setCopiedPhones(true);
    setTimeout(() => setCopiedPhones(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Export for F-Commerce Bulk Messaging & Messenger Broadcast
                </h2>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-full">
                  Messenger & WhatsApp
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate pre-structured CSV files ready for ManyChat, Meta Messenger Broadcast, WATI, AiSensy, or Chrome extensions.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close bulk export modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Tool Format Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Select Your F-Commerce Platform / Dispatch Format</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(WHATSAPP_BULK_TOOL_SPECS) as WhatsAppBulkToolFormat[]).map((fmtKey) => {
                const spec = WHATSAPP_BULK_TOOL_SPECS[fmtKey];
                const isSelected = selectedFormat === fmtKey;
                const isMessenger = fmtKey === 'manychat_messenger' || fmtKey === 'fcommerce_multichannel';

                return (
                  <div
                    key={fmtKey}
                    onClick={() => setSelectedFormat(fmtKey)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? isMessenger
                          ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/30'
                          : 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1">
                        {isMessenger && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>}
                        <span>{spec.name}</span>
                      </span>
                      <span
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? isMessenger
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{spec.description}</p>
                    <div className="mt-2 text-[10px] text-slate-400 font-mono">
                      Cols: {spec.headers.slice(0, 4).join(', ')}...
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Segment Filter & Validation Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">
                Target Customer Segment
              </label>
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="All">All Segments ({customers.length} total customers)</option>
                <option value="Champions (VIP Loyalists)">Champions (VIP Loyalists) only</option>
                <option value="Loyal & Promising Regulars">Loyal & Promising Regulars only</option>
                <option value="High-Potential / At-Risk Guests">High-Potential / At-Risk Guests only</option>
                <option value="Hibernating / Lost Guests">Hibernating / Lost Guests (Win-Back Queue)</option>
              </select>
            </div>

            <div className="flex flex-col justify-end space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyValidPhones}
                  onChange={(e) => setOnlyValidPhones(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="font-semibold text-slate-800">
                  Strict WhatsApp phone filter (for WA-only tools)
                </span>
              </label>
              <span className="text-[11px] text-slate-500">
                {selectedFormat === 'manychat_messenger' || selectedFormat === 'fcommerce_multichannel'
                  ? 'Messenger & Unified formats automatically target customers via their Facebook Messenger ID if phone is missing.'
                  : 'Skips customers without a verified phone number to prevent broadcast bounces.'}
              </span>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/70 border border-emerald-200 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="font-bold text-emerald-950">
                Ready for Export:{' '}
                <strong className="text-emerald-700 text-sm">
                  {exportData.validPhoneCount} Numbers
                </strong>
              </span>
              {exportData.skippedPhoneCount > 0 && (
                <span className="text-[11px] text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                  {exportData.skippedPhoneCount} skipped (no phone)
                </span>
              )}
            </div>

            <button
              onClick={handleCopyPhoneNumbers}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title="Copy all phone numbers as comma-separated text"
            >
              {copiedPhones ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{copiedPhones ? 'Copied Numbers!' : 'Copy Numbers List'}</span>
            </button>
          </div>

          {/* Live Preview Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                Generated CSV Preview ({exportData.headers.length} columns)
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{exportData.filename}</span>
            </div>

            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono">
                    {exportData.headers.map((h) => (
                      <th key={h} className="py-2 px-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {exportData.sampleRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {exportData.headers.map((h) => (
                        <td
                          key={h}
                          className="py-1.5 px-3 max-w-[200px] truncate text-slate-700"
                          title={row[h]}
                        >
                          {row[h] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Compatible with all standard WhatsApp Cloud API & Broadcast tools</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download WhatsApp Bulk CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
