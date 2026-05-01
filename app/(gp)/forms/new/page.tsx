"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, DollarSign, Hash, Percent, Type, AlignLeft, ChevronDown, Calendar, GripVertical, Trash2, Send, Save, Sparkles, Mail, Repeat, Eye, Loader2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FormFieldType } from "@/lib/types";
import { createForm } from "../actions";

interface DraftField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  group?: string;
}

const palette: { type: FormFieldType; label: string; icon: any; example: string }[] = [
  { type: "currency", label: "Currency",  icon: DollarSign, example: "Quarterly revenue" },
  { type: "number",   label: "Number",    icon: Hash,       example: "Headcount" },
  { type: "percent",  label: "Percent",   icon: Percent,    example: "Gross margin" },
  { type: "text",     label: "Short text",icon: Type,       example: "Top hire this Q" },
  { type: "longtext", label: "Long text", icon: AlignLeft,  example: "Biggest risk next Q" },
  { type: "select",   label: "Choice",    icon: ChevronDown,example: "Hiring status" },
  { type: "date",     label: "Date",      icon: Calendar,   example: "Last close date" },
];

const initialFields: DraftField[] = [
  { id: "1", type: "currency", label: "Quarterly revenue (USD)",     required: true,  group: "P&L" },
  { id: "2", type: "currency", label: "Annual recurring revenue",     required: true,  group: "P&L" },
  { id: "3", type: "currency", label: "Monthly burn rate",            required: true,  group: "P&L" },
  { id: "4", type: "currency", label: "Cash on hand",                 required: true,  group: "Balance Sheet" },
  { id: "5", type: "number",   label: "Headcount (FTE)",              required: true,  group: "Team" },
  { id: "6", type: "longtext", label: "Biggest risk for next quarter",required: false, group: "Narrative" },
];

