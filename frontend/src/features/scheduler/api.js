// All HTTP calls for this feature -> /api/scheduler
import api from "../../shared/api/client";


export const addTask = (task) => api.post("/scheduler/tasks", task);
export const completeTask = (id) => api.post(`/scheduler/tasks/${id}/complete`);
export const logFocus = (s) => api.post("/scheduler/focus", s);
export const requestAdaptation = () => api.post("/scheduler/adapt").then((r) => r.data);
export const decideChange = (id, decision) => api.post(`/scheduler/changes/${id}/decision`, { decision });

// --- Tasks ---
export const listTasks = () => api.get("/scheduler/tasks").then((r) => r.data);
export const getTask = (id) => api.get(`/scheduler/tasks/${id}`).then((r) => r.data);

// --- Focus sessions (real timer flow) ---
// 1. suggestion -> 2. start -> 3. pause / resume -> 4. end (+ optional 1-5 rating) -> XP
export const getTimerRecommendation = () => api.get("/scheduler/focus/recommendation").then((r) => r.data);
export const getActiveFocus = () => api.get("/scheduler/focus/active").then((r) => r.data);     // null = none
export const startFocus = (body) => api.post("/scheduler/focus/start", body).then((r) => r.data);
export const pauseFocus = (id) => api.post(`/scheduler/focus/${id}/pause`).then((r) => r.data);
export const resumeFocus = (id) => api.post(`/scheduler/focus/${id}/resume`).then((r) => r.data);
export const endFocus = (id, rating) =>
  api.post(`/scheduler/focus/${id}/end`, rating ? { focus_rating: rating } : {}).then((r) => r.data);

// --- Stress adaptation (uses Component 4's wellbeing signal) ---
// status -> (propose) -> decide: accepted / edited (keep = positions) / rejected -> restore (undo)
export const getStressStatus = () => api.get("/scheduler/stress/status").then((r) => r.data);
export const getTaskSafety = () => api.get("/scheduler/stress/task-safety").then((r) => r.data);
export const listStressProposals = () => api.get("/scheduler/stress/proposals").then((r) => r.data);
export const proposeStressChanges = () => api.post("/scheduler/stress/propose").then((r) => r.data);
export const decideStressProposal = (id, decision, keep) =>
  api.post(`/scheduler/stress/proposals/${id}/decision`, keep ? { decision, keep } : { decision }).then((r) => r.data);
export const restoreStressProposal = (id) => api.post(`/scheduler/stress/proposals/${id}/restore`).then((r) => r.data);

// The backend sends UTC times without a "Z" (e.g. "2026-10-17T13:30:00").
// Add the "Z" so the browser does not read it as local time.
export const utcMs = (iso) => (iso ? Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`) : null);
