import { useNavigate, useParams } from "react-router-dom";
import { CheckIcon, TrendingUpIcon, MicIcon } from "lucide-react";
import useFetch from "../../../shared/hooks/useFetch";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { LoadingState, ErrorState } from "../../../shared/components/ui/States";

function Chips({ items, tone, icon: Icon, empty }) {
  if (!items?.length) return <p className="text-sm text-charcoal-muted">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 capitalize ${tone}`}>
          <Icon size={12} /> {s}
        </span>
      ))}
    </div>
  );
}

export default function RoadmapPage() {
  const { career } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch(`/career/skill-gap/${encodeURIComponent(career)}`);

  return (
    <div className="space-y-6">
      <PageHeader title={career} subtitle="What you already bring, and the steps to close the gap."
        action={<Button variant="outline" onClick={() => navigate(`/app/career/interview/${encodeURIComponent(career)}`)}><MicIcon size={16} /> Practice interview</Button>} />

      {loading && !data ? <LoadingState /> : error ? <ErrorState onRetry={reload} /> : (
        <>
          <div className="grid md:grid-cols-2 gap-5">
            <Card padding="lg">
              <h3 className="font-bold text-charcoal mb-3">You already have</h3>
              <Chips items={data?.gap.have} tone="bg-sage-light text-emerald-700" icon={CheckIcon} empty="—" />
            </Card>
            <Card padding="lg">
              <h3 className="font-bold text-charcoal mb-3">To learn</h3>
              <Chips items={data?.gap.missing} tone="bg-brand-50 text-brand-700" icon={TrendingUpIcon} empty="Nothing — you're ready" />
            </Card>
          </div>

          <Card padding="lg">
            <h3 className="font-bold text-charcoal mb-4">Roadmap</h3>
            <ol className="space-y-3">
              {data?.roadmap.map((s) => (
                <li key={s.order} className="flex items-start gap-3 rounded-2xl bg-cream p-4">
                  <span className="w-8 h-8 rounded-full bg-brand-500 text-white text-sm font-bold flex items-center justify-center shrink-0">{s.order}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-charcoal">{s.activity}</p>
                    <p className="text-xs text-charcoal-muted mt-0.5">About {s.est_weeks} weeks</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </div>
  );
}
