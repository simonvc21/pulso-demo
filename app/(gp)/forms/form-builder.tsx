"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft, DollarSign, Hash, Percent, Type, AlignLeft, ChevronDown, Calendar,
  GripVertical, Trash2, Send, Save, Sparkles, Mail, Repeat, Loader2, X, Check, Newspaper,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FormFieldType } from "@/lib/types";
import type { CompanyOption } from "@/lib/dashboard-data";
import type { DraftField, FormInput } from "./actions";
import { createForm, updateForm } from "./actions";
import { suggestFormFields, rewriteFieldLabel } from "./ai-actions";

const palette: { type: FormFieldType; label: string; icon: any; example: string }[] = [
  { type: "currency", label: "Currency",  icon: DollarSign, example: "Quarterly revenue" },
  { type: "number",   label: "Number",    icon: Hash,       example: "Headcount" },
  { type: "percent",  label: "Percent",   icon: Percent,    example: "Gross margin" },
  { type: "text",     label: "Short text",icon: Type,       example: "Top hire this Q" },
  { type: "longtext", label: "Long text", icon: AlignLeft,  example: "Biggest risk next Q" },
  { type: "news",     label: "News / Update", icon: Newspaper, example: "Recent news, milestones, press" },
  { type: "select",   label: "Choice",    icon: ChevronDown,example: "Hiring status" },
  { type: "date",     label: "Date",      icon: Calendar,   example: "Last close date" },
];

const defaultNewForm: FormInput = {
  name: "",
  cadence: "monthly",
  fields: [],
};

interface BuilderProps {
  mode: "create" | "edit";
  initial?: FormInput;
  slug?: string;
  companies: CompanyOption[];
  initialRecipientIds?: string[];
}

