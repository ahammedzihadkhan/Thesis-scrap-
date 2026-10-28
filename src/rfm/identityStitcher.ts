import {
  RawTransaction,
  ColumnMapping,
  CleanedTransaction,
  DataHygieneStats,
} from './types';

/**
 * Normalizes phone numbers across Bangladeshi (+880), UK (+44), US (+1), and generic formats.
 * Removes spaces, dashes, plus signs, brackets, and uniformizes BD mobile 01X numbers.
 */
export function normalizePhoneNumber(rawPhone?: any): string | undefined {
  if (rawPhone === undefined || rawPhone === null) return undefined;
  const str = String(rawPhone).trim();
  if (!str || str.toLowerCase() === 'nan' || str.toLowerCase() === 'null') return undefined;

  // Remove non-digit characters except leading plus
  let cleaned = str.replace(/[^\d+]/g, '');

  // Strip international prefix for Bangladesh e.g. +88017... or 88017... or 0088017...
  if (cleaned.startsWith('+880')) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.startsWith('00880')) {
    cleaned = '0' + cleaned.substring(5);
  } else if (cleaned.startsWith('880')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If only digits remain and length is sensible (at least 7 digits)
  if (/^\d{7,15}$/.test(cleaned)) {
    return cleaned;
  }

  return cleaned.length > 5 ? cleaned : undefined;
}

/**
 * Normalizes email address
 */
export function normalizeEmail(rawEmail?: any): string | undefined {
  if (rawEmail === undefined || rawEmail === null) return undefined;
  const str = String(rawEmail).trim().toLowerCase();
  if (!str || str === 'nan' || str === 'null' || !str.includes('@')) return undefined;
  return str;
}

/**
 * Normalizes Facebook Profile ID, Messenger PSID, or m.me link
 * e.g. "https://m.me/tanvir.dhaka" -> "m.me/tanvir.dhaka" or username
 */
