"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, AlertCircle, RotateCcw, UserX, Bell, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetOrgAiUsage, forceUserOnboarding, rerunMetricAlerts } from "../actions";

interface Org { id: string; name: string; slug: string; }

export function SystemToolsClient({ organizations }: { organizations: Org[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ResetUsageTool organizations={organizations} />
      <ForceOnboardingTool />
      <RerunAlertsTool organizations={organizations} />
      <DangerZoneNote />
    </div>
  );
}

interface Toast { kind: "ok" | "err"; text: string; }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = (t: Toast) => {
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 4000);
  };
  return { toast, show };
}

function ResetUsageTool({ organizations }: { organizations: Org[] }) {
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const { toast, show } = useToast();

  const run = () => {
    if (!orgId) return;
    const org = organizations.find((o) => o.id === orgId);
    if (!confirm(`Reset AI usage for "${org?.name}"?\n\nThis wipes both the daily-quota counts and the granular event log. The org will get a fresh budget immediately. Cannot be undone.`)) return;
    startTransition(async () => {
      const res = await resetOrgAiUsage({ organizationId: orgId });
      show(res.ok ? { kind: "ok", text: res.message ?? "Reset" } : { kind: "err", text: res.error });
    });
  };

  return (
    <Card icon={RotateCcw} title="Reset AI usage">
      <p className="text-[12px] text-muted">
        Wipe today's quota counts + the full ai_usage_events log for one org. Useful when a spike was internal testing, or after a billing dispute.
      </p>
      <div className="space-y-2">
        <OrgSelect value={orgId} onChange={setOrgId} organizations={organizations} />
        <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={run} disabled={pending || !orgId}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Reset usage
        </Button>
      </div>
      <ToastLine t={toast} />
    </Card>
  );
}

function ForceOnboardingTool() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast, show } = useToast();

  const run = () => {
    const v = email.trim();
    if (!v) return;
    if (!confirm(`Detach ${v} from their org?\n\nThey'll be sent to /onboarding the next time they sign in. Their data stays put — only the link is severed.`)) return;
    startTransition(async () => {
      const res = await forceUserOnboarding({ userEmail: v });
      show(res.ok ? { kind: "ok", text: res.message ?? "Detached" } : { kind: "err", text: res.error });
      if (res.ok) setEmail("");
    });
  };

  return (
    <Card icon={UserX} title="Force user onboarding">
      <p className="text-[12px] text-muted">
        Detach a user from their org. They land in /onboarding next sign-in to pick or create a fund. The user row + auth account stay intact.
      </p>
      <div className="space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="founder@example.com"
          className="w-full h-9 px-2.5 rounded-md border border-line text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
        <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={run} disabled={pending || !email.trim()}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
          Detach + send to onboarding
        </Button>
      </div>
      <ToastLine t={toast} />
    </Card>
  );
}

function RerunAlertsTool({ organizations }: { organizations: Org[] }) {
  const [orgId, setOrgId] = useState(organizations[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const { toast, show } = useToast();

  const run = () => {
    if (!orgId) return;
    startTransition(async () => {
      const res = await rerunMetricAlerts({ organizationId: orgId });
      show(res.ok ? { kind: "ok", text: res.message ?? "Re-run" } : { kind: "err", text: res.error });
    });
  };

  return (
    <Card icon={Bell} title="Re-run metric alerts">
      <p className="text-[12px] text-muted">
        Forces the daily metric-alerts cron to evaluate this org now. Useful after fixing thresholds or if the cron missed a run.
      </p>
      <div className="space-y-2">
        <OrgSelect value={orgId} onChange={setOrgId} organizations={organizations} />
        <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={run} disabled={pending || !orgId}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          Run now
        </Button>
        <p className="text-[10px] text-muted">
          Note: today the run_metric_alerts() RPC scopes to the caller's org. A future migration adds a per-org admin variant.
        </p>
      </div>
      <ToastLine t={toast} />
    </Card>
  );
}

function DangerZoneNote() {
  return (
    <Card icon={Info} title="Coming soon">
      <ul className="text-[12px] text-muted space-y-1.5 list-disc pl-4">
        <li>Editor de datos críticos (CRUD genérico para cualquier table de la org)</li>
        <li>Re-procesar specific alerts por id</li>
        <li>Bulk re-seed de un org desde un export JSON</li>
        <li>Audit log viewer (requiere Fase G)</li>
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Atoms
// ---------------------------------------------------------------------------

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-coral/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-coral" />
        </div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function OrgSelect({ value, onChange, organizations }: { value: string; onChange: (v: string) => void; organizations: Org[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-2.5 rounded-md border border-line text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
    >
      {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
}

function ToastLine({ t }: { t: Toast | null }) {
  if (!t) return null;
  return (
    <div className={`text-[11px] inline-flex items-center gap-1.5 ${t.kind === "ok" ? "text-teal-600" : "text-coral"}`}>
      {t.kind === "ok" ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {t.text}
    </div>
  );
}