export function FormBuilder({ mode, initial, slug, companies, initialRecipientIds }: BuilderProps) {
  const seed = initial ?? defaultNewForm;
  const [name, setName] = useState(seed.name);
  const [cadence, setCadence] = useState<FormInput["cadence"]>(seed.cadence);
  const [fields, setFields] = useState<DraftField[]>(seed.fields);
  const [selectedId, setSelectedId] = useState<string | null>(seed.fields[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [rewritingFieldId, setRewritingFieldId] = useState<string | null>(null);

  // Wizard intro (only on create, only until user picks a path).
  // - "blank" → render the empty builder
  // - "ai"    → render the builder + auto-open SuggestModal
  // - undefined → show the intro screen
  const [wizardChoice, setWizardChoice] = useState<"blank" | "ai" | undefined>(
    mode === "edit" ? "blank" : undefined
  );
  const [suggestOpen, setSuggestOpen] = useState(false);

  // L.5b — recipients live in the schedule editor. We keep the seed list so a
  // brand-new form can carry over any IDs already injected by the parent on
  // first save, but expose no UI for it here.
  const recipientIds = initialRecipientIds ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setFields((items) => {
      const oldIdx = items.findIndex((f) => f.id === active.id);
      const newIdx = items.findIndex((f) => f.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return items;
      return arrayMove(items, oldIdx, newIdx);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    // L.5b — recipients are managed in the schedule editor now. We only send
    // recipientCompanyIds on first create so brand-new forms don't accidentally
    // start with zero recipients.
    const payload: FormInput = {
      name,
      cadence,
      fields,
      ...(mode === "create" ? { recipientCompanyIds: recipientIds } : {}),
    };
    const res = mode === "edit" && slug
      ? await updateForm(slug, payload)
      : await createForm(payload);
    if (!res.ok) {
      setSaving(false);
      setSaveError(res.error);
    }
    // Success → action redirects; component unmounts.
  };

  const addField = (type: FormFieldType) => {
    const id = `f${Date.now()}`;
    const f: DraftField = {
      id,
      type,
      label: defaultLabelFor(type),
      required: false,
      group: fields[fields.length - 1]?.group ?? "P&L",
      ...(type === "select" ? { options: ["Option 1", "Option 2"] } : {}),
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

  const selected = fields.find((f) => f.id === selectedId) || null;
  const isEdit = mode === "edit";
  const backHref = isEdit && slug ? `/forms/${slug}` : "/forms";

  // Intro screen for new forms — pick "AI suggests fields" or "start blank".
  if (wizardChoice === undefined) {
    return (
      <NewFormWizard
        onPickAi={() => { setWizardChoice("ai"); setSuggestOpen(true); }}
        onPickBlank={() => setWizardChoice("blank")}
      />
    );
  }

  return (
    <>
      <Topbar
        title={isEdit ? `Edit · ${name || "Form"}` : "New form"}
        breadcrumb={
          <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> {isEdit ? "Form" : "Forms"}
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            {isEdit && slug && (
              <Link href={`/forms/${slug}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> Cancel
                </Button>
              </Link>
            )}
            <Button
              variant="gold"
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : isEdit ? "Save changes" : "Save form"}
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
          <button
            onClick={() => setSuggestOpen(true)}
            className="w-full text-left px-3 py-2.5 rounded-lg bg-gradient-to-br from-navy to-navy-700 text-white hover:shadow-cardHover transition-shadow flex items-center gap-2.5 mb-4"
          >
            <div className="h-7 w-7 rounded-md bg-gold flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-navy" fill="currentColor" />
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold">Suggest with AI</div>
              <div className="text-[10px] text-white/70 truncate">Describe the form, get fields</div>
            </div>
          </button>
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
            <div className="mt-1 text-white/80">Drag fields to reorder. Pulso auto-validates currency and percent fields against historical data.</div>
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
            <p className="text-[12px] text-muted mt-2">Drag fields by the handle to reorder. Click a field to edit it.</p>

            <div className="mt-5">
              {fields.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-line rounded-xl p-10 text-center text-sm text-muted">
                  Add your first field from the left panel.
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {fields.map((f) => (
                        <SortableFieldRow
                          key={f.id}
                          field={f}
                          selected={selectedId === f.id}
                          onSelect={() => setSelectedId(f.id)}
                          onRemove={() => removeField(f.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>

        {/* Right: settings */}
        <div className="col-span-12 lg:col-span-3 border-l border-line bg-white p-5 min-h-[calc(100vh-130px)]">
          <div className="text-[10px] font-semibold text-muted tracking-[0.16em] uppercase">Settings</div>

          {/* L.5b — Scheduling, recipients, and reminders moved to the
              dedicated editor on the form detail page. The builder stays
              focused on field design. */}
          <div className="mt-4 rounded-lg border border-line bg-paper2/40 p-3">
            <div className="text-[11px] font-semibold text-ink inline-flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-muted" /> Schedule, recipients & reminders
            </div>
            <p className="text-[11px] text-muted mt-1 leading-snug">
              {mode === "create" ? (
                <>Save this form first, then configure the day-of-month, recipients, and per-reminder copy on the next screen.</>
              ) : (
                <>Pick the exact day-of-month, configure recipients (one or more emails per company), and customize each reminder's copy below.</>
              )}
            </p>
            {mode === "edit" && slug && (
              <a
                href={`/forms/${slug}/edit#schedule`}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-teal-600 hover:underline"
              >
                Jump to schedule editor ↓
              </a>
            )}
          </div>

          {/* Selected field */}
          {selected && (
            <div className="mt-6 pt-5 border-t border-line">
              <div className="text-[10px] font-semibold text-muted tracking-[0.16em] uppercase">Selected field</div>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-ink">Label</label>
                    <div className="flex items-center gap-1">
                      <AiRewriteButton
                        title="Rewrite to be clearer"
                        intent="clearer"
                        currentLabel={selected.label}
                        pending={rewritingFieldId === selected.id}
                        onStart={() => setRewritingFieldId(selected.id)}
                        onDone={(newLabel) => {
                          updateField(selected.id, { label: newLabel });
                          setRewritingFieldId(null);
                        }}
                        onError={() => setRewritingFieldId(null)}
                      >
                        Clearer
                      </AiRewriteButton>
                      <AiRewriteButton
                        title="Translate to Spanish"
                        intent="spanish"
                        currentLabel={selected.label}
                        pending={rewritingFieldId === selected.id}
                        onStart={() => setRewritingFieldId(selected.id)}
                        onDone={(newLabel) => {
                          updateField(selected.id, { label: newLabel });
                          setRewritingFieldId(null);
                        }}
                        onError={() => setRewritingFieldId(null)}
                      >
                        ES
                      </AiRewriteButton>
                    </div>
                  </div>
                  <input
                    value={selected.label}
                    onChange={(e) => updateField(selected.id, { label: e.target.value })}
                    className="w-full mt-1 h-9 px-3 rounded-lg border border-line text-xs focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-ink">Type</label>
                  <select
                    value={selected.type}
                    onChange={(e) => updateField(selected.id, {
                      type: e.target.value as DraftField["type"],
                      options: e.target.value === "select" ? (selected.options ?? ["Option 1", "Option 2"]) : undefined,
                    })}
                    className="w-full mt-1 h-9 px-3 rounded-lg border border-line text-xs focus:outline-none focus:ring-2 focus:ring-teal/30"
                  >
                    {palette.map((p) => (
                      <option key={p.type} value={p.type}>{p.label}</option>
                    ))}
                  </select>
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
                {(selected.type === "currency" || selected.type === "number" || selected.type === "percent") && (
                  <div>
                    <label className="text-[11px] font-medium text-ink">Save to metric</label>
                    <select
                      value={selected.metricKey ? `std:${selected.metricKey}` : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          updateField(selected.id, { metricKey: null });
                        } else if (v.startsWith("std:")) {
                          updateField(selected.id, {
                            metricKey: v.slice(4) as DraftField["metricKey"],
                          });
                        }
                      }}
                      className="w-full mt-1 h-9 px-3 rounded-lg border border-line text-xs focus:outline-none focus:ring-2 focus:ring-teal/30"
                    >
                      <option value="">— Don't auto-save (narrative only) —</option>
                      <optgroup label="Standard financials">
                        <option value="std:arr">ARR (USD)</option>
                        <option value="std:revenue">Revenue (USD)</option>
                        <option value="std:burn">Burn (USD/month)</option>
                        <option value="std:cash">Cash (USD)</option>
                        <option value="std:headcount">Headcount</option>
                      </optgroup>
                    </select>
                    <p className="mt-1 text-[10px] text-muted leading-snug">
                      When the founder submits, this number lands in the chart for the form's period — no copy/paste.
                    </p>
                  </div>
                )}
                {selected.type === "select" && (
                  <div>
                    <label className="text-[11px] font-medium text-ink">Options (one per line)</label>
                    <textarea
                      value={(selected.options ?? []).join("\n")}
                      onChange={(e) => updateField(selected.id, {
                        options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                      })}
                      rows={4}
                      placeholder={"Option 1\nOption 2"}
                      className="w-full mt-1 px-3 py-2 rounded-lg border border-line text-xs focus:outline-none focus:ring-2 focus:ring-teal/30"
                    />
                  </div>
                )}
                <label className="flex items-center gap-2 text-[12px] text-ink">
                  <input
                    type="checkbox"
                    checked={!!selected.required}
                    onChange={(e) => updateField(selected.id, { required: e.target.checked })}
                    className="h-3.5 w-3.5 rounded text-teal"
                  />
                  Required
                </label>
                <button
                  onClick={() => removeField(selected.id)}
                  className="text-[11px] text-coral hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Delete field
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {suggestOpen && (
        <SuggestModal
          onClose={() => setSuggestOpen(false)}
          onApply={(newFields, suggestedName) => {
            setFields(newFields);
            setSelectedId(newFields[0]?.id ?? null);
            if (suggestedName && !name.trim()) setName(suggestedName);
            setSuggestOpen(false);
          }}
        />
      )}
    </>
  );
}

function SuggestModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (fields: DraftField[], formName?: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DraftField[] | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pending, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await suggestFormFields(prompt);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPreview(res.fields);
  };

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[1000] bg-navy/40 overflow-y-auto"
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-screen w-full flex justify-center px-4 py-12">
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-cardHover w-full max-w-xl p-6 h-fit self-start sm:self-center"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gold text-navy flex items-center justify-center">
                <Sparkles className="h-4 w-4" fill="currentColor" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-bold text-ink">Suggest fields with AI</h2>
                <div className="text-[11px] text-muted">Powered by Gemini · uses fund context</div>
              </div>
            </div>
            <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!preview ? (
            <form onSubmit={submit} className="mt-5">
              <label className="block">
                <span className="block text-[11px] font-semibold text-ink tracking-wide uppercase mb-1.5">
                  Describe this form
                </span>
                <textarea
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="A monthly check-in for early-stage SaaS founders covering revenue, hiring, and product milestones."
                  className="w-full px-3 py-2.5 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                />
              </label>
              {error && (
                <div className="mt-3 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
                  {error}
                </div>
              )}
              <div className="mt-5 flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
                <Button type="submit" variant="gold" size="sm" className="gap-1.5" disabled={pending || !prompt.trim()}>
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {pending ? "Thinking…" : "Suggest fields"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-5">
              <div className="text-[11px] text-muted mb-2">
                Replace the current {preview.length} fields with these? You can edit any of them after.
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-line divide-y divide-line bg-paper">
                {preview.map((f) => (
                  <div key={f.id} className="px-3 py-2.5 flex items-start gap-3">
                    <span className="text-[10px] tracking-[0.14em] uppercase text-muted font-semibold w-16 mt-0.5 shrink-0">{f.type}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink">{f.label}</div>
                      <div className="text-[10px] text-muted mt-0.5">
                        {f.group ?? "—"}
                        {f.required && <span className="ml-2 text-gold-600">required</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="text-[12px] text-muted hover:text-ink underline"
                  disabled={pending}
                >
                  Try a different prompt
                </button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onApply(preview)}
                  >
                    <Check className="h-3.5 w-3.5" /> Use these fields
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function AiRewriteButton({
  intent, title, currentLabel, pending, onStart, onDone, onError, children,
}: {
  intent: "clearer" | "spanish" | "shorter";
  title: string;
  currentLabel: string;
  pending: boolean;
  onStart: () => void;
  onDone: (newLabel: string) => void;
  onError: (msg: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={pending || !currentLabel.trim()}
      onClick={async () => {
        onStart();
        const res = await rewriteFieldLabel(currentLabel, intent);
        if (res.ok) onDone(res.label);
        else onError(res.error);
      }}
      className="text-[10px] uppercase tracking-wider text-gold-600 hover:bg-gold-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
      {children}
    </button>
  );
}

function defaultLabelFor(t: FormFieldType): string {
  return {
    currency: "New currency field",
    number: "New number field",
    percent: "New percent field",
    text: "New short-text field",
    longtext: "New long-text field",
    news: "Recent news, milestones, press",
    select: "New choice field",
    date: "New date field",
  }[t];
}

function SortableFieldRow({
  field, selected, onSelect, onRemove,
}: {
  field: DraftField;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const TypeIcon = palette.find((p) => p.type === field.type)?.icon || Type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "group bg-white rounded-xl border p-4 cursor-pointer transition-all",
        selected ? "border-teal shadow-card ring-2 ring-teal/20" : "border-line hover:shadow-card",
        isDragging && "shadow-cardHover"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="text-muted hover:text-ink mt-1.5 cursor-grab active:cursor-grabbing touch-none"
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
            {field.metricKey && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600 bg-teal-50 border border-teal/30 px-1.5 py-0.5 rounded">
                <Save className="h-2.5 w-2.5" />
                → {field.metricKey.toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted mt-0.5 capitalize">{field.type} field</div>
          <div className="mt-2.5">
            <FieldPreview field={field} />
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-muted hover:text-coral opacity-0 group-hover:opacity-100"
          aria-label="Delete field"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FieldPreview({ field }: { field: DraftField }) {
  const baseInput = "h-9 w-full max-w-sm px-3 rounded-lg border border-line bg-paper2 text-xs text-muted";
  if (field.type === "longtext" || field.type === "news") {
    const placeholder = field.type === "news"
      ? "Founder's news, milestones, press, hires…"
      : "Founder's response will appear here…";
    return <textarea disabled placeholder={placeholder} className={cn(baseInput, "h-16 py-2")} />;
  }
  if (field.type === "select") {
    return (
      <select disabled className={baseInput}>
        <option>Select…</option>
        {(field.options ?? []).map((o) => <option key={o}>{o}</option>)}
      </select>
    );
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

// ---------------------------------------------------------------------------
// Intro wizard for /forms/new — pick AI suggestion or start blank
// ---------------------------------------------------------------------------

function NewFormWizard({
  onPickAi, onPickBlank,
}: { onPickAi: () => void; onPickBlank: () => void }) {
  return (
    <>
      <Topbar
        title="New form"
        breadcrumb={
          <Link href="/forms" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Forms
          </Link>
        }
      />
      <div className="px-8 py-12 max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gold-600">Start a new form</div>
          <h1 className="mt-2 text-3xl font-serif font-bold text-ink">How do you want to begin?</h1>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            You can describe what you need and let Pulso AI propose the fields, or build it from scratch one field at a time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onPickAi}
            className="group text-left bg-white rounded-2xl border-2 border-line hover:border-teal hover:shadow-cardHover transition-all p-6"
          >
            <div className="flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-navy to-navy-700 text-gold flex items-center justify-center">
                <Sparkles className="h-5 w-5" fill="currentColor" />
              </div>
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-teal-600">Recommended</div>
            </div>
            <h3 className="mt-4 text-base font-serif font-bold text-ink">Build with AI</h3>
            <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
              Describe the form in one sentence ("monthly check-in for early-stage SaaS founders") and Pulso AI proposes 6-10 fields with types, groups, and labels.
            </p>
            <div className="mt-4 text-[11px] text-teal-600 font-semibold inline-flex items-center gap-1">
              Start with AI <ChevronRightCustom className="h-3 w-3" />
            </div>
          </button>

          <button
            type="button"
            onClick={onPickBlank}
            className="group text-left bg-white rounded-2xl border border-line hover:shadow-card transition-all p-6"
          >
            <div className="h-11 w-11 rounded-xl bg-paper2 text-navy flex items-center justify-center">
              <FilePlusIcon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-serif font-bold text-ink">Start blank</h3>
            <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
              Open the empty builder and add fields one at a time from the palette. Drag to reorder, configure each on the right panel.
            </p>
            <div className="mt-4 text-[11px] text-navy font-semibold inline-flex items-center gap-1">
              Open the builder <ChevronRightCustom className="h-3 w-3" />
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

function ChevronRightCustom({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function FilePlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}
