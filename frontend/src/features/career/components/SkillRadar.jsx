import { skillLabel } from "../constants";
import { t } from "../i18n";

const SIZE = 340;
const C = SIZE / 2;
const R = 112; // radius of level 5
const LEVELS = [1, 2, 3, 4, 5];

const point = (i, n, level) => {
  const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
  const r = (R * level) / 5;
  return [C + r * Math.cos(angle), C + r * Math.sin(angle)];
};
const polygon = (values) => values.map((v, i) => point(i, values.length, v).join(",")).join(" ");

// Radar ("spider") chart: your level vs the career's required level for the 9 skills.
// `preview` (optional) = levels after the what-if changes, drawn as a dashed outline.
export default function SkillRadar({ gaps, preview }) {
  const n = gaps.length;
  const yours = gaps.map((g) => g.current_level);
  const required = gaps.map((g) => g.required_level);
  return (
    <figure className="space-y-2">
      {/* extra room left/right so long skill names are not cut off */}
      <svg viewBox={`-70 -6 ${SIZE + 140} ${SIZE + 12}`} className="w-full max-w-[440px] mx-auto" role="img"
        aria-label={`${t("Radar chart of your skills against the required levels")}: ${gaps
          .map((g) => `${skillLabel(g.skill)} ${g.current_level}/${g.required_level}`).join(", ")}`}>
        {LEVELS.map((lv) => (
          <polygon key={lv} points={polygon(Array(n).fill(lv))} fill={lv % 2 ? "#FFFBF0" : "#E3FFD6"}
            stroke="#9ADBCC" strokeOpacity="0.5" strokeWidth="1" />
        ))}
        {gaps.map((g, i) => {
          const [x, y] = point(i, n, 5);
          return <line key={g.skill} x1={C} y1={C} x2={x} y2={y} stroke="#9ADBCC" strokeOpacity="0.5" />;
        })}
        <polygon points={polygon(required)} fill="#9EB2DB" fillOpacity="0.18" stroke="#34477A" strokeWidth="2"
          strokeDasharray="5 4" />
        <polygon points={polygon(yours)} fill="#5DBFA9" fillOpacity="0.45" stroke="#1F5F53" strokeWidth="2" />
        {preview && (
          <polygon points={polygon(preview)} fill="none" stroke="#1F5F53" strokeWidth="2" strokeDasharray="2 3" />
        )}
        {yours.map((v, i) => {
          const [x, y] = point(i, n, v);
          return <circle key={gaps[i].skill} cx={x} cy={y} r="3.5" fill="#1F5F53" />;
        })}
        {gaps.map((g, i) => {
          const [x, y] = point(i, n, 6.1);
          const anchor = Math.abs(x - C) < 8 ? "middle" : x > C ? "start" : "end";
          return (
            <text key={g.skill} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
              className="fill-[#252E48]" style={{ fontSize: 11, fontWeight: 600 }}>
              {skillLabel(g.skill)}
            </text>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-charcoal-muted">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#5DBFA9]/70 border border-[#1F5F53]" /> {t("You")}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-dashed border-[#34477A]" /> {t("Required")}</span>
        {preview && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border-2 border-dotted border-[#1F5F53]" /> {t("What-if")}</span>}
      </figcaption>
    </figure>
  );
}
