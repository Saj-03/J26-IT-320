// Data layer for the Adaptive AI-Based Physical Wellbeing Support module.
// Research component: Nilukshika R.
export const wellbeingProfile = {
    name: 'Awantha',
    score: 78,
    age: 21,
    gender: 'Male',
    height: 174,
    weight: 68,
    fitnessLevel: 'Moderate',
    goals: ['Improve Physical Fitness', 'Become More Active', 'Build Better Eating Habits'],
    sleepHours: 7,
    studyHours: 5,
    sittingHours: 8,
    exerciseFrequency: '2–3 times / week',
    walkingLevel: 'Light',
    availableTime: '20 min',
    preferredTime: 'Evening',
    water: 5,
    limitations: ['Knee discomfort'],
    diet: 'Non-Vegetarian',
    mealStyle: 'Both',
    allergies: 'None',
    avoid: 'Deep fried food',
    favourites: 'Rice & curry, fruit',
    streak: 7
};
// Physical Wellbeing Goals (Survey Col 55)
export const wellbeingGoals = [
    { id: 'Improve overall fitness', label: 'Improve Overall Fitness', emoji: '💪', desc: 'Build aerobic capacity and vitality' },
    { id: 'Increase physical activity', label: 'Increase Physical Activity', emoji: '🚶', desc: 'Move more and reduce sedentary study hours' },
    { id: 'Improve strength', label: 'Improve Strength', emoji: '🏋️', desc: 'Tone muscles, posture and core endurance' },
    { id: 'Manage body weight', label: 'Manage Body Weight', emoji: '⚖️', desc: 'Healthy body mass management' },
    { id: 'Improve flexibility / mobility', label: 'Flexibility & Mobility', emoji: '🧘', desc: 'Relieve stiff neck, shoulders and lower back' },
    { id: 'Improve sleep', label: 'Improve Sleep Quality', emoji: '😴', desc: 'De-stress for deeper, restorative rest' },
    { id: 'Maintain current wellbeing', label: 'Maintain Current Wellbeing', emoji: '🌿', desc: 'Sustain balanced daily health habits' }
];

// Physical Activity Levels (Survey Col 56)
export const activityLevels = [
    { id: 'Very inactive', label: 'Very Inactive', desc: 'Sedentary study days, little to no exercise', emoji: '🪑' },
    { id: 'Lightly active', label: 'Lightly Active', desc: 'Occasional light walking around campus', emoji: '🚶' },
    { id: 'Moderately active', label: 'Moderately Active', desc: 'Regular exercise 1–2 times a week', emoji: '🏃' },
    { id: 'Highly active', label: 'Highly Active', desc: 'Structured exercise 3–4 times a week', emoji: '⚡' },
    { id: 'Very active', label: 'Very Active', desc: 'Intensive sports or training most days', emoji: '🔥' }
];
export const fitnessLevels = activityLevels; // Backwards compatibility alias

// Willing Physical Activities (Survey Col 58)
export const willingActivities = [
    { id: 'Home workouts', label: 'Home Workouts', emoji: '🏠' },
    { id: 'Gym / strength training', label: 'Gym / Strength', emoji: '🏋️' },
    { id: 'Walking', label: 'Walking', emoji: '🚶' },
    { id: 'Running / jogging', label: 'Running / Jogging', emoji: '🏃' },
    { id: 'Stretching / mobility', label: 'Stretching / Mobility', emoji: '🧘' },
    { id: 'Yoga', label: 'Yoga', emoji: '🕉️' },
    { id: 'Cycling', label: 'Cycling', emoji: '🚴' },
    { id: 'Sports', label: 'Sports (Badminton, etc.)', emoji: '🏸' },
    { id: 'Dance / Zumba', label: 'Dance / Zumba', emoji: '💃' }
];

