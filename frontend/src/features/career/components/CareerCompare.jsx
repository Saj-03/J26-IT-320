import { XIcon, ArrowRightIcon } from "lucide-react";
import Card from "./CareerCard";
import Button from "./CareerButton";
import { cn } from "../../../shared/lib/cn";
import { SKILLS } from "../constants";
import { t } from "../i18n";

// Same formula as the backend gap analysis: mean of min(your level / required, 1).
const readiness = (skills, required) =>
  Math.round((SKILLS.reduce((s, { key }) => s + Math.min(skills[key] / required[key], 1), 0) / SKILLS.length) * 100);

// Side-by-side comparison of up to 3 recommended careers against the student's own skill levels.
export default function CareerCompare({ recs, careers, skills, onClose, onSelect, busyId }) {
  const rows = recs.map((rec) => ({ rec, required: careers[rec.career_id]?.required_skills })).filter((r) => r.required);
  if (!rows.length) return null;
  return (
    <Card padding="lg" className="border-2 border-[#9EB2DB] space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-charcoal">{t("Compare careers")}</h2>
          <p className="text-xs text-charcoal-muted">{t("Required level for each skill. Green = you already meet it; blue = a gap.")}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("Close comparison")}
          className="w-9 h-9 rounded-full hover:bg-black/[0.05] flex items-center justify-center text-charcoal-muted">
          <XIcon size={18} />
        </button>
      </div>
      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full table-fixed text-xs sm:text-sm border-separate border-spacing-y-1">
          <thead>
            <tr>
              <th className="w-[34%] sm:w-[28%] text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-charcoal-muted pr-2">{t("Skill (you)")}</th>
              {rows.map(({ rec }) => (
                <th key={rec.career_id} className="text-center font-extrabold text-charcoal px-1 leading-tight align-bottom">{rec.career_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold text-charcoal-light pr-3">{t("Match")}</td>
              {rows.map(({ rec }) => (
                <td key={rec.career_id} className="text-center font-extrabold text-[#1F5F53]">{Math.round(rec.match_percentage)}%</td>
              ))}
            </tr>
            <tr>
              <td className="font-semibold text-charcoal-light pr-3">{t("Readiness")}</td>
              {rows.map(({ rec, required }) => (
                <td key={rec.career_id} className="text-center font-extrabold text-charcoal">{readiness(skills, required)}%</td>
              ))}
            </tr>
            {SKILLS.map(({ key, label }) => (
              <tr key={key}>
                <td className="text-charcoal-light pr-2 leading-tight">{t(label)} <span className="text-charcoal-muted">({skills[key]})</span></td>
                {rows.map(({ rec, required }) => {
                  const ok = skills[key] >= required[key];
                  return (
                    <td key={rec.career_id} className="text-center">
                      <span className={cn("inline-block min-w-[2.25rem] rounded-full px-1.5 py-0.5 text-xs font-bold",
                        ok ? "bg-[#C7F2D1] text-[#1F5E3D]" : "bg-[#9EB2DB]/40 text-[#1E2D57]")}
                        title={ok ? t("You meet this level") : t("Gap of {n}", { n: required[key] - skills[key] })}>
                        {required[key]}{ok ? " ✓" : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td />
              {rows.map(({ rec }) => (
                <td key={rec.career_id} className="text-center pt-2">
                  <Button size="sm" variant="soft" onClick={() => onSelect(rec)} disabled={busyId === rec.career_id}>
                    {t("Select")} <ArrowRightIcon size={14} />
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
