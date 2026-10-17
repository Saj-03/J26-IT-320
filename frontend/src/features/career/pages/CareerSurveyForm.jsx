import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, WandSparklesIcon, LanguagesIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { Field, SelectField } from "../../../shared/components/ui/Field";
import { apiErrorMessage } from "../../../shared/api/client";
import { cn } from "../../../shared/lib/cn";
import { recommendCareers } from "../api/careerApi";
import { careerSession, surveyDraft, useCareerFlow } from "../utils/careerSession";
import { DEMO_PROFILE, EMPTY_PROFILE, FACULTY_CAREER_OPTIONS, OPTIONS, SKILLS } from "../constants";
import { ui } from "../theme";
import { getLanguage, t, useLanguage } from "../i18n";
import LanguageSwitcher from "../components/LanguageSwitcher";

const pretty = (name) => name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Dropdown bound to one profile field. Options come from constants.OPTIONS unless passed in.
// The option VALUE stays in English (the trained model was fitted on the English survey answers);
// only the visible text is translated.
function Select({ name, label, form, set, options = OPTIONS[name], placeholder = "Select…", disabled = false }) {
  return (
    <SelectField name={name} label={t(label || pretty(name))} value={form[name]}
      onChange={(e) => set(name, e.target.value)} required disabled={disabled}>
      <option value="" disabled>{t(placeholder)}</option>
      {options.map((o) => <option key={o} value={o}>{t(o)}</option>)}
    </SelectField>
  );
}

