import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon } from 'lucide-react';

export const PHYSICAL_MASTER_SLIDES = [
  { src: '/img/pw_workout.png', label: 'Workout session', accent: '#7dd3fc' },
  { src: '/img/pw_meal.png', label: 'Balanced meal', accent: '#fcd34d' },
  { src: '/39c988fa-df0e-4099-8c60-91d3bf4a11aa.jpg', label: 'Rice and curry', accent: '#c4b5fd' },
  { src: '/img/ChatGPT%20Image%20Sep%2024,%202026,%2009_33_35%20AM%20(4).png', label: 'Campus walk', accent: '#fda4af' },
];

const MASTER_IMAGE_SETS = {
  movement: [
    { src: '/img/pw_workout.png', label: 'Workout session', accent: '#7dd3fc' },
    { src: '/9269aefa-f432-481e-9b47-c5d3b25db6a3.jpg', label: 'At-home movement', accent: '#fcd34d' },
    { src: '/img/ChatGPT%20Image%20Sep%2024,%202026,%2009_33_26%20AM%20(1).png', label: 'Campus walk', accent: '#c4b5fd' },
    { src: '/img/ChatGPT%20Image%20Sep%2024,%202026,%2009_33_35%20AM%20(4).png', label: 'Students walking', accent: '#fda4af' },
  ],
  nutrition: [
    { src: '/img/pw_meal.png', label: 'Balanced meal', accent: '#7dd3fc' },
    { src: '/39c988fa-df0e-4099-8c60-91d3bf4a11aa.jpg', label: 'Rice and curry', accent: '#fcd34d' },
    { src: '/29a98ebd-e302-4ac6-81f6-4da7c5c23863.jpg', label: 'Fresh salad', accent: '#c4b5fd' },
    { src: '/67a05d45-ab91-4e9b-9572-455e2228a1d0.jpg', label: 'Dhal and fruit', accent: '#fda4af' },
  ],
};

export function PhysicalMasterCard({
  title,
  subtitle,
  eyebrow = 'Your physical wellbeing',
  children,
  imageSet = 'wellbeing',
  className = '',
}) {
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = MASTER_IMAGE_SETS[imageSet] || PHYSICAL_MASTER_SLIDES;

  useEffect(() => {
    const interval = window.setInterval(() => {
          setSlideIndex((index) => (index + 1) % slides.length);
    }, 3500);
    return () => window.clearInterval(interval);
  }, [slides]);

  return (
    <section className={`relative isolate min-h-[220px] overflow-hidden rounded-[1.75rem] bg-slate-950 px-5 py-5 text-white shadow-lg sm:px-7 sm:py-6 ${className}`}>
      <div className="pointer-events-none absolute inset-0 z-0">
        {slides.map((slide, index) => (
          <motion.div
            key={slide.src}
            className="absolute inset-0"
            style={{ zIndex: index === slideIndex ? 2 : 1 }}
            animate={{ opacity: index === slideIndex ? 1 : 0 }}
            transition={{ duration: 0.7, ease: 'easeInOut' }}
          >
            <img src={slide.src} alt="" aria-hidden="true" className="h-full w-full object-cover object-center" loading={index === 0 ? 'eager' : 'lazy'} />
          </motion.div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-slate-950/90 via-slate-950/65 to-slate-950/30" />

      <div className="relative z-20 flex min-h-[168px] flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div className="max-w-2xl">
          <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-100 backdrop-blur-sm">
            <SparklesIcon size={14} className="text-amber-300" /> {eyebrow}
          </div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-100/85">{subtitle}</p>}
          <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
            {slides.map((slide, index) => (
              <span key={slide.label} className="block h-1.5 rounded-full transition-all duration-300" style={{ width: index === slideIndex ? 20 : 6, backgroundColor: index === slideIndex ? slide.accent : 'rgba(255,255,255,0.45)' }} />
            ))}
          </div>
        </div>
        {children && <div className="w-full shrink-0 xl:w-[410px]">{children}</div>}
      </div>
    </section>
  );
}
