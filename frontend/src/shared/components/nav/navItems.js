import { LayoutDashboardIcon, CalendarDaysIcon, ListTodoIcon, TimerIcon, HeartPulseIcon, TrophyIcon, LineChartIcon, BriefcaseIcon, SparklesIcon, SettingsIcon, ShieldCheckIcon, FlaskConicalIcon, DumbbellIcon } from 'lucide-react';
export const primaryNav = [
    { to: '/app', label: 'Overview', icon: LayoutDashboardIcon },
    { to: '/app/schedule', label: 'My Schedule', icon: CalendarDaysIcon },
    { to: '/app/tasks', label: 'Tasks', icon: ListTodoIcon },
    { to: '/app/focus', label: 'Focus', icon: TimerIcon },
    { to: '/app/wellbeing', label: 'Wellbeing', icon: HeartPulseIcon },
    { to: '/app/physical', label: 'Physical', icon: DumbbellIcon },
    { to: '/app/progress', label: 'Progress', icon: TrophyIcon },
    { to: '/app/insights', label: 'Insights', icon: LineChartIcon },
    { to: '/app/career', label: 'Career', icon: BriefcaseIcon }
];
export const secondaryNav = [
    { to: '/app/insights', label: 'AI Insights', icon: SparklesIcon },
    { to: '/app/privacy', label: 'Privacy', icon: ShieldCheckIcon },
    { to: '/app/research', label: 'Research', icon: FlaskConicalIcon },
    { to: '/app/settings', label: 'Settings', icon: SettingsIcon }
];
