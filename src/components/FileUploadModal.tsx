import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { RawTransaction } from '../rfm/types';
import { Upload, X, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: RawTransaction[], fileName: string) => void;
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);

    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          const workbook = XLSX.read(buffer, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json<RawTransaction>(sheet, { defval: '' });

          if (jsonData.length === 0) {
            setErrorMsg('Excel sheet is empty or contains no records.');
            setIsProcessing(false);
            return;
          }

          onDataLoaded(jsonData, fileName);
          setIsProcessing(false);
          onClose();
        } catch (err: any) {
          setErrorMsg(`Failed to parse Excel file: ${err.message || 'Unknown error'}`);
          setIsProcessing(false);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      // CSV or TSV
      Papa.parse<RawTransaction>(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            setErrorMsg('CSV/TSV file is empty or contains no rows.');
            setIsProcessing(false);
            return;
          }
          onDataLoaded(results.data, fileName);
          setIsProcessing(false);
          onClose();
        },
        error: (err) => {
          setErrorMsg(`Error parsing CSV/TSV: ${err.message}`);
          setIsProcessing(false);
        },
      });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Upload Store Order File</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Upload your order log export from Shopify, WooCommerce, POS, or WhatsApp Excel sheet. Supports <strong>.csv</strong>, <strong>.tsv</strong>, and <strong>.xlsx</strong> formats.
          </p>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
          >
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-full">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                Click or drag & drop file here
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block">
                Auto-detects delimiters (comma, tab) and column names
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isProcessing && (
            <div className="text-center text-xs font-semibold text-emerald-600 py-2">
              Ingesting and running zero-account identity stitching...
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
