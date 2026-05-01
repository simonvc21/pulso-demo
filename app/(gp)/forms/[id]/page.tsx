import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Send, Eye, FileText, Sparkles, Users, CheckCircle2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFormBySlug, type FormCadence, type FormFieldRow } from "@/lib/dashboard-data";
import { sendFormNow, deactivateForm } from "../actions";

export const dynamic = "force-dynamic";

const cadenceLabel: Record<FormCadence, { label: string; tone: "navy" | "teal" | "gold" | "default" }> = {
  monthly: { label: "Monthly", tone: "teal" },
  quarterly: { label: "Quarterly", tone: "gold" },
  annual: { label: "Annual", tone: "navy" },
  "ad-hoc": { label: "Ad-hoc", tone: "default" },
};

function groupFields(fields: FormFieldRow[]): { title: string; fields: FormFieldRow[] }[] {
  const groups = new Map<string, FormFieldRow[]>();
  for (const f of fields) {
    const key = f.group ?? "General";
    const arr = groups.get(key) ?? [];
    arr.push(f);
    groups.set(key, arr);
  }
  return Array.from(groups.entries()).map(([title, fs]) => ({ title, fields: fs }));
}

export default async function FormDetailPage({ params }: { params: { id: string } }) {
  const form = await getFormBySlug(params.id);
  if (!form) notFound();

  const groups = groupFields(form.fields);
  const cad = cadenceLabel[form.cadence];

  return (
    <>
      <Topbar
        title={form.name}
        breadcrumb={
          <Link href="/forms" className="inline-flex items-center gap-1 hover:text-ink">
            <ArrowLeft className="h-3 w-3" /> Forms
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/fill/${form.slug}?company=vextra`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Preview as founder
              </Button>
            </Link>
            {form.active ? (
              <form action={async () => { "use server"; await deactivateForm(form.slug); }}>
                <Button type="submit" variant="outline" size="sm" className="gap-1.5">
                  Pause
                </Button>
              </form>
            ) : null}
            <form action={async () => { "use server"; await sendFormNow(form.slug); }}>
              <Button type="submit" variant="gold" size="sm" className="gap-1.5">
                <Send className="h-3.5 w-3.5" /> Send now
              </Button>
            </form>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6 animate-fade-in">
        {/* Hero */}
        <div className="bg-white rounded-xl border border-line shadow-card p-6">
          <div className="flex items-start gap-5">
            <div className="h-12 w-12 rounded-lg bg-paper2 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-navy" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-serif font-bold text-ink">{form.name}</h2>
                <Badge tone={cad.tone}>{cad.label}</Badge>
                {!form.active && <Badge tone="default">Inactive</Badge>}
              </div>
              <p className="text-sm text-muted mt-1">
                {form.fields.length} field{form.fields.length === 1 ? "" : "s"} · {form.sentToCount} recipient{form.sentToCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-line grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={Calendar} label="Last sent" value={form.lastSent ?? "—"} />
            <Stat icon={Users} label="Recipients" value={`${form.sentToCount}`} />
            <Stat icon={CheckCircle2} label="Response rate" value={`${form.responseRate}%`} accent={form.responseRate >= 80 ? "teal" : "gold"} />
            <Stat icon={Sparkles} label="AI-extracted" value={`${form.recentSubmissions.filter((s) => s.aiExtracted).length} / ${form.recentSubmissions.length}`} />
          </div>
        </div>

        {/* Fields */}
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-line flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink">Fields</h3>
              <p className="text-[11px] text-muted mt-0.5">What founders are asked to submit</p>
            </div>
            <Link href={`/forms/${form.slug}/edit`}>
              <Button variant="outline" size="sm">Edit fields</Button>
            </Link>
          </div>
          {form.fields.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted">
              No fields yet. <Link href={`/forms/${form.slug}/edit`} className="text-teal-600 hover:underline">Add some →</Link>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {groups.map((g) => (
                <div key={g.title} className="px-5 py-4">
                  <div className="text-[10px] font-semibold text-gold-600 tracking-[0.16em] uppercase">{g.title}</div>
                  <div className="mt-3 space-y-2">
                    {g.fields.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 py-1.5">
                        <div className="text-[10px] tracking-[0.14em] uppercase text-muted font-semibold w-20 shrink-0">{f.type}</div>
                        <div className="flex-1 text-sm text-ink">{f.label}</div>
                        {f.required && <Badge tone="gold">Required</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent submissions */}
        <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-line">
            <h3 className="text-sm font-semibold text-ink">Recent submissions</h3>
            <p className="text-[11px] text-muted mt-0.5">Latest 10 founder responses</p>
          </div>
          {form.recentSubmissions.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted">
              No submissions yet. Founders will show up here once they fill the form.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {form.recentSubmissions.map((s) => (
                <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="h-8 w-8 rounded-lg bg-paper2 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink">{s.companyName}</div>
                    {s.submittedBy && <div className="text-[11px] text-muted">{s.submittedBy}</div>}
                  </div>
                  {s.aiExtracted && <Badge tone="teal">AI-assisted</Badge>}
                  <div className="text-[11px] text-muted w-28 text-right">{s.submittedAt}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({
  icon: Icon, label, value, accent,
}: { icon: any; label: string; value: string; accent?: "teal" | "gold" }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-paper2 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">{label}</div>
        <div className={`text-sm font-semibold ${accent === "teal" ? "text-teal-600" : accent === "gold" ? "text-gold-600" : "text-ink"}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
