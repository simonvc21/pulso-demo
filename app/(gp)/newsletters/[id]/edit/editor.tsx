"use client";

// L.6 — Newsletter editor: list of blocks on the left with inline editing,
// "add block" picker, save + publish controls. The full preview lives on
// /newsletters/[id] (separate route) so editor can stay tight + fast.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Type, BarChart3, Building2, AlertTriangle, Trophy, Minus, PieChart, TrendingUp, Layers,
  Plus, Trash2, ArrowUp, ArrowDown, Loader2, Check, Eye, Send, X, FileX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  saveNewsletter, publishNewsletter, unpublishNewsletter, deleteNewsletter,
} from "../../actions";
import { newId, type Block, type Newsletter, type NewsletterCadence } from "@/lib/newsletter-types";

interface CompanyOption { id: string; slug: string; name: string }
interface MetricDef { id: string; label: string; unit: string | null }

interface Props {
  newsletter: Newsletter;
  companies: CompanyOption[];
  metricDefinitions: MetricDef[];
}

const CADENCES: NewsletterCadence[] = ["monthly", "quarterly", "annual", "ad_hoc"];

export function NewsletterEditor({ newsletter, companies, metricDefinitions }: Props) {
  const router = useRouter();
  const [coverTitle, setCoverTitle] = useState(newsletter.coverTitle);
  const [coverSubtitle, setCoverSubtitle] = useState(newsletter.coverSubtitle ?? "");
  const [heroSummary, setHeroSummary] = useState(newsletter.heroMetricSummary ?? "");
  const [periodLabel, setPeriodLabel] = useState(newsletter.periodLabel);
  const [cadence, setCadence] = useState<NewsletterCadence>(newsletter.cadence);
  const [blocks, setBlocks] = useState<Block[]>(newsletter.blocks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const isPublished = newsletter.status === "published";

  function save(): Promise<boolean> {
    return new Promise((resolve) => {
      setError(null);
      startTransition(async () => {
        const res = await saveNewsletter({
          id: newsletter.id,
          coverTitle,
          coverSubtitle: coverSubtitle.trim() || null,
          heroMetricSummary: heroSummary.trim() || null,
          periodLabel,
          cadence,
          blocks,
        });
        if (!res.ok) { setError(res.error); resolve(false); return; }
        setSavedAt(Date.now());
        resolve(true);
      });
    });
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }
  function removeBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }
  function patchBlock<T extends Block>(idx: number, patch: Partial<T>) {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? ({ ...b, ...patch } as Block) : b)));
  }
  function addBlock(type: Block["type"]) {
    setBlocks((prev) => [...prev, makeBlock(type, companies, metricDefinitions)]);
  }

  async function publish() {
    const ok = await save();
    if (!ok) return;
    startTransition(async () => {
      const res = await publishNewsletter(newsletter.id);
      if (!res.ok) { setError(res.error); return; }
      router.push(`/newsletters/${newsletter.id}`);
    });
  }

  async function unpublish() {
    startTransition(async () => {
      const res = await unpublishNewsletter(newsletter.id);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
    });
  }

  async function destroy() {
    if (!confirm("Delete this newsletter? Cannot be undone.")) return;
    startTransition(async () => {
      await deleteNewsletter(newsletter.id);
    });
  }

  return (
    <div className="px-8 py-6 max-w-3xl space-y-5">
      {/* Cover settings */}
      <div className="bg-white rounded-xl border border-line shadow-card p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block sm:col-span-2">
            <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">Cover title</span>
            <input
              value={coverTitle}
              onChange={(e) => setCoverTitle(e.target.value)}
              maxLength={200}
              className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">Period</span>
            <input
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              maxLength={60}
              className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">Subtitle (optional)</span>
          <input
            value={coverSubtitle}
            onChange={(e) => setCoverSubtitle(e.target.value)}
            maxLength={300}
            className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">Cadence</span>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as NewsletterCadence)}
              className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>{c === "ad_hoc" ? "Ad-hoc" : c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1">Hero summary (1 line, shown on LP cards)</span>
            <input
              value={heroSummary}
              onChange={(e) => setHeroSummary(e.target.value)}
              maxLength={200}
              placeholder="e.g. 8 companies · $42M ARR · 16 mo runway"
              className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </label>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        {blocks.length === 0 && (
          <div className="rounded-xl border border-dashed border-line bg-paper2/30 p-6 text-center text-[12px] text-muted">
            No blocks yet. Add some below.
          </div>
        )}
        {blocks.map((b, i) => (
          <BlockCard
            key={b.id}
            block={b}
            index={i}
            total={blocks.length}
            companies={companies}
            metricDefinitions={metricDefinitions}
            onMove={(dir) => moveBlock(i, dir)}
            onRemove={() => removeBlock(i)}
            onPatch={(patch) => patchBlock(i, patch)}
          />
        ))}
      </div>

      {/* Add block picker */}
      <div className="bg-white rounded-xl border border-line shadow-card p-4">
        <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-2">Add block</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {([
            { type: "text", label: "Text",                  icon: Type },
            { type: "kpi_grid", label: "KPI grid",          icon: BarChart3 },
            { type: "fund_arr_by_company", label: "Fund: ARR by company", icon: BarChart3 },
            { type: "fund_arr_trend", label: "Fund: ARR trend", icon: TrendingUp },
            { type: "sector_breakdown", label: "Fund: sector mix", icon: Layers },
            { type: "company_highlight", label: "Company spotlight", icon: Building2 },
            { type: "metric_chart", label: "Company metric chart",  icon: BarChart3 },
            { type: "watch_list", label: "Watch list",      icon: AlertTriangle },
            { type: "custom_metric_leaderboard", label: "Custom leaderboard", icon: Trophy },
            { type: "divider", label: "Divider",            icon: Minus },
          ] as const).map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => addBlock(type as Block["type"])}
              className="px-3 py-2 rounded-lg border border-line text-[12px] text-ink hover:border-teal/40 hover:bg-teal-50/30 inline-flex items-center gap-2"
            >
              <Icon className="h-3.5 w-3.5 text-muted" /> {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-coral/30 bg-coral/10 text-coral px-3 py-2 text-[12px]">
          {error}
        </div>
      )}

      {/* Action bar */}
      <div className="sticky bottom-3 bg-white rounded-xl border border-line shadow-cardHover p-3 flex items-center gap-2 z-30">
        <button
          type="button"
          onClick={destroy}
          disabled={pending}
          className="text-[11px] text-coral hover:underline inline-flex items-center gap-1 mr-auto"
        >
          <FileX className="h-3 w-3" /> Delete
        </button>
        <a href={`/newsletters/${newsletter.id}`} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
        </a>
        <Button variant="outline" size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save draft
        </Button>
        {isPublished ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={unpublish} disabled={pending}>
            <X className="h-3.5 w-3.5" /> Unpublish
          </Button>
        ) : (
          <Button variant="gold" size="sm" className="gap-1.5" onClick={publish} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Publish to LPs
          </Button>
        )}
      </div>

      {savedAt && Date.now() - savedAt < 3000 && (
        <div className="text-[11px] text-teal-600 text-right inline-flex items-center gap-1.5 ml-auto">
          <Check className="h-3 w-3" /> Saved
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-block editor card
// ---------------------------------------------------------------------------

function BlockCard({
  block, index, total, companies, metricDefinitions, onMove, onRemove, onPatch,
}: {
  block: Block;
  index: number;
  total: number;
  companies: CompanyOption[];
  metricDefinitions: MetricDef[];
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onPatch: (patch: any) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted">
          {labelFor(block.type)}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="p-1 text-muted hover:text-ink disabled:opacity-30"
            aria-label="Move up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="p-1 text-muted hover:text-ink disabled:opacity-30"
            aria-label="Move down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-muted hover:text-coral"
            aria-label="Remove block"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {block.type === "text" && (
        <div className="space-y-2">
          <input
            value={block.heading ?? ""}
            onChange={(e) => onPatch({ heading: e.target.value || null })}
            placeholder="Optional heading"
            className="w-full h-9 px-2.5 rounded-md border border-line text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          <textarea
            value={block.body}
            onChange={(e) => onPatch({ body: e.target.value })}
            rows={Math.max(4, Math.min(20, block.body.split("\n").length + 1))}
            className="w-full px-2.5 py-2 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none leading-relaxed"
          />
        </div>
      )}

      {block.type === "kpi_grid" && (
        <KpiGridEditor block={block} onPatch={onPatch} />
      )}

      {block.type === "company_highlight" && (
        <div className="space-y-2">
          <select
            value={block.companySlug}
            onChange={(e) => onPatch({ companySlug: e.target.value })}
            className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <input
            value={block.angle}
            onChange={(e) => onPatch({ angle: e.target.value })}
            placeholder="Angle (e.g. 'Standout this quarter', 'Leadership change')"
            className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          <textarea
            value={block.body}
            onChange={(e) => onPatch({ body: e.target.value })}
            rows={4}
            placeholder="What you want LPs to know"
            className="w-full px-2.5 py-2 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 resize-none leading-relaxed"
          />
        </div>
      )}

      {block.type === "metric_chart" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={block.companySlug}
            onChange={(e) => onPatch({ companySlug: e.target.value })}
            className="h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <select
            value={block.metric}
            onChange={(e) => onPatch({ metric: e.target.value })}
            className="h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            <option value="arr">ARR</option>
            <option value="cash">Cash</option>
            <option value="burn">Burn</option>
            <option value="revenue">Revenue</option>
            <option value="headcount">Headcount</option>
          </select>
          <input
            value={block.caption ?? ""}
            onChange={(e) => onPatch({ caption: e.target.value || null })}
            placeholder="Caption (optional)"
            className="h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </div>
      )}

      {block.type === "watch_list" && (
        <WatchListEditor block={block} companies={companies} onPatch={onPatch} />
      )}

      {block.type === "custom_metric_leaderboard" && (
        <div className="space-y-2">
          {metricDefinitions.length === 0 ? (
            <p className="text-[12px] text-muted italic">No custom metrics yet. Add some in Settings → Metrics first.</p>
          ) : (
            <select
              value={block.metricDefinitionId}
              onChange={(e) => onPatch({ metricDefinitionId: e.target.value })}
              className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              {metricDefinitions.map((d) => (
                <option key={d.id} value={d.id}>{d.label}{d.unit ? ` (${d.unit})` : ""}</option>
              ))}
            </select>
          )}
          <input
            value={block.heading ?? ""}
            onChange={(e) => onPatch({ heading: e.target.value || null })}
            placeholder="Optional heading"
            className="w-full h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </div>
      )}

      {(block.type === "fund_arr_by_company" || block.type === "fund_arr_trend") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={block.heading ?? ""}
            onChange={(e) => onPatch({ heading: e.target.value || null })}
            placeholder={block.type === "fund_arr_by_company" ? "ARR by company" : "Aggregated portfolio ARR"}
            className="h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          <input
            value={block.caption ?? ""}
            onChange={(e) => onPatch({ caption: e.target.value || null })}
            placeholder="Caption (optional)"
            className="h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
        </div>
      )}

      {block.type === "sector_breakdown" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={block.heading ?? ""}
            onChange={(e) => onPatch({ heading: e.target.value || null })}
            placeholder="Portfolio mix by sector"
            className="h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          />
          <select
            value={block.mode}
            onChange={(e) => onPatch({ mode: e.target.value })}
            className="h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            <option value="arr">By ARR</option>
            <option value="invested">By invested capital</option>
            <option value="count">By number of companies</option>
          </select>
        </div>
      )}

      {block.type === "divider" && (
        <p className="text-[11px] text-muted">Visual separator. No content.</p>
      )}
    </div>
  );
}

