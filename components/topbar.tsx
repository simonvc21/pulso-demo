import { Bell, Search } from "lucide-react";

export function Topbar({ title, breadcrumb, actions }: { title: string; breadcrumb?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="border-b border-line bg-white/70 backdrop-blur sticky top-0 z-10">
      <div className="px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            {breadcrumb && <div className="text-[11px] text-muted">{breadcrumb}</div>}
            <h1 className="text-lg font-serif font-semibold text-ink truncate">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <input
              placeholder="Search companies, founders…"
              className="h-9 pl-8 pr-3 w-64 rounded-lg bg-paper border border-line text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-teal/30"
            />
          </div>
          <button className="relative h-9 w-9 rounded-lg border border-line bg-white hover:bg-paper2 flex items-center justify-center">
            <Bell className="h-4 w-4 text-muted" />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-coral" />
          </button>
          <div className="h-9 w-9 rounded-full bg-navy text-gold flex items-center justify-center text-xs font-semibold">SV</div>
          {actions}
        </div>
      </div>
    </div>
  );
}
