import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";

// Page wrapper: soft palette gradient behind every ACRDS page.
export default function CareerPage({ className, children }) {
  return (
    <div className={ui.page}>
      <div className={cn("space-y-6", className)}>{children}</div>
    </div>
  );
}
