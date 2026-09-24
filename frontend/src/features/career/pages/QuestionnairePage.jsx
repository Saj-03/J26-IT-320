import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { Field } from "../../../shared/components/ui/Field";
import { saveProfile } from "../api";

const split = (s) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);

export default function QuestionnairePage() {
  const nav = useNavigate();
  const [f, setF] = useState({ gpa: "", skills: "", interests: "", extracurricular: "", stated_preference: "" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProfile({ gpa: +f.gpa, skills: split(f.skills), interests: split(f.interests),
                          extracurricular: split(f.extracurricular), stated_preference: f.stated_preference });
      nav("/app/career");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader title="Tell us about you" subtitle="We use this to match you with careers and show the skills to build next." />
      <Card padding="lg">
        <form className="space-y-4" onSubmit={submit}>
          <Field label="GPA" name="gpa" type="number" step="0.01" min="0" max="4" value={f.gpa} onChange={set("gpa")} placeholder="3.4" required />
          <Field label="Skills" name="skills" hint="Comma separated" value={f.skills} onChange={set("skills")} placeholder="python, sql, react" />
          <Field label="Interests" name="interests" hint="Comma separated" value={f.interests} onChange={set("interests")} placeholder="ai, design, finance" />
          <Field label="Clubs, leadership, projects" name="extracurricular" value={f.extracurricular} onChange={set("extracurricular")} placeholder="coding club, hackathon" />
          <Field label="Career you are thinking of" name="stated_preference" value={f.stated_preference} onChange={set("stated_preference")} placeholder="Data Scientist" />
          <Button type="submit" size="lg" fullWidth disabled={saving}>
            {saving ? "Saving…" : "See my matches"} <ArrowRightIcon size={18} />
          </Button>
        </form>
      </Card>
    </div>
  );
}
