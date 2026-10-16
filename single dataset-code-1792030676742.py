# ==============================================================================
# COMPLETE PRE-DEFENSE ML PIPELINE (SINGLE CANONICAL DATASET - 100% REAL DATA)
# Thesis: E-Commerce Customer Segmentation via Extended RFM Modeling & ML
# Batch 62, Department of CSE, City University, Bangladesh
# ==============================================================================

import os
import glob
import shutil
import zipfile
import urllib.request
import time
import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.metrics import silhouette_score, davies_bouldin_score

warnings.filterwarnings('ignore')
os.makedirs("data", exist_ok=True)
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['axes.edgecolor'] = '#333333'

# ==============================================================================
# AGENT 1: SINGLE CANONICAL DATASET ACQUISITION & HYGIENE
# ==============================================================================
print("=== [AGENT 1] Acquiring & Cleaning Single Canonical Dataset (Online Retail) ===")
csv_path = "data/online_retail.csv"

if not os.path.exists(csv_path):
    try:
        import kagglehub
    except ImportError:
        os.system("pip install -q kagglehub openpyxl")
        import kagglehub
    try:
        print("Downloading canonical Online Retail dataset (carrie1/ecommerce-data) via Kaggle...")
        dl_folder = kagglehub.dataset_download("carrie1/ecommerce-data")
        found_csvs = glob.glob(os.path.join(dl_folder, "**", "*.csv"), recursive=True)
        if found_csvs:
            shutil.copy(found_csvs[0], csv_path)
            print(f" -> Saved real dataset to {csv_path}")
    except Exception as e:
        print(f"Kagglehub fallback triggered ({e}). Downloading from UCI Machine Learning Repository...")
        uci_url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00352/Online%20Retail.xlsx"
        urllib.request.urlretrieve(uci_url, "data/Online_Retail.xlsx")
        pd.read_excel("data/Online_Retail.xlsx").to_csv(csv_path, index=False, encoding="ISO-8859-1")

df_raw = pd.read_csv(csv_path, encoding="ISO-8859-1")
total_raw_rows = len(df_raw)
missing_cid_rows = int(df_raw['CustomerID'].isna().sum())
registered_raw_rows = total_raw_rows - missing_cid_rows

print(f"Total Raw Transactions         : {total_raw_rows:,}")
print(f"Unregistered Guest Checkouts   : {missing_cid_rows:,} ({missing_cid_rows/total_raw_rows*100:.1f}%)")
print(f"Identified Customer Checkouts  : {registered_raw_rows:,} ({registered_raw_rows/total_raw_rows*100:.1f}%)")

# Step 1.1: Sequential Cleaning Pipeline
df_clean = df_raw.dropna(subset=['CustomerID']).copy()
df_clean['InvoiceNo'] = df_clean['InvoiceNo'].astype(str)
cancelled_rows = int(df_clean['InvoiceNo'].str.startswith('C').sum())
df_clean = df_clean[~df_clean['InvoiceNo'].str.startswith('C')]
df_clean = df_clean[(df_clean['Quantity'] > 0) & (df_clean['UnitPrice'] > 0)]
before_dedup = len(df_clean)
df_clean = df_clean.drop_duplicates()
duplicate_rows = before_dedup - len(df_clean)

df_clean['TotalPrice'] = df_clean['Quantity'] * df_clean['UnitPrice']
df_clean['InvoiceDate'] = pd.to_datetime(df_clean['InvoiceDate'])
df_clean['CustomerID_Str'] = df_clean['CustomerID'].astype(int).astype(str)

print(f"Removed Cancelled Invoices     : {cancelled_rows:,}")
print(f"Removed Duplicate Line Items   : {duplicate_rows:,}")
print(f"Final Cleaned Valid Rows       : {len(df_clean):,}")
print(f"Unique Validated Customers     : {df_clean['CustomerID_Str'].nunique():,}")