export default function FormBuilderPage() {
  const [name, setName] = useState("Q2 2026 Financials");
  const [cadence, setCadence] = useState<"monthly" | "quarterly" | "annual" | "ad-hoc">("quarterly");
  const [fields, setFields] = useState<DraftField[]>(initialFields);
  const [selectedId, setSelectedId] = useState<string | null>("1");
  const [recipients] = useState(8);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const res = await createForm({
      name,
      cadence,
      fields: fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        required: f.required,
        group: f.group,
      })),
    });
    if (!res.ok) {
      setSaving(false);
      setSaveError(res.error);
    }
    // On success the action redirects, so the component unmounts.
  };

  const addField = (type: FormFieldType) => {
    const id = String(Date.now());
    const f: DraftField = {
      id,
      type,
      label: defaultLabelFor(type),
      required: false,
      group: "P&L",
    };
    setFields((p) => [...p, f]);
    setSelectedId(id);
  };

  const updateField = (id: string, patch: Partial<DraftField>) => {
    setFields((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    setFields((p) => p.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const move = (id: string, dir: -1 | 1) => {
    setFields((p) => {
      const idx = p.findIndex((f) => f.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const selected = fields.find((f) => f.id === selectedId) || null;

  return (
    <>
      <Topbar
        title="New form"
        breadcrumb={
          <Link href="/forms" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Forms
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button
              variant="gold"
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save form"}
            </Button>
          </div>
        }
      />
      {saveError && (
        <div className="mx-8 mt-4 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-12 gap-0 border-b border-line">
        {/* Left: palette */}
        <div className="col-span-12 lg:col-span-2 border-r border-line bg-white p-4 min-h-[calc(100vh-130px)]">
          <div className="text-[10px] font-semibold text-muted tracking-[0.16em] uppercase mb-3">Add field</div>
          <div className="space-y-1.5">
            {palette.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.type}
                  onClick={() => addField(p.type)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-line hover:border-teal hover:bg-teal-50 transition-colors flex items-center gap-2.5 group"
                >
                  <div className="h-7 w-7 rounded-md bg-paper2 group-hover:bg-white flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-navy" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-ink">{p.label}</div>
                    <div className="text-[10px] text-muted truncate">{p.example}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-3 rounded-lg bg-navy text-white text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 text-gold font-semibold">
              <Sparkles className="h-3 w-3" /> AI tip
            </div>
            <div className="mt-1 text-white/80">Pulso will auto-validate currency and percent fields against historical data and flag outliers before they hit your dashboard.</div>
          </div>
        </div>

        {/* Center: canvas */}
        <div className="col-span-12 lg:col-span-7 bg-paper p-6">
          <div className="max-w-2xl mx-auto">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-2xl font-serif font-bold text-ink bg-transparent focus:outline-none border-b-2 border-transparent focus:border-teal pb-1"
              placeholder="Form name"
            />
            <p className="text-[12px] text-muted mt-2">Fields below appear in the order founders see them. Click a field to edit it.</p>

            <div className="mt-5 space-y-2">
              {fields.length === 0 && (
                <div className="bg-white border-2 border-dashed border-line rounded-xl p-10 text-center text-sm text-muted">
                  Add your first field from the left panel.
                </div>
              )}
              {fields.map((f, i) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  selected={selectedId === f.id}
                  onSelect={() => setSelectedId(f.id)}
                  onRemove={() => removeField(f.id)}
                  onMoveUp={() => move(f.id, -1)}
                  onMoveDown={() => move(f.id, 1)}
                  isFirst={i === 0}
                  isLast={i === fields.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: settings */}
        <div className="col-span-12 lg:col-span-3 border-l border-line bg-white p-5 min-h-[calc(100vh-130px)]">
          <div className="text-[10px] font-semibold text-muted tracking-[0.16em] uppercase">Settings</div>

          {/* Cadence */}
          <div className="mt-4">
            <label className="text-[11px] font-medium text-ink mb-1.5 block flex items-center gap-1.5">
              <Repeat className="h-3 w-3 text-muted" /> Cadence
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["monthly", "quarterly", "annual", "ad-hoc"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCadence(c)}
                  className={cn(
                    "h-9 px-2 rounded-lg text-xs font-medium border capitalize transition-colors",
                    cadence === c
                      ? "bg-navy text-gold border-navy"
                      : "bg-white text-ink border-line hover:bg-paper2"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-1.5">First send: <span className="text-ink font-medium">May 28, 2026</span></p>
          </div>

          {/* Recipients */}
          <div className="mt-5">
            <label className="text-[11px] font-medium text-ink mb-1.5 block flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted" /> Recipients
            </label>
            <div className="flex items-center justify-between p-3 rounded-lg bg-paper2 border border-line">
              <div>
                <div className="text-sm font-semibold text-ink">{recipients} founders</div>
                <div className="text-[10px] text-muted">All active companies</div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs">Edit</Button>
            </div>
          </div>

          {/* Reminders */}
          <div className="mt-5">
            <label className="text-[11px] font-medium text-ink mb-1.5 block flex items-center gap-1.5">
              <Send className="h-3 w-3 text-muted" /> Auto-reminders
            </label>
            <div className="space-y-1.5 text-[12px]">
              {[
                "Day 3 — gentle nudge to founder",
                "Day 7 — second reminder + cc'd to CEO",
                "Day 14 — escalate to GP for follow-up",
              ].map((line) => (
                <div key={line} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked className="h-3.5 w-3.5 rounded text-teal" />
                  <span className="text-ink">{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected field */}
          {selected && (
            <div className="mt-6 pt-5 border-t border-line">
              <div className="text-[10px] font-semibold text-muted tracking-[0.16em] uppercase">Selected field</div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-ink">Label</label>
                  <input
                    value={selected.label}
                    onChange={(e) => updateField(selected.id, { label: e.target.value })}
                    className="w-full mt-1 h-9 px-3 rounded-lg border border-line text-xs focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink">Group</label>
                  <input
                    value={selected.group || ""}
                    onChange={(e) => updateField(selected.id, { group: e.target.value })}
                    placeholder="e.g. P&L, Team, Narrative"
                    className="w-full mt-1 h-9 px-3 rounded-lg border border-line text-xs focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
                <label className="flex items-center gap-2 text-[12px] text-ink">
                  <input
                    type="checkbox"
                    checked={selected.required}
                    onChange={(e) => updateField(selected.id, { required: e.target.checked })}
                    className="h-3.5 w-3.5 rounded text-teal"
                  />
                  Required
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function defaultLabelFor(t: FormFieldType): string {
  return {
    currency: "New currency field",
    number: "New number field",
    percent: "New percent field",
    text: "New short-text field",
    longtext: "New long-text field",
    select: "New choice field",
    date: "New date field",
  }[t];
}

function FieldRow({
  field, selected, onSelect, onRemove, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  field: DraftField;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const TypeIcon = palette.find((p) => p.type === field.type)?.icon || Type;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "bg-white rounded-xl border p-4 cursor-pointer transition-all",
        selected ? "border-teal shadow-card ring-2 ring-teal/20" : "border-line hover:border-line hover:shadow-card"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          className="text-muted hover:text-ink mt-1.5 cursor-grab"
          aria-label="Drag handle"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="h-9 w-9 rounded-lg bg-paper2 flex items-center justify-center shrink-0">
          <TypeIcon className="h-4 w-4 text-navy" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-medium text-ink">{field.label}</div>
            {field.required && <Badge tone="gold">Required</Badge>}
            {field.group && <Badge>{field.group}</Badge>}
          </div>
          <div className="text-[11px] text-muted mt-0.5 capitalize">{field.type} field</div>
          <div className="mt-2.5">
            {/* Field preview */}
            <FieldPreview field={field} />
          </div>
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={isFirst}
            className="text-muted hover:text-ink text-xs disabled:opacity-30"
          >↑</button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={isLast}
            className="text-muted hover:text-ink text-xs disabled:opacity-30"
          >↓</button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-muted hover:text-coral"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldPreview({ field }: { field: DraftField }) {
  const baseInput = "h-9 w-full max-w-sm px-3 rounded-lg border border-line bg-paper2 text-xs text-muted";
  if (field.type === "longtext") {
    return <textarea disabled placeholder="Founder's response will appear here…" className={cn(baseInput, "h-16 py-2")} />;
  }
  if (field.type === "select") {
    return <select disabled className={baseInput}><option>Select…</option></select>;
  }
  return (
    <div className="flex items-center gap-2 max-w-sm">
      {field.type === "currency" && <span className="text-xs text-muted">USD</span>}
      <input
        disabled
        type={field.type === "date" ? "date" : "text"}
        placeholder={field.type === "date" ? "" : "Awaiting founder input…"}
        className={baseInput}
      />
      {field.type === "percent" && <span className="text-xs text-muted">%</span>}
    </div>
  );
}
