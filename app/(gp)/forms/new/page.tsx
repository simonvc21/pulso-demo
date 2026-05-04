import { getCompanyOptions } from "@/lib/dashboard-data";
import { FormBuilder } from "../form-builder";

export const dynamic = "force-dynamic";

export default async function NewFormPage() {
  const companies = await getCompanyOptions();
  return <FormBuilder mode="create" companies={companies} />;
}
