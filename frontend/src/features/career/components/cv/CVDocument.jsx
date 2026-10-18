import { dateRange, formatMonth, hasText, linkHref, linkLabel, toLines } from "../../utils/cvModel";

// The CV itself: one markup for all three templates, styled by CV_CSS below.
// The SAME element is shown in the live preview and copied into the print window for the PDF,
// so the downloaded PDF matches the preview. Plain HTML text => the PDF text is selectable.
// Section headings are in English: the CV is written in English.

export const TEMPLATE_INFO = {
  modern: { name: "Modern Professional", best: "Computing, Engineering and Business" },
  ats: { name: "Classic ATS-Friendly", best: "Online job applications (single column, no graphics)" },
  creative: { name: "Creative Minimal", best: "Design, Marketing and Creative Studies" },
};

function Lines({ text }) {
  const lines = toLines(text);
  if (!lines.length) return null;
  if (lines.length === 1) return <p className="cv-text">{lines[0]}</p>;
  return <ul className="cv-bullets">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
}

function Section({ title, children }) {
  return (
    <section className="cv-section">
      <h2 className="cv-h2">{title}</h2>
      {children}
    </section>
  );
}

function EntryHead({ title, sub, dates }) {
  return (
    <div className="cv-entry-head">
      <div className="cv-entry-title">
        <strong>{title}</strong>
        {sub && <span className="cv-sub">{sub}</span>}
      </div>
      {dates && <span className="cv-dates">{dates}</span>}
    </div>
  );
}

