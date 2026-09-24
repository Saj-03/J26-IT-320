import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboardIcon, CalendarDaysIcon, TimerIcon, HeartPulseIcon, UserIcon, PlusIcon, ListPlusIcon, PlayIcon, SmileIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../lib/cn';
const items = [
    { to: '/app', label: 'Home', icon: LayoutDashboardIcon, end: true },
    { to: '/app/schedule', label: 'Schedule', icon: CalendarDaysIcon },
    { to: '/app/focus', label: 'Focus', icon: TimerIcon },
    { to: '/app/wellbeing', label: 'Wellbeing', icon: HeartPulseIcon },
    { to: '/app/profile', label: 'Profile', icon: UserIcon }
];
const fabActions = [
    { label: 'Add Task', icon: ListPlusIcon, to: '/app/add-task' },
    { label: 'Start Focus', icon: PlayIcon, to: '/app/focus' },
    { label: 'Check-in', icon: SmileIcon, to: '/app/mood' }
];
export function MobileBottomNav() {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    return (<>
      {/* Floating action button + menu */}
      <div className="lg:hidden fixed bottom-24 right-5 z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {open &&
            fabActions.map((a, i) => <motion.button key={a.label} initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.9 }} transition={{ delay: i * 0.04 }} onClick={() => {
                    setOpen(false);
                    navigate(a.to);
                }} className="flex items-center gap-2.5 bg-white shadow-lift rounded-full pl-4 pr-2 py-2 border border-black/[0.05]">
                <span className="text-sm font-semibold text-charcoal">{a.label}</span>
                <span className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
                  <a.icon size={16}/>
                </span>
              </motion.button>)}
        </AnimatePresence>
        <motion.button onClick={() => setOpen((o) => !o)} animate={{ rotate: open ? 45 : 0 }} className="w-14 h-14 rounded-full bg-brand-500 text-white flex items-center justify-center shadow-glow" aria-label="Quick actions">
          <PlusIcon size={26}/>
        </motion.button>
      </div>

      {open && <div className="lg:hidden fixed inset-0 z-30 bg-charcoal/10" onClick={() => setOpen(false)}/>}

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-xl border-t border-black/[0.05] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around px-2 py-2">
          {items.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn('flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-colors', isActive ? 'text-brand-600' : 'text-charcoal-muted')}>
              {({ isActive }) => <>
                  <span className={cn('flex items-center justify-center', isActive && 'scale-110 transition-transform')}>
                    <item.icon size={22} strokeWidth={isActive ? 2.4 : 2}/>
                  </span>
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </>}
            </NavLink>)}
        </div>
      </nav>
    </>);
}
