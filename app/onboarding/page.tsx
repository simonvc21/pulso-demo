import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./wizard";
import { getServerLocale } from "@/lib/i18n-server";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const { data: profile } = await supabase
    .from("users")
    .select("organization_id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Already onboarded — send them to the right home.
  if (profile?.organization_id) {
    if (profile.role === "lp") redirect("/lp");
    redirect("/dashboard");
  }

  const dict = getDictionary(getServerLocale()).onboarding ?? {};

  return (
    <OnboardingWizard
      userEmail={user.email ?? ""}
      userName={(user.user_metadata?.name as string | undefined) ?? null}
      dict={dict}
    />
  );
}
