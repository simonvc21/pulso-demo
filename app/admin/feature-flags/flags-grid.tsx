"use client";

import { useState, useTransition, useMemo } from "react";
import { Loader2, Check, X, RotateCcw, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { setFeatureFlag, clearFeatureFlag } from "../actions";

interface Org { id: string; name: string; slug: string; }
interface FlagDef { name: string; default: boolean; label: string; description: string; }
interface Override { organization_id: string; flag_name: string; enabled: boolean; notes: string | null; updated_at: string; }

interface Props {
  organizations: Org[];
  flags: FlagDef[];
  overrides: Override[];
}

export function FlagsGrid({ organizations, flags, overrides: initialOverrides }: Props) {
  const [overrides, setOverrides] = useState<Override[]>(initialOverrides);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const overrideMap = useMemo(() => {
    const m = new Map<string, Override>();
    for (const o of overrides) m.set(`${o.organization_id}|${o.flag_name}`, o);
    return m;
  }, [overrides]);

  const isEffectivelyEnabled = (orgId: string, flag: FlagDef): boolean => {
    const o = overrideMap.get(`${orgId}|${flag.name}`);
    return o ? o.enabled : flag.default;
  };

  const isOverridden = (orgId: string, flag: FlagDef): boolean => {
    return overrideMap.has(`${orgId}|${flag.name}`);
  };

  const toggle = (org: Org, flag: FlagDef) => {
    setError(null);
    const key = `${org.id}|${flag.name}`;
    setPendingKey(key);
    const next = !isEffectivelyEnabled(org.id, flag);
    startTransition(async () => {
      const res = await setFeatureFlag({
        organizationId: org.id,
        flagName: flag.name,
        enabled: next,
      });
      setPendingKey(null);
      if (!res.ok) { setError(res.error); return; }
      // Optimistic update
      setOverrides((prev) => {
        const filtered = prev.filter((o) => !(o.organization_id === org.id && o.flag_name === flag.name));
        return [
          ...filtered,
          {
            organization_id: org.id,
            flag_name: flag.name,
            enabled: next,
            notes: null,
            updated_at: new Date().toISOString(),
          },
        ];
      });
    });
  };

  const reset = (org: Org, flag: FlagDef) => {
    setError(null);
    const key = `${org.id}|${flag.name}`;
    setPendingKey(key);
    startTransition(async () => {
      const res = await clearFeatureFlag({ organizationId: org.id, flagName: flag.name });
      setPendingKey(null);
      if (!res.ok) { setError(res.error); return; }
      setOverrides((prev) => prev.filter((o) => !(o.organization_id === org.id && o.flag_name === flag.name)));
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral inline-flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-paper2 text-[10px] tracking-[0.14em] uppercase text-muted">
                <th className="text-left font-semibold px-4 py-2.5 sticky left-0 bg-paper2 min-w-[260px]">Flag</th>
                {organizations.map((o) => (
                  <th key={o.id} className="text-center font-semibold px-3 py-2.5 min-w-[140px] border-l border-line/60">
                    {o.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {flags.map((flag) => (
                <tr key={flag.name} className="hover:bg-paper">
                  <td className="px-4 py-3 sticky left-0 bg-white z-10">
                    <div className="flex items-start gap-1.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">{flag.label}</div>
                        <div className="text-[11px] text-muted mt-0.5">{flag.description}</div>
                        <div className="text-[10px] text-muted mt-1">
                          <code className="bg-paper2 px-1 rounded">{flag.name}</code>
                          {" · default "}
                          <span className={flag.default ? "text-teal-600 font-semibold" : "text-coral"}>
                            {flag.default ? "ON" : "OFF"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  {organizations.map((org) => {
                    const key = `${org.id}|${flag.name}`;
                    const enabled = isEffectivelyEnabled(org.id, flag);
                    const overridden = isOverridden(org.id, flag);
                    const isPending = pendingKey === key;
                    return (
                      <td key={key} className="px-3 py-3 text-center border-l border-line/60">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggle(org, flag)}
                            disabled={isPending}
                            className={cn(
                              "inline-flex items-center justify-center h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors gap-1.5",
                              enabled
                                ? "bg-teal text-white hover:bg-teal-600"
                                : "bg-paper2 text-muted hover:bg-line"
                            )}
                            title={enabled ? "Click to disable" : "Click to enable"}
                          >
                            {isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : enabled ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                            {enabled ? "ON" : "OFF"}
                          </button>
                          {overridden && (
                            <button
                              type="button"
                              onClick={() => reset(org, flag)}
                              disabled={isPending}
                              className="text-muted hover:text-coral p-0.5"
                              title="Reset to default (delete override)"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {overridden && (
                          <div className="text-[9px] text-muted mt-1 flex items-center justify-center gap-1">
                            <Info className="h-2.5 w-2.5" /> override
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {organizations.length === 0 && (
                <tr>
                  <td className="px-4 py-12 text-center text-muted text-[12px]">No organizations yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted">
        Cells with the <RotateCcw className="h-3 w-3 inline -mt-0.5" /> icon are overrides — clicking it removes the row and falls back to the default.
      </p>
    </div>
  );
}
