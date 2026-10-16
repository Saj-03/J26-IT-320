# ACRDS student segmentation (K-Means) - report

Generated 2026-10-15 06:10 UTC by `ml_training/career/train_persona_clusters.py`. Data: 149 clean survey responses (all respondents; no label needed).

## Choosing features and k (silhouette score, higher = better separated)

| features | k=2 | k=3 | k=4 | k=5 | k=6 |
|---|---|---|---|---|---|
| Skills (standardised) - used | 0.37 | 0.26 | 0.221 | 0.213 | 0.208 |
| Shape only (ratings minus own average) | 0.222 | 0.199 | 0.196 | 0.163 | 0.173 |
| Shape + overall level | 0.198 | 0.191 | 0.174 | 0.175 | 0.16 |

**Chosen: standardised skills, k = 3.** k = 2 has the highest silhouette but only splits students into high and low self-raters. k = 3 keeps a moderate structure and adds a middle group, which is more useful for guidance. Clustering on the *shape* of the ratings (strengths vs. weaknesses) gives very weak structure (silhouette around 0.13-0.15), so students differ mainly in their overall self-rated level.

## Personas (mean self-rating 1-5)

| persona | digital_literacy | communication | problem_solving | leadership | teamwork | research | data_analysis | documentation | creativity | average | students |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Developing | 2.55 | 2.62 | 2.72 | 2.48 | 2.78 | 2.55 | 2.5 | 2.68 | 2.62 | 2.61 | 40 |
| Progressing | 3.88 | 3.82 | 3.79 | 3.68 | 4.0 | 3.5 | 3.38 | 3.44 | 3.56 | 3.67 | 68 |
| Advanced | 4.17 | 4.63 | 4.56 | 4.68 | 4.71 | 4.44 | 3.98 | 4.76 | 4.56 | 4.5 | 41 |

## Stability

Clusters re-fitted on 200 bootstrap samples: adjusted Rand index median **0.84** (inter-quartile range 0.70-0.96). Values near 1 mean the grouping is reproducible.

## How personas relate to career choice and experience

| career family | Developing | Progressing | Advanced |
|---|---|---|---|
| (unlabelled) | 6 | 1 | 2 |
| business | 10 | 16 | 8 |
| cybersecurity | 3 | 2 | 3 |
| data | 1 | 7 | 3 |
| design | 1 | 2 | 3 |
| other | 10 | 15 | 12 |
| software | 9 | 25 | 10 |

| career-related work | Developing | Progressing | Advanced |
|---|---|---|---|
| Currently following/working on one | 4 | 12 | 7 |
| No | 15 | 20 | 9 |
| Planning to start | 6 | 5 | 7 |
| Yes | 15 | 31 | 18 |

The career-family mix is similar in every persona: personas describe *readiness level*, not *career direction*. They are therefore shown as guidance and do not change the career ranking.

## Limitations

- Based on self-ratings, which may differ from actual ability (some students rate themselves generously).
- 25 respondents gave the same rating to all 9 skills; they are kept.
- Small sample: re-run after collecting more responses.
