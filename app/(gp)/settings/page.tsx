import { Topbar } from "@/components/topbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Mail, Shield } from "lucide-react";
import { getCurrentUser, getFund } from "@/lib/dashboard-data";
import { signOut } from "./actions";
import { FundForm } from "./fund-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [profile, fund] = await Promise.all([getCurrentUser(), getFund()]);

  return (
    <>
      <Topbar title="Settings" breadcrumb="Profile · fund · session" />
      <div className="px-8 py-6 space-y-6 animate-fade-in max-w-3xl">
        {/* Profile */}
        <Card title="Your profile" subtitle="Read-only for the demo">
          <Field icon={User} label="Name" value={profile?.name ?? "—"} />
          <Field icon={Mail} label="Email" value={profile?.email ?? "—"} />
          <Field
            icon={Shield}
            label="Role"
            valueNode={
              <Badge tone={profile?.role === "gp" ? "gold" : "default"}>
                {(profile?.role ?? "viewer").toUpperCase()}
              </Badge>
            }
          />
        </Card>

        {/* Fund */}
        <Card title="Fund" subtitle="Edit your fund's profile. Visible to your team and on LP letters.">
          {fund ? (
            <FundForm
              initial={{
                name: fund.name,
                vintage: fund.vintage ?? null,
                sizeUsd: Number(fund.size_usd ?? 0),
                deployedUsd: Number(fund.deployed_usd ?? 0),
                currency: fund.currency ?? "USD",
              }}
            />
          ) : (
            <div className="text-[12px] text-muted">Your account isn't assigned to a fund yet.</div>
          )}
        </Card>

        {/* Integrations placeholder */}
        <Card
          title="Integrations"
          subtitle="Coming soon: QuickBooks, Contabilizei, Xero, Slack, Google Drive"
        >
          <div className="text-[12px] text-muted">
            Integrations will let Pulso pull financial data automatically — phase 2 of the roadmap.
          </div>
        </Card>

        {/* Session */}
        <Card title="Session" subtitle="Sign out of this device">
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" className="gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Sign out
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
