import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon } from 'lucide-react';

export const PHYSICAL_MASTER_SLIDES = [
  { src: '/img/ChatGPT%20Image%20Sep%2024,%202026,%2009_33_26%20AM%20(1).png', label: 'Campus walk', accent: '#7dd3fc' },
  { src: '/img/ChatGPT%20Image%20Sep%2024,%202026,%2009_33_29%20AM%20(2).png', label: 'Study break', accent: '#fcd34d' },
  { src: '/img/ChatGPT%20Image%20Sep%2024,%202026,%2009_33_31%20AM%20(3).png', label: 'Mindful rest', accent: '#c4b5fd' },
  { src: '/img/ChatGPT%20Image%20Sep%2024,%202026,%2009_33_35%20AM%20(4).png', label: 'Move together', accent: '#fda4af' },
];

export function PhysicalMasterCard({
  title,
  subtitle,
  eyebrow = 'Your physical wellbeing',
  actions,
  children,
  className = '',
}) {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSlideIndex((index) => (index + 1) % PHYSICAL_MASTER_SLIDES.length);
    }, 3500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className={`relative isolate min-h-[220px] overflow-hidden rounded-[1.75rem] bg-slate-950 px-5 py-5 text-white shadow-lg sm:px-7 sm:py-6 ${className}`}>
      <div className="pointer-events-none absolute inset-0 z-0">
        {PHYSICAL_MASTER_SLIDES.map((slide, index) => (
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
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
          <div className="mt-4 flex items-center gap-1.5" aria-label="Hero images">
            {PHYSICAL_MASTER_SLIDES.map((slide, index) => (
              <button key={slide.label} type="button" onClick={() => setSlideIndex(index)} aria-label={`Show ${slide.label} image`} className="transition-all duration-300">
                <span className="block h-1.5 rounded-full transition-all duration-300" style={{ width: index === slideIndex ? 20 : 6, backgroundColor: index === slideIndex ? slide.accent : 'rgba(255,255,255,0.45)' }} />
              </button>
            ))}
          </div>
        </div>
        {children && <div className="w-full shrink-0 xl:w-[410px]">{children}</div>}
      </div>
    </section>
  );
}
