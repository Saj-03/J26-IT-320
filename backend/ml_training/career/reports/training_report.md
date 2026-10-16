# ACRDS career model - training and evaluation report

Generated 2026-10-15 06:19 UTC by `ml_training/career/train_career_model.py`.

## Data

- Labelled survey responses: **140** (after removing bulk-duplicated submissions; see `data_preparation_report.md`).
- Classes (career family): business (34), cybersecurity (8), data (11), design (6), other (37), software (44)
- Features: 73 (full profile) / 9 (skills only). Stated career area and preferred role are excluded (label leakage).
- Validation: nested CV - outer 5 x 5-fold repeated stratified, inner 3-fold grid search.

## Family classification (mean ± std over outer folds)

| Model | Features | Accuracy | Balanced acc. | Macro F1 | Top-2 acc. | Top-3 acc. | Chosen params |
|---|---|---|---|---|---|---|---|
| Majority class (baseline) | - | 0.314 ± 0.014 | 0.167 ± 0.000 | 0.080 ± 0.003 | 0.579 ± 0.014 | 0.821 ± 0.023 | - |
| Cosine rules (current ACRDS) | skills only | 0.229 ± 0.000 | 0.147 ± 0.000 | 0.127 ± 0.000 | 0.507 ± 0.000 | 0.664 ± 0.000 | - |
| Logistic Regression | full profile | 0.519 ± 0.090 | 0.380 ± 0.109 | 0.366 ± 0.096 | 0.747 ± 0.073 | 0.844 ± 0.057 | {"logisticregression__C": 0.03} |
| Logistic Regression | skills only | 0.164 ± 0.061 | 0.170 ± 0.076 | 0.140 ± 0.055 | 0.376 ± 0.069 | 0.616 ± 0.081 | {"logisticregression__C": 1.0} |
| k-Nearest Neighbours | full profile | 0.473 ± 0.063 | 0.305 ± 0.052 | 0.286 ± 0.057 | 0.664 ± 0.063 | 0.811 ± 0.057 | {"kneighborsclassifier__n_neighbors": 3, "kneighborsclassifier__weights": "distance"} |
| k-Nearest Neighbours | skills only | 0.266 ± 0.077 | 0.163 ± 0.049 | 0.150 ± 0.046 | 0.489 ± 0.068 | 0.713 ± 0.079 | {"kneighborsclassifier__n_neighbors": 3, "kneighborsclassifier__weights": "distance"} |
| SVM (RBF kernel) | full profile | 0.553 ± 0.069 | 0.327 ± 0.042 | 0.288 ± 0.045 | 0.777 ± 0.035 | 0.857 ± 0.039 | {"svc__C": 1.0, "svc__gamma": 0.01} |
| SVM (RBF kernel) | skills only | 0.273 ± 0.055 | 0.149 ± 0.031 | 0.097 ± 0.026 | 0.537 ± 0.042 | 0.821 ± 0.025 | {"svc__C": 1.0, "svc__gamma": "scale"} |
| Random Forest | full profile | 0.574 ± 0.056 | 0.364 ± 0.040 | 0.340 ± 0.052 | 0.789 ± 0.071 | 0.887 ± 0.045 | {"max_depth": 4, "min_samples_leaf": 3} |
| Random Forest | skills only | 0.211 ± 0.082 | 0.151 ± 0.074 | 0.143 ± 0.063 | 0.446 ± 0.072 | 0.703 ± 0.066 | {"max_depth": null, "min_samples_leaf": 1} |
| XGBoost | full profile | 0.547 ± 0.081 | 0.363 ± 0.069 | 0.344 ± 0.070 | 0.763 ± 0.067 | 0.859 ± 0.049 | {"max_depth": 2} |
| XGBoost | skills only | 0.227 ± 0.084 | 0.204 ± 0.079 | 0.188 ± 0.067 | 0.434 ± 0.074 | 0.680 ± 0.060 | {"max_depth": 3} |

**Selected model: Logistic Regression (full profile)** - highest mean macro F1.

## Confusion matrix (selected model, out-of-fold, averaged over repeats)

Rows = true family, columns = predicted family.

| true \ pred | business | cybersecurity | data | design | other | software |
|---|---|---|---|---|---|---|
| **business** | 14 | 3 | 3 | 0 | 9 | 5 |
| **cybersecurity** | 1 | 1 | 1 | 0 | 1 | 4 |
| **data** | 2 | 0 | 3 | 0 | 1 | 5 |
| **design** | 0 | 0 | 2 | 1 | 1 | 2 |
| **other** | 5 | 2 | 0 | 0 | 29 | 1 |
| **software** | 5 | 6 | 6 | 0 | 1 | 26 |

## Career ranking (29 ACRDS careers)

Students whose stated role maps to an ACRDS career: n = 107. Score = alpha x P(family) x 100 + (1 - alpha) x cosine match (out-of-fold probabilities).