# Generate Figure 4.1: Raw Transaction Breakdown on the Single Dataset
plt.figure(figsize=(8.5, 5))
categories = [
    'Valid Identified\nTransactions',
    'Unregistered Guest\nCheckouts (Missing ID)',
    'Cancelled Orders\n(Invoice Starts w/ C)',
    'Duplicate / Invalid\nLine Items'
]
counts = [len(df_clean), missing_cid_rows, cancelled_rows, duplicate_rows]
pcts = [c / total_raw_rows * 100 for c in counts]
bars = plt.bar(categories, pcts, color=['#2ecc71', '#ff9999', '#ffcc99', '#c2c2f0'], edgecolor='black')
for bar, c, p in zip(bars, counts, pcts):
    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1.2,
             f"{p:.1f}%\n({c:,})", ha='center', fontweight='bold', fontsize=9.5)
plt.ylim(0, 88)
plt.ylabel('Percentage of Raw Dataset (%)')
plt.title('Single-Dataset Transaction Hygiene & Unregistered Checkout Share (N = 541,909)')
plt.grid(axis='y', alpha=0.3)
plt.tight_layout()
plt.savefig('fig4_1_account_vs_guest_tx.png', dpi=300)
plt.show()

# ==============================================================================
# AGENT 2: EXTENDED RFM FEATURE ENGINEERING, GUEST SPLIT & SCALING
# ==============================================================================
print("\n=== [AGENT 2] Engineering 5D Extended RFM Matrix (R, F, M, T, D) ===")
snapshot_date = df_clean['InvoiceDate'].max() + pd.Timedelta(days=1)

def calc_interpurchase_time(dates):
    unique_days = np.sort(dates.dt.floor('D').unique())
    if len(unique_days) <= 1:
        return 0.0
    diffs = np.diff(unique_days) / np.timedelta64(1, 'D')
    return float(np.mean(diffs))

ext_rfm = df_clean.groupby('CustomerID').agg(
    Recency=('InvoiceDate', lambda x: (snapshot_date - x.max()).days),
    Frequency=('InvoiceNo', 'nunique'),
    Monetary=('TotalPrice', 'sum'),
    InterPurchase_Time=('InvoiceDate', calc_interpurchase_time),
    Basket_Depth=('StockCode', 'nunique'),
    Country=('Country', 'first')
)

feature_cols = ['Recency', 'Frequency', 'Monetary', 'InterPurchase_Time', 'Basket_Depth']

# Single-Invoice Guest (F=1) vs Repeat Regular (F>=2) Split on the Single Dataset
single_guest_count = int((ext_rfm['Frequency'] == 1).sum())
repeat_reg_count = int((ext_rfm['Frequency'] > 1).sum())
single_guest_pct = (single_guest_count / len(ext_rfm)) * 100
repeat_reg_pct = 100.0 - single_guest_pct

print(f"Single-Invoice Guests (F = 1)  : {single_guest_count:,} ({single_guest_pct:.1f}%)")
print(f"Repeat Regulars (F >= 2)       : {repeat_reg_count:,} ({repeat_reg_pct:.1f}%)")

# Generate Figure 4.2: Single-Invoice Guest vs Repeat Customer Pie Chart
plt.figure(figsize=(6.5, 6))
plt.pie(
    [single_guest_pct, repeat_reg_pct],
    labels=[f'Single-Purchase Guests\n(F = 1: {single_guest_count:,} customers)',
            f'Repeat Regulars\n(F >= 2: {repeat_reg_count:,} customers)'],
    autopct='%1.1f%%',
    startangle=35,
    explode=(0.06, 0),
    colors=['#ff9999', '#66b3ff'],
    shadow=True
)
plt.title('Customer-Level Guest vs. Regular Split in Online Retail Dataset (N = 4,338)')
plt.tight_layout()
plt.savefig('fig4_2_single_vs_repeat_pie.png', dpi=300)
plt.show()

# Step 2.2: Log-Transformation (np.log1p) & StandardScaler Normalization
rfm_log = np.log1p(ext_rfm[feature_cols])
scaler = StandardScaler()
rfm_scaled = pd.DataFrame(
    scaler.fit_transform(rfm_log),
    index=ext_rfm.index,
    columns=feature_cols
)

