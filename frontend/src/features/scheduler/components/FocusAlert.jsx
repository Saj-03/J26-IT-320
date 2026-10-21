// FR-16: gentle note when focus quality or the study habit has dropped this week (never a diagnosis).
// "Got it" hides this kind of note for 7 days.
import React, { useEffect, useState } from 'react';
import { TrendingDownIcon } from 'lucide-react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { dismissFocusAlert, getFocusAlert } from '../api';

const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);

export default function FocusAlert({ className }) {
    const [alert, setAlert] = useState(null);
    useEffect(() => { getFocusAlert().then(setAlert).catch(() => setAlert(null)); }, []);
    if (!alert?.alert) return null;

    const { recent, usual } = alert.details;
    const numbers = alert.kind === 'quality'
        ? `Finished sessions: ${pct(recent.finished_rate)} this week vs ${pct(usual.finished_rate)} usually.`
        : `Study days: ${recent.days_per_week} this week vs about ${usual.days_per_week} a week usually.`;

    return (<Card padding="lg" className={`border border-amber-200/60 bg-amber-light/60 ${className ?? ''}`}>
      <div className="flex items-start gap-3">
        <TrendingDownIcon size={20} className="text-amber-600 mt-0.5 shrink-0"/>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-charcoal">{alert.title}</p>
          <p className="text-sm text-charcoal-light mt-0.5">{alert.message}</p>
          <p className="text-xs text-charcoal-muted mt-1">{numbers}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => dismissFocusAlert(alert.kind).finally(() => setAlert(null))}>Got it</Button>
      </div>
    </Card>);
}