function KpiGridEditor({ block, onPatch }: { block: Extract<Block, { type: "kpi_grid" }>; onPatch: (patch: any) => void }) {
  const setItem = (i: number, patch: any) =>
    onPatch({ items: block.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const removeItem = (i: number) =>
    onPatch({ items: block.items.filter((_, idx) => idx !== i) });
  const addItem = () =>
    onPatch({ items: [...block.items, { label: "New KPI", value: "—" }] });

  return (
    <div className="space-y-2">
      <input
        value={block.heading ?? ""}
        onChange={(e) => onPatch({ heading: e.target.value || null })}
        placeholder="Optional heading"
        className="w-full h-9 px-2.5 rounded-md border border-line text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal/30"
      />
      <div className="space-y-1.5">
        {block.items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
            <input
              value={it.label}
              onChange={(e) => setItem(i, { label: e.target.value })}
              placeholder="Label"
              className="col-span-4 h-8 px-2 rounded-md border border-line text-[12px] focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
            <input
              value={it.value}
              onChange={(e) => setItem(i, { value: e.target.value })}
              placeholder="Value (e.g. $8.2M)"
              className="col-span-3 h-8 px-2 rounded-md border border-line text-[12px] tabular-nums focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
            <input
              value={it.delta ?? ""}
              onChange={(e) => setItem(i, { delta: e.target.value || null })}
              placeholder="Delta (optional)"
              className="col-span-3 h-8 px-2 rounded-md border border-line text-[12px] tabular-nums focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
            <select
              value={it.positive == null ? "" : it.positive ? "1" : "0"}
              onChange={(e) => setItem(i, { positive: e.target.value === "" ? null : e.target.value === "1" })}
              className="col-span-1 h-8 px-1 rounded-md border border-line text-[11px] focus:outline-none focus:ring-2 focus:ring-teal/30"
              title="Delta tone"
            >
              <option value="">–</option>
              <option value="1">+</option>
              <option value="0">−</option>
            </select>
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="col-span-1 text-muted hover:text-coral"
              aria-label="Remove KPI"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="text-[11px] text-teal-600 hover:underline inline-flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> Add KPI
      </button>
    </div>
  );
}

function WatchListEditor({
  block, companies, onPatch,
}: {
  block: Extract<Block, { type: "watch_list" }>;
  companies: CompanyOption[];
  onPatch: (patch: any) => void;
}) {
  const setItem = (i: number, patch: any) =>
    onPatch({ companies: block.companies.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const removeItem = (i: number) =>
    onPatch({ companies: block.companies.filter((_, idx) => idx !== i) });
  const addItem = () =>
    onPatch({ companies: [...block.companies, { slug: companies[0]?.slug ?? "", reason: "" }] });

  return (
    <div className="space-y-2">
      <input
        value={block.heading ?? ""}
        onChange={(e) => onPatch({ heading: e.target.value || null })}
        placeholder="Heading"
        className="w-full h-9 px-2.5 rounded-md border border-line text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal/30"
      />
      <div className="space-y-1.5">
        {block.companies.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
            <select
              value={it.slug}
              onChange={(e) => setItem(i, { slug: e.target.value })}
              className="col-span-4 h-8 px-2 rounded-md border border-line text-[12px] focus:outline-none focus:ring-2 focus:ring-teal/30"
            >
              {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <input
              value={it.reason}
              onChange={(e) => setItem(i, { reason: e.target.value })}
              placeholder="Reason"
              className="col-span-7 h-8 px-2 rounded-md border border-line text-[12px] focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="col-span-1 text-muted hover:text-coral"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="text-[11px] text-teal-600 hover:underline inline-flex items-center gap-1"
      >
        <Plus className="h-3 w-3" /> Add company
      </button>
    </div>
  );
}

function makeBlock(
  type: Block["type"],
  companies: CompanyOption[],
  metricDefs: MetricDef[],
): Block {
  const defaultCompany = companies[0]?.slug ?? "";
  switch (type) {
    case "text":
      return { id: newId(), type: "text", heading: null, body: "" };
    case "kpi_grid":
      return { id: newId(), type: "kpi_grid", heading: "By the numbers", items: [{ label: "Label", value: "—" }] };
    case "company_highlight":
      return { id: newId(), type: "company_highlight", companySlug: defaultCompany, angle: "Standout", body: "" };
    case "metric_chart":
      return { id: newId(), type: "metric_chart", companySlug: defaultCompany, metric: "arr", caption: null };
    case "watch_list":
      return { id: newId(), type: "watch_list", heading: "Watch list", companies: [] };
    case "custom_metric_leaderboard":
      return { id: newId(), type: "custom_metric_leaderboard", metricDefinitionId: metricDefs[0]?.id ?? "", heading: null };
    case "fund_arr_by_company":
      return { id: newId(), type: "fund_arr_by_company", heading: null, caption: null };
    case "fund_arr_trend":
      return { id: newId(), type: "fund_arr_trend", heading: null, caption: null };
    case "sector_breakdown":
      return { id: newId(), type: "sector_breakdown", heading: null, mode: "arr" };
    case "divider":
      return { id: newId(), type: "divider" };
  }
}

function labelFor(t: Block["type"]): string {
  return {
    text: "Text",
    kpi_grid: "KPI grid",
    fund_arr_by_company: "Fund · ARR by company",
    fund_arr_trend: "Fund · ARR trend",
    sector_breakdown: "Fund · sector mix",
    company_highlight: "Company spotlight",
    metric_chart: "Company metric chart",
    watch_list: "Watch list",
    custom_metric_leaderboard: "Custom metric leaderboard",
    divider: "Divider",
  }[t];
}
