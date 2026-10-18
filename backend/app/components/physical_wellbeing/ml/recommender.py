"""
Physical Wellbeing Recommender Engine.

Features dual recommendation engines for research evaluation:
1. Baseline Recommender (Model 1): Static rule-based filter ignoring student stress & academic workload context.
2. Adaptive AI Recommender (Model 2): Context-aware model powered by XGBoost adherence prediction, dynamically adapting to:
   - Academic workload & stress levels
   - Exam periods (auto-scaling time down by 50%)
   - Student available workout minutes (strictly enforcing time constraints)
   - Student physical limitations (knee, back safety filtering)
   - Student diet preferences (Vegetarian, Vegan, Non-Vegetarian)
   - Student cuisine preferences (Authentic Sri Lankan foods, Western/International, or Both)
   - Allergies and avoided foods
   - Generates comprehensive 7-day date-wise plans with Breakfast, Lunch, Dinner, Snack options & daily workouts.
"""

import os
import re
import json
import datetime
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLEANED_DIR = r"d:\RP\J26-IT-320\backend\datasets\physical\cleaned"
DATASETS_DIR = r"d:\RP\J26-IT-320\backend\datasets\physical"
MODEL_DIR = os.path.join(BASE_DIR, "models")

MODEL_PATH = os.path.join(MODEL_DIR, "adherence_xgb.joblib")
SCALER_PATH = os.path.join(MODEL_DIR, "scaler.joblib")
META_PATH = os.path.join(MODEL_DIR, "model_metadata.json")

# ── Load datasets & model once at module import time ─────────────────────────
_workouts = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_workout_plans.csv"))
_meals = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_meal_plans.csv"))
_exercises = pd.read_csv(os.path.join(CLEANED_DIR, "cleaned_exercise_catalog.csv"))

_sl_foods_csv = os.path.join(CLEANED_DIR, "cleaned_srilankan_foods.csv")
_sl_foods = pd.read_csv(_sl_foods_csv) if os.path.exists(_sl_foods_csv) else pd.DataFrame()

_xgb_model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else None
_scaler = joblib.load(SCALER_PATH) if os.path.exists(SCALER_PATH) else None

if os.path.exists(META_PATH):
    with open(META_PATH, "r") as _f:
        _meta = json.load(_f)
    _feature_cols = _meta.get("feature_cols", [])
else:
    _feature_cols = [
        "student_workload_score", "student_stress_score", "student_burnout_score",
        "student_sleep_deficit", "student_bmi", "student_available_mins",
        "item_duration_mins", "item_intensity_level", "item_prep_time",
        "item_protein", "item_calories", "is_exam_period",
        "limitation_conflict", "equipment_match"
    ]

def load_cleaned_datasets():
    return _workouts, _meals, _exercises, _sl_foods


