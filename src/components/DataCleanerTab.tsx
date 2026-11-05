import React, { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { RawTransaction } from '../rfm/types';
import { autoCleanDataset, CleaningReport, csvSafe } from '../rfm/dataCleaner';
import { parseSpreadsheetFile } from '../rfm/fileParser';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Lock, Sparkles, Upload, Wand2 } from 'lucide-react';

interface Props {
  currentRows: RawTransaction[];
  currentName: string;
  onUseCleaned: (rows: RawTransaction[], label: string) => void;
}

const KIND_STYLE: Record<string, string> = {
  date: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  number: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  phone: 'bg-teal-50 text-teal-700 border-teal-200',
  email: 'bg-sky-50 text-sky-700 border-sky-200',
  id: 'bg-amber-50 text-amber-800 border-amber-200',
  text: 'bg-slate-50 text-slate-600 border-slate-200',
};

export const DataCleanerTab: React.FC<Props> = ({ currentRows, currentName, onUseCleaned }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<{ name: string; rows: RawTransaction[] } | null>(null);
  const [dropInvalidDates, setDropInvalidDates] = useState(true);
  const [dateOrder, setDateOrder] = useState<'auto' | 'day-first' | 'month-first'>('auto');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const result = useMemo<{ rows: RawTransaction[]; report: CleaningReport } | null>(
    () => (source ? autoCleanDataset(source.rows, { dropInvalidDates, dateOrder }) : null),
    [source, dropInvalidDates, dateOrder]
  );

  const load = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      setSource({ name: file.name, rows: await parseSpreadsheetFile(file) });
    } catch (e: any) {
      setError(e?.message || 'Could not read this file.');
    } finally {
      setBusy(false);
    }
  };

  const baseName = (source?.name || 'dataset').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_');
  const exportCsv = () => {
    if (!result) return;
    const safe = result.rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, csvSafe(v)])));
    const blob = new Blob(['﻿' + Papa.unparse(safe)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}_cleaned.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportXlsx = () => {
    if (!result) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.rows), 'Cleaned');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(result.report.steps.map((s) => ({ Rule: s.rule, Affected: s.affected, Detail: s.detail }))), 'Cleaning log');
    XLSX.writeFile(wb, `${baseName}_cleaned.xlsx`);
  };

  const r = result?.report;
  const preview = result ? result.rows.slice(0, 8) : [];
  const cols = r ? r.columns.map((c) => c.name) : [];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-emerald-600" /> Automatic Data Cleaner
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Drop any order export (CSV or Excel). The cleaner detects dates, prices, phone numbers, e-mails and IDs,
              fixes their format, removes empty and duplicate rows, and tells you exactly what it changed.
            </p>
            <p className="text-[11px] text-emerald-700 mt-1.5 inline-flex items-center gap-1 font-semibold">
              <Lock className="w-3.5 h-3.5" /> Runs on this computer only. Your file is never uploaded.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-60"
            >
              <Upload className="w-4 h-4" /> {busy ? 'Reading…' : 'Choose file'}
            </button>
            <button
              onClick={() => setSource({ name: currentName, rows: currentRows })}
              disabled={busy || currentRows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" /> Clean the loaded dataset
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              className="hidden"
              aria-label="Choose a CSV or Excel file to clean"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }}
            />
          </div>
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) load(f); }}
          className="mt-4 border-2 border-dashed border-slate-200 rounded-xl py-6 text-center text-xs text-slate-500"
        >
          <FileSpreadsheet className="w-6 h-6 mx-auto text-slate-400 mb-1" />
          Drag and drop a .csv, .tsv or .xlsx file here (up to 50 MB)
        </div>
        {error && (
          <div role="alert" className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}
      </div>

      {r && result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Rows before', r.rowsIn.toLocaleString()],
              ['Rows after', r.rowsOut.toLocaleString()],
              ['Columns', `${r.colsIn} → ${r.colsOut}`],
              ['Fixes applied', r.steps.reduce((s, x) => s + x.affected, 0).toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
              </div>
            ))}
          </div>

          {r.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
              {r.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-900 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />{w}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">What the cleaner did</h3>
                <label className="text-[11px] text-slate-600 inline-flex items-center gap-1.5">
                  Date order
                  <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as typeof dateOrder)} className="border border-slate-300 rounded px-1 py-0.5 bg-white">
                    <option value="auto">Auto-detect</option>
                    <option value="day-first">Day/Month (05/01 = 5 Jan)</option>
                    <option value="month-first">Month/Day (05/01 = 1 May)</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-600 inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={dropInvalidDates} onChange={(e) => setDropInvalidDates(e.target.checked)} />
                  Remove rows without a readable date
                </label>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {r.steps.map((s) => (
                    <tr key={s.rule}>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {s.affected > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 h-3.5 inline-block rounded-full border border-slate-300" />}
                          {s.rule}
                        </div>
                        <div className="text-[11px] text-slate-500 pl-5">{s.detail}</div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-slate-800">{s.affected.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-bold text-slate-900">Detected columns</h3>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 text-left">
                    <th className="px-4 py-2 font-semibold">Column</th>
                    <th className="px-2 py-2 font-semibold">Type</th>
                    <th className="px-2 py-2 font-semibold text-right">Empty</th>
                    <th className="px-4 py-2 font-semibold text-right">Invalid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.columns.map((c) => (
                    <tr key={c.name}>
                      <td className="px-4 py-1.5 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-2 py-1.5"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${KIND_STYLE[c.kind]}`}>{c.kind}</span></td>
                      <td className="px-2 py-1.5 text-right font-mono text-slate-600">{c.missing.toLocaleString()}</td>
                      <td className={`px-4 py-1.5 text-right font-mono ${c.invalid ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>{c.invalid.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">Preview (first {preview.length} of {result.rows.length.toLocaleString()} rows)</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportCsv} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"><Download className="w-3.5 h-3.5" /> CSV</button>
                <button onClick={exportXlsx} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"><Download className="w-3.5 h-3.5" /> Excel + log</button>
                <button
                  onClick={() => onUseCleaned(result.rows, `Cleaned: ${source!.name} (${result.rows.length.toLocaleString()} rows)`)}
                  disabled={result.rows.length === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Segment these customers
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-left">{cols.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.map((row, i) => (
                    <tr key={i}>{cols.map((c) => <td key={c} className="px-3 py-1.5 text-slate-700">{String(row[c] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
