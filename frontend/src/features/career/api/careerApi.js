// All HTTP calls for the ACRDS MVP -> /api/career
// Uses the shared axios client (base URL from VITE_API_URL, default http://localhost:8000/api).
import api from "../../../shared/api/client";
import { getLanguage } from "../i18n";

const data = (r) => r.data;
// Text language for the response (en | si | ta). Scores and rankings never depend on it.
const lang = (params = {}) => ({ params: { ...params, language: getLanguage() } });

export const health = () => api.get("/career/health").then(data);
export const getCareers = () => api.get("/career/careers", lang()).then(data);
export const getCareer = (careerId) => api.get(`/career/careers/${encodeURIComponent(careerId)}`).then(data);

/** profileData: StudentCareerProfile -> { student_id, recommendations: [...top 5] } */
export const recommendCareers = (profileData) => api.post("/career/recommend-careers", profileData, lang()).then(data);

/** payload: { career_id, profile } */
export const getGapAnalysis = (payload) => api.post("/career/gap-analysis", payload, lang()).then(data);

/** payload: { career_id, profile } */
export const generateRoadmap = (payload) => api.post("/career/roadmap", payload, lang()).then(data);

// ---- AI Interview Simulator ----
/** -> { career_id, career_name, variant, questions: [{ id, category, question, question_en, tip }], privacy_notes } */
export const getInterviewQuestions = (careerId, variant = 0) =>
  api.get(`/career/interview/questions/${encodeURIComponent(careerId)}`, lang({ variant })).then(data);

/** payload: { career_id, question_id, answer_text, mode, speaking_seconds?, face_presence_ratio?, facing_camera_ratio?, frames_analyzed? } */
export const evaluateInterviewAnswer = (payload) => api.post("/career/interview/evaluate", payload, lang()).then(data);

/** payload: { career_id, results: [{ category, overall_score, content_score, delivery_score?, presentation_score?, improvements }] } */
export const getInterviewReport = (payload) => api.post("/career/interview/report", payload, lang()).then(data);

/** Optional AI coach feedback (slow: called after the scores are shown). -> { llm_feedback } */
export const getCoachFeedback = (payload) =>
  api.post("/career/interview/coach-feedback", payload, { ...lang(), timeout: 75000 }).then(data); // backend: 2 attempts x 30 s

// ---- Saved progress (requires login; each student only sees their own data) ----
export const getSavedState = () => api.get("/career/me/state").then(data);           // -> { user_id, data, updated_at }
export const saveSavedState = (flow) => api.put("/career/me/state", { data: flow }).then(data);
export const clearSavedState = () => api.delete("/career/me/state");
export const saveInterviewReport = (careerId, report) =>
  api.post("/career/me/interviews", { career_id: careerId, report }).then(data);
export const getInterviewHistory = (limit = 5) => api.get("/career/me/interviews", { params: { limit } }).then(data);

// ---- CV Builder (login required; each student only reaches their own CV) ----
export const getMyCV = () => api.get("/career/me/cv").then(data);                    // -> { cv, updated_at }
export const saveMyCV = (cv) => api.put("/career/me/cv", cv).then(data);
export const deleteMyCV = () => api.delete("/career/me/cv");
/** Optional AI wording help. payload: { task: summary|experience|project|tailor, ...only the text for that task } */
export const cvAssist = (payload) => api.post("/career/cv/assist", payload, { timeout: 75000 }).then(data);