# ── Curated Meal Knowledge Base (Sri Lankan & International) ─────────────────
# Combines items from SrilankanCommonFoods.xlsx and cleaned_meal_plans.csv into slot-based healthy options.
CURATED_MEALS = [
    # ── SRI LANKAN BREAKFASTS ──
    {
        "id": "sl_bf_1", "name": "Kiribath with Lunu Miris & Kiri Hodi",
        "slot": "breakfast", "cuisine": "sri_lankan", "diet_category": "veg",
        "calories": 340.0, "protein": 6.5, "carbs": 68.0, "fat": 6.0, "prep_time": 20.0,
        "description": "Traditional Sri Lankan milk rice served with zesty onion sambal and light coconut gravy.",
        "tags": ["kiribath", "rice", "traditional", "gluten-free"]
    },
    {
        "id": "sl_bf_2", "name": "String Hoppers (Idiyappam) with Dhal Curry & Pol Sambol",
        "slot": "breakfast", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 310.0, "protein": 8.5, "carbs": 54.0, "fat": 7.0, "prep_time": 15.0,
        "description": "Steamed red or white rice vermicelli with protein-rich red lentil curry and fresh coconut sambal.",
        "tags": ["idiyappam", "dhal", "pol sambol", "vegan"]
    },
    {
        "id": "sl_bf_3", "name": "Coconut Roti with Pol Sambol & Dhal",
        "slot": "breakfast", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 370.0, "protein": 8.0, "carbs": 60.0, "fat": 10.5, "prep_time": 15.0,
        "description": "Toasted wholemeal coconut flatbread paired with warm dhal and crushed chili sambal.",
        "tags": ["roti", "coconut", "dhal"]
    },
    {
        "id": "sl_bf_4", "name": "Boiled Kadala (Chickpeas) with Grated Coconut & Green Chili",
        "slot": "breakfast", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 260.0, "protein": 13.0, "carbs": 42.0, "fat": 5.0, "prep_time": 10.0,
        "description": "High-fiber boiled chickpeas tempered with mustard seeds, curry leaves, and fresh coconut.",
        "tags": ["kadala", "chickpeas", "high-protein", "vegan"]
    },
    {
        "id": "sl_bf_5", "name": "Boiled Mung Beans with Fresh Coconut & Lunu Miris",
        "slot": "breakfast", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 250.0, "protein": 14.2, "carbs": 40.0, "fat": 4.0, "prep_time": 10.0,
        "description": "Slow-digesting whole green gram packed with plant protein and micronutrients.",
        "tags": ["mung", "green gram", "high-protein"]
    },
    {
        "id": "sl_bf_6", "name": "Egg Hopper with Plain Hoppers & Seeni Sambol",
        "slot": "breakfast", "cuisine": "sri_lankan", "diet_category": "non-veg",
        "calories": 320.0, "protein": 12.0, "carbs": 45.0, "fat": 10.0, "prep_time": 15.0,
        "description": "Crisp bowl-shaped fermented rice pancake topped with a soft-steamed egg and caramelized onion sambal.",
        "tags": ["hoppers", "egg", "traditional"]
    },
    {
        "id": "sl_bf_7", "name": "Roast Paan with Dhal Curry & Fried Egg",
        "slot": "breakfast", "cuisine": "sri_lankan", "diet_category": "non-veg",
        "calories": 360.0, "protein": 15.5, "carbs": 52.0, "fat": 9.5, "prep_time": 10.0,
        "description": "Crispy traditional Sri Lankan roast bread slices dipped in yellow lentil curry with a sunny-side egg.",
        "tags": ["roast paan", "egg", "dhal"]
    },
    {
        "id": "sl_bf_8", "name": "Boiled Cowpea with Coconut & Lunu Miris",
        "slot": "breakfast", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 270.0, "protein": 13.5, "carbs": 44.0, "fat": 4.5, "prep_time": 10.0,
        "description": "Wholesome boiled cowpea legumes offering clean, steady morning energy for academic study.",
        "tags": ["cowpea", "beans", "vegan"]
    },

    # ── SRI LANKAN LUNCHES ──
    {
        "id": "sl_lu_1", "name": "Red Rice with Dhal Curry, Kola Mallum & Chicken Curry",
        "slot": "lunch", "cuisine": "sri_lankan", "diet_category": "non-veg",
        "calories": 490.0, "protein": 33.0, "carbs": 64.0, "fat": 11.0, "prep_time": 25.0,
        "description": "Nutrient-dense red unpolished rice with Ceylon spiced chicken curry, tempered dhal, and gotukola mallum.",
        "tags": ["red rice", "chicken", "dhal", "mallum"]
    },
    {
        "id": "sl_lu_2", "name": "Red Rice with Dhal Curry, Kola Mallum & Soya Meat Curry",
        "slot": "lunch", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 420.0, "protein": 24.0, "carbs": 68.0, "fat": 7.5, "prep_time": 20.0,
        "description": "Hearty vegan Sri Lankan rice and curry featuring rich textured soya protein, yellow dhal, and fresh greens.",
        "tags": ["red rice", "soya meat", "dhal", "vegan"]
    },
    {
        "id": "sl_lu_3", "name": "Brown Rice with Fish Ambul Thiyal, Dhal & Kankun Stir-Fry",
        "slot": "lunch", "cuisine": "sri_lankan", "diet_category": "non-veg",
        "calories": 460.0, "protein": 32.0, "carbs": 62.0, "fat": 9.0, "prep_time": 25.0,
        "description": "Omega-3 rich sour fish curry prepared with goraka and black pepper, served with brown rice and water spinach.",
        "tags": ["fish", "ambul thiyal", "brown rice", "kankun"]
    },
    {
        "id": "sl_lu_4", "name": "Red Rice with Beetroot Curry, Dhal, Fried Halmesso & Cucumber Salad",
        "slot": "lunch", "cuisine": "sri_lankan", "diet_category": "non-veg",
        "calories": 450.0, "protein": 26.0, "carbs": 65.0, "fat": 9.5, "prep_time": 20.0,
        "description": "Crisp dried sprats (halmesso) for calcium and iodine, balanced with iron-rich beetroot and yellow dhal.",
        "tags": ["halmesso", "sprats", "beetroot", "calcium"]
    },
    {
        "id": "sl_lu_5", "name": "Red Rice with Polos Curry, Dhal & Gotukola Sambol",
        "slot": "lunch", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 395.0, "protein": 15.0, "carbs": 66.0, "fat": 8.0, "prep_time": 25.0,
        "description": "Tender young green jackfruit curry simmered in fragrant roasted spices with dhal and brain-boosting gotukola.",
        "tags": ["polos", "jackfruit", "vegan", "gotukola"]
    },
    {
        "id": "sl_lu_6", "name": "Steamed White Rice with Dhal, Boiled Egg Curry & Snake Gourd",
        "slot": "lunch", "cuisine": "sri_lankan", "diet_category": "veg",
        "calories": 430.0, "protein": 18.0, "carbs": 65.0, "fat": 10.0, "prep_time": 15.0,
        "description": "Quick student lunch featuring hard-boiled egg in light coconut gravy, yellow lentils, and snake gourd.",
        "tags": ["egg curry", "rice", "dhal", "vegetarian"]
    },

    # ── SRI LANKAN DINNERS ──
    {
        "id": "sl_dn_1", "name": "String Hoppers with Soya Meat Curry & Kiri Hodi",
        "slot": "dinner", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 320.0, "protein": 16.0, "carbs": 52.0, "fat": 6.0, "prep_time": 15.0,
        "description": "Light, easily digestible rice noodle nests with high-protein soya chunks and aromatic turmeric coconut soup.",
        "tags": ["idiyappam", "soya meat", "kiri hodi", "light dinner"]
    },
    {
        "id": "sl_dn_2", "name": "Roast Paan with Dhal Curry & Pol Sambol",
        "slot": "dinner", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 330.0, "protein": 11.0, "carbs": 56.0, "fat": 7.0, "prep_time": 10.0,
        "description": "Warm, crunchy roast bread with wholesome lentil curry. Ideal light evening comfort food after studying.",
        "tags": ["roast paan", "dhal", "pol sambol"]
    },
    {
        "id": "sl_dn_3", "name": "Fresh Sri Lankan Vegetable Soup with Whole Wheat Toast",
        "slot": "dinner", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 270.0, "protein": 9.0, "carbs": 48.0, "fat": 4.0, "prep_time": 15.0,
        "description": "Hydrating broth of local pumpkin, carrots, leeks, and coriander seeds served with crispy toasted bread.",
        "tags": ["vegetable soup", "soup", "hydration", "light"]
    },
    {
        "id": "sl_dn_4", "name": "Idiyappam with Fish Curry & Fresh Coconut Gravy",
        "slot": "dinner", "cuisine": "sri_lankan", "diet_category": "non-veg",
        "calories": 350.0, "protein": 26.0, "carbs": 48.0, "fat": 7.5, "prep_time": 20.0,
        "description": "Steamed string hoppers paired with tender white fish steak cooked in mild Ceylon spices.",
        "tags": ["idiyappam", "fish curry", "lean protein"]
    },
    {
        "id": "sl_dn_5", "name": "Stir-Fried Rice Noodles with Mixed Vegetables & Scrambled Egg",
        "slot": "dinner", "cuisine": "sri_lankan", "diet_category": "veg",
        "calories": 360.0, "protein": 16.0, "carbs": 54.0, "fat": 8.5, "prep_time": 15.0,
        "description": "Quick wok-tossed thin rice noodles with shredded cabbage, carrots, bell peppers, and free-range egg.",
        "tags": ["noodles", "egg", "stir-fry"]
    },
    {
        "id": "sl_dn_6", "name": "Thati Paan with Dhal Curry & Grilled Chicken Strips",
        "slot": "dinner", "cuisine": "sri_lankan", "diet_category": "non-veg",
        "calories": 390.0, "protein": 28.0, "carbs": 50.0, "fat": 8.0, "prep_time": 15.0,
        "description": "Toasted flat bread with seasoned chicken breast strips and comforting yellow lentil curry.",
        "tags": ["thati paan", "chicken", "dhal"]
    },

    # ── SRI LANKAN SNACKS ──
    {
        "id": "sl_sn_1", "name": "Fresh King Coconut (Kurumba) Water & Soft Pulp",
        "slot": "snack", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 85.0, "protein": 1.2, "carbs": 18.0, "fat": 1.0, "prep_time": 2.0,
        "description": "Natural electrolyte elixir packed with potassium and minerals to alleviate mental fatigue and stress.",
        "tags": ["kurumba", "king coconut", "electrolytes", "hydration"]
    },
    {
        "id": "sl_sn_2", "name": "Samaposha Aggala (2 Nutrient Seed Balls)",
        "slot": "snack", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 175.0, "protein": 6.5, "carbs": 30.0, "fat": 3.2, "prep_time": 5.0,
        "description": "Nutritious roasted multi-grain and pulse balls (corn, soya, green gram, and rice) sweetened with jaggery.",
        "tags": ["samaposha", "multigrain", "healthy energy"]
    },
    {
        "id": "sl_sn_3", "name": "Roasted Spiced Gram (Kadala) & Peanuts",
        "slot": "snack", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 160.0, "protein": 8.0, "carbs": 19.0, "fat": 6.0, "prep_time": 2.0,
        "description": "Crunchy dry-roasted chickpeas and peanuts tossed with crushed chili and curry leaves for sustained focus.",
        "tags": ["kadala", "peanuts", "protein snack"]
    },
    {
        "id": "sl_sn_4", "name": "Fresh Ambul Kesel (2 Small Bananas) with Warm Green Tea",
        "slot": "snack", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 130.0, "protein": 1.8, "carbs": 32.0, "fat": 0.4, "prep_time": 2.0,
        "description": "Potassium-rich local sour bananas offering instant cognitive focus during revision sessions.",
        "tags": ["banana", "kesel", "potassium", "quick"]
    },
    {
        "id": "sl_sn_5", "name": "Kotmale Low-Fat Yogurt with Fresh Papaya Chunks",
        "slot": "snack", "cuisine": "sri_lankan", "diet_category": "veg",
        "calories": 140.0, "protein": 6.5, "carbs": 24.0, "fat": 2.0, "prep_time": 3.0,
        "description": "Gut-healthy probiotic yogurt topped with fresh tropical papaya for immune defense.",
        "tags": ["yogurt", "papaya", "probiotics"]
    },
    {
        "id": "sl_sn_6", "name": "Fresh Guava Slices with Ceylon Black Pepper & Salt",
        "slot": "snack", "cuisine": "sri_lankan", "diet_category": "vegan",
        "calories": 75.0, "protein": 2.6, "carbs": 15.0, "fat": 1.0, "prep_time": 3.0,
        "description": "High vitamin C local pink or white guava slices to strengthen student immunity against burnout.",
        "tags": ["guava", "vitamin c", "immunity"]
    },

    # ── WESTERN / INTERNATIONAL MEALS (FROM CLEANED_MEAL_PLANS.CSV) ──
    {
        "id": "int_bf_1", "name": "Rolled Oats Bowl with Banana, Chia Seeds & Cinnamon",
        "slot": "breakfast", "cuisine": "western", "diet_category": "vegan",
        "calories": 310.0, "protein": 9.0, "carbs": 56.0, "fat": 5.5, "prep_time": 10.0,
        "description": "Slow-release complex carbs with beta-glucan soluble fiber for long study blocks.",
        "tags": ["oats", "banana", "chia", "vegan"]
    },
    {
        "id": "int_bf_2", "name": "Whole Grain Avocado Toast with Poached Egg",
        "slot": "breakfast", "cuisine": "western", "diet_category": "non-veg",
        "calories": 340.0, "protein": 14.0, "carbs": 32.0, "fat": 18.0, "prep_time": 10.0,
        "description": "Heart-healthy monounsaturated fats and choline-rich egg for brain cell preservation.",
        "tags": ["avocado", "toast", "egg"]
    },
    {
        "id": "int_bf_3", "name": "Greek Yogurt Bowl with Mixed Berries & Walnuts",
        "slot": "breakfast", "cuisine": "western", "diet_category": "veg",
        "calories": 280.0, "protein": 18.0, "carbs": 28.0, "fat": 10.0, "prep_time": 5.0,
        "description": "Protein-dense strained yogurt paired with antioxidant berries and brain-boosting walnuts.",
        "tags": ["greek yogurt", "berries", "walnuts", "high-protein"]
    },
    {
        "id": "int_lu_1", "name": "Grilled Lemon Herb Salmon with Quinoa & Steamed Broccoli",
        "slot": "lunch", "cuisine": "western", "diet_category": "non-veg",
        "calories": 480.0, "protein": 36.0, "carbs": 42.0, "fat": 16.0, "prep_time": 20.0,
        "description": "Anti-inflammatory wild salmon paired with complete protein quinoa and vitamin K greens.",
        "tags": ["salmon", "quinoa", "omega-3", "clean"]
    },
    {
        "id": "int_lu_2", "name": "Chickpea Stew with Spinach, Tomatoes & Brown Rice",
        "slot": "lunch", "cuisine": "western", "diet_category": "vegan",
        "calories": 410.0, "protein": 17.0, "carbs": 68.0, "fat": 7.0, "prep_time": 20.0,
        "description": "Mediterranean-inspired garbanzo bean stew loaded with lycopene, iron, and fiber.",
        "tags": ["chickpea", "stew", "vegan", "mediterranean"]
    },
    {
        "id": "int_lu_3", "name": "Turkey Lettuce Wraps with Avocado & Quinoa",
        "slot": "lunch", "cuisine": "western", "diet_category": "non-veg",
        "calories": 390.0, "protein": 34.0, "carbs": 28.0, "fat": 14.0, "prep_time": 15.0,
        "description": "Lean ground turkey sautéed with garlic and herbs, wrapped in crisp romaine lettuce cups.",
        "tags": ["turkey", "low-carb", "high-protein"]
    },
    {
        "id": "int_lu_4", "name": "Mediterranean Lentil Salad with Feta, Cucumbers & Olive Oil",
        "slot": "lunch", "cuisine": "western", "diet_category": "veg",
        "calories": 420.0, "protein": 20.0, "carbs": 50.0, "fat": 14.0, "prep_time": 15.0,
        "description": "Tender brown lentils tossed with diced cucumber, kalamata olives, cherry tomatoes, and crumbly feta.",
        "tags": ["lentils", "salad", "feta", "mediterranean"]
    },
    {
        "id": "int_dn_1", "name": "Grilled Chicken Breast with Roasted Sweet Potato & Asparagus",
        "slot": "dinner", "cuisine": "western", "diet_category": "non-veg",
        "calories": 420.0, "protein": 38.0, "carbs": 40.0, "fat": 9.0, "prep_time": 20.0,
        "description": "Clean lean poultry protein with complex carbs to replenish glycogen after long study days.",
        "tags": ["chicken", "sweet potato", "lean dinner"]
    },
    {
        "id": "int_dn_2", "name": "Gluten-Free Pasta with Lentil Bolognese & Zucchini",
        "slot": "dinner", "cuisine": "western", "diet_category": "vegan",
        "calories": 380.0, "protein": 18.0, "carbs": 64.0, "fat": 5.5, "prep_time": 20.0,
        "description": "Comforting Italian-style marinara simmered with red lentils over corn/rice pasta.",
        "tags": ["pasta", "lentil bolognese", "vegan", "gluten-free"]
    },
    {
        "id": "int_dn_3", "name": "Baked Cod Fillet with Garlic Herb Quinoa & Green Beans",
        "slot": "dinner", "cuisine": "western", "diet_category": "non-veg",
        "calories": 360.0, "protein": 32.0, "carbs": 38.0, "fat": 6.5, "prep_time": 18.0,
        "description": "Light, tender white fish rich in B vitamins and lean protein for restful sleep.",
        "tags": ["cod", "quinoa", "clean eating"]
    },
    {
        "id": "int_dn_4", "name": "Tofu Vegetable Stir-Fry with Tamari & Sesame Seeds",
        "slot": "dinner", "cuisine": "western", "diet_category": "vegan",
        "calories": 340.0, "protein": 22.0, "carbs": 32.0, "fat": 14.0, "prep_time": 15.0,
        "description": "Golden pan-seared firm tofu cubes with broccoli, snap peas, and sesame drizzle.",
        "tags": ["tofu", "stir-fry", "vegan"]
    },
    {
        "id": "int_sn_1", "name": "Crisp Apple Slices with Pure Natural Peanut Butter",
        "slot": "snack", "cuisine": "western", "diet_category": "vegan",
        "calories": 180.0, "protein": 5.0, "carbs": 24.0, "fat": 8.0, "prep_time": 2.0,
        "description": "Crisp orchard fruit paired with plant fats and protein to curb afternoon hunger.",
        "tags": ["apple", "peanut butter", "clean snack"]
    },
    {
        "id": "int_sn_2", "name": "Raw Walnut & Almond Snack Pack (30g)",
        "slot": "snack", "cuisine": "western", "diet_category": "vegan",
        "calories": 190.0, "protein": 5.5, "carbs": 6.0, "fat": 17.0, "prep_time": 1.0,
        "description": "Essential alpha-linolenic omega-3 fats and vitamin E for sustained neuronal health.",
        "tags": ["walnuts", "almonds", "brain food"]
    },
    {
        "id": "int_sn_3", "name": "Hummus Dip with Crunchy Carrot & Cucumber Sticks",
        "slot": "snack", "cuisine": "western", "diet_category": "vegan",
        "calories": 135.0, "protein": 4.5, "carbs": 16.0, "fat": 6.0, "prep_time": 3.0,
        "description": "Savory tahini-chickpea dip with crunchy vegetables for low-glycemic satiety.",
        "tags": ["hummus", "veggies", "vegan", "low-calorie"]
    }
]


