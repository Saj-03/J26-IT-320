import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ListChecksIcon, XIcon } from "lucide-react";
import Button from "./CareerButton";
import { SCRIPT_FONT, t, useLanguage } from "../i18n";

// Confirmation before adding the roadmap to the Task Manager.
// Closes with No, the X button, Escape or a click outside; keeps keyboard focus inside while open
// and gives focus back to the button that opened it.
export default function TaskManagerDialog({ open, busy, onConfirm, onClose }) {
  const lang = useLanguage();
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const focusables = () => [...panel.current.querySelectorAll("button:not([disabled])")];
    (panel.current.querySelector("[data-autofocus]") || focusables()[0])?.focus(); // start on the safe choice
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        const els = focusables();
        const i = els.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          els[els.length - 1]?.focus();
        } else if (!e.shiftKey && i === els.length - 1) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    // rendered outside CareerPage, so it sets the language and script font itself
    <div lang={lang} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={lang !== "en" ? { fontFamily: SCRIPT_FONT } : undefined}>
      <div className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="tm-dialog-title" aria-describedby="tm-dialog-desc"
        className="relative w-full max-w-md rounded-t-4xl sm:rounded-4xl bg-[#FFFBF0] border border-[#9ADBCC]/60 shadow-lift p-6 sm:p-7">
        <button type="button" onClick={onClose} aria-label={t("Close")}
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-charcoal-muted hover:bg-black/[0.05]">
          <XIcon size={18} />
        </button>
        <span className="w-12 h-12 rounded-2xl bg-[#C7F2D1] text-[#1F5F53] flex items-center justify-center">
          <ListChecksIcon size={24} />
        </span>
        <h2 id="tm-dialog-title" className="mt-4 pr-8 text-lg font-bold text-charcoal">
          {t("Would you like to add your personalized career development roadmap to your Task Manager?")}
        </h2>
        <p id="tm-dialog-desc" className="mt-2 text-sm text-charcoal-light">
          {t("Your roadmap activities can help you organize and track your career development progress.")}
        </p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button data-autofocus variant="outline" onClick={onClose}>{t("No, Continue")}</Button>
          <Button onClick={onConfirm} disabled={busy}>{t("Yes, Add to Task Manager")}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
