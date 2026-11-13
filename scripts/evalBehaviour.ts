/**
 * Checks the app's customer behaviour prediction (src/rfm/behaviourModel.ts) on the real UCI Online Retail file,
 * cleaned exactly as the app cleans an upload: fit on the orders up to a cutoff, predict the next 90 days, compare.
 *
 * Run:  npx tsx scripts/evalBehaviour.ts        (needs thesis/data/online_retail.csv)
 * Out:  thesis/outputs/tables/t_app_prediction.csv
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { autoDetectColumnMapping, stitchAndCleanData } from '../src/rfm/identityStitcher';
import { checkBehaviourModel } from '../src/rfm/behaviourModel';
import { DARAZ_BD_RAW_TRANSACTIONS } from '../src/data/darazSampleData';
import type { RawTransaction } from '../src/rfm/types';

const root = path.resolve(import.meta.dirname, '..');
const uci = Papa.parse<RawTransaction>(readFileSync(path.join(root, 'thesis', 'data', 'online_retail.csv'), 'latin1'),
  { header: true, skipEmptyLines: true }).data;

const rows: string[][] = [['Dataset', 'Customers', 'Cutoff', 'Days ahead', 'Bought again (%)', 'AUC, BG/NBD expected orders',
  'AUC, past orders per week', 'Predicted purchases', 'Actual purchases', 'Predicted spend', 'Actual spend', 'Seconds']];
for (const [name, raw] of [['UCI Online Retail (UK, 2010-11)', uci], ['Daraz BD sample (app demo)', DARAZ_BD_RAW_TRANSACTIONS]] as const) {
  const { cleanedRows } = stitchAndCleanData(raw as RawTransaction[], autoDetectColumnMapping(Object.keys(raw[0])));
  const t = performance.now();
  const c = checkBehaviourModel(cleanedRows, 90);
  const s = (performance.now() - t) / 1000;
  if (!c) { console.log(name, ': not enough history'); continue; }
  console.log(name, c, `${s.toFixed(1)} s`);
  rows.push([name, String(c.customers), c.cutoff, String(c.horizonDays), c.boughtAgainPct.toFixed(1), c.auc.toFixed(3),
    c.baselineAuc.toFixed(3), c.predictedOrders.toFixed(0), String(c.actualOrders), c.predictedSpend.toFixed(0),
    c.actualSpend.toFixed(0), s.toFixed(1)]);
}
writeFileSync(path.join(root, 'thesis', 'outputs', 'tables', 't_app_prediction.csv'),
  rows.map((r) => r.map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n') + '\n');
