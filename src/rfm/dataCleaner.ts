import { RawTransaction } from './types';
import { normalizePhoneNumber, parseDate } from './identityStitcher';

/**
 * Automatic dataset cleaner. Runs entirely in the browser: no row ever leaves the device.
 * It formats a messy CSV / Excel export (shop ledgers, Daraz/Shopify/POS exports, Google Sheets)
 * into a tidy table the segmentation pipeline can read, and logs every rule it applied.
 */

export type ColumnKind = 'id' | 'date' | 'number' | 'phone' | 'email' | 'text';

export interface CleaningStep {
  rule: string;
  affected: number;
  detail: string;
}

export interface ColumnProfile {
  original: string;
  name: string;
  kind: ColumnKind;
  missing: number;
  invalid: number;
}

export interface CleaningReport {
  rowsIn: number;
  rowsOut: number;
  colsIn: number;
  colsOut: number;
  steps: CleaningStep[];
  columns: ColumnProfile[];
  warnings: string[];
}

const BLANK = new Set(['', 'na', 'n/a', 'nan', 'null', 'none', '-', '--', '?', 'undefined', '#n/a']);
const BANGLA_DIGIT = /[০-৯]/;
const CURRENCY = /(৳|\$|£|€|₹|\btk\.?|\btaka\b|\bbdt\b|\busd\b|\bgbp\b|\beur\b|\binr\b|\s)/gi;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function banglaToAsciiDigits(s: string): string {
  return s.replace(/[০-৯]/g, (c) => String(c.charCodeAt(0) - 0x09e6));
}

