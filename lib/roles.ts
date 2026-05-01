// Single source of truth for user roles inside a fund. The DB stores
// the value as `text`; this list is what the UI shows and what the
// server actions accept.

export const FUND_ROLES = [
  { value: "gp",                label: "General Partner",      tone: "gold"    },
  { value: "managing_partner",  label: "Managing Partner",     tone: "gold"    },
  { value: "partner",           label: "Partner",              tone: "navy"    },
  { value: "principal",         label: "Principal",            tone: "navy"    },
  { value: "vp",                label: "Vice President",       tone: "teal"    },
  { value: "associate",         label: "Associate",            tone: "teal"    },
  { value: "analyst",           label: "Analyst",              tone: "teal"    },
  { value: "advisor",           label: "Advisor",              tone: "default" },
  { value: "viewer",            label: "Viewer",               tone: "default" },
] as const;

export type FundRole = (typeof FUND_ROLES)[number]["value"];

// Roles that are allowed to invite, change roles, and remove other
// members. Mirrors the DB policy users_update_admin.
export const ADMIN_ROLES: ReadonlySet<FundRole> = new Set([
  "gp",
  "managing_partner",
  "partner",
]);

export function isAdminRole(role: string | null | undefined): boolean {
  return role != null && ADMIN_ROLES.has(role as FundRole);
}

export function roleLabel(role: string): string {
  return FUND_ROLES.find((r) => r.value === role)?.label
    ?? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function roleTone(role: string): "gold" | "navy" | "teal" | "default" {
  return FUND_ROLES.find((r) => r.value === role)?.tone ?? "default";
}

// LP / founder are special non-fund roles handled in different surfaces.
// Keep them out of FUND_ROLES so the team picker doesn't offer them.
export const NON_FUND_ROLES = ["lp", "founder"] as const;
