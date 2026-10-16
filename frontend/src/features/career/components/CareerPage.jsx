import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";
import CareerStepper from "./CareerStepper";

// Page wrapper: soft palette gradient with decorative shapes, and the step tracker on top.
// The page is the printable area for "Download PDF" (see PrintButton).
// `step` = which of the five ACRDS steps this page is (omit on the dashboard).
export default function CareerPage({ className, step, children }) {
  return (
    <div className={cn(ui.page, "acrds-print relative overflow-hidden")}>
      {/* decorative, behind the content */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-[#D0F2F7]/70 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 w-80 h-80 rounded-full bg-[#C7F2D1]/50 blur-3xl" />
      <div className={cn("relative space-y-6", className)}>
        {step && <div className="acrds-no-print"><CareerStepper current={step} /></div>}
        {children}
      </div>
    </div>
  );
}