/** "৳ 1,250.50", "Tk 900", "(120)" -> 1250.5, 900, -120. Returns null when it is not a number. */
export function parseNumber(raw: string): number | null {
  let s = banglaToAsciiDigits(raw).replace(CURRENCY, '').replace(/,/g, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

/** Excel stores dates as days since 1899-12-30 (UTC). */
function excelSerialToDate(n: number): Date {
  const utc = new Date(Math.round((n - 25569) * 86400 * 1000));
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate(), utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds());
}

/** Phone cleaner: Excel often drops the leading 0 of Bangladeshi mobiles (1711234567). */
export function cleanPhone(raw: string): string | null {
  const s = banglaToAsciiDigits(raw);
  if (/e\+/i.test(s)) return null; // Excel scientific notation: the digits are already lost
  const digits = s.replace(/[^\d+]/g, '');
  const local = /^1[3-9]\d{8}$/.test(digits) ? '0' + digits : digits;
  const n = normalizePhoneNumber(local);
  return n && /^\d{7,15}$/.test(n) ? n : null;
}

function normaliseHeader(h: string, used: Set<string>): string {
  let name = h.replace(/^﻿/, '').trim().replace(/\s+/g, ' ') || 'column';
  const base = name;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base}_${i}`;
  used.add(name.toLowerCase());
  return name;
}

export function guessKind(name: string, values: string[]): ColumnKind {
  const h = name.toLowerCase();
  const sample = values.filter((v) => v !== '').slice(0, 500);
  const share = (fn: (v: string) => boolean) => (sample.length ? sample.filter(fn).length / sample.length : 0);
  if (/(phone|mobile|whatsapp|contact|cell|msisdn)/.test(h)) return 'phone';
  if (/(e-?mail|mail)/.test(h) || share((v) => EMAIL_RE.test(v)) > 0.8) return 'email';
  if (/(date|time|created|timestamp|ordered.?at|^day$)/.test(h)) return 'date';
  if (/(^id$|_id$| id$|^id_|invoice|order.?no|order.?id|sku|stock.?code|code$|barcode|tracking)/.test(h)) return 'id';
  if (share((v) => parseNumber(v) !== null) >= 0.9) return 'number';
  if (share((v) => !/^\d+(\.\d+)?$/.test(v) && parseDate(v) !== null) >= 0.8) return 'date';
  return 'text';
}

const SLASH_DATE = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Decide whether a column's dd/mm/yyyy-style dates are day-first or month-first.
 * Any first part > 12 proves day-first; any second part > 12 proves month-first.
 * If the column never says, assume day-first (the Bangladeshi convention) and warn.
 */
export function detectDayFirst(values: string[]): { dayFirst: boolean; ambiguous: boolean } {
  let dayProof = false, monthProof = false, seen = false;
  for (const v of values) {
    const m = SLASH_DATE.exec(v);
    if (!m) continue;
    seen = true;
    if (+m[1] > 12) dayProof = true;
    if (+m[2] > 12) monthProof = true;
  }
  if (dayProof !== monthProof) return { dayFirst: dayProof, ambiguous: false };
  return { dayFirst: true, ambiguous: seen };
}

function parseDateWithOrder(v: string, dayFirst: boolean): Date | null {
  const m = SLASH_DATE.exec(v);
  if (!m) return parseDate(v);
  const [a, b, y, hh = '0', mm = '0', ss = '0'] = m.slice(1);
  const day = dayFirst ? +a : +b, month = dayFirst ? +b : +a;
  const d = new Date(+y, month - 1, day, +hh, +mm, +ss);
  return d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

export interface CleanOptions {
  /** 'auto' (default) detects per column; ambiguous columns are read day-first. */
  dateOrder?: 'auto' | 'day-first' | 'month-first';
  /** Remove rows whose main date column cannot be read (they cannot be used for Recency). Default true. */
  dropInvalidDates?: boolean;
}

export function autoCleanDataset(rows: RawTransaction[], opts: CleanOptions = {}): { rows: RawTransaction[]; report: CleaningReport } {
  const dropInvalidDates = opts.dropInvalidDates ?? true;
  const steps: CleaningStep[] = [];
  const warnings: string[] = [];
  const headerSet = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) headerSet.add(k);
  const headersIn = Array.from(headerSet);

  // 1. Headers: trim, collapse spaces, strip BOM, make unique.
  const used = new Set<string>();
  const headerMap = headersIn.map((h) => [h, normaliseHeader(String(h), used)] as const);
  steps.push({ rule: 'Column names tidied', affected: headerMap.filter(([a, b]) => a !== b).length, detail: 'Trimmed spaces, removed hidden BOM characters, made duplicate names unique.' });

  // 2. Cells: to trimmed strings, blank-like markers -> '', Bangla digits -> ASCII.
  let blanks = 0, bangla = 0;
  let table: Record<string, string>[] = rows.map((r) => {
    const out: Record<string, string> = {};
    for (const [orig, name] of headerMap) {
      const v = r[orig];
      let s = v instanceof Date ? formatDate(v) : v === undefined || v === null ? '' : String(v).trim().replace(/\s+/g, ' ');
      if (s !== '' && BLANK.has(s.toLowerCase())) { s = ''; blanks++; }
      if (BANGLA_DIGIT.test(s)) { s = banglaToAsciiDigits(s); bangla++; }
      out[name] = s;
    }
    return out;
  });
  steps.push({ rule: 'Blank markers standardised', affected: blanks, detail: 'Values like "N/A", "null", "-" turned into empty cells.' });
  steps.push({ rule: 'Bangla digits converted', affected: bangla, detail: 'Digits ০-৯ converted to 0-9 so numbers, dates and phones can be read.' });

  // 3. Fully empty rows and columns.
  const before = table.length;
  table = table.filter((r) => Object.values(r).some((v) => v !== ''));
  steps.push({ rule: 'Empty rows removed', affected: before - table.length, detail: 'Rows with no value in any column.' });
  let names = headerMap.map(([, n]) => n);
  const emptyCols = names.filter((n) => table.every((r) => r[n] === ''));
  names = names.filter((n) => !emptyCols.includes(n));
  table = table.map((r) => Object.fromEntries(names.map((n) => [n, r[n]])));
  steps.push({ rule: 'Empty columns removed', affected: emptyCols.length, detail: emptyCols.length ? emptyCols.join(', ') : 'None.' });

  // 4. Detect each column's kind and format its values.
  const columns: ColumnProfile[] = names.map((name) => ({
    original: headerMap.find(([, n]) => n === name)![0],
    name,
    kind: guessKind(name, table.map((r) => r[name])),
    missing: 0,
    invalid: 0,
  }));
  let numFixed = 0, dateFixed = 0, phoneFixed = 0, emailFixed = 0, idFixed = 0;
  const badDateRows = new Set<number>();
  const mainDate = columns.find((c) => c.kind === 'date');
  const dayFirstByCol = new Map<string, boolean>();
  for (const c of columns.filter((x) => x.kind === 'date')) {
    const det = detectDayFirst(table.map((r) => r[c.name]));
    const order = opts.dateOrder ?? 'auto';
    dayFirstByCol.set(c.name, order === 'auto' ? det.dayFirst : order === 'day-first');
    if (order === 'auto' && det.ambiguous) {
      warnings.push(`Dates in "${c.name}" could be day/month or month/day; they were read as day/month (e.g. 05/01/2024 = 5 January). Change "Date order" if that is wrong.`);
    }
  }
  table.forEach((r, i) => {
    for (const c of columns) {
      const v = r[c.name];
      if (v === '') { c.missing++; if (c === mainDate) badDateRows.add(i); continue; }
      if (c.kind === 'number') {
        const n = parseNumber(v);
        if (n === null) { c.invalid++; r[c.name] = ''; }
        else if (String(n) !== v) { r[c.name] = String(n); numFixed++; }
      } else if (c.kind === 'date') {
        const asNum = Number(v);
        const d = Number.isFinite(asNum) && asNum > 20000 && asNum < 80000 ? excelSerialToDate(asNum) : parseDateWithOrder(v, dayFirstByCol.get(c.name)!);
        if (!d || d.getFullYear() < 1990 || d.getFullYear() > 2100) {
          c.invalid++;
          if (c === mainDate) badDateRows.add(i);
        } else {
          const f = formatDate(d);
          if (f !== v) { r[c.name] = f; dateFixed++; }
        }
      } else if (c.kind === 'phone') {
        const p = cleanPhone(v);
        if (!p) { c.invalid++; r[c.name] = ''; }
        else if (p !== v) { r[c.name] = p; phoneFixed++; }
      } else if (c.kind === 'email') {
        const e = v.toLowerCase().replace(/^mailto:/, '');
        if (!EMAIL_RE.test(e)) { c.invalid++; r[c.name] = ''; }
        else if (e !== v) { r[c.name] = e; emailFixed++; }
      } else if (c.kind === 'id' && /^\d+\.0+$/.test(v)) {
        r[c.name] = v.replace(/\.0+$/, ''); // Excel turns 536365 into 536365.0
        idFixed++;
      }
    }
  });
  steps.push({ rule: 'Numbers cleaned', affected: numFixed, detail: 'Removed currency signs (৳, Tk, $, £) and thousands commas; "(120)" read as -120.' });
  steps.push({ rule: 'Dates standardised', affected: dateFixed, detail: 'Converted to YYYY-MM-DD HH:mm:ss, including Excel serial dates.' });
  steps.push({ rule: 'Phone numbers normalised', affected: phoneFixed, detail: '+880 / 880 / 00880 / missing leading 0 → 01XXXXXXXXX.' });
  steps.push({ rule: 'E-mails lower-cased', affected: emailFixed, detail: 'Lower-cased; invalid addresses blanked.' });
  steps.push({ rule: 'IDs repaired', affected: idFixed, detail: 'Removed the Excel ".0" from order / customer IDs.' });

  const dropDates = dropInvalidDates && mainDate ? badDateRows.size : 0;
  if (dropDates) table = table.filter((_, i) => !badDateRows.has(i));
  steps.push({ rule: 'Rows without a readable order date removed', affected: dropDates, detail: mainDate ? `Based on column "${mainDate.name}".` : 'No date column detected.' });

  // 5. Exact duplicates (after formatting, so "৳1,000" and "1000" count as the same).
  const seen = new Set<string>();
  const n0 = table.length;
  table = table.filter((r) => { const key = JSON.stringify(names.map((n) => r[n])); if (seen.has(key)) return false; seen.add(key); return true; });
  steps.push({ rule: 'Exact duplicate rows removed', affected: n0 - table.length, detail: 'Identical rows (after formatting) kept once.' });

  // 6. Warnings for the shop owner (kept here; the segmentation step excludes them).
  const qty = columns.find((c) => c.kind === 'number' && /(qty|quantity|units|pcs)/i.test(c.name));
  if (qty) {
    const neg = table.filter((r) => r[qty.name] !== '' && Number(r[qty.name]) <= 0).length;
    if (neg) warnings.push(`${neg} rows have zero or negative "${qty.name}" (returns / cancellations). They are kept here and excluded during segmentation.`);
  }
  if (!mainDate) warnings.push('No order-date column was detected. Segmentation needs one to compute Recency.');
  if (!columns.some((c) => c.kind === 'phone' || c.kind === 'email' || /customer|client|buyer|user/i.test(c.name))) {
    warnings.push('No customer identifier (customer ID, phone or e-mail) was detected.');
  }
  columns.filter((c) => c.kind === 'phone' && c.invalid > 0).forEach((c) =>
    warnings.push(`${c.invalid} values in "${c.name}" are not valid phone numbers (for example Excel scientific notation). Format that column as Text in Excel and export again.`));

  return {
    rows: table as RawTransaction[],
    report: { rowsIn: rows.length, rowsOut: table.length, colsIn: headersIn.length, colsOut: names.length, steps, columns, warnings },
  };
}

/** Neutralise spreadsheet formulas (=, +, -, @) so an exported file cannot run code when opened in Excel. */
export function csvSafe(value: unknown): string {
  const s = value === undefined || value === null ? '' : String(value);
  return /^[=+\-@\t\r]/.test(s) && !/^[-+]?\d*\.?\d+$/.test(s) ? `'${s}` : s;
}
