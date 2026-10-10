import { ProgressBar } from "../../../../shared/components/ui/ProgressBar";

// Labelled 0-100 score bar. `value` may be null when a score was not measured.
export default function ScoreBar({ label, value, hint }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-semibold text-charcoal-light">{label}</span>
        <span className="text-sm font-bold text-charcoal">{value == null ? "—" : `${Math.round(value)}`}</span>
      </div>
      <ProgressBar value={value ?? 0} color="bg-[#5DBFA9]" track="bg-[#E3FFD6]" />
      {hint && <p className="text-xs text-charcoal-muted mt-1">{hint}</p>}
    </div>
  );
}
