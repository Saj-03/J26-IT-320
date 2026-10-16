import { ArrowRightIcon, CrownIcon } from "lucide-react";
import Card from "./CareerCard";
import Button from "./CareerButton";
import { ProgressRing } from "../../../shared/components/ui/ProgressRing";
import { cn } from "../../../shared/lib/cn";
import SkillBadge from "./SkillBadge";
import { INK, PALETTE, ui } from "../theme";

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

export default function RecommendationCard({ rec, rank, onSelect, busy }) {
  const best = rank === 1;
  return (
    <Card padding="none" hover className={cn("overflow-hidden", best && "border-2 border-[#9ADBCC] shadow-card")}>
      {/* colour strip: the best match gets the full palette gradient */}
      <div className={cn("h-1.5", best ? "bg-gradient-to-r from-[#9ADBCC] via-[#D0F2F7] to-[#9EB2DB]" : "bg-[#C7F2D1]")} />
      <div className="p-6 sm:p-7 flex flex-col sm:flex-row gap-5">
        <div className="flex sm:flex-col items-center gap-3 shrink-0">
          <ProgressRing value={rec.match_percentage} size={96} stroke={9} color={INK.ring} track={PALETTE.lime}>
            <span className="text-xl font-extrabold text-charcoal">{Math.round(rec.match_percentage)}%</span>
            <span className="text-[10px] font-semibold text-charcoal-muted">match</span>
          </ProgressRing>
          <span className="w-9 h-9 rounded-full bg-[#9EB2DB]/30 text-[#34477A] text-sm font-extrabold flex items-center justify-center">
            #{rank}
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {best && (
                <span className="flex items-center gap-1 rounded-full bg-[#9ADBCC] text-[#12352E] px-2.5 py-0.5 text-xs font-bold">
                  <CrownIcon size={12} /> Best match
                </span>
              )}
              <span className={`text-xs font-bold ${ui.accentText}`}>{rec.career_area}</span>
              {/* Shown only when the list had to be filled with careers from other faculties */}
              {rec.faculty_match === false && (
                <span className="rounded-full bg-[#9EB2DB]/35 text-[#34477A] px-2 py-0.5 text-xs font-bold">Outside your faculty</span>
              )}
            </div>
            <h3 className="text-xl font-extrabold text-charcoal mt-1">{rec.career_name}</h3>
            {rec.faculties?.length > 0 && (
              <p className="text-xs text-charcoal-muted">Faculty: {rec.faculties.filter((f) => f !== "Other").join(", ")}</p>
            )}
            <p className="text-sm text-charcoal-muted mt-1">{rec.description}</p>
            {/* Score breakdown: shown when the trained model contributed to the match */}
            {rec.model_probability != null && (
              <p className="text-xs font-semibold text-charcoal-muted mt-1">
                Skill match {Math.round(rec.skill_match_percentage)}% · Trained model {Math.round(rec.model_probability)}%
              </p>
            )}
          </div>
          <p className={`text-sm text-charcoal-light ${ui.highlight} rounded-2xl p-3 border-l-4 border-[#9ADBCC]`}>
            {rec.explanation}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <BadgeRow title="Matching skills" skills={rec.matching_skills} tone="match" empty="—" />
            <BadgeRow title="Skills to improve" skills={rec.missing_skills} tone="gap" empty="None — you meet every level" />
          </div>
          <Button onClick={() => onSelect(rec)} disabled={busy} variant={best ? "primary" : "soft"}>
            {busy ? "Analysing…" : "Select Career"} <ArrowRightIcon size={16} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
