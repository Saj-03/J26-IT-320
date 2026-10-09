"""
Data Cleaner and Feature Normalization Pipeline for Physical Wellbeing Component.
Processes 4 raw datasets:
1. Student Lifestyle & Wellbeing Survey CSV
2. Exercise Catalog CSV
3. Workout Catalog CSV
4. Healthy Meal Plans CSV
"""

import pandas as pd
import numpy as np
import os
import re

DATASET_DIR = r"d:\RP\J26-IT-320\backend\datasets\physical"
OUTPUT_DIR = r"d:\RP\J26-IT-320\backend\datasets\physical\cleaned"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def parse_numeric(val, default=0.0):
    if pd.isna(val):
        return default
    try:
        # Extract first floating point or int number from string
        match = re.search(r"[-+]?\d*\.\d+|\d+", str(val))
        if match:
            return float(match.group())
        return default
    except Exception:
        return default

def clean_student_survey():
    raw_path = os.path.join(DATASET_DIR, "Responses 1 - Form responses 1.csv")
    if not os.path.exists(raw_path):
        print(f"File not found: {raw_path}")
        return None

    df = pd.read_csv(raw_path)
    cleaned_records = []

    for idx, row in df.iterrows():
        # Parse Demographics & Physical
        age = parse_numeric(row.iloc[52], default=21.0)
        height = parse_numeric(row.iloc[53], default=165.0)
        weight = parse_numeric(row.iloc[54], default=60.0)
        
        # Calculate BMI
        bmi = weight / ((height / 100.0) ** 2) if height > 0 else 22.0
        
        # Sleep & Deficit
        sleep_hours = parse_numeric(row.iloc[49], default=7.0)
        sleep_deficit = max(0.0, 7.5 - sleep_hours)
        
        # Workload & Stress
        study_hours = parse_numeric(row.iloc[44], default=15.0)
        job_hours = parse_numeric(row.iloc[47], default=0.0)
        task_count = parse_numeric(row.iloc[50], default=5.0)

        # Calculate Workload Intensity Score (0 - 100 scale)
        # Normalized by typical max study 40h + max job 30h + max tasks 15
        workload_score = min(100.0, (study_hours * 1.5) + (job_hours * 1.2) + (task_count * 3.0))

        # Stress scale: average of PSS items (cols 39-48, 1-5 rating)
        pss_vals = []
        for c in range(39, 49):
            val = parse_numeric(row.iloc[c], default=3.0)
            pss_vals.append(val)
        stress_score = np.mean(pss_vals) if pss_vals else 3.0

        # Burnout scale (cols 69-78, 1-5 rating)
        burnout_vals = []
        for c in range(69, 79):
            val = parse_numeric(row.iloc[c], default=3.0)
            burnout_vals.append(val)
        burnout_score = np.mean(burnout_vals) if burnout_vals else 3.0

        # Workout Preferences & Limitations
        exercise_freq = parse_numeric(row.iloc[57], default=2.0)
        available_mins = parse_numeric(row.iloc[62], default=30.0)
        motivation_score = parse_numeric(row.iloc[63], default=3.0)

        wellbeing_goal = str(row.iloc[55]) if not pd.isna(row.iloc[55]) else "General Fitness"
        activity_level = str(row.iloc[56]) if not pd.isna(row.iloc[56]) else "Moderately Active"
        physical_limitations = str(row.iloc[59]) if not pd.isna(row.iloc[59]) else "None"
        if physical_limitations == "None" and not pd.isna(row.iloc[60]):
            physical_limitations = str(row.iloc[60])

        equipment_access = str(row.iloc[61]) if not pd.isna(row.iloc[61]) else "Home / Bodyweight"

        # Nutrition & Dietary Preferences
        nutrition_goal = str(row.iloc[65]) if not pd.isna(row.iloc[65]) else "Balanced Diet"
        meal_preference = str(row.iloc[66]) if not pd.isna(row.iloc[66]) else "Sri Lankan Home-cooked"
        dietary_preference = str(row.iloc[67]) if not pd.isna(row.iloc[67]) else "Non-Vegetarian"
        meal_source = str(row.iloc[68]) if not pd.isna(row.iloc[68]) else "Hostel / Canteen"

        # Construct Cleaned Student Feature Object
        student_data = {
            "student_id": f"STU_{idx+1:04d}",
            "age": age,
            "height_cm": height,
            "weight_kg": weight,
            "bmi": round(bmi, 2),
            "sleep_hours": sleep_hours,
            "sleep_deficit": round(sleep_deficit, 2),
            "study_hours_per_week": study_hours,
            "job_hours_per_week": job_hours,
            "weekly_task_count": task_count,
            "workload_intensity_score": round(workload_score, 2),
            "stress_score": round(stress_score, 2),
            "burnout_score": round(burnout_score, 2),
            "exercise_frequency_per_week": exercise_freq,
            "available_minutes_per_day": available_mins,
            "motivation_score": motivation_score,
            "wellbeing_goal": wellbeing_goal,
            "activity_level": activity_level,
            "physical_limitations": physical_limitations,
            "equipment_access": equipment_access,
            "nutrition_goal": nutrition_goal,
            "meal_preference": meal_preference,
            "dietary_preference": dietary_preference,
            "meal_source": meal_source
        }
        cleaned_records.append(student_data)

    df_cleaned = pd.DataFrame(cleaned_records)
    out_path = os.path.join(OUTPUT_DIR, "cleaned_student_profiles.csv")
    df_cleaned.to_csv(out_path, index=False)
    print(f"Cleaned Student Profiles saved to {out_path} with shape {df_cleaned.shape}")
    return df_cleaned

