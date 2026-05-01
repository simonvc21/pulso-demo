import type { Company, Fund, FormTemplate, LP, QuarterMetric } from "./types";

export const fund: Fund = {
  name: "Patagonia Fund I",
  vintage: 2023,
  size: 80_000_000,
  deployed: 48_200_000,
  companies: 8,
  currency: "USD",
};

const quarters = ["Q2 2024", "Q3 2024", "Q4 2024", "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026"];

function series(start: number, growthRange: [number, number]): number[] {
  const out = [start];
  for (let i = 1; i < quarters.length; i++) {
    const g = growthRange[0] + Math.random() * (growthRange[1] - growthRange[0]);
    out.push(Math.round(out[i - 1] * (1 + g)));
  }
  return out;
}

function metrics(args: { arr: number[]; burn: number[]; cash: number[]; headcount: number[]; revenue: number[] }): QuarterMetric[] {
  return quarters.map((q, i) => ({
    quarter: q,
    arr: args.arr[i],
    burn: args.burn[i],
    cash: args.cash[i],
    headcount: args.headcount[i],
    revenue: args.revenue[i],
  }));
}

export const companies: Company[] = [
  {
    slug: "vextra",
    name: "Vextra",
    sector: "Fintech",
    country: "MX",
    invested: 8_000_000,
    ownership: 12.5,
    stage: "Series A",
    status: "healthy",
    founder: { name: "Ana Reyes", email: "ana@vextra.mx", role: "CEO & Co-founder" },
    description: "Embedded credit infrastructure for LATAM SMB platforms.",
    lastUpdate: "2 days ago",
    metrics: metrics({
      arr:       [3_400_000, 4_800_000, 6_500_000, 8_400_000, 9_900_000, 11_100_000, 11_900_000, 12_300_000],
      burn:      [320_000, 380_000, 420_000, 470_000, 510_000, 560_000, 590_000, 620_000],
      cash:      [12_000_000, 11_200_000, 10_300_000, 9_400_000, 8_500_000, 7_500_000, 6_700_000, 6_000_000],
      headcount: [22, 28, 34, 41, 48, 54, 58, 62],
      revenue:   [820_000, 1_180_000, 1_580_000, 2_050_000, 2_410_000, 2_700_000, 2_890_000, 3_000_000],
    }),
  },
  {
    slug: "lumen",
    name: "Lumen",
    sector: "SaaS",
    country: "BR",
    invested: 6_500_000,
    ownership: 10.0,
    stage: "Series A",
    status: "healthy",
    founder: { name: "Pedro Almeida", email: "pedro@lumen.com.br", role: "CEO" },
    description: "Workflow automation for Brazilian accounting firms (Contabilizei integration).",
    lastUpdate: "4 days ago",
    metrics: metrics({
      arr:       [2_100_000, 3_000_000, 4_200_000, 5_400_000, 6_400_000, 7_400_000, 8_100_000, 8_700_000],
      burn:      [240_000, 270_000, 290_000, 310_000, 340_000, 370_000, 390_000, 410_000],
      cash:      [9_500_000, 8_900_000, 8_100_000, 7_500_000, 6_800_000, 6_100_000, 5_500_000, 5_000_000],
      headcount: [18, 22, 26, 30, 34, 38, 41, 44],
      revenue:   [510_000, 730_000, 1_020_000, 1_320_000, 1_560_000, 1_810_000, 1_980_000, 2_120_000],
    }),
  },
  {
    slug: "mira",
    name: "Mira",
    sector: "Healthtech",
    country: "CL",
    invested: 5_000_000,
    ownership: 14.0,
    stage: "Seed",
    status: "healthy",
    founder: { name: "Camila Soto", email: "camila@mira.health", role: "CEO" },
    description: "AI-driven mental health platform for Latin American employers.",
    lastUpdate: "1 week ago",
    metrics: metrics({
      arr:       [800_000, 1_400_000, 2_300_000, 3_200_000, 4_200_000, 5_100_000, 5_800_000, 6_200_000],
      burn:      [180_000, 210_000, 240_000, 270_000, 300_000, 330_000, 350_000, 370_000],
      cash:      [6_400_000, 5_900_000, 5_300_000, 4_700_000, 4_100_000, 3_500_000, 3_000_000, 2_500_000],
      headcount: [14, 17, 20, 24, 27, 30, 32, 34],
      revenue:   [200_000, 350_000, 580_000, 800_000, 1_050_000, 1_280_000, 1_450_000, 1_550_000],
    }),
  },
  {
    slug: "roca",
    name: "Roca",
    sector: "Logistics",
    country: "CO",
    invested: 7_200_000,
    ownership: 11.0,
    stage: "Series A",
    status: "healthy",
    founder: { name: "Sebastián Vargas", email: "seb@roca.co", role: "CEO" },
    description: "Last-mile logistics network for e-commerce in the Andean region.",
    lastUpdate: "3 days ago",
    metrics: metrics({
      arr:       [1_900_000, 2_500_000, 3_300_000, 4_000_000, 4_500_000, 4_800_000, 5_000_000, 5_100_000],
      burn:      [290_000, 320_000, 360_000, 390_000, 420_000, 440_000, 460_000, 480_000],
      cash:      [8_800_000, 8_100_000, 7_300_000, 6_500_000, 5_700_000, 4_900_000, 4_200_000, 3_500_000],
      headcount: [24, 29, 35, 40, 44, 47, 49, 51],
      revenue:   [475_000, 625_000, 825_000, 1_000_000, 1_125_000, 1_200_000, 1_250_000, 1_275_000],
    }),
  },
  {
    slug: "brio",
    name: "Brio",
    sector: "Climate",
    country: "MX",
    invested: 4_500_000,
    ownership: 13.5,
    stage: "Seed",
    status: "critical",
    flag: "Runway < 9 mo",
    founder: { name: "Diego Mendoza", email: "diego@brio.energy", role: "CEO" },
    description: "Distributed solar microgrids for Mexican commercial customers.",
    lastUpdate: "2 weeks ago",
    metrics: metrics({
      arr:       [1_200_000, 1_800_000, 2_500_000, 3_100_000, 3_700_000, 4_200_000, 4_600_000, 4_800_000],
      burn:      [380_000, 420_000, 460_000, 500_000, 540_000, 580_000, 620_000, 650_000],
      cash:      [7_200_000, 6_300_000, 5_400_000, 4_500_000, 3_700_000, 2_900_000, 2_200_000, 1_500_000],
      headcount: [20, 24, 28, 32, 36, 39, 41, 43],
      revenue:   [300_000, 450_000, 625_000, 775_000, 925_000, 1_050_000, 1_150_000, 1_200_000],
    }),
  },
  {
    slug: "solar-io",
    name: "Solar.io",
    sector: "Climate",
    country: "BR",
    invested: 3_500_000,
    ownership: 9.5,
    stage: "Seed",
    status: "watch",
    flag: "Cash burn ↑ 28%",
    founder: { name: "Fernanda Lima", email: "fer@solar.io", role: "CEO" },
    description: "Solar lease marketplace for Brazilian homeowners.",
    lastUpdate: "5 days ago",
    metrics: metrics({
      arr:       [900_000, 1_300_000, 1_800_000, 2_300_000, 2_800_000, 3_100_000, 3_400_000, 3_600_000],
      burn:      [220_000, 250_000, 280_000, 310_000, 340_000, 380_000, 430_000, 480_000],
      cash:      [5_800_000, 5_300_000, 4_700_000, 4_100_000, 3_500_000, 2_900_000, 2_300_000, 1_700_000],
      headcount: [16, 19, 22, 25, 27, 29, 30, 31],
      revenue:   [225_000, 325_000, 450_000, 575_000, 700_000, 775_000, 850_000, 900_000],
    }),
  },
  {
    slug: "caja",
    name: "Caja",
    sector: "Fintech",
    country: "PE",
    invested: 2_800_000,
    ownership: 12.0,
    stage: "Seed",
    status: "watch",
    flag: "Q1 form not submitted",
    founder: { name: "Mateo Ríos", email: "mateo@caja.pe", role: "CEO" },
    description: "Neobank for Peruvian micro-businesses.",
    lastUpdate: "3 weeks ago",
    metrics: metrics({
      arr:       [400_000, 800_000, 1_200_000, 1_700_000, 2_100_000, 2_500_000, 2_800_000, 2_900_000],
      burn:      [160_000, 180_000, 200_000, 220_000, 240_000, 260_000, 270_000, 280_000],
      cash:      [4_200_000, 3_900_000, 3_500_000, 3_100_000, 2_700_000, 2_300_000, 2_000_000, 1_700_000],
      headcount: [12, 14, 16, 18, 20, 21, 22, 23],
      revenue:   [100_000, 200_000, 300_000, 425_000, 525_000, 625_000, 700_000, 725_000],
    }),
  },
  {
    slug: "norte",
    name: "Norte",
    sector: "Marketplace",
    country: "AR",
    invested: 2_200_000,
    ownership: 10.5,
    stage: "Seed",
    status: "critical",
    flag: "ARR ↓ 12% QoQ",
    founder: { name: "Valentina Costa", email: "vale@norte.com.ar", role: "CEO" },
    description: "B2B marketplace for restaurant supply in Argentina.",
    lastUpdate: "1 week ago",
    metrics: metrics({
      arr:       [600_000, 900_000, 1_300_000, 1_700_000, 2_000_000, 2_100_000, 1_950_000, 1_700_000],
      burn:      [140_000, 160_000, 180_000, 200_000, 210_000, 220_000, 220_000, 215_000],
      cash:      [3_400_000, 3_100_000, 2_700_000, 2_300_000, 1_900_000, 1_500_000, 1_200_000, 1_000_000],
      headcount: [10, 12, 14, 16, 17, 18, 18, 17],
      revenue:   [150_000, 225_000, 325_000, 425_000, 500_000, 525_000, 487_000, 425_000],
    }),
  },
];

