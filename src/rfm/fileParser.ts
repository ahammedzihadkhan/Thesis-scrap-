import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { RawTransaction } from './types';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_ROWS = 600_000;
const ALLOWED = ['csv', 'tsv', 'txt', 'xlsx', 'xls'];

/**
 * Read a CSV / TSV / Excel file in the browser. Nothing is uploaded anywhere.
 * Every cell is read as text (no type guessing), so phone numbers keep their leading 0
 * and the data cleaner decides how to format each column.
 */
export async function parseSpreadsheetFile(file: File): Promise<RawTransaction[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED.includes(ext)) throw new Error(`Unsupported file type ".${ext}". Use CSV, TSV or Excel (.xlsx / .xls).`);
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`File is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1048576} MB.`);

  let rows: RawTransaction[];
  if (ext === 'xlsx' || ext === 'xls') {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, dense: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<RawTransaction>(sheet, { defval: '', raw: false, dateNF: 'yyyy-mm-dd hh:mm:ss' });
  } else {
    rows = await new Promise((resolve, reject) =>
      Papa.parse<RawTransaction>(file, {
        header: true,
        dynamicTyping: false,
        skipEmptyLines: 'greedy',
        complete: (r) => resolve(r.data),
        error: (e) => reject(new Error(`Could not read the file: ${e.message}`)),
      })
    );
  }
  if (rows.length === 0) throw new Error('The file has no data rows.');
  if (rows.length > MAX_ROWS) throw new Error(`The file has ${rows.length.toLocaleString()} rows; the limit is ${MAX_ROWS.toLocaleString()}.`);
  return rows;
}
