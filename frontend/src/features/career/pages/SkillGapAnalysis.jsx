import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3Icon, MapIcon, FlaskConicalIcon, TargetIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { ProgressRing } from "../../../shared/components/ui/ProgressRing";
import { EmptyState, LoadingState } from "../../../shared/components/ui/States";
import { apiErrorMessage } from "../../../shared/api/client";
import { generateRoadmap } from "../api/careerApi";
import { careerSession, useCareerFlow } from "../utils/careerSession";
import GapTable from "../components/GapTable";
import SkillRadar from "../components/SkillRadar";
import WhatIfSimulator from "../components/WhatIfSimulator";
import InfoTip from "../components/InfoTip";
import { GLOSSARY, skillLabel } from "../constants";
import { INK, PALETTE } from "../theme";
import { t, useLanguage } from "../i18n";

const listText = (items) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ${t("and")} ${items[items.length - 1]}`;

// One plain-language sentence that tells the student what the numbers mean for them.
function summary(gapAnalysis) {
  const critical = gapAnalysis.skill_gaps.filter((g) => g.status === "Critical Gap").map((g) => skillLabel(g.skill));
  const improve = gapAnalysis.skill_gaps.filter((g) => g.status === "Needs Improvement").map((g) => skillLabel(g.skill));
  const pct = Math.round(gapAnalysis.readiness_percentage);
  const career = gapAnalysis.career_name;
  if (!critical.length && !improve.length) return t("You meet every required skill level for {career}.", { career });
  const first = listText(critical.length ? critical : improve);
  return critical.length && improve.length
    ? t("You are {pct}% ready for {career}. Focus first on {first}, then {then}.", { pct, career, first, then: listText(improve) })
    : t("You are {pct}% ready for {career}. Focus first on {first}.", { pct, career, first });
}

export default function SkillGapAnalysis() {
  useLanguage(); // re-render when the language changes
  const navigate = useNavigate();
  const { flow: { profile, gapAnalysis }, ready } = useCareerFlow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changes, setChanges] = useState({}); // what-if levels the student has changed (skill -> level)

  if (!ready && !gapAnalysis) return <LoadingState label={t("Loading your saved results…")} />;
  if (!profile || !gapAnalysis) {
    return (
      <Card>
        <EmptyState icon={BarChart3Icon} title={t("No career selected yet")}
          desc={t("Pick a career from your recommendations to see your skill gaps.")}
          actionLabel={t("View recommendations")} onAction={() => navigate("/app/career/recommendations")} />
      </Card>
    );
  }

  const gaps = gapAnalysis.skill_gaps;
  const count = (status) => gaps.filter((g) => g.status === status).length;
  const levels = Object.fromEntries(gaps.map((g) => [g.skill, changes[g.skill] ?? g.current_level]));
  const preview = gaps.some((g) => levels[g.skill] !== g.current_level) ? gaps.map((g) => levels[g.skill]) : null;

  const buildRoadmap = async () => {
    setBusy(true);
    setError("");
    try {
      const roadmap = await generateRoadmap({ career_id: gapAnalysis.career_id, profile });
      careerSession.update({ roadmap, roadmapProgress: {} }); // a new roadmap starts with nothing ticked
      navigate("/app/career/roadmap");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CareerPage step="gap">
      <PageHeader
        title={t("Skill Gap Analysis: {career}", { career: gapAnalysis.career_name })}
        subtitle={t("See where you already meet the career's needs, and where to grow.")}
        action={<Button variant="outline" onClick={() => navigate("/app/career/recommendations")}>{t("Choose another career")}</Button>}
      />

      {/* Summary: readiness, plain-language next step, and the main action */}
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing value={gapAnalysis.readiness_percentage} size={120} stroke={11} color={INK.ring} track={PALETTE.lime}>
            <span className="text-2xl font-extrabold text-charcoal">{Math.round(gapAnalysis.readiness_percentage)}%</span>
            <span className="text-xs font-semibold text-charcoal-muted">{t("ready")}</span>
          </ProgressRing>
          <div className="flex-1 space-y-3 text-center sm:text-left">
            <h3 className="font-bold text-charcoal">
              {t("Career readiness")} <InfoTip label={t("Readiness")} align="left">{GLOSSARY.readiness}</InfoTip>
            </h3>
            <p className="text-sm text-charcoal-light">{summary(gapAnalysis)}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 text-xs font-bold">
              <span className="rounded-full px-2.5 py-1 bg-[#C7F2D1] text-[#1F5E3D]">{count("Strong")} {t("Strong")}</span>
              <span className="rounded-full px-2.5 py-1 bg-[#D0F2F7] text-[#24566A]">{count("Needs Improvement")} {t("Needs Improvement")}</span>
              <span className="rounded-full px-2.5 py-1 bg-[#9EB2DB] text-[#1E2D57]">{count("Critical Gap")} {t("Critical Gap")}</span>
              <InfoTip label={t("Gap")}>{GLOSSARY.gap}</InfoTip>
            </div>
            <Button onClick={buildRoadmap} disabled={busy}>
              <MapIcon size={16} /> {busy ? t("Building your roadmap…") : t("Build my roadmap")}
            </Button>
          </div>
        </div>
      </Card>

      {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}

      <div className="grid lg:grid-cols-[minmax(0,380px)_1fr] gap-5 items-start">
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-2 flex items-center gap-2">
            <TargetIcon size={18} className="text-[#1F5F53]" /> {t("Your skill shape")}
          </h3>
          <p className="text-xs text-charcoal-muted mb-2">{t("Where the green area is inside the dashed line, you have a gap.")}</p>
          <SkillRadar gaps={gaps} preview={preview} />
        </Card>
        <Card padding="lg">
          <h3 className="font-bold text-charcoal mb-4 flex items-center gap-2">
            <BarChart3Icon size={18} className="text-[#1F5F53]" /> {t("Skill by skill")}
          </h3>
          <GapTable gaps={gaps} />
        </Card>
      </div>

      <Card padding="lg">
        <h3 className="font-bold text-charcoal flex items-center gap-2">
          <FlaskConicalIcon size={18} className="text-[#1F5F53]" /> {t("What if I improve…?")}
        </h3>
        <p className="text-xs text-charcoal-muted mb-4">
          {t("Try raising a skill to see how much closer you get. This is a preview only; your saved results do not change.")}
        </p>
        <WhatIfSimulator gaps={gaps} levels={levels} setLevels={setChanges} />
      </Card>
    </CareerPage>
  );
}
