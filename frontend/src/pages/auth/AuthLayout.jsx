import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ArrowLeftIcon, EyeIcon, EyeOffIcon, CheckIcon, FlameIcon } from 'lucide-react';
import { HeroScene } from '../landing/HeroScene';
import { BlobDefs } from '../landing/Blobs';

const MOBILE_IMG = encodeURI('/img/ChatGPT Image Sep 24, 2026, 09_33_35 AM (4).png');

const copy = {
  login: {
    quote: 'Progress is not about doing everything. It is about doing the right things at the right time.',
    note: <>Same path<br />A brighter you</>,
    switchText: 'New to IHUSD?',
    switchLink: { to: '/register', label: 'Create an account' },
  },
  register: {
    quote: 'University is more than a destination — it’s a journey. Start yours with a clearer week.',
    note: <>Different paths<br />Brighter tomorrows</>,
    switchText: 'Already have an account?',
    switchLink: { to: '/login', label: 'Log in' },
  },
};

function WeekSoFarCard() {
  const rows = [
    ['Study plan', '72%', 72, 'bg-brand-500'],
    ['Wellbeing check-ins', '4 / 5', 80, 'bg-emerald-500'],
    ['Steps goal', '8,240', 64, 'bg-sky-500'],
  ];
  return (
    <div className="w-[250px] rounded-2xl border border-black/[0.06] bg-white/95 p-4 shadow-lift backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="font-serif text-lg font-semibold italic text-charcoal">Your week so far</p>
        <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
          <FlameIcon size={12} /> 14
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {rows.map(([label, value, pct, bar]) => (
          <div key={label}>
            <div className="flex justify-between text-[11px] font-semibold">
              <span className="text-charcoal">{label}</span>
              <span className="text-charcoal-light">{value}</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-black/[0.06]">
              <div data-auth-bar style={{ width: `${pct}%` }} className={`h-full origin-left rounded-full ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FirstStepsCard() {
  const steps = [
    ['Create your account', true],
    ['Explore career matches', false],
    ['Plan your first week', false],
    ['Take a 1-minute check-in', false],
  ];
  return (
    <div className="w-[250px] rounded-2xl border border-black/[0.06] bg-white/95 p-4 shadow-lift backdrop-blur">
      <p className="font-serif text-lg font-semibold italic text-charcoal">Your first steps</p>
      <ul className="mt-3 space-y-2.5">
        {steps.map(([label, done], i) => (
          <li key={label} data-auth-step className="flex items-center gap-2.5 text-[12px] font-medium text-charcoal">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                done ? 'bg-brand-500 text-white' : 'border border-black/15 text-charcoal-muted'
              }`}
            >
              {done ? <CheckIcon size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className={done ? 'text-charcoal-muted line-through decoration-brand-300' : ''}>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Shared shell for Login / Register: layered campus scene on the left, form on the right. */
export function AuthLayout({ variant = 'login', children }) {
  const root = useRef(null);
  const c = copy[variant];

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // fromTo (not from): several targets carry CSS transitions, and under StrictMode's
        // double effect a from() would read a half-faded opacity as its end value
        gsap.fromTo('[data-auth-in]', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.07, ease: 'power3.out', delay: 0.1 });
        // swoosh is revealed top → bottom (dash tricks break on a stretched, non-scaling stroke)
        gsap.fromTo('[data-auth-draw]', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 2.2, ease: 'power2.inOut', delay: 0.4 });
        gsap.fromTo('[data-auth-card]', { x: -40, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.1, ease: 'power3.out', delay: 2.6 });
        gsap.to('[data-auth-float]', { y: -8, duration: 3.2, ease: 'sine.inOut', repeat: -1, yoyo: true });
        gsap.from('[data-auth-bar]', { scaleX: 0, duration: 1.2, stagger: 0.15, ease: 'power3.out', delay: 3 });
        gsap.fromTo('[data-auth-step]', { x: -12, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.5, stagger: 0.12, ease: 'power2.out', delay: 3 });
        gsap.fromTo('[data-auth-quote]', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, ease: 'power3.out', delay: 1.2 });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="min-h-screen w-full bg-cream text-charcoal lg:grid lg:grid-cols-[1.08fr_1fr]">
      <BlobDefs />

      {/* ── visual (desktop) ── */}
      <aside className="relative hidden lg:sticky lg:top-0 lg:block lg:h-screen">
        <div className="absolute inset-0 [clip-path:url(#blob-auth)]">
          <HeroScene mode="intro" studentsClass="h-[50%] xl:h-[56%]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#1F2A2E]/75 via-[#1F2A2E]/25 to-transparent" />
        </div>

        <Link
          to="/"
          data-auth-in
          className="absolute left-10 top-8 z-20 flex items-center gap-2.5 rounded-full bg-white/80 py-2 pl-4 pr-5 shadow-soft backdrop-blur transition hover:bg-white"
        >
          <span className="font-serif text-xl font-bold tracking-tight text-charcoal">IHUSD</span>
          <span className="text-[9px] leading-[1.2] text-charcoal-light">
            Immersive Holistic
            <br />
            Undergraduate Student Development
          </span>
        </Link>

        <p className="pointer-events-none absolute right-[12%] top-[9%] z-20 rotate-[-8deg] font-hand text-[26px] leading-[1.05] text-white [text-shadow:0_1px_10px_rgba(0,0,0,.5)]">
          {c.note}
        </p>

        <div data-auth-card className="absolute left-10 top-[24%] z-20">
          <div data-auth-float>{variant === 'login' ? <WeekSoFarCard /> : <FirstStepsCard />}</div>
        </div>

        <blockquote data-auth-quote className="absolute bottom-12 left-10 right-[16%] z-20 text-white">
          <p className="font-serif text-[clamp(1.4rem,2vw,2rem)] font-medium leading-snug">“{c.quote}”</p>
        </blockquote>

        {/* orange swoosh riding the seam */}
        <svg data-auth-draw className="pointer-events-none absolute -right-10 inset-y-0 z-20 h-full w-44" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path
            d="M30 -2 C 95 18, 5 38, 62 55 S 30 88, 96 104"
            fill="none"
            stroke="#F5811E"
            strokeWidth="6"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </aside>

      {/* ── form ── */}
      <main className="relative flex min-h-screen flex-col">
        {/* mobile image band */}
        <div className="relative h-56 overflow-hidden rounded-b-[40px] lg:hidden">
          <img src={MOBILE_IMG} alt="" className="h-full w-full object-cover object-[35%_40%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/30" />
          <Link to="/" className="absolute left-5 top-5 rounded-full bg-white/85 px-4 py-1.5 font-serif text-lg font-bold backdrop-blur">
            IHUSD
          </Link>
          <p className="absolute bottom-5 right-6 rotate-[-6deg] font-hand text-2xl leading-none text-white drop-shadow">{c.note}</p>
        </div>

        <div className="flex items-center justify-between px-6 pt-6 lg:px-14 lg:pt-8">
          <Link to="/" data-auth-in className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-light transition hover:text-charcoal">
            <ArrowLeftIcon size={15} /> Back to home
          </Link>
          <p data-auth-in className="hidden text-sm text-charcoal-muted sm:block">
            {c.switchText}{' '}
            <Link to={c.switchLink.to} className="font-semibold text-brand-600 hover:text-brand-700">
              {c.switchLink.label}
            </Link>
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-14">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>

        <p data-auth-in className="px-6 pb-6 text-center text-xs text-charcoal-muted lg:px-14">
          Your data stays private · Immersive Holistic Undergraduate Student Development System © 2026
        </p>
      </main>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, accent, sub }) {
  return (
    <div className="mb-8">
      <p data-auth-in className="text-[11px] font-semibold uppercase tracking-[0.22em] text-charcoal-light">{eyebrow}</p>
      <h1 data-auth-in className="mt-3 font-serif text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-charcoal sm:text-5xl">
        {title} <span className="text-brand-500">{accent}</span>
      </h1>
      {sub && <p data-auth-in className="mt-3 text-[15px] leading-relaxed text-charcoal-light">{sub}</p>}
    </div>
  );
}

/* Input with a leading icon; password inputs get a show/hide toggle. */
export function AuthField({ label, icon: Icon, type = 'text', id, name, hint, className = '', ...props }) {
  const [show, setShow] = useState(false);
  const isPw = type === 'password';
  const fieldId = id || name;
  return (
    <div data-auth-in className={`space-y-1.5 ${className}`}>
      <label htmlFor={fieldId} className="text-[13px] font-semibold text-charcoal">
        {label}
      </label>
      <div className="group relative">
        {Icon && (
          <Icon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-charcoal-muted transition group-focus-within:text-brand-500" />
        )}
        <input
          id={fieldId}
          name={name}
          type={isPw && show ? 'text' : type}
          className={`w-full rounded-xl border border-black/10 bg-white py-3.5 text-sm text-charcoal shadow-[0_1px_2px_rgba(42,42,40,0.04)] outline-none transition placeholder:text-charcoal-muted focus:border-brand-400 focus:ring-4 focus:ring-brand-400/15 ${
            Icon ? 'pl-11' : 'pl-4'
          } ${isPw ? 'pr-11' : 'pr-4'}`}
          {...props}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-charcoal-muted transition hover:text-charcoal"
          >
            {show ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-charcoal-muted">{hint}</p>}
    </div>
  );
}

export function AuthSubmit({ busy, children, busyLabel }) {
  return (
    <button
      data-auth-in
      type="submit"
      disabled={busy}
      className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-500 py-3.5 text-[15px] font-semibold text-white shadow-glow transition hover:bg-brand-600 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
    >
      {busy ? busyLabel : children}
    </button>
  );
}

export function AuthError({ children }) {
  if (!children) return null;
  return <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700">{children}</p>;
}
