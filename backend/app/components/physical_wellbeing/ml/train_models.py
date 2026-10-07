"""
ML Model Training Pipeline for Adaptive Physical Wellbeing Support System.
Trains two recommendation systems:
1. Baseline Recommender (Generic rule-based content ranker)
2. Adaptive XGBoost Adherence Model (Context-aware ranking model incorporating student academic workload, stress, sleep deficit, and physical limitations)
"""

import pandas as pd
import numpy as np
import os
import json
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

CLEANED_DIR = r"d:\RP\J26-IT-320\backend\datasets\physical\cleaned"
MODEL_DIR = r"d:\RP\J26-IT-320\backend\app\components\physical_wellbeing\ml\models"

os.makedirs(MODEL_DIR, exist_ok=True)

def encode_level(level_str):
    l = str(level_str).lower()
    if "advanced" in l:
        return 3
    elif "intermediate" in l:
        return 2
    return 1

def generate_fused_dataset(df_students, df_workouts, df_meals):
    """
    Creates a fused student-item matrix representing candidate workout and meal recommendations,
    calculating realistic ground-truth adherence probability based on student context.
    """
    records = []
    
    np.random.seed(42)

    # Sample subsets to create robust training samples (~10,000 interactions)
    for s_idx, student in df_students.iterrows():
        # Sample 15 workout options per student
        sample_workouts = df_workouts.sample(n=min(15, len(df_workouts)), random_state=s_idx % 100)
        # Sample 15 meal options per student
        sample_meals = df_meals.sample(n=min(15, len(df_meals)), random_state=s_idx % 100)

        # Generate both normal and exam period scenarios
        for is_exam in [0, 1]:
            # Adjust effective stress/workload for exam period
            effective_workload = min(100.0, student["workload_intensity_score"] + (25.0 if is_exam else 0.0))
            effective_stress = min(5.0, student["stress_score"] + (1.2 if is_exam else 0.0))
            
            # 1. Workout Interactions
            for _, workout in sample_workouts.iterrows():
                duration = workout["time_per_workout"]
                level = encode_level(workout["level"])
                equip = str(workout["equipment"]).lower()
                stud_equip = str(student["equipment_access"]).lower()

                # Equipment match binary
                equip_match = 1 if (equip in stud_equip or "home" in equip or "full gym" in stud_equip) else 0

                # Physical Limitation conflict check
                stud_limits = str(student["physical_limitations"]).lower()
                title = str(workout["title"]).lower()
                limitation_conflict = 0
                if ("knee" in stud_limits or "back" in stud_limits) and ("squat" in title or "deadlift" in title or "high intensity" in title):
                    limitation_conflict = 1

                # Calculate Ground-Truth Adherence Probability P(Adherence)
                adherence = 0.85

                # Duration Penalty under high stress/exams
                if is_exam or effective_stress > 3.8:
                    if duration > 30:
                        adherence -= 0.35 * (duration / 60.0)
                    else:
                        adherence += 0.10  # Quick workouts preferred during exams!
                else:
                    if duration > student["available_minutes_per_day"] + 15:
                        adherence -= 0.25

                # Workload & Burnout impact
                if effective_workload > 75:
                    if level > 1:
                        adherence -= 0.20

                # Limitation penalty
                if limitation_conflict:
                    adherence -= 0.50

                # Equipment mismatch penalty
                if not equip_match:
                    adherence -= 0.30

                # Motivation boost/penalty
                adherence += (student["motivation_score"] - 3) * 0.05
                adherence = float(np.clip(adherence, 0.05, 0.98))

                records.append({
                    "item_type": "workout",
                    "student_workload_score": effective_workload,
                    "student_stress_score": effective_stress,
                    "student_burnout_score": student["burnout_score"],
                    "student_sleep_deficit": student["sleep_deficit"],
                    "student_bmi": student["bmi"],
                    "student_available_mins": student["available_minutes_per_day"],
                    "item_duration_mins": duration,
                    "item_intensity_level": level,
                    "item_prep_time": 0.0,
                    "item_protein": 0.0,
                    "item_calories": 0.0,
                    "is_exam_period": is_exam,
                    "limitation_conflict": limitation_conflict,
                    "equipment_match": equip_match,
                    "adherence_probability": round(adherence, 4)
                })

            # 2. Meal Interactions
            for _, meal in sample_meals.iterrows():
                prep_time = meal["prep_time"]
                protein = meal["protein"]
                calories = meal["calories"]

                # Dietary preference match
                stud_diet = str(student["dietary_preference"]).lower()
                meal_veg = meal.get("vegetarian", 0)
                meal_vegan = meal.get("vegan", 0)

                diet_match = 1
                if "vegetarian" in stud_diet and not (meal_veg or meal_vegan):
                    diet_match = 0

                # Meal Adherence Calculation
                meal_adherence = 0.88

                # Under high stress/exams, quick prep meals are strongly preferred
                if is_exam or effective_stress > 3.8:
                    if prep_time > 0.4:
                        meal_adherence -= 0.30
                    else:
                        meal_adherence += 0.08
                
                if not diet_match:
                    meal_adherence -= 0.55

                meal_adherence = float(np.clip(meal_adherence, 0.05, 0.98))

                records.append({
                    "item_type": "meal",
                    "student_workload_score": effective_workload,
                    "student_stress_score": effective_stress,
                    "student_burnout_score": student["burnout_score"],
                    "student_sleep_deficit": student["sleep_deficit"],
                    "student_bmi": student["bmi"],
                    "student_available_mins": student["available_minutes_per_day"],
                    "item_duration_mins": 0.0,
                    "item_intensity_level": 1,
                    "item_prep_time": prep_time,
                    "item_protein": protein,
                    "item_calories": calories,
                    "is_exam_period": is_exam,
                    "limitation_conflict": 0,
                    "equipment_match": diet_match,
                    "adherence_probability": round(meal_adherence, 4)
                })

    return pd.DataFrame(records)

