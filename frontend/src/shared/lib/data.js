// Central sample data for the IHSD demo. Realistic student data for Awantha.
export const student = {
    name: 'Awantha',
    fullName: 'Awantha Perera',
    email: 'awantha.p@university.edu',
    university: 'University of Westford',
    degree: 'BSc Computer Science',
    year: '2nd Year',
    avatar: "/WhatsApp_Image_2026-07-22_at_07.48.59.jpg",
    level: 3,
    levelName: 'Scholar',
    xp: 2847,
    xpToNext: 3500,
    streak: 14,
    freezeTokens: 2
};
export const tasks = [
    {
        id: 't1',
        title: 'Chemistry Lab Report',
        subject: 'Chemistry',
        type: 'Lab Report',
        category: 'academic',
        priority: 'high',
        status: 'scheduled',
        durationMins: 120,
        deadline: 'Due Tomorrow',
        scheduledTime: '09:00',
        scheduledDay: 'Wed',
        difficulty: 4,
        focusRequired: 5
    },
    {
        id: 't2',
        title: 'Mathematics Problem Sheet',
        subject: 'Mathematics',
        type: 'Problem Sheet',
        category: 'academic',
        priority: 'medium',
        status: 'scheduled',
        durationMins: 90,
        deadline: 'Due Friday',
        scheduledTime: '14:00',
        scheduledDay: 'Wed',
        difficulty: 3,
        focusRequired: 4
    },
    {
        id: 't3',
        title: 'Group Presentation',
        subject: 'Business Studies',
        type: 'Presentation',
        category: 'academic',
        priority: 'high',
        status: 'scheduled',
        durationMins: 60,
        deadline: 'Due Thursday',
        scheduledTime: '11:00',
        scheduledDay: 'Thu',
        difficulty: 3,
        focusRequired: 3
    },
    {
        id: 't4',
        title: 'Software Engineering Assignment',
        subject: 'Computer Science',
        type: 'Assignment',
        category: 'academic',
        priority: 'medium',
        status: 'in-progress',
        durationMins: 150,
        deadline: 'Due Monday',
        scheduledTime: '10:00',
        scheduledDay: 'Fri',
        difficulty: 4,
        focusRequired: 5
    },
    {
        id: 't5',
        title: 'Career Development',
        subject: 'Personal Growth',
        type: 'Reading',
        category: 'career',
        priority: 'low',
        status: 'scheduled',
        durationMins: 30,
        deadline: 'This Week',
        scheduledTime: '17:00',
        scheduledDay: 'Wed',
        difficulty: 2,
        focusRequired: 2
    },
    {
        id: 't6',
        title: 'Sociology Essay',
        subject: 'Sociology',
        type: 'Essay',
        category: 'academic',
        priority: 'medium',
        status: 'overdue',
        durationMins: 120,
        deadline: 'Let’s get this back on track',
        difficulty: 3,
        focusRequired: 4
    },
    {
        id: 't7',
        title: 'Gym Session',
        subject: 'Wellbeing',
        type: 'Exercise',
        category: 'personal',
        priority: 'low',
        status: 'completed',
        durationMins: 60,
        deadline: 'Today',
        scheduledTime: '07:00',
        scheduledDay: 'Wed',
        difficulty: 1,
        focusRequired: 1
    },
    {
        id: 't8',
        title: 'Work Shift – Campus Cafe',
        subject: 'Work',
        type: 'Shift',
        category: 'work',
        priority: 'medium',
        status: 'completed',
        durationMins: 240,
        deadline: 'Yesterday',
        scheduledTime: '16:00',
        scheduledDay: 'Tue',
        difficulty: 2,
        focusRequired: 2
    }
];
export const todaySchedule = [
    {
        time: '09:00',
        title: 'Chemistry Lab Report',
        subtitle: 'Focus Session',
        duration: '2 hours',
        priority: 'high',
        category: 'academic'
    },
    {
        time: '12:00',
        title: 'Lunch & Recovery',
        subtitle: 'Restore your energy',
        duration: '45 minutes',
        priority: 'low',
        category: 'recovery'
    },
    {
        time: '14:00',
        title: 'Mathematics Problem Sheet',
        subtitle: 'Deep work',
        duration: '1 hour 30 minutes',
        priority: 'medium',
        category: 'academic'
    },
    {
        time: '17:00',
        title: 'Career Development',
        subtitle: 'Reading & reflection',
        duration: '30 minutes',
        priority: 'low',
        category: 'career'
    }
];
export const categoryStyles = {
    academic: { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500', ring: 'border-brand-200', label: 'Academic' },
    work: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', ring: 'border-slate-200', label: 'Work' },
    recovery: { bg: 'bg-sage-light', text: 'text-emerald-700', dot: 'bg-sage', ring: 'border-emerald-100', label: 'Recovery' },
    personal: { bg: 'bg-violet-50', text: 'text-violet-600', dot: 'bg-violet-400', ring: 'border-violet-100', label: 'Personal' },
    career: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400', ring: 'border-sky-100', label: 'Career' },
    social: { bg: 'bg-pink-50', text: 'text-pink-500', dot: 'bg-pink-400', ring: 'border-pink-100', label: 'Social' }
};
export const priorityStyles = {
    high: { bg: 'bg-brand-100', text: 'text-brand-700', label: 'High Priority' },
    medium: { bg: 'bg-amber-light', text: 'text-amber-700', label: 'Medium Priority' },
    low: { bg: 'bg-sage-light', text: 'text-emerald-700', label: 'Low Priority' }
};
export const weeklyTasksData = [
    { day: 'Mon', value: 6 },
    { day: 'Tue', value: 4 },
    { day: 'Wed', value: 7 },
    { day: 'Thu', value: 5 },
    { day: 'Fri', value: 8 },
    { day: 'Sat', value: 3 },
    { day: 'Sun', value: 2 }
];
export const focusTimeData = [
    { day: 'Mon', value: 3.2 },
    { day: 'Tue', value: 2.5 },
    { day: 'Wed', value: 3.4 },
    { day: 'Thu', value: 4.1 },
    { day: 'Fri', value: 4.6 },
    { day: 'Sat', value: 1.8 },
    { day: 'Sun', value: 1.2 }
];
export const stressData = [
    { day: 'Mon', value: 42 },
    { day: 'Tue', value: 55 },
    { day: 'Wed', value: 48 },
    { day: 'Thu', value: 68 },
    { day: 'Fri', value: 72 },
    { day: 'Sat', value: 38 },
    { day: 'Sun', value: 30 }
];
export const productivityByHour = [
    { hour: '6a', value: 20 },
    { hour: '8a', value: 55 },
    { hour: '9a', value: 88 },
    { hour: '10a', value: 92 },
    { hour: '11a', value: 85 },
    { hour: '12p', value: 60 },
    { hour: '2p', value: 74 },
    { hour: '4p', value: 66 },
    { hour: '6p', value: 48 },
    { hour: '8p', value: 32 },
    { hour: '10p', value: 18 }
];
export const badges = [
    { name: 'Deep Focus', icon: 'target', earned: true, desc: '10 distraction-free sessions' },
    { name: 'Comeback', icon: 'refresh', earned: true, desc: 'Recovered a broken streak' },
    { name: 'Early Bird', icon: 'sunrise', earned: true, desc: 'Studied before 8 AM 5 times' },
    { name: 'Deadline Master', icon: 'flag', earned: true, desc: 'Finished 10 tasks early' },
    { name: '7 Day Streak', icon: 'flame', earned: true, desc: 'A full week of momentum' },
    { name: 'Crisis Survivor', icon: 'shield', earned: false, desc: 'Balanced a high-pressure week' },
    { name: 'Focus Champion', icon: 'award', earned: false, desc: 'Average focus above 90%' },
    { name: 'Night Scholar', icon: 'moon', earned: false, desc: '20 evening study hours' }
];
export const challenges = [
    {
        title: 'Deep Focus Challenge',
        desc: 'Complete 3 distraction-free sessions',
        reward: 200,
        progress: 2,
        total: 3
    },
    {
        title: 'Early Finisher',
        desc: 'Complete 2 tasks at least 24 hours early',
        reward: 150,
        progress: 1,
        total: 2
    },
    {
        title: 'Balanced Week',
        desc: 'Complete a wellbeing check-in and protect personal time',
        reward: 200,
        progress: 0,
        total: 1
    }
];
export const careers = [
    {
        title: 'Software Engineer',
        match: 94,
        why: 'Your strongest results are in programming and problem solving, and you consistently complete technical assignments early.',
        skills: ['Data Structures', 'System Design', 'Testing'],
        strengths: ['Programming', 'Analytical Thinking'],
        develop: ['System Design', 'Communication']
    },
    {
        title: 'Data Scientist',
        match: 88,
        why: 'Strong analytical and mathematics performance paired with an interest in patterns and insight.',
        skills: ['Statistics', 'Python', 'ML Foundations'],
        strengths: ['Analytical Thinking', 'Mathematics'],
        develop: ['Statistics', 'Storytelling']
    },
    {
        title: 'UX Researcher',
        match: 79,
        why: 'You show curiosity about people and balance, with growing communication strength.',
        skills: ['Research Methods', 'Interviewing', 'Synthesis'],
        strengths: ['Creativity', 'Empathy'],
        develop: ['Research Methods', 'Presentation']
    },
    {
        title: 'Product Manager',
        match: 74,
        why: 'Balanced across leadership, communication and analytical skill — with clear goal orientation.',
        skills: ['Prioritisation', 'Communication', 'Strategy'],
        strengths: ['Leadership', 'Problem Solving'],
        develop: ['Strategy', 'Stakeholder Management']
    }
];
export const aptitudes = [
    { name: 'Analytical Thinking', value: 88, prev: 80 },
    { name: 'Programming', value: 92, prev: 78 },
    { name: 'Communication', value: 68, prev: 60 },
    { name: 'Creativity', value: 74, prev: 70 },
    { name: 'Problem Solving', value: 85, prev: 79 },
    { name: 'Leadership', value: 62, prev: 55 }
];
export const notifications = [
    { id: 'n1', category: 'Schedule', title: 'Your schedule was optimized', body: 'We reordered today around your peak focus hours.', time: '8m ago', unread: true, icon: 'calendar' },
    { id: 'n2', category: 'Focus', title: 'Your focus session starts in 10 minutes', body: 'Chemistry Lab Report · 9:00 AM', time: '20m ago', unread: true, icon: 'timer' },
    { id: 'n3', category: 'Wellbeing', title: 'Your schedule was lightened', body: 'We added more breathing room to give you space today.', time: '1h ago', unread: true, icon: 'heart' },
    { id: 'n4', category: 'Achievements', title: 'Great job! You earned 75 XP', body: 'Completed a distraction-free focus session.', time: '2h ago', unread: false, icon: 'trophy' },
    { id: 'n5', category: 'Schedule', title: 'Your Chemistry task is due tomorrow', body: 'It’s already scheduled for 9:00 AM — you’re on track.', time: '3h ago', unread: false, icon: 'calendar' },
    { id: 'n6', category: 'Wellbeing', title: 'Your weekly check-in is ready', body: 'Take a moment to reflect on your week.', time: 'Yesterday', unread: false, icon: 'heart' }
];
export const participants = [
    { id: 'P-0142', tasks: 128, focus: 84, trend: 'stable', active: '2m ago' },
    { id: 'P-0138', tasks: 96, focus: 71, trend: 'rising', active: '15m ago' },
    { id: 'P-0129', tasks: 154, focus: 90, trend: 'falling', active: '1h ago' },
    { id: 'P-0121', tasks: 63, focus: 66, trend: 'rising', active: '3h ago' },
    { id: 'P-0117', tasks: 111, focus: 79, trend: 'stable', active: 'Yesterday' },
    { id: 'P-0109', tasks: 88, focus: 74, trend: 'falling', active: 'Yesterday' }
];
