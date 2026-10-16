import { BookOpenIcon, FolderGit2Icon, ListChecksIcon, ClockIcon } from "lucide-react";
import Card from "./CareerCard";
import { cn } from "../../../shared/lib/cn";
import { skillLabel } from "../constants";
import { ui } from "../theme";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`w-8 h-8 rounded-xl ${ui.iconTile} flex items-center justify-center shrink-0`}>
        <Icon size={16} />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-charcoal-muted">{label}</p>
        <p className="text-sm text-charcoal">{value}</p>
      </div>
    </div>
  );
}

// One step on the roadmap timeline: node on the left line, card on the right.
export default function RoadmapItem({ item, step, last = false }) {
  const high = item.priority === "High";
  return (
    <li className="relative pl-12 sm:pl-14">
      {!last && <span aria-hidden className="absolute left-[19px] sm:left-[23px] top-10 bottom-[-20px] w-0.5 bg-[#9ADBCC]/70" />}
      <span className={cn("absolute left-0 top-3 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center",
        "text-sm font-extrabold ring-4 ring-[#FFFBF0]",
        high ? "bg-[#9EB2DB] text-[#1E2D57]" : "bg-[#C7F2D1] text-[#1F5F53]")}>
        {step}
      </span>
      <Card padding="lg" className={cn("border-l-4", high ? "border-l-[#9EB2DB]" : "border-l-[#9ADBCC]")}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-lg font-extrabold text-charcoal">{skillLabel(item.skill)}</h3>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", ui.priority[item.priority])}>
            {item.priority} priority
          </span>
          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-charcoal-muted">
            <ClockIcon size={13} /> {item.estimated_time}
          </span>
        </div>
        <p className="text-sm text-charcoal-muted mb-4">{item.reason}</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <Row icon={BookOpenIcon} label="Course" value={item.course} />
          <Row icon={FolderGit2Icon} label="Project" value={item.project} />
          <Row icon={ListChecksIcon} label="Practice task" value={item.task} />
        </div>
      </Card>
    </li>
  );
}
