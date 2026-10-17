import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardListIcon, GaugeIcon, ColumnsIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import { EmptyState, LoadingState } from "../../../shared/components/ui/States";
import { apiErrorMessage } from "../../../shared/api/client";
import { getCareers, getGapAnalysis } from "../api/careerApi";
import { careerSession, useCareerFlow } from "../utils/careerSession";
import RecommendationCard from "../components/RecommendationCard";
import CareerCompare from "../components/CareerCompare";
import InfoTip from "../components/InfoTip";
import { GLOSSARY } from "../constants";
import { t, useLanguage } from "../i18n";

const MAX_COMPARE = 3;

export default function CareerRecommendations() {
  useLanguage(); // re-render when the language changes
  const navigate = useNavigate();
  const { flow: { profile, recommendations, persona }, ready } = useCareerFlow();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [careers, setCareers] = useState({}); // career_id -> full career (required skill levels for comparing)
  const [compareIds, setCompareIds] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const compareRef = useRef(null);
  useEffect(() => {
    getCareers().then((list) => setCareers(Object.fromEntries(list.map((c) => [c.career_id, c])))).catch(() => {});
  }, []);
  useEffect(() => {
    if (showCompare) compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showCompare]);

  if (!ready && !recommendations?.length) return <LoadingState label={t("Loading your saved results…")} />;
  if (!profile || !recommendations?.length) {
    return (
      <Card>
        <EmptyState icon={ClipboardListIcon} title={t("No recommendations yet")}
          desc={t("Complete the career profile survey to see your top 5 career paths.")}
          actionLabel={t("Start survey")} onAction={() => navigate("/app/career/survey")} />
      </Card>
    );
  }

  const toggleCompare = (rec) => {
    setCompareIds((ids) => (ids.includes(rec.career_id) ? ids.filter((id) => id !== rec.career_id)
      : ids.length < MAX_COMPARE ? [...ids, rec.career_id] : ids));
  };
  const compared = recommendations.filter((r) => compareIds.includes(r.career_id));

  const select = async (rec) => {
    setBusyId(rec.career_id);
    setError("");
    try {
      const gap = await getGapAnalysis({ career_id: rec.career_id, profile });
      careerSession.update({ selectedCareer: rec, gapAnalysis: gap, roadmap: null, roadmapProgress: null });
      navigate("/app/career/gap-analysis");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <CareerPage className="space-y-5" step="careers">
      <PageHeader
        title={t("Your Top 5 Career Paths")}
        subtitle={t("Ranked for your faculty, skills, interests and experience. Tick Compare on 2-3 careers to see them side by side, then select one to see your skill gaps.")}
        action={<Button variant="outline" onClick={() => navigate("/app/career/survey")}>{t("Edit profile")}</Button>}
      />
      {/* Skill-readiness group from the trained K-Means model (guidance only) */}
      {persona && (
        <Card padding="md" className="flex items-start gap-3 bg-[#E3FFD6]/70">
          <span className="w-10 h-10 rounded-2xl bg-[#C7F2D1] text-[#1F5F53] flex items-center justify-center shrink-0">
            <GaugeIcon size={20} />
          </span>
          <div>
            <p className="font-bold text-charcoal">
              {t("Your skill stage:")} {persona.name}
              <InfoTip label={t("Skill stage")} align="left">{GLOSSARY.persona}</InfoTip>
              <span className="ml-2 text-xs font-semibold text-charcoal-muted">
                {t("average self-rating {n}/5", { n: persona.average_skill_level })}
              </span>
            </p>
            <p className="text-sm text-charcoal-light">{persona.description} {persona.advice}</p>
          </div>
        </Card>
      )}
      {error && <p className="text-sm font-semibold text-red-600 bg-red-50 rounded-2xl px-4 py-3">{error}</p>}
      {showCompare && compared.length >= 2 && (
        <div ref={compareRef} className="scroll-mt-24">
          <CareerCompare recs={compared} careers={careers} skills={profile.skills} busyId={busyId}
            onClose={() => setShowCompare(false)} onSelect={select} />
        </div>
      )}
      {recommendations.map((rec, i) => (
        <RecommendationCard key={rec.career_id} rec={rec} rank={i + 1}
          onSelect={select} busy={busyId === rec.career_id}
          compared={compareIds.includes(rec.career_id)} compareDisabled={compareIds.length >= MAX_COMPARE}
          onCompare={Object.keys(careers).length ? toggleCompare : undefined} />
      ))}

      {/* Floating compare bar (above the phone bottom navigation) */}
      {compareIds.length > 0 && (
        <div className="sticky bottom-20 sm:bottom-4 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-full bg-[#1F2840] text-white px-4 py-2 shadow-lift">
            <span className="text-sm font-semibold">{t("{n} of {max} selected to compare", { n: compareIds.length, max: MAX_COMPARE })}</span>
            <Button size="sm" disabled={compareIds.length < 2} onClick={() => setShowCompare(true)}>
              <ColumnsIcon size={14} /> {compareIds.length < 2 ? t("Pick one more") : t("Compare now")}
            </Button>
            <button type="button" className="text-xs font-bold underline" onClick={() => { setCompareIds([]); setShowCompare(false); }}>
              {t("Clear")}
            </button>
          </div>
        </div>
      )}
    </CareerPage>
  );
}
