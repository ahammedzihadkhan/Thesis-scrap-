import { RawTransaction } from './types';

/**
 * Generates a realistic sample of the Canonical UCI Online Retail Dataset
 */
export function generateUCIOnlineRetailSample(): RawTransaction[] {
  const products = [
    { code: '85123A', desc: 'WHITE HANGING HEART T-LIGHT HOLDER', price: 2.55 },
    { code: '71053', desc: 'WHITE METAL LANTERN', price: 3.39 },
    { code: '84406B', desc: 'CREAM CUPID HEARTS COAT HANGER', price: 2.75 },
    { code: '84029G', desc: 'KNITTED UNION FLAG HOT WATER BOTTLE', price: 3.39 },
    { code: '84029E', desc: 'RED WOOLLY HOTTIE WHITE HEART.', price: 3.39 },
    { code: '22752', desc: 'SET 7 BABUSHKA NESTING BOXES', price: 7.65 },
    { code: '21730', desc: 'GLASS STAR FROSTED T-LIGHT HOLDER', price: 4.25 },
    { code: '22632', desc: 'HAND WARMER RED RETROSPOT', price: 1.85 },
    { code: '22633', desc: 'HAND WARMER UNION JACK', price: 1.85 },
    { code: '22865', desc: 'HAND WARMER OWL DESIGN', price: 2.10 },
    { code: '22666', desc: 'RECIPE BOX PANTRY DESIGN', price: 7.95 },
    { code: '22910', desc: 'PAPER CHAIN KIT VINTAGE CHRISTMAS', price: 2.55 },
    { code: '22386', desc: 'JUMBO BAG PINK POLKADOT', price: 1.95 },
    { code: '85099B', desc: 'JUMBO BAG RED RETROSPOT', price: 1.95 },
    { code: '23203', desc: 'JUMBO BAG DOILEY PATTERNS', price: 1.95 },
    { code: '20725', desc: 'LUNCH BAG RED RETROSPOT', price: 1.65 },
    { code: '20727', desc: 'LUNCH BAG BLACK SKULL', price: 1.65 },
    { code: '20728', desc: 'LUNCH BAG CARS BLUE', price: 1.65 },
    { code: '22423', desc: 'REGENCY CAKESTAND 3 TIER', price: 12.75 },
    { code: '47566', desc: 'PARTY BUNTING', price: 4.95 },
  ];

  const customers = [
    // Champions: high repeat, large orders
    { id: '17850', weight: 8, baseQty: 12, country: 'United Kingdom' },
    { id: '13047', weight: 7, baseQty: 8, country: 'United Kingdom' },
    { id: '12583', weight: 6, baseQty: 10, country: 'France' },
    { id: '14688', weight: 6, baseQty: 9, country: 'United Kingdom' },
    { id: '15311', weight: 7, baseQty: 14, country: 'United Kingdom' },
    { id: '12431', weight: 5, baseQty: 7, country: 'Australia' },
    // Loyal regulars
    { id: '16029', weight: 4, baseQty: 5, country: 'United Kingdom' },
    { id: '17511', weight: 5, baseQty: 6, country: 'United Kingdom' },
    { id: '13408', weight: 4, baseQty: 4, country: 'United Kingdom' },
    { id: '14911', weight: 6, baseQty: 7, country: 'EIRE' },
    { id: '17841', weight: 5, baseQty: 3, country: 'United Kingdom' },
    { id: '14298', weight: 4, baseQty: 6, country: 'United Kingdom' },
    // High-potential / at-risk
    { id: '15808', weight: 2, baseQty: 3, country: 'United Kingdom' },
    { id: '13705', weight: 2, baseQty: 4, country: 'United Kingdom' },
    { id: '16684', weight: 2, baseQty: 6, country: 'United Kingdom' },
    { id: '14156', weight: 3, baseQty: 5, country: 'EIRE' },
    { id: '18102', weight: 3, baseQty: 12, country: 'United Kingdom' },
    // Hibernating / single buyers
    { id: '17924', weight: 1, baseQty: 2, country: 'United Kingdom' },
    { id: '12748', weight: 2, baseQty: 2, country: 'United Kingdom' },
    { id: '15159', weight: 1, baseQty: 1, country: 'United Kingdom' },
    { id: '16210', weight: 1, baseQty: 2, country: 'United Kingdom' },
    { id: '17757', weight: 1, baseQty: 1, country: 'United Kingdom' },
    { id: '15061', weight: 1, baseQty: 2, country: 'United Kingdom' },
    { id: '14096', weight: 1, baseQty: 3, country: 'United Kingdom' },
    { id: '16012', weight: 1, baseQty: 1, country: 'United Kingdom' },
    { id: '13798', weight: 1, baseQty: 2, country: 'United Kingdom' },
    { id: '15769', weight: 1, baseQty: 1, country: 'United Kingdom' },
  ];

  const rows: RawTransaction[] = [];
  const baseDate = new Date('2023-12-01T08:26:00Z');
  let invoiceCounter = 536365;

  // Generate 450 realistic transactions spanning 12 months
  for (const cust of customers) {
    const orderCount = Math.max(1, Math.round(cust.weight * 2.5));
    for (let o = 0; o < orderCount; o++) {
      // Days spread: Champions shop up to recent dates; hibernating shopped 200-360 days ago
      let dayOffset = 0;
      if (cust.weight >= 6) {
        dayOffset = Math.floor(o * (330 / orderCount) + (Math.random() * 20));
      } else if (cust.weight >= 4) {
        dayOffset = Math.floor(o * (280 / orderCount) + 15);
      } else if (cust.weight >= 2) {
        dayOffset = Math.floor(o * 60 + 120 + Math.random() * 50);
      } else {
        dayOffset = Math.floor(Math.random() * 80 + 10); // Hibernating early in the year
      }

      const orderDate = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const invoiceNo = String(invoiceCounter++);

      // 1 to 4 items per invoice
      const itemsInInvoice = Math.floor(Math.random() * 3) + 1;
      const shuffled = [...products].sort(() => 0.5 - Math.random()).slice(0, itemsInInvoice);

      for (const prod of shuffled) {
        const qty = Math.max(1, Math.round(cust.baseQty * (0.8 + Math.random() * 0.5)));
        rows.push({
          InvoiceNo: invoiceNo,
          StockCode: prod.code,
          Description: prod.desc,
          Quantity: qty,
          InvoiceDate: orderDate.toISOString().replace('T', ' ').slice(0, 19),
          UnitPrice: prod.price,
          CustomerID: cust.id,
          Country: cust.country,
        });
      }
    }
  }

  // Add a few cancelled / negative records to test data hygiene resolution!
  rows.push({
    InvoiceNo: 'C536379',
    StockCode: 'D',
    Description: 'Discount',
    Quantity: -1,
    InvoiceDate: '2023-12-01 09:41:00',
    UnitPrice: 27.5,
    CustomerID: '14688',
    Country: 'United Kingdom',
  });
  rows.push({
    InvoiceNo: 'C536383',
    StockCode: '35004C',
    Description: 'SET OF 3 COLOURED  FLYING DUCKS',
    Quantity: -1,
    InvoiceDate: '2023-12-01 09:49:00',
    UnitPrice: 4.65,
    CustomerID: '15311',
    Country: 'United Kingdom',
  });

  return rows;
}

