// All HTTP calls for this feature -> /api/physical
import api, { tokenStore } from "../../shared/api/client";
export { api, tokenStore };


export const saveProfile = (p) => api.post("/physical/profile", p);
export const getProfile = () => api.get("/physical/profile").then((r) => r.data);
export const getRecommendations = (isExamPeriod = false, useBaseline = false) =>
    api.get("/physical/recommendations", { params: { is_exam_period: isExamPeriod, use_baseline: useBaseline } }).then((r) => r.data);
export const getWeekPlan = (isExamPeriod = false, useBaseline = false, daysCount = 7) =>
    api.get("/physical/week-plan", { params: { is_exam_period: isExamPeriod, use_baseline: useBaseline, days_count: daysCount } }).then((r) => r.data);
export const getWeekPlanHistory = () => api.get("/physical/week-plan/history").then((r) => r.data);
export const getWeekPlanSnapshot = (id) => api.get(`/physical/week-plan/history/${id}`).then((r) => r.data);
export const deleteWeekPlanSnapshot = (id) => api.delete(`/physical/week-plan/history/${id}`).then((r) => r.data);
export const getPlanCheckins = (startDate, endDate) => api.get('/physical/plan-checkins', { params: { start_date: startDate, end_date: endDate } }).then((r) => r.data);
export const savePlanCheckin = (checkin) => api.put('/physical/plan-checkins', checkin).then((r) => r.data);
export const getFavorites = (itemType) => api.get('/physical/favorites', { params: itemType ? { item_type: itemType } : {} }).then((r) => r.data);
export const addFavorite = (itemType, item) => api.put('/physical/favorites', { item_type: itemType, item }).then((r) => r.data);
export const removeFavorite = (itemType, itemName) => api.delete('/physical/favorites', { params: { item_type: itemType, item_name: itemName } }).then((r) => r.data);
export const updatePlanDuration = (daysCount) => api.put('/physical/profile/plan-duration', { days_count: daysCount }).then((r) => r.data);
export const getActivitySummary = () => api.get("/physical/activity").then((r) => r.data);
export const logActivity = (a) => api.post("/physical/activity", a);
export const saveWorkoutFeedback = (feedback) => api.post("/physical/activity/workout-feedback", feedback).then((r) => r.data);
export const getHabits = () => api.get("/physical/habits").then((r) => r.data);
export const addHabit = (name) => api.post("/physical/habits", { name });
export const deleteHabit = (id) => api.delete(`/physical/habits/${id}`).then((r) => r.data);
export const habitDone = (id) => api.post(`/physical/habits/${id}/done`).then((r) => r.data);
export const getPeerChallenges = () => api.get('/physical/challenges').then((r) => r.data);
export const createPeerChallenge = (challenge) => api.post('/physical/challenges', challenge).then((r) => r.data);
export const deletePeerChallenge = (id) => api.delete(`/physical/challenges/${id}`).then((r) => r.data);
export const updatePeerChallengeScore = (id, amount) => api.post(`/physical/challenges/${id}/score`, { amount }).then((r) => r.data);
export const getInvitedChallenge = (code, token) => api.get(`/physical/challenges/invite/${encodeURIComponent(code)}`, {
  headers: token ? { 'X-Challenge-Token': token } : {},
}).then((r) => r.data);
export const joinInvitedChallenge = (code, nickname, token) => api.post(
  `/physical/challenges/invite/${encodeURIComponent(code)}/join`,
  { nickname },
  { headers: token ? { 'X-Challenge-Token': token } : {} },
).then((r) => r.data);
export const updateInvitedChallengeScore = (code, token, amount) => api.post(
  `/physical/challenges/invite/${encodeURIComponent(code)}/score`,
  { participant_token: token, amount },
).then((r) => r.data);
