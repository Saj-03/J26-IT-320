// Optional 1-5 rating used by the evaluation (proposal Table 3):
//   stress suggestion helpfulness -> deferral appropriateness
//   timer length usefulness       -> adaptive timer acceptance
// send(rating) is the API call; one rating per item (the backend answers 409 for a second one).
import React, { useState } from 'react';
import { StarIcon } from 'lucide-react';
import { apiErrorMessage } from '../../../shared/api/client';
import { cn } from '../../../shared/lib/cn';

export default function UsefulnessRating({ question, send, className }) {
    const [rating, setRating] = useState(0);
    const [state, setState] = useState('ask');            // ask -> saving -> thanks
    const [error, setError] = useState('');

    const rate = (n) => {
        setRating(n); setState('saving'); setError('');
        send(n).then(() => setState('thanks')).catch((e) => {
            if (e?.response?.status === 409) return setState('thanks');      // already rated before
            setError(apiErrorMessage(e)); setState('ask');
        });
    };

    if (state === 'thanks') return <p className={cn('text-sm font-semibold text-emerald-700', className)}>Thanks - this helps us improve ThriveU.</p>;
    return (<div className={className}>
      <p className="text-sm font-semibold text-charcoal-light">{question} <span className="font-normal text-charcoal-muted">(optional)</span></p>
      <div className="flex gap-1 mt-1" role="group" aria-label={question}>
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" disabled={state === 'saving'} onClick={() => rate(n)}
            aria-label={`${n} out of 5`} className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-brand-50 transition-colors disabled:opacity-50">
            <StarIcon size={24} className={n <= rating ? 'text-brand-500' : 'text-black/15'} fill={n <= rating ? 'currentColor' : 'none'}/>
          </button>)}
      </div>
      {error && <p className="text-xs font-semibold text-red-600 mt-1">{error}</p>}
    </div>);
}
