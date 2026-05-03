"use client";

import { Download } from "lucide-react";

interface Props {
  label?: string;
  className?: string;
}

/** Triggers the browser's native print flow. The user picks "Save as PDF"
 *  in the print dialog. Cheaper and more reliable than a server-side PDF
 *  pipeline, and the print CSS in globals.css hides chrome that doesn't
 *  belong on a printed letter. */
export function PrintButton({
  label = "PDF",
  className = "h-9 px-3 rounded-lg border border-line bg-white text-xs font-medium text-ink hover:bg-paper2 inline-flex items-center gap-1.5",
}: Props) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Download className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
