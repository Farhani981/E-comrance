import { useEffect, useState } from "react";

/**
 * useReducedMotion - returns true when the user has requested reduced motion.
 * Listens to changes in the OS/browser preference.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReduced(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);
  return reduced;
}

/**
 * useCartBounce - triggers a short-lived token that the cart badge can
 * animate on. Returns a counter that increments on each add/remove.
 */
export function useCartBounce() {
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  return { tick, bump };
}

/**
 * useCountUp - animates a number from 0 to `target` when `start` becomes true.
 * Lightweight, dependency-free, prefers-reduced-motion aware.
 */
export function useCountUp({ target, start, duration = 700, reduced }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start || reduced) {
      setValue(target);
      return;
    }
    let raf;
    const t0 = performance.now();
    const from = 0;
    const to = Math.max(0, Number(target) || 0);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration, reduced]);
  return value;
}