import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";

// Shared Button recoloured with the ACRDS palette (same props as Button).
export default function CareerButton({ variant = "primary", className, ...props }) {
  return <Button variant={variant} className={cn(ui.btn[variant], className)} {...props} />;
}
