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

export default function RoadmapItem({ item, step }) {
  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="w-7 h-7 rounded-full bg-[#9EB2DB] text-[#1E2D57] text-xs font-bold flex items-center justify-center">{step}</span>
        <h3 className="text-lg font-extrabold text-charcoal">{skillLabel(item.skill)}</h3>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", ui.priority[item.priority])}>
          {item.priority} priority
        </span>
      </div>
      <p className="text-sm text-charcoal-muted mb-4">{item.reason}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Row icon={BookOpenIcon} label="Course" value={item.course} />
        <Row icon={FolderGit2Icon} label="Project" value={item.project} />
        <Row icon={ListChecksIcon} label="Practice task" value={item.task} />
        <Row icon={ClockIcon} label="Estimated time" value={item.estimated_time} />
      </div>
    </Card>
  );
}
