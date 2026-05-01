import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getFormTemplates, type FormCadence } from "@/lib/dashboard-data";
import { Plus, Calendar, Send, Repeat, ChevronRight, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

const cadenceLabel: Record<FormCadence, { label: string; tone: "navy" | "teal" | "gold" | "default" }> = {
  monthly:   { label: "Monthly",   tone: "teal" },
  quarterly: { label: "Quarterly", tone: "gold" },
  annual:    { label: "Annual",    tone: "navy" },
  "ad-hoc":  { label: "Ad-hoc",    tone: "default" },
};

export default async function FormsPage({
  searchParams,
}: {
  searchParams: { company?: string };
}) {
  const templates = await getFormTemplates();
  const companySlug = searchParams.company;

  return (
    <>
      <Topbar
        title="Forms"
        breadcrumb={
          companySlug
            ? `Pick a form to send to ${companySlug}`
            : "Templates · scheduling · responses"
        }
        actions={
          <Link href="/forms/new">
            <Button variant="primary" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New form
            </Button>
          </Link>
        }
      />

      <div className="px-8 py-6 space-y-6 animate-fade-in">
        {companySlug && (
          <div className="bg-teal-50 border border-teal/30 text-teal-600 rounded-xl px-4 py-3 text-[13px] flex items-center justify-between">
            <span>
              Pick a form template below to preview the founder-fill flow as <span className="font-semibold">{companySlug}</span>.
            </span>
            <Link href="/forms" className="text-[12px] text-teal-600 hover:underline">Clear</Link>
          </div>
        )}

        {/* Schedule banner */}
        <div className="bg-white rounded-xl border border-line shadow-card p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
            <Repeat className="h-5 w-5 text-teal-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink">Pulso runs your reporting calendar.</h3>
            <p className="text-[13px] text-muted mt-1">
              Forms are scheduled to send automatically. Founders get reminders. Late submissions are escalated. You only see what needs your attention.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
              <span className="inline-flex items-center gap-1.5 text-muted"><Calendar className="h-3.5 w-3.5" /> Next scheduled send: <span className="text-ink font-medium">May 28 — Monthly Pulse Check</span></span>
              <span className="inline-flex items-center gap-1.5 text-muted"><Send className="h-3.5 w-3.5" /> 8 founders · 3 reminders pending</span>
            </div>
          </div>
        </div>

        {/* Form templates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((t) => {
            const href = companySlug
              ? `/fill/${t.slug}?company=${companySlug}`
              : `/forms/${t.slug}`;
            return (
              <Link key={t.id} href={href} className="group">
                <div className="bg-white rounded-xl border border-line shadow-card hover:shadow-cardHover transition-shadow p-5 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <Badge tone={cadenceLabel[t.cadence].tone}>{cadenceLabel[t.cadence].label}</Badge>
                    {companySlug ? (
                      <Eye className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <h3 className="text-base font-serif font-semibold text-ink mt-3">{t.name}</h3>
                  <p className="text-[12px] text-muted mt-1">{t.fieldCount} fields</p>
                  <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-[11px]">
                    <div className="text-muted">
                      Last sent <span className="text-ink font-medium">{t.lastSent ?? "—"}</span>
                    </div>
                    <div className="font-semibold text-teal-600">
                      {t.responseRate}% response
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* New form card */}
          <Link href="/forms/new" className="group">
            <div className="bg-paper2 border-2 border-dashed border-line hover:border-navy rounded-xl p-5 h-full flex flex-col items-center justify-center text-center transition-colors">
              <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-muted group-hover:text-navy group-hover:bg-paper transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <div className="mt-2 text-sm font-semibold text-ink">Create new form</div>
              <div className="text-[11px] text-muted mt-1">Drag fields, schedule the cadence, ship.</div>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
