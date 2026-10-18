import { ProgressRing } from "../../../shared/components/ui/ProgressRing";
import useCountUp from "../hooks/useCountUp";

// ProgressRing whose fill and number count up from 0 when it appears.
// `children(value)` renders the centre with the animated value.
export default function AnimatedRing({ value, children, ...props }) {
  const v = useCountUp(value);
  return <ProgressRing value={v} {...props}>{children(Math.round(v))}</ProgressRing>;
}