def clean_exercise_catalog():
    raw_path = os.path.join(DATASET_DIR, "exercise_dataset.csv")
    if not os.path.exists(raw_path):
        print(f"File not found: {raw_path}")
        return None

    df = pd.read_csv(raw_path)
    df = df.dropna(how="all")

    # Rename columns to standard lowercase
    col_map = {
        df.columns[0]: "activity_name",
        df.columns[1]: "calories_130lb",
        df.columns[2]: "calories_155lb",
        df.columns[3]: "calories_180lb",
        df.columns[4]: "calories_205lb",
        df.columns[5]: "calories_per_kg"
    }
    df = df.rename(columns=col_map)
    df["activity_name"] = df["activity_name"].astype(str).str.strip()

    # Fill numerical missing values
    df["calories_per_kg"] = df["calories_per_kg"].apply(lambda x: parse_numeric(x, default=1.0))
    df["calories_155lb"] = df["calories_155lb"].apply(lambda x: parse_numeric(x, default=300.0))

    out_path = os.path.join(OUTPUT_DIR, "cleaned_exercise_catalog.csv")
    df.to_csv(out_path, index=False)
    print(f"Cleaned Exercise Catalog saved to {out_path} with shape {df.shape}")
    return df

def clean_workout_catalog():
    raw_path = os.path.join(DATASET_DIR, "fitness_and_workout_dataset.csv")
    if not os.path.exists(raw_path):
        print(f"File not found: {raw_path}")
        return None

    df = pd.read_csv(raw_path, on_bad_lines="skip")
    
    # Required columns
    cols = ["title", "description", "level", "goal", "equipment", "program_length", "time_per_workout", "total_exercises"]
    df = df[cols].dropna(subset=["title"])

    df["title"] = df["title"].astype(str).str.strip()
    df["equipment"] = df["equipment"].fillna("Full Gym").astype(str).str.strip()
    df["level"] = df["level"].fillna("['Beginner']").astype(str)
    df["goal"] = df["goal"].fillna("['General Fitness']").astype(str)
    
    df["time_per_workout"] = df["time_per_workout"].apply(lambda x: parse_numeric(x, default=45.0))
    df["program_length"] = df["program_length"].apply(lambda x: parse_numeric(x, default=8.0))
    df["total_exercises"] = df["total_exercises"].apply(lambda x: parse_numeric(x, default=100.0))

    out_path = os.path.join(OUTPUT_DIR, "cleaned_workout_plans.csv")
    df.to_csv(out_path, index=False)
    print(f"Cleaned Workout Catalog saved to {out_path} with shape {df.shape}")
    return df

def clean_meal_plans():
    raw_path = os.path.join(DATASET_DIR, "healthy_meal_plans.csv")
    if not os.path.exists(raw_path):
        print(f"File not found: {raw_path}")
        return None

    df = pd.read_csv(raw_path)
    df = df.dropna(subset=["meal_name"])
    
    df["meal_name"] = df["meal_name"].astype(str).str.strip()
    
    # Add Sri Lankan cultural & budget meal options if not already present
    sl_meals = [
        {"meal_name": "Sri Lankan Red Rice & Dhal Curry", "num_ingredients": 0.4, "calories": 0.35, "prep_time": 0.3, "protein": 0.45, "fat": 0.2, "carbs": 0.7, "vegan": 1, "vegetarian": 1, "keto": 0, "paleo": 0, "gluten_free": 1, "mediterranean": 0, "is_healthy": 1},
        {"meal_name": "Pol Sambol & String Hoppers", "num_ingredients": 0.3, "calories": 0.30, "prep_time": 0.2, "protein": 0.30, "fat": 0.4, "carbs": 0.6, "vegan": 1, "vegetarian": 1, "keto": 0, "paleo": 0, "gluten_free": 1, "mediterranean": 0, "is_healthy": 1},
        {"meal_name": "Sri Lankan Fish Curry & Red Rice", "num_ingredients": 0.5, "calories": 0.40, "prep_time": 0.4, "protein": 0.75, "fat": 0.25, "carbs": 0.65, "vegan": 0, "vegetarian": 0, "keto": 0, "paleo": 0, "gluten_free": 1, "mediterranean": 1, "is_healthy": 1},
        {"meal_name": "Gotukola Sambol & Steamed Egg", "num_ingredients": 0.2, "calories": 0.20, "prep_time": 0.15, "protein": 0.50, "fat": 0.3, "carbs": 0.2, "vegan": 0, "vegetarian": 1, "keto": 0, "paleo": 1, "gluten_free": 1, "mediterranean": 0, "is_healthy": 1},
        {"meal_name": "Kolla Kenda (Herbal Porridge)", "num_ingredients": 0.2, "calories": 0.15, "prep_time": 0.2, "protein": 0.30, "fat": 0.1, "carbs": 0.5, "vegan": 1, "vegetarian": 1, "keto": 0, "paleo": 0, "gluten_free": 1, "mediterranean": 0, "is_healthy": 1}
    ]

    df_sl = pd.DataFrame(sl_meals)
    df_combined = pd.concat([df, df_sl], ignore_index=True)

    out_path = os.path.join(OUTPUT_DIR, "cleaned_meal_plans.csv")
    df_combined.to_csv(out_path, index=False)
    print(f"Cleaned Meal Plans saved to {out_path} with shape {df_combined.shape}")
    return df_combined

if __name__ == "__main__":
    print("Starting Phase 1: Data Cleaning Pipeline...")
    clean_student_survey()
    clean_exercise_catalog()
    clean_workout_catalog()
    clean_meal_plans()
    print("Data Cleaning Completed Successfully!")
