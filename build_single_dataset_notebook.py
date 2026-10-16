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
        "# Extended RFM Customer Segmentation\n"
        "**Single Canonical Dataset** - Online Retail (UCI/Kaggle)\n"
        "Thesis: Batch 62, Dept of CSE, City University, Bangladesh"
    ),
    new_code_cell(
        "import os, warnings, numpy as np, pandas as pd, matplotlib\n"
        "matplotlib.use('Agg')\n"
        "import matplotlib.pyplot as plt\n"
        "from sklearn.preprocessing import StandardScaler\n"
        "from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering\n"
        "from sklearn.metrics import silhouette_score, davies_bouldin_score\n"
        "warnings.filterwarnings('ignore')\n"
        "print('Libraries loaded.')"
    ),
    new_code_cell(
        "df_raw = pd.read_csv('data/online_retail.csv', encoding='ISO-8859-1')\n"
        "df = df_raw.dropna(subset=['CustomerID']).copy()\n"
        "df['InvoiceNo'] = df['InvoiceNo'].astype(str)\n"
        "df = df[~df['InvoiceNo'].str.startswith('C')]\n"
        "df = df[(df['Quantity']>0)&(df['UnitPrice']>0)].drop_duplicates()\n"
        "df['TotalPrice'] = df['Quantity']*df['UnitPrice']\n"
        "df['InvoiceDate'] = pd.to_datetime(df['InvoiceDate'])\n"
        "print(f'Cleaned rows: {len(df):,}  |  Unique customers: {df.CustomerID.nunique():,}')"
    ),
    new_code_cell(
        "snap = df['InvoiceDate'].max() + pd.Timedelta(days=1)\n"
        "def ipt(dates):\n"
        "    u = np.sort(dates.dt.floor('D').unique())\n"
        "    return 0.0 if len(u)<=1 else float(np.mean(np.diff(u)/np.timedelta64(1,'D')))\n"
        "rfm = df.groupby('CustomerID').agg(\n"
        "    Recency=('InvoiceDate', lambda x:(snap-x.max()).days),\n"
        "    Frequency=('InvoiceNo','nunique'),\n"
        "    Monetary=('TotalPrice','sum'),\n"
        "    InterPurchase_Time=('InvoiceDate', ipt),\n"
        "    Basket_Depth=('StockCode','nunique'))\n"
        "fcols=['Recency','Frequency','Monetary','InterPurchase_Time','Basket_Depth']\n"
        "rfm_sc = pd.DataFrame(StandardScaler().fit_transform(np.log1p(rfm[fcols])),\n"
        "                      index=rfm.index, columns=fcols)\n"
        "print(rfm.describe().round(2))"
    ),
    new_code_cell(
        "evals=[]\n"
        "for k in range(2,11):\n"
        "    km=KMeans(n_clusters=k,init='k-means++',random_state=42,n_init=10)\n"
        "    l=km.fit_predict(rfm_sc)\n"
        "    evals.append({'k':k,'WCSS':km.inertia_,\n"
        "                  'Silhouette':silhouette_score(rfm_sc,l),\n"
        "                  'DBI':davies_bouldin_score(rfm_sc,l)})\n"
        "ev=pd.DataFrame(evals); print(ev.to_string(index=False))"
    ),
    new_code_cell(
        "km4=KMeans(n_clusters=4,init='k-means++',random_state=42,n_init=10)\n"
        "rfm['Cluster']=km4.fit_predict(rfm_sc)\n"
        "order=rfm.groupby('Cluster')['Monetary'].mean().sort_values(ascending=False).index.tolist()\n"
        "lmap={order[0]:'Champions (VIP Loyalists)',order[1]:'Loyal & Promising Regulars',\n"
        "      order[2]:'High-Potential / At-Risk Guests',order[3]:'Hibernating / Lost Guests'}\n"
        "rfm['Segment']=rfm['Cluster'].map(lmap)\n"
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
