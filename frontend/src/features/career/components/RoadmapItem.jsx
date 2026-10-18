import { BookOpenIcon, FolderGit2Icon, ListChecksIcon, ClockIcon, CheckIcon } from "lucide-react";
import Card from "./CareerCard";
import InfoTip from "./InfoTip";
import { cn } from "../../../shared/lib/cn";
import { GLOSSARY, skillLabel } from "../constants";
import { ui } from "../theme";
import { ROADMAP_PART_KEYS, ROADMAP_PART_LABELS } from "../utils/roadmapProgress";
import { t } from "../i18n";

// The three things to do for one skill; each can be ticked off.
const ICONS = { course: BookOpenIcon, project: FolderGit2Icon, task: ListChecksIcon };
const ROADMAP_PARTS = ROADMAP_PART_KEYS.map((key) => ({ key, label: ROADMAP_PART_LABELS[key], icon: ICONS[key] }));

function Part({ icon: Icon, label, value, done, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={done}
      className={cn("group flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors w-full",
        done ? "border-[#5DBFA9] bg-[#C7F2D1]/50" : "border-[#9ADBCC]/40 bg-white hover:bg-[#E3FFD6]")}>
      <span className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
        done ? "bg-[#5DBFA9] text-white" : ui.iconTile)}>
        {done ? <CheckIcon size={16} strokeWidth={3} className="acrds-pop" /> : <Icon size={16} />}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wide text-charcoal-muted">
          {t(label)} {done ? `· ${t("done")}` : ""}
        </span>
        <span className={cn("block text-sm", done ? "text-charcoal-muted line-through" : "text-charcoal")}>{value}</span>
        {!done && <span className="block text-[11px] font-semibold text-[#1F5F53] opacity-0 group-hover:opacity-100">{t("Tap to mark done")}</span>}
      </span>
    </button>
  );
}

// One step on the roadmap timeline: node on the left line, card on the right.
// `done` = { course, project, task } booleans; `onToggle(part)` ticks a part on or off.
export default function RoadmapItem({ item, step, last = false, done = {}, onToggle, as: Tag = "li" }) {
  const high = item.priority === "High";
  const finished = ROADMAP_PARTS.filter((p) => done[p.key]).length;
  const complete = finished === ROADMAP_PARTS.length;
  return (
    <Tag className="relative pl-12 sm:pl-14">
      {!last && <span aria-hidden className="absolute left-[19px] sm:left-[23px] top-10 bottom-[-20px] w-0.5 bg-[#9ADBCC]/70" />}
      <span className={cn("absolute left-0 top-3 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center",
        "text-sm font-extrabold ring-4 ring-[#FFFBF0] transition-colors",
        complete ? "bg-[#5DBFA9] text-white" : high ? "bg-[#9EB2DB] text-[#1E2D57]" : "bg-[#C7F2D1] text-[#1F5F53]")}>
        {complete ? <CheckIcon size={18} strokeWidth={3} /> : step}
      </span>
      <Card padding="lg" className={cn("border-l-4", complete ? "border-l-[#5DBFA9]" : high ? "border-l-[#9EB2DB]" : "border-l-[#9ADBCC]")}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-lg font-extrabold text-charcoal">{skillLabel(item.skill)}</h3>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", ui.priority[item.priority])}>
            {t(`${item.priority} priority`)}
          </span>
          {step === 1 && <InfoTip label={t("Priority")}>{GLOSSARY.priority}</InfoTip>}
          <span className="ml-auto flex items-center gap-3 text-xs font-semibold text-charcoal-muted">
            <span className="flex items-center gap-1"><ClockIcon size={13} /> {item.estimated_time}</span>
            <span className={cn("rounded-full px-2 py-0.5", complete ? "bg-[#5DBFA9] text-white" : "bg-black/[0.04]")}>
              {finished}/{ROADMAP_PARTS.length} {t("done")}
            </span>
          </span>
        </div>
        <p className="text-sm text-charcoal-muted mb-4">{item.reason}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {ROADMAP_PARTS.map((p) => (
            <Part key={p.key} icon={p.icon} label={p.label} value={item[p.key]} done={!!done[p.key]}
              onToggle={() => onToggle?.(p.key)} />
          ))}
        </div>
      </Card>
    </Tag>
  );
}
