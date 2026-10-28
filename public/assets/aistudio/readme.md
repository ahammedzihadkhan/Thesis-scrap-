# ANTIGRAVITY BUILD SPEC: Universal Retail & WhatsApp Shop Customer Segmentation Web App

## 1. Objective
Build a complete, production-ready, interactive web application (`app.py` using **Streamlit** + **Plotly**) on top of our existing `rfm_segmentation` machine learning package (`src/rfm/`). 
The goal is to turn our thesis ML pipeline ("E-Commerce Customer Segmentation via Extended RFM Modeling and Unsupervised Machine Learning") into a plug-and-play tool that **any online, POS, or WhatsApp-operated retail shop** can use with their own transaction data—without writing a single line of code.

---

## 2. Core Features to Implement

### Feature A: Universal Retail CSV/Excel Uploader & Smart Column Mapper
Real retail shops use different column names (Shopify, WooCommerce, POS exports, or manual Excel order sheets). Build an ingestion wizard in the sidebar/top panel that supports:
1. **3 Data Input Modes:**
   - **Upload Custom Store File:** Accepts `.csv`, `.tsv`, or `.xlsx` files (automatically detecting delimiters `,` / `\t` and encodings `utf-8` / `ISO-8859-1`).
   - **Load Canonical Thesis Dataset:** 1-click button to load the UCI Online Retail dataset (`data/online_retail.csv`, 541,909 rows -> 4,338 customers) for live thesis defense demos.
   - **Generate Sample Local/WhatsApp Shop CSV:** 1-click button that generates and loads a realistic Bangladeshi WhatsApp/Facebook retail shop order log (with `+8801...` phone numbers, guest checkouts, product names, and BDT `৳` prices) so examiners can test a local store scenario immediately.
2. **Dynamic Column Mapping UI:**
   - Auto-detects likely columns using fuzzy keyword matching, while allowing the shop owner to select/override via dropdowns:
     - `Invoice / Order ID Column` (e.g., `InvoiceNo`, `order_id`, `receipt_no`)
     - `Order Timestamp Column` (e.g., `InvoiceDate`, `created_at`, `order_date`)
     - `Customer Account ID Column (Optional)` (e.g., `CustomerID`, `user_id`)
     - `Checkout Phone / WhatsApp Column (Optional)` (e.g., `Phone`, `mobile`, `delivery_phone`)
     - `Checkout Email Column (Optional)` (e.g., `Email`, `customer_email`)
     - `Product / SKU Column (Optional — for Basket Depth D)` (e.g., `StockCode`, `product_id`, `item_name`; if absent, gracefully defaults Basket Depth $D = F$)
     - `Revenue Mode`: Either `Quantity Column` $\times$ `Unit Price Column` OR a single pre-calculated `Total Order Amount Column`.
   - **Currency Symbol Selector:** Dropdown in sidebar (`$ USD`, `৳ BDT`, `£ GBP`, `€ EUR`, `₹ INR`) that dynamically formats all monetary tables, KPIs, and marketing messages.

### Feature B: Zero-Account "Guest" Identity Stitching Engine
Small websites and WhatsApp shops have many unregistered guest buyers:
- Build a clean identity-resolution function in `src/rfm/data.py`:
  1. Normalize phone numbers (strip spaces, dashes, leading `+88` or `00`, standardizing to a clean digits key) and lowercase/strip email addresses.
  2. Create a unified `Unified_Customer_Key` using the priority chain: `CustomerID` (if present and non-null) $\rightarrow$ `Normalized Phone Number` $\rightarrow$ `Normalized Email`.
  3. Display a **"Data Hygiene & Guest Recovery Summary"** metric bar showing:
     - Total Raw Rows
     - Valid Identified Transactions
     - Repeat Guest Buyers Recovered via Phone/Email Key
     - Cancelled / Invalid / Duplicate Rows Removed

### Feature C: 5D Extended RFM Feature Engineering & Unsupervised ML Engine
Using the cleaned customer-level records, run our exact thesis methodology:
1. **5D Extended RFM Engineering:**
   - **Recency ($R$):** Days since last purchase relative to `max(date) + 1 day`.
   - **Frequency ($F$):** Distinct order/invoice count (flagging $F=1$ as *Single-Purchase Guests* and $F \ge 2$ as *Repeat Regulars*).
   - **Monetary ($M$):** Total spend per customer.
   - **Inter-Purchase Time ($T$):** Mean calendar days between consecutive shopping dates ($0$ for single-day buyers).
   - **Basket Depth ($D$):** Total distinct products/SKUs purchased.
