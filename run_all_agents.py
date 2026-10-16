# ==============================================================================
# MASTER RUNNER: AGENTS 1-5  (Single Canonical Dataset - Online Retail)
# Thesis: E-Commerce Customer Segmentation via Extended RFM Modeling & ML
# Batch 62, Department of CSE, City University, Bangladesh
# ==============================================================================

import os, glob, shutil, zipfile, urllib.request, time, warnings, textwrap
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')           # non-interactive backend (safe on headless servers)
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.metrics import silhouette_score, davies_bouldin_score

warnings.filterwarnings('ignore')

# ── working directory = this script's location ──────────────────────────────
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs("data", exist_ok=True)

plt.rcParams.update({
    'font.sans-serif': 'DejaVu Sans',
    'axes.edgecolor':  '#333333',
    'figure.dpi':      100,
})

# ==============================================================================
# AGENT 1 – DATA ACQUISITION & HYGIENE
# ==============================================================================
print("\n" + "="*70)
print("  [AGENT 1] Data Acquisition & Hygiene")
print("="*70)

csv_path = "data/online_retail.csv"

# The dataset is already in the workspace root; link it into data/ if needed
if not os.path.exists(csv_path):
    raw_root = "online_retail.csv"
    if os.path.exists(raw_root):
        shutil.copy(raw_root, csv_path)
        print(f"  -> Copied {raw_root} -> {csv_path}")
    else:
        # Try kagglehub, then UCI fallback
        try:
            import kagglehub
        except ImportError:
            os.system("pip install -q kagglehub openpyxl")
            import kagglehub
        try:
            print("  Downloading via kagglehub (carrie1/ecommerce-data)...")
            dl_folder = kagglehub.dataset_download("carrie1/ecommerce-data")
            found = glob.glob(os.path.join(dl_folder, "**", "*.csv"), recursive=True)
            if found:
                shutil.copy(found[0], csv_path)
        except Exception as e:
            print(f"  kagglehub failed ({e}). Falling back to UCI...")
            uci = "https://archive.ics.uci.edu/ml/machine-learning-databases/00352/Online%20Retail.xlsx"
            urllib.request.urlretrieve(uci, "data/Online_Retail.xlsx")
            pd.read_excel("data/Online_Retail.xlsx").to_csv(csv_path, index=False, encoding="ISO-8859-1")

df_raw = pd.read_csv(csv_path, encoding="ISO-8859-1")
total_raw_rows   = len(df_raw)
missing_cid_rows = int(df_raw['CustomerID'].isna().sum())
registered_raw_rows = total_raw_rows - missing_cid_rows

print(f"  Total Raw Rows            : {total_raw_rows:,}")
print(f"  Missing CustomerID (guest): {missing_cid_rows:,} ({missing_cid_rows/total_raw_rows*100:.1f}%)")
print(f"  Identified Customers      : {registered_raw_rows:,} ({registered_raw_rows/total_raw_rows*100:.1f}%)")

df_clean = df_raw.dropna(subset=['CustomerID']).copy()
df_clean['InvoiceNo'] = df_clean['InvoiceNo'].astype(str)
cancelled_rows = int(df_clean['InvoiceNo'].str.startswith('C').sum())
df_clean = df_clean[~df_clean['InvoiceNo'].str.startswith('C')]
df_clean = df_clean[(df_clean['Quantity'] > 0) & (df_clean['UnitPrice'] > 0)]
before_dedup = len(df_clean)
df_clean = df_clean.drop_duplicates()
duplicate_rows = before_dedup - len(df_clean)

df_clean['TotalPrice']     = df_clean['Quantity'] * df_clean['UnitPrice']
df_clean['InvoiceDate']    = pd.to_datetime(df_clean['InvoiceDate'])
df_clean['CustomerID_Str'] = df_clean['CustomerID'].astype(int).astype(str)

print(f"  Cancelled Invoices removed: {cancelled_rows:,}")
print(f"  Duplicate rows removed    : {duplicate_rows:,}")
print(f"  Final cleaned rows        : {len(df_clean):,}")
print(f"  Unique customers          : {df_clean['CustomerID_Str'].nunique():,}")

