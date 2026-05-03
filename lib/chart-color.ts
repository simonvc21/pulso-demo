"use client";

import { useEffect, useRef, useState } from "react";

/** Returns the resolved hex value of `--c-chart-hex` from the closest
 *  ancestor that defines it (the GP layout root). Falls back to the
 *  supplied default if not present (e.g. on LP/founder pages). */
export function useChartColor(fallback = "#14B8A6"): { color: string; ref: React.RefObject<HTMLDivElement> } {
  const ref = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState(fallback);

  useEffect(() => {
    const read = () => {
      const el = ref.current;
      if (!el) return;
      try {
        const v = getComputedStyle(el).getPropertyValue("--c-chart-hex").trim();
        if (v) setColor(v);
      } catch {}
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    obs.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    return () => obs.disconnect();
  }, []);

  return { color, ref };
}
