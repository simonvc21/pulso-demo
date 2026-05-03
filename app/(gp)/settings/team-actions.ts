"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FUND_ROLES, type FundRole } from "@/lib/roles";

const VALID_ROLES = FUND_ROLES.map((r) => r.value) as readonly FundRole[];
type Role = FundRole;

type Result<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string };

async function requireGpOrg() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const { data: row } = await supabase
    .from("users")
    .select("id, organization_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!row?.organization_id) {
    return { ok: false as const, error: "No fund assigned" };
  }
  // For now anyone authenticated in the org can manage team. Tighten later.
  return { ok: true as const, supabase, organizationId: row.organization_id, userId: row.id };
}

export async function inviteUser(input: {
  email: string;
  role: Role;
}): Promise<Result> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "Valid email required" };
  if (!VALID_ROLES.includes(input.role)) return { ok: false, error: "Invalid role" };

  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase, organizationId, userId } = ctx;

  // Skip if there's already a pending invitation for this email + org
  const { data: existing } = await supabase
    .from("user_invitations")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "Invitation already pending for this email" };
  }

  // Skip if the user is already a member
  const { data: existingMember } = await supabase
    .from("users")
    .select("id")
    .eq("organization_id", organizationId)
    .ilike("email", email)
    .maybeSingle();
  if (existingMember) {
    return { ok: false, error: "User is already a member of this fund" };
  }

  const { error } = await supabase.from("user_invitations").insert({
    organization_id: organizationId,
    email,
    role: input.role,
    invited_by: userId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function revokeInvitation(invitationId: string): Promise<Result> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("user_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function updateMemberRole(memberId: string, role: Role): Promise<Result> {
  if (!VALID_ROLES.includes(role)) return { ok: false, error: "Invalid role" };

  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Don't let users demote themselves accidentally — that'd lock them out.
  if (memberId === ctx.userId) {
    return { ok: false, error: "You can't change your own role" };
  }

  const { error } = await ctx.supabase
    .from("users")
    .update({ role })
    .eq("id", memberId)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Per-company access for analyst/viewer roles
// ---------------------------------------------------------------------------

export async function getMemberCompanyAccess(memberId: string): Promise<{ ok: true; companyIds: string[] } | { ok: false; error: string }> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  // Confirm member belongs to the same org (RLS does this too).
  const { data: member } = await ctx.supabase
    .from("users")
    .select("id")
    .eq("id", memberId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!member) return { ok: false, error: "Member not found in this fund" };

  const { data, error } = await ctx.supabase
    .from("user_company_access")
    .select("company_id")
    .eq("user_id", memberId);
  if (error) return { ok: false, error: error.message };

  return { ok: true, companyIds: (data ?? []).map((r) => r.company_id) };
}

/** Replaces the full set of granted companies for a member. Pass [] to
 *  reset to "full org access" (no rows = default unrestricted). */
export async function setMemberCompanyAccess(memberId: string, companyIds: string[]): Promise<Result> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (memberId === ctx.userId) {
    return { ok: false, error: "You can't restrict your own access" };
  }

  // Confirm member is in the same org
  const { data: member } = await ctx.supabase
    .from("users")
    .select("id, role")
    .eq("id", memberId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!member) return { ok: false, error: "Member not found in this fund" };

  // Confirm every company belongs to the same org (defense in depth)
  if (companyIds.length > 0) {
    const { data: validCompanies } = await ctx.supabase
      .from("companies")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .in("id", companyIds);
    const validSet = new Set((validCompanies ?? []).map((c) => c.id));
    const allValid = companyIds.every((id) => validSet.has(id));
    if (!allValid) return { ok: false, error: "Some companies are not in this fund" };
  }

  // Replace atomically: delete then insert
  const { error: delErr } = await ctx.supabase
    .from("user_company_access")
    .delete()
    .eq("user_id", memberId);
  if (delErr) return { ok: false, error: delErr.message };

  if (companyIds.length > 0) {
    const { error: insErr } = await ctx.supabase
      .from("user_company_access")
      .insert(companyIds.map((cid) => ({ user_id: memberId, company_id: cid })));
    if (insErr) return { ok: false, error: insErr.message };
  }

  revalidatePath("/settings/team");
  return { ok: true };
}

export async function removeMember(memberId: string): Promise<Result> {
  const ctx = await requireGpOrg();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  if (memberId === ctx.userId) {
    return { ok: false, error: "You can't remove yourself" };
  }

  // We don't delete the auth.user (Supabase Auth manages those); we just
  // null the org link so the next time they log in they'll land in the
  // viewer/no-org state.
  const { error } = await ctx.supabase
    .from("users")
    .update({ organization_id: null, role: "viewer" })
    .eq("id", memberId)
    .eq("organization_id", ctx.organizationId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}
