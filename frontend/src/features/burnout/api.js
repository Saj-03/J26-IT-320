// All HTTP calls for this feature -> /api/burnout
import api from "../../shared/api/client";


export const sendMood = (mood) => api.post("/burnout/mood", { mood });
export const addJournal = (entry) => api.post("/burnout/journal", entry).then((r) => r.data);
export const sendChat = (message) => api.post("/burnout/chat", { message }).then((r) => r.data);
export const computeSignal = () => api.post("/burnout/signal/compute").then((r) => r.data);
export const getSummary = () => api.get("/burnout/signal/summary").then((r) => r.data);
