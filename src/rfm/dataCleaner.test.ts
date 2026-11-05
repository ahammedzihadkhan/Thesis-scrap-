import test from 'node:test';
import assert from 'node:assert/strict';
import { autoCleanDataset, parseNumber, cleanPhone, csvSafe, banglaToAsciiDigits, detectDayFirst } from './dataCleaner';
import { autoDetectColumnMapping, stitchAndCleanData } from './identityStitcher';

test('number, phone and digit helpers', () => {
  assert.equal(parseNumber('৳ 1,250.50'), 1250.5);
  assert.equal(parseNumber('Tk 900'), 900);
  assert.equal(parseNumber('(120)'), -120);
  assert.equal(parseNumber('১২০০'), 1200);
  assert.equal(parseNumber('abc'), null);
  assert.equal(cleanPhone('+880 1711-234567'), '01711234567');
  assert.equal(cleanPhone('1711234567'), '01711234567', 'Excel dropped the leading zero');
  assert.equal(cleanPhone('8.80171E+12'), null, 'scientific notation cannot be recovered');
  assert.equal(banglaToAsciiDigits('০১৭১১'), '01711');
});

test('csvSafe neutralises spreadsheet formulas but keeps negative numbers', () => {
  assert.equal(csvSafe('=HYPERLINK("http://x")'), `'=HYPERLINK("http://x")`);
  assert.equal(csvSafe('@SUM(A1)'), `'@SUM(A1)`);
  assert.equal(csvSafe('-120'), '-120');
  assert.equal(csvSafe('Rahim'), 'Rahim');
});

test('autoCleanDataset tidies a messy shop export end to end', () => {
  const messy = [
    { ' Order ID ': '1001.0', 'Order Date': '05/01/2024 10:30', 'Customer Phone': '+8801711234567', 'Email': ' Rahim@Gmail.COM ', 'Qty': '২', 'Price': '৳ 1,200', 'Notes': '' },
    { ' Order ID ': '1001.0', 'Order Date': '05/01/2024 10:30', 'Customer Phone': '8801711234567', 'Email': 'rahim@gmail.com', 'Qty': '2', 'Price': '1200', 'Notes': '' },
    { ' Order ID ': '1002', 'Order Date': 'N/A', 'Customer Phone': '01811000000', 'Email': 'bad-email', 'Qty': '1', 'Price': '500', 'Notes': '' },
    { ' Order ID ': '1003', 'Order Date': '45300', 'Customer Phone': '1911000000', 'Email': '', 'Qty': '-1', 'Price': '300', 'Notes': '' },
    { ' Order ID ': '', 'Order Date': '', 'Customer Phone': '', 'Email': '', 'Qty': '', 'Price': '', 'Notes': '' },
  ];
  const { rows, report } = autoCleanDataset(messy);
  const step = (r: string) => report.steps.find((s) => s.rule.startsWith(r))!.affected;

  assert.equal(report.rowsIn, 5);
  assert.equal(step('Empty rows'), 1);
  assert.equal(step('Empty columns'), 1, '"Notes" is empty everywhere');
  assert.equal(step('Rows without a readable order date'), 1);
  assert.equal(step('Exact duplicate'), 1, 'row 2 equals row 1 once formatted');
  assert.equal(rows.length, 2);

  const [a, b] = rows as Record<string, string>[];
  assert.deepEqual(Object.keys(a), ['Order ID', 'Order Date', 'Customer Phone', 'Email', 'Qty', 'Price']);
  assert.equal(a['Order ID'], '1001');
  assert.equal(a['Customer Phone'], '01711234567');
  assert.equal(a['Email'], 'rahim@gmail.com');
  assert.equal(a['Qty'], '2');
  assert.equal(a['Price'], '1200');
  assert.match(a['Order Date'], /^2024-\d\d-\d\d 10:30:00$/);
  assert.equal(b['Order Date'].slice(0, 10), '2024-01-09', 'Excel serial 45300 (45292 = 2024-01-01)');
  assert.equal(b['Customer Phone'], '01911000000');
  assert.ok(report.warnings.some((w) => w.includes('negative')), 'returns are flagged, not silently dropped');

  // The cleaned table must flow straight into the segmentation pipeline.
  const { cleanedRows } = stitchAndCleanData(rows, autoDetectColumnMapping(Object.keys(a)));
  assert.equal(cleanedRows.length, 1, 'the negative-quantity return is excluded by the pipeline');
});

test('date order is detected per column; ambiguous columns default to day-first', () => {
  assert.deepEqual(detectDayFirst(['12/1/2010 8:26', '12/13/2010 9:00']), { dayFirst: false, ambiguous: false }, 'UCI style is month-first');
  assert.deepEqual(detectDayFirst(['25/01/2024', '05/02/2024']), { dayFirst: true, ambiguous: false });
  assert.deepEqual(detectDayFirst(['05/01/2024', '12/02/2024']), { dayFirst: true, ambiguous: true });

  const bd = autoCleanDataset([{ 'Order Date': '05/01/2024' }, { 'Order Date': '12/02/2024' }]);
  assert.equal((bd.rows[0] as any)['Order Date'], '2024-01-05 00:00:00');
  assert.ok(bd.report.warnings.some((w) => w.includes('day/month')));
  const us = autoCleanDataset([{ 'Order Date': '05/01/2024' }, { 'Order Date': '12/02/2024' }], { dateOrder: 'month-first' });
  assert.equal((us.rows[0] as any)['Order Date'], '2024-05-01 00:00:00');
  const uci = autoCleanDataset([{ InvoiceDate: '12/1/2010 8:26' }, { InvoiceDate: '12/13/2010 9:00' }]);
  assert.equal((uci.rows[0] as any).InvoiceDate, '2010-12-01 08:26:00');
});
