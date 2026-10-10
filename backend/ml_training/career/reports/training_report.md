# ACRDS career model - training and evaluation report

Generated 2026-10-10 06:21 UTC by `ml_training/career/train_career_model.py`.

## Data

- Labelled survey responses: **105** (after removing bulk-duplicated submissions; see `data_preparation_report.md`).
- Classes (career family): business (26), cybersecurity (7), data (7), design (6), other (27), software (32)
- Features: 73 (full profile) / 9 (skills only). Stated career area and preferred role are excluded (label leakage).
- Validation: nested CV - outer 5 x 5-fold repeated stratified, inner 3-fold grid search.

## Family classification (mean ± std over outer folds)

| Model | Features | Accuracy | Balanced acc. | Macro F1 | Top-2 acc. | Top-3 acc. | Chosen params |
|---|---|---|---|---|---|---|---|
| Majority class (baseline) | - | 0.305 ± 0.023 | 0.167 ± 0.000 | 0.078 ± 0.005 | 0.562 ± 0.036 | 0.810 ± 0.030 | - |
| Cosine rules (current ACRDS) | skills only | 0.190 ± 0.000 | 0.167 ± 0.000 | 0.111 ± 0.000 | 0.419 ± 0.000 | 0.543 ± 0.000 | - |
| Logistic Regression | full profile | 0.474 ± 0.068 | 0.316 ± 0.072 | 0.302 ± 0.068 | 0.705 ± 0.065 | 0.825 ± 0.071 | {"logisticregression__C": 0.1} |
| Logistic Regression | skills only | 0.116 ± 0.069 | 0.154 ± 0.086 | 0.103 ± 0.058 | 0.291 ± 0.091 | 0.524 ± 0.098 | {"logisticregression__C": 1.0} |
| k-Nearest Neighbours | full profile | 0.488 ± 0.085 | 0.315 ± 0.074 | 0.289 ± 0.071 | 0.674 ± 0.058 | 0.808 ± 0.064 | {"kneighborsclassifier__n_neighbors": 3, "kneighborsclassifier__weights": "distance"} |
| k-Nearest Neighbours | skills only | 0.185 ± 0.059 | 0.131 ± 0.061 | 0.118 ± 0.053 | 0.400 ± 0.088 | 0.638 ± 0.069 | {"kneighborsclassifier__n_neighbors": 7, "kneighborsclassifier__weights": "distance"} |
| SVM (RBF kernel) | full profile | 0.552 ± 0.066 | 0.339 ± 0.043 | 0.293 ± 0.048 | 0.743 ± 0.062 | 0.817 ± 0.046 | {"svc__C": 3.0, "svc__gamma": 0.01} |
| SVM (RBF kernel) | skills only | 0.309 ± 0.091 | 0.183 ± 0.053 | 0.139 ± 0.058 | 0.573 ± 0.079 | 0.808 ± 0.032 | {"svc__C": 3.0, "svc__gamma": "scale"} |
| Random Forest | full profile | 0.560 ± 0.084 | 0.353 ± 0.075 | 0.323 ± 0.079 | 0.781 ± 0.056 | 0.874 ± 0.055 | {"max_depth": 4, "min_samples_leaf": 3} |
| Random Forest | skills only | 0.147 ± 0.070 | 0.135 ± 0.085 | 0.108 ± 0.056 | 0.335 ± 0.111 | 0.598 ± 0.083 | {"max_depth": null, "min_samples_leaf": 1} |
| XGBoost | full profile | 0.501 ± 0.084 | 0.364 ± 0.092 | 0.340 ± 0.084 | 0.720 ± 0.093 | 0.872 ± 0.060 | {"max_depth": 2} |
| XGBoost | skills only | 0.139 ± 0.069 | 0.169 ± 0.103 | 0.118 ± 0.059 | 0.312 ± 0.082 | 0.573 ± 0.092 | {"max_depth": 3} |

**Selected model: XGBoost (full profile)** - highest mean macro F1.

## Confusion matrix (selected model, out-of-fold, averaged over repeats)

Rows = true family, columns = predicted family.

| true \ pred | business | cybersecurity | data | design | other | software |
|---|---|---|---|---|---|---|
| **business** | 11 | 0 | 1 | 1 | 4 | 9 |
| **cybersecurity** | 1 | 1 | 0 | 0 | 0 | 5 |
| **data** | 2 | 0 | 0 | 0 | 1 | 4 |
| **design** | 1 | 0 | 0 | 1 | 1 | 3 |
| **other** | 3 | 1 | 0 | 0 | 23 | 0 |
| **software** | 3 | 3 | 1 | 1 | 2 | 22 |

## Career ranking (10 ACRDS careers)

Students whose stated role maps to an ACRDS career: n = 57. Score = alpha x P(family) x 100 + (1 - alpha) x cosine match (out-of-fold probabilities).

