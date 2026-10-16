import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartPulseIcon, ZapIcon, LeafIcon, FlameIcon } from 'lucide-react';

/*
 * Images rotate every 1.5 s.
 * Local images are served from /public/img/ 
 * Unsplash fallback URLs for stretching & running.
 */
const SLIDES = [
    {
        src: '/img/pw_workout.png',
        label: 'Workout',
        emoji: '💪',
        tagline: 'Sweat it out!',
        accent: '#16a34a',
    },
    {
        src: '/img/pw_meal.png',
        label: 'Healthy Meal',
        emoji: '🥗',
        tagline: 'Fuel your body!',
        accent: '#f59e0b',
    },
    {
        src: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=900&q=80',
        label: 'Stretching',
        emoji: '🧘',
        tagline: 'Stay flexible!',
        accent: '#6366f1',
    },
    {
        src: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=900&q=80',
        label: 'Running',
        emoji: '🏃',
        tagline: 'Keep moving!',
        accent: '#ec4899',
    },
];

const MOTIVATIONS = [
    "You're doing amazing — keep that energy going! 🚀",
    "Small steps every day add up to big results! 🌟",
    "Your body is your most powerful tool — treat it well! 💎",
    "Every rep, every meal counts. You've got this! 🔥",
    "Consistency is your superpower. Stay the course! ⚡",
    "Your health journey is progress, not perfection! 🌱",
];

function ActivePulse({ isActive }) {
    return (
        <span className="flex items-center gap-1.5">
            <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-400'
                    }`}
            >
                {isActive && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
            </span>
            <span
                className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-emerald-600' : 'text-slate-500'
                    }`}
            >
                {isActive ? 'Active' : 'Inactive'}
            </span>
        </span>
    );
}

export function WellbeingHeroBanner({ studentName = 'Student', isActive = false, motivationIndex = 0 }) {
    const [slideIdx, setSlideIdx] = useState(0);
    const [motIdx, setMotIdx] = useState(motivationIndex % MOTIVATIONS.length);
    const intervalRef = useRef(null);

    /* Cycle images every 1.5 s */
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            setSlideIdx((i) => (i + 1) % SLIDES.length);
        }, 3500);
        return () => clearInterval(intervalRef.current);
    }, []);

    /* Cycle motivation every 6 s */
    useEffect(() => {
        const ref = setInterval(() => {
            setMotIdx((i) => (i + 1) % MOTIVATIONS.length);
        }, 6000);
        return () => clearInterval(ref);
    }, []);

    const slide = SLIDES[slideIdx];

    const hour = new Date().getHours();
    const greeting =
        hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return (
        <div
            className="relative w-full overflow-hidden rounded-3xl shadow-card"
            style={{ minHeight: 220 }}
        >
            {/* Stacked crossfade — all images always in DOM, active one fades in on top */}
            {SLIDES.map((s, i) => (
                <motion.div
                    key={s.src}
                    className="absolute inset-0"
                    style={{ zIndex: i === slideIdx ? 2 : 1 }}
                    animate={{ opacity: i === slideIdx ? 1 : 0 }}
                    transition={{ duration: 0.7, ease: 'easeInOut' }}
                >
                    <img
                        src={s.src}
                        alt={s.label}
                        className="h-full w-full object-cover object-center"
                        loading={i === 0 ? 'eager' : 'lazy'}
                    />
                    {/* dark gradient so text stays readable regardless of image */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0d1a2d]/85 via-[#0d1a2d]/55 to-transparent" />
                </motion.div>
            ))}

            {/* Content */}
            <div className="relative z-20 flex flex-col justify-between p-6 sm:p-8 h-full" style={{ minHeight: 220 }}>
                {/* Top row: heading + active status */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        {/* Heading */}
                        <motion.div
                            className="flex items-center gap-2.5 mb-1"
                            initial={{ y: -8, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                                <HeartPulseIcon size={18} className="text-white" />
                            </span>
                            <h1 className="text-white font-extrabold text-xl sm:text-2xl tracking-tight drop-shadow">
                                Physical Wellbeing
                            </h1>
                        </motion.div>
                        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest">
                            Your adaptive health companion
                        </p>
                    </div>

                    {/* Active badge */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 px-3 py-1.5">
                            <ActivePulse isActive={isActive} />
                        </div>

                    </div>
                </div>

                {/* Bottom: greeting + motivation */}
                <div className="mt-6">
                    {/* Greeting */}
                    <p className="text-white/80 text-sm font-semibold">
                        {greeting}, <span className="text-white font-extrabold">{studentName}</span> 👋
                    </p>

                    {/* Personal active/inactive message */}
                    <p className="text-white font-extrabold text-lg sm:text-xl leading-snug mt-1 drop-shadow max-w-md">
                        {isActive
                            ? "You're active today — I'm here to keep you at your best! 💪"
                            : "I'm your wellbeing companion — physical health matters today!"}
                    </p>

                    {/* Rotating motivation quote */}
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={motIdx}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.45 }}
                            className="mt-2 text-white/75 text-sm leading-relaxed max-w-sm"
                        >
                            {MOTIVATIONS[motIdx]}
                        </motion.p>
                    </AnimatePresence>

                    {/* Slide dot indicators */}
                    <div className="mt-4 flex items-center gap-1.5">
                        {SLIDES.map((s, i) => (
                            <button
                                key={s.label}
                                onClick={() => setSlideIdx(i)}
                                aria-label={`View ${s.label}`}
                                className="transition-all duration-300"
                            >
                                <span
                                    className="block rounded-full transition-all duration-300"
                                    style={{
                                        width: i === slideIdx ? 20 : 6,
                                        height: 6,
                                        backgroundColor: i === slideIdx ? slide.accent : 'rgba(255,255,255,0.35)',
                                    }}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
