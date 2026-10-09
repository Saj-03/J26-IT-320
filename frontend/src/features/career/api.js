// All HTTP calls for this feature -> /api/career
import api from "../../shared/api/client";


export const saveProfile = (p) => api.post("/career/profile", p);
export const evaluateAnswer = (a) => api.post("/career/interview/answer", a).then((r) => r.data);
