import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon, LockIcon, PaletteIcon, BarChart3Icon, LeafIcon, ShieldCheckIcon } from 'lucide-react';

const card = 'rounded-2xl border border-black/[0.06] bg-white/95 shadow-lift backdrop-blur';

const tone = {
  blue: 'bg-sky-100 text-sky-800 border-sky-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  purple: 'bg-violet-100 text-violet-800 border-violet-200',
  sand: 'bg-stone-100 text-stone-700 border-stone-200',
  red: 'bg-rose-100 text-rose-700 border-rose-300',
};

function Block({ c, title, time, className = '' }) {
  return (
    <div className={`rounded-md border px-1.5 py-1 text-[9px] leading-tight ${tone[c]} ${className}`}>
      <p className="font-semibold">{title}</p>
      {time && <p className="opacity-70">{time}</p>}
    </div>
  );
}

export function WeekCard({ className = '' }) {
  const days = [
    ['Mon', 8, [['blue', 'Lectures', '9:00–10:30'], ['orange', 'Project Work', '11:00–13:00'], ['green', 'Gym', '17:00–18:00']]],
    ['Tue', 9, [['sand', 'Career Talk', '10:00–11:00'], ['sand', 'Group Study', '14:00–16:00']]],
    ['Wed', 10, [['purple', 'Maths', '9:00–10:30'], ['orange', 'Library', '13:00–15:00']]],
    ['Thu', 11, [['green', 'Wellbeing', '12:00–13:00']]],
  ];
  return (
    <div className={`${card} w-[248px] p-3.5 ${className}`}>
      <div className="mb-2.5 flex items-center justify-between">
        <p className="font-serif text-lg font-semibold italic text-charcoal">My Week</p>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-charcoal-light">
          <ChevronLeftIcon size={12} /> <ChevronRightIcon size={12} /> <span className="ml-1">Nov 2027</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {days.map(([d, n, blocks]) => (
          <div key={d} className="space-y-1.5">
            <p className="text-center text-[9px] font-semibold text-charcoal-muted">
              {d} <span className="text-charcoal">{n}</span>
            </p>
            {blocks.map(([c, t, time]) => (
              <Block key={t} c={c} title={t} time={time} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CareerMatchCard({ className = '' }) {
  const rows = [
    [PaletteIcon, 'Product Designer', 92, 'bg-brand-500', 'bg-orange-100 text-orange-700'],
    [BarChart3Icon, 'Data Analyst', 78, 'bg-sky-500', 'bg-sky-100 text-sky-700'],
    [LeafIcon, 'Sustainability Consultant', 71, 'bg-emerald-500', 'bg-emerald-100 text-emerald-700'],
  ];
  return (
    <div className={`${card} w-[270px] p-4 ${className}`}>
      <p className="mb-3 text-sm font-bold text-charcoal">Career Match</p>
      <div className="space-y-3.5">
        {rows.map(([Icon, label, pct, bar, chip]) => (
          <div key={label} className="flex items-center gap-2.5">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${chip}`}>
              <Icon size={13} />
            </span>
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-charcoal">{label}</span>
                <span className="text-charcoal-light">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-black/[0.06]">
                <div data-bar style={{ width: `${pct}%` }} className={`h-full origin-left rounded-full ${bar}`} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlannerCard({ className = '' }) {
  const cols = ['Mon 8', 'Tue 9', 'Wed 10', 'Thu 11', 'Fri 12'];
  const hours = ['8:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
  // [col, rowStart (0 = 8:00, 1 unit = 1h), span, tone, title]
  const items = [
    [0, 1.2, 1, 'blue', 'Lectures'],
    [0, 4.4, 1, 'orange', 'Project Work'],
    [0, 8.3, 1, 'green', 'Gym'],
    [1, 2, 1, 'blue', 'Tutorial'],
    [1, 5.3, 1.2, 'blue', 'Group Study'],
    [2, 0.5, 1, 'red', 'Assignment Due'],
    [3, 3.4, 1.2, 'purple', 'Library'],
    [3, 7.2, 0.9, 'green', 'Career Event'],
    [4, 8.1, 0.9, 'blue', 'Wellbeing'],
  ];
  return (
    <div className={`${card} p-4 ${className}`}>
      <p className="mb-3 text-sm font-bold text-charcoal">Nov 2027</p>
      <div className="grid grid-cols-[36px_repeat(5,1fr)] text-[9px] font-semibold text-charcoal-muted">
        <span />
        {cols.map((c) => (
          <span key={c} className="border-l border-black/[0.05] pb-1.5 text-center">{c}</span>
        ))}
      </div>
      <div className="relative grid h-[220px] grid-cols-[36px_repeat(5,1fr)]">
        <div className="flex flex-col justify-between text-[9px] text-charcoal-muted">
          {hours.map((h) => <span key={h}>{h}</span>)}
        </div>
        {cols.map((c, ci) => (
          <div key={c} className="relative border-l border-black/[0.05]">
            {items.filter((i) => i[0] === ci).map(([, start, span, t, title]) => (
              <div
                key={title}
                data-slot
                className="absolute inset-x-1"
                style={{ top: `${(start / 10) * 100}%`, height: `${(span / 10) * 100 + 4}%` }}
              >
                <Block c={t} title={title} className="relative h-full">
                </Block>
                {t === 'red' && <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white">!</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdjustCard({ className = '' }) {
  return (
    <div className={`${card} w-[220px] p-4 ${className}`}>
      <p className="text-sm font-bold text-charcoal">Adjustment Suggestion</p>
      <p className="mt-2 text-[11px] leading-relaxed text-charcoal-light">
        You have 2 deadlines this week. Shall we create more focus time?
      </p>
      <button className="mt-3 w-full rounded-lg bg-brand-500 py-2 text-xs font-semibold text-white shadow-glow transition hover:bg-brand-600">
        Apply plan
      </button>
      <button className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold text-charcoal hover:bg-black/[0.03]">See alternatives</button>
      <div className="my-1.5 h-px bg-black/[0.06]" />
      <button className="w-full py-1 text-xs font-semibold text-sky-700 hover:underline">Keep current plan</button>
    </div>
  );
}

const moods = [
  ['#7FD08A', 'M8 14s1.5 2 4 2 4-2 4-2'],
  ['#F59E8B', 'M8 15.5s1.5-1.5 4-1.5 4 1.5 4 1.5'],
  ['#86D3C8', 'M8.5 15h7'],
  ['#F7A3A3', 'M8 16s1.5-2 4-2 4 2 4 2'],
];

export function CheckinCard({ className = '' }) {
  return (
    <div className={`${card} w-[260px] p-4 ${className}`}>
      <p className="text-sm font-bold text-charcoal">How are you feeling today?</p>
      <div className="mt-3 flex gap-2.5">
        {moods.map(([fill, mouth], i) => (
          <button
            key={i}
            aria-label={`Mood ${i + 1}`}
            className={`rounded-full transition hover:scale-110 ${i === 0 ? 'ring-2 ring-emerald-300 ring-offset-2' : ''}`}
          >
            <svg width="34" height="34" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" fill={fill} />
              <circle cx="9" cy="10" r="1.1" fill="#2A2A28" />
              <circle cx="15" cy="10" r="1.1" fill="#2A2A28" />
              <path d={mouth} stroke="#2A2A28" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        ))}
      </div>
      <div className="mt-3 h-14 rounded-lg border border-black/10 px-3 py-2 text-[11px] text-charcoal-muted">
        Take a moment for yourself…
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button className="flex-1 rounded-lg bg-brand-500 py-2 text-xs font-semibold text-white shadow-glow hover:bg-brand-600">
          Save check-in
        </button>
        <LockIcon size={15} className="text-charcoal" />
      </div>
      <p className="mt-2.5 flex items-center gap-1 text-[10px] text-charcoal-muted">
        <ShieldCheckIcon size={11} /> Your data stays private.
      </p>
    </div>
  );
}

export function WalkCard({ className = '' }) {
  return (
    <div className={`${card} w-[240px] p-3.5 ${className}`}>
      <p className="text-sm font-bold text-charcoal">12-minute walk</p>
      <p className="text-[10px] text-charcoal-muted">Campus Loop</p>
      <div className="relative mt-2.5 h-[110px] overflow-hidden rounded-lg bg-[#E9EFE4]">
        <svg viewBox="0 0 220 110" className="absolute inset-0 h-full w-full">
          <path d="M0 30 L220 45 M40 0 L70 110 M150 0 L130 110 M0 85 L220 70" stroke="#fff" strokeWidth="5" />
          <path d="M0 30 L220 45 M40 0 L70 110 M150 0 L130 110 M0 85 L220 70" stroke="#DCE3D5" strokeWidth="1" />
          <path
            data-route
            d="M35 84 C 40 50, 70 28, 110 26 S 180 30, 186 58 S 150 92, 110 86 S 60 80, 35 84"
            fill="none"
            stroke="#F5811E"
            strokeWidth="3.5"
            strokeLinecap="round"
            pathLength="1"
          />
          <circle cx="35" cy="84" r="5" fill="#1F4D3A" stroke="#fff" strokeWidth="2" />
          <circle cx="186" cy="58" r="5" fill="#F5811E" stroke="#fff" strokeWidth="2" />
        </svg>
      </div>
      <div className="mt-2.5 flex justify-between text-[11px] font-semibold text-charcoal">
        <span>1.2 km</span>
        <span>12 min</span>
        <span>1,580 steps</span>
      </div>
      <button className="mt-2.5 w-full rounded-lg bg-charcoal py-2 text-xs font-semibold text-white hover:bg-charcoal-light">
        Let’s walk
      </button>
    </div>
  );
}
