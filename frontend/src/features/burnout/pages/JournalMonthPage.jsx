import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon, ChevronRightIcon, PenLineIcon } from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { listJournal, moodHistory } from "../api";
import { useJournalStyle } from "../journalStyle";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MOOD_FACE = (avg) => (avg <= 1.5 ? "😣" : avg <= 2.5 ? "😕" : avg <= 3.5 ? "😐" : avg <= 4.5 ? "🙂" : "🔥");
// Soft tint per mood so a month reads at a glance. Colour is never the only cue: the face shows too.
const MOOD_TINT = (avg) => (avg <= 1.5 ? "#F8DADA" : avg <= 2.5 ? "#FBE7D3" : avg <= 3.5 ? "#F4F0DA" : avg <= 4.5 ? "#E1F0DC" : "#D3EBD9");

const key = (d) => d.toLocaleDateString("en-CA"); // local YYYY-MM-DD
const timeLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export default function JournalMonthPage() {
  const { fontFamily, pageColor } = useJournalStyle();
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [entries, setEntries] = useState([]);
  const [moods, setMoods] = useState([]);
  const [picked, setPicked] = useState(key(new Date()));
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listJournal(""), moodHistory()])
      .then(([e, m]) => { setEntries(e); setMoods(m); })
      .catch(() => setError("Could not load your journal."));
  }, []);

  const entriesByDay = useMemo(() => {
    const acc = {};
    entries.forEach((e) => { (acc[key(new Date(e.created_at))] ||= []).push(e); });
    return acc;
  }, [entries]);

  const moodByDay = useMemo(() => {
    const acc = {};
    moods.forEach((m) => { (acc[key(new Date(m.created_at))] ||= []).push(m.mood); });
    return Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
  }, [moods]);

  // Calendar cells for the shown month, Monday first.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const monthPrefix = key(month).slice(0, 7);
  const monthEntries = entries.filter((e) => key(new Date(e.created_at)).startsWith(monthPrefix));
  const monthMoods = Object.entries(moodByDay).filter(([k]) => k.startsWith(monthPrefix));
  const monthAvg = monthMoods.length ? monthMoods.reduce((a, [, v]) => a + v, 0) / monthMoods.length : null;
  const dayEntries = entriesByDay[picked] || [];
  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader title="Your month" subtitle="Look back at how the days felt. Only you can see this." />
      <div className="flex gap-2">
        <Link to="/app/journal"><Button variant="soft" size="sm"><PenLineIcon size={14} /> Write today</Button></Link>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="grid lg:grid-cols-5 gap-6">
        <Card padding="lg" className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => shift(-1)} aria-label="Previous month" className="p-2 rounded-full hover:bg-black/[0.05]"><ChevronLeftIcon size={18} /></button>
            <p className="font-bold text-charcoal text-lg">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
            <button onClick={() => shift(1)} aria-label="Next month" className="p-2 rounded-full hover:bg-black/[0.05]"><ChevronRightIcon size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((w) => <p key={w} className="text-[11px] font-bold uppercase tracking-wider text-charcoal-muted pb-1">{w}</p>)}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const k = key(d);
              const avg = moodByDay[k];
              const count = (entriesByDay[k] || []).length;
              return (
                <button
                  key={k}
                  onClick={() => setPicked(k)}
                  aria-label={`${d.toDateString()}${count ? `, ${count} entries` : ""}`}
                  style={avg !== undefined ? { backgroundColor: MOOD_TINT(avg) } : undefined}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center text-sm border-2 transition-all",
                    avg === undefined && "bg-black/[0.03]",
                    picked === k ? "border-brand-500" : "border-transparent hover:border-brand-200"
                  )}
                >
                  <span className="text-xs text-charcoal-light">{d.getDate()}</span>
                  <span className="text-base leading-none">{avg !== undefined ? MOOD_FACE(avg) : ""}</span>
                  <span className="h-1.5 mt-0.5 flex gap-0.5">{count > 0 && <i className="block w-1.5 h-1.5 rounded-full bg-brand-500" />}{count > 1 && <i className="block w-1.5 h-1.5 rounded-full bg-brand-500" />}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-charcoal-muted">Each face is that day's average mood. A dot means you wrote an entry.</p>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card padding="lg">
            <p className="text-sm font-semibold text-charcoal">This month</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-black/[0.03] py-3"><p className="text-xl font-bold text-charcoal">{monthEntries.length}</p><p className="text-[11px] text-charcoal-muted">entries</p></div>
              <div className="rounded-xl bg-black/[0.03] py-3"><p className="text-xl font-bold text-charcoal">{new Set(monthEntries.map((e) => key(new Date(e.created_at)))).size}</p><p className="text-[11px] text-charcoal-muted">days written</p></div>
              <div className="rounded-xl bg-black/[0.03] py-3"><p className="text-xl font-bold text-charcoal">{monthAvg === null ? "–" : MOOD_FACE(monthAvg)}</p><p className="text-[11px] text-charcoal-muted">average mood</p></div>
            </div>
          </Card>

          <Card padding="lg" style={{ backgroundColor: pageColor }}>
            <p className="font-bold text-charcoal">{new Date(picked + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
            {moodByDay[picked] !== undefined && <p className="text-xs text-charcoal-muted mt-0.5">Mood that day {MOOD_FACE(moodByDay[picked])}</p>}
            {dayEntries.length === 0 ? (
              <p className="mt-3 text-sm text-charcoal-muted">No entries on this day.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {dayEntries.slice().reverse().map((e) => (
                  <li key={e.id} className="border-t border-black/[0.06] pt-3 first:border-0 first:pt-0">
                    <p className="text-[11px] text-charcoal-muted">{timeLabel(e.created_at)}</p>
                    <p className="whitespace-pre-wrap text-[15px] leading-7 text-charcoal" style={{ fontFamily }}>{e.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
