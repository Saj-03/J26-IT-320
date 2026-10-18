import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRightIcon, AwardIcon, BriefcaseIcon, DownloadIcon, EyeIcon, FileTextIcon, FolderGit2Icon, GraduationCapIcon,
  InfoIcon, LayoutTemplateIcon, PencilIcon, SaveIcon, ShieldCheckIcon, SparklesIcon, TargetIcon, Trash2Icon,
  UserIcon, UsersIcon, WrenchIcon,
} from "lucide-react";
import { PageHeader } from "../../../shared/components/layout/PageHeader";
import { apiErrorMessage } from "../../../shared/api/client";
import Card from "../components/CareerCard";
import CareerPage from "../components/CareerPage";
import Button from "../components/CareerButton";
import CareerSkeleton from "../components/CareerSkeleton";
import CVPreview from "../components/cv/CVPreview";
import { TEMPLATE_INFO } from "../components/cv/CVDocument";
import { AiButton, AiSuggestion, CVField, CVSection, EntryList, MonthRange, SkillEditor } from "../components/cv/CVFormParts";
import { cvAssist, deleteMyCV, getCareer, getMyCV, health, saveMyCV } from "../api/careerApi";
import { careerSession } from "../utils/careerSession";
import {
  NEW_ENTRY, TEMPLATES, cvForSave, emptyCV, prefillFromSurvey, recommendedTemplate, surveySuggestions, validateCV,
} from "../utils/cvModel";
import { printCV } from "../utils/cvPdf";
import { toast } from "../utils/toast";
import { celebrate } from "../utils/celebrate";
import { cn } from "../../../shared/lib/cn";
import { t, useLanguage } from "../i18n";

const SOURCE_ID = "acrds-cv-source";     // the preview element that is printed to PDF
const DRAFT_KEY = "acrds.cvDraft";       // unsaved edits in this tab (scoped to the account)
const CONSENT_KEY = "acrds.cvAiConsent"; // the student accepted the AI notice in this tab

const readDraft = (owner) => {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
    return d && d.owner === owner ? d.cv : null;
  } catch {
    return null;
  }
};
const writeDraft = (owner, cv) => {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ owner, cv }));
  } catch { /* storage unavailable */ }
};
const clearDraft = () => {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore */ }
};
const hasConsent = () => {
  try {
    return sessionStorage.getItem(CONSENT_KEY) === "yes";
  } catch {
    return false;
  }
};

