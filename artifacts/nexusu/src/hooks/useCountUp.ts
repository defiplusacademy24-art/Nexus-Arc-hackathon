import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number toward `target` over `duration` ms.
 * - Starts from the previous displayed value (not always 0) to avoid
 *   re-counting through stale figures on refresh.
 * - When `enabled` is false, freezes at 0 and does not animate (loading).
 * - Respects `prefers-reduced-motion`.
 */
export function useCountUp(
  target: number,
  duration = 900,
  enabled = true,
): number {
  const [count, setCount] = useState(() => (enabled ? target : 0));
  const fromRef = useRef(enabled ? target : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      fromRef.current = 0;
      setCount(0);
      return;
    }

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced || duration <= 0) {
      fromRef.current = target;
      setCount(target);
      return;
    }

    const from = fromRef.current;
    // Already at target — no animation (prevents flicker when parent re-renders)
    if (from === target) {
      setCount(target);
      return;
    }

    let start: number | null = null;
    const animate = (timestamp: number) => {
      if (start === null) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (target - from) * eased;
      // Keep cents for currency-like values under 1e6; integers above
      const rounded =
        Math.abs(target) < 1_000_000
          ? Math.round(next * 100) / 100
          : Math.round(next);
      setCount(rounded);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = target;
        setCount(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      // Keep mid-animation value as next "from" so we don't jump back to 0
      fromRef.current = target;
    };
  }, [target, duration, enabled]);

  return enabled ? count : 0;
}
