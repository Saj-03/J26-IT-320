import { HeartHandshakeIcon, PhoneIcon } from "lucide-react";
import { Card } from "../../../shared/components/ui/Card";

// Shown instead of any automated advice when a message sounds unsafe. Helplines come from the API (single source).
export function CrisisCard({ helplines = [] }) {
  return (
    <Card padding="lg" className="border-2 border-brand-200 bg-brand-50" role="alert">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0">
          <HeartHandshakeIcon size={17} />
        </span>
        <div>
          <p className="font-bold text-charcoal">Thank you for writing that down. You deserve support from a real person.</p>
          <p className="mt-1 text-sm text-charcoal-light">If you are in danger right now, please call for help. These are free and you do not have to explain much.</p>
          <ul className="mt-3 space-y-2">
            {helplines.map((h) => (
              <li key={h.name} className="flex items-start gap-2 text-sm text-charcoal">
                <PhoneIcon size={14} className="mt-1 shrink-0 text-brand-600" />
                <span><strong>{h.number}</strong> · {h.name}<span className="text-charcoal-muted"> ({h.note})</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-charcoal-light">Is there someone you trust who can be with you today? You can also contact the university counselling service.</p>
        </div>
      </div>
    </Card>
  );
}
