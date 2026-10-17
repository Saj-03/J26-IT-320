import { AwardIcon, BookOpenIcon, CheckIcon, FolderGit2Icon, MicIcon, WrenchIcon, CalendarIcon } from "lucide-react";
import Card from "./CareerCard";
import Button from "./CareerButton";
import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";
import { t } from "../i18n";

const ICONS = { courses: BookOpenIcon, tools: WrenchIcon, projects: FolderGit2Icon, cert: AwardIcon, interview: MicIcon };
// Tool and certification names come from the career data in English (they are product / award names).
const ENGLISH_ITEMS = new Set(["tools", "cert"]);

// Career-specific milestones (from the selected career's data), shown after the skill-gap activities.
// `done` = { [milestoneId]: true }; `onToggle(id)` ticks one; `onPractise` opens the interview simulator.
export default function CareerMilestones({ career, milestones, done = {}, onToggle, onPractise }) {
  if (!milestones?.length) return null;
  const finished = milestones.filter((m) => done[m.id]).length;
  return (
    <section aria-labelledby="milestones-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="milestones-title" className="text-lg font-extrabold text-charcoal">
            {t("Career milestones for {career}", { career })}
          </h2>
          <p className="text-sm text-charcoal-muted">{t("Courses, tools and projects chosen for this career, in a suggested order.")}</p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-bold bg-black/[0.04] text-charcoal-muted">
          {t("{done} of {total} milestones done", { done: finished, total: milestones.length })}
        </span>
      </div>
      <ol className="grid md:grid-cols-2 gap-4">
        {milestones.map((m, i) => {
          const Icon = ICONS[m.id] || CalendarIcon;
          const complete = !!done[m.id];
          return (
            <li key={m.id} className={cn(m.id === "interview" && "md:col-span-2")}>
              <Card padding="lg" className={cn("h-full flex flex-col gap-3 border-l-4",
                complete ? "border-l-[#5DBFA9] bg-[#C7F2D1]/30" : "border-l-[#9ADBCC]")}>
                <div className="flex items-start gap-3">
                  <span className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                    complete ? "bg-[#5DBFA9] text-white" : ui.iconTile)}>
                    {complete ? <CheckIcon size={18} strokeWidth={3} /> : <Icon size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted">
                      {t("Milestone {n}", { n: i + 1 })} · <span className="normal-case">{m.timeframe}</span>
                    </p>
                    <h3 className="font-bold text-charcoal">{m.title}</h3>
                    <p className="text-sm text-charcoal-light">{m.description}</p>
                  </div>
                </div>
                {m.items.length > 0 && (
                  <ul className="flex flex-wrap gap-2" lang={ENGLISH_ITEMS.has(m.id) ? "en" : undefined}>
                    {m.items.map((item) => (
                      <li key={item} className="rounded-xl bg-white border border-[#9ADBCC]/40 px-2.5 py-1 text-sm text-charcoal">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-wrap gap-2 acrds-no-print">
                  {m.id === "interview" && (
                    <Button size="sm" onClick={onPractise}><MicIcon size={14} /> {t("Open the AI Interview Simulator")}</Button>
                  )}
                  <Button size="sm" variant={complete ? "soft" : "outline"} aria-pressed={complete} onClick={() => onToggle?.(m.id)}>
                    {complete ? <><CheckIcon size={14} /> {t("Done")}</> : t("Mark as done")}
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
