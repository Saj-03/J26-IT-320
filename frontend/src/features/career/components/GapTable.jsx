import { cn } from "../../../shared/lib/cn";
import { skillLabel } from "../constants";
import { ui } from "../theme";

export default function GapTable({ gaps }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-charcoal-muted border-b border-[#9ADBCC]/50">
            <th className="py-3 pr-4 font-bold">Skill</th>
            <th className="py-3 pr-4 font-bold text-center">Current level</th>
            <th className="py-3 pr-4 font-bold text-center">Required level</th>
            <th className="py-3 pr-4 font-bold text-center">Gap</th>
            <th className="py-3 font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((g) => (
            <tr key={g.skill} className="border-b border-black/[0.04] last:border-0">
              <td className="py-3 pr-4 font-semibold text-charcoal">{skillLabel(g.skill)}</td>
              <td className="py-3 pr-4 text-center">{g.current_level}/5</td>
              <td className="py-3 pr-4 text-center">{g.required_level}/5</td>
              <td className="py-3 pr-4 text-center font-semibold">{g.gap > 0 ? `+${g.gap}` : g.gap}</td>
              <td className="py-3">
                <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", ui.status[g.status])}>
                  {g.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
