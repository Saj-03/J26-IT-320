import { CheckIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "../../../shared/lib/cn";
import { skillLabel } from "../constants";
import { ui } from "../theme";

// Small pill for a skill: "match" (green) or "gap" (orange).
export default function SkillBadge({ skill, tone = "match" }) {
  const Icon = tone === "match" ? CheckIcon : TrendingUpIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1",
        tone === "match" ? ui.match : ui.gap
      )}
    >
      <Icon size={12} /> {skillLabel(skill)}
    </span>
  );
}
