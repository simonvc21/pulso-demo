"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateProfile } from "./actions";

interface Props {
  initialName: string;
  email: string;
}

export function ProfileForm({ initialName, email }: Props) {
  // If the seed value happens to match the email (legacy), show empty so the
  // GP fills in their actual name.
  const seedName = initialName === email ? "" : initialName;
  const [name, setName] = useState(seedName);
  const [editing, setEditing] = useState(seedName.trim().length === 0);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await updateProfile({ name });
      if (!res.ok) { alert(res.error); return; }
      setEditing(false);
      setSavedAt(Date.now());
    });
  };

  const justSaved = savedAt && Date.now() - savedAt < 2000;

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase">Name</div>
          <div className="text-sm text-ink mt-0.5">{name || "—"}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[11px] text-teal-600 hover:underline inline-flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-[10px] font-semibold text-muted tracking-[0.14em] uppercase mb-1">Name</div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Simon Villena"
          maxLength={80}
          className="flex-1 h-9 px-2.5 rounded-md border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setName(seedName); setEditing(false); }
          }}
        />
        <Button
          variant="gold"
          size="sm"
          className="gap-1.5"
          onClick={save}
          disabled={pending || !name.trim()}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save
        </Button>
        {seedName && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setName(seedName); setEditing(false); }}
            disabled={pending}
          >
            Cancel
          </Button>
        )}
      </div>
      {justSaved && <div className="mt-1 text-[11px] text-teal-600">Saved.</div>}
    </div>
  );
}
