import { Topbar } from "@/components/topbar";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" breadcrumb="Fund profile · branding · integrations" />
      <div className="px-8 py-6 animate-fade-in">
        <div className="bg-white rounded-xl border border-line shadow-card p-8 max-w-2xl">
          <h2 className="text-lg font-serif font-bold text-ink">Settings</h2>
          <p className="text-sm text-muted mt-2">
            Demo placeholder. In the production app: fund profile, brand colors that flow into LP-share views, integrations (QuickBooks · Contabilizei · Xero · Slack · Google Drive), team & permissions, audit log.
          </p>
        </div>
      </div>
    </>
  );
}