| alpha | Method | Hit@1 | Hit@3 | Hit@5 | MRR |
|---|---|---|---|---|---|
| 0.0 | cosine only (current rules) | 0.158 | 0.368 | 0.526 | 0.352 |
| 0.1 | hybrid | 0.105 | 0.368 | 0.544 | 0.326 |
| 0.2 | hybrid | 0.140 | 0.386 | 0.579 | 0.360 |
| 0.3 | hybrid | 0.158 | 0.386 | 0.632 | 0.370 |
| 0.4 | hybrid | 0.175 | 0.421 | 0.649 | 0.385 |
| 0.5 | hybrid | 0.175 | 0.439 | 0.649 | 0.390 |
| 0.6 | hybrid | 0.158 | 0.491 | 0.667 | 0.390 |
| 0.7 **(selected)** | hybrid | 0.158 | 0.491 | 0.702 | 0.392 |
| 0.8 | hybrid | 0.158 | 0.509 | 0.702 | 0.393 |
| 0.9 | hybrid | 0.158 | 0.526 | 0.684 | 0.395 |
| 1.0 | ML only | 0.158 | 0.526 | 0.702 | 0.397 |

Selected alpha = **0.7** (best Hit@5; ties -> smallest alpha). Note: alpha is chosen on the same out-of-fold predictions, so the hybrid row is slightly optimistic; confirm on new survey data.

## Most important features (permutation importance, selected model)

| Feature | Importance (drop in macro F1) |
|---|---|
| faculty_computing | 0.0611 |
| academic_year | 0.0572 |
| skill_teamwork | 0.0263 |
| trend_improving | 0.0231 |
| work_portfolio_work | 0.0190 |
| support_interview_practice | 0.0129 |
| learning_consistency | 0.0127 |
| employment_intern | 0.0110 |
| work_personal_project | 0.0078 |
| leadership_level | 0.0069 |
| faculty_science | 0.0050 |
| skill_communication | 0.0031 |
| faculty_business | 0.0012 |
| skill_digital_literacy | 0.0000 |
| skill_problem_solving | 0.0000 |

## Robustness: excluding straight-liners

Selected model re-evaluated without the 11 responses whose 9 skill ratings are identical: macro F1 0.304 ± 0.070, top-3 accuracy 0.915 ± 0.047.

## Survey-derived vs hand-set skill requirements

Mean self-rated skill of students in each family vs. the average required level of the ACRDS careers in that family (from `career_requirements.json`).

| family | skill | survey_mean | handset_required |
|---|---|---|---|
| software | digital_literacy | 3.84 | 4.67 |
| software | communication | 3.88 | 3.0 |
| software | problem_solving | 3.72 | 4.33 |
| software | leadership | 3.62 | 2.0 |
| software | teamwork | 3.81 | 4.0 |
| software | research | 3.53 | 3.0 |
| software | data_analysis | 3.34 | 3.0 |
| software | documentation | 3.72 | 4.33 |
| software | creativity | 3.72 | 2.67 |
| data | digital_literacy | 4.0 | 4.5 |
| data | communication | 3.71 | 3.5 |
| data | problem_solving | 3.86 | 4.0 |
| data | leadership | 4.0 | 2.0 |
| data | teamwork | 4.57 | 3.0 |
| data | research | 3.43 | 3.5 |
| data | data_analysis | 3.29 | 4.5 |
| data | documentation | 3.14 | 3.5 |
| data | creativity | 3.14 | 2.5 |
| cybersecurity | digital_literacy | 3.71 | 5.0 |
| cybersecurity | communication | 3.71 | 3.0 |
| cybersecurity | problem_solving | 3.57 | 5.0 |
| cybersecurity | leadership | 3.57 | 2.0 |
| cybersecurity | teamwork | 3.57 | 3.0 |
| cybersecurity | research | 3.43 | 4.0 |
| cybersecurity | data_analysis | 3.71 | 4.0 |
| cybersecurity | documentation | 3.71 | 4.0 |
| cybersecurity | creativity | 3.57 | 3.0 |
| business | digital_literacy | 3.5 | 3.33 |
| business | communication | 3.65 | 5.0 |
| business | problem_solving | 3.69 | 3.67 |
| business | leadership | 3.58 | 3.67 |
| business | teamwork | 3.81 | 4.33 |
| business | research | 3.38 | 3.33 |
| business | data_analysis | 3.23 | 3.67 |
| business | documentation | 3.58 | 4.0 |
| business | creativity | 3.5 | 3.67 |
| design | digital_literacy | 3.67 | 4.0 |
| design | communication | 3.83 | 4.0 |
| design | problem_solving | 4.0 | 3.0 |
| design | leadership | 3.83 | 2.0 |
| design | teamwork | 4.0 | 4.0 |
| design | research | 3.33 | 4.0 |
| design | data_analysis | 3.33 | 2.0 |
| design | documentation | 3.5 | 3.0 |
| design | creativity | 4.33 | 5.0 |

## Limitations

- Small dataset (105 labelled responses); small classes have high variance - see the std values and the confusion matrix.
- The label is the student's *stated* preferred role, not a verified career outcome.
- Re-run both scripts whenever new survey responses are collected.