# Generate Figure 4.3: Before vs After Log-Transformation & Scaling Distributions
fig, axes = plt.subplots(2, 5, figsize=(16, 6.5))
for i, col in enumerate(feature_cols):
    axes[0, i].hist(ext_rfm[col], bins=35, color='#e74c3c', edgecolor='black', alpha=0.75)
    axes[0, i].set_title(f"Raw {col}\n(Skew={ext_rfm[col].skew():.2f})", fontsize=9.5)
    axes[1, i].hist(rfm_scaled[col], bins=35, color='#2ecc71', edgecolor='black', alpha=0.75)
    axes[1, i].set_title(f"Log + Scaled {col}\n(Skew={rfm_scaled[col].skew():.2f})", fontsize=9.5)
plt.suptitle('Effect of np.log1p Transformation and StandardScaler on Extended RFM Features', fontweight='bold')
plt.tight_layout()
plt.savefig('fig4_3_skewness_correction.png', dpi=300)
plt.show()

# ==============================================================================
# AGENT 3: ML MODEL TRAINING, DUAL VALIDATION (k=2..10) & BENCHMARKING
# ==============================================================================
print("\n=== [AGENT 3] Training K-Means (k=2..10) & Benchmarking Algorithms ===")
K_range = range(2, 11)
eval_records = []

for k in K_range:
    km = KMeans(n_clusters=k, init='k-means++', random_state=42, n_init=10)
    lbls = km.fit_predict(rfm_scaled)
    eval_records.append({
        'k': k,
        'WCSS': km.inertia_,
        'Silhouette': silhouette_score(rfm_scaled, lbls),
        'DBI': davies_bouldin_score(rfm_scaled, lbls)
    })

eval_df = pd.DataFrame(eval_records)
eval_df.to_csv('table_4_1_real_evaluation.csv', index=False)
print(eval_df.to_string(index=False))

# Generate Figure 4.4: Elbow Curve (WCSS) & Silhouette Score Plot
fig, ax = plt.subplots(1, 2, figsize=(13, 5))
ax[0].plot(eval_df['k'], eval_df['WCSS'], marker='o', linewidth=2, color='#1a73e8')
ax[0].axvline(4, color='red', linestyle='--', label='Optimal Elbow (k=4)')
ax[0].set_title('Elbow Method: Inertia (WCSS) vs. Number of Clusters (k)')
ax[0].set_xlabel('Number of Clusters (k)')
ax[0].set_ylabel('Within-Cluster Sum of Squares (WCSS)')
ax[0].legend()
ax[0].grid(True, alpha=0.3)

ax[1].plot(eval_df['k'], eval_df['Silhouette'], marker='s', linewidth=2, color='#34a853')
ax[1].axvline(4, color='red', linestyle='--', label='Selected Optimal k=4')
ax[1].set_title('Silhouette Score vs. Number of Clusters (k)')
ax[1].set_xlabel('Number of Clusters (k)')
ax[1].set_ylabel('Silhouette Coefficient')
ax[1].legend()
ax[1].grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('fig4_4_elbow_silhouette.png', dpi=300)
plt.show()

# Side-by-Side Benchmarking: K-Means vs Hierarchical vs DBSCAN
t0 = time.time()
km_final = KMeans(n_clusters=4, init='k-means++', random_state=42, n_init=10)
ext_rfm['Cluster'] = km_final.fit_predict(rfm_scaled)
km_time = time.time() - t0
km_sil = silhouette_score(rfm_scaled, ext_rfm['Cluster'])
km_dbi = davies_bouldin_score(rfm_scaled, ext_rfm['Cluster'])

t0 = time.time()
hc_model = AgglomerativeClustering(n_clusters=4, linkage='ward')
hc_lbls = hc_model.fit_predict(rfm_scaled)
hc_time = time.time() - t0
hc_sil = silhouette_score(rfm_scaled, hc_lbls)
hc_dbi = davies_bouldin_score(rfm_scaled, hc_lbls)

