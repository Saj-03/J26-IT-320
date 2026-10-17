import { MinusIcon, PlusIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { skillLabel } from "../constants";
import { t } from "../i18n";

// Same formula as the backend (gap_analysis.readiness_percentage): mean of min(level / required, 1).
export const readinessOf = (gaps, levels) =>
  (gaps.reduce((sum, g) => sum + Math.min(levels[g.skill] / g.required_level, 1), 0) / gaps.length) * 100;

// "What if I improve…?" - students raise skill levels and see their readiness change instantly.
// `levels` = every skill's what-if level; `setLevels` receives only the changed skills.
export default function WhatIfSimulator({ gaps, levels, setLevels }) {
  const base = Object.fromEntries(gaps.map((g) => [g.skill, g.current_level]));
  const now = readinessOf(gaps, base);
  const next = readinessOf(gaps, levels);
  const weak = gaps.filter((g) => g.current_level < g.required_level);
  const changed = gaps.some((g) => levels[g.skill] !== g.current_level);

  // The single +1 step (from the current what-if levels) that raises readiness the most; ties: bigger gap first.
  const best = weak
    .filter((g) => levels[g.skill] < g.required_level)
    .map((g) => ({ g, from: levels[g.skill],
      gain: Math.min((levels[g.skill] + 1) / g.required_level, 1) - levels[g.skill] / g.required_level }))
    .sort((a, b) => b.gain - a.gain || (b.g.required_level - b.from) - (a.g.required_level - a.from))[0];

  const step = (skill, delta) =>
    setLevels((prev) => ({ ...prev, [skill]: Math.min(5, Math.max(base[skill], levels[skill] + delta)) }));

  if (!weak.length) {
    return <p className="text-sm text-charcoal-muted">{t("You already meet every required level for this career.")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2" aria-live="polite">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted">{t("Readiness now")}</p>
          <p className="text-2xl font-extrabold text-charcoal">{Math.round(now)}%</p>
        </div>
        <span className="text-xl text-charcoal-muted pb-1">→</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#1F5F53]">{t("If you improve")}</p>
          <p className={cn("text-2xl font-extrabold", changed ? "text-[#1F5F53]" : "text-charcoal-muted")}>
            {Math.round(next)}%{changed && <span className="ml-1 text-sm">(+{Math.round(next - now)})</span>}
          </p>
        </div>
        {changed && (
          <button type="button" onClick={() => setLevels({})}
            className="ml-auto flex items-center gap-1 text-xs font-bold text-[#34477A] hover:underline pb-1.5">
            <RotateCcwIcon size={13} /> {t("Reset")}
          </button>
        )}
      </div>

      {best && (
        <p className="flex items-start gap-2 rounded-2xl bg-[#E3FFD6] px-3 py-2 text-sm text-charcoal-light">
          <SparklesIcon size={16} className="mt-0.5 shrink-0 text-[#1F5F53]" />
          <span>
            <b className="text-charcoal">{changed ? t("Next quick win") : t("Biggest quick win")}:</b>{" "}
            {t(best.from + 1 >= best.g.required_level
              ? "raising {skill} from {from} to {to} adds about +{gain}% readiness, and fully closes that gap."
              : "raising {skill} from {from} to {to} adds about +{gain}% readiness.", {
              skill: skillLabel(best.g.skill), from: best.from, to: best.from + 1,
              gain: Math.round((best.gain / gaps.length) * 100),
            })}
          </span>
        </p>
      )}

      <ul className="grid sm:grid-cols-2 gap-2">
        {weak.map((g) => {
          const level = levels[g.skill];
          const reached = level >= g.required_level;
          return (
            <li key={g.skill} className={cn("flex items-center gap-3 rounded-2xl border px-3 py-2",
              reached ? "border-[#5DBFA9] bg-[#C7F2D1]/50" : "border-[#9ADBCC]/50 bg-white")}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-charcoal truncate">{skillLabel(g.skill)}</p>
                <p className="text-xs text-charcoal-muted">
                  {g.current_level} → <b className="text-charcoal">{level}</b> {t("of {n} needed", { n: g.required_level })}
                  {reached && <span className="ml-1 font-bold text-[#1F5E3D]">✓ {t("reached")}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => step(g.skill, -1)} disabled={level <= g.current_level}
                  aria-label={t("Lower {skill}", { skill: skillLabel(g.skill) })}
                  className="w-8 h-8 rounded-xl border border-[#9EB2DB] text-[#34477A] flex items-center justify-center disabled:opacity-30">
                  <MinusIcon size={14} />
                </button>
                <button type="button" onClick={() => step(g.skill, 1)} disabled={level >= 5}
                  aria-label={t("Raise {skill}", { skill: skillLabel(g.skill) })}
                  className="w-8 h-8 rounded-xl bg-[#9ADBCC] text-[#12352E] flex items-center justify-center disabled:opacity-30">
                  <PlusIcon size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