/**
 * Generates a realistic Bangladeshi WhatsApp & Facebook Commerce Shop Order Log
 * Includes guests without account IDs, Bangladeshi mobile numbers (+88017...), local products, and BDT prices.
 */
export function generateBangladeshiWhatsAppShopSample(): RawTransaction[] {
  const localProducts = [
    { name: 'Pure Handloom Dhakai Jamdani Saree', sku: 'JAM-DHK-01', price: 4850 },
    { name: 'Executive Silk Festive Panjabi (Royal Navy)', sku: 'PAN-SLK-08', price: 2950 },
    { name: 'Tangail Organic Handspun Cotton Saree', sku: 'TAN-COT-03', price: 2150 },
    { name: 'Sundarban Raw Wild Forest Honey (500g)', sku: 'HNY-SND-500', price: 780 },
    { name: 'Handcrafted Nakshi Kantha Quilt (Queen)', sku: 'NKH-QNT-02', price: 3450 },
    { name: 'Cold-Pressed Mustard Oil (Wood-churned 1L)', sku: 'OIL-MST-1000', price: 420 },
    { name: 'Rajshahi Pure Silk Floral Dupatta', sku: 'DUP-RJH-05', price: 1650 },
    { name: 'Chittagong Hill Tracts Organic Turmeric (250g)', sku: 'SPC-TUR-250', price: 320 },
    { name: 'Handmade Clay Terracotta Tea Cup Set (6 pcs)', sku: 'TER-CUP-06', price: 850 },
    { name: 'Traditional Kalojeera Aromatic Rice (5kg)', sku: 'RCE-KAL-5KG', price: 890 },
  ];

  // Customers representing realistic scenarios:
  // - Some have registered account ID
  // - Many are pure WhatsApp/Facebook guest checkouts with +8801... phone numbers!
  // - Some guests buy repeatedly across months using same WhatsApp number -> RECOVERED GUESTS!
  const buyerProfiles = [
    // Champions: repeat buyers via WhatsApp & accounts
    {
      name: 'Nusrat Jahan',
      phone: '+8801711234567',
      email: 'nusrat.jahan@gmail.com',
      accId: 'CUST-BD-01',
      orders: 7,
      baseQty: 2,
      recencyDays: 8,
    },
    {
      name: 'Tanvir Ahmed',
      phone: '01819876543',
      email: 'tanvir.ahmed@yahoo.com',
      accId: '', // Guest with repeat purchases!
      orders: 6,
      baseQty: 3,
      recencyDays: 14,
    },
    {
      name: 'Farhana Sultana',
      phone: '+8801914556677',
      email: 'farhana.sultana@hotmail.com',
      accId: 'CUST-BD-03',
      orders: 5,
      baseQty: 2,
      recencyDays: 21,
    },
    // Loyal regulars
    {
      name: 'Dr. Rafiqul Islam',
      phone: '8801723445566',
      email: 'dr.rafiq@dhaka-med.org',
      accId: 'CUST-BD-04',
      orders: 4,
      baseQty: 2,
      recencyDays: 32,
    },
    {
      name: 'Sadia Rahman',
      phone: '+8801612334455',
      email: '',
      accId: '', // Guest recovered by phone!
      orders: 4,
      baseQty: 1,
      recencyDays: 45,
    },
    {
      name: 'Mahmudul Hasan',
      phone: '01755112233',
      email: 'mahmud.hasan@brac.net',
      accId: '',
      orders: 3,
      baseQty: 2,
      recencyDays: 52,
    },
    {
      name: 'Ayesha Siddiqua',
      phone: '+8801844998877',
      email: 'ayesha.siddiqua@gmail.com',
      accId: 'CUST-BD-07',
      orders: 3,
      baseQty: 2,
      recencyDays: 60,
    },
    // High-potential / at-risk guests
    {
      name: 'Kazi Moinuddin',
      phone: '+8801733667788',
      email: 'kazi.moin@corp.bd',
      accId: '',
      orders: 2,
      baseQty: 1,
      recencyDays: 110,
    },
    {
      name: 'Rumana Chowdhury',
      phone: '01922334455',
      email: 'rumana.chowdhury@gmail.com',
      accId: '',
      orders: 2,
      baseQty: 2,
      recencyDays: 125,
    },
    {
      name: 'Zubair Hossain',
      phone: '+8801811443322',
      email: '',
      accId: '',
      orders: 1,
      baseQty: 3, // High initial spend guest!
      recencyDays: 75,
    },
    {
      name: 'Shirin Akter',
      phone: '01712998877',
      email: 'shirin.akter@outlook.com',
      accId: '',
      orders: 2,
      baseQty: 1,
      recencyDays: 140,
    },
    // Hibernating / single-purchase guests
    {
      name: 'Imtiaz Alam',
      phone: '+8801977665544',
      email: 'imtiaz.alam@gmail.com',
      accId: '',
      orders: 1,
      baseQty: 1,
      recencyDays: 240,
    },
    {
      name: 'Nasrin Parvin',
      phone: '01833221100',
      email: '',
      accId: '',
      orders: 1,
      baseQty: 1,
      recencyDays: 285,
    },
    {
      name: 'Kamrul Hassan',
      phone: '+8801622334411',
      email: 'kamrul.h@dhaka.net',
      accId: '',
      orders: 1,
      baseQty: 1,
      recencyDays: 310,
    },
    {
      name: 'Tahmina Begum',
      phone: '01799887766',
      email: '',
      accId: '',
      orders: 1,
      baseQty: 1,
      recencyDays: 295,
    },
    {
      name: 'Saiful Islam',
      phone: '+8801933445566',
      email: 'saiful.islam.ctg@gmail.com',
      accId: '',
      orders: 1,
      baseQty: 1,
      recencyDays: 340,
    },
  ];

  const rows: RawTransaction[] = [];
  const referenceDate = new Date('2024-10-20T14:30:00Z');
  let invoiceCounter = 1001;

  for (const buyer of buyerProfiles) {
    for (let o = 0; o < buyer.orders; o++) {
      // Calculate realistic date based on recency and order count
      const daysAgo = buyer.recencyDays + o * 35;
      const orderDate = new Date(referenceDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const invoiceNo = `INV-BD-${invoiceCounter++}`;

      // Pick 1-3 local items
      const itemCount = Math.min(3, Math.floor(Math.random() * 2) + 1);
      const shuffled = [...localProducts].sort(() => 0.5 - Math.random()).slice(0, itemCount);

      for (const prod of shuffled) {
        const qty = buyer.baseQty;
        rows.push({
          order_id: invoiceNo,
          created_at: orderDate.toISOString().replace('T', ' ').slice(0, 19),
          customer_name: buyer.name,
          user_id: buyer.accId || '', // Demonstrates guest checkout with blank account
          whatsapp_phone: buyer.phone,
          customer_email: buyer.email,
          product_name: prod.name,
          sku: prod.sku,
          quantity: qty,
          unit_price: prod.price,
          total_price: qty * prod.price,
          channel: 'WhatsApp Shop / Dhaka POS',
          city: 'Dhaka',
        });
      }
    }
  }

  // Add 2 invalid/cancelled test rows
  rows.push({
    order_id: 'INV-BD-9999',
    created_at: '2024-05-10 11:20:00',
    customer_name: 'Cancelled Order Test',
    user_id: '',
    whatsapp_phone: '+8801700000000',
    customer_email: 'test@cancelled.com',
    product_name: 'Handloom Jamdani Saree',
    sku: 'JAM-DHK-01',
    quantity: -1,
    unit_price: 4850,
    total_price: -4850,
    channel: 'WhatsApp Shop',
    city: 'Chittagong',
  });

  return rows;
}

/**
 * Generates an extended synthetic dataset for a prominent Bangladeshi retail & lifestyle store
 * (e.g., Aarong / Artisan Boutique style) with 160+ order line items, 35+ customer profiles,
 * multi-district deliveries (Dhaka, Chittagong, Sylhet, Comilla, Rajshahi), and extensive guest checkouts.
 */
export function generateRichBangladeshiStoreSample(): RawTransaction[] {
  const catalog = [
    { name: 'Dhakai Muslin High-Count Jamdani Saree', sku: 'JAM-MSL-80', price: 12500, cat: 'Saree' },
    { name: 'Pure Handloom Dhakai Jamdani Saree (Red & Gold)', sku: 'JAM-DHK-01', price: 5200, cat: 'Saree' },
    { name: 'Tangail Taant Handspun Cotton Saree', sku: 'TAN-COT-03', price: 2450, cat: 'Saree' },
    { name: 'Pure Silk Wedding Katan Saree (Bridal Crimson)', sku: 'KAT-SLK-09', price: 18500, cat: 'Saree' },
    { name: 'Rajshahi Endi Silk Festive Panjabi (Royal Navy)', sku: 'PAN-SLK-08', price: 3850, cat: 'Panjabi' },
    { name: 'Hand-Embroidered Luxury Cotton Panjabi', sku: 'PAN-COT-14', price: 2650, cat: 'Panjabi' },
    { name: 'Men\'s Formal Royal Kabli Suit Set (Charcoal)', sku: 'KAB-SET-03', price: 5400, cat: 'Menswear' },
    { name: 'Pure Silk Handblock Floral Dupatta', sku: 'DUP-RJH-05', price: 1850, cat: 'Womenswear' },
    { name: 'Sundarban Raw Wild Mangrove Honey (500g)', sku: 'HNY-SND-500', price: 850, cat: 'Gourmet' },
    { name: 'Wood-Cold-Pressed Ghani Pure Mustard Oil (1L)', sku: 'OIL-MST-1000', price: 460, cat: 'Gourmet' },
    { name: 'Natore Traditional Cow Milk Ghee (400g)', sku: 'GHE-NAT-400', price: 980, cat: 'Gourmet' },
    { name: 'Aromatic Premium Dinajpur Kalijira Rice (5kg)', sku: 'RCE-KAL-5KG', price: 920, cat: 'Gourmet' },
    { name: 'Handcrafted Nakshi Kantha Quilt (Queen Bed)', sku: 'NKH-QNT-02', price: 4200, cat: 'Craft' },
    { name: 'Terracotta Clay Tea Kulhar Set of 6', sku: 'TER-CUP-06', price: 650, cat: 'Craft' },
    { name: 'Genuine Leather Executive Bi-Fold Wallet', sku: 'LTH-WLT-01', price: 1950, cat: 'Accessories' },
    { name: 'Chittagong Teakwood Hand-carved Coaster Set', sku: 'WOD-CST-04', price: 850, cat: 'Craft' },
  ];

  const extendedBuyers = [
    // Champions: Top spending VIPs with high order frequency
    { name: 'Nusrat Jahan', phone: '+8801711234567', email: 'nusrat.jahan@gmail.com', accId: 'CUST-DH-001', orders: 8, qty: 2, recency: 5, city: 'Dhaka (Gulshan)' },
    { name: 'Tanvir Ahmed', phone: '01819876543', email: 'tanvir.ahmed@yahoo.com', accId: '', orders: 7, qty: 3, recency: 9, city: 'Dhaka (Dhanmondi)' },
    { name: 'Farhana Sultana', phone: '+8801914556677', email: 'farhana.sultana@hotmail.com', accId: 'CUST-DH-003', orders: 6, qty: 2, recency: 12, city: 'Dhaka (Banani)' },
    { name: 'Mehnaz Haque', phone: '01713445566', email: 'mehnaz.haque@northsouth.edu', accId: '', orders: 6, qty: 2, recency: 15, city: 'Dhaka (Uttara)' },
    { name: 'Anisur Rahman', phone: '+8801819223344', email: 'anis.rahman@apex.com.bd', accId: 'CUST-CTG-005', orders: 5, qty: 3, recency: 18, city: 'Chittagong (Agrabad)' },

    // Loyal & Promising Regulars: Consistent repeat buyers
    { name: 'Dr. Rafiqul Islam', phone: '8801723445566', email: 'dr.rafiq@dhaka-med.org', accId: 'CUST-DH-006', orders: 5, qty: 2, recency: 25, city: 'Dhaka (Mirpur)' },
    { name: 'Sadia Rahman', phone: '+8801612334455', email: '', accId: '', orders: 4, qty: 1, recency: 32, city: 'Dhaka (Mohammadpur)' },
    { name: 'Mahmudul Hasan', phone: '01755112233', email: 'mahmud.hasan@brac.net', accId: '', orders: 4, qty: 2, recency: 38, city: 'Dhaka (Bashundhara)' },
    { name: 'Ayesha Siddiqua', phone: '+8801844998877', email: 'ayesha.siddiqua@gmail.com', accId: 'CUST-SYL-009', orders: 4, qty: 2, recency: 42, city: 'Sylhet (Zindabazar)' },
    { name: 'Tariqul Islam', phone: '+8801911887766', email: 'tariqul.islam@grameen.com', accId: '', orders: 3, qty: 2, recency: 48, city: 'Dhaka (Badda)' },
    { name: 'Dilruba Yasmin', phone: '01715667788', email: 'dilruba.y@comilla-univ.ac.bd', accId: 'CUST-COM-011', orders: 3, qty: 2, recency: 55, city: 'Comilla' },
    { name: 'Farid Uddin', phone: '+8801822334455', email: 'farid.uddin@ctg-port.gov.bd', accId: '', orders: 3, qty: 1, recency: 60, city: 'Chittagong (Nasirabad)' },

    // High-Potential / At-Risk Guests: Moderate spend, slipping recency or promising first-timers
    { name: 'Kazi Moinuddin', phone: '+8801733667788', email: 'kazi.moin@corp.bd', accId: '', orders: 2, qty: 1, recency: 95, city: 'Dhaka (Old Dhaka)' },
    { name: 'Rumana Chowdhury', phone: '01922334455', email: 'rumana.chowdhury@gmail.com', accId: '', orders: 2, qty: 2, recency: 110, city: 'Dhaka (Lalmatia)' },
    { name: 'Zubair Hossain', phone: '+8801811443322', email: '', accId: '', orders: 2, qty: 3, recency: 85, city: 'Chittagong (GEC)' },
    { name: 'Shirin Akter', phone: '01712998877', email: 'shirin.akter@outlook.com', accId: '', orders: 2, qty: 1, recency: 120, city: 'Rajshahi' },
    { name: 'Rezaul Karim', phone: '+8801611778899', email: 'rezaul.k@incepta.com', accId: '', orders: 2, qty: 2, recency: 105, city: 'Dhaka (Savar)' },
    { name: 'Nabila Ferdous', phone: '01799223344', email: 'nabila.ferdous@gmail.com', accId: 'CUST-DH-018', orders: 2, qty: 1, recency: 130, city: 'Dhaka (Khilgaon)' },
    { name: 'Sabbir Hossain', phone: '+8801988112233', email: 'sabbir.h@khulna.net', accId: '', orders: 1, qty: 4, recency: 70, city: 'Khulna' },

    // Hibernating / Lost Guests: Long inactivity or single purchase
    { name: 'Imtiaz Alam', phone: '+8801977665544', email: 'imtiaz.alam@gmail.com', accId: '', orders: 1, qty: 1, recency: 220, city: 'Dhaka (Motijheel)' },
    { name: 'Nasrin Parvin', phone: '01833221100', email: '', accId: '', orders: 1, qty: 1, recency: 250, city: 'Chittagong (Pahartali)' },
    { name: 'Kamrul Hassan', phone: '+8801622334411', email: 'kamrul.h@dhaka.net', accId: '', orders: 1, qty: 1, recency: 280, city: 'Dhaka (Tejgaon)' },
    { name: 'Tahmina Begum', phone: '01799887766', email: '', accId: '', orders: 1, qty: 1, recency: 295, city: 'Sylhet (Amberkhana)' },
    { name: 'Saiful Islam', phone: '+8801933445566', email: 'saiful.islam.ctg@gmail.com', accId: '', orders: 1, qty: 1, recency: 320, city: 'Chittagong (Halishahar)' },
    { name: 'Shamim Osman', phone: '01711009988', email: '', accId: '', orders: 1, qty: 1, recency: 310, city: 'Narayanganj' },
    { name: 'Rokeya Khandaker', phone: '+8801815664433', email: 'rokeya.k@bd-post.gov.bd', accId: '', orders: 1, qty: 1, recency: 345, city: 'Barisal' },
    { name: 'Asif Mahmud', phone: '01912348899', email: 'asif.m@dhaka.edu', accId: '', orders: 1, qty: 1, recency: 330, city: 'Dhaka (Azimpur)' },
    { name: 'Laila Arjumand', phone: '+8801677332211', email: '', accId: '', orders: 1, qty: 1, recency: 355, city: 'Rangpur' },
    { name: 'Jannatul Ferdous', phone: '01722889900', email: 'jannat.f@buet.ac.bd', accId: 'CUST-DH-029', orders: 4, qty: 2, recency: 22, city: 'Dhaka (Palashi)' },
    { name: 'Shahidul Alam', phone: '+8801819556677', email: '', accId: '', orders: 3, qty: 1, recency: 40, city: 'Dhaka (Rampura)' },
    { name: 'Momena Khatun', phone: '01933778899', email: 'momena.k@ctg.ac.bd', accId: '', orders: 3, qty: 2, recency: 65, city: 'Chittagong (Panchlaish)' },
    { name: 'Khandaker Shuvo', phone: '+8801744112233', email: 'shuvo.kh@northsouth.edu', accId: '', orders: 2, qty: 2, recency: 115, city: 'Dhaka (Bashundhara)' },
    { name: 'Nusrat Parveen', phone: '01866332211', email: '', accId: '', orders: 2, qty: 1, recency: 135, city: 'Sylhet (Subidbazar)' },
  ];

  const rows: RawTransaction[] = [];
  const referenceDate = new Date('2024-10-25T18:00:00Z');
  let invoiceCounter = 2001;

  for (const buyer of extendedBuyers) {
    for (let o = 0; o < buyer.orders; o++) {
      const daysAgo = buyer.recency + o * 28;
      const orderDate = new Date(referenceDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      const invoiceNo = `INV-BD-${invoiceCounter++}`;

      // Pick 2-3 items per invoice
      const itemCount = Math.min(3, Math.floor(Math.random() * 2) + 2);
      const shuffled = [...catalog].sort(() => 0.5 - Math.random()).slice(0, itemCount);

      for (const prod of shuffled) {
        const qty = buyer.qty;
        rows.push({
          order_id: invoiceNo,
          created_at: orderDate.toISOString().replace('T', ' ').slice(0, 19),
          customer_name: buyer.name,
          user_id: buyer.accId || '', // Unregistered guests have empty user_id!
          whatsapp_phone: buyer.phone,
          customer_email: buyer.email,
          product_name: prod.name,
          sku: prod.sku,
          category: prod.cat,
          quantity: qty,
          unit_price: prod.price,
          total_price: qty * prod.price,
          channel: 'WhatsApp Storefront & Dhaka POS',
          delivery_city: buyer.city,
        });
      }
    }
  }

  // Add 3 cancelled and invalid test records to test data hygiene
  rows.push({
    order_id: 'INV-BD-9001',
    created_at: '2024-04-12 14:15:00',
    customer_name: 'Cancelled Return Item',
    user_id: '',
    whatsapp_phone: '+8801700112233',
    customer_email: 'cancelled@shop.bd',
    product_name: 'Tangail Taant Handspun Cotton Saree',
    sku: 'TAN-COT-03',
    category: 'Saree',
    quantity: -1,
    unit_price: 2450,
    total_price: -2450,
    channel: 'WhatsApp Shop',
    delivery_city: 'Dhaka',
  });
  rows.push({
    order_id: 'INV-BD-9002',
    created_at: '2024-06-20 16:30:00',
    customer_name: 'Order Cancelled by Customer',
    user_id: 'CUST-DH-001',
    whatsapp_phone: '+8801711234567',
    customer_email: 'nusrat.jahan@gmail.com',
    product_name: 'Rajshahi Endi Silk Festive Panjabi',
    sku: 'PAN-SLK-08',
    category: 'Panjabi',
    quantity: -1,
    unit_price: 3850,
    total_price: -3850,
    channel: 'POS',
    delivery_city: 'Dhaka (Gulshan)',
  });

  return rows;
}