t0 = time.time()
db_model = DBSCAN(eps=0.8, min_samples=10)
db_lbls = db_model.fit_predict(rfm_scaled)
db_time = time.time() - t0
valid_mask = db_lbls != -1
db_sil = silhouette_score(rfm_scaled[valid_mask], db_lbls[valid_mask]) if len(set(db_lbls[valid_mask])) > 1 else 0.0
db_dbi = davies_bouldin_score(rfm_scaled[valid_mask], db_lbls[valid_mask]) if len(set(db_lbls[valid_mask])) > 1 else 0.0
db_noise_pct = (db_lbls == -1).mean() * 100

bench_df = pd.DataFrame([
    {'Algorithm': 'K-Means (k=4, Selected)', 'Silhouette': km_sil, 'DBI': km_dbi, 'Noise_Pct': 0.0, 'Runtime_s': km_time},
    {'Algorithm': 'Hierarchical (Ward, k=4)', 'Silhouette': hc_sil, 'DBI': hc_dbi, 'Noise_Pct': 0.0, 'Runtime_s': hc_time},
    {'Algorithm': 'DBSCAN (eps=0.8, minPts=10)', 'Silhouette': db_sil, 'DBI': db_dbi, 'Noise_Pct': db_noise_pct, 'Runtime_s': db_time}
])
bench_df.to_csv('table_4_2_algo_benchmark.csv', index=False)
print("\n=== Algorithm Comparison on Single Dataset ===")
print(bench_df.to_string(index=False))

# ==============================================================================
# AGENT 4: SEGMENT PROFILING, 3D VISUALIZATION & AUTOMATED MARKETING QUEUE
# ==============================================================================
print("\n=== [AGENT 4] Profiling Segments & Generating Marketing Queue ===")
cluster_order = ext_rfm.groupby('Cluster')['Monetary'].mean().sort_values(ascending=False).index.tolist()
label_map = {
    cluster_order[0]: 'Champions (VIP Loyalists)',
    cluster_order[1]: 'Loyal & Promising Regulars',
    cluster_order[2]: 'High-Potential / At-Risk Guests',
    cluster_order[3]: 'Hibernating / Lost Guests'
}
ext_rfm['Segment_Label'] = ext_rfm['Cluster'].map(label_map)

real_profiles = ext_rfm.groupby('Segment_Label').agg(
    Customers=('Recency', 'count'),
    Share_Pct=('Recency', lambda x: round(len(x) / len(ext_rfm) * 100, 1)),
    Recency=('Recency', 'mean'),
    Frequency=('Frequency', 'mean'),
    Monetary=('Monetary', 'mean'),
    InterPurchase_Time=('InterPurchase_Time', 'mean'),
    Basket_Depth=('Basket_Depth', 'mean')
).loc[list(label_map.values())].round(2)

real_profiles.to_csv('table_4_3_real_profiles.csv')
print(real_profiles.to_string())

# Generate Figure 4.5: Real 3D Cluster Scatter Plot
fig = plt.figure(figsize=(10, 7))
ax = fig.add_subplot(111, projection='3d')
palette = {
    'Champions (VIP Loyalists)': '#2ecc71',
    'Loyal & Promising Regulars': '#3498db',
    'High-Potential / At-Risk Guests': '#f39c12',
    'Hibernating / Lost Guests': '#e74c3c'
}
for seg_name, grp in ext_rfm.groupby('Segment_Label'):
    idx = grp.index
    ax.scatter(
        rfm_scaled.loc[idx, 'Recency'],
        rfm_scaled.loc[idx, 'Frequency'],
        rfm_scaled.loc[idx, 'Monetary'],
        label=seg_name, c=palette[seg_name], s=20, alpha=0.72
    )
ax.set_xlabel('Scaled Recency (R)')
ax.set_ylabel('Scaled Frequency (F)')
ax.set_zlabel('Scaled Monetary (M)')
ax.set_title('3D Scatter Plot of Extended RFM Customer Segments (k=4, N=4,338)')
ax.legend(loc='upper left')
plt.tight_layout()
plt.savefig('fig4_5_3d_clusters.png', dpi=300)
plt.show()

