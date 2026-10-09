// All HTTP calls for this feature -> /api/physical
import api from "../../shared/api/client";


export const saveProfile = (p) => api.post("/physical/profile", p);
export const logActivity = (a) => api.post("/physical/activity", a);
export const addHabit = (name) => api.post("/physical/habits", { name });
export const habitDone = (id) => api.post(`/physical/habits/${id}/done`).then((r) => r.data);
