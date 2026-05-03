"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, Loader2, X, MoreHorizontal, UserMinus, ShieldCheck, Mail, Clock, CheckCircle2, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { inviteUser, revokeInvitation, updateMemberRole, removeMember, getMemberCompanyAccess, setMemberCompanyAccess } from "../team-actions";
import type { OrgMember, OrgInvitation, CompanyOption } from "@/lib/dashboard-data";
import { FUND_ROLES, ADMIN_ROLES, roleLabel, type FundRole } from "@/lib/roles";

const ROLES = FUND_ROLES;
type RoleValue = FundRole;

interface Props {
  initialMembers: OrgMember[];
  initialInvitations: OrgInvitation[];
  currentUserId: string | null;
  canManage: boolean;
  companies: CompanyOption[];
}

export function TeamPanel({ initialMembers, initialInvitations, currentUserId, canManage, companies }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scopeFor, setScopeFor] = useState<OrgMember | null>(null);

  const handleAction = (run: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await run();
      if (!res.ok) setError(res.error ?? "Action failed");
      router.refresh();
    });
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-line shadow-card overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Members</h3>
            <p className="text-[11px] text-muted mt-0.5">
              {initialMembers.length} member{initialMembers.length === 1 ? "" : "s"}
              {initialInvitations.length > 0 && ` · ${initialInvitations.length} pending`}
            </p>
          </div>
          {canManage && (
            <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Invite
            </Button>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-3 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="divide-y divide-line">
          {initialMembers.map((m) => (
            <div key={m.id} className="px-5 py-3 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-paper2 text-navy font-semibold text-xs flex items-center justify-center shrink-0">
                {(m.name ?? m.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">{m.name ?? m.email}</div>
                <div className="text-[11px] text-muted truncate">{m.email}</div>
              </div>
              {canManage && m.id !== currentUserId ? (
                <select
                  value={m.role}
                  disabled={pending}
                  onChange={(e) =>
                    handleAction(() => updateMemberRole(m.id, e.target.value as RoleValue))
                  }
                  className="h-8 px-2 rounded-md border border-line text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal/30"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              ) : (
                <Badge tone={ROLES.find((r) => r.value === m.role)?.tone ?? "default"}>
                  {roleLabel(m.role)}
                </Badge>
              )}
              {m.id === currentUserId ? (
                <Badge tone="teal">You</Badge>
              ) : canManage ? (
                <>
                  {!ADMIN_ROLES.has(m.role as FundRole) && (
                    <button
                      onClick={() => setScopeFor(m)}
                      className="text-muted hover:text-ink p-1.5 inline-flex items-center gap-1 text-[10px] tracking-wider uppercase font-semibold"
                      title="Set company access"
                    >
                      <Building2 className="h-3.5 w-3.5" /> Scope
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!confirm(`Remove ${m.email} from the fund?`)) return;
                      handleAction(() => removeMember(m.id));
                    }}
                    disabled={pending}
                    className="text-muted hover:text-coral p-1.5"
                    aria-label={`Remove ${m.email}`}
                    title="Remove from fund"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </>
              ) : null}
            </div>
          ))}
          {initialMembers.length === 0 && (
            <div className="px-5 py-6 text-[12px] text-muted">No members yet.</div>
          )}
        </div>

        {initialInvitations.length > 0 && (
          <div className="border-t border-line">
            <div className="px-5 pt-3 pb-2 text-[10px] tracking-[0.16em] uppercase text-muted font-semibold">
              Pending invitations
            </div>
            <div className="divide-y divide-line">
              {initialInvitations.map((inv) => {
                const expires = new Date(inv.expiresAt);
                const expired = expires.getTime() < Date.now();
                return (
                  <div key={inv.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gold-50 text-gold-600 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink truncate">{inv.email}</div>
                      <div className="text-[11px] text-muted">
                        {expired ? "Expired" : `Expires ${expires.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </div>
                    </div>
                    <Badge tone={expired ? "default" : "gold"}>{roleLabel(inv.role)}</Badge>
                    {canManage && (
                      <button
                        onClick={() => handleAction(() => revokeInvitation(inv.id))}
                        disabled={pending}
                        className="text-muted hover:text-coral p-1.5"
                        title="Revoke invitation"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            setInviteOpen(false);
            router.refresh();
          }}
        />
      )}

      {scopeFor && (
        <ScopeModal
          member={scopeFor}
          companies={companies}
          onClose={() => setScopeFor(null)}
          onSaved={() => {
            setScopeFor(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleValue>("analyst");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pending, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await inviteUser({ email, role });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onInvited();
    });
  };

  const modal = (
    <div
      className="fixed inset-0 z-[1000] bg-navy/50 overflow-y-auto"
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-screen w-full flex justify-center px-4 py-12">
        <form
          onSubmit={handleSubmit}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-cardHover w-full max-w-md p-6 h-fit self-start sm:self-center"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif font-bold text-ink">Invite to fund</h2>
            <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-[12px] text-muted mt-1.5">
            They'll be added when they sign in with this email. Magic link or password — both work.
          </p>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1 inline-flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Email
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="analyst@fund.com"
                className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              />
            </label>

            <label className="block">
              <span className="block text-[10px] font-semibold text-ink tracking-[0.14em] uppercase mb-1 inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> Role
              </span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RoleValue)}
                className="w-full h-10 px-3 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="mt-4 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="gold" size="sm" className="gap-1.5" disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {pending ? "Inviting…" : "Send invitation"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

function ScopeModal({
  member, companies, onClose, onSaved,
}: {
  member: OrgMember;
  companies: CompanyOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unrestricted, setUnrestricted] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pending, onClose]);

  // Load current access on open
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getMemberCompanyAccess(member.id);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      if (res.companyIds.length === 0) {
        setUnrestricted(true);
        setSelected(new Set());
      } else {
        setUnrestricted(false);
        setSelected(new Set(res.companyIds));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [member.id]);

  const toggle = (cid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid); else next.add(cid);
      return next;
    });
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const list = unrestricted ? [] : Array.from(selected);
      const res = await setMemberCompanyAccess(member.id, list);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved();
    });
  };

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[1000] bg-navy/40 overflow-y-auto"
      onClick={() => !pending && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-screen w-full flex justify-center px-4 py-12">
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-cardHover w-full max-w-md p-6 h-fit self-start sm:self-center"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-bold text-ink">Company access</h2>
              <p className="text-[11px] text-muted mt-0.5">{member.name ?? member.email}</p>
            </div>
            <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="mt-6 text-[12px] text-muted inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading current access…
            </div>
          ) : (
            <>
              <label className="mt-5 flex items-center gap-2 text-[13px] text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={unrestricted}
                  onChange={(e) => setUnrestricted(e.target.checked)}
                  className="h-4 w-4 rounded text-teal"
                />
                <span>
                  <span className="font-medium">Full access</span>
                  <span className="text-muted"> · sees every company in the fund</span>
                </span>
              </label>

              {!unrestricted && (
                <div className="mt-3">
                  <div className="text-[11px] text-muted mb-2">
                    Pick the companies this member can see. {selected.size} of {companies.length} selected.
                  </div>
                  <div className="max-h-72 overflow-auto rounded-md border border-line bg-paper divide-y divide-line">
                    {companies.length === 0 && (
                      <div className="px-3 py-4 text-[12px] text-muted">No companies in this fund yet.</div>
                    )}
                    {companies.map((c) => {
                      const checked = selected.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggle(c.id)}
                          className={cn(
                            "w-full text-left px-3 py-2 flex items-center gap-2 text-[12px] hover:bg-paper2",
                            checked && "bg-teal-50"
                          )}
                        >
                          <span
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                              checked ? "bg-teal border-teal" : "border-line bg-white"
                            )}
                          >
                            {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </span>
                          <span className="text-ink">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 text-[12px] text-coral bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="button" variant="gold" size="sm" className="gap-1.5" onClick={save} disabled={pending || loading}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {pending ? "Saving…" : "Save access"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
