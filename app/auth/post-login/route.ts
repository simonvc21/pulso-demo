import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${url.origin}/login`);
  }

  // Honor explicit ?next if it's a safe internal path
  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${url.origin}${next}`);
  }

  const { data: row } = await supabase
    .from("users")
    .select("role, organization_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = row?.role ?? "viewer";
  // No fund yet → onboarding wizard.
  if (!row?.organization_id) {
    return NextResponse.redirect(`${url.origin}/onboarding`);
  }
  const dest = role === "lp" ? "/lp" : "/dashboard";
  return NextResponse.redirect(`${url.origin}${dest}`);
}
