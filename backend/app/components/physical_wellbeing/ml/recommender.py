"""
Physical Wellbeing Recommender Engine.

Features dual recommendation engines for research evaluation:
1. Baseline Recommender (Model 1): Static rule-based filter ignoring student stress & academic workload context.
2. Adaptive AI Recommender (Model 2): Context-aware model powered by XGBoost adherence prediction, dynamically adapting to academic workload, stress levels, exam periods, and physical limitations.
"""

import pandas as pd
import numpy as np
import os
import joblib
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLEANED_DIR = r"d:\RP\J26-IT-320\backend\datasets\physical\cleaned"
MODEL_DIR = os.path.join(BASE_DIR, "models")

MODEL_PATH = os.path.join(MODEL_DIR, "adherence_xgb.joblib")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")
META_PATH = os.path.join(MODEL_DIR, "model_metadata.json")

def load_cleaned_datasets():
    workouts = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_workout_plans.csv"))
    meals = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_meal_plans.csv"))
    exercises = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_exercise_catalog.csv"))
    return workouts, meals, exercises

def get_baseline_recommendations(profile: dict, k: int = 3):
    """
    Baseline Model 1: Generic static recommender.
    Filters workouts and meals based only on raw requested time and basic dietary flag.
    Ignores academic workload, stress scores, sleep deficit, and exam period adjustments.
    """
    workouts, meals, _ = load_cleaned_datasets()
    avail_mins = profile.get("available_minutes", 45)
    diet_pref = str(profile.get("dietary_preference", "")).lower()

    # Generic Workout Filtering
    filtered_workouts = workouts[workouts["time_per_workout"] <= avail_mins].copy()
    if filtered_workouts.empty:
        filtered_workouts = workouts.copy()
    
    # Sort by total exercises or rating (static ranking)
    filtered_workouts["baseline_rank_score"] = 0.5
    top_workouts = filtered_workouts.head(k).to_dict(orient="records")

    # Generic Meal Filtering
    filtered_meals = meals.copy()
    if "vegetarian" in diet_pref:
        filtered_meals = filtered_meals[filtered_meals["vegetarian"] == 1]
    elif "vegan" in diet_pref:
        filtered_meals = filtered_meals[filtered_meals["vegan"] == 1]
    
    filtered_meals["baseline_rank_score"] = 0.5
    top_meals = filtered_meals.head(k).to_dict(orient="records")

    return {
        "model_version": "Model 1 - Generic Baseline",
        "context_aware": False,
        "recommended_workouts": top_workouts,
        "recommended_meals": top_meals
    }

