// Live exercise + meal picks from /physical/recommendations (404 until the assessment is done).
import { useNavigate } from "react-router-dom";
import { ActivityIcon, LeafIcon } from "lucide-react";
import { Card } from "../../../shared/components/ui/Card";
import { EmptyState, LoadingState } from "../../../shared/components/ui/States";
import useFetch from "../../../shared/hooks/useFetch";
import { SectionTitle } from "./Shared";

export default function ProfileRecommendations() {
  const navigate = useNavigate();
  const { data, error, loading } = useFetch("/physical/recommendations");

  if (loading && !data) return <Card><LoadingState label="Loading your recommendations…" /></Card>;
  if (error) {
    return (
      <Card>
        <EmptyState icon={ActivityIcon} title="Set up your wellbeing profile" desc="A 2-minute assessment lets IHSD pick exercise and meals that fit your week."
          actionLabel="Start assessment" onAction={() => navigate("/physical-setup")} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {data.recovery_mode && (
        <div className="rounded-3xl bg-amber-light border border-amber-soft/50 p-4 text-sm font-semibold text-charcoal">
          Heavy week detected — showing gentle recovery options.
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <SectionTitle title="Exercise for today" />
          <ul className="space-y-2">
            {data.exercises?.map((e, idx) => {
              const name = e.name || e.title || "Custom Workout";
              const minutes = e.minutes || e.adapted_duration_mins || e.time_per_workout || e.duration_mins || 20;
              return (
                <li key={e.id || name + "-" + idx} className="flex items-center justify-between gap-3 rounded-2xl bg-cream px-3.5 py-3">
                  <span className="text-sm font-bold text-charcoal">{name}</span>
                  <span className="text-xs font-bold bg-brand-50 text-brand-700 rounded-full px-2.5 py-1 shrink-0">{minutes} min</span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <SectionTitle title="Meal ideas" />
          <ul className="space-y-2">
            {data.meals?.map((m, idx) => {
              const name = m.name || m.meal_name || m.title || "Healthy Meal";
              const region = m.region || m.cuisine || (m.vegetarian ? "Vegetarian" : "Balanced");
              return (
                <li key={m.id || name + "-" + idx} className="flex items-center gap-3 rounded-2xl bg-cream px-3.5 py-3">
                  <LeafIcon size={15} className="text-emerald-600 shrink-0" />
                  <span className="text-sm font-bold text-charcoal flex-1">{name}</span>
                  <span className="text-xs text-charcoal-muted">{region}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
