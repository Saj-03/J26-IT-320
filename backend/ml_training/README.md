# ml_training/

Offline scripts / notebooks used to TRAIN and EVALUATE models.
The API never trains models - it only loads the saved file from `ml_models/`.

| Folder | Owner | What it trains |
|---|---|---|
| career/ | IT23207240 | Recommender evaluation (Precision@5), SBERT answer-similarity validation |
| physical_wellbeing/ | IT23316522 | XGBoost adherence model -> `ml_models/adherence_xgb.joblib` |
| scheduler/ | IT23270206 | Attention-capacity estimation error, peak-window stability analysis |
| burnout/ | IT23201378 | Isolation Forest tuning on StudentLife data, fusion weight calibration |
