"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye, EyeOff, GripVertical, Pencil, Check, RotateCcw, Loader2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DASHBOARD_CONFIG,
  type DashboardConfig,
  type DashboardWidgetAccent,
  type DashboardWidgetConfig,
  type DashboardWidgetId,
  type DashboardWidgetSize,
} from "@/lib/dashboard-config";
import { saveDashboardConfig, resetDashboardConfig } from "@/app/(gp)/dashboard/actions";

// Map size → tailwind col-span classes (12-col grid).
const SIZE_COLS: Record<DashboardWidgetSize, string> = {
  S: "col-span-12 md:col-span-3",
  M: "col-span-12 md:col-span-4",
  L: "col-span-12 md:col-span-8",
  XL: "col-span-12",
};

const SIZE_LABEL: Record<DashboardWidgetSize, string> = {
  S: "Small",
  M: "Medium",
  L: "Large",
  XL: "Full width",
};

// Accent → wrapper className. Default is "no wrapper" (let widget render its own card).
// For the colored variants we render a soft colored backdrop card around the slot.
const ACCENT_WRAP: Record<DashboardWidgetAccent, string> = {
  default: "",
  primary: "rounded-xl ring-1 ring-teal/30 bg-teal/5 p-1",
  accent: "rounded-xl ring-1 ring-gold/40 bg-gold/5 p-1",
  navy: "rounded-xl ring-1 ring-navy/30 bg-navy/5 p-1",
  muted: "rounded-xl ring-1 ring-line bg-paper2/50 p-1",
};

const WIDGET_LABEL: Record<DashboardWidgetId, string> = {
  ai_banner: "AI insight banner",
  kpis: "KPI cards",
  arr_by_company: "ARR by company",
  watch_list: "Watch list",
  arr_trend: "ARR trend",
  activity: "Activity feed",
  newsletter: "Portfolio newsletter",
};

export interface DashboardEditorProps {
  initialConfig: DashboardConfig;
  /** Pre-rendered server widgets, keyed by id. Editor only positions them. */
  slots: Record<DashboardWidgetId, ReactNode>;
}