export const formTemplates: FormTemplate[] = [
  {
    id: "q1-2026-financials",
    name: "Q1 2026 Financials",
    cadence: "quarterly",
    sentToCount: 8,
    responseRate: 87.5,
    lastSent: "Apr 5, 2026",
    fields: [
      { id: "f1", type: "currency", label: "Quarterly Revenue (USD)", required: true, group: "P&L" },
      { id: "f2", type: "currency", label: "Annual Recurring Revenue (USD)", required: true, group: "P&L" },
      { id: "f3", type: "currency", label: "Monthly Burn Rate (USD)", required: true, group: "P&L" },
      { id: "f4", type: "currency", label: "Cash on Hand (USD)", required: true, group: "Balance Sheet" },
      { id: "f5", type: "number", label: "Headcount (FTE)", required: true, group: "Team" },
      { id: "f6", type: "percent", label: "Gross Margin", group: "P&L" },
      { id: "f7", type: "longtext", label: "What were the biggest wins this quarter?", group: "Narrative" },
      { id: "f8", type: "longtext", label: "What are the biggest risks for next quarter?", group: "Narrative" },
    ],
  },
  {
    id: "monthly-pulse",
    name: "Monthly Pulse Check",
    cadence: "monthly",
    sentToCount: 8,
    responseRate: 100,
    lastSent: "Apr 28, 2026",
    fields: [
      { id: "m1", type: "currency", label: "MRR (USD)", required: true },
      { id: "m2", type: "currency", label: "Cash on Hand (USD)", required: true },
      { id: "m3", type: "select", label: "Hiring status", options: ["Hiring", "Hold", "Reducing"] },
      { id: "m4", type: "longtext", label: "Anything urgent we should know?" },
    ],
  },
  {
    id: "annual-board",
    name: "Annual Board Pack",
    cadence: "annual",
    sentToCount: 8,
    responseRate: 100,
    lastSent: "Jan 15, 2026",
    fields: [],
  },
];

