import { useId, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import Card from "../CareerCard";
import Button from "../CareerButton";
import { cn } from "../../../../shared/lib/cn";
import { t } from "../../i18n";

// Building blocks of the CV form. Inputs use the same look as the shared Field component,
// plus inline errors, textareas and a "From your survey" marker.
const INPUT = "w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-charcoal placeholder:text-charcoal-muted outline-none transition-all focus:border-[#5DBFA9] focus:ring-2 focus:ring-[#5DBFA9]/25";

export function CVField({ label, value, onChange, error, hint, multiline, rows = 3, fromSurvey, required, type = "text", ...props }) {
  const id = useId();
  const Tag = multiline ? "textarea" : "input";
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-charcoal-light">
        {label}{required && <span className="text-red-600" aria-hidden>*</span>}
        {fromSurvey && <span className="rounded-full bg-[#D0F2F7] px-2 py-0.5 text-[10px] font-bold text-[#24566A]">{t("From your survey")}</span>}
      </label>
      <Tag id={id} type={multiline ? undefined : type} rows={multiline ? rows : undefined} value={value ?? ""}
        onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
        className={cn(INPUT, multiline && "resize-y", error ? "border-red-400" : "border-black/10")} lang="en" {...props} />
      {error ? <p id={`${id}-err`} className="text-xs font-semibold text-red-600">{t(error)}</p>
        : hint && <p className="text-xs text-charcoal-muted">{hint}</p>}
    </div>
  );
}

/** Start / end month with a "Present" option. `value` = { start, end, current }. */
export function MonthRange({ value, onChange, error, presentLabel }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <CVField type="month" label={t("Start date")} value={value.start} onChange={(v) => onChange({ start: v })} />
      <div className="space-y-1">
        <CVField type="month" label={t("End date")} value={value.current ? "" : value.end} disabled={value.current}
          onChange={(v) => onChange({ end: v })} error={error} />
        <label className="flex items-center gap-2 text-xs font-semibold text-charcoal-light">
          <input type="checkbox" className="accent-[#5DBFA9] w-4 h-4" checked={!!value.current}
            onChange={(e) => onChange({ current: e.target.checked })} />
          {presentLabel || t("I currently study / work here")}
        </label>
      </div>
    </div>
  );
}

/** Collapsible form section card. `count` = number of entries (shown as a badge). */
export function CVSection({ icon: Icon, title, desc, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <Card padding="none" className="overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#E3FFD6]/50 transition-colors">
        <span className="w-9 h-9 rounded-xl bg-[#C7F2D1] text-[#1F5F53] flex items-center justify-center shrink-0"><Icon size={18} /></span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-charcoal">{title}</span>
          {desc && <span className="block text-xs text-charcoal-muted">{desc}</span>}
        </span>
        {count > 0 && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-xs font-bold text-charcoal-muted">{count}</span>}
        <ChevronDownIcon size={18} className={cn("text-charcoal-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && <div id={id} className="px-5 pb-5 pt-1 space-y-4 acrds-fade">{children}</div>}
    </Card>
  );
}

/** A list of repeatable entries (education, projects, ...) with add / remove / reorder. */
export function EntryList({ items, onChange, create, addLabel, titleOf, render, max = 15 }) {
  const update = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const move = (i, d) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-2xl border border-[#9ADBCC]/50 bg-white/70 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="flex-1 min-w-0 truncate text-sm font-bold text-charcoal">{titleOf(item) || t("New entry")}</p>
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("Move up")}
              className="p-1.5 rounded-lg hover:bg-black/[0.05] disabled:opacity-30"><ArrowUpIcon size={15} /></button>
            <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={t("Move down")}
              className="p-1.5 rounded-lg hover:bg-black/[0.05] disabled:opacity-30"><ArrowDownIcon size={15} /></button>
            <button type="button" onClick={() => remove(i)} aria-label={t("Remove")}
              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"><Trash2Icon size={15} /></button>
          </div>
          {render(item, (patch) => update(i, patch), i)}
        </div>
      ))}
      {items.length < max && (
        <Button variant="outline" size="sm" onClick={() => onChange([...items, create()])}>
          <PlusIcon size={15} /> {addLabel}
        </Button>
      )}
    </div>
  );
}

