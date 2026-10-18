// CV -> PDF without an extra library: the CV element from the live preview is copied into a hidden
// A4 print page and the browser's print dialog opens ("Save as PDF"). The browser's own PDF engine
// keeps the text selectable and the links clickable, and breaks pages automatically
// (entries are never split; headings stay with their first entry - see CV_CSS).
import { CV_CSS } from "../components/cv/CVDocument";

// In print, the sheet padding becomes the page margin so that EVERY page gets the same margins.
const PRINT_CSS = `
@page { size: A4; margin: 14mm 15mm; }
html, body { margin: 0; padding: 0; background: #fff; }
.cvdoc { width: auto !important; min-height: 0 !important; padding: 0 !important; }
`;

/** Full HTML page for printing (also used by the automated PDF test). */
export function cvPrintHtml(cvElement, title) {
  const safeTitle = String(title || "CV").replace(/[<>&"]/g, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>${CV_CSS}${PRINT_CSS}</style></head><body>${cvElement.outerHTML}</body></html>`;
}

/** Opens the print dialog for the CV element. The file name suggested by the browser comes from `title`. */
export function printCV(cvElement, title) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.dataset.acrdsCvPrint = "true";
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(cvPrintHtml(cvElement, title));
  doc.close();
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  frame.contentWindow.addEventListener("afterprint", cleanup);
  // Wait for fonts/layout in the frame, then print.
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.isConnected && cleanup(), 60000); // fallback if afterprint never fires
  }, 250);
}
