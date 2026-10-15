import React, { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const LAYERS = {
  bg: '/img/Hero1/01-campus-background.png',
  students: '/img/Hero1/02-students-foreground.png',
  leaves: '/img/Hero1/03-overhanging-leaves.png',
};

/* Horizontal slices (in % of the 1672px canvas) that isolate each student,
   so the four can walk in individually from the same cutout. */
const WALKERS = [
  [0, 28.6],
  [28.6, 46.9],
  [46.9, 63.5],
  [63.5, 100],
];
/* Everyone scales around the group's feet, so far away they bunch together
   (like perspective down the path) and spread out as they arrive. */
const GROUP_ORIGIN = '45.5% 100%';
const GROUP = { cx: 0.455, width: 0.727 }; // students' centre / span as a fraction of the cutout width

/* Where the walkway is in 01-campus-background.png (1672×941 canvas px). */
const CANVAS = { w: 1672, h: 941 };
const BG_POS = { x: 0.62, y: 0.5 }; // must match the bg object-position
const BG_ZOOM = { scale: 1.07, x: 0.6, y: 0.45 }; // average zoom + transform-origin of the bg layer
const PATH = {
  far: { x: 615, y: 565, width: 290 }, // where the path disappears between the hedges
  nearX: 695, // centre of the path at the bottom edge
};

/* Map a background-canvas point to hero-local px, replicating object-fit: cover + the bg zoom. */
function bgMapper(scene) {
  const wrap = scene.querySelector('[data-par="bg"]');
  const W = wrap.offsetWidth;
  const H = wrap.offsetHeight;
  const top = wrap.offsetTop;
  const k = Math.max(W / CANVAS.w, H / CANVAS.h);
  const ox = (W - CANVAS.w * k) * BG_POS.x;
  const oy = top + (H - CANVAS.h * k) * BG_POS.y;
  const zx = W * BG_ZOOM.x;
  const zy = top + H * BG_ZOOM.y;
  const z = BG_ZOOM.scale;
  return (x, y) => ({ x: zx + (ox + x * k - zx) * z, y: zy + (oy + y * k - zy) * z, k: k * z });
}

const FALLING = [
  { x: 58, delay: 3.2, dur: 7.5, size: 16, hue: '#9ADBCC' },
  { x: 72, delay: 5.4, dur: 8.5, size: 12, hue: '#9EB2DB' },
  { x: 36, delay: 7.1, dur: 9, size: 14, hue: '#8CCFA0' },
  { x: 84, delay: 9.6, dur: 7, size: 11, hue: '#7FCFDD' },
  { x: 48, delay: 12, dur: 8, size: 13, hue: '#C7F2D1' },
];

function Leaf({ size, hue }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2C6 6 4 12 6 18c2 3 5 4 6 4 1 0 4-1 6-4 2-6 0-12-6-16Z" fill={hue} />
      <path d="M12 4v17" stroke="#1D695B" strokeWidth="1" opacity=".5" />
    </svg>
  );
}

/*
 * Layered hero: background → students → leaves.
 * Background + leaves share one "cover" stage so the trunk/canopy stay registered;
 * the students cutout is framed smaller than the scene, so it is sized on its own.
 * Wrappers split the jobs: data-par = scroll/pointer depth, data-layer = intro/idle.
 */
/*
 * mode="scroll": the walk is scrubbed by scroll (desktop pins the parent <section>).
 * mode="intro":  the walk plays once on load — for panels that don't scroll (auth pages).
 */