// Exercise Facilities & Equipment (Survey Col 61)
export const equipmentFacilities = [
    { id: 'No equipment', label: 'No Equipment (Bodyweight)', emoji: '🤸' },
    { id: 'Exercise mat', label: 'Exercise Mat', emoji: '🧘' },
    { id: 'Dumbbells / weights', label: 'Dumbbells / Weights', emoji: '🏋️' },
    { id: 'Resistance bands', label: 'Resistance Bands', emoji: '🎗️' },
    { id: 'Outdoor walking / running area', label: 'Outdoor Walking Area', emoji: '🌳' },
    { id: 'Gym / fitness centre', label: 'Gym / Fitness Centre', emoji: '🏢' },
    { id: 'Sports facilities', label: 'Sports Facilities', emoji: '🏟️' }
];

// Primary screening choice (matches survey question Col 59)
export const limitationPrimaryChoices = [
    { id: 'no', label: 'No limitations', emoji: '✅', desc: 'No joint pain or physical barriers to exercise' },
    { id: 'prefer_not_to_say', label: 'Prefer not to say', emoji: '🔒', desc: 'Keep private — system will assign gentle, joint-neutral routines' },
    { id: 'yes', label: 'Yes, I have limitations', emoji: '⚠️', desc: 'Specify joint pain or conditions for clinical safety adaptation' }
];

// Physical limitation categories (Col 60)
export const limitationOptions = [
    { id: 'lower_body', label: 'Lower-body (Knee / Ankle / Hip)', emoji: '🦵', desc: 'Excludes deep squats, lunges, running, and jump plyometrics' },
    { id: 'upper_body', label: 'Upper-body (Lower Back / Spine)', emoji: '🧍', desc: 'Excludes deadlifts, heavy overhead loads, and unsupported spinal flexion' },
    { id: 'shoulder_neck', label: 'Shoulders & Neck', emoji: '💪', desc: 'Excludes heavy push-ups and overhead barbell presses' },
    { id: 'high_impact', label: 'High-impact movements', emoji: '👟', desc: 'Low-impact, joint-cushioned exercises only' },
    { id: 'respiratory', label: 'Respiratory / Asthma', emoji: '🫁', desc: 'Excludes breathless sprint intervals; steady aerobic pacing only' },
    { id: 'cardiovascular', label: 'Cardiovascular / Blood Pressure / Dizziness', emoji: '❤️', desc: 'Requires medical clearance; gentle supervised movements' },
    { id: 'surgery_injury', label: 'Recent Injury or Surgery', emoji: '🩹', desc: 'Post-rehabilitation; doctor guidance required' },
    { id: 'flexibility', label: 'Chronic Stiffness / Limited Mobility', emoji: '🧘', desc: 'Gentle therapeutic range-of-motion routines' },
    { id: 'other', label: 'Other Medical Condition', emoji: '❓', desc: 'Personalized clinical review (specify below)' }
];

// Limitation severity levels
export const limitationSeverities = [
    { id: 'mild', label: 'Mild / Occasional', emoji: '🟢', desc: 'Slight stiffness or tightness after sitting' },
    { id: 'moderate', label: 'Moderate Discomfort', emoji: '🟡', desc: 'Noticeable pain or ache during certain loaded movements' },
    { id: 'severe', label: 'Severe / Chronic / Sharp Pain', emoji: '🔴', desc: 'Persistent pain, recent injury, or diagnosed medical condition' }
];

// Available Time per University Day (Survey Col 62)
export const availableTimeOptions = [
    { id: 'Less than 15 minutes', label: 'Less than 15 mins', desc: 'Quick desk stretch & micro-routine', minutes: 15 },
    { id: '15–30 minutes', label: '15–30 mins', desc: 'Efficient university session', minutes: 20 },
    { id: '31–45 minutes', label: '31–45 mins', desc: 'Balanced cardio & strength', minutes: 35 },
    { id: '46–60 minutes', label: '46–60 mins', desc: 'Complete workout routine', minutes: 45 },
    { id: 'More than 60 minutes', label: '60+ mins', desc: 'In-depth fitness training', minutes: 60 }
];

