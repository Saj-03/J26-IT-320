import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";
import { SCRIPT_FONT, useLanguage } from "../i18n";
import CareerStepper from "./CareerStepper";
import LanguageSwitcher from "./LanguageSwitcher";

// Page wrapper: soft palette gradient with decorative shapes, the step tracker and the language switch on top.
// The page is the printable area for "Download PDF" (see PrintButton).
// `step` = which of the five ACRDS steps this page is (omit on the dashboard).
export default function CareerPage({ className, step, children }) {
  const lang = useLanguage();
  return (
    <div lang={lang} className={cn(ui.page, "acrds-print relative overflow-hidden", lang !== "en" && "leading-relaxed")}
      style={lang !== "en" ? { fontFamily: SCRIPT_FONT } : undefined}>
      {/* decorative, behind the content */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-[#D0F2F7]/70 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 w-80 h-80 rounded-full bg-[#C7F2D1]/50 blur-3xl" />
      <div className={cn("relative space-y-6", className)}>
        {/* Language switch on its own line, so long Sinhala/Tamil step names never push steps off-screen */}
        <div className="flex justify-end -mb-2">
          <LanguageSwitcher />
        </div>
        {step && <div className="acrds-no-print"><CareerStepper current={step} /></div>}
        {children}
      </div>
    </div>
  );
}
