import { CheckCircle2, FileText, AlertTriangle, MessageSquare, Sparkles } from "lucide-react";

const activities = [
  { id: 1, type: "submission", title: "Vextra submitted Q1 2026 financials", time: "2 hours ago", icon: CheckCircle2, color: "text-teal-600", bg: "bg-teal-50" },
  { id: 2, type: "ai", title: "Pulso AI flagged Brio: cash burn ↑ 32% vs forecast", time: "4 hours ago", icon: Sparkles, color: "text-gold-600", bg: "bg-gold-50" },
  { id: 3, type: "alert", title: "Caja missed quarterly form submission", time: "Yesterday", icon: AlertTriangle, color: "text-coral", bg: "bg-red-50" },
  { id: 4, type: "form", title: "Q1 2026 Financials sent to 8 companies", time: "Apr 5, 2026", icon: FileText, color: "text-navy", bg: "bg-paper2" },
  { id: 5, type: "comment", title: "Note from Pedro (Lumen): \"hiring 3 new SDRs in May\"", time: "Apr 4, 2026", icon: MessageSquare, color: "text-navy", bg: "bg-paper2" },
];

export function ActivityFeed() {
  return (
    <div className="bg-white rounded-xl border border-line shadow-card flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">Recent activity</h3>
      </div>
      <div className="flex-1 divide-y divide-line">
        {activities.map((a) => (
          <div key={a.id} className="px-5 py-3 flex items-start gap-3">
            <div className={`h-7 w-7 rounded-full ${a.bg} flex items-center justify-center shrink-0 mt-0.5`}>
              <a.icon className={`h-3.5 w-3.5 ${a.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-ink leading-snug">{a.title}</div>
              <div className="text-[11px] text-muted mt-0.5">{a.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
