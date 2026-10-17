import { useId, useState } from "react";
import { InfoIcon } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { t } from "../i18n";

const ALIGN = { left: "left-0", center: "left-1/2 -translate-x-1/2", right: "right-0" };

// Small (i) button that explains a term in plain language. Opens on hover, focus or tap.
export default function InfoTip({ label, children, align = "center" }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex align-middle normal-case tracking-normal">
      <button type="button" aria-label={t("What does {term} mean?", { term: label })} aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="ml-1 inline-flex w-5 h-5 items-center justify-center rounded-full text-[#34477A] hover:bg-[#9EB2DB]/25
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9EB2DB]">
        <InfoIcon size={14} />
      </button>
      {open && (
        <span role="tooltip" id={id}
          className={cn("absolute z-40 top-7 w-60 max-w-[75vw] rounded-xl bg-[#1F2840] p-3 text-left text-xs",
            "font-medium leading-relaxed text-white shadow-lift", ALIGN[align])}>
          {children}
        </span>
      )}
    </span>
  );
}
