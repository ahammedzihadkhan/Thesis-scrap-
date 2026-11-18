# KroyPulse — E-Commerce Customer Segmentation via Extended RFM and Unsupervised Machine Learning

Undergraduate thesis, Department of Computer Science & Engineering, City University, Bangladesh (Batch 62)

**Authors:** Ahammed Zihad Khan (0272310005101036) · Shaheda Akter (0272310005101086) · Aurnob Saha (0272310005101095) · Md. Nazmul Hasan (0272310005101066)
**Supervisor:** Monoara Sultana Morzina, Assistant Professor · **Co-Supervisor:** Mst. Shikha Moni, Lecturer

This repository holds three things:

| Folder | What it is |
|---|---|
| [`thesis/notebook/`](thesis/notebook/) | The Jupyter notebook that reproduces **every number, table and figure** in the thesis |
| [`src/`](src/) | **KroyPulse**, the open-source web app that applies the method to any shop's order file — locally |

---

## 1. Reproduce the thesis results

```bash
pip install -r thesis/requirements.txt   # numpy, pandas, scikit-learn, scipy, matplotlib, nbclient
cd thesis/notebook
python build_notebook.py                 # builds and runs Extended_RFM_Thesis.ipynb (~30 min)
```

Or run it in Google Colab without installing anything: [open the notebook in Colab](https://colab.research.google.com/github/ahammedzihadkhan/Thesis-scrap-/blob/main/thesis/notebook/Extended_RFM_Thesis.ipynb), then **Runtime → Run all**. The first cell fetches the project and the datasets download automatically; when the CDNOW site refuses the download (it often refuses Colab), Part 17 uses the identical copy in the open-source lifetimes package. Part 18 downloads Open e-commerce 1.0 (313 MB, public domain) from Harvard Dataverse by itself.

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
| Recent real data: Open e-commerce 1.0 (Amazon.com, US, 2018–22, 5,026 customers; notebook Part 18) | Same protocol, cutoff 1 Jan 2022: AUC k=4 0.862 vs guest rule 0.520 and k=2 0.799 (both significant after Holm); plain RFM k=4 slightly higher (0.874) |
| How many segments? Six datasets (notebook Part 19) | Silhouette and Davies–Bouldin pick k = 2 on all six; the smallest k not significantly less predictive than the best is 3–8 (Olist 3, UCI 6, CDNOW 8); k = 4 keeps 63–100 % of the achievable gain. On samples the size of a small shop (500–1,000 customers) the rule picks 3–5; with k up to 12 it picks 3–12 (Part 19b) |
| Account-age study: TheLook (synthetic, 100k users with account-creation time) | Segments ≈ chance for accounts < 90 days, rising with account age; profile parameters raise AUC 0.613 → 0.667; never-bought users: profile predicts first purchase, AUC 0.688 |

## 2. Run KroyPulse on your own computer

KroyPulse runs **only on your machine**. There is no server and no upload; files you open stay in the browser's memory.

**Windows:** install [Node.js 20+](https://nodejs.org), then double-click `start-kroypulse.bat`.
**macOS / Linux:** `./start-kroypulse.sh`

Or by hand:

```bash
npm install
npm start          # builds and opens http://127.0.0.1:4173
npm test           # 40 unit tests (engine, two-track segments, data cleaner, local login, WhatsApp API, real-data regressions, AI writer fact check, behaviour prediction)
```

To try the app, sign in with the **test account**: username `test`, password `test1234` (shown on the sign-in page).

For real use, choose **Create the owner account** on the same page (accounts are stored only on that computer), add staff accounts from the bar at the top, and click **Remove test account** there. Anyone can read the test password, so the test account cannot add accounts once an owner exists, and after removal it is never created again on that computer.

### Features

- **Automatic Data Cleaner** — open any CSV / Excel export; dates (including Excel serial dates and day/month detection), prices (৳, Tk, commas), Bangla digits, phone numbers (+880 / missing leading 0), e-mails, IDs, blank markers, empty rows/columns and duplicates are fixed, with a log of every rule. Export as CSV or Excel. Every upload is cleaned automatically.
- **Guest identity stitching** — repeat buyers without an account are linked by phone number.
- **Extended RFM segmentation** — R, F, M, inter-purchase time and basket depth; K-Means with k-means++; Champions / Loyal / At-Risk / Hibernating; **two-track**: new or low-history (Early-Stage) customers get their own three segments (Promising newcomers, Just joined, Bought once) and lifecycle messages instead of segment offers.
- **Validation computed live** — silhouette, Davies–Bouldin, Calinski–Harabasz, Hopkins, bootstrap stability, and a true temporal holdout. The five non-K-Means benchmark rows are labelled as thesis reference values.
- **Send to everyone** — one offer per group in English or Bangla. Free one-by-one mode opens WhatsApp or Messenger with each message ready; optional automatic mode sends Meta-approved templates to opted-in customers through the official WhatsApp Business Cloud API (no unofficial WhatsApp automation, which gets numbers banned).
- **Related-product suggestions** — each customer is offered what other customers who bought the same products chose (an electronics buyer gets related electronics), with recent purchases counting most; about one customer in four is offered a best seller of another type instead, so offers do not stay in one lane.
- **Who will buy next** — for every customer: the chance they are still a customer, their expected orders and spend in the next 30, 90 or 180 days (BG/NBD and Gamma-Gamma, fitted in the browser), the customers with the most value ahead, and the valuable customers slipping away; export any list as CSV. The screen tests itself on the shop's own orders (fit before a cutoff, compare with what happened). On the real UCI file it ranked who bought again in the next 90 days with AUC 0.729 (a simple orders-per-week rule: 0.688); run `npx tsx scripts/evalBehaviour.ts` to repeat the check. The implementation reproduces the published CDNOW results of Fader, Hardie & Lee (2005).
- **Offline AI writer (optional)** — a small fine-tuned model writes a different, persuasive message for each customer from their own buying habits, on the shop's CPU, with every message fact-checked (see below).

### Offline AI writer (optional)

In **Send messages**, choose a tone and press **Write … messages with AI**. For each customer, the model writes a message in the language chosen for the send (English or Bangla) from:
- the products they buy most;
- how many orders they have placed and how often;
- when they last ordered;
- the suggested product, its type, and why it was suggested (bought together with one of their products, the same type, a best seller, or something new);
- its price, and the old price when the offer is a percentage discount;
- their group's offer and code.

Each customer group gets the persuasion that suits it, and only claims the facts support:
- **Best customers:** recognition and a thank-you reward (reciprocity).
- **Regulars:** their own habit and what other buyers of their product chose (consistency, social proof).
- **Slipping away:** "we've missed you" and a reward that is already waiting (loss aversion).
- **Inactive:** a warm welcome back and an easy first step.
- **New customers:** a welcome and a reason for the second order.
- **Every message:** the old price next to the new one (anchoring) and a one-word reply to order ("Reply YES"). There are no deadlines or "only 3 left" claims, because the shop sets none.

The model is Google's [Flan-T5-small](https://huggingface.co/google/flan-t5-small) (77M parameters, Apache-2.0), fine-tuned in this project. It runs in the browser on the shop's CPU (8-bit ONNX in a Web Worker), and nothing is sent anywhere.

Every message is fact-checked before use:
- **Must appear exactly:** the suggested product, price, offer and code.
- **Must not appear:** any other number, price, code, link or e-mail.
- **If no draft passes:** the normal template is used.
- **When codes, prices, the tone or the shop name change:** the old AI messages are no longer used, because each one is tied to the exact facts it was written from.
- **Unexpected wording:** a message is also rejected if it repeats a sentence or contains a negation (such as "Do not use code …").
- **Only supported claims:** "customers who bought X also bought Y" only when the shop's data shows it, "best seller" only for best sellers, and never a deadline or a stock level.

Results on 600 customers the model never saw ([t_ai_writer.csv](thesis/outputs/tables/t_ai_writer.csv)):
- **Fact check:** 99.7–100% of the final messages passed (the rest keep the template).
- **Personal:** 97.0–97.7% used the customer's name and named a product they had bought.
- **Persuasion the facts back:** 96–99% said what buyers of the customer's product chose, when the data showed it; every discounted offer showed the old price.
- **Speed:** 0.78–0.87 s per message on a laptop CPU (1.16–1.29 drafts per message), or a few seconds per customer in the browser.
- **Baseline:** a general small model, SmolLM2-360M prompted with the same facts, passed for none of 30 customers.

The training examples come from a phrase grammar ([scripts/writer/make_data.py](scripts/writer/make_data.py)) filled with synthetic Bangladeshi shop customers and real UCI customers. Every fact in a training message is copied from that customer's data, so the model never learns to invent one, and every generated example must pass the app's fact check.

The model is too large for Git, so build it once (CPU only; about 4–5 hours on a 4-core laptop with 8 GB of memory):

```bash
uv venv scripts/writer/.venv --python 3.12
uv pip install --python scripts/writer/.venv -r scripts/writer/requirements.txt
scripts/writer/.venv/Scripts/python scripts/writer/make_data.py   # training data (needs thesis/data/online_retail.csv)
scripts/writer/.venv/Scripts/python scripts/writer/train.py --steps 2700 --batch 8 --lr 7e-4 --checkpointing
scripts/writer/.venv/Scripts/python scripts/writer/export.py      # -> public/models/kroypulse-writer
npx tsx scripts/evalAiWriter.ts                                   # fact-check pass rate and speed on unseen customers
```

On macOS or Linux, use `scripts/writer/.venv/bin/python`. Then run `npm start` again. (The shipped model was trained in stages: 1,500 steps on an earlier grammar, then 1,200 steps on this one with `--init scripts/writer/out/model_v1 --lr 5e-4 --checkpointing`, and later 3,000 more steps at `--lr 3e-4` on the revised grammar. The single from-scratch command above has not been run; check its result with the evaluation script.)

#### Bangla writer

Bangla has its own model, [kroypulse-writer-bn](public/models/kroypulse-writer-bn), because Flan-T5 has no Bengali script. It starts from Google's multilingual [mT5-small](https://huggingface.co/google/mt5-small) (Apache-2.0) with the vocabulary cut from 250,100 to 10,640 tokens (55M parameters, about 62 MB in the browser). It is loaded only when Bangla is chosen. It uses the same facts and the same rules as the English writer, with a Bangla fact check (offer in Bangla form, no Bangla digits, same bans on invented urgency, negations and unsupported claims). Names, shop and product names may be in Bangla or Latin script.

Results on customers the model never saw ([t_ai_writer_bn.csv](thesis/outputs/tables/t_ai_writer_bn.csv)), best of three drafts as used in the app:
- **Fact check:** 96.7% passed on 300 real UCI customers and 89.7% on 300 synthetic shops with unseen names (the Bangla templates pass 15% and 16%, because they do not name a bought product). Failing drafts keep the template.
- **Personal:** 96.7% (real) and 84.7% (synthetic) used the name and named a bought product.
- **Speed:** about 1.1–1.3 s per message on a laptop CPU.

The Bangla wording comes from a phrase grammar written for this project, not by a native-speaker editor: have a native speaker read the phrases in [make_data_bn.py](scripts/writer/make_data_bn.py) before real use. Build (CPU only, about 4.5 hours for 1,800 steps):

```bash
scripts/writer/.venv/Scripts/python scripts/writer/make_data_bn.py
scripts/writer/.venv/Scripts/python scripts/writer/prune_vocab.py   # downloads mT5-small once (about 1.2 GB)
scripts/writer/.venv/Scripts/python scripts/writer/train.py --init scripts/writer/out/mt5-bn --tokenizer scripts/writer/out/mt5-bn --data scripts/writer/out/data_bn --out scripts/writer/out/bn --steps 1800 --batch 8 --lr 1e-3 --checkpointing --threads 3 --rest 75
scripts/writer/.venv/Scripts/python scripts/writer/export.py --model scripts/writer/out/bn/model --dest public/models/kroypulse-writer-bn
npx tsx scripts/evalAiWriter.ts 300 0 bn
```

### Data model

The ER diagram of the app's records (accounts, orders, customers, segments, products, suggestions, predictions, messages) is in [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md) (Mermaid, rendered by GitHub) and as an image in [thesis/outputs/figures/f_er_diagram.png](thesis/outputs/figures/f_er_diagram.png).

### Security and privacy

| Measure | Where |
|---|---|
| All computation in the browser; no backend, no analytics, no external fonts | whole app |
| Content-Security-Policy: connections only to the app itself and Meta's official WhatsApp API (used only for automatic sending, after you press Send) | [vite.config.ts](vite.config.ts) |
| WebAssembly is allowed only so the offline AI writer can run (`'wasm-unsafe-eval'`; JavaScript `eval` stays blocked); its model and runtime are served by the app itself, never by a CDN | [vite.config.ts](vite.config.ts), [src/ai/writerWorker.ts](src/ai/writerWorker.ts) |
| Server binds to `127.0.0.1` only (not reachable from the local network) | [vite.config.ts](vite.config.ts) |
| `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, restrictive Permissions-Policy, cross-origin isolation (COOP + COEP) | [vite.config.ts](vite.config.ts) |
| Local accounts: PBKDF2-SHA-256 (600,000 iterations, 16-byte salt), constant-time compare, lockout after 5 failures, 8-hour session, auto-lock after 30 min idle; locking also clears the WhatsApp API token; the test account cannot add accounts once an owner exists and can be removed for good | [src/auth/localAuth.ts](src/auth/localAuth.ts), [src/Root.tsx](src/Root.tsx) |
| Upload limits (50 MB, 600k rows, CSV/TSV/XLSX only); cells read as text | [src/rfm/fileParser.ts](src/rfm/fileParser.ts) |
| Spreadsheet formula-injection protection on CSV export | [src/rfm/dataCleaner.ts](src/rfm/dataCleaner.ts) |
| Patched SheetJS 0.20.3 (fixes CVE-2023-30533, CVE-2024-22363); unused server/AI packages removed; `npm audit`: 0 vulnerabilities | [package.json](package.json) |

Once the test account is removed, the login protects the app from other people using the same computer. It cannot protect against someone who fully controls the device, and there is no password reset (clear the site data to start again; no customer data is stored, so nothing is lost).

Before messaging customers, get their consent and follow WhatsApp / Facebook rules.

## License

MIT — free to use, study and improve. Contributions are welcome.
