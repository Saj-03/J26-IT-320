// Small confetti burst in the ACRDS palette (canvas, no extra library).
// Skipped when the student's device asks for reduced motion.
const COLORS = ["#9ADBCC", "#C7F2D1", "#5DBFA9", "#D0F2F7", "#9EB2DB", "#34477A", "#FFD27A"];

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {"small" | "big"} size  small = one task finished, big = a whole roadmap / great interview
 * @param {{x?: number, y?: number}} origin  0..1 of the viewport (default: centre, a little above the middle)
 */
export function celebrate(size = "small", origin = {}) {
  if (typeof document === "undefined" || reducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "60" });
  document.body.appendChild(canvas);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const count = size === "big" ? 160 : 60;
  const ox = (origin.x ?? 0.5) * window.innerWidth;
  const oy = (origin.y ?? 0.4) * window.innerHeight;
  const pieces = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = (size === "big" ? 7 : 5) + Math.random() * 6;
    return {
      x: ox, y: oy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 4,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
      rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });

  const start = performance.now();
  const duration = size === "big" ? 2600 : 1600;
  const frame = (now) => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
    for (const p of pieces) {
      p.vy += 0.25; // gravity
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/** Viewport origin (0..1) of an element, so the burst comes from the button that was pressed. */
export function originOf(el) {
  const r = el?.getBoundingClientRect?.();
  if (!r) return {};
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
}
