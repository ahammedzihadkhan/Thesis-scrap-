# E-Commerce Customer Segmentation via Extended RFM Modeling and Unsupervised Machine Learning

[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Machine Learning](https://img.shields.io/badge/Unsupervised%20ML-K--Means%20|%20DBSCAN%20|%20Hierarchical-orange.svg)]()

> **Undergraduate Thesis Project**  
> **Department of Computer Science & Engineering, City University, Bangladesh**  
> **Supervisor:** Monoara Sultana Morzina, Lecturer, Department of CSE  
> **Authors:**  
> - **Ahammed Zihad Khan** (ID: 0272310005101036)  
> - **Shaheda Akter** (ID: 0272310005101086)  
> - **Aurnob Saha** (ID: 0272310005101095)  
> - **Md. Nazmul Hasan** (ID: 0272310005101066)  

---

## 📌 Executive Summary

Traditional customer segmentation predominantly relies on standard **RFM (Recency, Frequency, Monetary)** models, which overlook critical temporal cadence and product discovery dynamics. This research proposes an **Extended RFM Framework ($R, F, M, T, D$)**, incorporating **Inter-Purchase Time ($T$)** and **Basket Depth ($D$)** alongside classical RFM metrics.

By applying this model to $541,909$ transactional records ($392,692$ cleaned transactions across $4,338$ distinct customers) from the canonical UCI / Kaggle Online Retail dataset, our multi-agent machine learning pipeline identifies **4 distinct behavioral customer segments**. The discovered segments directly drive automated, targeted marketing interventions with prioritized operational queues.

---

## 🔬 Mathematical Framework: Extended RFM ($R, F, M, T, D$)

For each unique customer $i \in \{1, 2, \dots, N\}$ evaluated at reference snapshot date $t_{\text{ref}} = \max(\text{InvoiceDate}) + 1\text{ day}$:

1. **Recency ($R$)**: Days elapsed since the customer's most recent completed order:
   $$R_i = t_{\text{ref}} - \max(t_{i, j})$$
2. **Frequency ($F$)**: Total number of distinct completed transactions:
   $$F_i = |\{ \text{InvoiceNo}_{i, j} \}|$$
3. **Monetary Value ($M$)**: Total cumulative monetary expenditure:
   $$M_i = \sum_{j} (\text{Quantity}_{i, j} \times \text{UnitPrice}_{i, j})$$
4. **Inter-Purchase Time ($T$)**: Mean temporal interval (in days) between consecutive purchases ($T_i = 0$ for single-purchase customers):
   $$T_i = \frac{1}{F_i - 1} \sum_{k=1}^{F_i - 1} (\tau_{i, k+1} - \tau_{i, k}) \quad (F_i \ge 2)$$
5. **Basket Depth ($D$)**: Breadth of product catalog exploration measured by unique item stock codes:
   $$D_i = |\{ \text{StockCode}_{i, j} \}|$$

---

## 📊 Discovered Customer Segments ($k=4$)

Based on K-Means clustering ($k=4$), the customer base partitions into four distinct behavioral cohorts:

| Cluster | Segment Label | Customers ($N$) | Population Share | Mean Recency ($R$) | Mean Frequency ($F$) | Mean Monetary ($M$) | Mean Inter-Purchase ($T$) | Mean Basket Depth ($D$) | Primary Marketing Strategy |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **0** | **Champions (VIP Loyalists)** | 515 | 11.9% | 12.4 days | 16.5 orders | $10,253.30 | 32.6 days | 184.0 SKUs | VIP loyalty rewards, exclusive early access, dedicated concierge |
| **1** | **Loyal & Promising Regulars** | 1,180 | 27.2% | 33.2 days | 4.7 orders | $1,795.53 | 73.7 days | 87.6 SKUs | Cross-selling, volume incentive bundles, referral programs |
| **2** | **High-Potential / At-Risk Guests** | 1,071 | 24.7% | 103.0 days | 2.7 orders | $763.65 | 107.3 days | 32.3 SKUs | Win-back discount triggers, personalized dynamic re-engagement |
| **3** | **Hibernating / Lost Guests** | 1,572 | 36.2% | 156.2 days | 1.1 orders | $426.31 | 0.1 days | 21.7 SKUs | Low-cost automated email reactivation, clearance / steep discount campaigns |

---

## 🏆 Algorithm Benchmark & Validation

Clustering quality was rigorously evaluated against multiple unsupervised architectures:

| Algorithm | Clusters ($k$) | Silhouette Score ($\uparrow$) | Davies-Bouldin Index ($\downarrow$) | Noise Ratio | Execution Time |
|:---|:---:|:---:|:---:|:---:|:---:|
| **K-Means (Selected)** | **4** | **0.3113** | **1.2442** | **0.0%** | **0.09s** |
| Hierarchical (Ward Linkage) | 4 | 0.2949 | 1.3103 | 0.0% | 1.05s |
| DBSCAN ($\epsilon=0.8, \text{minPts}=10$) | 3 | 0.0000 | 0.0000 | 3.07% | 0.27s |

*K-Means ($k=4$) yielded the highest Silhouette Score (0.3113) and lowest Davies-Bouldin Index (1.2442) with zero noise penalty and near-instantaneous convergence.*

---

## 📈 Pipeline Visualizations

| Figure | Description | File |
|:---|:---|:---|
| **Fig 4.1** | Account vs. Unregistered Guest Transactions | `fig4_1_account_vs_guest_tx.png` |
| **Fig 4.2** | Single-Order Customers vs. Repeat Buyers | `fig4_2_single_vs_repeat_pie.png` |
| **Fig 4.3** | Feature Distribution & $\log(1+x)$ Skewness Correction | `fig4_3_skewness_correction.png` |
| **Fig 4.4** | Optimal $k$ Selection (Elbow WCSS & Silhouette Curve) | `fig4_4_elbow_silhouette.png` |
| **Fig 4.5** | 3D Feature Space Projections Across Segments | `fig4_5_3d_clusters.png` |
| **Fig 4.6** | Multi-Dimensional Segment Radar & Feature Profiles | `fig4_6_segment_profiles.png` |
| **Fig 4.7** | Automated Marketing Priority Dispatch Queue | `fig4_7_final_marketing_queue.png` |

---

## ⚙️ Multi-Agent Architecture

The pipeline is organized into five modular autonomous stages:

```
[Agent 1: Data Acquisition & Hygiene]
       │  • Loads/downloads Online Retail dataset
       │  • Eliminates cancellations, negative quantities & invalid prices
       │  • Separates 135,080 guest rows; produces 392,692 valid customer records
       ▼
[Agent 2: Extended RFM Feature Engineering]
       │  • Computes R, F, M, T, D across 4,338 customers
       │  • Applies log1p transform to resolve heavy right-tail skewness
       │  • Standardizes features via Z-score scaling
       ▼
[Agent 3: Unsupervised Machine Learning]
       │  • Evaluates K-Means across k in [2, 10]
       │  • Benchmarks against Ward Hierarchical Clustering & DBSCAN
       │  • Selects optimal k=4 configuration
       ▼
[Agent 4: Behavioral Profiling & Marketing Automation]
       │  • Orders clusters by customer lifetime monetary contribution
       │  • Assigns business action tags & marketing priorities (P1-P4)
       │  • Generates full queue: final_marketing_queue_full_4338.csv
       ▼
[Agent 5: Reproducibility & Colab Notebook Generation]
          • Builds and validates Extended_RFM_Single_Dataset_Colab.ipynb
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.9 or higher
- Git

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <YOUR_REPO_URL>
cd <REPO_DIRECTORY>
pip install -r requirements.txt
```

*(Or install core dependencies directly)*:
```bash
pip install numpy pandas scikit-learn matplotlib nbformat nbclient
```

### 3. Running the Complete Pipeline
Run the master pipeline script:
```bash
python run_all_agents.py
```
*The script will automatically detect or download the dataset, execute Agents 1 through 5, generate all evaluation figures, and output the marketing priority queue.*

### 4. Interactive Jupyter / Google Colab Notebook
Open and run `Extended_RFM_Single_Dataset_Colab.ipynb` locally or in Google Colab for interactive step-by-step exploration with inline visualizations.

---

## 📁 Repository Structure

```
├── Extended_RFM_Single_Dataset_Colab.ipynb  # Interactive Jupyter/Colab notebook
├── build_single_dataset_notebook.py        # Programmatic notebook builder
├── run_all_agents.py                       # Master end-to-end execution pipeline
├── fig4_1_account_vs_guest_tx.png          # Visual: Account vs Guest distribution
├── fig4_2_single_vs_repeat_pie.png         # Visual: Single vs Repeat buyer breakdown
├── fig4_3_skewness_correction.png          # Visual: Log-transform distributions
├── fig4_4_elbow_silhouette.png             # Visual: Optimal cluster selection curves
├── fig4_5_3d_clusters.png                  # Visual: 3D cluster projection
├── fig4_6_segment_profiles.png             # Visual: Normalized segment feature profiles
├── fig4_7_final_marketing_queue.png        # Visual: Marketing dispatch priorities
├── final_marketing_queue_full_4338.csv      # Operational marketing queue (4,338 customers)
├── table_4_1_real_evaluation.csv           # K-Means evaluation metrics (k=2 to 10)
├── table_4_2_algo_benchmark.csv            # Algorithm comparison metrics
├── table_4_3_real_profiles.csv             # Final segment feature statistics
├── .gitignore                              # Git exclusion rules
└── README.md                               # Project documentation
```

---

## 📜 Citation & Academic Use

If this methodology or dataset pipeline supports your research, please reference:

```bibtex
@thesis{khan2026ecommerce,
  author       = {Ahammed Zihad Khan and Shaheda Akter and Aurnob Saha and Md. Nazmul Hasan},
  title        = {E-Commerce Customer Segmentation via Extended RFM Modeling and Unsupervised Machine Learning},
  school       = {City University, Bangladesh},
  department   = {Department of Computer Science & Engineering},
  year         = {2026},
  note         = {Supervised by Monoara Sultana Morzina}
}
```

---

## 📄 License
This project is open-sourced under the [MIT License](LICENSE).