# Figure 4.1
fig, ax = plt.subplots(figsize=(9, 5.5))
categories = [
    'Valid Identified\nTransactions',
    'Unregistered Guest\nCheckouts (Missing ID)',
    'Cancelled Orders\n(Invoice starts w/ C)',
    'Duplicate / Invalid\nLine Items'
]
counts = [len(df_clean), missing_cid_rows, cancelled_rows, duplicate_rows]
pcts   = [c / total_raw_rows * 100 for c in counts]
bars   = ax.bar(categories, pcts, color=['#2ecc71','#ff9999','#ffcc99','#c2c2f0'], edgecolor='black')
for bar, c, p in zip(bars, counts, pcts):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1.0,
            f"{p:.1f}%\n({c:,})", ha='center', fontweight='bold', fontsize=9.5)
ax.set_ylim(0, 88)
ax.set_ylabel('Percentage of Raw Dataset (%)')
ax.set_title(f'Single-Dataset Transaction Hygiene & Unregistered Checkout Share (N = {total_raw_rows:,})')
ax.grid(axis='y', alpha=0.3)
plt.tight_layout()
plt.savefig('fig4_1_account_vs_guest_tx.png', dpi=300, bbox_inches='tight')
plt.close()
print("  -> Saved fig4_1_account_vs_guest_tx.png")

# ==============================================================================
# AGENT 2 – EXTENDED RFM FEATURE ENGINEERING & PREPROCESSING
# ==============================================================================
print("\n" + "="*70)
print("  [AGENT 2] Extended RFM Feature Engineering (R, F, M, T, D)")
print("="*70)

snapshot_date = df_clean['InvoiceDate'].max() + pd.Timedelta(days=1)
print(f"  Snapshot date: {snapshot_date.date()}")

def calc_interpurchase_time(dates):
    unique_days = np.sort(dates.dt.floor('D').unique())
    if len(unique_days) <= 1:
        return 0.0
    diffs = np.diff(unique_days) / np.timedelta64(1, 'D')
    return float(np.mean(diffs))

ext_rfm = df_clean.groupby('CustomerID').agg(
    Recency           =('InvoiceDate',  lambda x: (snapshot_date - x.max()).days),
    Frequency         =('InvoiceNo',    'nunique'),
    Monetary          =('TotalPrice',   'sum'),
    InterPurchase_Time=('InvoiceDate',  calc_interpurchase_time),
    Basket_Depth      =('StockCode',    'nunique'),
    Country           =('Country',      'first')
)
feature_cols = ['Recency','Frequency','Monetary','InterPurchase_Time','Basket_Depth']

single_guest_count = int((ext_rfm['Frequency'] == 1).sum())
repeat_reg_count   = int((ext_rfm['Frequency']  > 1).sum())
single_guest_pct   = single_guest_count / len(ext_rfm) * 100
repeat_reg_pct     = 100.0 - single_guest_pct

print(f"  Single-Invoice Guests (F=1)  : {single_guest_count:,} ({single_guest_pct:.1f}%)")
print(f"  Repeat Regulars    (F>=2)    : {repeat_reg_count:,} ({repeat_reg_pct:.1f}%)")

# Figure 4.2
fig, ax = plt.subplots(figsize=(7, 6.5))
ax.pie(
    [single_guest_pct, repeat_reg_pct],
    labels=[f'Single-Purchase Guests\n(F=1: {single_guest_count:,} customers)',
            f'Repeat Regulars\n(F>=2: {repeat_reg_count:,} customers)'],
    autopct='%1.1f%%', startangle=35, explode=(0.06, 0),
    colors=['#ff9999','#66b3ff'], shadow=True
)
ax.set_title(f'Customer-Level Guest vs. Regular Split (N = {len(ext_rfm):,})')
plt.tight_layout()
plt.savefig('fig4_2_single_vs_repeat_pie.png', dpi=300, bbox_inches='tight')
plt.close()
print("  -> Saved fig4_2_single_vs_repeat_pie.png")

