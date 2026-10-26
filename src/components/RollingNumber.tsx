import React, { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

// Counts from its previous value to the new one, so a change reads as a
// change instead of a swap. Starts from the live value if interrupted.
const RollingNumber: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = "" }) => {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { type: "spring", bounce: 0, visualDuration: 0.5 });
    return () => controls.stop();
  }, [value, reduce, mv]);
  return <motion.span>{text}</motion.span>;
};

export default RollingNumber;