export default function CVDocument({ cv, id }) {
  const p = cv.personal;
  const template = cv.template || "modern";
  const contact = [
    p.email && <a key="e" href={`mailto:${p.email}`}>{p.email}</a>,
    p.phone && <span key="p">{p.phone}</span>,
    p.location && <span key="l">{p.location}</span>,
    p.linkedin && <a key="in" href={linkHref(p.linkedin)}>{linkLabel(p.linkedin)}</a>,
    p.website && <a key="w" href={linkHref(p.website)}>{linkLabel(p.website)}</a>,
  ].filter(Boolean);
  const education = cv.education.filter(hasText);
  const experience = cv.experience.filter(hasText);
  const projects = cv.projects.filter(hasText);
  const certifications = cv.certifications.filter(hasText);
  const activities = cv.activities.filter(hasText);
  const skillList = (skills) => template === "creative"
    ? <span className="cv-tags">{skills.map((s) => <span key={s} className="cv-tag">{s}</span>)}</span>
    : <span>{skills.join(", ")}</span>;

  return (
    <article id={id} className={`cvdoc t-${template}`} lang="en">
      <header className="cv-header">
        <h1 className="cv-name">{p.full_name || "Your Name"}</h1>
        {p.headline && <p className="cv-headline">{p.headline}</p>}
        {contact.length > 0 && (
          <p className="cv-contact">
            {contact.map((c, i) => <span key={i}>{i > 0 && <span className="cv-sep"> | </span>}{c}</span>)}
          </p>
        )}
      </header>

      {cv.summary.trim() && <Section title="Professional Summary"><Lines text={cv.summary} /></Section>}

      {education.length > 0 && (
        <Section title="Education">
          {education.map((e, i) => (
            <div key={i} className="cv-entry">
              <EntryHead title={[e.degree, e.field].filter(Boolean).join(" – ") || e.institution}
                sub={e.degree || e.field ? e.institution : ""} dates={dateRange(e)} />
              {e.gpa && <p className="cv-text">GPA: {e.gpa}</p>}
              <Lines text={e.achievements} />
            </div>
          ))}
        </Section>
      )}

      {(cv.technical_skills.length > 0 || cv.soft_skills.length > 0) && (
        <Section title="Skills">
          {cv.technical_skills.length > 0 && <p className="cv-text cv-skillrow"><strong>Technical: </strong>{skillList(cv.technical_skills)}</p>}
          {cv.soft_skills.length > 0 && <p className="cv-text cv-skillrow"><strong>Soft skills: </strong>{skillList(cv.soft_skills)}</p>}
        </Section>
      )}

      {experience.length > 0 && (
        <Section title="Work Experience">
          {experience.map((e, i) => (
            <div key={i} className="cv-entry">
              <EntryHead title={e.position || e.company} sub={e.position ? e.company : ""} dates={dateRange(e)} />
              <Lines text={e.responsibilities} />
              <Lines text={e.achievements} />
            </div>
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Projects">
          {projects.map((pr, i) => (
            <div key={i} className="cv-entry">
              <EntryHead title={pr.title || "Project"}
                sub={pr.link ? <a href={linkHref(pr.link)}>{linkLabel(pr.link)}</a> : ""} />
              {pr.technologies && <p className="cv-text cv-tech">Technologies: {pr.technologies}</p>}
              <Lines text={pr.description} />
            </div>
          ))}
        </Section>
      )}

      {certifications.length > 0 && (
        <Section title="Certifications">
          {certifications.map((c, i) => (
            <div key={i} className="cv-entry cv-entry-tight">
              <EntryHead title={c.name} sub={c.issuer} dates={formatMonth(c.date)} />
            </div>
          ))}
        </Section>
      )}

      {activities.length > 0 && (
        <Section title="Extracurricular Activities">
          {activities.map((a, i) => (
            <div key={i} className="cv-entry">
              <EntryHead title={a.role || a.organisation} sub={a.role ? a.organisation : ""} />
              <Lines text={a.description} />
            </div>
          ))}
        </Section>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Styles. Sizes are in pt/mm so the preview and the A4 PDF match.
// `.cvdoc` in the preview is a 210 mm wide sheet with 14 mm padding; in the PDF the padding
// becomes the @page margin (see utils/cvPdf.js), so every page has the same margins.
// ---------------------------------------------------------------------------
export const CV_CSS = `
.cvdoc { box-sizing: border-box; width: 210mm; min-height: 297mm; padding: 14mm 15mm; background: #fff; color: #1f2933;
  font-size: 10pt; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; overflow-wrap: anywhere; }
.cvdoc * { box-sizing: border-box; margin: 0; }
.cvdoc a { color: inherit; text-decoration: none; }
.cvdoc .cv-header { margin-bottom: 5mm; }
.cvdoc .cv-name { font-size: 22pt; line-height: 1.15; font-weight: 700; }
.cvdoc .cv-headline { font-size: 11.5pt; margin-top: 1.5mm; }
.cvdoc .cv-contact { font-size: 9pt; margin-top: 2mm; color: #4b5563; }
.cvdoc .cv-section { margin-top: 4.5mm; }
.cvdoc .cv-h2 { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 2mm; break-after: avoid; page-break-after: avoid; }
.cvdoc .cv-entry { margin-bottom: 3mm; break-inside: avoid; page-break-inside: avoid; }
.cvdoc .cv-entry-tight { margin-bottom: 1.5mm; }
.cvdoc .cv-entry-head { display: flex; justify-content: space-between; gap: 4mm; align-items: baseline; }
.cvdoc .cv-entry-title { min-width: 0; }
.cvdoc .cv-sub { margin-left: 2mm; color: #4b5563; }
.cvdoc .cv-sub::before { content: "· "; }
.cvdoc .cv-dates { font-size: 9pt; color: #4b5563; white-space: nowrap; flex-shrink: 0; }
.cvdoc .cv-text { margin-top: 0.8mm; }
.cvdoc .cv-tech { font-style: italic; color: #4b5563; }
.cvdoc .cv-bullets { margin-top: 0.8mm; padding-left: 5mm; }
.cvdoc .cv-bullets li { margin-bottom: 0.6mm; }
.cvdoc .cv-skillrow { break-inside: avoid; }

/* Template 1 - Modern Professional: clean sans-serif, one teal accent */
.cvdoc.t-modern { font-family: Calibri, "Segoe UI", Arial, sans-serif; }
.cvdoc.t-modern .cv-name { color: #12352e; }
.cvdoc.t-modern .cv-headline { color: #1f5f53; font-weight: 600; }
.cvdoc.t-modern .cv-header { border-bottom: 2px solid #5dbfa9; padding-bottom: 3mm; }
.cvdoc.t-modern .cv-h2 { color: #1f5f53; border-bottom: 1px solid #c7f2d1; padding-bottom: 1mm; }

/* Template 2 - Classic ATS-Friendly: plain black, single column, standard headings, no graphics */
.cvdoc.t-ats { font-family: Arial, Helvetica, sans-serif; color: #000; }
.cvdoc.t-ats .cv-header { text-align: center; }
.cvdoc.t-ats .cv-name { font-size: 20pt; }
.cvdoc.t-ats .cv-contact, .cvdoc.t-ats .cv-dates, .cvdoc.t-ats .cv-sub, .cvdoc.t-ats .cv-tech { color: #000; }
.cvdoc.t-ats .cv-h2 { border-bottom: 1px solid #000; letter-spacing: 0; }
.cvdoc.t-ats .cv-entry-head { display: block; }
.cvdoc.t-ats .cv-dates { display: inline; font-size: 10pt; }
.cvdoc.t-ats .cv-dates::before { content: " | "; }
.cvdoc.t-ats .cv-sub::before { content: ", "; }
.cvdoc.t-ats .cv-sub { margin-left: 0; }

/* Template 3 - Creative Minimal: serif name, colour band, skill tags */
.cvdoc.t-creative { font-family: "Segoe UI", Calibri, Arial, sans-serif; }
.cvdoc.t-creative .cv-header { background: #e8f1fb; border-left: 5px solid #34477a; padding: 5mm 6mm; border-radius: 2mm; }
.cvdoc.t-creative .cv-name { font-family: Georgia, "Times New Roman", serif; font-weight: 700; color: #1e2d57; letter-spacing: 0.01em; }
.cvdoc.t-creative .cv-headline { color: #34477a; font-style: italic; }
.cvdoc.t-creative .cv-h2 { color: #34477a; letter-spacing: 0.14em; font-size: 9.5pt; }
.cvdoc.t-creative .cv-h2::after { content: ""; display: block; width: 14mm; height: 2px; background: #9ADBCC; margin-top: 1mm; }
.cvdoc.t-creative .cv-tags { display: inline; }
.cvdoc.t-creative .cv-tag { display: inline-block; background: #eef2fb; color: #1e2d57; border-radius: 3mm; padding: 0.3mm 2.2mm; margin: 0.6mm 1mm 0.6mm 0; font-size: 9pt; }
`;
