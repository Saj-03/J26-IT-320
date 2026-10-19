// M3 (Objective 2): "You said 1h - from your past tasks this usually takes ~1h 45m (1h 25m - 2h 10m)".
// The plan uses the predicted time; the student can keep their own estimate instead (that choice is logged).
import React, { useEffect, useState } from 'react';
import { HourglassIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { apiErrorMessage } from '../../../shared/api/client';
import { getTaskDuration, updateTask } from '../api';
import { formatMinutes } from './PlanPrimitives';

export default function DurationCard({ taskId, onChanged }) {
    const [d, setD] = useState(null);
    const [error, setError] = useState('');

    const load = () => getTaskDuration(taskId).then(setD).catch(() => setD(null));
    useEffect(() => { load(); }, [taskId]);   // eslint-disable-line react-hooks/exhaustive-deps

    if (!d || d.source !== 'm3_model' || d.predicted_minutes == null) return null;

    const choose = (minutes) => {
        setError('');
        updateTask(taskId, { predicted_minutes: minutes })
            .then(() => { load(); onChanged?.(); })
            .catch((e) => setError(apiErrorMessage(e)));
    };
    const same = Math.abs(d.model_minutes - d.estimated_minutes) < 5;
    const keptOwn = d.model_minutes != null && d.predicted_minutes !== d.model_minutes;   // student overrode M3
    const from = d.history_used ? `your last ${d.history_used} finished tasks` : 'students with similar tasks (you have no finished tasks yet)';

    return (<Card padding="lg" className="border border-sky-100 bg-sky-50/60">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0"><HourglassIcon size={18}/></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-charcoal">
            {same ? `About ${formatMinutes(d.model_minutes)} - your estimate looks right`
                : `You said ${formatMinutes(d.estimated_minutes)}. This usually takes ~${formatMinutes(d.model_minutes)}`}
          </p>
          <p className="text-sm text-charcoal-muted mt-0.5">
            Learned from {from} · likely between {formatMinutes(d.low)} and {formatMinutes(d.high)}.
            {keptOwn ? ' You chose to keep your own estimate.' : ' Your plan uses this time so the work fits before the deadline.'}
          </p>
          {!same &&
            <div className="flex flex-wrap gap-2 mt-3">
              {keptOwn ?
                <Button size="sm" onClick={() => choose(null)}>
                  Use the AI time instead
                </Button> :
                <Button size="sm" variant="outline" onClick={() => choose(d.estimated_minutes)}>
                  Keep my {formatMinutes(d.estimated_minutes)}
                </Button>}
            </div>}
          {error && <p className="text-sm font-semibold text-red-600 mt-2">{error}</p>}
        </div>
      </div>
    </Card>);
}
