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

// Answer options match the real ACRDS survey, because the trained model
// was fitted on those exact answers (see backend career_features.py).
export const OPTIONS = {
  academic_status: ["1st Year Undergraduate", "2nd Year Undergraduate", "3rd Year Undergraduate", "4th Year Undergraduate", "Graduate"],
  employment_status: ["Unemployed", "Intern/Trainee", "Part-Time Employee", "Full-Time Employee", "Fresh Graduate"],
  faculty_field: [
    "Computing", "Engineering", "Science", "Business/Management", "Health Science/Medicine",
    "Design/Creative Studies", "Arts/Humanities", "Education", "Law", "Social Sciences", "Other",
  ],
  academic_performance_trend: ["Improving", "Stable", "Declining", "Not sure/Too early to tell"],
  // Career areas of the ACRDS catalogue (used for the interest bonus).
  career_area_interest: [
    "Technology/Software", "Data/Analytics", "Business/Management", "Design/Creative",
    "Security/Networking", "Marketing/Communication", "Not sure yet",
  ],
  preferred_career_role: [
    "Software Engineer", "Data Analyst", "Business Analyst", "UI/UX Designer", "QA Engineer",
    "Cybersecurity Analyst", "Network Engineer", "Database Administrator", "Project Manager",
    "Digital Marketing Executive", "Not sure yet",
  ],
  previous_career_preference: ["Yes", "No", "Not Sure"],
  preferred_learning_method: [
    "Practising with projects", "Watching Videos", "Reading notes/ articles", "Group discussions",
    "Practical/laboratory work", "Lecturer guidance", "Trial and Error", "Online courses",
  ],
  skill_learning_consistency: ["Daily", "Weekly", "Monthly", "Rarely", "Never"],
  extracurricular_participation: ["Yes", "No"],
  // Select-all-that-apply questions (stored as a comma-separated string)
  extracurricular_type: [
    "Clubs and societies", "Sports", "Volunteering", "Competition", "Student leadership",
    "Media/Content Creation", "Religious/social service activities", "Academic societies",
    "Debating/Public Speaking", "Performing arts", "Technical communities",
  ],
  highest_extracurricular_role: [
    "Member", "Active Member", "Volunteer", "Committee member", "Organiser", "Coordinator",
    "Secretary/Treasurer", "Team leader", "President/Captain",
  ],
  career_related_work_status: ["No", "Planning to start", "Currently following/working on one", "Yes"],
  career_related_work_type: [
    "Academic project", "Personal project", "Research project", "Volunteer work",
    "Technical / practical work", "Portfolio work", "Case study / report",
    "Laboratory / field work", "Business / entrepreneurship activity", "Internship",
  ],
  career_support_needed: [
    "Skill gap analysis", "Career recommendation", "Internship guidance", "Certification recommendations",
    "Interview practice", "Career roadmap", "Project ideas", "CV guidance", "Course recommendations",
    "Portfolio guidance", "Career change guidance",
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
