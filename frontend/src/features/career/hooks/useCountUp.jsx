import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "../utils/celebrate";

/** Animates a number from its previous value (0 on first show) to `target`. Returns the current value. */
export default function useCountUp(target, duration = 900) {
  const goal = Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(reducedMotion() ? goal : 0);
  const from = useRef(reducedMotion() ? goal : 0);
  useEffect(() => {
    if (reducedMotion()) {
      setValue(goal);
      from.current = goal;
      return undefined;
    }
    const start = performance.now();
    const begin = from.current;
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - p) ** 3; // ease-out
      const v = begin + (goal - begin) * eased;
      setValue(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [goal, duration]);
  return value;
}

/** <CountUp value={72} suffix="%" /> - a number that counts up when it appears. */
export function CountUp({ value, suffix = "", decimals = 0 }) {
  const v = useCountUp(value);
  return <>{decimals ? v.toFixed(decimals) : Math.round(v)}{suffix}</>;
}