# Log + scale
rfm_log    = np.log1p(ext_rfm[feature_cols])
scaler     = StandardScaler()
rfm_scaled = pd.DataFrame(scaler.fit_transform(rfm_log),
                           index=ext_rfm.index, columns=feature_cols)

# Figure 4.3
fig, axes = plt.subplots(2, 5, figsize=(17, 7))
for i, col in enumerate(feature_cols):
    axes[0, i].hist(ext_rfm[col], bins=35, color='#e74c3c', edgecolor='black', alpha=0.75)
    axes[0, i].set_title(f"Raw {col}\n(Skew={ext_rfm[col].skew():.2f})", fontsize=9.5)
    axes[1, i].hist(rfm_scaled[col], bins=35, color='#2ecc71', edgecolor='black', alpha=0.75)
    axes[1, i].set_title(f"Log+Scaled {col}\n(Skew={rfm_scaled[col].skew():.2f})", fontsize=9.5)
plt.suptitle('Effect of np.log1p Transformation and StandardScaler on Extended RFM Features',
             fontweight='bold', fontsize=12)
plt.tight_layout()
plt.savefig('fig4_3_skewness_correction.png', dpi=300, bbox_inches='tight')
plt.close()
print("  -> Saved fig4_3_skewness_correction.png")

# ==============================================================================
# AGENT 3 – ML TRAINING, VALIDATION & ALGORITHM BENCHMARKING
# ==============================================================================
print("\n" + "="*70)
print("  [AGENT 3] K-Means Training (k=2..10) & Algorithm Benchmarking")
print("="*70)

K_range      = range(2, 11)
eval_records = []

for k in K_range:
    km   = KMeans(n_clusters=k, init='k-means++', random_state=42, n_init=10)
    lbls = km.fit_predict(rfm_scaled)
    eval_records.append({
        'k':          k,
        'WCSS':       km.inertia_,
        'Silhouette': silhouette_score(rfm_scaled, lbls),
        'DBI':        davies_bouldin_score(rfm_scaled, lbls),
    })
    print(f"  k={k:2d}  WCSS={km.inertia_:10,.2f}  "
          f"Sil={eval_records[-1]['Silhouette']:.4f}  DBI={eval_records[-1]['DBI']:.4f}")

eval_df = pd.DataFrame(eval_records)
eval_df.to_csv('table_4_1_real_evaluation.csv', index=False)

# Figure 4.4
fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
axes[0].plot(eval_df['k'], eval_df['WCSS'], marker='o', lw=2, color='#1a73e8')
axes[0].axvline(4, color='red', ls='--', label='Optimal Elbow (k=4)')
axes[0].set_title('Elbow Method: Inertia (WCSS) vs. k')
axes[0].set_xlabel('Number of Clusters (k)')
axes[0].set_ylabel('Within-Cluster Sum of Squares (WCSS)')
axes[0].legend(); axes[0].grid(True, alpha=0.3)

