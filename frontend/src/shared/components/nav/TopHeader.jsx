import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, BellIcon } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import useNotifications, { relativeTime } from '../../../features/scheduler/hooks/useNotifications';
import useStudent from '../../hooks/useStudent';
export function TopHeader() {
    const student = useStudent();
    const navigate = useNavigate();
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const { items = [], unread, loaded } = useNotifications();
    const recentNotifications = items.slice(0, 4);
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

        <div className="relative">
          <button onClick={() => setNotificationsOpen((open) => !open)} aria-expanded={notificationsOpen} aria-haspopup="true" className="relative w-10 h-10 rounded-full bg-white border border-black/[0.05] shadow-soft flex items-center justify-center text-charcoal-light hover:text-charcoal transition-colors" aria-label="Notifications">
            <BellIcon size={18}/>
            {unread > 0 &&
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-cream">
                {unread}
              </span>}
          </button>
          {notificationsOpen && <div role="dialog" aria-label="Recent notifications" className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <p className="text-sm font-extrabold text-charcoal">Notifications</p>
              {unread > 0 && <span className="text-xs font-semibold text-brand-600">{unread} new</span>}
            </div>
            <div className="max-h-[min(24rem,65vh)] overflow-y-auto">
              {!loaded ? <p className="px-4 py-6 text-sm text-charcoal-muted">Loading notifications…</p>
                : recentNotifications.length === 0 ? <p className="px-4 py-6 text-sm text-charcoal-muted">No notifications yet. Workout reminders will appear here when their time starts.</p>
                  : recentNotifications.map((notification) => <button key={notification.id} onClick={() => { setNotificationsOpen(false); navigate(notification.link); }} className="block w-full border-b border-black/[0.05] px-4 py-3 text-left transition-colors hover:bg-cream/60 last:border-b-0">
                    <span className="flex items-start gap-2">
                      {notification.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-charcoal">{notification.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-charcoal-muted">{notification.body}</span>
                        <span className="mt-1 block text-[11px] text-charcoal-muted">{notification.category} · {relativeTime(notification.at)}</span>
                      </span>
                    </span>
                  </button>)}
            </div>
            <button onClick={() => { setNotificationsOpen(false); navigate('/app/notifications'); }} className="w-full border-t border-black/[0.06] px-4 py-3 text-left text-xs font-bold text-brand-600 hover:bg-brand-50">View all notifications</button>
          </div>}
        </div>

        <button onClick={() => navigate('/app/profile')} aria-label="Profile">
          <Avatar src={student.avatar} name={student.fullName} size={40} ring/>
        </button>
      </div>
    </header>);
}
