// Small helpers shared by the scheduler pages (no data here - everything comes from the API).
import { utcMs } from './api';

// Colours for effort badges and the wellbeing banner (style only, not data)
export const loadStyles = {
    Heavy: { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500' },
    Medium: { bg: 'bg-amber-light', text: 'text-amber-700', dot: 'bg-amber-soft' },
    Light: { bg: 'bg-sage-light', text: 'text-emerald-700', dot: 'bg-sage' },
    Break: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400' }
};
export const stressStyles = {
    Low: { bg: 'bg-sage-light', border: 'border-emerald-100', text: 'text-emerald-700', dot: 'bg-sage' },
    Medium: { bg: 'bg-amber-light', border: 'border-amber-200/60', text: 'text-amber-700', dot: 'bg-amber-soft' },
    High: { bg: 'bg-brand-50', border: 'border-brand-100', text: 'text-brand-700', dot: 'bg-brand-500' }
};

// Backend load words <-> the labels the UI badges use
export const LOAD_LABEL = { heavy: 'Heavy', medium: 'Medium', low: 'Light' };
export const LOAD_VALUE = { Heavy: 'heavy', Medium: 'medium', Light: 'low' };

// Priority 1..5 <-> high / medium / low (TaskCard, forms)
export const priorityWord = (p) => (p >= 4 ? 'high' : p === 3 ? 'medium' : 'low');
export const PRIORITY_NUMBER = { high: 4, medium: 3, low: 2 };

// Backend sends UTC without "Z" -> a Date in the student's own time
export const toDate = (iso) => (iso ? new Date(utcMs(iso)) : null);

export const timeText = (iso) => toDate(iso)?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? '';
export const dayText = (iso) => toDate(iso)?.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) ?? '';
export const sameDay = (a, b) => a && b && a.toDateString() === b.toDateString();

export const isOpen = (t) => t.status === 'pending' || t.status === 'in_progress';

// "Due in 3 days" / "Overdue"
export function dueText(iso) {
    const ms = utcMs(iso) - Date.now();
    if (ms < 0) return 'Overdue';
    const hours = ms / 3600000;
    return hours < 48 ? `Due in ${Math.round(hours)} h` : `Due in ${Math.round(hours / 24)} days`;
}

// Greeting by the current time of day (moved here from the old mock data file)
export function getGreeting(date = new Date()) {
    const h = date.getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
}

// Name shown next to the level number (level = 1 + XP / 200, from the backend)
const LEVEL_NAMES = ['Starter', 'Learner', 'Explorer', 'Achiever', 'Scholar', 'Expert', 'Master'];
export const levelName = (level) => LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1] ?? 'Starter';

// "16:00, 20:00, 21:00" for separate hours like [21, 20, 16] (no misleading range)
export function hoursList(hours) {
    const fmt = (h) => `${String(h % 24).padStart(2, '0')}:00`;
    return [...(hours ?? [])].sort((a, b) => a - b).map(fmt).join(', ');
}

// "9 AM – 11 AM" style label for a list of peak hours like [20, 21, 19]
export function hoursLabel(hours) {
    if (!hours?.length) return '';
    const sorted = [...hours].sort((a, b) => a - b);
    const fmt = (h) => new Date(2000, 0, 1, h % 24).toLocaleTimeString([], { hour: 'numeric' });
    return `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1] + 1)}`;
}
