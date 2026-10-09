// Shows the stress-responsive proposal. Student always decides (user override).
import { useState } from "react";
import { HeartHandshakeIcon, CheckIcon } from "lucide-react";
import { Button } from "../../../shared/components/ui/Button";
import { requestAdaptation, decideChange } from "../api";

export default function AdaptationBanner({ onDone }) {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = async () => { setBusy(true); try { setP(await requestAdaptation()); } finally { setBusy(false); } };
  const decide = async (d) => { await decideChange(p.change_id, d); setP(null); onDone?.(); };

  if (!p) {
    return (
      <Button variant="soft" size="sm" onClick={check} disabled={busy}>
        <HeartHandshakeIcon size={15} /> {busy ? "Checking…" : "Check if my plan should ease up"}
      </Button>
    );
  }
  return (
    <div className="rounded-3xl border border-amber-soft/50 bg-amber-light p-5">
      <p className="font-bold text-charcoal">{p.reason}</p>
      {p.changes.length > 0 ? (
        <>
          <ul className="mt-3 space-y-1.5 text-sm text-charcoal-light">
            {p.changes.map((c, i) => (
              <li key={i} className="flex gap-2">
                <CheckIcon size={15} className="mt-0.5 shrink-0 text-amber-700" />
                <span>{c.action.replaceAll("_", " ")}{c.why ? ` — ${c.why}` : ""}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide("accepted")}>Accept</Button>
            <Button size="sm" variant="outline" className="bg-white" onClick={() => decide("rejected")}>Keep my plan</Button>
          </div>
        </>
      ) : (
        <Button size="sm" variant="ghost" className="mt-2 -ml-3" onClick={() => setP(null)}>Close</Button>
      )}
    </div>
  );
}
