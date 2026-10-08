import { ArrowRightIcon } from "lucide-react";
import Card from "./CareerCard";
import Button from "./CareerButton";
import { ProgressRing } from "../../../shared/components/ui/ProgressRing";
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
  return (
    <Card padding="lg" hover>
      <div className="flex flex-col sm:flex-row gap-5">
        <ProgressRing value={rec.match_percentage} size={92} stroke={9} color={INK.ring} track={PALETTE.lime} className="shrink-0 self-center sm:self-start">
          <span className="text-lg font-extrabold text-charcoal">{Math.round(rec.match_percentage)}%</span>
          <span className="text-[10px] font-semibold text-charcoal-muted">match</span>
        </ProgressRing>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <p className={`text-xs font-bold ${ui.accentText}`}>#{rank} · {rec.career_area}</p>
            <h3 className="text-lg font-extrabold text-charcoal">{rec.career_name}</h3>
            <p className="text-sm text-charcoal-muted">{rec.description}</p>
          </div>
          <p className={`text-sm text-charcoal-light ${ui.highlight} rounded-2xl p-3`}>{rec.explanation}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <BadgeRow title="Matching skills" skills={rec.matching_skills} tone="match" empty="—" />
            <BadgeRow title="Skills to improve" skills={rec.missing_skills} tone="gap" empty="None — you meet every level" />
          </div>
          <Button onClick={() => onSelect(rec)} disabled={busy}>
            {busy ? "Analysing…" : "Select Career"} <ArrowRightIcon size={16} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