def get_adaptive_recommendations(profile: dict, is_exam_period: bool = False, k: int = 3):
    """
    Adaptive Model 2 (Proposed System):
    Context-aware XGBoost ranker that dynamically:
    - Scales time down by 50% if in exam period or high stress (stress > 3.8)
    - Excludes exercises conflicting with student physical limitations
    - Ranks items based on predicted Adherence Probability P(Complete)
    """
    workouts, meals, _ = load_cleaned_datasets()

    # Extract Student Context Features
    workload = profile.get("workload_intensity_score", 50.0)
    stress = profile.get("stress_score", 3.0)
    burnout = profile.get("burnout_score", 3.0)
    sleep_def = profile.get("sleep_deficit", 0.5)
    bmi = profile.get("bmi", 22.0)
    avail_mins = profile.get("available_minutes", 45.0)
    limits = str(profile.get("physical_limitations", "")).lower()
    equip_access = str(profile.get("equipment_access", "Home / Bodyweight")).lower()
    diet_pref = str(profile.get("dietary_preference", "Non-Vegetarian")).lower()

    # Dynamic Time Adaptation for Exam Period / High Stress
    if is_exam_period or stress >= 3.8:
        effective_avail_mins = max(15.0, avail_mins * 0.50)  # 50% reduction for high academic stress
        effective_workload = min(100.0, workload + 20.0)
        effective_stress = min(5.0, stress + 1.0)
    else:
        effective_avail_mins = avail_mins
        effective_workload = workload
        effective_stress = stress

    # Load ML Model & Scaler if available
    xgb_model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None
    scaler = joblib.load(SCALER_PATH) if os.path.exists(SCALER_PATH) else None
    
    with open(META_PATH, "r") as f:
        meta = json.load(f)
    feature_cols = meta["feature_cols"]

    # --- 1. RANK WORKOUT CANDIDATES ---
    workout_list = []
    for _, row in workouts.iterrows():
        duration = row["time_per_workout"]
        title = str(row["title"]).lower()
        equip = str(row["equipment"]).lower()

        # Limitation Conflict
        limitation_conflict = 0
        if ("knee" in limits or "back" in limits) and ("squat" in title or "deadlift" in title or "high intensity" in title):
            limitation_conflict = 1

        # Equipment Match
        equip_match = 1 if (equip in equip_access or "home" in equip or "full gym" in equip_access) else 0

        # Build feature vector
        feats = {
            "student_workload_score": effective_workload,
            "student_stress_score": effective_stress,
            "student_burnout_score": burnout,
            "student_sleep_deficit": sleep_def,
            "student_bmi": bmi,
            "student_available_mins": effective_avail_mins,
            "item_duration_mins": duration,
            "item_intensity_level": 3 if "advanced" in str(row["level"]).lower() else (2 if "intermediate" in str(row["level"]).lower() else 1),
            "item_prep_time": 0.0,
            "item_protein": 0.0,
            "item_calories": 0.0,
            "is_exam_period": 1 if is_exam_period else 0,
            "limitation_conflict": limitation_conflict,
            "equipment_match": equip_match
        }

        # Predict Adherence Probability
        if xgb_model and scaler:
            X_df = pd.DataFrame([feats])[feature_cols]
            X_scaled = scaler.transform(X_df)
            prob = float(xgb_model.predict(X_scaled)[0])
        else:
            prob = 0.70

        # Ensure severe penalty if physical limitation conflict
        if limitation_conflict:
            prob *= 0.2

        w_dict = row.to_dict()
        w_dict["adherence_probability"] = round(float(prob), 4)
        w_dict["adapted_duration_mins"] = duration
        w_dict["limitation_warning"] = True if limitation_conflict else False
        workout_list.append(w_dict)

    # Sort Workouts by Adherence Score
    workout_list.sort(key=lambda x: x["adherence_probability"], reverse=True)

    # --- 2. RANK MEAL CANDIDATES ---
    meal_list = []
    for _, row in meals.iterrows():
        prep_time = row["prep_time"]
        protein = row["protein"]
        calories = row["calories"]
        
        meal_veg = row.get("vegetarian", 0)
        meal_vegan = row.get("vegan", 0)
        diet_match = 1
        if "vegetarian" in diet_pref and not (meal_veg or meal_vegan):
            diet_match = 0

        feats = {
            "student_workload_score": effective_workload,
            "student_stress_score": effective_stress,
            "student_burnout_score": burnout,
            "student_sleep_deficit": sleep_def,
            "student_bmi": bmi,
            "student_available_mins": effective_avail_mins,
            "item_duration_mins": 0.0,
            "item_intensity_level": 1,
            "item_prep_time": prep_time,
            "item_protein": protein,
            "item_calories": calories,
            "is_exam_period": 1 if is_exam_period else 0,
            "limitation_conflict": 0,
            "equipment_match": diet_match
        }

        if xgb_model and scaler:
            X_df = pd.DataFrame([feats])[feature_cols]
            X_scaled = scaler.transform(X_df)
            prob = float(xgb_model.predict(X_scaled)[0])
        else:
            prob = 0.75

        if not diet_match:
            prob *= 0.3

        m_dict = row.to_dict()
        m_dict["adherence_probability"] = round(float(prob), 4)
        meal_list.append(m_dict)

    meal_list.sort(key=lambda x: x["adherence_probability"], reverse=True)

    return {
        "model_version": "Model 2 - Context-Aware Adaptive XGBoost",
        "context_aware": True,
        "is_exam_period": is_exam_period,
        "effective_available_minutes": effective_avail_mins,
        "stress_level": round(effective_stress, 2),
        "workload_score": round(effective_workload, 2),
        "recommended_workouts": workout_list[:k],
        "recommended_meals": meal_list[:k]
    }

if __name__ == "__main__":
    test_profile = {
        "workload_intensity_score": 75.0,
        "stress_score": 4.2,
        "burnout_score": 4.0,
        "sleep_deficit": 2.5,
        "bmi": 24.5,
        "available_minutes": 60,
        "physical_limitations": "Knee pain",
        "equipment_access": "Home / Bodyweight",
        "dietary_preference": "Vegetarian"
    }

    print("=== MODEL 1: BASELINE RECOMMENDATIONS ===")
    res_base = get_baseline_recommendations(test_profile)
    print(json.dumps(res_base, indent=2))

    print("\n=== MODEL 2: ADAPTIVE XGBOOST RECOMMENDATIONS (EXAM PERIOD) ===")
    res_adap = get_adaptive_recommendations(test_profile, is_exam_period=True)
    print(json.dumps(res_adap, indent=2))

