import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../../shared/lib/cn';
const items = [
    { to: '/app/physical', label: 'Overview', end: true },
    { to: '/app/physical/plan', label: 'Today’s Plan' },
    { to: '/app/physical/exercise', label: 'Movement' },
    { to: '/app/physical/nutrition', label: 'Nutrition' },
    { to: '/app/physical/habits', label: 'Habits' },
    { to: '/app/physical/achievements', label: 'Achievements' },
    { to: '/app/physical/challenges', label: 'Squad Challenges' },
    { to: '/app/physical/progress', label: 'Progress' },
    { to: '/app/physical/adaptation', label: 'AI Adaptation' },
    { to: '/app/physical/profile', label: 'My Profile' }
];
/** Module sub-navigation, styled like the tab strips used elsewhere in IHSD. */
export function PhysicalNav() {
    return (<div className="-mx-1 mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/80 bg-gradient-to-r from-brand-50 via-white to-emerald-50 p-2 shadow-[0_8px_28px_rgba(16,185,129,0.08)] no-scrollbar">
      {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn('shrink-0 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-cream', isActive ? 'border-brand-400/70 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-white shadow-[0_6px_18px_rgba(16,185,129,0.32)] ring-1 ring-white/40 hover:-translate-y-0.5 hover:brightness-105' : 'border-brand-100/90 bg-white/80 text-brand-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5 hover:border-brand-300 hover:bg-white hover:shadow-[0_5px_14px_rgba(16,185,129,0.14)]')}>
          {i.label}
        </NavLink>)}
    </div>);
}
