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
