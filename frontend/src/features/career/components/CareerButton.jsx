import { Button } from "../../../shared/components/ui/Button";
import { cn } from "../../../shared/lib/cn";
import { ui } from "../theme";

// Shared Button recoloured with the ACRDS palette (same props as Button).
// Adds a press-down feel and a 44px touch target on phones (comfortable for thumbs).
export default function CareerButton({ variant = "primary", className, ...props }) {
  return (
    <Button variant={variant}
      className={cn(ui.btn[variant], "min-h-11 sm:min-h-0 active:scale-[0.96] motion-reduce:active:scale-100", className)} {...props} />
  );
}
