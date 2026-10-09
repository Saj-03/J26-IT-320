// All HTTP calls for this feature -> /api/scheduler
import api from "../../shared/api/client";


export const addTask = (task) => api.post("/scheduler/tasks", task);
export const completeTask = (id) => api.post(`/scheduler/tasks/${id}/complete`);
export const logFocus = (s) => api.post("/scheduler/focus", s);
export const requestAdaptation = () => api.post("/scheduler/adapt").then((r) => r.data);
export const decideChange = (id, decision) => api.post(`/scheduler/changes/${id}/decision`, { decision });
