// Adaptive task breakdown & scheduling data — powers Schedule, Tasks and Focus.
export const focusStudent = {
    name: 'Awantha',
    stress: 'High',
    // [ITEM 2] Suggestion wording: the system suggests, the user decides
    stressMessage: 'We suggest a lighter plan for today. You decide what to change.'
};
export const loadStyles = {
    Heavy: { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500' },
    Medium: { bg: 'bg-amber-light', text: 'text-amber-700', dot: 'bg-amber-soft' },
    Light: { bg: 'bg-sage-light', text: 'text-emerald-700', dot: 'bg-sage' },
    Break: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400' }
};
export const stressStyles = {
    Low: { bg: 'bg-sage-light', border: 'border-emerald-100', text: 'text-emerald-700', dot: 'bg-sage' },
    Medium: { bg: 'bg-amber-light', border: 'border-amber-200/60', text: 'text-amber-700', dot: 'bg-amber-soft' },
    High: { bg: 'bg-brand-50', border: 'border-brand-100', text: 'text-brand-700', dot: 'bg-brand-500' }
};
export const todaySessions = [
    { id: 's1', start: '9:00 AM', end: '9:45 AM', title: 'Database Design', load: 'Heavy', day: 'Mon', status: 'todo' },
    { id: 's2', start: '10:00 AM', end: '10:30 AM', title: 'Recovery Break', load: 'Break', day: 'Mon', status: 'todo' },
    { id: 's3', start: '2:00 PM', end: '2:30 PM', title: 'Research Notes', load: 'Light', day: 'Mon', status: 'todo' }
];
export const subtasks = [
    { id: 'st1', order: 1, title: 'Read Requirements', load: 'Light', minutes: 20, status: 'done' },
    { id: 'st2', order: 2, title: 'Create ER Diagram', load: 'Heavy', minutes: 45, status: 'done' },
    { id: 'st3', order: 3, title: 'Design Database Tables', load: 'Heavy', minutes: 40, status: 'done' },
    { id: 'st4', order: 4, title: 'Write SQL Queries', load: 'Heavy', minutes: 60, status: 'active' },
    { id: 'st5', order: 5, title: 'Testing', load: 'Medium', minutes: 30, status: 'todo' },
    { id: 'st6', order: 6, title: 'Documentation', load: 'Medium', minutes: 30, status: 'todo' },
    { id: 'st7', order: 7, title: 'Final Review', load: 'Light', minutes: 20, status: 'todo' }
];
export const dependencyChain = [
    'Requirements',
    'ER Diagram',
    'Database Tables',
    'SQL Queries',
    'Testing'
];
export const attentionBands = [
    { range: '9 AM – 11 AM', level: 'High Attention', value: 92, load: 'Heavy' },
    { range: '11 AM – 1 PM', level: 'Medium Attention', value: 64, load: 'Medium' },
    { range: '2 PM – 4 PM', level: 'Medium Attention', value: 71, load: 'Medium' },
    { range: '4 PM – 6 PM', level: 'Low Attention', value: 42, load: 'Light' },
    { range: '7 PM – 9 PM', level: 'Low Attention', value: 30, load: 'Light' }
];
export const attentionCurve = [
    { label: '7a', value: 38 },
    { label: '9a', value: 88 },
    { label: '11a', value: 92 },
    { label: '1p', value: 55 },
    { label: '3p', value: 71 },
    { label: '5p', value: 48 },
    { label: '7p', value: 34 },
    { label: '9p', value: 24 }
];
export const matchingRules = [
    { load: 'Heavy', window: 'Peak Focus Time', example: '9 AM – 11 AM' },
    { load: 'Medium', window: 'Normal Focus Time', example: '2 PM – 4 PM' },
    { load: 'Light', window: 'Low Focus Time', example: '7 PM – 9 PM' }
];
export const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const weekSchedule = [
    { id: 'w1', day: 'Monday', start: '9:00', end: '9:45', title: 'Database Design', load: 'Heavy', status: 'done' },
    { id: 'w2', day: 'Monday', start: '10:00', end: '10:15', title: 'Break', load: 'Break', status: 'done' },
    { id: 'w3', day: 'Monday', start: '2:00', end: '2:30', title: 'Research Notes', load: 'Light', status: 'done' },
    { id: 'w4', day: 'Tuesday', start: '9:00', end: '10:00', title: 'SQL Development', load: 'Heavy', status: 'done' },
    { id: 'w5', day: 'Tuesday', start: '2:00', end: '2:30', title: 'Testing', load: 'Medium', status: 'done' },
    { id: 'w6', day: 'Wednesday', start: '9:00', end: '10:00', title: 'SQL Development', load: 'Heavy', status: 'missed' },
    { id: 'w7', day: 'Wednesday', start: '2:00', end: '2:30', title: 'Documentation', load: 'Medium', status: 'done' },
    { id: 'w8', day: 'Thursday', start: '9:00', end: '10:00', title: 'SQL Development', load: 'Heavy', status: 'todo' },
    { id: 'w9', day: 'Thursday', start: '2:00', end: '2:30', title: 'Testing', load: 'Medium', status: 'todo' },
    { id: 'w10', day: 'Friday', start: '9:00', end: '9:40', title: 'Final Review', load: 'Light', status: 'todo' }
];
// [ITEM 2] STRESS SUGGESTIONS
// The system only SUGGESTS changes. Each change has a short reason and the user accepts / edits / rejects it.
// Tasks due within `protectDays` days are "Protected - due soon" and are never moved.
export const stressSuggestion = {
    protectDays: 2,
    // Today's original plan (what the user planned)
    original: [
        { id: 'p1', time: '9:00 – 11:00', title: 'Programming', load: 'Heavy', dueInDays: 5 },
        { id: 'p2', time: '11:30 – 12:30', title: 'SQL Queries', load: 'Heavy', dueInDays: 1 },
        { id: 'p3', time: '2:00 – 3:00', title: 'Research', load: 'Medium', dueInDays: 4 },
        { id: 'p4', time: '4:00 – 5:00', title: 'Testing', load: 'Medium', dueInDays: 4 }
    ],
    // Suggested changes. taskId = which task it changes (null = something new, like a break)
    changes: [
        { id: 'c1', taskId: 'p1', title: 'Programming', from: '9:00 – 11:00', to: '9:00 – 10:00', reason: 'Shortened to 1 hour - long heavy blocks are harder on a stressful day' },
        { id: 'c2', taskId: null, title: 'Recovery Break', from: null, to: '10:00 – 10:30', reason: 'New 30 min break - a short rest helps lower stress' },
        { id: 'c3', taskId: 'p2', title: 'SQL Queries', from: 'Today 11:30', to: 'Tomorrow 9:00', reason: 'Move to tomorrow to free up the morning' },
        { id: 'c4', taskId: 'p3', title: 'Research', from: '2:00 – 3:00', to: '2:00 – 2:30', reason: 'Made lighter - only reading notes today' },
        { id: 'c5', taskId: 'p4', title: 'Testing', from: 'Today 4:00', to: 'Tomorrow 2:00', reason: 'Testing moved to tomorrow - not due until Monday' }
    ]
};
export const missedSession = {
    missed: { day: 'Wednesday', time: '9:00 AM', title: 'SQL Development' },
    newTime: { day: 'Thursday', time: '9:00 AM' },
    secondary: 'Testing moved to Thursday 2:00 PM.',
    alternatives: [
        { day: 'Thursday', time: '9:00 AM', note: 'Your peak focus window', best: true },
        { day: 'Thursday', time: '2:00 PM', note: 'Normal focus window', best: false },
        { day: 'Friday', time: '9:00 AM', note: 'Closer to your deadline', best: false }
    ]
};
export const pomodoroRecommendation = {
    focus: 30,
    breakMins: 7,
    averageSession: 32,
    reason: 'Based on your recent focus history'
};
export const focusProgress = {
    completed: 8,
    total: 10,
    focusTime: '6h 40m',
    bestPeriod: '9 AM – 11 AM',
    averageSession: '31 minutes',
    rescheduled: 2,
    stressAdjustments: 3,
    insight: 'You complete heavy tasks 24% faster during morning sessions.'
};
export const weeklyCompleted = [
    { label: 'Mon', value: 3 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 1 },
    { label: 'Thu', value: 2 },
    { label: 'Fri', value: 0 },
    { label: 'Sat', value: 0 },
    { label: 'Sun', value: 0 }
];
export const weeklyFocusMinutes = [
    { label: 'Mon', value: 95 },
    { label: 'Tue', value: 120 },
    { label: 'Wed', value: 45 },
    { label: 'Thu', value: 80 },
    { label: 'Fri', value: 60 },
    { label: 'Sat', value: 0 },
    { label: 'Sun', value: 0 }
];
export const weeklyStress = [
    { label: 'Mon', value: 40 },
    { label: 'Tue', value: 52 },
    { label: 'Wed', value: 78 },
    { label: 'Thu', value: 66 },
    { label: 'Fri', value: 58 },
    { label: 'Sat', value: 30 },
    { label: 'Sun', value: 25 }
];
export const mainTask = {
    title: 'Database Assignment',
    description: 'Create ER diagram, database tables and SQL queries.',
    subject: 'Database Systems',
    deadline: 'Friday, 11:59 PM',
    priority: 'High',
    difficulty: 4,
    progress: 65,
    remaining: '2h 10m'
};
export const focusNotifications = [
    { id: 'fn1', emoji: '⏰', title: 'Your Database Design session starts in 10 minutes', body: '30 minutes · 9:00 AM', time: 'Just now', unread: true },
    { id: 'fn2', emoji: '🔄', title: 'You missed your SQL session', body: 'We moved it to Thursday morning.', time: '2h ago', unread: true },
    { id: 'fn3', emoji: '🌿', title: 'Your stress level is high', body: 'We suggest a lighter plan for today.', time: '5h ago', unread: false },
    { id: 'fn4', emoji: '🌅', title: 'You usually focus best around 9 AM', body: 'We scheduled your difficult task there.', time: 'Yesterday', unread: false }
];
