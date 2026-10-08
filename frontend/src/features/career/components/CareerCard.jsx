import { Card } from "../../../shared/components/ui/Card";
import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";

// Shared Card on the ACRDS cream background.
export default function CareerCard({ className, ...props }) {
  return <Card className={cn(ui.card, className)} {...props} />;
}