/** Editable skill chips with an input; `suggestions` are offered as "+ skill" buttons (never added automatically). */
export function SkillEditor({ label, skills, onChange, suggestions = [], suggestionNote, placeholder }) {
  const [text, setText] = useState("");
  const has = (s) => skills.some((x) => x.toLowerCase() === s.toLowerCase());
  const add = (value) => {
    const items = value.split(",").map((s) => s.trim()).filter((s) => s && !has(s));
    if (items.length) onChange([...skills, ...items].slice(0, 40));
    setText("");
  };
  const open = suggestions.filter((s) => !has(s));
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-charcoal-light">{label}</p>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[#C7F2D1] text-[#12352E] pl-3 pr-1 py-1 text-sm font-semibold" lang="en">
            {s}
            <button type="button" onClick={() => onChange(skills.filter((x) => x !== s))} aria-label={t("Remove {skill}", { skill: s })}
              className="rounded-full p-0.5 hover:bg-black/10"><XIcon size={13} /></button>
          </span>
        ))}
        {!skills.length && <span className="text-xs text-charcoal-muted">{t("No skills added yet.")}</span>}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} lang="en"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(text); } }}
          className={cn(INPUT, "border-black/10")} aria-label={label} />
        <Button variant="soft" size="sm" onClick={() => add(text)} disabled={!text.trim()}>{t("Add")}</Button>
      </div>
      {open.length > 0 && (
        <div className="rounded-2xl bg-[#D0F2F7]/50 border border-[#9EB2DB]/40 p-3 space-y-2">
          <p className="text-xs text-[#24566A]">{suggestionNote}</p>
          <div className="flex flex-wrap gap-1.5">
            {open.map((s) => (
              <button key={s} type="button" onClick={() => onChange([...skills, s])} lang="en"
                className="inline-flex items-center gap-1 rounded-full border border-[#9EB2DB] bg-white px-2.5 py-1 text-xs font-semibold text-[#34477A] hover:bg-[#E3FFD6]">
                <PlusIcon size={12} /> {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "Improve with AI" button. Disabled (with a reason) when AI is off or there is no text yet. */
export function AiButton({ onClick, busy, available, hasText, label }) {
  const reason = !available ? t("AI assistance is not available right now. You can keep writing yourself.")
    : !hasText ? t("Write some text first, then ask the AI to improve it.") : "";
  return (
    <Button variant="soft" size="sm" onClick={onClick} disabled={busy || !available || !hasText} title={reason}>
      <SparklesIcon size={14} /> {busy ? t("AI is writing…") : label || t("Improve with AI")}
    </Button>
  );
}

/**
 * AI suggestion for review. Nothing is changed until the student presses "Use this".
 * `value` is editable; `onUse(text)` applies it; `onDiscard` closes it.
 */
export function AiSuggestion({ suggestion, onUse, onDiscard, useLabel }) {
  const initial = suggestion.bullets?.length ? suggestion.bullets.join("\n") : suggestion.text;
  const [value, setValue] = useState(initial);
  return (
    <div className="rounded-2xl border-2 border-[#9EB2DB] bg-[#F4F7FD] p-4 space-y-3 acrds-fade" role="region" aria-label={t("AI suggestion")}>
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#34477A]">
        <SparklesIcon size={14} /> {t("AI suggestion – check it before using")}
      </p>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={Math.min(8, Math.max(3, value.split("\n").length + 1))}
        className={cn(INPUT, "border-[#9EB2DB]/60 resize-y")} lang="en" aria-label={t("Edit the suggestion")} />
      {suggestion.removed > 0 && (
        <p className="text-xs text-[#34477A]">{t("{n} part(s) were removed because they added numbers you did not write.", { n: suggestion.removed })}</p>
      )}
      {suggestion.tips?.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-charcoal-light space-y-0.5" lang="en">
          {suggestion.tips.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onUse(value)} disabled={!value.trim()}>{useLabel || t("Use this")}</Button>
        <Button size="sm" variant="outline" onClick={onDiscard}>{t("Discard")}</Button>
      </div>
    </div>
  );
}
