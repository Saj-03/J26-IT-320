import { cn } from "../../../shared/lib/cn";
import { skillLabel } from "../constants";
import { ui } from "../theme";

const BAR = { Strong: "bg-[#5DBFA9]", "Needs Improvement": "bg-[#7FC8D6]", "Critical Gap": "bg-[#9EB2DB]" };

// Skill gap as bars: the filled part is the student's level, the dark marker is the required level.
export default function GapTable({ gaps }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs font-semibold text-charcoal-muted">
        <span className="flex items-center gap-1.5"><span className="w-4 h-2 rounded-full bg-[#5DBFA9]" /> Your level</span>
        <span className="flex items-center gap-1.5"><span className="w-1 h-3 rounded-full bg-[#34477A]" /> Required level</span>
      </div>
      <ul className="space-y-3.5">
        {gaps.map((g) => (
          <li key={g.skill} className="grid grid-cols-1 sm:grid-cols-[150px_1fr_230px] items-center gap-x-4 gap-y-1.5">
            <span className="text-sm font-semibold text-charcoal">{skillLabel(g.skill)}</span>
            <div className="relative h-3 rounded-full bg-[#E3FFD6]" role="img"
              aria-label={`${skillLabel(g.skill)}: your level ${g.current_level} of 5, required ${g.required_level} of 5`}>
              <div className={cn("h-full rounded-full transition-all duration-700", BAR[g.status])}
                style={{ width: `${(g.current_level / 5) * 100}%` }} />
              <span className="absolute -top-1 h-5 w-1 rounded-full bg-[#34477A]"
                style={{ left: `calc(${(g.required_level / 5) * 100}% - 2px)` }} />
            </div>
            <span className="flex items-center gap-2 sm:justify-end">
              <span className="text-xs text-charcoal-muted whitespace-nowrap">{g.current_level}/5 → {g.required_level}/5</span>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", ui.status[g.status])}>
                {g.status}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
