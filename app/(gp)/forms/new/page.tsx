import { createClient } from "@/lib/supabase/server";
import { FormBuilder } from "../form-builder";

export const dynamic = "force-dynamic";

export default async function NewFormPage() {
  const supabase = createClient();
  const { count } = await supabase
    .from("companies")
    .select("id", { count: "exact", head: true });

  return <FormBuilder mode="create" recipientCount={count ?? 0} />;
}