def train_and_evaluate():
    print("Loading cleaned datasets...")
    df_students = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_student_profiles.csv"))
    df_workouts = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_workout_plans.csv"))
    df_meals = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_meal_plans.csv"))

    print("Generating fused interaction matrix for ML model...")
    df_fused = generate_fused_dataset(df_students, df_workouts, df_meals)
    print(f"Fused Interaction Matrix Shape: {df_fused.shape}")

    feature_cols = [
        "student_workload_score",
        "student_stress_score",
        "student_burnout_score",
        "student_sleep_deficit",
        "student_bmi",
        "student_available_mins",
        "item_duration_mins",
        "item_intensity_level",
        "item_prep_time",
        "item_protein",
        "item_calories",
        "is_exam_period",
        "limitation_conflict",
        "equipment_match"
    ]

    X = df_fused[feature_cols]
    y = df_fused["adherence_probability"]

    # Train/Test Split (80% Train, 20% Test)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Standard Scaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train Adaptive XGBoost Regressor
    print("Training Adaptive XGBoost Regressor...")
    xgb_model = XGBRegressor(
        n_estimators=150,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42
    )
    xgb_model.fit(X_train_scaled, y_train)

    # Predict & Evaluate
    y_pred = xgb_model.predict(X_test_scaled)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print("\n================ ML MODEL EVALUATION RESULTS ================")
    print(f"Model: Adaptive XGBoost Adherence Ranker")
    print(f"Root Mean Squared Error (RMSE): {rmse:.4f}")
    print(f"Mean Absolute Error (MAE):     {mae:.4f}")
    print(f"R-squared (R2) Score:         {r2:.4f}")
    print("=============================================================\n")

    # Save Model Artifacts
    model_path = os.path.join(MODEL_DIR, "adherence_xgb.joblib")
    scaler_path = os.path.join(MODEL_DIR, "scaler.joblib")
    meta_path = os.path.join(MODEL_DIR, "model_metadata.json")

    joblib.dump(xgb_model, model_path)
    joblib.dump(scaler, scaler_path)

    metadata = {
        "model_type": "XGBRegressor",
        "feature_cols": feature_cols,
        "metrics": {
            "rmse": round(float(rmse), 4),
            "mae": round(float(mae), 4),
            "r2_score": round(float(r2), 4)
        },
        "training_samples": len(X_train),
        "test_samples": len(X_test)
    }

    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=4)

    print(f"Saved XGBoost model to {model_path}")
    print(f"Saved Scaler to {scaler_path}")
    print(f"Saved Metadata to {meta_path}")

if __name__ == "__main__":
    train_and_evaluate()
