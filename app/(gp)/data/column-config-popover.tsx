"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Columns3, Eye, EyeOff, GripVertical, Loader2, Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { DATA_METRICS, type DataMetricKey } from "@/lib/data-metrics";
import {
  defaultDataColumnsConfig,
  type DataColumnsConfig,
} from "@/lib/data-columns-config";
import { saveDataColumnsConfig } from "./actions";
import { Button } from "@/components/ui/button";

const LABEL: Record<DataMetricKey, string> = Object.fromEntries(
  DATA_METRICS.map((m) => [m.key, m.label])
) as Record<DataMetricKey, string>;

interface Props {
  config: DataColumnsConfig;
  onChange: (next: DataColumnsConfig) => void;
}

export function ColumnConfigPopover({ config, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DataColumnsConfig>(config);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // Sync if parent changes (e.g. reset from another path)
  useEffect(() => { setDraft(config); }, [config]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const isHidden = (k: DataMetricKey) => draft.hidden.includes(k);
  const toggleHidden = (k: DataMetricKey) => {
    setDraft((d) => ({
      ...d,
      hidden: isHidden(k) ? d.hidden.filter((x) => x !== k) : [...d.hidden, k],
    }));
  };
  const move = (k: DataMetricKey, delta: -1 | 1) => {
    setDraft((d) => {
      const idx = d.order.indexOf(k);
      if (idx < 0) return d;
      const target = idx + delta;
      if (target < 0 || target >= d.order.length) return d;
      const next = [...d.order];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...d, order: next };
    });
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await saveDataColumnsConfig(draft);
      if (!res.ok) { setError(res.error); return; }
      onChange(draft);
      setOpen(false);
    });
  };

  const reset = () => setDraft(defaultDataColumnsConfig());

  const visibleCount = draft.order.filter((k) => !isHidden(k)).length;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen((o) => !o)}
      >
        <Columns3 className="h-3.5 w-3.5" /> Columns ({visibleCount})
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-lg border border-line shadow-cardHover z-30 animate-fade-in">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-ink">Columns</div>
              <div className="text-[11px] text-muted">Drag arrows to reorder. Eye to hide.</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ul className="py-1 max-h-72 overflow-y-auto">
            {draft.order.map((k, i) => {
              const hidden = isHidden(k);
              return (
                <li
                  key={k}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-paper2"
                >
                  <span className="text-muted">
                    <GripVertical className="h-3 w-3" />
                  </span>
                  <span className={cn("flex-1 text-[12px]", hidden ? "text-muted line-through" : "text-ink")}>
                    {LABEL[k]}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(k, -1)}
                      disabled={i === 0}
                      className="text-muted hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed px-1"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(k, +1)}
                      disabled={i === draft.order.length - 1}
                      className="text-muted hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed px-1"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHidden(k)}
                      className="ml-1 text-muted hover:text-navy"
                      aria-label={hidden ? "Show column" : "Hide column"}
                    >
                      {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {error && (
            <div className="px-4 py-2 text-[11px] text-coral bg-coral/5 border-t border-coral/20">{error}</div>
          )}

          <div className="px-3 py-2 border-t border-line flex items-center justify-between">
            <button
              type="button"
              onClick={reset}
              className="text-[11px] text-muted hover:text-navy inline-flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            <Button variant="gold" size="sm" className="gap-1.5" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
