// CV Builder data: empty CV, survey prefill, suggestions, validation and display helpers.
// The CV itself is written in English (the language employers in Sri Lanka expect); only the builder UI is translated.
import { SKILLS } from "../constants";

export const TEMPLATES = ["modern", "ats", "creative"];

export const newEducation = () => ({ institution: "", degree: "", field: "", start: "", end: "", current: false, gpa: "", achievements: "" });
export const newExperience = () => ({ company: "", position: "", start: "", end: "", current: false, responsibilities: "", achievements: "" });
export const newProject = () => ({ title: "", description: "", technologies: "", link: "" });
export const newCertification = () => ({ name: "", issuer: "", date: "" });
export const newActivity = () => ({ role: "", organisation: "", description: "" });
export const NEW_ENTRY = {
  education: newEducation, experience: newExperience, projects: newProject,
  certifications: newCertification, activities: newActivity,
};

export function emptyCV() {
  return {
    template: "modern", career_id: null,
    personal: { full_name: "", headline: "", email: "", phone: "", location: "", linkedin: "", website: "" },
    summary: "", education: [], technical_skills: [], soft_skills: [],
    experience: [], projects: [], certifications: [], activities: [],
  };
}

// English names of the 9 survey skills (the CV is in English even when the UI is Sinhala/Tamil).
const SKILL_NAME_EN = {
  digital_literacy: "Digital literacy", communication: "Communication", problem_solving: "Problem solving",
  leadership: "Leadership", teamwork: "Teamwork", research: "Research", data_analysis: "Data analysis",
  documentation: "Documentation", creativity: "Creativity",
};
const CREATIVE_FACULTIES = ["Design/Creative Studies", "Arts/Humanities"];
const list = (text) => String(text || "").split(",").map((s) => s.trim()).filter(Boolean);

/** Template that suits the student's faculty (only a suggestion; the student can pick any). */
export const recommendedTemplate = (profile) => (CREATIVE_FACULTIES.includes(profile?.faculty_field) ? "creative" : "modern");

/**
 * Start a CV from the career survey. Only facts the student gave are filled in (degree, faculty, the career they chose);
 * nothing is invented. Self-rated skills, career tools and activities are returned as SUGGESTIONS the student must add.
 * `career` = full career record in English (GET /career/careers/{id}).
 */
export function prefillFromSurvey(flow, career) {
  const profile = flow?.profile;
  const cv = emptyCV();
  const prefilled = [];
  if (career) {
    cv.career_id = career.career_id;
    cv.personal.headline = `Aspiring ${career.career_name}`;
    prefilled.push("headline");
  }
  if (profile) {
    cv.template = recommendedTemplate(profile);
    if (profile.degree_programme || profile.faculty_field) {
      const studying = /undergraduate|year|student/i.test(profile.academic_status || "");
      cv.education.push({ ...newEducation(), degree: profile.degree_programme || "", field: profile.faculty_field || "", current: studying });
      prefilled.push("education.0");
    }
  }
  return { cv, prefilled, suggestions: surveySuggestions(flow, career) };
}

/** Things the survey suggests, never added automatically (a self-rating is not a verified qualification). */
export function surveySuggestions(flow, career) {
  const profile = flow?.profile;
  const skills = profile?.skills || {};
  const softSkills = SKILLS.map((x) => x.key).filter((k) => skills[k] >= 4).map((k) => SKILL_NAME_EN[k]);
  const tools = career?.required_tools || flow?.roadmap?.milestones?.find((m) => m.id === "tools")?.items || [];
  const types = list(profile?.extracurricular_type);
  const role = types.length === 1 ? (profile?.highest_extracurricular_role || "").split(",")[0].trim() : "";
  const activities = profile?.extracurricular_participation === "Yes"
    ? types.map((type) => ({ ...newActivity(), role, organisation: type })) : [];
  return {
    softSkills,                                   // rated 4-5/5 by the student
    tools,                                        // what the chosen career uses: add only if really used
    activities,
    workTypes: list(profile?.career_related_work_type), // shown as a hint for experience / projects
    careerName: career?.career_name || "",
  };
}

// ---------------------------------------------------------------------------
// Validation (same rules as the backend schema). Saving needs valid formats; download also needs name + email.
// ---------------------------------------------------------------------------
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^[0-9+()\-\s]{6,25}$/;
const isLink = (v) => !v || (!/\s/.test(v) && v.includes("."));

export function validateCV(cv, { forDownload = false } = {}) {
  const e = {};
  const p = cv.personal;
  if (forDownload && !p.full_name.trim()) e["personal.full_name"] = "Enter your full name.";
  if (forDownload && !p.email.trim()) e["personal.email"] = "Enter your email address.";
  if (p.email.trim() && !EMAIL.test(p.email.trim())) e["personal.email"] = "Enter a valid email address.";
  if (p.phone.trim() && !PHONE.test(p.phone.trim())) e["personal.phone"] = "Enter a valid phone number.";
  if (!isLink(p.linkedin.trim())) e["personal.linkedin"] = "Enter a valid link.";
  if (!isLink(p.website.trim())) e["personal.website"] = "Enter a valid link.";
  for (const section of ["education", "experience"]) {
    cv[section].forEach((item, i) => {
      if (item.start && item.end && !item.current && item.end < item.start) e[`${section}.${i}.end`] = "The end date is before the start date.";
    });
  }
  cv.projects.forEach((item, i) => {
    if (!isLink(item.link.trim())) e[`projects.${i}.link`] = "Enter a valid link.";
  });
  return e;
}

/** Copy without UI-only fields, ready for PUT /career/me/cv. */
export const cvForSave = (cv) => {
  const { _prefilled, ...rest } = cv;
  return rest;
};

// ---------------------------------------------------------------------------
// Display helpers used by the templates
// ---------------------------------------------------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const formatMonth = (value) => {
  const m = /^(\d{4})-(\d{2})$/.exec(value || "");
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
};
export const dateRange = ({ start, end, current }) => {
  const from = formatMonth(start);
  const to = current ? "Present" : formatMonth(end);
  return from && to ? `${from} – ${to}` : from || to;
};
/** "line one\n- line two" -> ["line one", "line two"] (leading -, •, * removed). */
export const toLines = (text) =>
  String(text || "").split(/\r?\n/).map((l) => l.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean);
export const linkLabel = (url) => String(url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
export const linkHref = (url) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
export const hasText = (obj) => Object.values(obj).some((v) => typeof v === "string" && v.trim());
