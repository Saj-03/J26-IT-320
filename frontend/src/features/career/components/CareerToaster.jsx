import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon, XIcon } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { toast, useToasts } from "../utils/toast";
import { t } from "../i18n";

const TONE = {
  success: { icon: CheckCircle2Icon, cls: "bg-[#1F5F53] text-white" },
  info: { icon: InfoIcon, cls: "bg-[#34477A] text-white" },
  error: { icon: AlertCircleIcon, cls: "bg-red-600 text-white" },
};

// Toasts: top of the screen on phones (clear of the bottom navigation and action bar), bottom-right on larger screens.
export default function CareerToaster() {
  const items = useToasts();
  const still = useReducedMotion();
  return (
    <div aria-live="polite" role="status"
      className="acrds-no-print fixed z-[55] inset-x-0 top-20 sm:top-auto sm:bottom-6 sm:inset-x-auto sm:right-6 flex flex-col items-center sm:items-end gap-2 px-4 pointer-events-none">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const { icon: Icon, cls } = TONE[item.tone] || TONE.info;
          return (
            <motion.div key={item.id} layout={!still}
              initial={still ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={still ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              className={cn("pointer-events-auto flex items-center gap-2.5 rounded-2xl pl-3.5 pr-2 py-2.5 shadow-lift max-w-sm w-full sm:w-auto", cls)}>
              {item.emoji ? <span className="text-lg leading-none" aria-hidden>{item.emoji}</span> : <Icon size={18} className="shrink-0" />}
              <span className="text-sm font-semibold flex-1">{item.message}</span>
              <button type="button" onClick={() => toast.dismiss(item.id)} aria-label={t("Close")}
                className="shrink-0 rounded-full p-1 hover:bg-white/15"><XIcon size={14} /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
