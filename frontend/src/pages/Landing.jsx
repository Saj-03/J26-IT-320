import React, { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRightIcon, PlayIcon, ChevronDownIcon } from 'lucide-react';
import { HeroScene } from './landing/HeroScene';
import { BlobDefs } from './landing/Blobs';
import { WeekCard, CareerMatchCard, PlannerCard, AdjustCard, CheckinCard, WalkCard } from './landing/Mockups';

gsap.registerPlugin(ScrollTrigger);

const img = (name) => encodeURI(`/img/ChatGPT Image Sep 24, 2026, ${name}.png`);
const IMG = {
  campus: img('09_33_26 AM (1)'),
  career: img('09_33_29 AM (2)'),
  calm: img('09_33_31 AM (3)'),
  walk: img('09_33_35 AM (4)'),
  campusBg: '/img/Hero1/01-campus-background.png',
};

function Note({ children, className = '' }) {
  return (
    <p className={`pointer-events-none absolute hidden font-hand text-[22px] leading-[1.05] text-charcoal-light lg:block ${className}`}>
      {children}
    </p>
  );
}

function Eyebrow({ children }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal-light">{children}</p>;
}

function TextLink({ to, children }) {
  return (
    <Link to={to} className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-600">
      {children}
      <ArrowRightIcon size={15} className="transition group-hover:translate-x-1" />
    </Link>
  );
}

/*
 * Full-bleed feature row: an organic image blob on one side, a floating UI card
 * straddling its edge, copy on the other side.
 */
function Feature({ id, side = 'left', image, imagePos = '50% 50%', eyebrow, title, body, link, card, cardClass, notes, tint = '' }) {
  const left = side === 'left';
  return (
    <section id={id} className={`relative overflow-hidden ${tint}`}>
      <div className="mx-auto grid max-w-7xl items-center gap-24 px-5 py-14 lg:min-h-[480px] lg:grid-cols-2 lg:gap-0 lg:px-10 lg:py-20">
        {/* image blob */}
        <div
          className={`relative h-[300px] sm:h-[380px] lg:absolute lg:inset-y-0 lg:h-auto lg:w-[52%] ${left ? 'lg:left-0' : 'lg:right-0 lg:order-2'}`}
        >
          <div
            className={`absolute inset-0 overflow-hidden rounded-[32px] lg:rounded-none ${left ? 'lg:[clip-path:url(#blob-l)]' : 'lg:[clip-path:url(#blob-r)]'}`}
          >
            <div data-parallax className="absolute inset-x-0 -top-[8%] h-[116%]">
              <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: imagePos }} />
            </div>
          </div>
          <div data-float className={`absolute z-10 ${cardClass}`}>
            {card}
          </div>
        </div>

        {/* copy */}
        <div className={`relative z-10 ${left ? 'lg:col-start-2 lg:pl-[12%]' : 'lg:col-start-1 lg:row-start-1 lg:pr-[8%]'}`} data-reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-tight text-charcoal sm:text-5xl">{title}</h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-charcoal-light">{body}</p>
          <TextLink to={link.to}>{link.label}</TextLink>
        </div>
      </div>
      {notes}
    </section>
  );
}

/* face-centred crop from a 1672×941 photo, k = zoom (image width ÷ avatar width) */
function faceCrop(src, x, y, k = 3.4) {
  const h = (k * 941) / 1672;
  const clamp = (v) => Math.min(100, Math.max(0, v * 100));
  return {
    backgroundImage: `url("${src}")`,
    backgroundSize: `${k * 100}% auto`,
    backgroundPosition: `${clamp((x * k - 0.5) / (k - 1))}% ${clamp((y * h - 0.5) / (h - 1))}%`,
  };
}

const week = [
  { day: 'Mon', title: 'Setting the direction', text: 'Attends lectures, explores career options and sets weekly goals.', face: faceCrop(IMG.career, 0.305, 0.36) },
  { day: 'Wed', title: 'Finding balance', text: 'Adjusts plans, focuses on deadlines and takes a wellbeing break.', face: faceCrop(IMG.calm, 0.33, 0.28, 3.6) },
  { day: 'Fri', title: 'Feeling the progress', text: 'Completes work, goes for a campus walk and heads into the weekend with a clearer mind.', face: faceCrop(IMG.walk, 0.19, 0.28) },
];

const faqs = [
  ['Is IHUSD free for university students?', 'Yes. Every core feature — planning, career exploration, wellbeing check-ins and activity tracking — is free for enrolled undergraduates.'],
  ['How is my data kept private?', 'Your check-ins and journal entries are encrypted and visible only to you. Research participation is opt-in, and anything shared is anonymised first.'],
  ['Can I use IHUSD on my phone?', 'Yes. IHUSD works in any modern mobile browser, and your plan, goals and check-ins stay in sync across devices.'],
];

