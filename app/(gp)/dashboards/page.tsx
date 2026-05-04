// L.10 / Fase 1.D — Dashboards hub. Lists the fund-level dashboard plus a
// per-company dashboard for every active company. Each card exposes "Open"
// and "Share" actions; share mints a public token rendered at /d/[token].

import Link from "next/link";
import { LayoutDashboard, Building2 } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { createClient } from "@/lib/supabase/server";
import { getFund } from "@/lib/dashboard-data";
import { ShareLinkButton } from "./share-link-button";
import { ShareLinkList } from "./share-link-list";

export const dynamic = "force-dynamic";

interface ShareRow {
  id: string;
  token: string;
  kind: "fund_dashboard" | "company_dashboard";
  target_company_id: string | null;
  watermark_email: string | null;
  view_count: number;
  created_at: string;
}

export default async function DashboardsHubPage() {
  const supabase = createClient();
  const [fund, { data: companies }, { data: shares }] = await Promise.all([
    getFund(),
    supabase
      .from("companies")
      .select("id, slug, name, sector, country, status, logo_url")
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("share_links")
      .select("id, token, kind, target_company_id, watermark_email, view_count, created_at")
      .in("kind", ["fund_dashboard", "company_dashboard"])
      .order("created_at", { ascending: false }),
  ]);

  const sharesByTarget = new Map<string, ShareRow[]>();
  for (const s of (shares ?? []) as ShareRow[]) {
    const key = s.kind === "fund_dashboard" ? "fund" : `c:${s.target_company_id}`;
    const arr = sharesByTarget.get(key) ?? [];
    arr.push(s);
    sharesByTarget.set(key, arr);
  }

  return (
    <>
      <Topbar
        bell={<TopbarBell />}
        title="Dashboards"
        breadcrumb={fund?.name ?? "Your fund"}
      />

      <div className="px-8 py-6 space-y-6 animate-fade-in">
        <p className="text-sm text-muted max-w-2xl">
          One dashboard for the fund and one per company. Click <strong>Share</strong> to mint a public link you can email an LP — they don't need a Pulso account.
        </p>

        {/* Fund dashboard card */}
        <DashboardCard
          icon={<LayoutDashboard className="h-5 w-5" />}
          title={fund?.name ? `${fund.name} — fund overview` : "Fund overview"}
          subtitle="Portfolio KPIs · ARR by company · trends · watch list"
          openHref="/dashboard"
          shares={sharesByTarget.get("fund") ?? []}
          shareKind="fund_dashboard"
        />

        {/* Company dashboards */}
        <div>
          <h2 className="text-[10px] font-semibold text-muted tracking-[0.16em] uppercase mb-3">
            Company dashboards
          </h2>
          <div className="space-y-3">
            {(companies ?? []).map((c) => (
              <DashboardCard
                key={c.id}
                icon={
                  c.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={c.logo_url}
                      alt={c.name}
                      className="h-8 w-8 rounded-md object-contain bg-white border border-line"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-md bg-navy text-gold font-serif font-bold flex items-center justify-center">
                      {c.name[0]}
                    </div>
                  )
                }
                title={c.name}
                subtitle={[c.sector, c.country].filter(Boolean).join(" · ") || "—"}
                openHref={`/dashboards/companies/${c.slug}`}
                shares={sharesByTarget.get(`c:${c.id}`) ?? []}
                shareKind="company_dashboard"
                companyId={c.id}
              />
            ))}
            {(!companies || companies.length === 0) && (
              <p className="text-sm text-muted">No companies yet. Add one from <Link href="/companies" className="underline">/companies</Link>.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardCard({
  icon, title, subtitle, openHref, shares, shareKind, companyId,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  openHref: string;
  shares: ShareRow[];
  shareKind: "fund_dashboard" | "company_dashboard";
  companyId?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-4">
      <div className="flex items-center gap-3">
        <div className="shrink-0 h-10 w-10 rounded-lg bg-paper2 flex items-center justify-center text-navy">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-serif font-semibold text-ink truncate">{title}</h3>
          <p className="text-[11px] text-muted truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={openHref}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-line bg-white text-ink hover:bg-paper2"
          >
            Open
          </Link>
          <ShareLinkButton kind={shareKind} companyId={companyId} />
        </div>
      </div>
      {shares.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line">
          <ShareLinkList shares={shares} />
        </div>
      )}
    </div>
  );
}
