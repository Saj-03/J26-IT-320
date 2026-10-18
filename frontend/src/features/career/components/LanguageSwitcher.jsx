import { useState } from "react";
import { LanguagesIcon, Loader2Icon } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { LANGUAGES, t, useLanguage } from "../i18n";
import { changeLanguage } from "../utils/careerSession";
import { toast } from "../utils/toast";

// English / සිංහල / தமிழ் switch. Changing it also translates the student's saved results.
// `large` = the big chooser shown at the start of the survey.
export default function LanguageSwitcher({ large = false, className }) {
  const lang = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const choose = async (code) => {
    if (code === lang || busy) return;
    setBusy(true);
    setError(false);
    try {
      await changeLanguage(code);
      toast.success(t("Language changed"));
    } catch {
      setError(true); // the page text is already switched; saved results update next time
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("acrds-no-print", className)}>
      <div role="radiogroup" aria-label="Language / භාෂාව / மொழி"
        className={cn("inline-flex items-center gap-1 rounded-full bg-white/80 border border-[#9ADBCC]/60 p-1",
          large && "flex w-full sm:w-auto")}>
        {!large && <LanguagesIcon size={15} className="mx-1.5 text-[#1F5F53]" aria-hidden />}
        {LANGUAGES.map((l) => (
          <button key={l.code} type="button" role="radio" aria-checked={lang === l.code} lang={l.code}
            onClick={() => choose(l.code)} disabled={busy}
            className={cn("rounded-full font-bold transition-colors disabled:opacity-60",
              large ? "flex-1 sm:flex-none px-5 py-2.5 text-base" : "px-3 py-1 text-xs",
              lang === l.code ? "bg-[#9ADBCC] text-[#12352E]" : "text-charcoal-light hover:bg-[#E3FFD6]")}>
            {l.label}
          </button>
        ))}
        {busy && <Loader2Icon size={15} className="mx-1.5 animate-spin text-[#1F5F53]" aria-label={t("Translating…")} />}
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-red-700">{t("Could not translate your saved results. Check your connection.")}</p>}
    </div>
  );
}
