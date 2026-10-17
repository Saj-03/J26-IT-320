import { DownloadIcon } from "lucide-react";
import Button from "./CareerButton";
import { t } from "../i18n";

// Print rules for the career pages only: just the element marked `acrds-print` is printed,
// so the app sidebar/header (shared layout) is left out without changing shared code.
const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  .acrds-print, .acrds-print * { visibility: visible !important; }
  .acrds-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
  .acrds-no-print { display: none !important; }
  .acrds-print * { box-shadow: none !important; }
  .acrds-print li, .acrds-print section { break-inside: avoid; }
  @page { margin: 14mm; }
}`;

function ensurePrintStyles() {
  if (document.getElementById("acrds-print-css")) return;
  const style = document.createElement("style");
  style.id = "acrds-print-css";
  style.textContent = PRINT_CSS;
  document.head.appendChild(style);
}

// Opens the browser print dialog; students choose "Save as PDF" to download the page.
export default function PrintButton({ label, ...props }) {
  const onClick = () => {
    ensurePrintStyles();
    window.print();
  };
  return (
    <Button variant="outline" onClick={onClick} {...props}>
      <DownloadIcon size={16} /> {label || t("Download PDF")}
    </Button>
  );
}
