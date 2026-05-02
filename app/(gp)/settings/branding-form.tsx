"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Upload, Check, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadOrgLogo, updateOrgTheme } from "./actions";

interface Props {
  initial: {
    logoUrl: string | null;
    primary: string;
    accent: string;
    navy: string;
  };
}

const BRAND_DEFAULTS = {
  primary: "#14b8a6", // teal
  accent: "#f4b740",  // gold
  navy: "#0a1f44",
};

export function BrandingForm({ initial }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [primary, setPrimary] = useState(initial.primary);
  const [accent, setAccent] = useState(initial.accent);
  const [navy, setNavy] = useState(initial.navy);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const dirty =
    primary.toLowerCase() !== initial.primary.toLowerCase() ||
    accent.toLowerCase() !== initial.accent.toLowerCase() ||
    navy.toLowerCase() !== initial.navy.toLowerCase();

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
      const res = await uploadOrgLogo(dataUrl);
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

  const handleSaveColors = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateOrgTheme({ primary, accent, navy });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  const resetColors = () => {
    setPrimary(BRAND_DEFAULTS.primary);
    setAccent(BRAND_DEFAULTS.accent);
    setNavy(BRAND_DEFAULTS.navy);
  };

  return (
    <div className="space-y-5">
      {/* Logo */}
      <div>
        <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-2 inline-flex items-center gap-1.5">
          <ImageIcon className="h-3 w-3" /> Fund logo
        </div>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt="Fund logo"
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
            <p className="text-[11px] text-muted mt-1.5">
              Square PNG/SVG works best. &lt;1.5MB. Replaces the &quot;Pulso&quot; mark in the sidebar and on LP letters.
            </p>
          </div>
        </div>
      </div>

      {/* Colors */}
      <form onSubmit={handleSaveColors} className="pt-4 border-t border-line">
        <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-2">Brand colors</div>
        <div className="grid grid-cols-3 gap-3">
          <ColorField label="Primary" value={primary} onChange={setPrimary} />
          <ColorField label="Accent" value={accent} onChange={setAccent} />
          <ColorField label="Navy" value={navy} onChange={setNavy} />
        </div>

        {error && (
          <div className="mt-3 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={resetColors}
            className="text-[11px] text-muted hover:text-ink underline"
          >
            Reset to Pulso defaults
          </button>
          <div className="flex items-center gap-2">
            {savedAt && !dirty && (
              <span className="text-[11px] text-teal-600 inline-flex items-center gap-1.5">
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
            <Button type="submit" variant="gold" size="sm" className="gap-1.5" disabled={pending || !dirty}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {pending ? "Saving…" : "Save colors"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold text-ink tracking-wide uppercase mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded-md border border-line cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-9 px-2 rounded-md border border-line text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
      </div>
    </label>
  );
}
