// All HTTP calls for this feature -> /api/physical
import api, { tokenStore } from "../../shared/api/client";
export { api, tokenStore };


export const saveProfile = (p) => api.post("/physical/profile", p);
export const getProfile = () => api.get("/physical/profile").then((r) => r.data);
export const getRecommendations = (isExamPeriod = false, useBaseline = false) =>
    api.get("/physical/recommendations", { params: { is_exam_period: isExamPeriod, use_baseline: useBaseline } }).then((r) => r.data);
export const getWeekPlan = (isExamPeriod = false, useBaseline = false, daysCount = 7) =>
    api.get("/physical/week-plan", { params: { is_exam_period: isExamPeriod, use_baseline: useBaseline, days_count: daysCount } }).then((r) => r.data);
export const getActivitySummary = () => api.get("/physical/activity").then((r) => r.data);
export const logActivity = (a) => api.post("/physical/activity", a);
export const saveWorkoutFeedback = (feedback) => api.post("/physical/activity/workout-feedback", feedback).then((r) => r.data);
export const getHabits = () => api.get("/physical/habits").then((r) => r.data);
export const addHabit = (name) => api.post("/physical/habits", { name });
export const deleteHabit = (id) => api.delete(`/physical/habits/${id}`).then((r) => r.data);
export const habitDone = (id) => api.post(`/physical/habits/${id}/done`).then((r) => r.data);