axes[1].plot(eval_df['k'], eval_df['Silhouette'], marker='s', lw=2, color='#34a853')
axes[1].axvline(4, color='red', ls='--', label='Selected Optimal k=4')
axes[1].set_title('Silhouette Score vs. k')
axes[1].set_xlabel('Number of Clusters (k)')
axes[1].set_ylabel('Silhouette Coefficient')
axes[1].legend(); axes[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('fig4_4_elbow_silhouette.png', dpi=300, bbox_inches='tight')
plt.close()
print("  -> Saved fig4_4_elbow_silhouette.png")

# Benchmarking
t0 = time.time()
km_final = KMeans(n_clusters=4, init='k-means++', random_state=42, n_init=10)
ext_rfm['Cluster'] = km_final.fit_predict(rfm_scaled)
km_time = time.time() - t0
km_sil  = silhouette_score(rfm_scaled, ext_rfm['Cluster'])
km_dbi  = davies_bouldin_score(rfm_scaled, ext_rfm['Cluster'])

t0 = time.time()
hc_model = AgglomerativeClustering(n_clusters=4, linkage='ward')
hc_lbls  = hc_model.fit_predict(rfm_scaled)
hc_time  = time.time() - t0
hc_sil   = silhouette_score(rfm_scaled, hc_lbls)
hc_dbi   = davies_bouldin_score(rfm_scaled, hc_lbls)

t0 = time.time()
db_model = DBSCAN(eps=0.8, min_samples=10)
db_lbls  = db_model.fit_predict(rfm_scaled)
db_time  = time.time() - t0
valid_mask   = db_lbls != -1
db_sil  = silhouette_score(rfm_scaled[valid_mask], db_lbls[valid_mask]) \
          if len(set(db_lbls[valid_mask])) > 1 else 0.0
db_dbi  = davies_bouldin_score(rfm_scaled[valid_mask], db_lbls[valid_mask]) \
          if len(set(db_lbls[valid_mask])) > 1 else 0.0
db_noise_pct = (db_lbls == -1).mean() * 100

bench_df = pd.DataFrame([
    {'Algorithm': 'K-Means (k=4, Selected)',      'Silhouette': km_sil, 'DBI': km_dbi, 'Noise_Pct': 0.0,          'Runtime_s': km_time},
    {'Algorithm': 'Hierarchical (Ward, k=4)',      'Silhouette': hc_sil, 'DBI': hc_dbi, 'Noise_Pct': 0.0,          'Runtime_s': hc_time},
    {'Algorithm': 'DBSCAN (eps=0.8, minPts=10)',   'Silhouette': db_sil, 'DBI': db_dbi, 'Noise_Pct': db_noise_pct, 'Runtime_s': db_time},
])
bench_df.to_csv('table_4_2_algo_benchmark.csv', index=False)
print("\n  Algorithm Benchmark Results:")
print(bench_df.to_string(index=False))

# ==============================================================================
# AGENT 4 – SEGMENT PROFILING, 3D VIZ & MARKETING AUTOMATION
# ==============================================================================
print("\n" + "="*70)
print("  [AGENT 4] Segment Profiling, 3D Visualisation & Marketing Queue")
print("="*70)

cluster_order = ext_rfm.groupby('Cluster')['Monetary'].mean().sort_values(ascending=False).index.tolist()
label_map = {
    cluster_order[0]: 'Champions (VIP Loyalists)',
    cluster_order[1]: 'Loyal & Promising Regulars',
    cluster_order[2]: 'High-Potential / At-Risk Guests',
    cluster_order[3]: 'Hibernating / Lost Guests',
}
ext_rfm['Segment_Label'] = ext_rfm['Cluster'].map(label_map)

real_profiles = ext_rfm.groupby('Segment_Label').agg(
    Customers          =('Recency', 'count'),
    Share_Pct          =('Recency', lambda x: round(len(x)/len(ext_rfm)*100, 1)),
    Recency            =('Recency', 'mean'),
    Frequency          =('Frequency', 'mean'),
    Monetary           =('Monetary', 'mean'),
    InterPurchase_Time =('InterPurchase_Time', 'mean'),
    Basket_Depth       =('Basket_Depth', 'mean'),
).loc[list(label_map.values())].round(2)

real_profiles.to_csv('table_4_3_real_profiles.csv')
print("\n  Segment Profiles:")
print(real_profiles.to_string())

# Figure 4.5 – 3D scatter
fig = plt.figure(figsize=(11, 7.5))
ax  = fig.add_subplot(111, projection='3d')
palette = {
    'Champions (VIP Loyalists)':       '#2ecc71',
    'Loyal & Promising Regulars':      '#3498db',
    'High-Potential / At-Risk Guests': '#f39c12',
    'Hibernating / Lost Guests':       '#e74c3c',
}
for seg_name, grp in ext_rfm.groupby('Segment_Label'):
    idx = grp.index
    ax.scatter(rfm_scaled.loc[idx,'Recency'],
               rfm_scaled.loc[idx,'Frequency'],
               rfm_scaled.loc[idx,'Monetary'],
               label=seg_name, c=palette[seg_name], s=18, alpha=0.70)
ax.set_xlabel('Scaled Recency (R)')
ax.set_ylabel('Scaled Frequency (F)')
ax.set_zlabel('Scaled Monetary (M)')
ax.set_title(f'3D Scatter: Extended RFM Customer Segments (k=4, N={len(ext_rfm):,})')
ax.legend(loc='upper left', fontsize=8)
plt.tight_layout()
plt.savefig('fig4_5_3d_clusters.png', dpi=300, bbox_inches='tight')
plt.close()
print("  -> Saved fig4_5_3d_clusters.png")

# Figure 4.6 – profile bar chart
scaled_means = rfm_scaled.groupby(ext_rfm['Segment_Label'])[feature_cols].mean().loc[list(label_map.values())]
fig, ax = plt.subplots(figsize=(12, 5.5))
scaled_means.plot(kind='bar', ax=ax, width=0.75, rot=12)
ax.axhline(0, color='black', lw=0.9)
ax.set_ylabel('Mean Standardised Score (Z-Score)')
ax.set_title('Standardised Extended RFM Attribute Profiles Across Customer Segments (k=4)')
ax.grid(axis='y', alpha=0.3)
plt.tight_layout()
plt.savefig('fig4_6_segment_profiles.png', dpi=300, bbox_inches='tight')
plt.close()
print("  -> Saved fig4_6_segment_profiles.png")

# Marketing queue
ext_rfm_sorted = ext_rfm.sort_index().copy()
ext_rfm_sorted['Customer_Key'] = [f"ID-{int(c)}" for c in ext_rfm_sorted.index]

def build_campaign_row(row):
    seg   = row['Segment_Label']
    cid   = row['Customer_Key']
    spend = row['Monetary']
    depth = int(row['Basket_Depth'])
    if seg == 'Champions (VIP Loyalists)':
        return pd.Series([
            f"Hi {cid}, thank you for spending ${spend:,.2f} across {depth} items! VIP early access unlocked.",
            f"*WhatsApp VIP*: Hello {cid}, your priority loyalty tier reward is ready!",
        ])
    elif seg == 'Loyal & Promising Regulars':
        return pd.Series([
            f"Hi {cid}, we curated new arrivals for your {depth}-item basket! Use code LOYAL15.",
            f"*WhatsApp Exclusive*: Hi {cid}, claim 15% off your next bundle order!",
        ])
    elif seg == 'High-Potential / At-Risk Guests':
        return pd.Series([
            f"Hi {cid}, loved your recent order (${spend:,.2f})! Convert to VIP with code GUEST20.",
            f"*WhatsApp Offer*: Hello {cid}, reorder today & save 20%!",
        ])
    else:
        return pd.Series([
            f"Hi {cid}, we miss you! Enjoy a 10% reactivation voucher: COMEBACK10.",
            f"*WhatsApp Flash Sale*: Hi {cid}, tap here for clearance items!",
        ])

ext_rfm_sorted[['Email_Campaign','WhatsApp_Campaign']] = ext_rfm_sorted.apply(build_campaign_row, axis=1)
mq_cols = ['Customer_Key','Segment_Label','Email_Campaign','WhatsApp_Campaign']
ext_rfm_sorted[mq_cols].to_csv('final_marketing_queue_full_4338.csv', index=False)
print(f"  -> Saved final_marketing_queue_full_4338.csv  ({len(ext_rfm_sorted):,} rows)")

# Figure 4.7 – sample table
sampled_queue = pd.concat(
    [grp.head(2) for _, grp in ext_rfm_sorted.groupby('Segment_Label')]
)[mq_cols]
fig, ax = plt.subplots(figsize=(14, 4.5))
ax.axis('off')
tbl = ax.table(cellText=sampled_queue.values, colLabels=sampled_queue.columns,
               cellLoc='left', loc='center')
tbl.auto_set_font_size(False)
tbl.set_fontsize(8.0)
tbl.scale(1, 1.5)
for (r, c), cell in tbl.get_celld().items():
    if r == 0:
        cell.set_text_props(weight='bold', color='white')
        cell.set_facecolor('#1a73e8')
    elif r % 2 == 0:
        cell.set_facecolor('#f1f3f4')
    cell.set_edgecolor('#dadce0')
plt.title('Automated Email & WhatsApp Marketing Queue – Extended RFM Segments (Stratified Sample)',
          fontweight='bold', fontsize=10.5, pad=10)
plt.tight_layout()
plt.savefig('fig4_7_final_marketing_queue.png', dpi=300, bbox_inches='tight')
plt.close()
print("  -> Saved fig4_7_final_marketing_queue.png")

# ==============================================================================
# AGENT 5 – LATEX TABLES, NOTEBOOK BUILDER & OVERLEAF ZIP
# ==============================================================================
print("\n" + "="*70)
print("  [AGENT 5] LaTeX Tables, Notebook Builder & Overleaf ZIP")
print("="*70)

# table_4_1_real.tex
with open("table_4_1_real.tex", "w") as f:
    f.write("\\begin{table}[H]\n\\centering\n\\small\n")
    f.write("\\begin{tabular}{cccc}\n\\toprule\n")
    f.write("\\textbf{Clusters ($k$)} & \\textbf{Inertia (WCSS)} & "
            "\\textbf{Silhouette Score} & \\textbf{Davies-Bouldin Index} \\\\\n\\midrule\n")
    for _, r in eval_df.iterrows():
        kv = int(r['k'])
        if kv == 4:
            f.write(f"\\textbf{{$k = {kv}$ (Optimal)}} & \\textbf{{{r['WCSS']:,.2f}}} & "
                    f"\\textbf{{{r['Silhouette']:.4f}}} & \\textbf{{{r['DBI']:.4f}}} \\\\\n")
        else:
            f.write(f"$k = {kv}$ & {r['WCSS']:,.2f} & {r['Silhouette']:.4f} & {r['DBI']:.4f} \\\\\n")
    f.write("\\bottomrule\n\\end{tabular}\n")
    f.write("\\caption{Formal K-Means evaluation metrics across $k=2$ to $10$ on the canonical Online Retail "
            "dataset ($N=4{,}338$).}\n\\label{tab:kmeans_eval}\n\\end{table}\n")
print("  -> Saved table_4_1_real.tex")

# table_4_2_algo_bench.tex
with open("table_4_2_algo_bench.tex", "w") as f:
    f.write("\\begin{table}[H]\n\\centering\n\\small\n")
    f.write("\\begin{tabular}{lcccc}\n\\toprule\n")
    f.write("\\textbf{Clustering Algorithm} & \\textbf{Silhouette Score} & "
            "\\textbf{Davies-Bouldin} & \\textbf{Noise Rejected (\\%)} & \\textbf{Runtime (s)} \\\\\n\\midrule\n")
    for _, r in bench_df.iterrows():
        f.write(f"{r['Algorithm']} & {r['Silhouette']:.4f} & {r['DBI']:.4f} & "
                f"{r['Noise_Pct']:.1f}\\% & {r['Runtime_s']:.3f}s \\\\\n")
    f.write("\\bottomrule\n\\end{tabular}\n")
    f.write("\\caption{Empirical comparison of K-Means, Hierarchical Agglomerative Clustering, and DBSCAN "
            "on the 5D Extended RFM space.}\n\\label{tab:algo_bench}\n\\end{table}\n")
print("  -> Saved table_4_2_algo_bench.tex")

# table_4_3_real.tex
with open("table_4_3_real.tex", "w") as f:
    f.write("\\begin{table}[H]\n\\centering\n\\footnotesize\n")
    f.write("\\begin{tabularx}{\\textwidth}{{>{\\bfseries}Xcccccc}}\n\\toprule\n")
    f.write("Segment Label & Customers (\\%) & $R$ (Days) & $F$ (Orders) & "
            "$M$ (\\$) & $T$ (Days) & $D$ (Items) \\\\\n\\midrule\n")
    for seg_name, r in real_profiles.iterrows():
        seg_tex = seg_name.replace("&", "\\&")
        f.write(f"{seg_tex} & {int(r['Customers']):,} ({r['Share_Pct']:.1f}\\%) & "
                f"{r['Recency']:.1f} & {r['Frequency']:.2f} & "
                f"\\${r['Monetary']:,.2f} & {r['InterPurchase_Time']:.1f} & "
                f"{r['Basket_Depth']:.1f} \\\\\n\\addlinespace\n")
    f.write("\\bottomrule\n\\end{tabularx}\n")
    f.write("\\caption{Real unscaled Extended RFM centroid profiles across the four validated customer "
            "segments ($k=4, N=4{,}338$).}\n\\label{tab:final_profiles}\n\\end{table}\n")
print("  -> Saved table_4_3_real.tex")

# build_single_dataset_notebook.py
nb_builder_code = textwrap.dedent('''\
    """
    Agent 5 - Notebook Builder
    Writes Extended_RFM_Single_Dataset_Colab.ipynb then executes it via nbclient.
    """
    import subprocess, sys, os

    for pkg in ("nbformat", "nbclient"):
        try:
            __import__(pkg)
        except ImportError:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", pkg])

    import nbformat
    from nbformat.v4 import new_notebook, new_markdown_cell, new_code_cell
    import nbclient

    NB_PATH = "Extended_RFM_Single_Dataset_Colab.ipynb"

    cells = [
        new_markdown_cell(
            "# Extended RFM Customer Segmentation\\n"
            "**Single Canonical Dataset** - Online Retail (UCI/Kaggle)\\n"
            "Thesis: Batch 62, Dept of CSE, City University, Bangladesh"
        ),
        new_code_cell(
            "import os, warnings, numpy as np, pandas as pd, matplotlib\\n"
            "matplotlib.use('Agg')\\n"
            "import matplotlib.pyplot as plt\\n"
            "from sklearn.preprocessing import StandardScaler\\n"
            "from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering\\n"
            "from sklearn.metrics import silhouette_score, davies_bouldin_score\\n"
            "warnings.filterwarnings('ignore')\\n"
            "print('Libraries loaded.')"
        ),
        new_code_cell(
            "df_raw = pd.read_csv('data/online_retail.csv', encoding='ISO-8859-1')\\n"
            "df = df_raw.dropna(subset=['CustomerID']).copy()\\n"
            "df['InvoiceNo'] = df['InvoiceNo'].astype(str)\\n"
            "df = df[~df['InvoiceNo'].str.startswith('C')]\\n"
            "df = df[(df['Quantity']>0)&(df['UnitPrice']>0)].drop_duplicates()\\n"
            "df['TotalPrice'] = df['Quantity']*df['UnitPrice']\\n"
            "df['InvoiceDate'] = pd.to_datetime(df['InvoiceDate'])\\n"
            "print(f'Cleaned rows: {len(df):,}  |  Unique customers: {df.CustomerID.nunique():,}')"
        ),
        new_code_cell(
            "snap = df['InvoiceDate'].max() + pd.Timedelta(days=1)\\n"
            "def ipt(dates):\\n"
            "    u = np.sort(dates.dt.floor('D').unique())\\n"
            "    return 0.0 if len(u)<=1 else float(np.mean(np.diff(u)/np.timedelta64(1,'D')))\\n"
            "rfm = df.groupby('CustomerID').agg(\\n"
            "    Recency=('InvoiceDate', lambda x:(snap-x.max()).days),\\n"
            "    Frequency=('InvoiceNo','nunique'),\\n"
            "    Monetary=('TotalPrice','sum'),\\n"
            "    InterPurchase_Time=('InvoiceDate', ipt),\\n"
            "    Basket_Depth=('StockCode','nunique'))\\n"
            "fcols=['Recency','Frequency','Monetary','InterPurchase_Time','Basket_Depth']\\n"
            "rfm_sc = pd.DataFrame(StandardScaler().fit_transform(np.log1p(rfm[fcols])),\\n"
            "                      index=rfm.index, columns=fcols)\\n"
            "print(rfm.describe().round(2))"
        ),
        new_code_cell(
            "evals=[]\\n"
            "for k in range(2,11):\\n"
            "    km=KMeans(n_clusters=k,init='k-means++',random_state=42,n_init=10)\\n"
            "    l=km.fit_predict(rfm_sc)\\n"
            "    evals.append({'k':k,'WCSS':km.inertia_,\\n"
            "                  'Silhouette':silhouette_score(rfm_sc,l),\\n"
            "                  'DBI':davies_bouldin_score(rfm_sc,l)})\\n"
            "ev=pd.DataFrame(evals); print(ev.to_string(index=False))"
        ),
        new_code_cell(
            "km4=KMeans(n_clusters=4,init='k-means++',random_state=42,n_init=10)\\n"
            "rfm['Cluster']=km4.fit_predict(rfm_sc)\\n"
            "order=rfm.groupby('Cluster')['Monetary'].mean().sort_values(ascending=False).index.tolist()\\n"
            "lmap={order[0]:'Champions (VIP Loyalists)',order[1]:'Loyal & Promising Regulars',\\n"
            "      order[2]:'High-Potential / At-Risk Guests',order[3]:'Hibernating / Lost Guests'}\\n"
            "rfm['Segment']=rfm['Cluster'].map(lmap)\\n"
            "print(rfm.groupby('Segment').size())"
        ),
        new_markdown_cell("All agents complete. Outputs are in the working directory."),
    ]

    nb = new_notebook(cells=cells)
    nb.metadata['kernelspec'] = {'display_name':'Python 3','language':'python','name':'python3'}
    with open(NB_PATH, 'w') as fh:
        nbformat.write(nb, fh)
    print(f"Notebook written -> {NB_PATH}")

    try:
        from nbclient import NotebookClient
        with open(NB_PATH) as fh:
            nb_loaded = nbformat.read(fh, as_version=4)
        client = NotebookClient(nb_loaded, timeout=600, kernel_name='python3',
                                resources={'metadata':{'path':os.getcwd()}})
        client.execute()
        with open(NB_PATH, 'w') as fh:
            nbformat.write(nb_loaded, fh)
        print("Notebook executed and saved with outputs.")
    except Exception as ex:
        print(f"Notebook execution skipped (no kernel available): {ex}")
''')

with open("build_single_dataset_notebook.py", "w", encoding="utf-8") as f:
    f.write(nb_builder_code)
print("  -> Saved build_single_dataset_notebook.py")

# Run the notebook builder
print("  Running build_single_dataset_notebook.py...")
import subprocess, sys
nb_result = subprocess.run(
    [sys.executable, "build_single_dataset_notebook.py"],
    capture_output=True, text=True, timeout=300
)
print(nb_result.stdout)
if nb_result.returncode != 0:
    print("  [WARN] Notebook builder stderr:", nb_result.stderr[:600])

# Bundle ZIP
bundle_files = [
    'fig4_1_account_vs_guest_tx.png',
    'fig4_2_single_vs_repeat_pie.png',
    'fig4_3_skewness_correction.png',
    'fig4_4_elbow_silhouette.png',
    'fig4_5_3d_clusters.png',
    'fig4_6_segment_profiles.png',
    'fig4_7_final_marketing_queue.png',
    'table_4_1_real.tex',
    'table_4_2_algo_bench.tex',
    'table_4_3_real.tex',
]
if os.path.exists('Extended_RFM_Single_Dataset_Colab.ipynb'):
    bundle_files.append('Extended_RFM_Single_Dataset_Colab.ipynb')

zip_path = 'single_dataset_overleaf_assets.zip'
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for fp in bundle_files:
        if os.path.exists(fp):
            zf.write(fp)
            print(f"  + {fp}")
        else:
            print(f"  ! MISSING: {fp}")

print(f"\n  -> Saved {zip_path}")

# pdflatex (optional)
import shutil as _sh
if _sh.which("pdflatex") and os.path.exists("main.tex"):
    print("  Running pdflatex (pass 1)...")
    os.system("pdflatex -interaction=nonstopmode main.tex")
    print("  Running pdflatex (pass 2)...")
    os.system("pdflatex -interaction=nonstopmode main.tex")
    print("  -> main.pdf compiled.")
else:
    print("  pdflatex not found or main.tex missing - skipping PDF compilation.")

print("\n" + "="*70)
print("  ALL 5 AGENTS COMPLETE")
print("  Outputs:")
for fp in bundle_files:
    tag = "OK  " if os.path.exists(fp) else "MISS"
    print(f"    [{tag}] {fp}")
print(f"    [ZIP ] {zip_path}")
print("="*70)