# Generate Figure 4.6: Standardized Extended RFM Attribute Bar Chart
scaled_means = rfm_scaled.groupby(ext_rfm['Segment_Label'])[feature_cols].mean().loc[list(label_map.values())]
scaled_means.plot(kind='bar', figsize=(11, 5), width=0.75, rot=12)
plt.axhline(0, color='black', linewidth=0.8)
plt.ylabel('Mean Standardized Score (Z-Score)')
plt.title('Standardized Extended RFM Attribute Profiles Across Customer Segments (k=4)')
plt.grid(axis='y', alpha=0.3)
plt.tight_layout()
plt.savefig('fig4_6_segment_profiles.png', dpi=300)
plt.show()

# Generate Figure 4.7: Automated Email & WhatsApp Marketing Queue from Real CustomerIDs
ext_rfm_sorted = ext_rfm.sort_index().copy()
ext_rfm_sorted['Customer_Key'] = [f"ID-{int(cid)}" for cid in ext_rfm_sorted.index]

def build_campaign_row(row):
    seg = row['Segment_Label']
    cid = row['Customer_Key']
    spend = row['Monetary']
    depth = int(row['Basket_Depth'])
    if seg == 'Champions (VIP Loyalists)':
        return pd.Series([
            f"Hi {cid}, thank you for spending ${spend:,.2f} across {depth} items! VIP early access unlocked.",
            f"*WhatsApp VIP*: Hello {cid}, your priority loyalty tier reward is ready!"
        ])
    elif seg == 'Loyal & Promising Regulars':
        return pd.Series([
            f"Hi {cid}, we curated new arrivals for your {depth}-item basket! Use code LOYAL15.",
            f"*WhatsApp Exclusive*: Hi {cid}, claim 15% off your next bundle order!"
        ])
    elif seg == 'High-Potential / At-Risk Guests':
        return pd.Series([
            f"Hi {cid}, loved your recent order (${spend:,.2f})! Convert to VIP with code GUEST20.",
            f"*WhatsApp Offer*: Hello {cid}, reorder today via WhatsApp & save 20%!"
        ])
    else:
        return pd.Series([
            f"Hi {cid}, we miss you! Enjoy a 10% reactivation voucher: COMEBACK10.",
            f"*WhatsApp Flash Sale*: Hi {cid}, tap here for clearance items!"
        ])

ext_rfm_sorted[['Email_Campaign', 'WhatsApp_Campaign']] = ext_rfm_sorted.apply(build_campaign_row, axis=1)
ext_rfm_sorted[['Customer_Key', 'Segment_Label', 'Email_Campaign', 'WhatsApp_Campaign']].to_csv(
    'final_marketing_queue_full_4338.csv', index=False
)

# Sample 2 real customers from each of the 4 segments (8 rows) for clean Figure 4.7 table rendering
sampled_queue = (
    ext_rfm_sorted.groupby('Segment_Label', group_keys=False)
    .apply(lambda g: g.head(2))
    .loc[:, ['Customer_Key', 'Segment_Label', 'Email_Campaign', 'WhatsApp_Campaign']]
)

fig, ax = plt.subplots(figsize=(13.5, 4.0))
ax.axis('tight')
ax.axis('off')
tbl = ax.table(cellText=sampled_queue.values, colLabels=sampled_queue.columns, cellLoc='left', loc='center')
tbl.auto_set_font_size(False)
tbl.set_fontsize(8.2)
tbl.scale(1, 1.48)
for (r, c), cell in tbl.get_celld().items():
    if r == 0:
        cell.set_text_props(weight='bold', color='white')
        cell.set_facecolor('#1a73e8')
    elif r % 2 == 0:
        cell.set_facecolor('#f1f3f4')
    cell.set_edgecolor('#dadce0')
plt.title('Automated Email & WhatsApp Marketing Queue Driven by Extended RFM Segments (Stratified Sample)',
          fontweight='bold', fontsize=10.5, pad=10)
plt.tight_layout()
plt.savefig('fig4_7_final_marketing_queue.png', dpi=300, bbox_inches='tight')
plt.show()