// 1-5 rating as a row of buttons.
function Rating({ label, value, onChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <span className="text-sm font-semibold text-charcoal-light">{t(label)}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${t(label)} ${n}`} aria-pressed={n === value}
            className={cn("w-9 h-9 rounded-xl text-sm font-bold transition-colors",
              n === value ? ui.choiceOn : ui.choiceOff, "border")}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// Select-all-that-apply chips. `selected` is an array of chosen options; `max` limits how many.
function Chips({ label, options, selected, onToggle, max }) {
  const full = max != null && selected.length >= max;
  return (
    <div className="sm:col-span-2">
      <p className="text-sm font-semibold text-charcoal-light mb-2">
        {t(label)}
        {max != null && (
          <span className={cn("ml-2 text-xs font-bold", full ? "text-[#1F5F53]" : "text-charcoal-muted")}>
            {t("{n} of {max} selected", { n: selected.length, max })}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((item) => {
          const on = selected.includes(item);
          return (
            <button key={item} type="button" onClick={() => onToggle(item)} aria-pressed={on}
              disabled={full && !on} title={full && !on ? t("You can choose up to {max}", { max }) : undefined}
              className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold border transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed", on ? ui.choiceOn : ui.choiceOff)}>
              {t(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const toggle = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
const toList = (text) => (text ? text.split(", ").filter(Boolean) : []);

function SectionTitle({ number, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="w-8 h-8 rounded-full bg-[#9ADBCC] text-[#12352E] text-sm font-extrabold flex items-center justify-center shrink-0">
        {number}
      </span>
      <div>
        <h3 className="font-bold text-charcoal leading-tight">{t(title)}</h3>
        {subtitle && <p className="text-xs text-charcoal-muted">{t(subtitle)}</p>}
      </div>
    </div>
  );
}

function Section({ number, title, children }) {
  return (
    <Card padding="lg">
      <SectionTitle number={number} title={title} />
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </Card>
  );
}

// Questions that must be answered before submitting (used for the progress bar).
const REQUIRED_FIELDS = ["academic_status", "employment_status", "faculty_field", "degree_programme", "academic_performance_trend", "career_area_interest", "preferred_career_role", "previous_career_preference", "preferred_learning_method", "skill_learning_consistency", "extracurricular_participation", "career_related_work_status"];

export default function CareerSurveyForm() {
  useLanguage(); // re-render when the language changes
  const navigate = useNavigate();
  // An unfinished draft wins over the last submitted profile, so a refresh never loses answers.
  const [form, setForm] = useState(() => surveyDraft.get() || careerSession.get().profile || EMPTY_PROFILE);
  const { flow: saved, ready } = useCareerFlow();
  // Show the student's saved answers once they load (only if they have not started typing).
  useEffect(() => {
    if (ready && saved.profile) setForm((current) => (current === EMPTY_PROFILE ? saved.profile : current));
  }, [ready, saved.profile]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demoFilled, setDemoFilled] = useState(false);
  useEffect(() => {
    if (form === EMPTY_PROFILE) surveyDraft.clear(); // e.g. "Clear demo profile"
    else surveyDraft.save(form);
  }, [form]);

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  // First click fills the demo profile; second click resets the whole form (even after manual edits).
  const toggleDemo = () => {
    setForm(demoFilled ? EMPTY_PROFILE : DEMO_PROFILE);
    setDemoFilled(!demoFilled);
  };
  // Faculty controls the career dropdowns: changing it clears the previous area and role.
  const setFaculty = (_, faculty) =>
    setForm((f) => ({ ...f, faculty_field: faculty, career_area_interest: "", preferred_career_role: "" }));
  const facultyOptions = FACULTY_CAREER_OPTIONS[form.faculty_field];
  const setSkill = (key, value) => setForm((f) => ({ ...f, skills: { ...f.skills, [key]: value } }));
  // Multi-select answers are stored as "A, B, C" strings, like the survey export.
  const toggleText = (name) => (item) => set(name, toggle(toList(form[name]), item).join(", "));
  const joins = form.extracurricular_participation === "Yes";
  const answered = REQUIRED_FIELDS.filter((f) => String(form[f] ?? "").trim()).length;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Students who do not take part in activities have no activity types or roles.
      const profile = joins ? form : { ...form, extracurricular_type: "", highest_extracurricular_role: "" };
      const result = await recommendCareers({ ...profile, student_id: form.student_id || null });
      // A new profile invalidates any earlier gap analysis / roadmap.
      careerSession.update({ profile, recommendations: result.recommendations, persona: result.persona,
                             selectedCareer: null, gapAnalysis: null, roadmap: null, roadmapProgress: null,
                             language: getLanguage() });
      surveyDraft.clear();
      navigate("/app/career/recommendations");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CareerPage className="max-w-3xl mx-auto" step="profile">
      <PageHeader
        title={t("Career Profile Survey")}
        subtitle={t("Your answers are used only to recommend careers and build your development roadmap.")}
        action={
          <Button variant="outline" onClick={toggleDemo}>
            <WandSparklesIcon size={16} /> {demoFilled ? t("Clear demo profile") : t("Fill demo profile")}
          </Button>
        }
      />

      {/* Language first: every following page (results, roadmap, interview) uses the chosen language. */}
      <Card padding="lg" className="space-y-3 border-2 border-[#9ADBCC]">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-[#C7F2D1] text-[#1F5F53] flex items-center justify-center shrink-0">
            <LanguagesIcon size={20} />
          </span>
          <div>
            <h2 className="font-extrabold text-charcoal">
              Choose your language <span className="text-charcoal-muted font-bold">· භාෂාව තෝරන්න · மொழியைத் தேர்ந்தெடுக்கவும்</span>
            </h2>
            <p className="text-xs text-charcoal-muted">
              {t("Your results, roadmap and interview feedback will be shown in this language. You can change it any time at the top of each page.")}
            </p>
          </div>
        </div>
        <LanguageSwitcher large />
      </Card>

      {/* Completion bar */}
      <div className="rounded-2xl bg-white/70 border border-[#9ADBCC]/50 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-[#E3FFD6] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#9ADBCC] to-[#5DBFA9] transition-all duration-500"
            style={{ width: `${(answered / REQUIRED_FIELDS.length) * 100}%` }} />
        </div>
        <span className="text-xs font-bold text-[#1F5F53] whitespace-nowrap">
          {t("{n} of {total} answered", { n: answered, total: REQUIRED_FIELDS.length })}
        </span>
        <span className="hidden sm:inline text-[11px] text-charcoal-muted whitespace-nowrap">· {t("answers kept if you refresh")}</span>
      </div>

      <form className="space-y-5" onSubmit={submit}>
        <Section number={1} title="Academic details">
          <Select name="academic_status" form={form} set={set} />
          <Select name="employment_status" form={form} set={set} />
          <Select name="faculty_field" label="Faculty / field" form={form} set={setFaculty} />
          <Field name="degree_programme" label={t("Degree programme")} value={form.degree_programme}
            onChange={(e) => set("degree_programme", e.target.value)} placeholder={t("e.g. Information Technology")} required />
          <Select name="academic_performance_trend" label="Academic performance trend" form={form} set={set} />
        </Section>

        <Section number={2} title="Career details">
          <p className="sm:col-span-2 text-xs text-charcoal-muted -mb-2">
            {t("Career options are filtered based on your selected faculty field.")}
          </p>
          <Select name="career_area_interest" label="Career area of interest" form={form} set={set}
            options={facultyOptions?.careerAreas || []} disabled={!facultyOptions}
            placeholder={facultyOptions ? "Select…" : "Select faculty first"} />
          <Select name="preferred_career_role" label="Preferred career role" form={form} set={set}
            options={facultyOptions?.roles || []} disabled={!facultyOptions}
            placeholder={facultyOptions ? "Select…" : "Select faculty first"} />
          <Select name="previous_career_preference" label="Did you prefer a different career before?" form={form} set={set} />
          <div className="sm:col-span-2">
            <Rating label="Confidence in your career choice (1–5)" value={form.career_confidence}
              onChange={(v) => set("career_confidence", v)} />
          </div>
        </Section>

        <Card padding="lg">
          <SectionTitle number={3} title="Skill self-rating" subtitle="1 = beginner, 5 = very strong." />
          <div className="space-y-3">
            {SKILLS.map((s) => (
              <Rating key={s.key} label={s.label} value={form.skills[s.key]} onChange={(v) => setSkill(s.key, v)} />
            ))}
          </div>
        </Card>

        <Section number={4} title="Learning details">
          <Select name="preferred_learning_method" form={form} set={set} />
          <Select name="skill_learning_consistency" label="How often do you learn new skills?" form={form} set={set} />
        </Section>

        <Section number={5} title="Extracurricular activities">
          <Select name="extracurricular_participation" label="Do you take part in extracurricular activities?" form={form} set={set} />
          {joins && (
            <>
              <Chips label="Which activities? (select all that apply)" options={OPTIONS.extracurricular_type}
                selected={toList(form.extracurricular_type)} onToggle={toggleText("extracurricular_type")} />
              <Chips label="Roles you have held (select all that apply)" options={OPTIONS.highest_extracurricular_role}
                selected={toList(form.highest_extracurricular_role)} onToggle={toggleText("highest_extracurricular_role")} />
            </>
          )}
        </Section>

        <Section number={6} title="Career readiness">
          <Select name="career_related_work_status" label="Completed career-related courses, projects or work?" form={form} set={set} />
          <Chips label="Type of career-related work (select all that apply)" options={OPTIONS.career_related_work_type}
            selected={toList(form.career_related_work_type)} onToggle={toggleText("career_related_work_type")} />
          <Chips label="What support do you need? (up to 3)" options={OPTIONS.career_support_needed}
            selected={form.career_support_needed} max={3}
            onToggle={(item) => set("career_support_needed", toggle(form.career_support_needed, item))} />
        </Section>

        {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}
        <Button type="submit" size="lg" fullWidth disabled={busy}>
          {busy ? t("Finding your best careers…") : t("Get my career recommendations")} <ArrowRightIcon size={18} />
        </Button>
      </form>
    </CareerPage>
  );
}