2. **Preprocessing:** Apply `np.log1p` ($\ln(1+x)$) to fix right-skewness, followed by `StandardScaler` ($\mu=0, \sigma=1$). Show before/after skewness metrics.
3. **Interactive ML Controls & Auto-Validation:**
   - Allow the user to select $k \in [2, 8]$ (defaulting to our thesis optimal **$k = 4$** with `k-means++`, `n_init=10`, `random_state=42`).
   - Include a toggle to run the **6-Algorithm Benchmark** (`K-Means`, `Ward Hierarchical`, `Average Linkage`, `Complete Linkage`, `GMM`, `DBSCAN`) with our **2%–80% Cluster Size Validity Check** so the user can see why K-Means wins.
   - Display live model health badges: **Silhouette Score**, **Davies–Bouldin Index**, **Calinski–Harabasz Index**, **Hopkins Statistic**, and **Bootstrap Stability (ARI)**.

### Feature D: 5-Tab Interactive Retail Dashboard (`app.py`)
Organize the Streamlit UI into 5 clean, executive-ready tabs:
- **Tab 1: Store Overview & Data Hygiene**
  - KPI Cards: Total Revenue, Unique Customers, Single-Purchase Guest Share (%), Average Order Value, Top 10% Pareto Revenue Share (%).
  - Interactive Plotly charts: Data Hygiene Breakdown bar chart, Monthly Revenue trend, Single-Purchase Guest vs. Repeat Regular donut chart.
- **Tab 2: Extended RFM Segments & 3D Explorer**
  - Automatic ranking of clusters by Monetary value into our 4 business personas:
    1. `Champions (VIP Loyalists)`
    2. `Loyal & Promising Regulars`
    3. `High-Potential / At-Risk Guests`
    4. `Hibernating / Lost Guests`
  - **Interactive 3D Plotly Scatter Plot** (`Recency`, `Frequency`, `Monetary` colored by Segment, with hover tooltips showing Customer Key, $R, F, M, T, D$).
  - **2D PCA Projection Plot** & **Standardized Z-Score Segment Profile Bar Chart**.
  - **Customer Share vs. Revenue Share Pareto Chart** + Mean & Median Centroid Tables.
- **Tab 3: ML Validation, Benchmark & Future Repurchase Test**
  - Interactive Elbow (WCSS), Silhouette, and Davies–Bouldin curves across $k=2\text{ to }10$.
  - 6-Algorithm Benchmark table showing the Cluster-Size Validity Check (highlighting degenerate clusters in red and valid models in green).
  - **Temporal Holdout Predictive Check:** Automatically splits the shop's timeline at the 75th percentile date and shows the actual future repurchase rate (%) and future revenue share (%) of each segment!
- **Tab 4: Automated WhatsApp & Email Campaign Studio**
  - Editable campaign settings for each segment (allow the store owner to customize discount codes like `LOYAL15`, `GUEST20`, `COMEBACK10` and message templates).
  - Filterable customer table by segment (`Champions`, `Loyal`, `At-Risk`, `Hibernating`) and buyer type (`Single-Purchase Guest` vs. `Repeat Regular`).
  - **Click-to-Chat WhatsApp Action Links:** Generate a clickable `https://wa.me/{phone}?text={url_encoded_message}` link and `mailto:` link for each customer row so a small shop owner can send WhatsApp messages directly from the browser, plus a **1-Click Download Full Campaign Queue (`.csv` / `.xlsx`)** button for bulk WhatsApp/Email tools.
- **Tab 5: Live POS / Single-Customer Segment Predictor**
  - A form where a shopkeeper can either search an existing Customer ID / Phone Number OR type in a customer's `Recency`, `Frequency`, `Monetary`, `Inter-Purchase Time`, and `Basket Depth`.
  - Uses the fitted `StandardScaler` and nearest K-Means centroid (`model.predict`) to instantly classify the customer, show their distance to the next loyalty tier, and generate their ready-to-send WhatsApp/Email offer.

---

## 3. Execution Steps for Antigravity
1. Inspect the existing `rfm_segmentation` directory structure.
2. Add `streamlit`, `plotly`, and `openpyxl` to `requirements.txt` and install them.
3. Create a reusable module `src/rfm/shop_adapter.py` that handles arbitrary column mapping, phone/email guest identity stitching, and sample local WhatsApp shop dataset generation.
4. Build the complete `app.py` Streamlit application in the root directory.
5. Run a headless syntax and import check (`python -m py_compile app.py src/rfm/shop_adapter.py`), launch `streamlit run app.py` in the background to verify zero runtime errors, and provide the local URL.