export function HeroScene({ className = '', children, mode = 'scroll', studentsClass = 'h-[62%] sm:h-[72%] lg:h-[70%] xl:h-[82%]' }) {
  const root = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 1024px)' }, (mc) => {
        if (!mc.conditions.motion) return;
        const walkers = gsap.utils.toArray('[data-walker]');
        const full = '[data-students-full]';
        // the slices walk; the single cutout takes over once they arrive (opacity swap only)
        gsap.set(full, { opacity: 0 });
        gsap.set(walkers, { visibility: 'visible', opacity: 1 });

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        // 1 · background: slow push-in, then keeps breathing
        tl.fromTo('[data-layer="bg"]', { scale: 1.18 }, { scale: 1.04, duration: 4, ease: 'power2.out' }, 0);
        tl.to('[data-layer="bg"]', { scale: 1.1, duration: 16, ease: 'sine.inOut', repeat: -1, yoyo: true }, 4);

        // sun glow blooms behind the students
        tl.fromTo('[data-sun]', { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 2.6, ease: 'power2.out' }, 0.3);
        gsap.to('[data-sun]', { scale: 1.12, duration: 5, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 3 });

        // students appear far up the path and wait for the first scroll
        // (fade on the inner images so it never fights the scroll swap on the wrappers)
        tl.fromTo('[data-bob]', { opacity: 0 }, { opacity: 1, duration: 1.2, stagger: 0.12, ease: 'power1.out' }, 0.6);
        tl.fromTo('[data-hint]', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 1.6);

        // 2 · scroll-driven walk: scrolling down brings them towards the viewer, up sends them back.
        // Desktop pins the hero so the whole walk plays in place; smaller screens scrub as the image passes.
        // Put the group on the walkway, and work out where "far up the path" is on this screen.
        const stage = root.current.querySelector('[data-par="students"]');
        const far0 = { x: 0, y: 0, scale: 0.34 }; // walk start, recomputed on refresh
        const place = () => {
          const scene = root.current;
          const map = bgMapper(scene);
          const W = scene.offsetWidth;
          const w = stage.offsetWidth;
          const groupW = w * GROUP.width;
          // arrive as close to the path centre as the frame allows
          const lo = groupW / 2 + W * 0.04;
          const hi = W - groupW / 2 - W * 0.02;
          const cx = lo > hi ? W / 2 : gsap.utils.clamp(lo, hi, map(PATH.nearX, CANVAS.h).x);
          stage.style.translate = 'none';
          stage.style.left = `${cx - w * GROUP.cx}px`;
          const feetY = stage.offsetTop + stage.offsetHeight;
          const far = map(PATH.far.x, PATH.far.y);
          far0.x = far.x - cx;
          far0.y = far.y - feetY;
          far0.scale = gsap.utils.clamp(0.16, 0.5, (PATH.far.width * far.k * 0.8) / groupW);
        };
        place();

        const section = root.current.closest('section') || root.current;
        const intro = mode === 'intro';
        const walk = gsap.timeline({
          defaults: { ease: 'none' },
          paused: intro,
          scrollTrigger: intro
            ? undefined
            : mc.conditions.desktop
            ? { trigger: section, start: 'top top', end: '+=140%', pin: section, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true, onRefreshInit: place }
            : { trigger: root.current, start: 'top 75%', end: 'bottom 30%', scrub: 0.8, invalidateOnRefresh: true, onRefreshInit: place },
        });
        const WALK = 1;
        const steps = 10; // even → every walker ends back at rest
        walk.to('[data-hint]', { autoAlpha: 0, y: 10, duration: 0.08 }, 0);
        walkers.forEach((w, i) => {
          const start = [0.05, 0, 0.08, 0.03][i];
          const len = WALK - start;
          walk.fromTo(
            w,
            // start small, far up the path (it recedes to the upper left), then approach
            { scale: () => far0.scale, x: () => far0.x, y: () => far0.y, filter: 'blur(2.5px) brightness(1.08) saturate(.85)' },
            { scale: 1, x: 0, y: 0, filter: 'blur(0px) brightness(1) saturate(1)', duration: len, ease: 'power1.inOut' },
            start
          );
          // footsteps: a vertical bob + a tiny side sway, out of phase between friends
          const bob = w.querySelector('[data-bob]');
          walk.fromTo(bob, { yPercent: 0 }, { yPercent: -1.6, duration: len / steps, ease: 'sine.inOut', repeat: steps - 1, yoyo: true }, start);
          walk.fromTo(
            bob,
            { rotation: i % 2 ? 0.7 : -0.7 },
            { rotation: i % 2 ? -0.7 : 0.7, duration: (len / steps) * 2, ease: 'sine.inOut', repeat: steps / 2 - 1, yoyo: true, transformOrigin: '50% 100%' },
            start
          );
          walk.set(bob, { rotation: 0 }, WALK);
        });
        // camera depth while they walk: background eases in, leaves drift closer
        walk.fromTo('[data-par="bg"]', { scale: 1 }, { scale: 1.06, duration: WALK }, 0);
        walk.fromTo('[data-par="leaves"]', { scale: 1, yPercent: 0 }, { scale: 1.06, yPercent: -3, duration: WALK }, 0);
        // arrived: swap the slices for the single seamless cutout (reverts when scrolling back up)
        walk.set(full, { opacity: 1, immediateRender: false }, WALK);
        walk.set(walkers, { opacity: 0, immediateRender: false }, WALK);
        walk.to({}, { duration: 0.12 }); // brief hold before the page moves on

        const cleanups = [];
        if (intro) {
          // ~3.4s walk, started once every layer has decoded so no steps are lost
          walk.timeScale(0.33);
          const imgs = gsap.utils.toArray('img', root.current);
          Promise.all(imgs.map((im) => (im.decode ? im.decode().catch(() => {}) : null))).then(() => walk.delay(0.5).play());
          const onResize = () => place();
          window.addEventListener('resize', onResize);
          cleanups.push(() => window.removeEventListener('resize', onResize));
        }

        // 3 · leaves: drop in, then an independent sway
        tl.fromTo(
          '[data-layer="leaves"]',
          { autoAlpha: 0, xPercent: -3, yPercent: -6, scale: 1.06 },
          { autoAlpha: 1, xPercent: 0, yPercent: 0, scale: 1, duration: 2.4 },
          0.1
        );
        gsap.to('[data-layer="leaves-sway"]', { rotation: 0.9, x: 6, y: 3, duration: 4.8, ease: 'sine.inOut', repeat: -1, yoyo: true });

        // a few leaves drift down from the canopy
        gsap.utils.toArray('[data-fall]').forEach((el) => {
          const d = +el.dataset.dur;
          gsap.set(el, { autoAlpha: 0 });
          const fall = gsap.timeline({ repeat: -1, delay: +el.dataset.delay, repeatDelay: gsap.utils.random(2, 6) });
          fall
            .to(el, { autoAlpha: 0.95, duration: 0.6 }, 0)
            .fromTo(el, { yPercent: 0, y: 0 }, { y: () => root.current.offsetHeight * 0.95, duration: d, ease: 'none' }, 0)
            .fromTo(el, { x: 0 }, { x: gsap.utils.random(-90, 40), duration: d, ease: 'sine.inOut' }, 0)
            .fromTo(el, { rotation: 0 }, { rotation: gsap.utils.random(240, 520), duration: d, ease: 'none' }, 0)
            .to(el, { autoAlpha: 0, duration: 0.8 }, d - 0.8);
        });

        // depth on pointer (mouse only)
        if (window.matchMedia('(pointer: fine)').matches) {
          const layers = [
            ['[data-par="bg"]', -10],
            ['[data-par="students"]', 8],
            ['[data-par="leaves"]', 22],
          ].map(([sel, amt]) => [gsap.quickTo(sel, 'x', { duration: 1.2, ease: 'power3.out' }), amt]);
          const onMove = (e) => {
            const r = root.current.getBoundingClientRect();
            const nx = (e.clientX - r.left) / r.width - 0.5;
            layers.forEach(([to, amt]) => to(nx * amt));
          };
          const onLeave = () => layers.forEach(([to]) => to(0));
          const el = root.current;
          el.addEventListener('pointermove', onMove);
          el.addEventListener('pointerleave', onLeave);
          cleanups.push(() => {
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerleave', onLeave);
          });
        }
        return () => cleanups.forEach((fn) => fn());
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* 1 · background (taller than the frame so scroll parallax never exposes an edge) */}
      <div data-par="bg" className="absolute inset-x-0 -top-[8%] h-[116%]">
        <img
          data-layer="bg"
          src={LAYERS.bg}
          alt=""
          className="h-full w-full object-cover object-[62%_50%] will-change-transform"
          style={{ transformOrigin: '60% 45%' }}
        />
      </div>

      {/* late-afternoon sun, behind the students */}
      <div
        data-sun
        className="pointer-events-none absolute -right-[10%] -top-[20%] h-[80%] w-[60%] opacity-0 mix-blend-screen"
        style={{ background: 'radial-gradient(closest-side, rgba(208,242,247,.8), rgba(154,219,204,.3) 45%, transparent 75%)' }}
      />

      {/* 2 · students — grounded at the bottom, walking towards the viewer */}
      <div
        data-par="students"
        className={`absolute bottom-[-2%] left-1/2 aspect-[1672/941] lg:left-[46%] ${studentsClass}`}
        style={{ translate: '-45.5% 0' }}
      >
        <img
          data-students-full
          src={LAYERS.students}
          alt="Four university students walking and talking on a campus path"
          className="absolute inset-0 h-full w-full"
        />
        {WALKERS.map(([a, b], i) => (
          <div
            key={i}
            data-walker
            className="invisible absolute inset-0 will-change-transform"
            style={{ clipPath: `inset(0 ${100 - b}% 0 ${a}%)`, transformOrigin: GROUP_ORIGIN }}
            aria-hidden
          >
            <img data-bob src={LAYERS.students} alt="" className="h-full w-full" />
          </div>
        ))}
      </div>

      {/* 3 · leaves — same geometry as the background so trunk & canopy line up */}
      <div data-par="leaves" className="pointer-events-none absolute inset-x-0 -top-[8%] h-[116%]">
        <div data-layer="leaves" className="h-full w-full">
          <img
            data-layer="leaves-sway"
            src={LAYERS.leaves}
            alt=""
            className="h-full w-full object-cover object-[62%_50%] will-change-transform"
            style={{ transformOrigin: '0% 0%' }}
          />
        </div>
      </div>

      {/* drifting leaves */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {FALLING.map((l, i) => (
          <div key={i} data-fall data-delay={l.delay} data-dur={l.dur} className="absolute top-[6%] opacity-0" style={{ left: `${l.x}%` }}>
            <Leaf size={l.size} hue={l.hue} />
          </div>
        ))}
      </div>

      {mode === 'scroll' && <div data-hint className="invisible absolute inset-x-0 top-[15%] z-10 mx-auto flex w-fit items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-charcoal shadow-soft backdrop-blur">
        <span className="relative h-5 w-3.5 rounded-full border-2 border-charcoal/70">
          <span className="absolute left-1/2 top-1 h-1.5 w-0.5 -translate-x-1/2 animate-bounce rounded-full bg-brand-500" />
        </span>
        Scroll to walk with them
      </div>}

      {/* warm grade so the cutout edges sit inside the same light */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-amber-200/10" />
      {children}
    </div>
  );
}
