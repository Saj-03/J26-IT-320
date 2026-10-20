// All HTTP calls for this feature -> /api/scheduler
import api from "../../shared/api/client";

// XP / streak / badges may have changed -> tell useProgress to reload (sidebar level etc.)
const progressChanged = (r) => {
  window.dispatchEvent(new Event("scheduler:progress"));
  return r.data;
};

// --- Tasks ---
export const listTasks = () => api.get("/scheduler/tasks").then((r) => r.data);
export const getTask = (id) => api.get(`/scheduler/tasks/${id}`).then((r) => r.data);     // + subtasks
export const createTask = (task) => api.post("/scheduler/tasks", task).then((r) => r.data);
export const updateTask = (id, changes) => api.patch(`/scheduler/tasks/${id}`, changes).then((r) => r.data);
export const deleteTask = (id) => api.delete(`/scheduler/tasks/${id}`);
export const getTaskDuration = (id) => api.get(`/scheduler/tasks/${id}/duration`).then((r) => r.data);   // M3
// FR-03: the task cut into steps that fit my focus length (GET = preview, POST = create them)
export const suggestSteps = (id) => api.get(`/scheduler/tasks/${id}/suggested-steps`).then((r) => r.data);
export const createSuggestedSteps = (id) => api.post(`/scheduler/tasks/${id}/suggested-steps`).then((r) => r.data);
export const finishTask = (id) => api.post(`/scheduler/tasks/${id}/complete`).then(progressChanged);  // done + XP

// --- Plan, free time, commitments ---
// "Plan my week" = CP-SAT scheduler (Module D): POST builds a new plan, GET reads the saved one
// Voice planner "Speak your day": paragraph -> editable cards (nothing saved) -> confirm saves + plans
export const previewBrainDump = (text) => api.post("/scheduler/brain-dump", { text }).then((r) => r.data);
export const confirmBrainDump = (body) => api.post("/scheduler/brain-dump/confirm", body).then((r) => r.data);
export const planMyWeek =() => api.post("/scheduler/plan").then((r) => r.data);
export const getPlan = () => api.get("/scheduler/plan").then((r) => r.data);
export const getRecovery = () => api.get("/scheduler/plan/recovery").then((r) => r.data);   // FR-09 missed -> preview
export const getAvailability = (days = 7) => api.get("/scheduler/availability", { params: { days } }).then((r) => r.data);
export const listCommitments = () => api.get("/scheduler/commitments").then((r) => r.data);
export const createCommitment = (item) => api.post("/scheduler/commitments", item).then((r) => r.data);
export const deleteCommitment = (id) => api.delete(`/scheduler/commitments/${id}`);
export const getConflicts = () => api.get("/scheduler/conflicts").then((r) => r.data);   // clashes + impossible deadlines
export const getProgress = () => api.get("/scheduler/progress").then((r) => r.data);

// --- Focus sessions (real timer flow) ---
// 1. suggestion -> 2. start -> 3. pause / resume -> 4. end (+ optional 1-5 rating) -> XP
export const getTimerRecommendation = () => api.get("/scheduler/focus/recommendation").then((r) => r.data);
export const getActiveFocus = () => api.get("/scheduler/focus/active").then((r) => r.data);     // null = none
export const startFocus = (body) => api.post("/scheduler/focus/start", body).then((r) => r.data);
export const pauseFocus = (id) => api.post(`/scheduler/focus/${id}/pause`).then((r) => r.data);
export const resumeFocus = (id) => api.post(`/scheduler/focus/${id}/resume`).then((r) => r.data);
export const endFocus = (id, rating) =>
  api.post(`/scheduler/focus/${id}/end`, rating ? { focus_rating: rating } : {}).then(progressChanged);

export const rateTimer = (id, rating) => api.post(`/scheduler/focus/${id}/timer-rating`, { rating }).then((r) => r.data);   // 1-5 usefulness

// FR-16: focus quality / habit drop note (GET), hide it for 7 days (POST)
export const getFocusAlert = () => api.get("/scheduler/focus/alert").then((r) => r.data);
export const dismissFocusAlert = (kind) => api.post("/scheduler/focus/alert/dismiss", { kind }).then((r) => r.data);

// --- Attention profile (M1 model): best / worst hours, capacity, chance per hour ---
// --- My scheduler settings (study hours, daily cap, timer, opt-outs) ---
export const getSchedulerSettings = () => api.get("/scheduler/settings").then((r) => r.data);
export const updateSchedulerSettings = (changes) => api.patch("/scheduler/settings", changes).then((r) => r.data);

export const getAttentionProfile = () => api.get("/scheduler/attention/profile").then((r) => r.data);

// --- Stress adaptation (uses Component 4's wellbeing signal) ---
// status -> (propose) -> decide: accepted / edited (keep = positions) / rejected -> restore (undo)
export const getStressStatus = () => api.get("/scheduler/stress/status").then((r) => r.data);
export const getTaskSafety = () => api.get("/scheduler/stress/task-safety").then((r) => r.data);
export const listStressProposals = () => api.get("/scheduler/stress/proposals").then((r) => r.data);
export const proposeStressChanges = () => api.post("/scheduler/stress/propose").then((r) => r.data);
export const decideStressProposal = (id, decision, keep) =>
  api.post(`/scheduler/stress/proposals/${id}/decision`, keep ? { decision, keep } : { decision }).then((r) => r.data);
export const rateStressProposal = (id, rating) => api.post(`/scheduler/stress/proposals/${id}/rating`, { rating }).then((r) => r.data);
export const restoreStressProposal = (id) => api.post(`/scheduler/stress/proposals/${id}/restore`).then((r) => r.data);

// The backend sends UTC times without a "Z" (e.g. "2026-10-17T13:30:00").
// Add the "Z" so the browser does not read it as local time.
export const utcMs = (iso) => (iso ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`) : null);
