import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../../shared/lib/cn';
const items = [
    { to: '/app/physical', label: 'Overview', end: true },
    { to: '/app/physical/plan', label: 'Today’s Plan' },
    { to: '/app/physical/exercise', label: 'Exercise' },
    { to: '/app/physical/nutrition', label: 'Nutrition' },
    { to: '/app/physical/activity', label: 'Activity' },
    { to: '/app/physical/habits', label: 'Habits' },
    { to: '/app/physical/achievements', label: 'Achievements' },
    { to: '/app/physical/progress', label: 'Progress' },
    { to: '/app/physical/adaptation', label: 'AI Adaptation' },
    { to: '/app/physical/profile', label: 'My Profile' }
];
/** Module sub-navigation, styled like the tab strips used elsewhere in IHSD. */
export function PhysicalNav() {
    return (<div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 mb-6">
      {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cn('shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors', isActive ? 'bg-charcoal text-white' : 'bg-white text-charcoal-light border border-black/[0.05]')}>
          {i.label}
        </NavLink>)}
    </div>);
}
