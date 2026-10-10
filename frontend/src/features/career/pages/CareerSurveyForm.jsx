import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon, WandSparklesIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { Field, SelectField } from "../../../shared/components/ui/Field";
import { apiErrorMessage } from "../../../shared/api/client";
import { cn } from "../../../shared/lib/cn";
import { recommendCareers } from "../api/careerApi";
import { careerSession } from "../utils/careerSession";
import { DEMO_PROFILE, EMPTY_PROFILE, OPTIONS, SKILLS } from "../constants";
import { ui } from "../theme";

const pretty = (name) => name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Dropdown bound to one profile field; options come from constants.OPTIONS.
function Select({ name, label, form, set }) {
  return (
    <SelectField name={name} label={label || pretty(name)} value={form[name]}
      onChange={(e) => set(name, e.target.value)} required>
      <option value="" disabled>Select…</option>
      {OPTIONS[name].map((o) => <option key={o} value={o}>{o}</option>)}
    </SelectField>
  );
}

// 1-5 rating as a row of buttons.
function Rating({ label, value, onChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <span className="text-sm font-semibold text-charcoal-light">{label}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${label} ${n}`}
            className={cn("w-9 h-9 rounded-xl text-sm font-bold transition-colors",
              n === value ? ui.choiceOn : ui.choiceOff, "border")}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// Select-all-that-apply chips. `selected` is an array of chosen options.
function Chips({ label, options, selected, onToggle }) {
  return (
    <div className="sm:col-span-2">
      <p className="text-sm font-semibold text-charcoal-light mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((item) => (
          <button key={item} type="button" onClick={() => onToggle(item)}
            className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold border transition-colors",
              selected.includes(item) ? ui.choiceOn : ui.choiceOff)}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

const toggle = (list, item) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
const toList = (text) => (text ? text.split(", ").filter(Boolean) : []);

function Section({ title, children }) {
  return (
    <Card padding="lg">
      <h3 className="font-bold text-charcoal mb-4">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </Card>
  );
}

export default function CareerSurveyForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(() => careerSession.get().profile || EMPTY_PROFILE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const setSkill = (key, value) => setForm((f) => ({ ...f, skills: { ...f.skills, [key]: value } }));
  // Multi-select answers are stored as "A, B, C" strings, like the survey export.
  const toggleText = (name) => (item) => set(name, toggle(toList(form[name]), item).join(", "));
  const joins = form.extracurricular_participation === "Yes";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // Students who do not take part in activities have no activity types or roles.
      const profile = joins ? form : { ...form, extracurricular_type: "", highest_extracurricular_role: "" };
      const result = await recommendCareers({ ...profile, student_id: form.student_id || null });
      // A new profile invalidates any earlier gap analysis / roadmap.
      careerSession.update({ profile, recommendations: result.recommendations,
                             selectedCareer: null, gapAnalysis: null, roadmap: null });
      navigate("/app/career/recommendations");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CareerPage className="max-w-3xl mx-auto">
      <PageHeader
        title="Career Profile Survey"
        subtitle="Your answers are used only to recommend careers and build your development roadmap."
        action={
          <Button variant="outline" onClick={() => setForm(DEMO_PROFILE)}>
            <WandSparklesIcon size={16} /> Fill demo profile
          </Button>
        }
      />

      <form className="space-y-5" onSubmit={submit}>
        <Section title="Academic details">
          <Select name="academic_status" form={form} set={set} />
          <Select name="employment_status" form={form} set={set} />
          <Select name="faculty_field" label="Faculty / field" form={form} set={set} />
          <Field name="degree_programme" label="Degree programme" value={form.degree_programme}
            onChange={(e) => set("degree_programme", e.target.value)} placeholder="Information Technology" required />
          <Select name="academic_performance_trend" form={form} set={set} />
        </Section>

        <Section title="Career details">
          <Select name="career_area_interest" label="Career area of interest" form={form} set={set} />
          <Select name="preferred_career_role" form={form} set={set} />
          <Select name="previous_career_preference" label="Did you prefer a different career before?" form={form} set={set} />
          <div className="sm:col-span-2">
            <Rating label="Confidence in your career choice (1–5)" value={form.career_confidence}
              onChange={(v) => set("career_confidence", v)} />
          </div>
        </Section>

        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-1">Skill self-rating</h3>
          <p className="text-sm text-charcoal-muted mb-4">1 = beginner, 5 = very strong.</p>
          <div className="space-y-3">
            {SKILLS.map((s) => (
              <Rating key={s.key} label={s.label} value={form.skills[s.key]} onChange={(v) => setSkill(s.key, v)} />
            ))}
          </div>
        </Card>

        <Section title="Learning details">
          <Select name="preferred_learning_method" form={form} set={set} />
          <Select name="skill_learning_consistency" label="How often do you learn new skills?" form={form} set={set} />
        </Section>

        <Section title="Extracurricular activities">
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

        <Section title="Career readiness">
          <Select name="career_related_work_status" label="Completed career-related courses, projects or work?" form={form} set={set} />
          <Chips label="Type of career-related work (select all that apply)" options={OPTIONS.career_related_work_type}
            selected={toList(form.career_related_work_type)} onToggle={toggleText("career_related_work_type")} />
          <Chips label="What support do you need? (up to 3)" options={OPTIONS.career_support_needed}
            selected={form.career_support_needed}
            onToggle={(item) => set("career_support_needed", toggle(form.career_support_needed, item))} />
        </Section>

        {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}
        <Button type="submit" size="lg" fullWidth disabled={busy}>
          {busy ? "Finding your best careers…" : "Get my career recommendations"} <ArrowRightIcon size={18} />
        </Button>
      </form>
    </CareerPage>
  );
}
