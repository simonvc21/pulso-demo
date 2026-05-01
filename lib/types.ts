export type Status = "healthy" | "watch" | "critical" | "no-data";

export type Sector =
  | "Fintech"
  | "SaaS"
  | "Marketplace"
  | "Healthtech"
  | "Climate"
  | "Logistics";

export type Country = "MX" | "BR" | "CO" | "CL" | "AR" | "PE";

export type FormFieldType =
  | "currency"
  | "number"
  | "percent"
  | "text"
  | "longtext"
  | "select"
  | "date";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
  unit?: string;
  group?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  cadence: "monthly" | "quarterly" | "annual" | "ad-hoc";
  fields: FormField[];
  sentToCount?: number;
  responseRate?: number;
  lastSent?: string;
}

export interface QuarterMetric {
  quarter: string; // "Q1 2025"
  arr: number;     // USD
  burn: number;    // monthly USD
  cash: number;    // USD
  headcount: number;
  revenue: number; // quarterly
}

export interface Company {
  slug: string;
  name: string;
  sector: Sector;
  country: Country;
  invested: number;       // USD
  ownership: number;      // % (0-100)
  stage: "Pre-seed" | "Seed" | "Series A" | "Series B";
  status: Status;
  founder: { name: string; email: string; role: string };
  metrics: QuarterMetric[];
  lastUpdate: string;     // human readable
  flag?: string;          // short alert msg
  description: string;
}

export interface Fund {
  name: string;
  vintage: number;
  size: number;           // total fund size USD
  deployed: number;       // total invested USD
  companies: number;
  currency: "USD";
}

export interface LP {
  id: string;
  name: string;
  type: "Family Office" | "Institutional" | "Fund of Funds" | "Individual";
  commitment: number;
  country: Country;
}
