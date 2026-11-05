# KroyPulse — E-Commerce Customer Segmentation via Extended RFM and Unsupervised Machine Learning

Undergraduate thesis, Department of Computer Science & Engineering, City University, Bangladesh (Batch 62)

**Authors:** Ahammed Zihad Khan (0272310005101036) · Shaheda Akter (0272310005101086) · Aurnob Saha (0272310005101095) · Md. Nazmul Hasan (0272310005101066)
**Supervisor:** Monoara Sultana Morzina, Assistant Professor · **Co-Supervisor:** Mst. Shikha Moni, Lecturer

This repository holds three things:

| Folder | What it is |
|---|---|
| [`thesis/notebook/`](thesis/notebook/) | The Jupyter notebook that reproduces **every number, table and figure** in the thesis |
| [`thesis/paper/`](thesis/paper/) | The thesis in LaTeX (`thesis.tex`) and the compiled PDF |
| [`src/`](src/) | **KroyPulse**, the open-source web app that applies the method to any shop's order file — locally |

---

## 1. Reproduce the thesis results

```bash
pip install -r thesis/requirements.txt   # numpy, pandas, scikit-learn, scipy, matplotlib, nbclient
cd thesis/notebook
python build_notebook.py                 # builds and runs Extended_RFM_Thesis.ipynb (~5 min)
```

The UCI Online Retail file is downloaded automatically the first time (or place `online_retail.csv` in `thesis/data/`).
Outputs go to `thesis/outputs/figures`, `thesis/outputs/tables` (CSV + LaTeX) and `thesis/outputs/results.json`.

Headline results (UCI Online Retail, 4,338 customers, K-Means k = 4 on five log-scaled features):

| Result | Value |
|---|---|
| Silhouette / Davies–Bouldin | 0.311 / 1.244 |
| Bootstrap stability (mean ARI, 30 resamples) | 0.952 |
| Out-of-sample repurchase AUC (segments built before 1 Sep 2011) | 0.712 (k = 2: 0.679; single guest rule: 0.657) |
| Robustness: k = 4 beats k = 2 and the guest rule at every one of 5 cutoffs | 5 / 5 |
| Early-stage customers (new or ≤ 2 orders) | 62 % of customers, 21 % of revenue; within-group AUC ≈ 0.60 |
| Repurchase AUC with 30 / 60 / 90 / 180 days of history | 0.64 / 0.69 / 0.72 / 0.77 |
| External validation: Olist (Brazil, 2016–18, 93,358 customers, 97 % one-time) | K-Means the only valid one of 8 algorithms; AUC k=4 0.575 vs guest rule 0.535 |
| Account-age study: TheLook (synthetic, 100k users with account-creation time) | Segments ≈ chance for accounts < 90 days, rising with account age; profile parameters raise AUC 0.613 → 0.667; never-bought users: profile predicts first purchase, AUC 0.688 |

## 2. Run KroyPulse on your own computer

KroyPulse runs **only on your machine**. There is no server and no upload; files you open stay in the browser's memory.

**Windows:** install [Node.js 20+](https://nodejs.org), then double-click `start-kroypulse.bat`.
**macOS / Linux:** `./start-kroypulse.sh`

Or by hand:

```bash
npm install
npm start          # builds and opens http://127.0.0.1:4173
npm test           # 27 unit tests (engine, data cleaner, local login, WhatsApp API)
```

On first start you create the **owner account** (stored only on that computer). Staff accounts can be added from the bar at the top.

### Features

- **Automatic Data Cleaner** — open any CSV / Excel export; dates (including Excel serial dates and day/month detection), prices (৳, Tk, commas), Bangla digits, phone numbers (+880 / missing leading 0), e-mails, IDs, blank markers, empty rows/columns and duplicates are fixed, with a log of every rule. Export as CSV or Excel. Every upload is cleaned automatically.
- **Guest identity stitching** — repeat buyers without an account are linked by phone number.
- **Extended RFM segmentation** — R, F, M, inter-purchase time and basket depth; K-Means with k-means++; Champions / Loyal / At-Risk / Hibernating; **Early-Stage** flag for new or low-history customers.
- **Validation computed live** — silhouette, Davies–Bouldin, Calinski–Harabasz, Hopkins, bootstrap stability, and a true temporal holdout. The five non-K-Means benchmark rows are labelled as thesis reference values.
- **Send to everyone** — one offer per group in English or Bangla. Free one-by-one mode opens WhatsApp or Messenger with each message ready; optional automatic mode sends Meta-approved templates to opted-in customers through the official WhatsApp Business Cloud API (no unofficial WhatsApp automation, which gets numbers banned).

### Security and privacy

| Measure | Where |
|---|---|
| All computation in the browser; no backend, no analytics, no external fonts | whole app |
| Content-Security-Policy: connections only to the app itself and Meta's official WhatsApp API (used only for automatic sending, after you press Send) | [vite.config.ts](vite.config.ts) |
| Server binds to `127.0.0.1` only (not reachable from the local network) | [vite.config.ts](vite.config.ts) |
| `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, restrictive Permissions-Policy | [vite.config.ts](vite.config.ts) |
| Local accounts: PBKDF2-SHA-256 (600,000 iterations, 16-byte salt), constant-time compare, lockout after 5 failures, 8-hour session, auto-lock after 30 min idle | [src/auth/localAuth.ts](src/auth/localAuth.ts) |
| Upload limits (50 MB, 600k rows, CSV/TSV/XLSX only); cells read as text | [src/rfm/fileParser.ts](src/rfm/fileParser.ts) |
| Spreadsheet formula-injection protection on CSV export | [src/rfm/dataCleaner.ts](src/rfm/dataCleaner.ts) |
| Patched SheetJS 0.20.3 (fixes CVE-2023-30533, CVE-2024-22363); unused server/AI packages removed; `npm audit`: 0 vulnerabilities | [package.json](package.json) |

The login protects the app from other people using the same computer. It cannot protect against someone who fully controls the device, and there is no password reset (clear the site data to start again; no customer data is stored, so nothing is lost).

Before messaging customers, get their consent and follow WhatsApp / Facebook rules.

## License

MIT — free to use, study and improve. Contributions are welcome.
