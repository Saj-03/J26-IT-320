// PILOT STUDY - the researcher sets each participant's scheduler mode (Component 3).
//   Static = baseline · Adaptive = attention + stress · Attention only = ablation
// Participants are shown by research ID only (no names), and only if they gave research consent.
// Researchers = SCHEDULER_RESEARCHER_EMAILS in backend/.env; everyone else sees a short note.
import React, { useEffect, useState } from 'react';
import { DownloadIcon, FlaskConicalIcon } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { Card } from '../../../shared/components/ui/Card';
import api, { apiErrorMessage } from '../../../shared/api/client';
import { toDate } from '../lib';
import { cn } from '../../../shared/lib/cn';

const MODES = [
    { value: 'static', label: 'Static' },
    { value: 'adaptive', label: 'Adaptive' },
    { value: 'attention_only', label: 'Attention only' },
];
const PARTICIPANTS = '/scheduler/research/participants';

export default function PilotModes() {
    const [isResearcher, setIsResearcher] = useState(null);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const load = () => api.get(PARTICIPANTS).then((r) => setData(r.data)).catch((e) => setError(apiErrorMessage(e)));
    useEffect(() => {
        api.get('/scheduler/research/me')
            .then((r) => { setIsResearcher(r.data.is_researcher); if (r.data.is_researcher) load(); })
            .catch(() => setIsResearcher(false));
    }, []);

    const change = (researchId, body) => {
        setError('');
        api.patch(`${PARTICIPANTS}/${researchId}`, body).then(load).catch((e) => setError(apiErrorMessage(e)));
    };

    // FR-12: pilot metrics CSV (research IDs only). Fetched with the login token, then saved by the browser.
    const download = () => {
        setError('');
        api.get('/scheduler/research/export.csv', { responseType: 'blob' }).then((r) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(r.data);
            link.download = `c3_pilot_metrics_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        }).catch((e) => setError(apiErrorMessage(e)));
    };

    const counts = Object.fromEntries(MODES.map((m) => [m.value, data?.participants.filter((p) => p.mode === m.value).length ?? 0]));

    return (<Card padding="none">
      <div className="p-5 border-b border-black/[0.05] flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FlaskConicalIcon size={17}/></span>
        <div className="flex-1">
          <h3 className="font-bold text-charcoal">Scheduler pilot modes</h3>
          <p className="text-xs text-charcoal-muted">
            Research IDs of consenting students only · Static = baseline, Adaptive = attention + stress, Attention only = ablation · AB / BA = order of the two conditions
          </p>
        </div>
        {isResearcher && <Button size="sm" variant="outline" onClick={download}><DownloadIcon size={15}/> Metrics CSV</Button>}
      </div>

      {isResearcher === false &&
        <p className="p-5 text-sm text-charcoal-muted">Only researchers can see participants and set their scheduler mode.</p>}
      {error && <p className="px-5 pt-4 text-sm font-semibold text-red-600">{error}</p>}

      {data && <>
        <div className="px-5 pt-4 flex flex-wrap gap-2 text-xs font-semibold text-charcoal-light">
          {MODES.map((m) => <span key={m.value} className="bg-cream rounded-full px-3 py-1">{m.label}: {counts[m.value]}</span>)}
          {data.without_consent > 0 && <span className="rounded-full px-3 py-1 text-charcoal-muted">{data.without_consent} without consent (not shown)</span>}
        </div>
        {data.participants.length === 0 ?
          <p className="p-5 text-sm text-charcoal-muted">No consenting participants yet.</p> :
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-charcoal-muted">
                  <th className="px-5 py-3">Research ID</th>
                  <th className="px-5 py-3">Scheduler mode</th>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Focus sessions</th>
                  <th className="px-5 py-3">Tasks done</th>
                  <th className="px-5 py-3">Last session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {data.participants.map((p) => <tr key={p.research_id} className="hover:bg-cream/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-charcoal">{p.research_id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex bg-cream rounded-full p-1 w-fit" role="group" aria-label={`Scheduler mode for ${p.research_id}`}>
                        {MODES.map((m) => <button key={m.value} onClick={() => change(p.research_id, { mode: m.value })} aria-pressed={p.mode === m.value}
                            className={cn('px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors', p.mode === m.value ? 'bg-brand-500 text-white' : 'text-charcoal-light')}>
                            {m.label}
                          </button>)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <select value={p.pilot_group ?? ''} onChange={(e) => change(p.research_id, { pilot_group: e.target.value })}
                          aria-label={`Order for ${p.research_id}`} className="rounded-xl border border-black/10 bg-white px-2 py-1 text-xs font-semibold">
                        <option value="">–</option>
                        <option value="AB">AB</option>
                        <option value="BA">BA</option>
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-charcoal-light">{p.completed_sessions}</td>
                    <td className="px-5 py-3.5 text-charcoal-light">{p.tasks_done}</td>
                    <td className="px-5 py-3.5 text-charcoal-muted">
                      {p.last_active ? toDate(p.last_active).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '–'}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>}
      </>}
    </Card>);
}
