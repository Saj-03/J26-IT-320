# ACRDS student segmentation (K-Means) - report

Generated 2026-10-13 15:00 UTC by `ml_training/career/train_persona_clusters.py`. Data: 110 clean survey responses (all respondents; no label needed).

## Choosing features and k (silhouette score, higher = better separated)

| features | k=2 | k=3 | k=4 | k=5 | k=6 |
|---|---|---|---|---|---|
| Skills (standardised) - used | 0.39 | 0.277 | 0.218 | 0.201 | 0.188 |
| Shape only (ratings minus own average) | 0.147 | 0.142 | 0.127 | 0.133 | 0.137 |
| Shape + overall level | 0.191 | 0.193 | 0.182 | 0.143 | 0.123 |

**Chosen: standardised skills, k = 3.** k = 2 has the highest silhouette but only splits students into high and low self-raters. k = 3 keeps a moderate structure and adds a middle group, which is more useful for guidance. Clustering on the *shape* of the ratings (strengths vs. weaknesses) gives very weak structure (silhouette around 0.13-0.15), so students differ mainly in their overall self-rated level.

## Personas (mean self-rating 1-5)

| persona | digital_literacy | communication | problem_solving | leadership | teamwork | research | data_analysis | documentation | creativity | average | students |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Developing | 2.4 | 2.5 | 2.67 | 2.33 | 2.7 | 2.4 | 2.4 | 2.57 | 2.57 | 2.5 | 30 |
| Progressing | 3.92 | 3.81 | 3.75 | 3.77 | 3.98 | 3.5 | 3.4 | 3.42 | 3.52 | 3.67 | 48 |
| Advanced | 4.28 | 4.62 | 4.59 | 4.69 | 4.75 | 4.41 | 4.06 | 4.81 | 4.66 | 4.54 | 32 |

## Stability

Clusters re-fitted on 200 bootstrap samples: adjusted Rand index median **0.97** (inter-quartile range 0.92-0.98). Values near 1 mean the grouping is reproducible.

## How personas relate to career choice and experience

| career family | Developing | Progressing | Advanced |
|---|---|---|---|
| (unlabelled) | 2 | 1 | 2 |
| business | 7 | 12 | 7 |
| cybersecurity | 3 | 2 | 2 |
| data | 1 | 5 | 1 |
| design | 1 | 2 | 3 |
| other | 8 | 11 | 8 |
| software | 8 | 15 | 9 |

| career-related work | Developing | Progressing | Advanced |
|---|---|---|---|
| Currently following/working on one | 4 | 9 | 7 |
| No | 8 | 14 | 3 |
| Planning to start | 5 | 1 | 4 |
| Yes | 13 | 24 | 18 |

The career-family mix is similar in every persona: personas describe *readiness level*, not *career direction*. They are therefore shown as guidance and do not change the career ranking.

## Limitations

- Based on self-ratings, which may differ from actual ability (some students rate themselves generously).
- 13 respondents gave the same rating to all 9 skills; they are kept.
- Small sample: re-run after collecting more responses.
