# Literature review and research gap

Search date: 5 November 2026. This file records how the review in thesis Chapter 2 was done, what it found,
and every correction made to the reference list, so the review can be explained and repeated.

## 1. How the search was done

- **Database:** Crossref, the official registry of scholarly DOIs (journals and conferences).
  OpenAlex had paused anonymous search and Semantic Scholar was rate-limiting (HTTP 429) on the search date;
  both are named as a limitation in the thesis.
- **Filters:** journal articles and conference papers published from 2019; English.
- **17 queries in 7 themes:** RFM and clustering (3); validating segmentations (3); new customers and cold start (3);
  datasets and algorithm benchmarks (3); RFM versus probability models (1); small businesses and social commerce (2);
  AI-written marketing messages (2).
- **Flow:** top 8 records per query = 136 records; 128 after duplicates; screened on title and abstract;
  **22 included**. **10 older or central works** added by targeted search. Every reference in the thesis was then
  checked against Crossref, a DOI lookup, or the publisher's page.
- **Read scope:** most studies were read at abstract level, so the thesis describes each only by what its abstract
  or title states.

## 2. Evidence map: how RFM-clustering studies judge their segments

Of the **17** RFM-clustering studies with an abstract among the screened records, **15** report internal indices
(Silhouette, elbow, Davies-Bouldin and so on) and **none** uses later customer behaviour to choose or test the
segmentation. The two abstracts that mention repurchase or ROC-AUC use them for a separate supervised model
(Ibrahim et al. 2026; Manikandan et al. 2026), checked by hand.

## 3. Closest studies, and how this thesis differs

| Study | What it does | How this thesis differs |
|---|---|---|
| Huang (2026), Online Retail II | Silhouette preferred k=2; kept k=4 "as more interpretable" | Tests that choice against later purchases (AUC, CIs, 5 cutoffs, 5 datasets) |
| Ozcan (2026), JTAER | Adds campaign share, **basket depth**, interval s.d.; picks k with indices | Same feature family; tests whether such features add *predictive* value: they do not |
| Ibrahim et al. (2026) | Extra features: no gain in compactness, gain in a supervised churn model | Tests segments, not a supervised model; compatible results |
| Abdul Rahim et al. (2021), JRCS | Supervised classifiers; "eight transactions are enough to classify a customer" | Measures when a segment *predicts behaviour*, not when a label can be reproduced |
| Verma et al. (2025), IIMB MR | RFM scores into classifiers for repurchase (74% accuracy) | Uses prediction to *validate segments*; a shop needs a few groups and one action each |
| Padilla & Ascarza (2021), JMR | Names and models the "cold start problem of CRM" with acquisition data | Measures when new customers' *segments* become trustworthy; TheLook result agrees with them |
| Zhao et al. (2019) | Predicts which new promotion buyers become repeat buyers | Same population, different question (segment reliability) |
| Blocker & Flint (2007); Ha et al. (2002); Wang et al. (2024) | Segments change over time; dynamic segmentation | Quantifies label persistence (38.8% early vs 62.2% established) |

## 4. Research gap (one research question each)

1. **Predictive validation:** segments are judged by indices or interpretability, never by later behaviour → RQ1.
2. **Replication:** nearly all studies use one dataset, without significance tests → RQ2.
3. **Value of extra features:** many extended-RFM variants, mixed evidence on predictive value → RQ3.
4. **Early-stage customers:** cold start is predicted and segments shift, but when a new customer's segment
   becomes predictive is unmeasured → RQ4.
5. **Deployment:** cloud tools that assume clean data and registered customers; nothing local-first for
   social-commerce sellers → RQ5.

## 5. Reference audit

**Removed: could not be found in any index.**
- `sajid2021` "Impact of feature scaling on K-means clustering for RFM-based customer segmentation" (no record anywhere).
- `nugroho2025` (no such article in *Jurnal Ilmiah Matematika dan Terapan*).
- `ijistech2023` "Bariyyah et al." (only seen cited inside another paper, under different authors and year; no index record).

**Corrected.**
- `ling2022` is actually by **P. Li**, C. Wang, J. Wu and R. Madlenak (ICMSS 2022), so the key is now `li2022`.
- `kdi2024` is actually **Handoko**, Nugraha and Sujjada, *bit-Tech* **2026**, so the key is now `handoko2026`.
- `deufmd2023` had no authors. It is **Aslantaş** et al. (DEU journal, 2023), so the key is now `aslantas2023`.
- `agus2025` has a **single author** (I. Agus). The co-author "M. S. Hasibuan" was wrong.
- `kansal2018` and `wedel2000` were completed with their full details.

**Removed claims that the cited papers do not support** (pre-defense text): that Kansal et al. showed
log-transforming improves clusters; that Ullah et al. detect lengthening purchase intervals; that Kumar et al. found
K-Means "more efficient"; that Peker et al. reported better separation; that the four segments "match" Chen/Agus.

All 83 references in the thesis are now verified and cited.

## 6. Disclosure

The searches and reference checks were run with AI assistance. Section 2.1.1 of the thesis says so in one sentence.
Keep or adapt it according to your university's rules on AI use.
