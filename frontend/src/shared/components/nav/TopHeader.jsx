import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, BellIcon } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import { notifications } from '../../lib/data';
import useStudent from '../../hooks/useStudent';
export function TopHeader() {
    const student = useStudent();
    const navigate = useNavigate();
    const unread = notifications.filter((n) => n.unread).length;
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12)
            return 'Good morning';
        if (h < 18)
            return 'Good afternoon';
        return 'Good evening';
    })();
    return (<header className="sticky top-0 z-30 bg-cream/80 backdrop-blur-xl border-b border-black/[0.04]">
      <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
        {/* Mobile logo */}
        <button className="lg:hidden" onClick={() => navigate('/app')}>
          <Logo size={32} showText={false}/>
        </button>

        <div className="hidden sm:block">
          <h1 className="text-base sm:text-lg font-extrabold text-charcoal leading-tight">
            {greeting}, {student.name} <span aria-hidden>👋</span>
          </h1>
          <p className="text-xs text-charcoal-muted font-medium">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="flex-1"/>

        <div className="hidden md:flex items-center gap-2 bg-white rounded-full pl-4 pr-2 py-2 border border-black/[0.05] shadow-soft w-64">
          <SearchIcon size={16} className="text-charcoal-muted"/>
          <input placeholder="Search tasks, insights…" className="bg-transparent text-sm outline-none flex-1 placeholder:text-charcoal-muted text-charcoal"/>
        </div>

        <button onClick={() => navigate('/app/notifications')} className="relative w-10 h-10 rounded-full bg-white border border-black/[0.05] shadow-soft flex items-center justify-center text-charcoal-light hover:text-charcoal transition-colors" aria-label="Notifications">
          <BellIcon size={18}/>
          {unread > 0 &&
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-cream">
              {unread}
            </span>}
        </button>

        <button onClick={() => navigate('/app/profile')} aria-label="Profile">
          <Avatar src={student.avatar} name={student.fullName} size={40} ring/>
        </button>
      </div>
    </header>);
}