// Main Routine Difficulties / Barriers (Survey Col 64)
export const barrierOptions = [
    'Academic workload',
    'Lack of time',
    'Stress',
    'Tiredness / lack of sleep',
    'Lack of motivation',
    'Lack of facilities / equipment',
    'Lack of knowledge'
];

// Main Nutrition Goals (Survey Col 65)
export const nutritionGoals = [
    { id: 'Maintain healthy eating', label: 'Maintain Healthy Eating', emoji: '🥗' },
    { id: 'Improve nutritional quality', label: 'Improve Food Quality', emoji: '🍎' },
    { id: 'Manage body weight', label: 'Manage Body Weight', emoji: '⚖️' },
    { id: 'Increase protein intake', label: 'Increase Protein Intake', emoji: '🍗' },
    { id: 'Increase fruit and vegetable intake', label: 'More Fruits & Veggies', emoji: '🥦' },
    { id: 'Support fitness', label: 'Fuel Workout & Energy', emoji: '⚡' }
];

// Meal Cuisine Style (Survey Col 66)
export const mealStyles = [
    { id: 'Sri Lankan meals', label: 'Sri Lankan Meals', emoji: '🍛', desc: 'Rice & curry, hoppers, dhal, sambol' },
    { id: 'International meals', label: 'International Meals', emoji: '🥗', desc: 'Oats, grilled chicken, pasta, wraps' },
    { id: 'Combination of both', label: 'Combination of Both', emoji: '🍽️', desc: 'Blend of local cuisine and quick global meals' }
];

// Dietary Preference (Survey Col 67)
export const dietOptions = [
    { id: 'Non-Vegetarian', label: 'Non-Vegetarian', emoji: '🍗', desc: 'Includes poultry, fish, eggs and dairy' },
    { id: 'Vegetarian', label: 'Vegetarian', emoji: '🥬', desc: 'Plant-based with dairy and eggs' },
    { id: 'Vegan', label: '100% Vegan', emoji: '🌱', desc: 'Purely plant-based, no animal products' },
    { id: 'No specific preference', label: 'No Specific Preference', emoji: '🍽️', desc: 'Flexible with any balanced meal' }
];

// Meal Sources (Survey Col 68)
export const mealSources = [
    'Cook at home',
    'Family-prepared meals',
    'University cafeteria / canteen',
    'Restaurants / takeaway',
    'Combination'
];

// Academic Study Hours Outside Lectures (Survey Col 29)
export const studyHourRanges = [
    'Less than 5 hours',
    '5–10 hours',
    '10–20 hours',
    'More than 20 hours'
];