function Faq() {
  const [open, setOpen] = useState(-1);
  return (
    <div className="space-y-3">
      {faqs.map(([q, a], i) => (
        <div key={q} className="rounded-xl border border-black/[0.06] bg-white shadow-soft">
          <button
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left text-sm font-medium text-charcoal"
          >
            <span>{i + 1}. <span className="underline decoration-black/20 underline-offset-4">{q}</span></span>
            <ChevronDownIcon size={17} className={`shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
          </button>
          <div className={`grid transition-all duration-300 ${open === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <p className="overflow-hidden px-5 text-sm leading-relaxed text-charcoal-light">
              <span className="block pb-4">{a}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const root = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-hero-in]', { y: 28, autoAlpha: 0, duration: 1, stagger: 0.09, ease: 'power3.out', delay: 0.15 });
        gsap.from('[data-hero-card]', { x: 40, autoAlpha: 0, duration: 1.2, ease: 'power3.out', delay: 1.1 });
        gsap.fromTo('[data-draw]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', delay: 0.5 });

        gsap.utils.toArray('[data-reveal]').forEach((el) =>
          gsap.from(el, { y: 36, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } })
        );
        gsap.utils.toArray('[data-parallax]').forEach((el) =>
          gsap.fromTo(el, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: el.parentElement, scrub: true } })
        );
        gsap.utils.toArray('[data-float]').forEach((el, i) =>
          gsap.to(el, { y: -8, duration: 3 + i * 0.4, ease: 'sine.inOut', repeat: -1, yoyo: true })
        );
        gsap.from('[data-bar]', { scaleX: 0, duration: 1.4, stagger: 0.15, ease: 'power3.out', scrollTrigger: { trigger: '#career', start: 'top 70%' } });
        gsap.from('[data-slot]', { autoAlpha: 0, y: 8, duration: 0.5, stagger: 0.06, ease: 'power2.out', scrollTrigger: { trigger: '#scheduler', start: 'top 70%' } });
        gsap.fromTo('[data-route]', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut', scrollTrigger: { trigger: '#physical', start: 'top 70%' } });
        gsap.from('[data-week]', { y: 30, autoAlpha: 0, duration: 0.9, stagger: 0.18, ease: 'power3.out', scrollTrigger: { trigger: '#week', start: 'top 75%' } });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="min-h-screen w-full overflow-x-hidden bg-cream text-charcoal">
      <BlobDefs />

      {/* ───────── HERO ───────── */}
      <section className="relative lg:h-[max(640px,100svh)]">
        <header className="absolute inset-x-0 top-0 z-30">
          <div className="flex h-20 items-center justify-between px-5 lg:px-[clamp(2.5rem,5vw,6rem)]">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="font-serif text-2xl font-bold tracking-tight text-charcoal">IHUSD</span>
              <span className="hidden text-[9px] leading-[1.2] text-charcoal-light sm:block">
                Immersive Holistic<br />Undergraduate<br />Student Development System
              </span>
            </Link>
            <nav className="hidden items-center gap-8 text-[13px] font-medium text-charcoal-light lg:flex">
              <a href="#career" className="hover:text-charcoal">Career</a>
              <a href="#scheduler" className="hover:text-charcoal">Scheduler</a>
              <a href="#wellbeing" className="hover:text-charcoal">Wellbeing</a>
              <a href="#physical" className="hover:text-charcoal">Physical Health</a>
            </nav>
            <div className="flex items-center gap-2 rounded-full lg:bg-white/70 lg:p-1 lg:pl-4 lg:backdrop-blur">
              <button onClick={() => navigate('/login')} className="px-3 text-sm font-medium text-charcoal hover:text-brand-600">Log in</button>
              <button onClick={() => navigate('/register')} className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:bg-brand-600">
                Get started <ArrowRightIcon size={15} />
              </button>
            </div>
          </div>
        </header>

        {/* copy */}
        <div className="relative z-20 px-5 pb-10 pt-28 lg:flex lg:h-full lg:w-[36vw] lg:flex-col lg:justify-center lg:pb-0 lg:pl-[clamp(2.5rem,5vw,6rem)] lg:pr-0 lg:pt-16">
          <p data-hero-in className="text-[11px] font-semibold uppercase tracking-[0.22em] text-charcoal-light">More than grades</p>
          <h1 data-hero-in className="mt-4 font-serif text-[clamp(2.5rem,3.5vw,4.2rem)] font-semibold leading-[1.02] tracking-tight text-charcoal">
            University life has more than one direction. <span className="text-brand-500">Find yours.</span>
          </h1>
          <p data-hero-in className="mt-6 max-w-sm text-[15px] leading-relaxed text-charcoal-light">
            IHUSD helps you explore opportunities, plan smarter, stay balanced and build healthy habits — all in one place.
          </p>
          <div data-hero-in className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => navigate('/register')} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-600">
              Start your journey <ArrowRightIcon size={16} />
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-charcoal transition hover:bg-black/[0.03]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-charcoal text-white"><PlayIcon size={9} fill="currentColor" /></span>
              Watch the story
            </button>
          </div>
        </div>

        {/* layered image */}
        <div className="relative mx-4 h-[440px] overflow-hidden rounded-[32px] sm:h-[540px] lg:absolute lg:inset-y-0 lg:left-[33%] lg:right-0 lg:mx-0 lg:h-auto lg:rounded-none lg:[clip-path:url(#blob-hero)]">
          <HeroScene />
        </div>

        <div data-hero-card className="absolute right-[3%] top-[44%] z-20 hidden lg:block">
          <div data-float><WeekCard /></div>
        </div>

        {/* orange swoosh */}
        <svg className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full lg:block" viewBox="0 0 1440 720" preserveAspectRatio="none" aria-hidden>
          <path
            data-draw
            d="M-20 640 C 120 720, 330 700, 470 618 S 700 520, 860 610 S 1160 720, 1270 560 S 1330 210, 1460 150"
            fill="none"
            stroke="#F5811E"
            strokeWidth="7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pathLength="1"
            strokeDasharray="1"
          />
        </svg>

        <Note className="bottom-[7%] left-[6%] z-20 -rotate-6">A fuller<br />&nbsp;&nbsp;you at university</Note>
        <Note className="right-[3%] top-[16%] z-20 rotate-[-8deg] text-white drop-shadow">Different<br />Paths<br />Brighter<br />Tomorrows</Note>
      </section>

      {/* pieces strip */}
      <div className="border-y border-black/[0.05] bg-cream">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-[clamp(2.5rem,5vw,6rem)]">
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium text-charcoal">
            {['Lectures', 'Goals', 'Breaks', 'Future', 'Movement'].map((w, i) => (
              <React.Fragment key={w}>
                {i > 0 && <span className="text-charcoal-muted">/</span>}
                <span>{w}</span>
              </React.Fragment>
            ))}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal-muted">Different pieces. A brighter you.</p>
        </div>
      </div>

      {/* ───────── CAREER ───────── */}
      <Feature
        id="career"
        side="left"
        image={IMG.career}
        imagePos="30% 40%"
        eyebrow="Career exploration"
        title={<>Discover what<br />fits you.</>}
        body="Explore real opportunities, build your portfolio and get personalised career matches based on your interests and strengths."
        link={{ to: '/app/career', label: 'Explore career paths' }}
        card={<CareerMatchCard />}
        cardClass="bottom-[-40px] left-1/2 -translate-x-1/2 lg:bottom-auto lg:left-auto lg:right-[-6%] lg:top-[18%] lg:translate-x-0"
        notes={
          <>
            <Note className="bottom-[14%] left-[22%] z-10 -rotate-12 text-white drop-shadow">Good<br />Work<br />Brighter<br />Futures</Note>
            <Note className="right-[4%] top-[18%] rotate-[-10deg]">Curiosity<br />today<br />Opportunities<br />tomorrow</Note>
          </>
        }
      />

      {/* ───────── SCHEDULER ───────── */}
      <section id="scheduler" className="relative overflow-hidden bg-cream-200/40">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16 lg:px-10 lg:py-24">
          <div data-reveal>
            <Eyebrow>Adaptive academic planning</Eyebrow>
            <h2 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">A plan that<br />moves with you.</h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-charcoal-light">
              Build your timetable, set deadlines and let IHUSD adapt when life changes. Smarter planning, less stress, more freedom.
            </p>
            <TextLink to="/app/schedule">Plan your week</TextLink>
          </div>
          <div className="relative">
            <div className="absolute left-[2%] -top-[14%] hidden h-[125%] w-[40%] lg:block lg:[clip-path:url(#blob-pill)]">
              <div data-parallax className="absolute inset-x-0 -top-[8%] h-[116%]">
                <img src={IMG.campusBg} alt="" loading="lazy" className="h-full w-full object-cover object-[80%_30%]" />
              </div>
            </div>
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start lg:pl-[18%]">
              <PlannerCard className="min-w-0 flex-1" />
              <div data-float className="sm:-ml-8 sm:mt-6">
                <AdjustCard />
              </div>
            </div>
          </div>
        </div>
        <Note className="bottom-[10%] left-[30%] -rotate-6">Plans<br />that flex<br />with real life</Note>
      </section>

      {/* ───────── WELLBEING ───────── */}
      <Feature
        id="wellbeing"
        side="left"
        image={IMG.calm}
        imagePos="25% 35%"
        eyebrow="Wellbeing support"
        title={<>You, beyond<br />academics.</>}
        body="Check in, access guided resources and build healthier habits. A safe, private space — whenever you need it."
        link={{ to: '/app/wellbeing', label: 'Explore wellbeing' }}
        card={<CheckinCard />}
        cardClass="bottom-[-60px] left-1/2 -translate-x-1/2 lg:bottom-auto lg:left-auto lg:right-[-4%] lg:top-[14%] lg:translate-x-0"
        notes={
          <>
            <Note className="left-[3%] top-[12%] z-10 -rotate-6 text-white drop-shadow">A calmer mind<br />A brighter you</Note>
            <Note className="bottom-[14%] right-[4%] rotate-[-6deg]">Progress<br />looks different<br />for everyone</Note>
          </>
        }
      />

      {/* ───────── PHYSICAL ───────── */}
      <Feature
        id="physical"
        side="right"
        image={IMG.walk}
        imagePos="40% 50%"
        eyebrow="Physical wellbeing"
        title={<>Small steps.<br />A healthier you.</>}
        body="Stay active, make healthier choices and feel your best on and off campus."
        link={{ to: '/app/physical', label: 'Explore physical health' }}
        card={<WalkCard />}
        cardClass="bottom-[-60px] left-1/2 -translate-x-1/2 lg:bottom-auto lg:left-[-6%] lg:top-[12%] lg:translate-x-0"
        tint="bg-cream-200/40"
      />

      {/* ───────── ONE STUDENT ───────── */}
      <section id="week" className="relative overflow-hidden pb-32 pt-20 lg:pt-24">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-5 lg:px-10">
          <h2 data-reveal className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">One student. One changing week.</h2>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal-muted">Same student. A brighter week.</p>
        </div>
        <svg className="pointer-events-none absolute inset-x-0 bottom-2 hidden h-20 w-full md:block" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden>
          <path d="M-10 40 C 160 10, 260 100, 480 70 S 800 20, 960 60 S 1260 110, 1450 30" fill="none" stroke="#F5811E" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative mx-auto mt-12 grid max-w-7xl gap-10 px-5 md:grid-cols-3 lg:px-10">
          {week.map((w, i) => (
            <div key={w.day} data-week className={`flex items-start gap-5 ${i > 0 ? 'md:border-l md:border-black/[0.07] md:pl-8' : ''}`}>
              <div className="h-24 w-24 shrink-0 rounded-full border-4 border-cream bg-cover shadow-card ring-2 ring-brand-200" style={w.face} role="img" aria-label="" />
              <div>
                <p className="font-serif text-2xl font-semibold">{w.day}</p>
                <p className="font-semibold text-charcoal">{w.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-charcoal-light">{w.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="border-t border-black/[0.05] bg-cream-200/40">
        <div className="relative mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[0.8fr_1.4fr_0.6fr] lg:px-10 lg:py-20">
          <h2 data-reveal className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight">Frequently<br />asked questions</h2>
          <div data-reveal><Faq /></div>
          <p className="hidden rotate-[-8deg] self-center font-hand text-2xl leading-tight text-charcoal-light lg:block">Real Questions<br />&nbsp;&nbsp;Real Support</p>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="relative overflow-hidden bg-[#1F2A2E] text-white">
        <div className="absolute inset-y-0 right-0 w-full lg:w-[68%]">
          <div data-parallax className="absolute inset-x-0 -top-[8%] h-[116%]">
            <img src={IMG.campus} alt="" loading="lazy" className="h-full w-full object-cover object-[50%_35%]" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#1F2A2E] via-[#1F2A2E]/70 to-[#1F2A2E]/10 lg:via-[#1F2A2E]/30" />
        </div>
        <div className="relative mx-auto max-w-7xl px-5 py-20 lg:px-10 lg:py-28">
          <div data-reveal className="max-w-md">
            <h2 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Your next chapter<br />starts here.</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-white/75">
              University is more than a destination — it’s a journey. Let IHUSD help you make the most of it.
            </p>
            <button onClick={() => navigate('/register')} className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:bg-brand-600">
              Get started <ArrowRightIcon size={16} />
            </button>
          </div>
          <p className="absolute right-[4%] top-[12%] hidden rotate-[-8deg] font-hand text-2xl leading-tight text-white/90 lg:block">More<br />Directions<br />A Brighter<br />You</p>
        </div>
        <div className="relative border-t border-white/10 bg-[#1F2A2E]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-white/60 sm:flex-row lg:px-10">
            <span className="font-serif text-base font-bold text-white">IHUSD</span>
            <span>Immersive Holistic Undergraduate Student Development System · © 2026</span>
          </div>
        </div>
      </section>
    </div>
  );
}
