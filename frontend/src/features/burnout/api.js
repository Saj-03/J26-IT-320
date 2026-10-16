// All HTTP calls for this feature -> /api/burnout
import api from "../../shared/api/client";


export const sendMood = (mood) => api.post("/burnout/mood", { mood });
export const addJournal = (entry) => api.post("/burnout/journal", entry).then((r) => r.data);
export const sendChat = (message) => api.post("/burnout/chat", { message }).then((r) => r.data);
export const computeSignal = () => api.post("/burnout/signal/compute").then((r) => r.data);
export const getSummary = () => api.get("/burnout/signal/summary").then((r) => r.data);
export const runDemo = (scenario) => api.post(`/burnout/demo/${scenario}`).then((r) => r.data);
export const listJournal = (q = "") => api.get("/burnout/journal", { params: q ? { q } : {} }).then((r) => r.data);
export const deleteJournal = (id) => api.delete(`/burnout/journal/${id}`).then((r) => r.data);
export const getPreferences = () => api.get("/burnout/preferences").then((r) => r.data);
export const setPreferences = (p) => api.put("/burnout/preferences", p).then((r) => r.data);
export const deleteMyData = () => api.delete("/burnout/my-data").then((r) => r.data);