# ── Curated Exercise Catalog (Time & Goal Tailored) ──────────────────────────
# Structured routines strictly calibrated to student available minutes (15, 20, 30, 45, 60 mins).
CURATED_EXERCISES = [
    # ── 15-MINUTE ROUTINES (For time-crunched students & high stress periods) ──
    {
        "id": "ex_15_walk",
        "name": "15-Min Campus Brisk Walking & Sunlight Boost",
        "duration_mins": 15,
        "intensity": "Light",
        "intensity_level": 1,
        "equipment": "Outdoor / Walking",
        "primary_goal": "fitness",
        "target_goals": ["fitness", "weight_loss", "stress_relief"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 4.0,
        "description": "Brisk paced outdoor campus walk to stimulate blood flow, reset mental fatigue, and get natural sunlight."
    },
    {
        "id": "ex_15_dance",
        "name": "15-Min High-Energy Student Dance Cardio",
        "duration_mins": 15,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Bodyweight / Home",
        "primary_goal": "weight_loss",
        "target_goals": ["weight_loss", "fitness", "stress_relief"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 6.5,
        "description": "Upbeat rhythm cardio combining simple salsa steps, side shuffles, arm reaches, and hip sways. Fun and stress-busting."
    },
    {
        "id": "ex_15_jog",
        "name": "15-Min Campus Jog-Walk Interval Cardio",
        "duration_mins": 15,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Outdoor / Running",
        "primary_goal": "weight_loss",
        "target_goals": ["weight_loss", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 7.0,
        "description": "Alternating 1-min light jog with 1-min brisk recovery walk across university grounds."
    },
    {
        "id": "ex_15_1",
        "name": "15-Min Quick Dorm HIIT & Cardio Burn",
        "duration_mins": 15,
        "intensity": "High",
        "intensity_level": 3,
        "equipment": "Bodyweight / Home",
        "primary_goal": "weight_loss",
        "target_goals": ["weight_loss", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 8.0,
        "description": "High-efficiency intervals: 40s jumping jacks, mountain climbers, high knees, shadow boxing, 20s rest. Rapid calorie burn."
    },
    {
        "id": "ex_15_2",
        "name": "15-Min Study Desk Posture & Spine Decompression",
        "duration_mins": 15,
        "intensity": "Light",
        "intensity_level": 1,
        "equipment": "Bodyweight / Home",
        "primary_goal": "mobility",
        "target_goals": ["mobility", "stress_relief", "fitness"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 3.0,
        "description": "Restorative sequence: thoracic spine twists, cat-cow flow, doorway chest openers, neck releases to reverse study fatigue."
    },
    {
        "id": "ex_15_3",
        "name": "15-Min Low-Impact Knee-Safe Core & Tone",
        "duration_mins": 15,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Bodyweight / Home",
        "primary_goal": "fitness",
        "target_goals": ["fitness", "strength", "weight_loss"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 4.5,
        "description": "Zero jumping or deep knee flexion: glute bridges, bird-dogs, dead bugs, forearm planks, and seated Russian twists."
    },

    # ── 20-MINUTE ROUTINES ──
    {
        "id": "ex_20_walk",
        "name": "20-Min Campus Power Walk & Interval Pace",
        "duration_mins": 20,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Outdoor / Walking",
        "primary_goal": "weight_loss",
        "target_goals": ["walking", "weight_loss", "fitness", "stress_relief"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 5.0,
        "description": "Energetic outdoor campus power walk alternating 3-min brisk strides with 1-min fast arm-swing cadence. Low impact."
    },
    {
        "id": "ex_20_zumba",
        "name": "20-Min Rhythm Zumba & Aerobic Beat Session",
        "duration_mins": 20,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Bodyweight / Home",
        "primary_goal": "weight_loss",
        "target_goals": ["dance", "zumba", "weight_loss", "fitness"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 7.0,
        "description": "Dance-based calorie torcher: merengue steps, cumbia shuffles, low-impact side reaches, and high-energy hip rolls."
    },
    {
        "id": "ex_20_jog",
        "name": "20-Min Outdoor Campus Jog & Stride Intervals",
        "duration_mins": 20,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Outdoor / Running",
        "primary_goal": "weight_loss",
        "target_goals": ["running", "jogging", "weight_loss", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 8.0,
        "description": "Graduated aerobic jogging session around student grounds: 3-min light jog, 1-min recovery walk, repeat."
    },
    {
        "id": "ex_20_bands",
        "name": "20-Min Resistance Band Posture & Full-Body Tone",
        "duration_mins": 20,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Resistance Bands",
        "primary_goal": "strength",
        "target_goals": ["strength", "fitness", "mobility"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 5.0,
        "description": "Band pull-aparts, lateral band walks, standing bicep curls, and glute kickbacks with minimal joint strain."
    },
    {
        "id": "ex_20_1",
        "name": "20-Min Full-Body Functional Calisthenics",
        "duration_mins": 20,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Bodyweight / Home",
        "primary_goal": "fitness",
        "target_goals": ["fitness", "strength", "weight_loss"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 5.5,
        "description": "Balanced circuit: push-ups (or incline/knee), bodyweight Romanian deadlifts, wall sits, plank taps, and march-in-place."
    },
    {
        "id": "ex_20_2",
        "name": "20-Min Fat Burn Aerobic Cardio Flow",
        "duration_mins": 20,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Bodyweight / Home",
        "primary_goal": "weight_loss",
        "target_goals": ["weight_loss", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 6.8,
        "description": "Continuous aerobic movement: skater jumps, butt kicks, step jacks, standing oblique crunches, and arm pulses."
    },
    {
        "id": "ex_20_3",
        "name": "20-Min Vinyasa Yoga Flow for Mental Clarity",
        "duration_mins": 20,
        "intensity": "Light",
        "intensity_level": 1,
        "equipment": "Bodyweight / Home",
        "primary_goal": "mobility",
        "target_goals": ["mobility", "stress_relief", "fitness", "yoga"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 3.5,
        "description": "Sun salutations, warrior poses, gentle hip openers, and deep belly breathing to reset stress cortisol levels."
    },
    {
        "id": "ex_20_4",
        "name": "20-Min Upper Body & Core Dumbbell Sculpt",
        "duration_mins": 20,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Dumbbells / Basic Gym",
        "primary_goal": "strength",
        "target_goals": ["strength", "fitness"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 5.2,
        "description": "Dumbbell shoulder presses, bicep curls, overhead tricep extensions, and plank dumbbell drags."
    },

    # ── 30-MINUTE ROUTINES ──
    {
        "id": "ex_30_1",
        "name": "30-Min Total Body Conditioning Circuit",
        "duration_mins": 30,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Bodyweight / Home",
        "primary_goal": "fitness",
        "target_goals": ["fitness", "strength", "weight_loss"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 6.0,
        "description": "3 rounds of 10 exercises: push-ups, glute bridges, step-backs, plank shoulder taps, arm circles, and side planks."
    },
    {
        "id": "ex_30_2",
        "name": "30-Min HIIT Cardio & Core Blast",
        "duration_mins": 30,
        "intensity": "High",
        "intensity_level": 3,
        "equipment": "Bodyweight / Home",
        "primary_goal": "weight_loss",
        "target_goals": ["weight_loss", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 8.5,
        "description": "Tabata-style intervals: burpees, high knees, squat thrusts, bicycle crunches, and mountain climbers."
    },
    {
        "id": "ex_30_3",
        "name": "30-Min Joint Mobility, Hip Opening & Spine Health",
        "duration_mins": 30,
        "intensity": "Light",
        "intensity_level": 1,
        "equipment": "Bodyweight / Home",
        "primary_goal": "mobility",
        "target_goals": ["mobility", "stress_relief"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 3.2,
        "description": "90/90 hip transitions, pigeon stretch, child's pose, world's greatest stretch, and spinal waves."
    },
    {
        "id": "ex_30_4",
        "name": "30-Min Campus Power Walk & Interval Incline",
        "duration_mins": 30,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Outdoor / Walking",
        "primary_goal": "fitness",
        "target_goals": ["fitness", "weight_loss", "stress_relief"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 5.0,
        "description": "Brisk outdoor university walk incorporating stair climbs and pace intervals to clear the mind and boost stamina."
    },
    {
        "id": "ex_30_zumba",
        "name": "30-Min Latin Beats Zumba Party & Fat Burn",
        "duration_mins": 30,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Bodyweight / Home",
        "primary_goal": "weight_loss",
        "target_goals": ["dance", "zumba", "weight_loss", "fitness"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 7.5,
        "description": "Exhilarating 30-minute dance workout with salsa, reggaeton, and bachata intervals. Burns maximum calories with zero boredom."
    },
    {
        "id": "ex_30_run",
        "name": "30-Min Campus Steady State Jog & Endurance",
        "duration_mins": 30,
        "intensity": "High",
        "intensity_level": 3,
        "equipment": "Outdoor / Running",
        "primary_goal": "weight_loss",
        "target_goals": ["running", "jogging", "weight_loss", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 9.0,
        "description": "Steady-paced outdoor campus jog building cardiovascular capacity and metabolic rate."
    },
    {
        "id": "ex_30_mat",
        "name": "30-Min Mat Pilates & Deep Core Stability",
        "duration_mins": 30,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Exercise Mat",
        "primary_goal": "strength",
        "target_goals": ["mobility", "strength", "fitness"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 4.5,
        "description": "The Hundred, roll-ups, single leg stretches, swimming, and side planks for robust spinal posture and pelvic health."
    },

    # ── 45-MINUTE ROUTINES ──
    {
        "id": "ex_45_1",
        "name": "45-Min Athletic Strength & Hypertrophy Split",
        "duration_mins": 45,
        "intensity": "High",
        "intensity_level": 3,
        "equipment": "Gym / Dumbbells",
        "primary_goal": "strength",
        "target_goals": ["strength", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 6.5,
        "description": "Progressive resistance split: goblet squats, dumbbell bench presses, bent-over rows, lunges, and hollow body holds."
    },
    {
        "id": "ex_45_knee_safe",
        "name": "45-Min Joint-Friendly Upper Body & Core Strength",
        "duration_mins": 45,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Gym / Dumbbells",
        "primary_goal": "strength",
        "target_goals": ["strength", "fitness"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 5.8,
        "description": "Zero knee strain: dumbbell bench press, seated overhead shoulder press, dumbbell chest-supported rows, glute bridge holds, and core planks."
    },
    {
        "id": "ex_45_2",
        "name": "45-Min Calorie-Torching Cardio & Bodyweight Burn",
        "duration_mins": 45,
        "intensity": "High",
        "intensity_level": 3,
        "equipment": "Bodyweight / Home",
        "primary_goal": "weight_loss",
        "target_goals": ["weight_loss", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 8.0,
        "description": "Comprehensive full body metabolic workout combining plyometrics, core stability, and cardio endurance intervals."
    },
    {
        "id": "ex_45_3",
        "name": "45-Min Deep Hatha Yoga & Guided Pranayama",
        "duration_mins": 45,
        "intensity": "Light",
        "intensity_level": 1,
        "equipment": "Bodyweight / Home",
        "primary_goal": "mobility",
        "target_goals": ["mobility", "stress_relief"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 3.0,
        "description": "Deep fascial releases, restorative holds, hamstring length, and 10 minutes of box breathing to eliminate study burnout."
    },

    # ── 60-MINUTE ROUTINES ──
    {
        "id": "ex_60_1",
        "name": "60-Min Comprehensive Full-Body Gym Session",
        "duration_mins": 60,
        "intensity": "High",
        "intensity_level": 3,
        "equipment": "Full Gym",
        "primary_goal": "strength",
        "target_goals": ["strength", "fitness", "weight_loss"],
        "knee_safe": True,
        "back_safe": True,
        "calories_per_kg_hr": 7.0,
        "description": "Complete push-pull-legs resistance training with compound movements, core training, and dedicated cool-down stretch."
    },
    {
        "id": "ex_60_2",
        "name": "60-Min Steady State Endurance Cardio & Outdoor Run",
        "duration_mins": 60,
        "intensity": "Moderate",
        "intensity_level": 2,
        "equipment": "Outdoor / Running",
        "primary_goal": "weight_loss",
        "target_goals": ["weight_loss", "fitness"],
        "knee_safe": False,
        "back_safe": True,
        "calories_per_kg_hr": 8.5,
        "description": "Zone 2 aerobic endurance jog or stationary cycling session designed for maximum cardiovascular and mitochondrial health."
    }
]


# ── Helper: Predict Adherence Score using XGBoost ────────────────────────────
def predict_adherence(feats: Dict[str, float]) -> float:
    """Predict adherence probability using trained XGBoost Regressor or baseline fallback."""
    if _xgb_model and _scaler:
        try:
            X_df = pd.DataFrame([feats])[_feature_cols]
            X_scaled = _scaler.transform(X_df)
            prob = float(_xgb_model.predict(X_scaled)[0])
            return float(np.clip(prob, 0.1, 0.99))
        except Exception:
            pass
    
    # Fallback heuristic if model isn't available
    score = 0.85
    if feats.get("limitation_conflict", 0):
        score *= 0.3
    if feats.get("is_exam_period", 0) or feats.get("student_stress_score", 3.0) >= 3.8:
        if feats.get("item_duration_mins", 0) > 30:
            score *= 0.6
    return round(float(score), 4)


# ── Helper: Filter & Score Meals for Profile ─────────────────────────────────
def get_scored_meals_for_profile(profile: dict, is_exam_period: bool = False) -> List[Dict[str, Any]]:
    """
    Filters and ranks meal candidates based on student diet, cuisine, and context scores.
    """
    diet_pref = str(profile.get("diet_pref") or profile.get("dietary_preference", "any")).lower()
    meal_style = str(profile.get("meal_style", "both")).lower()
    allergies = str(profile.get("allergies", "")).lower()
    avoid_foods = str(profile.get("avoid_foods", "")).lower()

    workload = float(profile.get("workload_intensity_score", 50.0))
    stress = float(profile.get("stress_score", 3.0))
    burnout = float(profile.get("burnout_score", 3.0))
    sleep_def = float(profile.get("sleep_deficit", max(0.0, 7.5 - float(profile.get("sleep_hours", 7.0)))))
    bmi = float(profile.get("bmi", 22.0))
    avail_mins = float(profile.get("available_minutes", 20))

    if is_exam_period or stress >= 3.8:
        effective_avail_mins = max(15.0, avail_mins * 0.5)
        effective_workload = min(100.0, workload + 20.0)
        effective_stress = min(5.0, stress + 1.0)
    else:
        effective_avail_mins = avail_mins
        effective_workload = workload
        effective_stress = stress

    scored_meals = []

    for m in CURATED_MEALS:
        m_diet = m["diet_category"]
        m_cuisine = m["cuisine"]
        name_lower = m["name"].lower()
        desc_lower = m["description"].lower()

        # 1. Diet Filter (Vegetarian / Vegan / Non-Veg)
        if "vegan" in diet_pref:
            if m_diet != "vegan":
                continue
        elif "veg" in diet_pref and "non" not in diet_pref:
            if m_diet not in ["veg", "vegan"]:
                continue

        # 2. Cuisine Filter
        if meal_style == "sri_lankan" and m_cuisine != "sri_lankan":
            continue
        elif meal_style == "western" and m_cuisine != "western":
            continue

        # 3. Allergy & Avoid Foods Filter
        conflict = 0
        for raw_list in [allergies, avoid_foods]:
            if raw_list and str(raw_list).strip():
                terms = [t.strip().lower() for t in re.split(r'[,;]+|\band\b', str(raw_list)) if t.strip()]
                for t in terms:
                    if len(t) >= 3 and (t in name_lower or t in desc_lower or any(t in tag for tag in m.get("tags", []))):
                        conflict = 1
                        break
            if conflict:
                break
        if conflict:
            continue

        # 4. Feature Vector for XGBoost
        feats = {
            "student_workload_score": effective_workload,
            "student_stress_score": effective_stress,
            "student_burnout_score": burnout,
            "student_sleep_deficit": sleep_def,
            "student_bmi": bmi,
            "student_available_mins": effective_avail_mins,
            "item_duration_mins": 0.0,
            "item_intensity_level": 1,
            "item_prep_time": float(m["prep_time"]),
            "item_protein": float(m["protein"]),
            "item_calories": float(m["calories"]),
            "is_exam_period": 1 if is_exam_period else 0,
            "limitation_conflict": 0,
            "equipment_match": 1
        }

        adherence = predict_adherence(feats)

        # 5. Favourite Foods Boost
        favs = profile.get("favourite_foods", "")
        if favs and str(favs).strip():
            fav_terms = [t.strip().lower() for t in re.split(r'[,;]+|\band\b', str(favs)) if t.strip()]
            for ft in fav_terms:
                if len(ft) >= 3 and (ft in name_lower or ft in desc_lower or any(ft in tag for tag in m.get("tags", []))):
                    adherence = min(0.99, adherence * 1.25)
                    break

        # 6. Goal-Specific Nutritional Alignment (Weight Loss vs Weight Gain vs Maintenance)
        goals = [str(g).lower() for g in profile.get("goals", [])]
        primary_goal = str(profile.get("goal", "fitness")).lower()
        all_goal_str = " ".join(goals + [primary_goal])
        
        m_cals = float(m["calories"])
        m_prot = float(m["protein"])

        # Weight Loss / Fat Burn / High BMI (> 25)
        if "weight_loss" in all_goal_str or "lose" in all_goal_str or bmi >= 25.0:
            if m_prot >= 15.0 and m_cals <= 450:
                # Satiety & lean muscle preservation under caloric deficit
                adherence = min(0.99, adherence * 1.30)
            elif m_cals > 550:
                adherence *= 0.80

        # Weight Gain / Muscle Building / Low BMI (< 18.5)
        elif "weight_gain" in all_goal_str or "gain" in all_goal_str or "muscle" in all_goal_str or bmi < 18.5:
            if m_cals >= 380 and m_prot >= 16.0:
                # Caloric surplus & muscle recovery
                adherence = min(0.99, adherence * 1.30)
            elif m_cals < 250:
                adherence *= 0.85

        # Strength & Conditioning
        elif "strength" in all_goal_str:
            if m_prot >= 20.0:
                adherence = min(0.99, adherence * 1.25)

        m_copy = dict(m)
        recent_count = int((profile.get("plan_history") or {}).get("meal_counts", {}).get(m["name"], 0))
        if recent_count:
            # Past plans add variety; completion/adherence is learned from explicit check-ins.
            adherence *= max(0.75, 1.0 - 0.06 * recent_count)
        m_copy["adherence_probability"] = round(adherence, 4)
        scored_meals.append(m_copy)

    # Sort meals by adherence
    scored_meals.sort(key=lambda x: x["adherence_probability"], reverse=True)
    return scored_meals


# ── Helper: Clinical Risk Triage & Limitations Analysis ──────────────────────
def analyze_limitations_and_safety(profile: dict) -> Dict[str, Any]:
    """
    Clinical risk triage & limitation analysis for exercise prescription.
    Evaluates reported physical limitations, injury history, severity, and symptoms
    to determine if physician/physiotherapist consultation is required,
    and returns exact movement exclusions and safe clinical alternatives.
    """
    raw_limits = str(profile.get("physical_limitations", "") or "").strip()
    limits_lower = raw_limits.lower()

    # Detect choice mode: 'no', 'prefer_not_to_say', or 'yes'
    if not raw_limits or raw_limits == "none" or limits_lower.startswith("no") or "no limitations" in limits_lower:
        return {
            "choice": "no",
            "has_limitations": False,
            "risk_level": "low",
            "doctor_consultation_advised": False,
            "doctor_consultation_title": "All Clear for Physical Activity",
            "doctor_consultation_reason": "No physical limitations reported. Standard student fitness guidelines apply.",
            "clinical_summary": "Cleared for all movement planes, progressive resistance, and cardiovascular training.",
            "flagged_categories": [],
            "restricted_movements": [],
            "safe_modifications": ["Full-body compound movements", "Aerobic and interval training"]
        }

    if "prefer not to say" in limits_lower or "prefer_not_to_say" in limits_lower:
        return {
            "choice": "prefer_not_to_say",
            "has_limitations": True,
            "risk_level": "moderate",
            "doctor_consultation_advised": False,
            "doctor_consultation_title": "Precautionary Low-Impact Protocol",
            "doctor_consultation_reason": "Health status undisclosed. System defaults to joint-neutral, low-impact activities to prevent injury.",
            "clinical_summary": "Restricted to low-impact, joint-friendly movements. If you have any underlying pain or condition, consult a doctor.",
            "flagged_categories": ["undisclosed"],
            "restricted_movements": ["Heavy maximal lifts", "High-impact jumping", "Exhaustive Tabata sprints"],
            "safe_modifications": ["Flat campus power walking", "Gentle joint mobility", "Restorative yoga"]
        }

    # 'Yes' mode: Analyze categories, severity, and clinical red flags
    flagged = []
    restricted = []
    modifications = []
    red_flags = []

    # 1. Lower body (knee / ankle / hip)
    if any(k in limits_lower for k in ["knee", "ankle", "hip", "lower", "patell", "meniscus", "acl", "ligament", "lower-body"]):
        flagged.append("lower_body_knee")
        restricted.extend(["Deep bodyweight/barbell squats", "Forward lunges", "Jump squats / plyometrics", "High-impact running"])
        modifications.extend(["Glute bridge holds", "Straight-leg quad raises", "Flat campus power walking", "Low-impact side steps"])
        if any(w in limits_lower for w in ["tear", "severe", "sharp", "swollen", "surgery", "meniscus", "acl"]):
            red_flags.append("Knee joint pathology or sharp joint pain reported")

    # 2. Upper body (back / spine / lumbar)
    if any(k in limits_lower for k in ["back", "spine", "lumbar", "disc", "sciatica", "vertebra", "upper-body"]):
        flagged.append("upper_body_back")
        restricted.extend(["Heavy barbell deadlifts", "Unsupported spinal flexion", "Overhead heavy presses"])
        modifications.extend(["Cat-cow thoracic mobility", "Bird-dog core holds", "Pelvic tilts", "Forearm planks"])
        if any(w in limits_lower for w in ["disc", "herniat", "sciatica", "numb", "severe", "shooting"]):
            red_flags.append("Spinal disc irritation, nerve pain, or severe back strain reported")

    # 3. Shoulder / Neck
    if any(k in limits_lower for k in ["shoulder", "neck", "rotator", "cervical"]):
        flagged.append("shoulder_neck")
        restricted.extend(["Overhead barbell presses", "Behind-the-neck pulls", "Heavy push-ups"])
        modifications.extend(["Scapular retractions", "Doorway chest openers", "Wall slides", "Band pull-aparts"])

    # 4. Respiratory / Asthma
    if any(k in limits_lower for k in ["asthma", "breath", "wheez", "inhaler", "respiratory", "lung"]):
        flagged.append("respiratory_asthma")
        restricted.extend(["High-intensity Tabata sprints", "Cold-air endurance runs", "Exhaustive aerobic intervals"])
        modifications.extend(["Steady-state indoor walking", "Box breathing & pranayama", "Gradual warm-up routines"])
        if "severe" in limits_lower or "inhaler" in limits_lower:
            red_flags.append("Exercise-induced asthma or respiratory sensitivity reported")

    # 5. Cardiovascular / Blood Pressure / Dizziness
    if any(k in limits_lower for k in ["heart", "cardio", "chest", "pressure", "hypertension", "dizzy", "faint", "palpitation"]):
        flagged.append("cardiovascular")
        restricted.extend(["Maximum heart rate HIIT", "Rapid positional changes (head-below-heart)", "Heavy isometric strain"])
        modifications.extend(["Supervised light walking", "Seated gentle mobility", "Controlled rhythmic breathing"])
        red_flags.append("Cardiovascular or dizziness symptoms require medical clearance prior to physical exertion")

    # 6. Recent Surgery / Fracture / Acute injury
    if any(k in limits_lower for k in ["surgery", "operat", "fracture", "broken", "sprain", "torn", "rehab", "injury"]):
        flagged.append("recent_injury_surgery")
        restricted.extend(["All loaded resistance training", "Dynamic athletic drills"])
        modifications.extend(["Physiotherapist-guided rehabilitation", "Gentle active range of motion"])
        red_flags.append("Recent musculoskeletal injury or surgical intervention flagged")

    # 7. General Flexibility / Stiffness
    if any(k in limits_lower for k in ["flexibility", "stiff", "tightness"]):
        if not flagged:
            flagged.append("flexibility")
        restricted.extend(["Aggressive ballistic stretches"])
        modifications.extend(["Dynamic mobility flows", "Slow static post-workout stretches"])

    # If user selected 'yes' but free text was generic
    if not flagged:
        flagged.append("general_limitation")
        restricted.append("High-intensity impact drills")
        modifications.append("Low-impact adaptive exercises")

    # Detect severity
    is_severe = any(w in limits_lower for w in ["severe", "sharp", "chronic", "tear", "surgery", "disc", "heart", "chest"]) or "severity: severe" in limits_lower
    is_moderate = any(w in limits_lower for w in ["moderate", "medium", "frequent", "strain", "sprain"]) or "severity: moderate" in limits_lower or len(flagged) >= 2

    doctor_advised = bool(red_flags) or is_severe or "cardiovascular" in flagged or "recent_injury_surgery" in flagged
    risk_level = "high" if doctor_advised else ("moderate" if (is_moderate or flagged) else "low")

    if doctor_advised:
        title = "🩺 Physician / Physiotherapist Consultation Advised"
        reason = f"Medical clearance recommended: {'; '.join(red_flags) if red_flags else 'Significant joint or medical condition disclosed'}. Exercise should be performed under professional medical or physical therapy guidance."
    else:
        title = "🛡️ Adaptive AI Safety Protocol Active"
        reason = f"Identified {', '.join(flagged).replace('_', ' ')} limitation(s). Algorithmic safety rules applied to replace contra-indicated exercises with joint-friendly alternatives."

    return {
        "choice": "yes",
        "has_limitations": True,
        "risk_level": risk_level,
        "severity": "severe" if is_severe else ("moderate" if is_moderate else "mild"),
        "doctor_consultation_advised": doctor_advised,
        "doctor_consultation_title": title,
        "doctor_consultation_reason": reason,
        "clinical_summary": f"Identified: {', '.join(flagged).replace('_', ' ')}. Risk: {risk_level.upper()}.",
        "flagged_categories": flagged,
        "restricted_movements": list(dict.fromkeys(restricted)),
        "safe_modifications": list(dict.fromkeys(modifications))
    }


# ── Helper: Tailor Exercises for Profile ─────────────────────────────────────
def get_tailored_exercises_for_profile(profile: dict, is_exam_period: bool = False) -> List[Dict[str, Any]]:
    """
    Ranks exercises strictly constrained by student available minutes, limitations, and preferred activities.
    """
    workload = float(profile.get("workload_intensity_score", 50.0))
    stress = float(profile.get("stress_score", 3.0))
    burnout = float(profile.get("burnout_score", 3.0))
    sleep_def = float(profile.get("sleep_deficit", max(0.0, 7.5 - float(profile.get("sleep_hours", 7.0)))))
    bmi = float(profile.get("bmi", 22.0))
    avail_mins = int(profile.get("available_minutes", 20))
    behavior = profile.get("behavior_adaptation") or {}
    behavior_target_mins = int(behavior.get("target_minutes", avail_mins))
    safety = analyze_limitations_and_safety(profile)
    equipment_list = profile.get("equipment", [])
    equip_str = " ".join(equipment_list).lower() if equipment_list else "home / bodyweight"
    pref_acts = [str(a).lower() for a in profile.get("preferred_activities", [])]

    goals = profile.get("goals", [])
    primary_goal = str(profile.get("goal", "fitness")).lower()
    all_goals = set([g.lower() for g in goals] + [primary_goal])

    # Exam period / high stress reduction
    if is_exam_period or stress >= 3.8:
        effective_avail_mins = max(15, int(round(avail_mins * 0.5)))
        effective_workload = min(100.0, workload + 20.0)
        effective_stress = min(5.0, stress + 1.0)
    else:
        effective_avail_mins = avail_mins
        effective_workload = workload
        effective_stress = stress

    approx_weight_kg = max(45.0, min(100.0, bmi * (1.68 ** 2)))

    scored_exercises = []

    for ex in CURATED_EXERCISES:
        ex_name_l = ex["name"].lower()
        ex_desc_l = ex["description"].lower()
        limitation_conflict = 0

        # Limitation screening
        if safety["choice"] == "prefer_not_to_say":
            # Undisclosed limitation: strictly allow only low-to-moderate joint-neutral routines
            if ex["intensity_level"] > 2 or not ex["knee_safe"] or not ex["back_safe"]:
                limitation_conflict = 1
        elif safety["has_limitations"]:
            # Check knee / lower-body
            if "lower_body_knee" in safety["flagged_categories"]:
                if not ex["knee_safe"]:
                    limitation_conflict = 1
                if any(w in ex_name_l or w in ex_desc_l for w in ["squat", "lunge", "jump", "burpee", "jog"]):
                    limitation_conflict = 1
            # Check back / upper-body
            if "upper_body_back" in safety["flagged_categories"]:
                if not ex["back_safe"]:
                    limitation_conflict = 1
                if "deadlift" in ex_desc_l:
                    limitation_conflict = 1
            # Check respiratory / asthma or cardiovascular
            if any(c in safety["flagged_categories"] for c in ["respiratory_asthma", "cardiovascular"]):
                if ex["intensity_level"] >= 3:
                    limitation_conflict = 1
            # Check recent injury or surgery
            if "recent_injury_surgery" in safety["flagged_categories"]:
                if ex["intensity_level"] >= 2 or not ex["knee_safe"] or not ex["back_safe"]:
                    limitation_conflict = 1

        # Equipment match
        ex_equip = ex["equipment"].lower()
        equip_match = 1
        if "gym" in ex_equip and "gym" not in equip_str and "full gym" not in equip_str:
            equip_match = 0
        if "dumbbell" in ex_equip and "dumbbell" not in equip_str and "gym" not in equip_str:
            equip_match = 0
        if "band" in ex_equip and "band" not in equip_str:
            equip_match = 0

        cal_burned = round(approx_weight_kg * (ex["duration_mins"] / 60.0) * ex["calories_per_kg_hr"])

        feats = {
            "student_workload_score": effective_workload,
            "student_stress_score": effective_stress,
            "student_burnout_score": burnout,
            "student_sleep_deficit": sleep_def,
            "student_bmi": bmi,
            "student_available_mins": float(effective_avail_mins),
            "item_duration_mins": float(ex["duration_mins"]),
            "item_intensity_level": ex["intensity_level"],
            "item_prep_time": 0.0,
            "item_protein": 0.0,
            "item_calories": float(cal_burned),
            "is_exam_period": 1 if is_exam_period else 0,
            "limitation_conflict": limitation_conflict,
            "equipment_match": equip_match
        }

        prob = predict_adherence(feats)
        if limitation_conflict:
            prob *= 0.15

        # Check preferred activity match
        activity_match = 0
        if pref_acts:
            ex_name_l = ex["name"].lower()
            ex_desc_l = ex["description"].lower()
            ex_tags_l = [t.lower() for t in ex.get("target_goals", [])]
            for act in pref_acts:
                if "walk" in act and ("walk" in ex_name_l or "walk" in ex_equip or "walking" in ex_tags_l):
                    activity_match = 1; break
                elif "dance" in act or "zumba" in act:
                    if "dance" in ex_name_l or "zumba" in ex_name_l or "dance" in ex_tags_l or "zumba" in ex_tags_l:
                        activity_match = 1; break
                elif "run" in act or "jog" in act:
                    if "run" in ex_name_l or "jog" in ex_name_l or "running" in ex_tags_l or "jogging" in ex_tags_l or "running" in ex_equip:
                        activity_match = 1; break
                elif "yoga" in act and ("yoga" in ex_name_l or "yoga" in ex_tags_l):
                    activity_match = 1; break
                elif "strength" in act and ("strength" in ex_name_l or "dumbbell" in ex_name_l or "gym" in ex_equip or "strength" in ex_tags_l):
                    activity_match = 1; break
                elif "stretch" in act and ("stretch" in ex_name_l or "mobility" in ex_name_l or "posture" in ex_name_l):
                    activity_match = 1; break
                elif "home" in act and ("home" in ex_equip or "bodyweight" in ex_equip or "calisthenics" in ex_name_l):
                    activity_match = 1; break

        if pref_acts:
            if activity_match:
                prob = min(0.99, prob * 1.35)
            else:
                prob *= 0.65

        # Equipment alignment boost
        if "outdoor" in equip_str and ("outdoor" in ex_equip or "walk" in ex_equip or "run" in ex_equip):
            prob = min(0.99, prob * 1.25)
            activity_match = max(activity_match, 1)
        elif "dumbbell" in equip_str and "dumbbell" in ex_equip:
            prob = min(0.99, prob * 1.25)
            activity_match = max(activity_match, 1)
        elif "band" in equip_str and "band" in ex_equip:
            prob = min(0.99, prob * 1.25)
            activity_match = max(activity_match, 1)

        # Goal relevance multiplier
        goal_match = any(g in ex["target_goals"] for g in all_goals)
        if goal_match:
            prob = min(0.99, prob * 1.1)

        # High BMI & Walking Synergy: Safe fat-loss without joint shear
        is_walking_fat_loss = (bmi >= 24.5 or "weight_loss" in all_goals or any("lose" in g for g in all_goals)) and any("walk" in a for a in pref_acts)
        if is_walking_fat_loss and ("walk" in ex_name_l or "walk" in ex_equip or "walking" in ex_tags_l):
            prob = min(0.99, prob * 1.35)
            activity_match = max(activity_match, 2)

        ex_copy = dict(ex)
        recent_count = int((profile.get("plan_history") or {}).get("exercise_counts", {}).get(ex["name"], 0))
        if recent_count:
            # Avoid repeating recently scheduled items without changing safety or XGBoost features.
            prob *= max(0.75, 1.0 - 0.06 * recent_count)
        ex_copy["minutes"] = ex["duration_mins"]
        ex_copy["calories_burned"] = cal_burned
        ex_copy["adherence_probability"] = round(float(prob), 4)
        ex_copy["limitation_warning"] = True if limitation_conflict else False
        ex_copy["activity_match"] = activity_match
        scored_exercises.append(ex_copy)

    # Recent check-ins can gently shorten future sessions after repeated missed workouts.
    scored_exercises.sort(
        key=lambda x: (
            abs(x["duration_mins"] - min(effective_avail_mins, behavior_target_mins)),
            -x.get("activity_match", 0),
            -x["adherence_probability"]
        )
    )
    return scored_exercises


# ── Main API: Baseline Recommendations (Model 1) ─────────────────────────────
def get_baseline_recommendations(profile: dict, k: int = 3) -> Dict[str, Any]:
    """
    Baseline Model 1: Static rule-based filter ignoring student stress & academic workload context.
    """
    avail_mins = int(profile.get("available_minutes", 20))
    diet_pref = str(profile.get("diet_pref") or profile.get("dietary_preference", "any")).lower()

    # Generic workout list (unadjusted for stress or limitations)
    raw_exercises = [ex for ex in CURATED_EXERCISES if ex["duration_mins"] <= avail_mins + 10]
    if not raw_exercises:
        raw_exercises = CURATED_EXERCISES[:k]

    formatted_exercises = []
    for ex in raw_exercises[:k]:
        e = dict(ex)
        e["minutes"] = e["duration_mins"]
        e["calories_burned"] = 150
        e["adherence_probability"] = 0.50
        e["limitation_warning"] = False
        formatted_exercises.append(e)

    # Generic meals
    raw_meals = []
    for m in CURATED_MEALS:
        if "vegan" in diet_pref and m["diet_category"] != "vegan":
            continue
        if "veg" in diet_pref and "non" not in diet_pref and m["diet_category"] not in ["veg", "vegan"]:
            continue
        m_copy = dict(m)
        m_copy["adherence_probability"] = 0.50
        raw_meals.append(m_copy)

    return {
        "model_version": "Model 1 - Generic Baseline",
        "context_aware": False,
        "is_exam_period": False,
        "effective_available_minutes": avail_mins,
        "recommended_workouts": formatted_exercises,
        "recommended_meals": raw_meals[:k]
    }


# ── Main API: Adaptive AI Recommendations (Model 2) ──────────────────────────
def get_adaptive_recommendations(profile: dict, is_exam_period: bool = False, k: int = 3) -> Dict[str, Any]:
    """
    Adaptive Model 2: Context-aware XGBoost ranker responding dynamically to stress,
    workload, exam period, limitations, and user goals.
    """
    exercises = get_tailored_exercises_for_profile(profile, is_exam_period=is_exam_period)
    meals = get_scored_meals_for_profile(profile, is_exam_period=is_exam_period)

    avail_mins = int(profile.get("available_minutes", 20))
    stress = float(profile.get("stress_score", 3.0))
    workload = float(profile.get("workload_intensity_score", 50.0))

    if is_exam_period or stress >= 3.8:
        effective_avail_mins = max(15, int(round(avail_mins * 0.5)))
    else:
        effective_avail_mins = avail_mins

    # Slot-based top choices for today
    bf = [m for m in meals if m["slot"] == "breakfast"][:2]
    lu = [m for m in meals if m["slot"] == "lunch"][:2]
    dn = [m for m in meals if m["slot"] == "dinner"][:2]
    sn = [m for m in meals if m["slot"] == "snack"][:2]

    return {
        "model_version": "Model 2 - Context-Aware Adaptive XGBoost",
        "context_aware": True,
        "is_exam_period": is_exam_period,
        "effective_available_minutes": effective_avail_mins,
        "stress_level": round(stress, 2),
        "workload_score": round(workload, 2),
        "behavior_adaptation": profile.get("behavior_adaptation"),
        "safety_analysis": analyze_limitations_and_safety(profile),
        "recommended_workouts": exercises[:k],
        "recommended_meals": meals[:k],
        "today_slots": {
            "breakfast": bf,
            "lunch": lu,
            "dinner": dn,
            "snack": sn,
            "exercise": exercises[0] if exercises else None
        }
    }


# ── Main API: Flexible Date-Wise Plan Generation (Week / Month) ──────────────
def generate_week_plan(
    profile: dict,
    is_exam_period: bool = False,
    use_baseline: bool = False,
    start_date: Optional[datetime.date] = None,
    num_days: int = 7
) -> Dict[str, Any]:
    """
    Generates a personalized schedule for any duration (7 days, 14 days, or 30 days)
    with date, daily exercise routine, and 4 meal slots (Breakfast, Lunch, Dinner, Snack)
    matching student dietary preferences, target weight/caloric trajectory, and available time.
    """
    if start_date is None:
        start_date = datetime.date.today()

    num_days = max(1, min(31, int(num_days or 7)))
    safety = analyze_limitations_and_safety(profile)

    if use_baseline:
        engine_info = get_baseline_recommendations(profile, k=10)
        exercises = engine_info["recommended_workouts"]
        meals = engine_info["recommended_meals"]
    else:
        engine_info = get_adaptive_recommendations(profile, is_exam_period=is_exam_period, k=10)
        exercises = get_tailored_exercises_for_profile(profile, is_exam_period=is_exam_period)
        meals = get_scored_meals_for_profile(profile, is_exam_period=is_exam_period)

    if safety["has_limitations"]:
        safe_exercises = [e for e in exercises if not e.get("limitation_warning", False)]
        if safe_exercises:
            exercises = safe_exercises

    # Categorize meals by slot
    breakfast_pool = [m for m in meals if m["slot"] == "breakfast"]
    lunch_pool = [m for m in meals if m["slot"] == "lunch"]
    dinner_pool = [m for m in meals if m["slot"] == "dinner"]
    snack_pool = [m for m in meals if m["slot"] == "snack"]

    diet_pref = str(profile.get("diet_pref") or profile.get("dietary_preference", "any")).lower()
    meal_style = str(profile.get("meal_style", "both")).lower()

    def get_safe_fallback(slot_name):
        candidates = [m for m in CURATED_MEALS if m["slot"] == slot_name]
        if "vegan" in diet_pref:
            candidates = [m for m in candidates if m["diet_category"] == "vegan"]
        elif "veg" in diet_pref and "non" not in diet_pref:
            candidates = [m for m in candidates if m["diet_category"] in ["veg", "vegan"]]
        if "sri" in meal_style:
            sl = [m for m in candidates if m["cuisine"] == "sri_lankan"]
            if sl: candidates = sl
        elif "inter" in meal_style or "west" in meal_style:
            w = [m for m in candidates if m["cuisine"] == "western"]
            if w: candidates = w
        return candidates

    # Safe fallbacks preserving student diet and cuisine preferences
    if not breakfast_pool:
        breakfast_pool = get_safe_fallback("breakfast")
    if not lunch_pool:
        lunch_pool = get_safe_fallback("lunch")
    if not dinner_pool:
        dinner_pool = get_safe_fallback("dinner")
    if not snack_pool:
        snack_pool = get_safe_fallback("snack")

    # Variety rotation across the requested timeframe
    days = []
    num_ex = len(exercises) if exercises else 1
    num_bf = len(breakfast_pool)
    num_lu = len(lunch_pool)
    num_dn = len(dinner_pool)
    num_sn = len(snack_pool)

    for i in range(num_days):
        current_date = start_date + datetime.timedelta(days=i)
        day_name = current_date.strftime("%A")
        date_str = current_date.strftime("%Y-%m-%d")

        # Pick exercise for this day
        # Day 7 or Day 4 can be active recovery/mobility if high stress
        ex_for_day = exercises[i % num_ex] if exercises else {
            "name": "20-Min Brisk Walking", "minutes": 20, "calories_burned": 100,
            "intensity": "Light", "equipment": "None", "adherence_probability": 0.85
        }

        # Pick meals for each slot (Primary + Alternative)
        bf_item_1 = breakfast_pool[i % num_bf]
        bf_item_2 = breakfast_pool[(i + 1) % num_bf]

        lu_item_1 = lunch_pool[i % num_lu]
        lu_item_2 = lunch_pool[(i + 1) % num_lu]

        dn_item_1 = dinner_pool[i % num_dn]
        dn_item_2 = dinner_pool[(i + 1) % num_dn]

        sn_item_1 = snack_pool[i % num_sn]
        sn_item_2 = snack_pool[(i + 1) % num_sn]

        day_plan = {
            "day_number": i + 1,
            "day_name": day_name,
            "date": date_str,
            "exercise": ex_for_day,
            "meals": {
                "breakfast": [bf_item_1, bf_item_2],
                "lunch": [lu_item_1, lu_item_2],
                "dinner": [dn_item_1, dn_item_2],
                "snack": [sn_item_1, sn_item_2]
            }
        }
        days.append(day_plan)

    return {
        "model_version": engine_info["model_version"],
        "context_aware": engine_info["context_aware"],
        "is_exam_period": is_exam_period,
        "effective_available_minutes": engine_info["effective_available_minutes"],
        "behavior_adaptation": profile.get("behavior_adaptation"),
        "safety_analysis": safety,
        "user_preferences": {
            "goal": profile.get("goal", "fitness"),
            "goals": profile.get("goals", []),
            "available_minutes": profile.get("available_minutes", 20),
            "diet_pref": profile.get("diet_pref") or profile.get("dietary_preference", "any"),
            "meal_style": profile.get("meal_style", "both"),
            "physical_limitations": profile.get("physical_limitations", ""),
            "allergies": profile.get("allergies", ""),
            "avoid_foods": profile.get("avoid_foods", "")
        },
        "days": days
    }


if __name__ == "__main__":
    test_profile = {
        "workload_intensity_score": 75.0,
        "stress_score": 4.2,
        "burnout_score": 4.0,
        "sleep_deficit": 2.0,
        "bmi": 23.5,
        "available_minutes": 20,
        "physical_limitations": "Knee pain",
        "equipment": ["Home / Bodyweight"],
        "diet_pref": "vegan",
        "meal_style": "sri_lankan",
        "goals": ["weight_loss", "fitness"]
    }

    print("=== TESTING 7-DAY WEEK PLAN (VEGAN + SRI LANKAN + 20 MINS + KNEE PAIN) ===")
    plan = generate_week_plan(test_profile, is_exam_period=True)
    print(f"Model: {plan['model_version']}")
    print(f"Effective Time: {plan['effective_available_minutes']} mins")
    print(f"Total Days: {len(plan['days'])}")
    day1 = plan['days'][0]
    print(f"Day 1 ({day1['day_name']} {day1['date']}):")
    print(f"  Exercise: {day1['exercise']['name']} ({day1['exercise']['minutes']}m) - Adherence: {day1['exercise']['adherence_probability']}")
    print(f"  Breakfast: {day1['meals']['breakfast'][0]['name']}")
    print(f"  Lunch: {day1['meals']['lunch'][0]['name']}")
    print(f"  Dinner: {day1['meals']['dinner'][0]['name']}")
    print(f"  Snack: {day1['meals']['snack'][0]['name']}")
