import { getCompanyOptions, listOrgMetricDefinitions } from "@/lib/dashboard-data";
import { FormBuilder } from "../form-builder";

export const dynamic = "force-dynamic";

export default async function NewFormPage() {
  const [companies, metricDefinitions] = await Promise.all([
    getCompanyOptions(),
    listOrgMetricDefinitions(),
  ]);
  return <FormBuilder mode="create" companies={companies} metricDefinitions={metricDefinitions} />;
}