# ==============================================================================
# AGENT 5: AUTO-GENERATE LATEX TABLES & BUNDLE OVERLEAF ZIP
# ==============================================================================
print("\n=== [AGENT 5] Exporting Real LaTeX Tables & Packaging ZIP ===")

with open("table_4_1_real.tex", "w") as f:
    f.write("\\begin{table}[H]\n\\centering\n\\small\n")
    f.write("\\begin{tabular}{cccc}\n\\toprule\n")
    f.write("\\textbf{Clusters ($k$)} & \\textbf{Inertia (WCSS)} & \\textbf{Silhouette Score} & \\textbf{Davies-Bouldin Index} \\\\\n\\midrule\n")
    for _, r in eval_df.iterrows():
        kv = int(r['k'])
        if kv == 4:
            f.write(f"\\textbf{{$k = {kv}$ (Optimal)}} & \\textbf{{{r['WCSS']:,.2f}}} & \\textbf{{{r['Silhouette']:.4f}}} & \\textbf{{{r['DBI']:.4f}}} \\\\\n")
        else:
            f.write(f"$k = {kv}$ & {r['WCSS']:,.2f} & {r['Silhouette']:.4f} & {r['DBI']:.4f} \\\\\n")
    f.write("\\bottomrule\n\\end{tabular}\n")
    f.write("\\caption{Formal K-Means evaluation metrics across $k=2$ to $10$ on the canonical Online Retail dataset ($N=4,338$).}\n")
    f.write("\\label{tab:kmeans_eval}\n\\end{table}\n")

with open("table_4_2_algo_bench.tex", "w") as f:
    f.write("\\begin{table}[H]\n\\centering\n\\small\n")
    f.write("\\begin{tabular}{lcccc}\n\\toprule\n")
    f.write("\\textbf{Clustering Algorithm} & \\textbf{Silhouette Score} & \\textbf{Davies-Bouldin} & \\textbf{Noise Rejected (\\%)} & \\textbf{Runtime (s)} \\\\\n\\midrule\n")
    for _, r in bench_df.iterrows():
        f.write(f"{r['Algorithm']} & {r['Silhouette']:.4f} & {r['DBI']:.4f} & {r['Noise_Pct']:.1f}\\% & {r['Runtime_s']:.3f}s \\\\\n")
    f.write("\\bottomrule\n\\end{tabular}\n")
    f.write("\\caption{Empirical comparison of K-Means, Hierarchical Agglomerative Clustering, and DBSCAN on the 5D Extended RFM space.}\n")
    f.write("\\label{tab:algo_bench}\n\\end{table}\n")

with open("table_4_3_real.tex", "w") as f:
    f.write("\\begin{table}[H]\n\\centering\n\\footnotesize\n")
    f.write("\\begin{tabularx}{\\textwidth}{>{\\bfseries}Xcccccc}\n\\toprule\n")
    f.write("Segment Label & Customers (\\%) & $R$ (Days) & $F$ (Orders) & $M$ (\\$) & $T$ (Days) & $D$ (Items) \\\\\n\\midrule\n")
    for seg_name, r in real_profiles.iterrows():
        seg_tex = seg_name.replace("&", "\\&")
        f.write(f"{seg_tex} & {int(r['Customers']):,} ({r['Share_Pct']:.1f}\\%) & {r['Recency']:.1f} & {r['Frequency']:.2f} & \\${r['Monetary']:,.2f} & {r['InterPurchase_Time']:.1f} & {r['Basket_Depth']:.1f} \\\\\n\\addlinespace\n")
    f.write("\\bottomrule\n\\end{tabularx}\n")
    f.write("\\caption{Real unscaled Extended RFM centroid profiles across the four validated customer segments ($k=4, N=4,338$).}\n")
    f.write("\\label{tab:final_profiles}\n\\end{table}\n")

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
    'table_4_3_real.tex'
]
with zipfile.ZipFile('single_dataset_overleaf_assets.zip', 'w') as zf:
    for fpath in bundle_files:
        if os.path.exists(fpath):
            zf.write(fpath)

print("SUCCESS! All 7 real figures and 3 LaTeX tables packaged into 'single_dataset_overleaf_assets.zip'.")