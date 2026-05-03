import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";

export function PreviewBackBar({
  backHref,
  label,
}: {
  backHref: string;
  label: string;
}) {
  return (
    <div className="no-print sticky top-0 z-40 bg-navy text-white px-4 py-2 text-[12px] flex items-center justify-between">
      <Link href={backHref} className="inline-flex items-center gap-2 hover:text-gold transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to GP view
      </Link>
      <span className="inline-flex items-center gap-1.5 text-gold">
        <Eye className="h-3 w-3" /> Preview · {label}
      </span>
    </div>
  );
}