// Weekly Academic Tasks (Survey Col 34)
export const academicTaskRanges = [
    '1–2 tasks',
    '3–5 tasks',
    'More than 5 tasks'
];
export const todayRecommendation = {
    id: 'r1',
    title: 'Take a 20-minute light cardio session this evening',
    detail: 'Low impact, knee-friendly, no equipment needed.',
    why: 'Your activity level has been lower than your weekly average during the last two days.',
    benefit: 'Helps you reach today’s activity goal and keeps your consistency streak alive.',
    tag: 'Evening · 20 min'
};
export const todayRings = [
    { id: 'activity', label: 'Activity', emoji: '🚶', current: 5240, total: 7000, unit: 'steps', color: '#2E9C88' },
    { id: 'exercise', label: 'Exercise', emoji: '🏃', current: 20, total: 30, unit: 'min', color: '#8CCFA0' },
    { id: 'nutrition', label: 'Nutrition', emoji: '🥗', current: 2, total: 3, unit: 'meals', color: '#7FCFDD' },
    { id: 'habits', label: 'Habits', emoji: '✨', current: 4, total: 5, unit: 'done', color: '#9EB2DB' }
];
export const todayPlan = [
    { id: 'p1', period: 'Morning', emoji: '🚶', title: '10-Minute Walk', target: 'Around campus', status: 'done' },
    {
        id: 'p2',
        period: 'Afternoon',
        emoji: '💧',
        title: 'Drink Water',
        target: '8 glasses today',
        status: 'active',
        progress: { current: 5, total: 8, unit: 'glasses' }
    },
    { id: 'p3', period: 'Evening', emoji: '🏃', title: '20-Minute Cardio', target: 'Beginner · knee friendly', status: 'todo' },
    { id: 'p4', period: 'Night', emoji: '😴', title: 'Sleep Goal', target: '7–8 hours', status: 'todo' }
];
export const featuredExercise = {
    title: '20-Minute Beginner Cardio',
    image: "/9269aefa-f432-481e-9b47-c5d3b25db6a3.jpg",
    duration: '20 min',
    difficulty: 'Easy',
    equipment: 'None',
    kcal: 120,
    why: 'Your recent activity level has decreased and you selected improving fitness as one of your goals. We kept the impact low because you noted knee discomfort.',
    benefit: 'Builds cardio consistency without stressing your knees.'
};
export const alternativeExercises = [
    { id: 'walk', name: 'Walking', emoji: '🚶', mins: 20, difficulty: 'Easy', tag: 'Lowest impact' },
    { id: 'stretch', name: 'Stretching', emoji: '🧘', mins: 10, difficulty: 'Easy', tag: 'Recovery' },
    { id: 'yoga', name: 'Yoga', emoji: '🕉️', mins: 25, difficulty: 'Easy', tag: 'Flexibility' },
    { id: 'body', name: 'Bodyweight Exercise', emoji: '💪', mins: 20, difficulty: 'Moderate', tag: 'Strength' },
    { id: 'cardio', name: 'Light Cardio', emoji: '🏃', mins: 15, difficulty: 'Easy', tag: 'Recommended' },
    { id: 'strength', name: 'Strength Exercise', emoji: '🏋️', mins: 30, difficulty: 'Moderate', tag: 'Progression' }
];
export const kneeSafeWorkoutSteps = [
    { name: 'Warm-Up March', seconds: 120, cue: 'Gentle flat march, swing arms loosely without stomping or jumping.', emoji: '🚶' },
    { name: 'Glute Bridge Hold', seconds: 120, cue: 'Lie on back, knees bent. Drive hips up, squeeze glutes. Zero knee shear force.', emoji: '🍑' },
    { name: 'Straight-Leg Quad Raises', seconds: 120, cue: 'Lie down or sit tall. Lift one leg straight up without bending knee. Strengthens quads safely.', emoji: '🦵' },
    { name: 'Arm Circles & Torso Rotation', seconds: 120, cue: 'Big circles forward and back with gentle torso twists.', emoji: '💪' },
    { name: 'Seated Core & Arm Reach', seconds: 120, cue: 'Sit tall, brace abdominals, reach overhead side to side with controlled breath.', emoji: '✨' },
    { name: 'Cool-Down Hamstring & Calf Stretch', seconds: 120, cue: 'Slow deep breathing, gentle standing or seated hamstring and calf stretch.', emoji: '🧘' }
];

export const backSafeWorkoutSteps = [
    { name: 'Warm-Up Flat Walk', seconds: 120, cue: 'Light march in place with tall spinal posture and relaxed shoulders.', emoji: '🚶' },
    { name: 'Cat-Cow Spinal Flow', seconds: 120, cue: 'On hands and knees, gently arch and round spine with slow deep breaths.', emoji: '🐈' },
    { name: 'Bird-Dog Core Hold', seconds: 120, cue: 'Reach opposite arm and leg out. Builds deep lumbar stability without compressive load.', emoji: '🐕' },
    { name: 'Forearm Plank Hold', seconds: 120, cue: 'Draw navel in, keep neck neutral, hold strong steady core.', emoji: '🪵' },
    { name: 'Gentle Child’s Pose', seconds: 120, cue: 'Sit hips toward heels, extend arms forward on mat, release lower back tension.', emoji: '🧘' },
    { name: 'Standing Chest & Doorway Opener', seconds: 120, cue: 'Open chest, breathe into upper ribs to reverse study hunching.', emoji: '🌿' }
];