export function normalizeMessengerId(rawId?: any): string | undefined {
  if (rawId === undefined || rawId === null) return undefined;
  let str = String(rawId).trim();
  if (!str || str.toLowerCase() === 'nan' || str.toLowerCase() === 'null' || str.toLowerCase() === 'n/a') return undefined;
  // Strip url prefixes
  str = str.replace(/^https?:\/\/(www\.)?facebook\.com\//i, '');
  str = str.replace(/^https?:\/\/m\.me\//i, '');
  str = str.replace(/^m\.me\//i, '');
  str = str.replace(/[/?#].*$/, ''); // remove query params
  str = str.trim();
  return str.length > 2 ? `m.me/${str}` : undefined;
}

/**
 * Auto-detects columns from raw dataset headers using fuzzy keyword matching
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const findMatch = (keywords: string[]): string => {
    for (const kw of keywords) {
      const match = headers.find((h) =>
        h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(kw.toLowerCase().replace(/[^a-z0-9]/g, ''))
      );
      if (match) return match;
    }
    return '';
  };

  const orderIdCol = findMatch(['invoiceno', 'invoice_no', 'orderid', 'order_id', 'receipt', 'invoice', 'id']);
  const timestampCol = findMatch(['invoicedate', 'invoice_date', 'orderdate', 'order_date', 'created_at', 'date', 'timestamp']);
  const customerCol = findMatch(['customerid', 'customer_id', 'userid', 'user_id', 'client_id', 'account_id']);
  const phoneCol = findMatch(['whatsappphone', 'whatsapp_phone', 'phone', 'mobile', 'whatsapp', 'cell', 'contact_no', 'telephone', 'ph']);
  const messengerCol = findMatch(['facebookprofileid', 'facebook_id', 'messenger_id', 'messenger', 'facebook', 'fbid', 'profile_id', 'm.me', 'page_id', 'fb']);
  const emailCol = findMatch(['email', 'customer_email', 'mail', 'user_email']);
  const productCol = findMatch(['stockcode', 'stock_code', 'product_id', 'item_code', 'sku', 'description', 'product_name', 'item_name', 'items']);
  
  const quantityCol = findMatch(['quantity', 'qty', 'count', 'units', 'pieces']);
  const unitPriceCol = findMatch(['unitprice', 'unit_price', 'price', 'rate', 'item_price']);
  const totalAmountCol = findMatch(['totalamount', 'total_amount', 'total_price', 'total', 'order_total', 'amount', 'grand_total', 'subtotal']);

  const hasQtyAndPrice = Boolean(quantityCol && unitPriceCol);
  const revenueMode: 'quantity_price' | 'total_amount' = hasQtyAndPrice || !totalAmountCol ? 'quantity_price' : 'total_amount';

  return {
    orderIdCol: orderIdCol || headers[0] || '',
    timestampCol: timestampCol || headers[1] || '',
    customerCol: customerCol || '',
    phoneCol: phoneCol || '',
    messengerCol: messengerCol || '',
    emailCol: emailCol || '',
    productCol: productCol || '',
    revenueMode,
    quantityCol: quantityCol || '',
    unitPriceCol: unitPriceCol || '',
    totalAmountCol: totalAmountCol || '',
  };
}

/**
 * Parses raw dates into valid JavaScript Date objects. Handles ISO strings, timestamps, DD/MM/YYYY, MM/DD/YYYY.
 */
export function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  const str = String(val).trim();
  if (!str) return null;

  // Try direct parse
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try ISO with T replacement (e.g., '2024-01-02 08:30:00' -> '2024-01-02T08:30:00')
  if (str.includes(' ')) {
    let dIso = new Date(str.replace(' ', 'T'));
    if (!isNaN(dIso.getTime())) return dIso;
  }

  // Try parts breakdown
  const parts = str.split(/[ /:\-T]/).filter(Boolean);
  if (parts.length >= 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    const p3 = parts[3] ? parseInt(parts[3], 10) : 0;
    const p4 = parts[4] ? parseInt(parts[4], 10) : 0;
    const p5 = parts[5] ? parseInt(parts[5], 10) : 0;

    // Format: YYYY-MM-DD HH:mm:ss
    if (p0 > 1000) {
      d = new Date(p0, p1 - 1, p2, p3, p4, p5);
      if (!isNaN(d.getTime())) return d;
    }

    // Format: DD/MM/YYYY or MM/DD/YYYY
    if (p2 > 1000) {
      if (p0 > 12) {
        // DD/MM/YYYY
        d = new Date(p2, p1 - 1, p0, p3, p4, p5);
      } else {
        // MM/DD/YYYY
        d = new Date(p2, p0 - 1, p1, p3, p4, p5);
      }
      if (!isNaN(d.getTime())) return d;
    }
  }

  return null;
}

/**
 * Zero-Account Guest Identity Stitcher & Data Hygiene Pipeline
 */
export function stitchAndCleanData(
  rows: RawTransaction[],
  mapping: ColumnMapping
): {
  cleanedRows: CleanedTransaction[];
  stats: DataHygieneStats;
} {
  let cancelledCount = 0;
  let invalidCount = 0;
  const cleanedRows: CleanedTransaction[] = [];
  const filteredRecords: import('./types').FilteredRecordDetail[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rawOrderId = r[mapping.orderIdCol];
    if (rawOrderId === undefined || rawOrderId === null || String(rawOrderId).trim() === '') {
      invalidCount++;
      filteredRecords.push({
        orderId: `ROW-${i + 1}`,
        reason: 'missing_order_id',
        reasonLabel: 'Missing or Empty Order ID',
        rawSnippet: JSON.stringify(r).slice(0, 120),
      });
      continue;
    }

    const orderIdStr = String(rawOrderId).trim();
    const isCancelFlag =
      orderIdStr.toUpperCase().startsWith('C') ||
      String(r.status || '').toLowerCase().includes('cancel') ||
      String(r.customer_name || '').toLowerCase().includes('cancel') ||
      String(r.Description || '').toLowerCase().includes('cancel');

    // Parse date
    const parsedDate = parseDate(r[mapping.timestampCol]);
    if (!parsedDate) {
      invalidCount++;
      filteredRecords.push({
        orderId: orderIdStr,
        reason: 'invalid_date',
        reasonLabel: `Invalid / Unparseable Timestamp (${r[mapping.timestampCol] || 'empty'})`,
        rawSnippet: JSON.stringify(r).slice(0, 120),
      });
      continue;
    }

    // Revenue calculation
    let totalAmount = 0;
    let qty = 1;
    let unitPrice = 0;

    if (mapping.revenueMode === 'quantity_price') {
      qty = parseFloat(r[mapping.quantityCol]);
      unitPrice = parseFloat(r[mapping.unitPriceCol]);

      if (isNaN(qty) || isNaN(unitPrice)) {
        invalidCount++;
        filteredRecords.push({
          orderId: orderIdStr,
          reason: 'corrupt_data',
          reasonLabel: `Corrupt numeric values (Qty: ${r[mapping.quantityCol]}, Price: ${r[mapping.unitPriceCol]})`,
          rawSnippet: JSON.stringify(r).slice(0, 120),
        });
        continue;
      }

      if (isCancelFlag || qty < 0 || unitPrice < 0) {
        cancelledCount++;
        filteredRecords.push({
          orderId: orderIdStr,
          reason: isCancelFlag ? 'cancelled_order' : 'negative_amount',
          reasonLabel: isCancelFlag ? 'Cancelled / Returned Transaction' : `Negative Qty/Price (${qty} x ${unitPrice})`,
          rawSnippet: JSON.stringify(r).slice(0, 120),
        });
        continue;
      }
      if (qty === 0 || unitPrice === 0) {
        invalidCount++;
        filteredRecords.push({
          orderId: orderIdStr,
          reason: 'zero_amount',
          reasonLabel: `Zero Quantity or Zero Price (${qty} x ${unitPrice})`,
          rawSnippet: JSON.stringify(r).slice(0, 120),
        });
        continue;
      }
      totalAmount = qty * unitPrice;
    } else {
      totalAmount = parseFloat(r[mapping.totalAmountCol]);
      if (isNaN(totalAmount)) {
        invalidCount++;
        filteredRecords.push({
          orderId: orderIdStr,
          reason: 'corrupt_data',
          reasonLabel: `Corrupt total amount (${r[mapping.totalAmountCol]})`,
          rawSnippet: JSON.stringify(r).slice(0, 120),
        });
        continue;
      }

      if (isCancelFlag || totalAmount < 0) {
        cancelledCount++;
        filteredRecords.push({
          orderId: orderIdStr,
          reason: isCancelFlag ? 'cancelled_order' : 'negative_amount',
          reasonLabel: isCancelFlag ? 'Cancelled / Returned Transaction' : `Negative Total (${totalAmount})`,
          rawSnippet: JSON.stringify(r).slice(0, 120),
        });
        continue;
      }
      if (totalAmount === 0) {
        invalidCount++;
        filteredRecords.push({
          orderId: orderIdStr,
          reason: 'zero_amount',
          reasonLabel: 'Zero Total Order Amount',
          rawSnippet: JSON.stringify(r).slice(0, 120),
        });
        continue;
      }
      unitPrice = totalAmount;
    }

    // Extract identifiers
    const rawCustName = String(r.customer_name || r.CustomerName || r.customer || r.name || r.buyer_name || '').trim();
    let rawCustId = mapping.customerCol ? r[mapping.customerCol] : undefined;
    let custIdStr = rawCustId !== undefined && rawCustId !== null ? String(rawCustId).trim() : '';
    if (custIdStr.toLowerCase() === 'nan' || custIdStr.toLowerCase() === 'null' || custIdStr === '') {
      custIdStr = '';
    }

    const normPhone = mapping.phoneCol ? normalizePhoneNumber(r[mapping.phoneCol]) : undefined;
    const normEmail = mapping.emailCol ? normalizeEmail(r[mapping.emailCol]) : undefined;
    const rawMessenger = mapping.messengerCol ? r[mapping.messengerCol] : (r.facebookProfileId || r.facebook_id || r.messenger_id || r.facebook_profile || undefined);
    const normMessenger = normalizeMessengerId(rawMessenger);

    // Channel detection
    const rawChannel = String(r.orderChannel || r.channel || '').toLowerCase();
    const isMessengerChannel = rawChannel.includes('messenger') || rawChannel.includes('facebook') || (!normPhone && !!normMessenger);
    const orderChannel: 'WhatsApp' | 'Facebook Messenger' | 'Facebook Page Direct' =
      isMessengerChannel ? 'Facebook Messenger' : (normPhone ? 'WhatsApp' : 'Facebook Messenger');
    const preferredChannel: 'whatsapp' | 'messenger' = normPhone ? 'whatsapp' : 'messenger';

    // Unified customer key resolution priority chain:
    // 1. CustomerID (if present and not a generic guest token)
    // 2. Normalized Phone (WhatsApp)
    // 3. Normalized Messenger ID / Facebook Handle (F-Commerce Fallback when phone is missing!)
    // 4. Normalized Email
    // 5. Guest fallback to order ID
    let unifiedKey = '';
    let isGuest = false;

    if (custIdStr && !custIdStr.startsWith('m.me/')) {
      unifiedKey = `cust_${custIdStr}`;
    } else if (normPhone) {
      unifiedKey = `phone_${normPhone}`;
      isGuest = true;
    } else if (normMessenger) {
      unifiedKey = `fb_${normMessenger.replace(/^m\.me\//, '').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      isGuest = true;
    } else if (normEmail) {
      unifiedKey = `email_${normEmail}`;
      isGuest = true;
    } else {
      unifiedKey = `guest_order_${orderIdStr}`;
      isGuest = true;
    }

    const sku = mapping.productCol ? String(r[mapping.productCol] || `sku_${orderIdStr}`).trim() : `order_${orderIdStr}`;

    cleanedRows.push({
      orderId: orderIdStr,
      timestamp: parsedDate,
      dateStr: parsedDate.toISOString().slice(0, 10),
      customerName: rawCustName || undefined,
      customerId: custIdStr || undefined,
      phone: normPhone,
      normalizedPhone: normPhone,
      email: normEmail,
      normalizedEmail: normEmail,
      messengerId: normMessenger,
      facebookProfileId: normMessenger,
      orderChannel,
      preferredChannel,
      unifiedKey,
      isGuest,
      sku,
      quantity: qty,
      unitPrice,
      totalAmount,
    });
  }

  // Count repeat guest buyers recovered via phone/email/messenger
  const ordersByKey = new Map<string, Set<string>>();
  const guestKeys = new Set<string>();
  const registeredKeys = new Set<string>();
  const guestOrderDetails = new Map<string, {
    customerName?: string;
    channel: 'WhatsApp' | 'Facebook Messenger' | 'Email' | 'Guest Order';
    identifier: string;
    orders: Set<string>;
    totalSpent: number;
    dates: Date[];
  }>();

  let phoneIdentifiedCount = 0;
  let messengerIdentifiedCount = 0;
  let emailIdentifiedCount = 0;
  let registeredAccountIdCount = 0;
  let fallbackGuestCount = 0;

  for (const row of cleanedRows) {
    if (!ordersByKey.has(row.unifiedKey)) {
      ordersByKey.set(row.unifiedKey, new Set());
    }
    ordersByKey.get(row.unifiedKey)!.add(row.orderId);

    if (row.isGuest) {
      guestKeys.add(row.unifiedKey);

      let channel: 'WhatsApp' | 'Facebook Messenger' | 'Email' | 'Guest Order' = 'Guest Order';
      let identifier = row.orderId;
      if (row.phone) {
        channel = 'WhatsApp';
        identifier = row.phone;
        phoneIdentifiedCount++;
      } else if (row.messengerId) {
        channel = 'Facebook Messenger';
        identifier = row.messengerId;
        messengerIdentifiedCount++;
      } else if (row.email) {
        channel = 'Email';
        identifier = row.email;
        emailIdentifiedCount++;
      } else {
        fallbackGuestCount++;
      }

      if (!guestOrderDetails.has(row.unifiedKey)) {
        guestOrderDetails.set(row.unifiedKey, {
          customerName: row.customerName || row.phone || row.messengerId || row.email || `Guest #${row.orderId}`,
          channel,
          identifier,
          orders: new Set(),
          totalSpent: 0,
          dates: [],
        });
      }
      const gEntry = guestOrderDetails.get(row.unifiedKey)!;
      if (row.customerName && (!gEntry.customerName || gEntry.customerName.startsWith('01') || gEntry.customerName.startsWith('+'))) {
        gEntry.customerName = row.customerName;
      }
      gEntry.orders.add(row.orderId);
      gEntry.totalSpent += row.totalAmount;
      gEntry.dates.push(row.timestamp);
    } else {
      registeredKeys.add(row.unifiedKey);
      registeredAccountIdCount++;
    }
  }

  let repeatGuestBuyersRecovered = 0;
  const recoveredGuests: import('./types').RecoveredGuestDetail[] = [];

  for (const [gKey, gDetail] of guestOrderDetails.entries()) {
    if (gDetail.orders.size >= 2) {
      repeatGuestBuyersRecovered++;
      const sortedDates = [...gDetail.dates].sort((a, b) => a.getTime() - b.getTime());
      recoveredGuests.push({
        unifiedKey: gKey,
        customerName: gDetail.customerName,
        channel: gDetail.channel,
        identifier: gDetail.identifier,
        orderCount: gDetail.orders.size,
        totalSpent: Math.round(gDetail.totalSpent * 100) / 100,
        firstOrderDate: sortedDates[0]?.toISOString().slice(0, 10) || '',
        lastOrderDate: sortedDates[sortedDates.length - 1]?.toISOString().slice(0, 10) || '',
      });
    }
  }

  // Sort recovered guests by total spend descending
  recoveredGuests.sort((a, b) => b.totalSpent - a.totalSpent);

  const uniqueCustomers = ordersByKey.size;
  const guestOnlyCount = guestKeys.size;
  const registeredUserCount = registeredKeys.size;
  const guestSharePct = uniqueCustomers > 0 ? (guestOnlyCount / uniqueCustomers) * 100 : 0;
  const dataPurityPct = rows.length > 0 ? Math.round((cleanedRows.length / rows.length) * 1000) / 10 : 100;

  const stats: DataHygieneStats = {
    totalRawRows: rows.length,
    validIdentifiedRows: cleanedRows.length,
    cancelledRowsRemoved: cancelledCount,
    duplicateOrInvalidRowsRemoved: invalidCount,
    uniqueCustomers,
    repeatGuestBuyersRecovered,
    guestOnlyCount,
    registeredUserCount,
    guestSharePct,
    phoneIdentifiedCount,
    messengerIdentifiedCount,
    emailIdentifiedCount,
    registeredAccountIdCount,
    fallbackGuestCount,
    dataPurityPct,
    filteredRecords,
    recoveredGuests,
  };

  return { cleanedRows, stats };
}
