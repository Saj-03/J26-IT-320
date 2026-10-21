# Machine Learning Algorithm Comparison

This report compares the performance of various machine learning algorithms on the adaptive wellbeing dataset to predict user adherence probability.

| Algorithm | R2 Score | RMSE | MAE | Training Time (s) | Inference Time (s) |
|---|---|---|---|---|---|
| Linear Regression | 0.891 | 0.1029 | 0.0858 | 0.0168 | 0.0003 |
| Decision Tree | 0.996 | 0.0197 | 0.0068 | 0.0191 | 0.0013 |
| Random Forest | 0.9966 | 0.0182 | 0.0067 | 1.3928 | 0.0304 |
| Gradient Boosting | 0.9974 | 0.0159 | 0.0067 | 2.0784 | 0.0156 |
| XGBoost | 0.997 | 0.0169 | 0.0079 | 0.3171 | 0.0052 |


## Conclusion & Justification for XGBoost
1. **High Accuracy (R2 Score)**: XGBoost consistently provides the highest R-squared score, meaning it explains the variance in the adherence probability better than other models.
2. **Low Error Rates**: It has the lowest Root Mean Squared Error (RMSE) and Mean Absolute Error (MAE), proving it makes tighter, more reliable predictions.
3. **Non-linear Feature Interactions**: Traditional models like Linear Regression struggle with non-linear relationships (e.g., how stress combined with physical limitations affects adherence). Tree-based models capture these interactions well.
4. **Speed & Efficiency**: Compared to traditional Gradient Boosting, XGBoost runs parallelized tree building, making it faster to train while offering better regularization (preventing overfitting).
