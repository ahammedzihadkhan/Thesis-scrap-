import React, { useState, useMemo } from 'react';
import { CustomerRFMTD, PersonaType, CampaignConfig, WhatsAppBulkToolFormat } from '../rfm/types';
import { generateWhatsAppBulkExport } from '../rfm/whatsappBulkExporter';
import { X, Download, Info, ChevronDown, ShieldCheck } from 'lucide-react';
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

// Plain-language labels; the file formats themselves are defined in rfm/types.ts.
const SIMPLE: { id: WhatsAppBulkToolFormat; name: string; hint: string } = {
  id: 'clean_phone_list',
  name: 'Simple list (Excel / any app)',
  hint: 'Phone, name, group and the ready message. Open it in Excel or upload it to most bulk-messaging apps.',
};
const APPS: { id: WhatsAppBulkToolFormat; name: string; hint: string }[] = [
  { id: 'wati_aisensy', name: 'WATI, AiSensy or Interakt', hint: 'Official WhatsApp Business apps.' },
  { id: 'generic_extension', name: 'WhatsApp sender Chrome extension', hint: 'Browser extensions that send one message after another.' },
  { id: 'gallabox_quickreply', name: 'Gallabox or QuickReply', hint: 'Includes tags and offer fields.' },
  { id: 'manychat_messenger', name: 'ManyChat / Facebook Messenger', hint: 'For customers you reach on Messenger instead of WhatsApp.' },
  { id: 'fcommerce_multichannel', name: 'WhatsApp + Messenger together', hint: 'Uses WhatsApp when there is a phone number, Messenger otherwise.' },
];
export const GROUPS: [PersonaType | 'All', string][] = [
  ['All', 'Everyone'],
  ['Champions (VIP Loyalists)', 'Best customers'],
  ['Loyal & Promising Regulars', 'Regular customers'],
  ['High-Potential / At-Risk Guests', 'Slipping away'],
  ['Hibernating / Lost Guests', 'Inactive / one-time'],
];

export const WhatsAppBulkExportModal: React.FC<WhatsAppBulkExportModalProps> = ({
  isOpen,
  onClose,
  customers,
  shopName,
  currencySymbol,
  campaignConfigs,
  recommendationsMap,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<WhatsAppBulkToolFormat>(SIMPLE.id);
  const [selectedSegment, setSelectedSegment] = useState<PersonaType | 'All'>('All');
  const [showApps, setShowApps] = useState(false);

  const exportData = useMemo(
    () =>
      generateWhatsAppBulkExport(customers, {
        toolFormat: selectedFormat,
        segmentFilter: selectedSegment,
        // Messenger formats can reach customers without a phone number.
        onlyValidPhones: selectedFormat !== 'manychat_messenger' && selectedFormat !== 'fcommerce_multichannel',
        shopName,
        currencySymbol,
        campaignConfigs,
        recommendationsMap,
      }),
    [customers, selectedFormat, selectedSegment, shopName, currencySymbol, campaignConfigs, recommendationsMap]
  );

  if (!isOpen) return null;

  const handleDownload = () => {
    const blob = new Blob(['﻿' + exportData.csvContent], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportData.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const option = (o: { id: WhatsAppBulkToolFormat; name: string; hint: string }) => (
    <label
      key={o.id}
      className={`flex gap-3 p-3 rounded-xl border cursor-pointer ${selectedFormat === o.id ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'}`}
    >
      <input type="radio" name="export-format" checked={selectedFormat === o.id} onChange={() => setSelectedFormat(o.id)} className="mt-1 accent-emerald-600" />
      <span>
        <span className="block text-sm font-bold text-slate-900">{o.name}</span>
        <span className="block text-xs text-slate-500">{o.hint}</span>
      </span>
    </label>
  );

  const sample = exportData.sampleRows[0];
  const sampleMessage = sample && (sample.Message_Text || sample.custom_message || sample.Message || sample['Message Content'] || sample.message_content);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-export-title">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 id="bulk-export-title" className="text-lg font-extrabold text-slate-900">Download a list to message many customers at once</h2>
            <p className="text-sm text-slate-600 mt-1">
              This makes a file of your customers with a ready message for each one. You only need it if you use a
              bulk-messaging app. <strong>Not using one?</strong> Close this and press the green WhatsApp button next to
              each customer — it opens WhatsApp with the message already written.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          <section>
            <h3 className="text-sm font-extrabold text-slate-900 mb-2">1. Who should get the message?</h3>
            <div className="flex flex-wrap gap-2">
              {GROUPS.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSelectedSegment(value)}
                  aria-pressed={selectedSegment === value}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border cursor-pointer ${selectedSegment === value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-extrabold text-slate-900 mb-2">2. Which file do you need?</h3>
            <div className="space-y-2">
              {option(SIMPLE)}
              <button onClick={() => setShowApps((v) => !v)} aria-expanded={showApps} className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1 cursor-pointer">
                <ChevronDown className={`w-4 h-4 transition-transform ${showApps ? 'rotate-180' : ''}`} /> I use a specific app
              </button>
              {showApps && <div className="grid sm:grid-cols-2 gap-2">{APPS.map(option)}</div>}
            </div>
          </section>

          <section className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm text-slate-800">
              <strong>{exportData.validPhoneCount.toLocaleString()}</strong> customers will be in the file.
              {exportData.skippedPhoneCount > 0 && (
                <span className="text-slate-500"> {exportData.skippedPhoneCount.toLocaleString()} left out because they have no phone number.</span>
              )}
            </p>
            {sampleMessage && <p className="text-xs text-slate-600 mt-2">Example message: <em>“{sampleMessage}”</em></p>}
          </section>

          <p className="text-xs text-slate-500 flex gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            Only message customers who agreed to hear from you, and include a way to stop messages. The file is created on this computer and is not sent anywhere.
          </p>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 hidden sm:inline-flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Opens in Excel or Google Sheets</span>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer">Cancel</button>
            <button
              onClick={handleDownload}
              disabled={exportData.validPhoneCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Download file
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
