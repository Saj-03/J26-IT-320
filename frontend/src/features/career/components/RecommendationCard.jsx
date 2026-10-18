import { useState } from "react";
import { ArrowRightIcon, CrownIcon, ChevronDownIcon } from "lucide-react";
import Card from "./CareerCard";
import Button from "./CareerButton";
import InfoTip from "./InfoTip";
import AnimatedRing from "./AnimatedRing";
import { cn } from "../../../shared/lib/cn";
import SkillBadge from "./SkillBadge";
import { GLOSSARY, matchLabel } from "../constants";
import { INK, PALETTE, ui } from "../theme";
import { t } from "../i18n";

function BadgeRow({ title, skills, tone, empty }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted mb-1.5">{title}</p>
      {skills.length ? (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => <SkillBadge key={s} skill={s} tone={tone} />)}
        </div>
      ) : (
        <p className="text-sm text-charcoal-muted">{empty}</p>
      )}
    </div>
  );
}

// One recommended career. The explanation is folded away (except for the best match) to keep the list scannable.
export default function RecommendationCard({ rec, rank, onSelect, busy, compared, onCompare, compareDisabled }) {
  const best = rank === 1;
  const [whyOpen, setWhyOpen] = useState(best);
  const whyId = `why-${rec.career_id}`;
  return (
    <Card padding="none" hover className={cn("overflow-hidden", best && "border-2 border-[#9ADBCC] shadow-card",
      compared && "ring-2 ring-[#9EB2DB]")}>
      {/* colour strip: the best match gets the full palette gradient */}
      <div className={cn("h-1.5", best ? "bg-gradient-to-r from-[#9ADBCC] via-[#D0F2F7] to-[#9EB2DB]" : "bg-[#C7F2D1]")} />
      <div className="p-5 sm:p-7 flex flex-col sm:flex-row gap-5">
        <div className="flex sm:flex-col items-center gap-3 shrink-0">
          <AnimatedRing value={rec.match_percentage} size={96} stroke={9} color={INK.ring} track={PALETTE.lime}>
            {(v) => <>
              <span className="text-xl font-extrabold text-charcoal">{v}%</span>
              <span className="text-[10px] font-semibold text-charcoal-muted">{t("match")}</span>
            </>}
          </AnimatedRing>
          <div className="flex sm:flex-col items-center gap-2">
            <span className="w-9 h-9 rounded-full bg-[#9EB2DB]/30 text-[#34477A] text-sm font-extrabold flex items-center justify-center">
              #{rank}
            </span>
            <span className="text-xs font-bold text-[#1F5F53] text-center">{matchLabel(rec.match_percentage)}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {best && (
                <span className="flex items-center gap-1 rounded-full bg-[#9ADBCC] text-[#12352E] px-2.5 py-0.5 text-xs font-bold">
                  <CrownIcon size={12} /> {t("Best match")}
                </span>
              )}
              <span className={`text-xs font-bold ${ui.accentText}`}>{rec.career_area}</span>
              {/* Shown only when the list had to be filled with careers from other faculties */}
              {rec.faculty_match === false && (
                <span className="rounded-full bg-[#9EB2DB]/35 text-[#34477A] px-2 py-0.5 text-xs font-bold">{t("Outside your faculty")}</span>
              )}
            </div>
            <h3 className="text-xl font-extrabold text-charcoal mt-1">{rec.career_name}</h3>
            <p className="text-sm text-charcoal-muted mt-0.5">{rec.description}</p>
            {/* Score breakdown: shown when the trained model contributed to the match */}
            <p className="text-xs font-semibold text-charcoal-muted mt-1 flex flex-wrap items-center gap-x-1">
              {rec.model_probability != null
                ? t("Skill match {skill}% · Trained model {model}%", {
                  skill: Math.round(rec.skill_match_percentage), model: Math.round(rec.model_probability),
                })
                : t("Skill match {skill}%", { skill: Math.round(rec.skill_match_percentage ?? rec.match_percentage) })}
              {rec.faculties?.length > 0 && (
                <> · {t("Faculty:")} {rec.faculties.filter((f) => f !== "Other").map((f) => t(f)).join(", ")}</>
              )}
              {best && <InfoTip label="match" align="left">{GLOSSARY.match}</InfoTip>}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <BadgeRow title={t("Skills you already have")} skills={rec.matching_skills} tone="match" empty="—" />
            <BadgeRow title={t("Skills to improve")} skills={rec.missing_skills} tone="gap" empty={t("None — you meet every level")} />
          </div>

          <div>
            <button type="button" onClick={() => setWhyOpen((o) => !o)} aria-expanded={whyOpen} aria-controls={whyId}
              className="flex items-center gap-1 text-sm font-bold text-[#1F5F53] hover:underline">
              <ChevronDownIcon size={16} className={cn("transition-transform", whyOpen && "rotate-180")} />
              {t("Why this career?")}
            </button>
            {whyOpen && (
              <p id={whyId} className={`acrds-fade mt-2 text-sm text-charcoal-light ${ui.highlight} rounded-2xl p-3 border-l-4 border-[#9ADBCC]`}>
                {rec.explanation}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button onClick={() => onSelect(rec)} disabled={busy} variant={best ? "primary" : "soft"}>
              {busy ? t("Analysing…") : t("Select this career")} <ArrowRightIcon size={16} />
            </Button>
            {onCompare && (
              <label className={cn("flex items-center gap-2 text-sm font-semibold text-charcoal-light cursor-pointer",
                compareDisabled && !compared && "opacity-50 cursor-not-allowed")}>
                <input type="checkbox" className="accent-[#5DBFA9] w-5 h-5 sm:w-4 sm:h-4" checked={compared}
                  aria-disabled={compareDisabled && !compared} onChange={() => onCompare(rec)} />
                {t("Compare")}
              </label>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
