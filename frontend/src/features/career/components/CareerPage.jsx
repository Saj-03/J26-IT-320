import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";
import { SCRIPT_FONT, useLanguage } from "../i18n";
import CareerStepper from "./CareerStepper";
import LanguageSwitcher from "./LanguageSwitcher";
import CareerToaster from "./CareerToaster";
import { motion, useReducedMotion } from "framer-motion";

// Small animations used across the career pages (the shared Tailwind config is not changed).
const MOTION_CSS = `
@keyframes acrds-pop { 0% { transform: scale(0.3); opacity: 0 } 60% { transform: scale(1.25); opacity: 1 } 100% { transform: scale(1) } }
@keyframes acrds-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(93,191,169,0.45) } 50% { box-shadow: 0 0 0 7px rgba(93,191,169,0) } }
@keyframes acrds-fade { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
.acrds-fade { animation: acrds-fade 0.25s ease-out both; }
.acrds-pop { animation: acrds-pop 0.35s ease-out both; }
.acrds-glow { animation: acrds-glow 2.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .acrds-pop, .acrds-glow, .acrds-fade { animation: none; } }
`;
function injectMotionCss() {
  if (typeof document === "undefined" || document.getElementById("acrds-motion-css")) return;
  const style = document.createElement("style");
  style.id = "acrds-motion-css";
  style.textContent = MOTION_CSS;
  document.head.appendChild(style);
}

// Page wrapper: soft palette gradient with decorative shapes, the step tracker and the language switch on top.
// The page is the printable area for "Download PDF" (see PrintButton).
// `step` = which of the five ACRDS steps this page is (omit on the dashboard).
export default function CareerPage({ className, step, children }) {
  const lang = useLanguage();
  const still = useReducedMotion();
  injectMotionCss();
  return (
    <div lang={lang} className={cn(ui.page, "acrds-print relative overflow-hidden", lang !== "en" && "leading-relaxed")}
      style={lang !== "en" ? { fontFamily: SCRIPT_FONT } : undefined}>
      {/* decorative, behind the content */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-[#D0F2F7]/70 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 w-80 h-80 rounded-full bg-[#C7F2D1]/50 blur-3xl" />
      {/* page content fades in on arrival */}
      <motion.div className={cn("relative space-y-6", className)}
        initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }}>
        {/* Language switch on its own line, so long Sinhala/Tamil step names never push steps off-screen */}
        <div className="flex justify-end -mb-2">
          <LanguageSwitcher />
        </div>
        {step && <div className="acrds-no-print"><CareerStepper current={step} /></div>}
        {children}
      </motion.div>
      <CareerToaster />
    </div>
  );
}
