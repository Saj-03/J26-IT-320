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
export const fitnessLevels = [
    { id: 'beginner', label: 'Beginner', desc: 'Little or no regular exercise', emoji: '🌱' },
    { id: 'moderate', label: 'Moderate', desc: 'Active once or twice a week', emoji: '🚶' },
    { id: 'active', label: 'Active', desc: 'Exercise 3–4 times a week', emoji: '🏃' },
    { id: 'very', label: 'Very Active', desc: 'Training most days', emoji: '⚡' }
];
export const wellbeingGoals = [
    { id: 'fitness', label: 'Improve Physical Fitness', emoji: '💪' },
    { id: 'active', label: 'Become More Active', emoji: '🚶' },
    { id: 'maintain', label: 'Maintain Healthy Weight', emoji: '⚖️' },
    { id: 'lose', label: 'Lose Weight', emoji: '🎯' },
    { id: 'eating', label: 'Build Better Eating Habits', emoji: '🥗' },
    { id: 'consistency', label: 'Improve Exercise Consistency', emoji: '📅' },
    { id: 'sedentary', label: 'Reduce Sedentary Time', emoji: '⏱️' },
    { id: 'habits', label: 'Build Healthy Daily Habits', emoji: '✨' },
    { id: 'overall', label: 'Improve Overall Wellbeing', emoji: '🌿' }
];
export const limitationOptions = [
    { id: 'none', label: 'No limitations', emoji: '✅' },
    { id: 'knee', label: 'Knee discomfort', emoji: '🦵' },
    { id: 'back', label: 'Back discomfort', emoji: '🧍' },
    { id: 'joint', label: 'Joint limitations', emoji: '🔧' },
    { id: 'mobility', label: 'Limited mobility', emoji: '♿' },
    { id: 'other', label: 'Other', emoji: '📝' }
];
export const dietOptions = [
    { id: 'veg', label: 'Vegetarian', emoji: '🥬' },
    { id: 'nonveg', label: 'Non-Vegetarian', emoji: '🍗' },
    { id: 'vegan', label: 'Vegan', emoji: '🌱' },
    { id: 'none', label: 'No Preference', emoji: '🍽️' }
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
    { id: 'activity', label: 'Activity', emoji: '🚶', current: 5240, total: 7000, unit: 'steps', color: '#F5811E' },
    { id: 'exercise', label: 'Exercise', emoji: '🏃', current: 20, total: 30, unit: 'min', color: '#7FB998' },
    { id: 'nutrition', label: 'Nutrition', emoji: '🥗', current: 2, total: 3, unit: 'meals', color: '#7CB8E8' },
    { id: 'habits', label: 'Habits', emoji: '✨', current: 4, total: 5, unit: 'done', color: '#B69CE0' }
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
export const workoutSteps = [
    { name: 'Warm-Up March', seconds: 120, cue: 'March on the spot, swing your arms gently.', emoji: '🚶' },
    { name: 'Bodyweight Squats', seconds: 120, cue: 'Feet shoulder-width. Sit back slowly, keep knees soft.', emoji: '🦵' },
    { name: 'Standing Knee Lifts', seconds: 120, cue: 'Lift one knee at a time to hip height. Stay controlled.', emoji: '🦿' },
    { name: 'Arm Circles', seconds: 120, cue: 'Big slow circles forward, then backward.', emoji: '💪' },
    { name: 'Side Steps', seconds: 120, cue: 'Step side to side, keep a light bounce.', emoji: '↔️' },
    { name: 'Cool-Down Stretch', seconds: 120, cue: 'Slow breathing, gentle hamstring and calf stretch.', emoji: '🧘' }
];
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