export const gentleWorkoutSteps = [
    { name: 'Gentle Campus Stride', seconds: 120, cue: 'Smooth walking cadence, swing arms naturally, inhale deeply.', emoji: '🚶' },
    { name: 'Standing Torso Twists', seconds: 120, cue: 'Slow, relaxed twists side to side. Keep joints loose and comfortable.', emoji: '↔️' },
    { name: 'Shoulder Rolls & Neck Release', seconds: 120, cue: 'Roll shoulders back 5 times, gently drop ear to shoulder.', emoji: '💆' },
    { name: 'Side Step & Tap', seconds: 120, cue: 'Step side to side with zero bounce. Light and rhythmic.', emoji: '👟' },
    { name: 'Seated Overhead Reach', seconds: 120, cue: 'Extend arms upward, stretch ribcage, exhale slowly.', emoji: '✨' },
    { name: 'Box Breathing Relaxation', seconds: 120, cue: 'Inhale 4s, hold 4s, exhale 4s, hold 4s. Calms nervous system.', emoji: '🧘' }
];

export const standardWorkoutSteps = [
    { name: 'Warm-Up March', seconds: 120, cue: 'March on the spot, swing your arms gently.', emoji: '🚶' },
    { name: 'Bodyweight Squats & Core', seconds: 120, cue: 'Feet shoulder-width. Sit back slowly, keep knees tracking over toes.', emoji: '🦵' },
    { name: 'Standing Knee Lifts', seconds: 120, cue: 'Lift one knee at a time to hip height. Stay controlled.', emoji: '🦿' },
    { name: 'Arm Circles & Shoulder Burn', seconds: 120, cue: 'Big slow circles forward, then backward.', emoji: '💪' },
    { name: 'Side Steps & Skater Taps', seconds: 120, cue: 'Step side to side with athletic rhythm.', emoji: '↔️' },
    { name: 'Cool-Down Full Stretch', seconds: 120, cue: 'Slow breathing, gentle hamstring, quad and calf stretch.', emoji: '🧘' }
];

