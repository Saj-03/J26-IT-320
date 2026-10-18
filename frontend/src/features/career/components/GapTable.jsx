import { useEffect, useState } from "react";
import { cn } from "../../../shared/lib/cn";
import { skillLabel } from "../constants";
import { ui } from "../theme";
import { t } from "../i18n";

const BAR = { Strong: "bg-[#5DBFA9]", "Needs Improvement": "bg-[#7FC8D6]", "Critical Gap": "bg-[#9EB2DB]" };

// Skill gap as bars: the filled part is the student's level, the dark marker is the required level.
// `status` is an English code from the API (Strong / Needs Improvement / Critical Gap), translated for display.
export default function GapTable({ gaps }) {
  // bars grow from 0 to the student's level just after the table appears
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs font-semibold text-charcoal-muted">
        <span className="flex items-center gap-1.5"><span className="w-4 h-2 rounded-full bg-[#5DBFA9]" /> {t("Your level")}</span>
        <span className="flex items-center gap-1.5"><span className="w-1 h-3 rounded-full bg-[#34477A]" /> {t("Required level")}</span>
      </div>
      <ul className="space-y-4">
        {gaps.map((g) => (
          <li key={g.skill} className="space-y-1.5">
            {/* name and status on one line, full-width bar below: fits long Sinhala/Tamil labels */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-charcoal">{skillLabel(g.skill)}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-charcoal-muted whitespace-nowrap">{g.current_level}/5 → {g.required_level}/5</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", ui.status[g.status])}>
                  {t(g.status)}
                </span>
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-[#E3FFD6]" role="img"
              aria-label={t("{skill}: your level {current} of 5, required {required} of 5", {
                skill: skillLabel(g.skill), current: g.current_level, required: g.required_level,
              })}>
              <div className={cn("h-full rounded-full transition-all duration-700", BAR[g.status])}
                style={{ width: shown ? `${(g.current_level / 5) * 100}%` : "0%" }} />
              <span className="absolute -top-1 h-5 w-1 rounded-full bg-[#34477A]"
                style={{ left: `calc(${(g.required_level / 5) * 100}% - 2px)` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
