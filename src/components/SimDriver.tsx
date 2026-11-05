import { useEffect } from "react";
import { useSim } from "@/sim/store";

/** Single stepper: seeds once on the client and advances the simulation at 10 Hz. */
export function SimDriver() {
  useEffect(() => {
    useSim.getState().seed();
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      useSim.getState().tick((now - last) / 1000);
      last = now;
    }, 100);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
