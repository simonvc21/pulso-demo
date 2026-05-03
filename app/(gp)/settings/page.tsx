import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { TopbarBell } from "@/components/topbar-bell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Mail, Shield, Users, ChevronRight, Sparkles } from "lucide-react";
import { getCurrentUser, getFund, parseTheme } from "@/lib/dashboard-data";
import { signOut } from "./actions";
import { FundForm } from "./fund-form";
import { BrandingForm } from "./branding-form";
import { ts } from "@/lib/i18n-server";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  noStore();
  const [profile, fund] = await Promise.all([getCurrentUser(), getFund()]);

  return (
    <>
      <Topbar
        title={ts("settings.title")}
        breadcrumb={ts("settings.breadcrumb")}
        bell={<TopbarBell />}
      />
      <div className="px-8 py-6 space-y-6 animate-fade-in max-w-3xl">
        {/* Profile */}
        <Card title={ts("settings.your_profile")} subtitle={ts("settings.your_profile_subtitle")}>
          <Field icon={User} label={ts("auth.name")} value={profile?.name ?? "—"} />
          <Field icon={Mail} label={ts("auth.email")} value={profile?.email ?? "—"} />
          <Field
            icon={Shield}
            label={ts("auth.role")}
            valueNode={
              <Badge tone={profile?.role === "gp" ? "gold" : "default"}>
                {(profile?.role ?? "viewer").toUpperCase()}
              </Badge>
            }
          />
        </Card>

        {/* Fund */}
        <Card title={ts("settings.fund_card")} subtitle={ts("settings.fund_subtitle")}>
          {fund ? (
            <FundForm
              initial={{
                name: fund.name,
                vintage: fund.vintage ?? null,
                sizeUsd: Number(fund.size_usd ?? 0),
                deployedUsd: Number(fund.deployed_usd ?? 0),
                currency: fund.currency ?? "USD",
                description: fund.description ?? "",
                thesis: fund.thesis ?? "",
                website: fund.website ?? "",
                linkedinUrl: fund.linkedin_url ?? "",
                foundedYear: fund.founded_year ?? null,
              }}
            />
          ) : (
            <div className="text-[12px] text-muted">Your account isn't assigned to a fund yet.</div>
          )}
        </Card>

        {/* Branding */}
        <Card
          title={ts("settings.branding")}
          subtitle={ts("settings.branding_subtitle")}
        >
          {fund ? (
            <BrandingForm
              initial={{
                logoUrl: fund.logo_url ?? null,
                primary: parseTheme(fund.theme_json).primary ?? "#14b8a6",
                accent: parseTheme(fund.theme_json).accent ?? "#f4b740",
                navy: parseTheme(fund.theme_json).navy ?? "#0a1f44",
                chart: parseTheme(fund.theme_json).chart ?? parseTheme(fund.theme_json).primary ?? "#14b8a6",
              }}
            />
          ) : (
            <div className="text-[12px] text-muted">Your account isn't assigned to a fund yet.</div>
          )}
        </Card>

        {/* Team */}
        <Link href="/settings/team" className="block group">
          <div className="bg-white rounded-xl border border-line shadow-card hover:shadow-cardHover transition-shadow overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-ink">{ts("settings.team")}</h3>
                <p className="text-[11px] text-muted mt-0.5">{ts("settings.team_subtitle")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted group-hover:text-ink transition-colors" />
            </div>
          </div>
        </Link>

        {/* AI usage & cost — L.15 */}
        <Link href="/settings/usage" className="block group">
          <div className="bg-white rounded-xl border border-line shadow-card hover:shadow-cardHover transition-shadow overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gold-50 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-gold-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-ink">AI usage & cost</h3>
                <p className="text-[11px] text-muted mt-0.5">Token usage, cost by feature, per-user breakdown</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted group-hover:text-ink transition-colors" />
            </div>
          </div>
        </Link>

        {/* Value delivered — L.20 */}
        <Link href="/settings/value" className="block group">
          <div className="bg-white rounded-xl border border-line shadow-card hover:shadow-cardHover transition-shadow overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-ink">Value delivered</h3>
                <p className="text-[11px] text-muted mt-0.5">Hours saved, reports generated, alerts surfaced</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted group-hover:text-ink transition-colors" />
            </div>
          </div>
        </Link>

        {/* Integrations placeholder */}
        <Card
          title={ts("settings.integrations")}
          subtitle={ts("settings.integrations_subtitle")}
        >
          <div className="text-[12px] text-muted">
            Integrations will let Pulso pull financial data automatically — phase 2 of the roadmap.
          </div>
        </Card>

        {/* Session */}
        <Card title={ts("settings.session")} subtitle={ts("settings.session_subtitle")}>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> {ts("settings.sign_out")}
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}

function Card({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-5 py-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  icon: Icon, label, value, valueNode,
}: {
  icon: any;
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-paper2 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">{label}</div>
        <div className="text-sm text-ink mt-0.5">
          {valueNode ?? value ?? "—"}
        </div>
      </div>
    </div>
  );
}