| alpha | Method | Hit@1 | Hit@3 | Hit@5 | MRR |
|---|---|---|---|---|---|
| 0.0 | cosine only (current rules) | 0.131 | 0.196 | 0.271 | 0.226 |
| 0.1 | hybrid | 0.093 | 0.178 | 0.271 | 0.204 |
| 0.2 | hybrid | 0.112 | 0.215 | 0.308 | 0.229 |
| 0.3 | hybrid | 0.140 | 0.252 | 0.336 | 0.264 |
| 0.4 | hybrid | 0.150 | 0.271 | 0.383 | 0.283 |
| 0.5 | hybrid | 0.140 | 0.327 | 0.402 | 0.292 |
| 0.6 | hybrid | 0.131 | 0.336 | 0.430 | 0.296 |
| 0.7 | hybrid | 0.131 | 0.327 | 0.449 | 0.295 |
| 0.8 | hybrid | 0.131 | 0.346 | 0.458 | 0.299 |
| 0.9 **(selected)** | hybrid | 0.131 | 0.355 | 0.477 | 0.301 |
| 1.0 | ML only | 0.140 | 0.374 | 0.486 | 0.309 |

Selected alpha = **0.9** (best Hit@5 with alpha <= 0.9, so skill match keeps a role; ties -> smallest alpha). Note: alpha is chosen on the same out-of-fold predictions, so the hybrid row is slightly optimistic; confirm on new survey data.

## Most important features (permutation importance, selected model)

| Feature | Importance (drop in macro F1) |
|---|---|
| skill_creativity | 0.0444 |
| faculty_business | 0.0390 |
| faculty_computing | 0.0328 |
| academic_year | 0.0261 |
| faculty_other | 0.0218 |
| leadership_level | 0.0204 |
| extra_volunteering | 0.0202 |
| support_certification_recommendations | 0.0199 |
| support_skill_gap_analysis | 0.0191 |
| support_course_recommendations | 0.0165 |
| support_interview_practice | 0.0158 |
| skill_digital_literacy | 0.0157 |
| trend_declining | 0.0148 |
| work_academic_project | 0.0127 |
| faculty_engineering | 0.0127 |

## Robustness: excluding straight-liners

Selected model re-evaluated without the 20 responses whose 9 skill ratings are identical: macro F1 0.381 ± 0.098, top-3 accuracy 0.878 ± 0.067.

## Survey-derived vs hand-set skill requirements

Mean self-rated skill of students in each family vs. the average required level of the ACRDS careers in that family (from `career_requirements.json`).

| family | skill | survey_mean | handset_required |
|---|---|---|---|
| software | digital_literacy | 3.89 | 4.67 |
| software | communication | 3.77 | 3.0 |
| software | problem_solving | 3.73 | 4.33 |
| software | leadership | 3.57 | 2.0 |
| software | teamwork | 3.82 | 4.0 |
| software | research | 3.45 | 3.0 |
| software | data_analysis | 3.39 | 3.0 |
| software | documentation | 3.61 | 4.33 |
| software | creativity | 3.68 | 2.67 |
| data | digital_literacy | 4.27 | 4.5 |
| data | communication | 4.0 | 3.5 |
| data | problem_solving | 4.09 | 4.0 |
| data | leadership | 4.0 | 2.0 |
| data | teamwork | 4.55 | 3.0 |
| data | research | 3.82 | 3.5 |
| data | data_analysis | 3.55 | 4.5 |
| data | documentation | 3.64 | 3.5 |
| data | creativity | 3.18 | 2.5 |
| cybersecurity | digital_literacy | 3.75 | 5.0 |
| cybersecurity | communication | 3.88 | 3.0 |
| cybersecurity | problem_solving | 3.62 | 5.0 |
| cybersecurity | leadership | 3.62 | 2.0 |
| cybersecurity | teamwork | 3.62 | 3.0 |
| cybersecurity | research | 3.5 | 4.0 |
| cybersecurity | data_analysis | 3.75 | 4.0 |
| cybersecurity | documentation | 3.75 | 4.0 |
| cybersecurity | creativity | 3.62 | 3.0 |
| business | digital_literacy | 3.47 | 3.29 |
| business | communication | 3.71 | 4.43 |
| business | problem_solving | 3.68 | 3.43 |
| business | leadership | 3.53 | 2.86 |
| business | teamwork | 3.79 | 3.71 |
| business | research | 3.41 | 3.29 |
| business | data_analysis | 3.21 | 3.0 |
| business | documentation | 3.56 | 3.71 |
| business | creativity | 3.5 | 3.14 |
| design | digital_literacy | 3.67 | 4.33 |
| design | communication | 3.83 | 3.33 |
| design | problem_solving | 4.0 | 3.0 |
| design | leadership | 3.83 | 2.0 |
| design | teamwork | 4.0 | 3.33 |
| design | research | 3.33 | 4.0 |
| design | data_analysis | 3.33 | 2.0 |
| design | documentation | 3.5 | 3.0 |
| design | creativity | 4.33 | 4.33 |
| other | digital_literacy | 3.24 | 3.62 |
| other | communication | 3.68 | 3.77 |
| other | problem_solving | 3.76 | 3.46 |
| other | leadership | 3.73 | 2.38 |
| other | teamwork | 4.0 | 3.0 |
| other | research | 3.62 | 3.69 |
| other | data_analysis | 3.14 | 2.92 |
| other | documentation | 3.65 | 3.69 |
| other | creativity | 3.62 | 2.69 |

## Limitations

- Small dataset (140 labelled responses); small classes have high variance - see the std values and the confusion matrix.
- The label is the student's *stated* preferred role, not a verified career outcome.
- Re-run both scripts whenever new survey responses are collected.
