"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadCompanyLogo } from "@/app/(gp)/settings/actions";

interface Props {
  companySlug: string;
  initialLogoUrl: string | null;
}

export function CompanyLogoUploader({ companySlug, initialLogoUrl }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > 1_500_000) {
      setError("Logo must be under 1.5MB");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const res = await uploadCompanyLogo(companySlug, dataUrl);
      setUploading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLogoUrl(res.url);
      router.refresh();
    };
    reader.onerror = () => {
      setUploading(false);
      setError("Could not read the file");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-xl border border-line shadow-card p-5">
      <h3 className="text-[10px] tracking-[0.16em] uppercase text-muted font-semibold mb-3">Logo</h3>
      <div className="flex items-center gap-4">
        {logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt="Company logo"
            className="h-16 w-16 rounded-xl object-contain bg-white border border-line"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-paper2 border border-dashed border-line flex items-center justify-center text-muted">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <p className="text-[11px] text-muted mt-1.5">Square PNG/SVG. &lt;1.5MB.</p>
          {error && (
            <div className="mt-2 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
