import Link from "next/link";
import { Newspaper, ArrowUpRight, Calendar } from "lucide-react";
import type { NewsletterUpdate } from "@/lib/dashboard-data";

function relativeDate(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.round(ms / day);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  updates: NewsletterUpdate[];
}

export function PortfolioNewsletter({ updates }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-line shadow-card overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-line bg-paper">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-navy text-gold flex items-center justify-center">
              <Newspaper className="h-5 w-5" fill="currentColor" />
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-gold-600">
                Portfolio newsletter
              </div>
              <h2 className="text-xl font-serif font-bold text-ink">Latest from your portfolio</h2>
            </div>
          </div>
          <div className="text-[11px] text-muted">
            {updates.length} {updates.length === 1 ? "update" : "updates"}
          </div>
        </div>
      </div>

      {updates.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[13px] text-muted max-w-md mx-auto">
            No founder updates yet. Add a <span className="font-medium text-ink">News / Update</span> field to a form, send it, and the latest narrative will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {updates.map((u) => (
            <article key={u.id} className="px-6 py-5">
              <header className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-navy text-gold flex items-center justify-center text-sm font-serif font-bold shrink-0">
                    {u.company_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <Link
                      href={`/companies/${u.company_slug}`}
                      className="text-base font-serif font-bold text-ink hover:text-teal-600 transition-colors inline-flex items-center gap-1 group"
                    >
                      {u.company_name}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                    <div className="text-[11px] text-muted mt-0.5">
                      {u.field_label}
                      <span className="mx-1.5 text-muted/60">·</span>
                      {u.form_name}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-muted inline-flex items-center gap-1.5 shrink-0">
                  <Calendar className="h-3 w-3" /> {relativeDate(u.submitted_at)}
                </div>
              </header>
              <div className="ml-12 mt-2 text-[14px] leading-relaxed text-ink whitespace-pre-line font-serif">
                {u.text}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