export function DashboardEditor({ initialConfig, slots }: DashboardEditorProps) {
  const [config, setConfig] = useState<DashboardConfig>(initialConfig);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Snapshot taken when entering edit mode so Cancel can restore.
  const [snapshot, setSnapshot] = useState<DashboardConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const widgets = config.widgets;

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = widgets.findIndex((w) => w.id === active.id);
    const newIdx = widgets.findIndex((w) => w.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setConfig({ ...config, widgets: arrayMove(widgets, oldIdx, newIdx) });
  }

  function patch(id: DashboardWidgetId, p: Partial<DashboardWidgetConfig>) {
    setConfig({
      ...config,
      widgets: widgets.map((w) => (w.id === id ? { ...w, ...p } : w)),
    });
  }

  function startEdit() {
    setSnapshot(config);
    setError(null);
    setSavedAt(null);
    setEditing(true);
  }

  function cancelEdit() {
    if (snapshot) setConfig(snapshot);
    setEditing(false);
    setError(null);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await saveDashboardConfig(config);
      if (!res.ok) { setError(res.error); return; }
      setEditing(false);
      setSnapshot(null);
      setSavedAt(Date.now());
    });
  }

  function reset() {
    if (!confirm("Reset the dashboard to the default layout?")) return;
    setError(null);
    startTransition(async () => {
      const res = await resetDashboardConfig();
      if (!res.ok) { setError(res.error); return; }
      setConfig(DEFAULT_DASHBOARD_CONFIG);
      setEditing(false);
      setSnapshot(null);
      setSavedAt(Date.now());
    });
  }

  const densityGap = config.density === "compact" ? "gap-3" : "gap-4";
  const densitySection = config.density === "compact" ? "py-4 space-y-4" : "py-6 space-y-6";

  return (
    <div className={cn("px-8 animate-fade-in", densitySection)}>
      {/* Edit-mode toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          {editing ? (
            <span className="inline-flex items-center gap-1.5 text-navy">
              <Pencil className="h-3 w-3" /> Editing dashboard — drag, resize, recolor.
            </span>
          ) : savedAt ? (
            <span className="text-teal">Layout saved.</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <DensityControls config={config} onChange={setConfig} />
              <Button variant="outline" size="sm" className="gap-1.5" onClick={cancelEdit} disabled={pending}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={reset} disabled={pending}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
              <Button variant="gold" size="sm" className="gap-1.5" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Save layout
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit dashboard
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-xs text-coral">
          {error}
        </div>
      )}

      {/* Hidden widgets re-add bar */}
      {editing && widgets.some((w) => w.hidden) && (
        <div className="rounded-lg border border-line bg-paper2/40 px-3 py-2 text-xs">
          <span className="text-muted mr-2">Hidden:</span>
          {widgets
            .filter((w) => w.hidden)
            .map((w) => (
              <button
                key={w.id}
                onClick={() => patch(w.id, { hidden: false })}
                className="mr-2 inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-0.5 text-[11px] hover:border-teal hover:text-teal"
              >
                <Eye className="h-3 w-3" /> {WIDGET_LABEL[w.id]}
              </button>
            ))}
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className={cn("grid grid-cols-12", densityGap)}>
            {widgets.map((w) => {
              if (w.hidden && !editing) return null;
              const node = slots[w.id];
              if (!node) return null;
              const size = w.size ?? "M";
              const accent: DashboardWidgetAccent = w.accent ?? "default";
              return (
                <WidgetSlot
                  key={w.id}
                  widget={w}
                  size={size}
                  accent={accent}
                  editing={editing}
                  onPatch={(p) => patch(w.id, p)}
                >
                  {node}
                </WidgetSlot>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

interface WidgetSlotProps {
  widget: DashboardWidgetConfig;
  size: DashboardWidgetSize;
  accent: DashboardWidgetAccent;
  editing: boolean;
  onPatch: (p: Partial<DashboardWidgetConfig>) => void;
  children: ReactNode;
}

function WidgetSlot({ widget, size, accent, editing, onPatch, children }: WidgetSlotProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : widget.hidden ? 0.45 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(SIZE_COLS[size], "relative", editing && "outline-dashed outline-1 outline-line rounded-xl")}
    >
      {editing && (
        <div className="absolute -top-3 left-2 right-2 z-10 flex items-center justify-between gap-2 rounded-md border border-line bg-white shadow-card px-2 py-1 text-[10px]">
          <button
            {...attributes}
            {...listeners}
            className="inline-flex items-center gap-1 text-muted hover:text-navy cursor-grab active:cursor-grabbing"
            aria-label="Drag widget"
          >
            <GripVertical className="h-3 w-3" />
            <span className="font-medium">{WIDGET_LABEL[widget.id]}</span>
          </button>
          <div className="flex items-center gap-2">
            <SizePicker value={size} onChange={(s) => onPatch({ size: s })} />
            <AccentPicker value={accent} onChange={(a) => onPatch({ accent: a })} />
            <button
              onClick={() => onPatch({ hidden: !widget.hidden })}
              className="inline-flex items-center gap-1 rounded border border-line bg-paper2 px-1.5 py-0.5 hover:border-coral hover:text-coral"
              aria-label={widget.hidden ? "Show widget" : "Hide widget"}
            >
              {widget.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </button>
          </div>
        </div>
      )}
      <div className={cn(ACCENT_WRAP[accent], editing && "mt-3")}>{children}</div>
    </div>
  );
}

function SizePicker({ value, onChange }: { value: DashboardWidgetSize; onChange: (s: DashboardWidgetSize) => void }) {
  return (
    <div className="inline-flex rounded border border-line overflow-hidden">
      {(["S", "M", "L", "XL"] as DashboardWidgetSize[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            "px-1.5 py-0.5 text-[10px] font-medium",
            value === s ? "bg-navy text-white" : "bg-white text-muted hover:text-navy",
          )}
          title={SIZE_LABEL[s]}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

const ACCENT_DOT: Record<DashboardWidgetAccent, string> = {
  default: "bg-white border border-line",
  primary: "bg-teal",
  accent: "bg-gold",
  navy: "bg-navy",
  muted: "bg-muted/40",
};

function AccentPicker({ value, onChange }: { value: DashboardWidgetAccent; onChange: (a: DashboardWidgetAccent) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded border border-line bg-white px-1 py-0.5">
      {(["default", "primary", "accent", "navy", "muted"] as DashboardWidgetAccent[]).map((a) => (
        <button
          key={a}
          onClick={() => onChange(a)}
          className={cn(
            "h-3 w-3 rounded-full",
            ACCENT_DOT[a],
            value === a && "ring-2 ring-offset-1 ring-navy",
          )}
          title={a}
          aria-label={`Accent ${a}`}
        />
      ))}
    </div>
  );
}

function DensityControls({ config, onChange }: { config: DashboardConfig; onChange: (c: DashboardConfig) => void }) {
  return (
    <div className="hidden md:inline-flex items-center gap-2 text-[10px] text-muted mr-2">
      <span>Density</span>
      <div className="inline-flex rounded border border-line overflow-hidden">
        {(["comfortable", "compact"] as const).map((d) => (
          <button
            key={d}
            onClick={() => onChange({ ...config, density: d })}
            className={cn(
              "px-2 py-0.5 font-medium",
              config.density === d ? "bg-navy text-white" : "bg-white text-muted hover:text-navy",
            )}
          >
            {d === "comfortable" ? "Cozy" : "Compact"}
          </button>
        ))}
      </div>
    </div>
  );
}
