// All HTTP calls for the ACRDS MVP -> /api/career
// Uses the shared axios client (base URL from VITE_API_URL, default http://localhost:8000/api).
import api from "../../../shared/api/client";

const data = (r) => r.data;

export const health = () => api.get("/career/health").then(data);
export const getCareers = () => api.get("/career/careers").then(data);
export const getCareer = (careerId) => api.get(`/career/careers/${encodeURIComponent(careerId)}`).then(data);

/** profileData: StudentCareerProfile -> { student_id, recommendations: [...top 5] } */
export const recommendCareers = (profileData) => api.post("/career/recommend-careers", profileData).then(data);

/** payload: { career_id, profile } */
export const getGapAnalysis = (payload) => api.post("/career/gap-analysis", payload).then(data);

/** payload: { career_id, profile } */
export const generateRoadmap = (payload) => api.post("/career/roadmap", payload).then(data);

// ---- AI Interview Simulator ----
/** -> { career_id, career_name, variant, questions: [{ id, category, question, tip }], privacy_notes } */
export const getInterviewQuestions = (careerId, variant = 0) =>
  api.get(`/career/interview/questions/${encodeURIComponent(careerId)}`, { params: { variant } }).then(data);

/** payload: { career_id, question_id, answer_text, mode, speaking_seconds?, face_presence_ratio?, facing_camera_ratio?, frames_analyzed? } */
export const evaluateInterviewAnswer = (payload) => api.post("/career/interview/evaluate", payload).then(data);

/** payload: { career_id, results: [{ category, overall_score, content_score, delivery_score?, presentation_score?, improvements }] } */
export const getInterviewReport = (payload) => api.post("/career/interview/report", payload).then(data);
