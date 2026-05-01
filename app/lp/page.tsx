import Link from "next/link";
import { ChevronRight, FileText, Calendar, Eye } from "lucide-react";
import { getLpLetters } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function LpHomePage() {
  const letters = await getLpLetters();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="text-[11px] font-semibold text-gold-600 tracking-[0.18em] uppercase">LP Portal</div>
      <h1 className="mt-2 text-3xl font-serif font-bold text-ink leading-tight">
        Your letters and updates
      </h1>
      <p className="mt-2 text-sm text-muted">
        Quarterly portfolio updates from the funds you've committed to.
      </p>

      {letters.length === 0 ? (
        <div className="mt-10 bg-white rounded-2xl border border-line shadow-card p-10 text-center">
          <div className="h-12 w-12 rounded-full bg-paper2 flex items-center justify-center mx-auto">
            <FileText className="h-6 w-6 text-muted" />
          </div>
          <h2 className="mt-4 text-base font-serif font-semibold text-ink">No letters yet</h2>
          <p className="mt-2 text-[13px] text-muted max-w-md mx-auto">
            Your GP hasn't shared anything with you yet. Letters will appear here as soon as they're published.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {letters.map((l) => (
            <Link key={l.token} href={`/share/${l.token}`} className="group">
              <div className="bg-white rounded-2xl border border-line shadow-card hover:shadow-cardHover transition-shadow p-6 h-full flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] tracking-[0.16em] uppercase font-semibold text-gold-600">
                    Quarterly letter
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="mt-3 text-lg font-serif font-bold text-ink">{l.organizationName}</h3>
                <div className="mt-4 pt-4 border-t border-line flex items-center justify-between text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-3 w-3" /> {l.viewCount} view{l.viewCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