export const lps: LP[] = [
  { id: "lp-1", name: "Familia Echeverría Office", type: "Family Office", commitment: 12_000_000, country: "MX" },
  { id: "lp-2", name: "Andina Capital Partners", type: "Fund of Funds", commitment: 20_000_000, country: "CL" },
  { id: "lp-3", name: "Itaú Growth Endowment", type: "Institutional", commitment: 25_000_000, country: "BR" },
  { id: "lp-4", name: "Bogotá Family Trust", type: "Family Office", commitment: 8_000_000, country: "CO" },
  { id: "lp-5", name: "Carlos Mendoza", type: "Individual", commitment: 5_000_000, country: "MX" },
  { id: "lp-6", name: "Patagonia Sovereign Pool", type: "Institutional", commitment: 10_000_000, country: "AR" },
];

// Aggregate KPIs derived from data
export function fundKpis() {
  const latest = (c: Company) => c.metrics[c.metrics.length - 1];
  const prev = (c: Company) => c.metrics[c.metrics.length - 2];
  const arrTotal = companies.reduce((a, c) => a + latest(c).arr, 0);
  const arrPrev  = companies.reduce((a, c) => a + prev(c).arr, 0);
  const arrYoY   = companies.reduce((a, c) => a + (c.metrics[c.metrics.length - 5]?.arr || 0), 0);
  const cash     = companies.reduce((a, c) => a + latest(c).cash, 0);
  const burn     = companies.reduce((a, c) => a + latest(c).burn, 0);
  const headcount = companies.reduce((a, c) => a + latest(c).headcount, 0);
  // Avg ARR YoY growth (weighted by ARR)
  const yoyGrowth = arrYoY > 0 ? ((arrTotal - arrYoY) / arrYoY) * 100 : 0;
  const runwayMonths = burn > 0 ? cash / burn : 0;
  const qoqArrGrowth = arrPrev > 0 ? ((arrTotal - arrPrev) / arrPrev) * 100 : 0;
  return { arrTotal, arrPrev, qoqArrGrowth, yoyGrowth, cash, burn, headcount, runwayMonths };
}

export const watchList = companies
  .filter(c => c.status === "critical" || c.status === "watch")
  .sort((a, b) => (a.status === "critical" ? -1 : 1));