export default function CVBuilder() {
  useLanguage();
  const navigate = useNavigate();
  const passedCareer = useLocation().state?.careerId;
  const [cv, setCv] = useState(emptyCV);
  const [loading, setLoading] = useState(true);
  const [prefilled, setPrefilled] = useState([]);
  const [suggestions, setSuggestions] = useState(() => surveySuggestions(null, null));
  const [hasSurvey, setHasSurvey] = useState(false);
  const [notice, setNotice] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [triedDownload, setTriedDownload] = useState(false); // after that, name + email are required
  const [llm, setLlm] = useState({ enabled: false });
  const [ai, setAi] = useState(null);           // { key, busy } or { key, suggestion }
  const [consentFor, setConsentFor] = useState(null); // AI request waiting for the privacy notice
  const [tab, setTab] = useState("edit");        // phones: edit | preview

  // ---- load: unsaved edits in this tab > saved CV in the database > new CV prefilled from the survey
  useEffect(() => {
    let active = true;
    (async () => {
      health().then((h) => active && setLlm(h.llm_feedback || { enabled: false })).catch(() => {});
      await careerSession.syncFromServer().catch(() => {}); // fresh tab: get the saved survey first
      const flow = careerSession.get();
      const careerId = passedCareer || flow.gapAnalysis?.career_id || flow.selectedCareer?.career_id;
      const career = careerId ? await getCareer(careerId).catch(() => null) : null; // English career record
      const fromSurvey = prefillFromSurvey(flow, career);
      const local = readDraft(careerSession.ownerId());
      const server = await getMyCV().catch(() => ({ cv: null, failed: true }));
      if (!active) return;
      setHasSurvey(!!flow.profile);
      setSuggestions(fromSurvey.suggestions);
      if (local) {
        setCv({ ...emptyCV(), ...local });
        setDirty(true);
        setNotice(t("We restored your unsaved changes from this session."));
      } else if (server.cv) {
        setCv({ ...emptyCV(), ...server.cv, career_id: server.cv.career_id || fromSurvey.cv.career_id });
        setSavedAt(server.updated_at);
        setNotice(t("Your saved CV draft was loaded."));
      } else {
        setCv(fromSurvey.cv);
        setPrefilled(fromSurvey.prefilled);
        if (server.failed) setNotice(t("Could not load a saved CV. You can still create one; save it when you are online."));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [passedCareer]);

  // Keep unsaved edits in this tab (a refresh does not lose them).
  useEffect(() => {
    if (dirty) writeDraft(careerSession.ownerId(), cvForSave(cv));
  }, [cv, dirty]);

  const change = (updater) => {
    setCv((prev) => (typeof updater === "function" ? updater(prev) : updater));
    setDirty(true);
  };
  const setPersonal = (key, value) => {
    change((c) => ({ ...c, personal: { ...c.personal, [key]: value } }));
    if (key === "headline") setPrefilled((p) => p.filter((x) => x !== "headline"));
  };
  const setList = (section) => (items) => change((c) => ({ ...c, [section]: items }));
  // Errors always reflect the current values (format checks live; required fields after a download attempt).
  const errors = useMemo(() => validateCV(cv, { forDownload: triedDownload }), [cv, triedDownload]);
  const err = (path) => errors[path];

  // ---- AI help (optional): privacy notice once per session, then the suggestion is shown for review
  const askAi = (key, payload) => {
    if (!hasConsent()) return setConsentFor({ key, payload });
    return runAi(key, payload);
  };
  const runAi = async (key, payload) => {
    setConsentFor(null);
    setAi({ key, busy: true });
    try {
      const suggestion = await cvAssist({ ...payload, career_id: cv.career_id || null });
      setAi({ key, suggestion });
    } catch (e) {
      setAi(null);
      toast.error(apiErrorMessage(e, t("The AI assistant did not respond. Please try again, or keep writing yourself.")));
    }
  };
  const acceptConsent = () => {
    try { sessionStorage.setItem(CONSENT_KEY, "yes"); } catch { /* ignore */ }
    runAi(consentFor.key, consentFor.payload);
  };
  const aiFor = (key) => (ai?.key === key ? ai : null);
  const allSkills = [...cv.technical_skills, ...cv.soft_skills];

  const aiBlock = (key, payload, hasInput, onUse, useLabel) => (
    <div className="space-y-2">
      <AiButton available={llm.enabled} hasText={hasInput} busy={!!aiFor(key)?.busy} onClick={() => askAi(key, payload)} />
      {consentFor?.key === key && <ConsentNotice provider={llm.provider} onAccept={acceptConsent} onCancel={() => setConsentFor(null)} />}
      {aiFor(key)?.suggestion && (
        <AiSuggestion key={JSON.stringify(aiFor(key).suggestion)} suggestion={aiFor(key).suggestion} useLabel={useLabel}
          onDiscard={() => setAi(null)} onUse={(value) => { onUse(value); setAi(null); toast.success(t("Suggestion added. You can still edit it.")); }} />
      )}
    </div>
  );

  // ---- actions
  const save = async () => {
    if (Object.keys(validateCV(cv)).length) return toast.error(t("Please fix the highlighted fields before saving."));
    setSaving(true);
    try {
      const res = await saveMyCV(cvForSave(cv));
      setSavedAt(res.updated_at);
      setDirty(false);
      clearDraft();
      setPrefilled([]);
      careerSession.update({ cvSaved: true });
      toast.success(t("CV draft saved."), { emoji: "💾" });
    } catch (e) {
      toast.error(apiErrorMessage(e, t("Could not save your CV. Your changes are kept in this tab.")));
    } finally {
      setSaving(false);
    }
  };
  const download = () => {
    setTriedDownload(true);
    if (Object.keys(validateCV(cv, { forDownload: true })).length) {
      setTab("edit");
      return toast.error(t("Add your full name and a valid email before downloading."));
    }
    const source = document.getElementById(SOURCE_ID);
    if (!source) return toast.error(t("The preview is not ready yet. Please try again."));
    printCV(source, `${cv.personal.full_name} - CV`);
    toast.info(t("Choose “Save as PDF” in the print window."));
    celebrate("small");
  };
  const remove = async () => {
    if (!window.confirm(t("Delete your saved CV draft? This cannot be undone."))) return;
    try {
      await deleteMyCV();
      clearDraft();
      const flow = careerSession.get();
      const career = cv.career_id ? await getCareer(cv.career_id).catch(() => null) : null;
      const fresh = prefillFromSurvey(flow, career);
      setCv(fresh.cv);
      setPrefilled(fresh.prefilled);
      setSavedAt(null);
      setDirty(false);
      careerSession.update({ cvSaved: false });
      toast.info(t("Your CV draft was deleted."));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };
  const goToInterview = () => navigate("/app/career/interview", { state: { careerId: cv.career_id || passedCareer } });

  if (loading) return <CareerSkeleton variant="cards" label={t("Loading your CV…")} />;

  const status = dirty ? t("Unsaved changes") : savedAt ? t("Saved") : t("Not saved yet");
  const careerName = suggestions.careerName;

  return (
    <CareerPage step="cv">
      <PageHeader
        title={t("CV Builder")}
        subtitle={t("Create a professional CV in English. This step is optional – you can skip it at any time.")}
        action={
          <Button variant="outline" onClick={goToInterview} className="acrds-no-print">
            {t("Skip and Continue to Interview Simulator")} <ArrowRightIcon size={16} />
          </Button>
        }
      />

      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-[#D0F2F7]/70 border border-[#9EB2DB]/50 px-4 py-3 text-sm text-[#24566A]">
          <InfoIcon size={18} className="shrink-0 mt-0.5" /> {notice}
        </p>
      )}
      {!hasSurvey && (
        <Card padding="md" className="flex flex-wrap items-center gap-3">
          <InfoIcon size={18} className="text-[#34477A]" />
          <p className="flex-1 text-sm text-charcoal-light">{t("No career survey found, so nothing was prefilled. You can create your CV manually, or complete the survey first.")}</p>
          <Button size="sm" variant="soft" onClick={() => navigate("/app/career/survey")}>{t("Start survey")}</Button>
        </Card>
      )}

      {/* Template choice */}
      <Card padding="md">
        <p className="flex items-center gap-2 font-bold text-charcoal mb-3"><LayoutTemplateIcon size={18} className="text-[#1F5F53]" /> {t("Select CV template")}</p>
        <div role="radiogroup" aria-label={t("Select CV template")} className="grid sm:grid-cols-3 gap-3">
          {TEMPLATES.map((key) => {
            const on = cv.template === key;
            return (
              <button key={key} type="button" role="radio" aria-checked={on} onClick={() => change((c) => ({ ...c, template: key }))}
                className={cn("text-left rounded-2xl border-2 p-3 transition-colors",
                  on ? "border-[#5DBFA9] bg-[#C7F2D1]/50" : "border-[#9ADBCC]/40 bg-white hover:bg-[#E3FFD6]")}>
                <TemplateThumb template={key} />
                <span className="mt-2 flex flex-wrap items-center gap-1.5 font-bold text-sm text-charcoal">
                  {t(TEMPLATE_INFO[key].name)}
                  {hasSurvey && recommendedTemplate(careerSession.get().profile) === key && (
                    <span className="rounded-full bg-[#9ADBCC] px-2 py-0.5 text-[10px] font-bold text-[#12352E]">{t("Suggested")}</span>
                  )}
                </span>
                <span className="block text-xs text-charcoal-muted">{t(TEMPLATE_INFO[key].best)}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Phone: switch between the form and the preview */}
      <div className="lg:hidden grid grid-cols-2 gap-1 rounded-full bg-white/80 border border-[#9ADBCC]/60 p-1" role="tablist">
        {[["edit", PencilIcon, t("Edit")], ["preview", EyeIcon, t("Preview")]].map(([key, Icon, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={cn("flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold",
              tab === key ? "bg-[#9ADBCC] text-[#12352E]" : "text-charcoal-light")}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
        {/* ---------------- Form ---------------- */}
        <div className={cn("space-y-4 min-w-0", tab !== "edit" && "hidden lg:block")}>
          <CVSection icon={UserIcon} title={t("Personal information")} desc={t("Only you decide what contact details appear on your CV.")}>
            <div className="grid sm:grid-cols-2 gap-3">
              <CVField label={t("Full name")} required value={cv.personal.full_name} onChange={(v) => setPersonal("full_name", v)} error={err("personal.full_name")} autoComplete="name" />
              <CVField label={t("Professional headline")} value={cv.personal.headline} onChange={(v) => setPersonal("headline", v)}
                fromSurvey={prefilled.includes("headline")} placeholder="e.g. Final-year Software Engineering undergraduate" />
              <CVField label={t("Email")} required type="email" value={cv.personal.email} onChange={(v) => setPersonal("email", v)} error={err("personal.email")} autoComplete="email" />
              <CVField label={t("Phone number")} type="tel" value={cv.personal.phone} onChange={(v) => setPersonal("phone", v)} error={err("personal.phone")} autoComplete="tel" placeholder="+94 77 123 4567" />
              <CVField label={t("Location")} value={cv.personal.location} onChange={(v) => setPersonal("location", v)} placeholder="e.g. Colombo, Sri Lanka" />
              <CVField label={t("LinkedIn profile (optional)")} value={cv.personal.linkedin} onChange={(v) => setPersonal("linkedin", v)} error={err("personal.linkedin")} placeholder="linkedin.com/in/yourname" />
              <CVField label={t("GitHub / Portfolio URL (optional)")} value={cv.personal.website} onChange={(v) => setPersonal("website", v)} error={err("personal.website")} placeholder="github.com/yourname" />
            </div>
          </CVSection>

          <CVSection icon={FileTextIcon} title={t("Professional summary")} desc={t("3-4 sentences about who you are and what you want to do.")}>
            <CVField multiline rows={4} label={t("Summary")} value={cv.summary} onChange={(v) => change((c) => ({ ...c, summary: v }))}
              hint={t("Write it yourself first – the AI can then improve the wording.")} />
            {aiBlock("summary", { task: "summary", headline: cv.personal.headline, summary: cv.summary, skills: allSkills },
              !!cv.summary.trim(), (v) => change((c) => ({ ...c, summary: v })), t("Use this summary"))}
          </CVSection>

          <CVSection icon={GraduationCapIcon} title={t("Education")} count={cv.education.length}>
            <EntryList items={cv.education} onChange={setList("education")} create={NEW_ENTRY.education} max={10}
              addLabel={t("Add education")} titleOf={(e) => e.degree || e.institution}
              render={(e, set, i) => (
                <>
                  {prefilled.includes(`education.${i}`) && (
                    <p className="text-xs text-[#24566A] bg-[#D0F2F7]/60 rounded-xl px-3 py-2">{t("Degree and field come from your survey. Add your university and check the details.")}</p>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <CVField label={t("University / Institution")} value={e.institution} onChange={(v) => set({ institution: v })} />
                    <CVField label={t("Degree / Qualification")} value={e.degree} onChange={(v) => set({ degree: v })} fromSurvey={prefilled.includes(`education.${i}`)} />
                    <CVField label={t("Field of study")} value={e.field} onChange={(v) => set({ field: v })} />
                    <CVField label={t("GPA (optional)")} value={e.gpa} onChange={(v) => set({ gpa: v })} hint={t("Only add your real GPA.")} />
                  </div>
                  <MonthRange value={e} onChange={set} error={err(`education.${i}.end`)} presentLabel={t("I currently study here")} />
                  <CVField multiline label={t("Academic achievements (optional)")} value={e.achievements} onChange={(v) => set({ achievements: v })}
                    hint={t("One item per line, e.g. Dean's List 2024.")} />
                </>
              )} />
          </CVSection>

          <CVSection icon={WrenchIcon} title={t("Technical and soft skills")} count={allSkills.length}>
            <SkillEditor label={t("Technical skills")} skills={cv.technical_skills} placeholder="e.g. Python, React, AutoCAD"
              onChange={(v) => change((c) => ({ ...c, technical_skills: v }))} suggestions={suggestions.tools}
              suggestionNote={t("Tools often used by a {career}. Add only the ones you have really used.", { career: careerName || t("your chosen career") })} />
            <SkillEditor label={t("Soft skills")} skills={cv.soft_skills} placeholder="e.g. Teamwork, Communication"
              onChange={(v) => change((c) => ({ ...c, soft_skills: v }))} suggestions={suggestions.softSkills}
              suggestionNote={t("You rated these 4 or 5 out of 5 in the survey. A self-rating is not a qualification – add a skill only if you can give an example of it.")} />
          </CVSection>

          <CVSection icon={BriefcaseIcon} title={t("Work experience")} count={cv.experience.length}
            defaultOpen={cv.experience.length > 0 || suggestions.workTypes.length > 0}>
            {suggestions.workTypes.length > 0 && (
              <p className="text-xs text-charcoal-muted">{t("In the survey you said you have done: {list}. Add the real details here or under Projects.", { list: suggestions.workTypes.join(", ") })}</p>
            )}
            <EntryList items={cv.experience} onChange={setList("experience")} create={NEW_ENTRY.experience}
              addLabel={t("Add experience")} titleOf={(e) => [e.position, e.company].filter(Boolean).join(" – ")}
              render={(e, set, i) => (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <CVField label={t("Company")} value={e.company} onChange={(v) => set({ company: v })} />
                    <CVField label={t("Position")} value={e.position} onChange={(v) => set({ position: v })} />
                  </div>
                  <MonthRange value={e} onChange={set} error={err(`experience.${i}.end`)} presentLabel={t("I currently work here")} />
                  <CVField multiline rows={4} label={t("Responsibilities")} value={e.responsibilities} onChange={(v) => set({ responsibilities: v })}
                    hint={t("One item per line. Simple words are fine – the AI can help with the wording.")} />
                  <CVField multiline label={t("Achievements")} value={e.achievements} onChange={(v) => set({ achievements: v })}
                    hint={t("Only real results. Add numbers only if you know them.")} />
                  {aiBlock(`experience.${i}`, { task: "experience", position: e.position, responsibilities: e.responsibilities, achievements: e.achievements },
                    !!(e.responsibilities.trim() || e.achievements.trim()),
                    (v) => set({ responsibilities: v, achievements: "" }), t("Use these bullet points"))}
                </>
              )} />
          </CVSection>

          <CVSection icon={FolderGit2Icon} title={t("Projects")} count={cv.projects.length}>
            <EntryList items={cv.projects} onChange={setList("projects")} create={NEW_ENTRY.projects}
              addLabel={t("Add project")} titleOf={(p) => p.title}
              render={(p, set, i) => (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <CVField label={t("Project title")} value={p.title} onChange={(v) => set({ title: v })} />
                    <CVField label={t("Technologies used")} value={p.technologies} onChange={(v) => set({ technologies: v })} placeholder="React, FastAPI, PostgreSQL" />
                  </div>
                  <CVField label={t("Project link (optional)")} value={p.link} onChange={(v) => set({ link: v })} error={err(`projects.${i}.link`)} placeholder="github.com/you/project" />
                  <CVField multiline rows={4} label={t("Description")} value={p.description} onChange={(v) => set({ description: v })}
                    hint={t("What you built, your part and the result.")} />
                  {aiBlock(`projects.${i}`, { task: "project", title: p.title, description: p.description, technologies: p.technologies },
                    !!p.description.trim(), (v) => set({ description: v }), t("Use these bullet points"))}
                </>
              )} />
          </CVSection>

          <CVSection icon={AwardIcon} title={t("Certifications")} count={cv.certifications.length} defaultOpen={cv.certifications.length > 0}>
            <EntryList items={cv.certifications} onChange={setList("certifications")} create={NEW_ENTRY.certifications} max={20}
              addLabel={t("Add certification")} titleOf={(c) => c.name}
              render={(c, set) => (
                <div className="grid sm:grid-cols-3 gap-3">
                  <CVField label={t("Certification name")} value={c.name} onChange={(v) => set({ name: v })} />
                  <CVField label={t("Issuing organization")} value={c.issuer} onChange={(v) => set({ issuer: v })} />
                  <CVField type="month" label={t("Date")} value={c.date} onChange={(v) => set({ date: v })} />
                </div>
              )} />
          </CVSection>

          <CVSection icon={UsersIcon} title={t("Extracurricular activities")} count={cv.activities.length}
            desc={t("Leadership roles, volunteering, university clubs and other achievements.")}>
            {suggestions.activities.filter((a) => !cv.activities.some((x) => x.organisation === a.organisation)).length > 0 && (
              <div className="rounded-2xl bg-[#D0F2F7]/50 border border-[#9EB2DB]/40 p-3 space-y-2">
                <p className="text-xs text-[#24566A]">{t("From your survey. Add an activity and fill in the real details.")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.activities.filter((a) => !cv.activities.some((x) => x.organisation === a.organisation)).map((a) => (
                    <button key={a.organisation} type="button" lang="en" onClick={() => setList("activities")([...cv.activities, a])}
                      className="rounded-full border border-[#9EB2DB] bg-white px-2.5 py-1 text-xs font-semibold text-[#34477A] hover:bg-[#E3FFD6]">
                      + {a.role ? `${a.role} – ` : ""}{a.organisation}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <EntryList items={cv.activities} onChange={setList("activities")} create={NEW_ENTRY.activities}
              addLabel={t("Add activity")} titleOf={(a) => [a.role, a.organisation].filter(Boolean).join(" – ")}
              render={(a, set) => (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <CVField label={t("Role")} value={a.role} onChange={(v) => set({ role: v })} placeholder="e.g. Team leader, Volunteer" />
                    <CVField label={t("Club / organisation")} value={a.organisation} onChange={(v) => set({ organisation: v })} />
                  </div>
                  <CVField multiline label={t("What you did (optional)")} value={a.description} onChange={(v) => set({ description: v })} />
                </>
              )} />
          </CVSection>

          {/* Tailor to the chosen ACRDS career */}
          <CVSection icon={TargetIcon} title={careerName ? t("Tailor my CV to {career}", { career: careerName }) : t("Tailor my CV to a career")}
            desc={t("The AI suggests wording and which of YOUR skills and projects to put first. It never adds anything you do not have.")}>
            {!cv.career_id ? (
              <p className="text-sm text-charcoal-muted">{t("Select a career in your recommendations first.")}</p>
            ) : (
              <TailorBlock cv={cv} llm={llm} allSkills={allSkills} ai={aiFor("tailor")} consent={consentFor?.key === "tailor"}
                onAsk={() => askAi("tailor", { task: "tailor", headline: cv.personal.headline, summary: cv.summary, skills: allSkills,
                  project_titles: cv.projects.map((p) => p.title).filter(Boolean),
                  experience_positions: cv.experience.map((e) => e.position).filter(Boolean) })}
                onAccept={acceptConsent} onCancelConsent={() => setConsentFor(null)} onDiscard={() => setAi(null)}
                onUse={(patch) => { change(patch); toast.success(t("Suggestion added. You can still edit it.")); }} />
            )}
          </CVSection>
        </div>

        {/* ---------------- Preview ---------------- */}
        <div className={cn("min-w-0 lg:sticky lg:top-24 space-y-3", tab !== "preview" && "hidden lg:block")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", dirty ? "bg-[#FFE8C2] text-[#7A4B00]" : "bg-[#C7F2D1] text-[#1F5E3D]")}>{status}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={save} disabled={saving}><SaveIcon size={14} /> {saving ? t("Saving…") : t("Save draft")}</Button>
              <Button size="sm" onClick={download}><DownloadIcon size={14} /> {t("Download PDF")}</Button>
            </div>
          </div>
          <CVPreview cv={cv} sourceId={SOURCE_ID} />
        </div>
      </div>

      {/* Bottom actions */}
      <Card padding="lg" className="acrds-no-print space-y-3">
        <p className="flex items-center gap-2 text-xs text-charcoal-muted"><ShieldCheckIcon size={14} className="text-[#1F5F53]" />
          {t("Your CV is saved only to your own account. AI help is optional and never sends your name or contact details.")}</p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <Button variant="outline" onClick={save} disabled={saving}><SaveIcon size={16} /> {saving ? t("Saving…") : t("Save draft")}</Button>
          <Button variant="soft" onClick={download}><DownloadIcon size={16} /> {t("Download PDF")}</Button>
          {savedAt && <Button variant="outline" onClick={remove} className="text-red-700 border-red-200"><Trash2Icon size={16} /> {t("Delete draft")}</Button>}
          <Button onClick={goToInterview} className="sm:ml-auto">{t("Continue to Interview Simulator")} <ArrowRightIcon size={16} /></Button>
        </div>
      </Card>

      {/* Phone: actions always one tap away (above the app's bottom navigation) */}
      {createPortal(
        <div className="acrds-no-print lg:hidden fixed inset-x-3 bottom-20 z-40 flex gap-2 rounded-full bg-[#FFFBF0]/95 backdrop-blur border border-[#9ADBCC]/60 shadow-lift p-1.5">
          <Button variant="outline" size="sm" onClick={save} disabled={saving} aria-label={t("Save draft")} className="px-3"><SaveIcon size={18} /></Button>
          <Button variant="outline" size="sm" onClick={download} aria-label={t("Download PDF")} className="px-3"><DownloadIcon size={18} /></Button>
          <Button size="sm" onClick={goToInterview} className="flex-1">{t("Continue to Interview Simulator")} <ArrowRightIcon size={15} /></Button>
        </div>,
        document.body,
      )}
      <div className="h-16 lg:hidden" aria-hidden />
    </CareerPage>
  );
}

function ConsentNotice({ provider, onAccept, onCancel }) {
  return (
    <div role="alertdialog" aria-label={t("AI privacy notice")} className="rounded-2xl border border-[#9EB2DB] bg-white p-4 space-y-3 acrds-fade">
      <p className="flex items-start gap-2 text-sm text-charcoal-light">
        <ShieldCheckIcon size={18} className="shrink-0 text-[#34477A] mt-0.5" />
        {t("To suggest wording, the text of this section is sent to an external AI provider ({provider}). Your name, email, phone and links are never sent. Check every suggestion before using it.",
          { provider: provider === "gemini" ? "Google Gemini" : provider || "AI" })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onAccept}>{t("I understand, continue")}</Button>
        <Button size="sm" variant="outline" onClick={onCancel}>{t("Cancel")}</Button>
      </div>
    </div>
  );
}

function TailorBlock({ cv, llm, allSkills, ai, consent, onAsk, onAccept, onCancelConsent, onDiscard, onUse }) {
  const s = ai?.suggestion;
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  useEffect(() => {
    setHeadline(s?.headline || "");
    setSummary(s?.text || "");
  }, [s]);
  const reorder = (first) => (c) => {
    const pick = (list) => [...first.filter((x) => list.includes(x)), ...list.filter((x) => !first.includes(x))];
    return { ...c, technical_skills: pick(c.technical_skills), soft_skills: pick(c.soft_skills) };
  };
  return (
    <div className="space-y-3">
      <AiButton available={llm.enabled} hasText={!!(cv.summary.trim() || allSkills.length)} busy={!!ai?.busy}
        onClick={onAsk} label={t("Suggest tailored wording")} />
      {consent && <ConsentNotice provider={llm.provider} onAccept={onAccept} onCancel={onCancelConsent} />}
      {s && (
        <div className="rounded-2xl border-2 border-[#9EB2DB] bg-[#F4F7FD] p-4 space-y-3 acrds-fade">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#34477A]"><SparklesIcon size={14} /> {t("AI suggestion – check it before using")}</p>
          {s.headline && (
            <div className="space-y-1.5">
              <CVField label={t("Suggested headline")} value={headline} onChange={setHeadline} />
              <Button size="sm" variant="soft" onClick={() => onUse((c) => ({ ...c, personal: { ...c.personal, headline } }))}>{t("Use this headline")}</Button>
            </div>
          )}
          {s.text && (
            <div className="space-y-1.5">
              <CVField multiline rows={4} label={t("Suggested summary")} value={summary} onChange={setSummary} />
              <Button size="sm" variant="soft" onClick={() => onUse((c) => ({ ...c, summary }))}>{t("Use this summary")}</Button>
            </div>
          )}
          {s.highlight_skills?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-charcoal-light">{t("Put these skills first:")} <span lang="en">{s.highlight_skills.join(", ")}</span></p>
              <Button size="sm" variant="soft" onClick={() => onUse(reorder(s.highlight_skills))}>{t("Reorder my skills")}</Button>
            </div>
          )}
          {s.removed > 0 && <p className="text-xs text-[#34477A]">{t("{n} part(s) were removed because they added numbers you did not write.", { n: s.removed })}</p>}
          {s.tips?.length > 0 && <ul className="list-disc pl-5 text-xs text-charcoal-light space-y-0.5" lang="en">{s.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
          <Button size="sm" variant="outline" onClick={onDiscard}>{t("Discard")}</Button>
        </div>
      )}
    </div>
  );
}

// Small picture of each template for the chooser.
function TemplateThumb({ template }) {
  const bar = (w, cls = "bg-[#cbd5e1]") => <span className={cn("block h-1 rounded-full", cls)} style={{ width: w }} />;
  return (
    <span aria-hidden className="block rounded-xl bg-white border border-black/10 p-2.5 h-24 overflow-hidden space-y-1.5">
      {template === "modern" && <>
        <span className="block border-b-2 border-[#5dbfa9] pb-1 space-y-1">{bar("55%", "bg-[#12352e]")}{bar("40%", "bg-[#5dbfa9]")}</span>
        {bar("30%", "bg-[#1f5f53]")}{bar("90%")}{bar("80%")}{bar("30%", "bg-[#1f5f53]")}{bar("85%")}
      </>}
      {template === "ats" && <>
        <span className="flex flex-col items-center gap-1">{bar("50%", "bg-black")}{bar("70%", "bg-[#6b7280]")}</span>
        <span className="block border-b border-black" />{bar("90%")}{bar("85%")}<span className="block border-b border-black" />{bar("80%")}
      </>}
      {template === "creative" && <>
        <span className="block rounded bg-[#e8f1fb] border-l-4 border-[#34477a] p-1 space-y-1">{bar("55%", "bg-[#1e2d57]")}{bar("35%", "bg-[#34477a]")}</span>
        {bar("25%", "bg-[#34477a]")}<span className="flex gap-1">{["30%", "22%", "28%"].map((w) => <span key={w} className="h-2 rounded-full bg-[#eef2fb] border border-[#cdd7ee]" style={{ width: w }} />)}</span>{bar("85%")}
      </>}
    </span>
  );
}
