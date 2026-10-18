import { useLayoutEffect, useRef, useState } from "react";
import CVDocument, { CV_CSS } from "./CVDocument";
import { t } from "../../i18n";

const MM = 96 / 25.4;               // CSS px per mm
const SHEET_W = 210 * MM;            // A4 width
const PAGE_CONTENT = (297 - 28) * MM; // A4 height minus top + bottom margin (14 mm each)
const TOP = 14 * MM;

// Live A4 preview, scaled to the available width. Dashed lines show where a new PDF page starts
// (approximate: in the PDF, entries are moved to the next page rather than split).
export default function CVPreview({ cv, sourceId }) {
  const box = useRef(null);
  const sheet = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(297 * MM);   // sheet height (at least one A4 page)
  const [content, setContent] = useState(0);        // where the CV content really ends

  const measure = useRef(() => {});
  useLayoutEffect(() => measure.current(), [cv]); // content changes (the sheet keeps its A4 size, so no resize event)
  useLayoutEffect(() => {
    const run = (measure.current = () => {
      if (box.current) setScale(Math.min(1, box.current.clientWidth / SHEET_W));
      const doc = sheet.current?.firstElementChild;
      if (doc) {
        setHeight(doc.scrollHeight);
        const last = doc.lastElementChild;
        setContent(last ? last.offsetTop + last.offsetHeight - TOP : 0);
      }
    });
    run();
    const ro = new ResizeObserver(run);
    if (box.current) ro.observe(box.current);
    if (sheet.current) ro.observe(sheet.current);
    return () => ro.disconnect();
  }, []);

  const pages = Math.max(1, Math.ceil(content / PAGE_CONTENT - 0.005)); // tolerance for sub-pixel rounding
  return (
    <div>
      <style>{CV_CSS}</style>
      <div className="flex items-center justify-between mb-2 text-xs font-semibold text-charcoal-muted">
        <span>{t("Live preview (A4)")}</span>
        <span>{t("{n} page(s)", { n: pages })}</span>
      </div>
      <div ref={box} className="w-full overflow-hidden rounded-2xl bg-[#e5e9ef] p-0" style={{ height: height * scale }}>
        <div style={{ width: SHEET_W, transform: `scale(${scale})`, transformOrigin: "top left", position: "relative" }}>
          <div ref={sheet} className="shadow-lift">
            <CVDocument cv={cv} id={sourceId} />
          </div>
          {Array.from({ length: pages - 1 }, (_, i) => (
            <div key={i} aria-hidden className="absolute inset-x-0 border-t-2 border-dashed border-[#9EB2DB]"
              style={{ top: TOP + PAGE_CONTENT * (i + 1) }}>
              <span className="absolute right-2 -top-6 text-[18px] font-bold text-[#34477A] bg-white/90 px-2 rounded">
                {t("Page {n}", { n: i + 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
