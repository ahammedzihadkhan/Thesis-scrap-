import React from 'react';
import { ColumnMapping } from '../rfm/types';
import { X, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

interface ColumnMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  mapping: ColumnMapping;
  onSaveMapping: (newMapping: ColumnMapping) => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  isOpen,
  onClose,
  headers,
  mapping,
  onSaveMapping,
}) => {
  const [draft, setDraft] = React.useState<ColumnMapping>(mapping);

  React.useEffect(() => {
    setDraft(mapping);
  }, [mapping]);

  if (!isOpen) return null;

  const handleChange = (field: keyof ColumnMapping, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    onSaveMapping(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Smart Column Mapping & Guest Recovery Ingestion Wizard
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fuzzy-matched your file headers. Adjust dropdowns below if your store uses custom names.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
            aria-label="Close mapping modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Order ID & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Order / Invoice ID Column <span className="text-rose-500">*</span>
              </label>
              <select
                value={draft.orderIdCol}
                onChange={(e) => handleChange('orderIdCol', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">e.g., InvoiceNo, order_id, receipt_id</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Order Timestamp / Date Column <span className="text-rose-500">*</span>
              </label>
              <select
                value={draft.timestampCol}
                onChange={(e) => handleChange('timestampCol', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">e.g., InvoiceDate, created_at, date</span>
            </div>
          </div>

          {/* Identity Stitching Priority Keys */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-emerald-900">F-Commerce Identity Stitching Priority Chain</span>
              <span className="bg-emerald-200/80 text-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                Messenger & WhatsApp Recovery
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              If an order has no registered Account ID, our engine resolves identity via normalized WhatsApp Phone number. <strong>If WhatsApp is missing</strong>, it automatically resolves via <strong>Facebook Messenger ID / Profile Handle</strong>, linking guest buyers into repeat customer profiles.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  1. Customer Account ID
                </label>
                <select
                  value={draft.customerCol}
                  onChange={(e) => handleChange('customerCol', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">(None - F-Commerce Store)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">e.g., CustomerID, user_id</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  2. WhatsApp / Phone
                </label>
                <select
                  value={draft.phoneCol}
                  onChange={(e) => handleChange('phoneCol', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">(None)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">e.g., whatsapp_phone, mobile</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  3. Messenger / FB ID
                </label>
                <select
                  value={draft.messengerCol || ''}
                  onChange={(e) => handleChange('messengerCol', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">(Auto-detect)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">e.g., facebook_id, messenger_id</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  4. Checkout Email
                </label>
                <select
                  value={draft.emailCol}
                  onChange={(e) => handleChange('emailCol', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="">(None)</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-0.5 block">e.g., customer_email, email</span>
              </div>
            </div>
          </div>

          {/* Product / Basket Depth SKU */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Product / SKU Column (For 5D Basket Depth $D$)
            </label>
            <select
              value={draft.productCol}
              onChange={(e) => handleChange('productCol', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            >
              <option value="">(None — Will gracefully default Basket Depth D = Frequency F)</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-400 mt-1 block">e.g., StockCode, product_name, sku</span>
          </div>

          {/* Revenue Calculation Mode */}
          <div className="border border-slate-200 rounded-xl p-3.5 space-y-3">
            <span className="font-semibold text-slate-800 block">Monetary Revenue Mode</span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="revenueMode"
                  checked={draft.revenueMode === 'quantity_price'}
                  onChange={() => handleChange('revenueMode', 'quantity_price')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium text-slate-700">Quantity × Unit Price</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="revenueMode"
                  checked={draft.revenueMode === 'total_amount'}
                  onChange={() => handleChange('revenueMode', 'total_amount')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-medium text-slate-700">Pre-calculated Total Order Amount</span>
              </label>
            </div>

            {draft.revenueMode === 'quantity_price' ? (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-600 mb-1">Quantity Column</label>
                  <select
                    value={draft.quantityCol}
                    onChange={(e) => handleChange('quantityCol', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  >
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Unit Price Column</label>
                  <select
                    value={draft.unitPriceCol}
                    onChange={(e) => handleChange('unitPriceCol', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                  >
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="pt-2">
                <label className="block text-slate-600 mb-1">Total Order Amount Column</label>
                <select
                  value={draft.totalAmountCol}
                  onChange={(e) => handleChange('totalAmountCol', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                >
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-3 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Apply & Re-Run Pipeline
          </button>
        </div>
      </div>
    </div>
  );
};