export const workoutSteps = standardWorkoutSteps;
export const meals = [
    {
        id: 'm1',
        slot: 'Breakfast',
        name: 'Kola Kenda + Papaya',
        emoji: '🥣',
        image: "/67a05d45-ab91-4e9b-9572-455e2228a1d0.jpg",
        cuisine: 'Sri Lankan',
        kcal: 280,
        protein: 8,
        carbs: 46,
        veg: 2,
        why: 'A light, hydrating start that suits your early lecture schedule and your healthy-eating goal.'
    },
    {
        id: 'm2',
        slot: 'Lunch',
        name: 'Red Rice + Dhal + Gotukola Sambol + Grilled Fish',
        emoji: '🍛',
        image: "/39c988fa-df0e-4099-8c60-91d3bf4a11aa.jpg",
        cuisine: 'Sri Lankan',
        kcal: 620,
        protein: 34,
        carbs: 78,
        veg: 3,
        why: 'Recommended based on your activity level, healthy eating goal, and Sri Lankan meal preference.'
    },
    {
        id: 'm3',
        slot: 'Dinner',
        name: 'Vegetable Curry + String Hoppers',
        emoji: '🍲',
        cuisine: 'Sri Lankan',
        kcal: 480,
        protein: 16,
        carbs: 72,
        veg: 4,
        why: 'Lighter carbohydrate load in the evening supports your 7–8 hour sleep goal.'
    },
    {
        id: 'm4',
        slot: 'Snacks',
        name: 'Fruit Bowl + Yoghurt',
        emoji: '🍎',
        cuisine: 'International',
        kcal: 180,
        protein: 9,
        carbs: 28,
        veg: 0,
        why: 'A simple between-lecture option that keeps your protein steady without deep-fried food.'
    }
];
export const alternativeMeals = [
    { name: 'Mallung + Red Rice', emoji: '🥬', cuisine: 'Sri Lankan', kcal: 430 },
    { name: 'Chicken Curry + Rice', emoji: '🍗', cuisine: 'Sri Lankan', kcal: 610 },
    { name: 'Grilled Chicken Salad', emoji: '🥗', cuisine: 'International', kcal: 390, image: "/29a98ebd-e302-4ac6-81f6-4da7c5c23863.jpg" },
    { name: 'Oatmeal + Banana', emoji: '🥣', cuisine: 'International', kcal: 310 },
    { name: 'Vegetable Wrap', emoji: '🌯', cuisine: 'International', kcal: 360 },
    { name: 'Healthy Pasta', emoji: '🍝', cuisine: 'International', kcal: 520 }
];
export const activityToday = [
    { id: 'steps', label: 'Steps', current: 5240, total: 7000, unit: '', color: 'bg-brand-500', emoji: '🚶' },
    { id: 'active', label: 'Active Minutes', current: 46, total: 60, unit: 'min', color: 'bg-sage', emoji: '⚡' },
    { id: 'exercise', label: 'Exercise', current: 20, total: 30, unit: 'min', color: 'bg-sky-400', emoji: '🏃' },
    { id: 'water', label: 'Water', current: 5, total: 8, unit: 'glasses', color: 'bg-violet-400', emoji: '💧' }
];
export const weeklyActivity = {
    Steps: [
        { label: 'Mon', value: 6800 },
        { label: 'Tue', value: 7400 },
        { label: 'Wed', value: 5240 },
        { label: 'Thu', value: 4100 },
        { label: 'Fri', value: 8200 },
        { label: 'Sat', value: 3600 },
        { label: 'Sun', value: 2900 }
    ],
    Exercise: [
        { label: 'Mon', value: 30 },
        { label: 'Tue', value: 25 },
        { label: 'Wed', value: 20 },
        { label: 'Thu', value: 0 },
        { label: 'Fri', value: 35 },
        { label: 'Sat', value: 15 },
        { label: 'Sun', value: 10 }
    ],
    'Active Minutes': [
        { label: 'Mon', value: 55 },
        { label: 'Tue', value: 62 },
        { label: 'Wed', value: 46 },
        { label: 'Thu', value: 28 },
        { label: 'Fri', value: 71 },
        { label: 'Sat', value: 34 },
        { label: 'Sun', value: 22 }
    ]
};
export const habits = [
    { id: 'h1', emoji: '🚶', name: 'Morning Walk', goal: '10 minutes', streak: 7, done: true, history: [true, true, true, true, true, true, true] },
    { id: 'h2', emoji: '💧', name: 'Drink 8 Glasses of Water', goal: '8 glasses', streak: 5, done: true, history: [true, false, true, true, true, true, true] },
    { id: 'h3', emoji: '🏃', name: 'Exercise', goal: '20 minutes', streak: 4, done: true, history: [true, true, false, true, true, true, true] },
    { id: 'h4', emoji: '🥬', name: 'Eat Vegetables', goal: '3 servings', streak: 9, done: true, history: [true, true, true, true, true, true, true] },
    { id: 'h5', emoji: '😴', name: 'Sleep Before 11 PM', goal: 'Lights out 11 PM', streak: 0, done: false, history: [true, false, false, true, false, false, false] }
];
export const achievements = [
    { emoji: '🏅', name: 'Active Beginner', desc: 'Complete 3 workouts', earned: true, progress: 3, total: 3 },
    { emoji: '🔥', name: '7 Day Streak', desc: 'Maintain healthy habits for one week', earned: true, progress: 7, total: 7 },
    { emoji: '🥗', name: 'Healthy Eating', desc: 'Complete 10 healthy meals', earned: false, progress: 7, total: 10 },
    { emoji: '🚶', name: 'Step Master', desc: 'Reach your walking goal 5 times', earned: false, progress: 3, total: 5 }
];
export const weeklyChallenge = {
    emoji: '🏃',
    title: 'Active Student Challenge',
    goal: 'Complete 150 active minutes this week',
    current: 105,
    total: 150,
    reward: '🏅 Active Week Badge'
};
export const adaptationEvent = {
    headline: 'Your Plan Has Been Updated',
    message: 'We noticed that your exercise completion decreased this week.',
    previous: '30-Minute Moderate Workout',
    next: '15-Minute Light Exercise + 10-Minute Walk',
    reason: 'The new recommendation better matches your recent activity level, available time, and exercise consistency.',
    signals: [
        { label: 'Exercise completion', change: -32, note: '3 of 5 sessions skipped' },
        { label: 'Available time', change: -15, note: 'Shorter free windows this week' },
        { label: 'Difficulty feedback', change: 0, note: 'You marked 2 workouts "Difficult"' }
    ]
};
export const progressStats = [
    { label: 'Physical Activity', value: 14, suffix: '%', up: true },
    { label: 'Exercise Consistency', value: 20, suffix: '%', up: true },
    { label: 'Healthy Habits', value: 8, suffix: '%', up: true },
    { label: 'Goal Completion', value: 78, suffix: '%', up: true, absolute: true }
];
export const progressSeries = {
    Week: [
        { label: 'Mon', value: 62 },
        { label: 'Tue', value: 70 },
        { label: 'Wed', value: 58 },
        { label: 'Thu', value: 44 },
        { label: 'Fri', value: 82 },
        { label: 'Sat', value: 51 },
        { label: 'Sun', value: 48 }
    ],
    Month: [
        { label: 'W1', value: 54 },
        { label: 'W2', value: 61 },
        { label: 'W3', value: 68 },
        { label: 'W4', value: 78 }
    ],
    Semester: [
        { label: 'Sep', value: 42 },
        { label: 'Oct', value: 51 },
        { label: 'Nov', value: 63 },
        { label: 'Dec', value: 66 },
        { label: 'Jan', value: 74 },
        { label: 'Feb', value: 78 }
    ]
};
export const aiWeeklyInsight = 'Your exercise consistency improved by 20% this week. You were most active during evening sessions, so your upcoming exercise plan has been adjusted to prioritise evening activities.';
export const wellbeingNotifications = [
    { id: 'wn1', emoji: '🚶', title: 'Time for a short walk', body: 'You’ve been inactive for a while.', time: '12m ago', unread: true, tone: 'activity' },
    { id: 'wn2', emoji: '🏃', title: 'Today’s workout is ready', body: '20-minute light cardio based on your current activity level.', time: '2h ago', unread: true, tone: 'exercise' },
    { id: 'wn3', emoji: '🎉', title: 'Great progress!', body: 'You’ve maintained your activity goal for 5 days.', time: 'Yesterday', unread: false, tone: 'reward' },
    { id: 'wn4', emoji: '🔄', title: 'Your plan adapted', body: 'Evening sessions now come first — that’s when you’re most active.', time: '2 days ago', unread: false, tone: 'adapt' }
];
export const adaptiveLoopSteps = [
    { key: 'data', label: 'Student Data', emoji: '📥', desc: 'Lifestyle, goals, conditions' },
    { key: 'analysis', label: 'Behaviour Analysis', emoji: '🧠', desc: 'Patterns & consistency' },
    { key: 'reco', label: 'Personalised Plan', emoji: '✨', desc: 'Exercise, nutrition, habits' },
    { key: 'action', label: 'Student Action', emoji: '🏃', desc: 'Done, skipped, rescheduled' },
    { key: 'feedback', label: 'Feedback', emoji: '💬', desc: 'Difficulty & progress' },
    { key: 'adapt', label: 'AI Adaptation', emoji: '🔄', desc: 'Plan updates itself' }
];
