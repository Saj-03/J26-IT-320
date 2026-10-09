import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SettingsIcon, LogOutIcon } from 'lucide-react';
import { primaryNav, secondaryNav } from './navItems';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';
import useStudent from '../../hooks/useStudent';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/cn';
export function Sidebar() {
    const student = useStudent();
    const { logout } = useAuth();
    const navigate = useNavigate();
    return (<aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-black/[0.05] px-4 py-6">
      <div className="px-2 mb-8">
        <button onClick={() => navigate('/app')} className="flex items-center">
          <Logo size={36} textClass="text-lg"/>
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar">
        {primaryNav.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/app'} className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-colors', isActive ? 'bg-brand-500 text-white shadow-glow' : 'text-charcoal-light hover:bg-black/[0.04]')}>
            <item.icon size={18}/>
            {item.label}
          </NavLink>)}

        <div className="pt-4 mt-4 border-t border-black/[0.05] space-y-1">
          <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-charcoal-muted">More</p>
          {secondaryNav.map((item) => <NavLink key={item.label} to={item.to} className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-colors', isActive ? 'bg-brand-50 text-brand-700' : 'text-charcoal-light hover:bg-black/[0.04]')}>
              <item.icon size={18}/>
              {item.label}
            </NavLink>)}
        </div>
      </nav>

      <button onClick={() => navigate('/app/profile')} className="mt-4 flex items-center gap-3 p-2.5 rounded-2xl hover:bg-black/[0.04] transition-colors text-left">
        <Avatar src={student.avatar} name={student.fullName} size={40} ring/>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-charcoal truncate">{student.name}</p>
          <p className="text-xs text-brand-600 font-semibold">
            Level {student.level} {student.levelName}
          </p>
        </div>
        <SettingsIcon size={16} className="text-charcoal-muted shrink-0"/>
      </button>
      <button onClick={() => { logout(); navigate('/login'); }} className="mt-1 flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold text-charcoal-light hover:bg-black/[0.04] transition-colors">
        <LogOutIcon size={18}/>
        Sign out
      </button>
    </aside>);
}
