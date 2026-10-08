// Shared constants for the ACRDS career feature.

// Same order as the backend SKILL_KEYS.
export const SKILLS = [
  { key: "digital_literacy", label: "Digital literacy" },
  { key: "communication", label: "Communication" },
  { key: "problem_solving", label: "Problem solving" },
  { key: "leadership", label: "Leadership" },
  { key: "teamwork", label: "Teamwork" },
  { key: "research", label: "Research" },
  { key: "data_analysis", label: "Data analysis" },
  { key: "documentation", label: "Documentation" },
  { key: "creativity", label: "Creativity" },
];

const LABELS = Object.fromEntries(SKILLS.map((s) => [s.key, s.label]));
export const skillLabel = (key) => LABELS[key] || key.replace(/_/g, " ");

export const OPTIONS = {
  academic_status: ["1st Year Undergraduate", "2nd Year Undergraduate", "3rd Year Undergraduate", "4th Year Undergraduate", "Graduate"],
  employment_status: ["Not employed", "Intern/Trainee", "Part-time", "Full-time"],
  faculty_field: ["Computing", "Engineering", "Business", "Science", "Humanities", "Other"],
  academic_performance_trend: ["Improving", "Stable", "Declining"],
  career_area_interest: [
    "Technology/Software", "Data/Analytics", "Business/Management", "Design/Creative",
    "Security/Networking", "Marketing/Communication", "Not sure yet",
  ],
  preferred_career_role: [
    "Software Engineer", "Data Analyst", "Business Analyst", "UI/UX Designer", "QA Engineer",
    "Cybersecurity Analyst", "Network Engineer", "Database Administrator", "Project Manager",
    "Digital Marketing Executive", "Not sure yet",
  ],
  previous_career_preference: ["Yes", "No"],
  preferred_learning_method: ["Practising with projects", "Online courses", "Videos/Tutorials", "Reading", "Mentoring"],
  skill_learning_consistency: ["Daily", "Weekly", "Monthly", "Rarely"],
  extracurricular_participation: ["Yes", "No"],
  extracurricular_type: ["Technical communities", "Sports", "Arts/Cultural", "Volunteering", "Student union/Societies", "None"],
  highest_extracurricular_role: ["None", "Member", "Committee member", "Team lead", "President/Captain"],
  career_related_work_status: ["Not yet", "Planning to start", "Currently following/working on one", "Completed one"],
  career_related_work_type: ["None", "Academic project", "Internship", "Freelance", "Part-time job", "Personal project"],
  career_support_needed: [
    "Career recommendation", "Skill gap analysis", "Career roadmap", "Interview preparation", "CV/Portfolio guidance",
  ],
};

// Demo profile used in the viva (same as the Swagger sample).
export const DEMO_PROFILE = {
  student_id: "demo-student",
  academic_status: "4th Year Undergraduate",
  employment_status: "Intern/Trainee",
  faculty_field: "Computing",
  degree_programme: "Information Technology",
  academic_performance_trend: "Stable",
  career_area_interest: "Technology/Software",
  preferred_career_role: "Software Engineer",
  career_confidence: 4,
  previous_career_preference: "No",
  skills: {
    digital_literacy: 4, communication: 3, problem_solving: 4, leadership: 3, teamwork: 4,
    research: 3, data_analysis: 2, documentation: 3, creativity: 3,
  },
  preferred_learning_method: "Practising with projects",
  skill_learning_consistency: "Weekly",
  extracurricular_participation: "Yes",
  extracurricular_type: "Technical communities",
  highest_extracurricular_role: "Member",
  career_related_work_status: "Currently following/working on one",
  career_related_work_type: "Academic project",
  career_support_needed: ["Career recommendation", "Skill gap analysis", "Career roadmap"],
};

export const EMPTY_PROFILE = {
  student_id: "",
  academic_status: "", employment_status: "", faculty_field: "", degree_programme: "",
  academic_performance_trend: "", career_area_interest: "", preferred_career_role: "",
  career_confidence: 3, previous_career_preference: "",
  skills: Object.fromEntries(SKILLS.map((s) => [s.key, 3])),
  preferred_learning_method: "", skill_learning_consistency: "",
  extracurricular_participation: "", extracurricular_type: "", highest_extracurricular_role: "",
  career_related_work_status: "", career_related_work_type: "", career_support_needed: [],
};

export const ETHICS_NOTES = [
  "Interview practice feedback is advisory.",
  "Raw audio/video will not be stored.",
  "Facial presence refers only to observable presentation cues, not personality or emotion detection.",
];
