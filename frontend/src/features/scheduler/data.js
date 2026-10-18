// Scheduler mock data has been REMOVED - every student page now reads the scheduler API (see api.js).
// Shared helpers (load / stress styles, greeting, time formatting) live in lib.js.
//
// Only the researcher page (pages/AdminResearch.jsx) still uses the two values below. It needs a
// researcher-only API (role system) to list participants and set their experiment mode - not built yet.

// Experiment modes the researcher can assign (labels for the dropdown)
export const schedulerModes = [
    { value: 'adaptive', label: 'Adaptive' },
    { value: 'static', label: 'Static baseline' }
];

// MOCK until the researcher API exists: which mode each pilot participant has
export const participantSchedulerMode = {
    'P-0142': 'adaptive',
    'P-0138': 'static',
    'P-0129': 'adaptive',
    'P-0121': 'static',
    'P-0117': 'adaptive',
    'P-0109': 'static'
};
