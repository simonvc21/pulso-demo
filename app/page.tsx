import Link from "next/link";
import {
  Zap,
  Mail,
  FileText,
  Table2,
  Send,
  Bot,
  LineChart,
  Share2,
  Settings,
  Inbox,
  Brain,
  Users,
  Globe2,
  ArrowRight,
  Check,
  Minus,
} from "lucide-react";

export const metadata = {
  title: "Pulso · The portfolio OS for LATAM venture capital",
  description:
    "Automated data collection. Real-time, customizable dashboards. LP-ready in one click.",
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <HowItWorks />
      <ProductPreview />
      <WhyNow />
      <Pricing />
      <Competition />
      <VisionCTA />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 bg-navy text-white border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-gold flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-navy" strokeWidth={2.5} fill="currentColor" />
          </div>
          <span className="text-[11px] tracking-[0.18em] font-semibold">PULSO</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-white/70">
          <a href="#problem" className="hover:text-white">Problem</a>
          <a href="#solution" className="hover:text-white">Solution</a>
          <a href="#product" className="hover:text-white">Product</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
        </nav>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 bg-gold text-navy text-sm font-semibold px-3.5 py-1.5 rounded-md hover:bg-gold-600 transition"
        >
          See live demo
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-navy text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gold" />
      <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
        <div className="mb-10 inline-flex items-center gap-2 text-xs tracking-[0.16em] font-semibold text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          PORTFOLIO OS · LATAM VENTURE CAPITAL
        </div>
        <h1 className="serif font-bold text-7xl md:text-9xl leading-[0.95] tracking-tight">
          Pulso
        </h1>
        <p className="serif italic text-xl md:text-2xl mt-8 text-white/85 max-w-2xl">
          The portfolio OS for LATAM venture capital.
        </p>
        <p className="mt-6 text-base md:text-lg text-white/60 max-w-2xl">
          Automated data collection. Real-time, customizable dashboards. LP-ready in one click.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-gold text-navy font-semibold px-5 py-3 rounded-md hover:bg-gold-600 transition"
          >
            Explore the live demo
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="mailto:simon.villena2010@gmail.com"
            className="inline-flex items-center gap-2 text-white/85 hover:text-white font-medium px-5 py-3 rounded-md border border-white/15 hover:border-white/30 transition"
          >
            <Mail className="h-4 w-4" />
            Talk to the founder
          </a>
        </div>
        <div className="mt-16 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-sm text-white/60">
          <div>
            <span className="text-white font-semibold">Simon Villena</span> · Founder &amp; CEO ·{" "}
            <a href="mailto:simon.villena2010@gmail.com" className="hover:text-white">
              simon.villena2010@gmail.com
            </a>
          </div>
          <div className="text-gold font-semibold tracking-wider text-xs">YC S26 — SEED</div>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-xs tracking-[0.16em] font-semibold text-gold-600 mb-4">
      {number} · {label}
    </div>
  );
}

function Problem() {
  const pains = [
    {
      icon: Mail,
      title: "50+ scattered email threads",
      body: "Analysts chase founders by email every quarter, in 12 different languages of Excel.",
    },
    {
      icon: FileText,
      title: "PDFs, screenshots, WhatsApp",
      body: "Every founder reports differently. Nothing is normalized. Nothing is queryable.",
    },
    {
      icon: Table2,
      title: "2 weeks of copy-paste",
      body: "Junior analysts re-type metrics into a master Sheet. Errors compound. LPs wait.",
    },
  ];
  return (
    <section id="problem" className="bg-paper">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <SectionLabel number="01" label="PROBLEM" />
        <h2 className="serif font-bold text-4xl md:text-5xl leading-tight tracking-tight max-w-3xl">
          LATAM VCs are flying blind on their own portfolios.
        </h2>
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          <div className="lg:col-span-2 space-y-8">
            {pains.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-5">
                <div className="shrink-0 h-12 w-12 rounded-full bg-white border border-line flex items-center justify-center">
                  <Icon className="h-5 w-5 text-coral" />
                </div>
                <div>
                  <div className="font-semibold text-lg">{title}</div>
                  <p className="text-muted mt-1.5">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-navy text-white rounded-lg p-8 border-l-4 border-gold">
            <div className="serif font-bold text-7xl leading-none">30%</div>
            <div className="mt-4 text-white/85">of investment hours go to manual reporting</div>
            <div className="mt-6 text-xs italic text-white/55">
              Source: Pulso interviews with 14 LATAM emerging managers, 2025–26
            </div>
          </div>
        </div>
        <div className="mt-12 italic text-coral font-semibold">
          LPs get reports 60+ days after quarter close.
        </div>
      </div>
    </section>
  );
}

function Solution() {
  const pillars = [
    {
      icon: Send,
      title: "Custom forms, automated",
      body: "Build any metric set per company. Schedule sends. Auto-reminders. LATAM-friendly multi-currency.",
    },
    {
      icon: Bot,
      title: "AI-first ingestion",
      body: "Founders can also send a PDF, Excel, or QuickBooks/Contabilizei feed. Pulso parses it.",
    },
    {
      icon: LineChart,
      title: "Live, customizable dashboards",
      body: "Drag-drop fields, charts, colors. Real-time KPIs across the whole fund. Multi-currency, normalized.",
    },
    {
      icon: Share2,
      title: "LP-ready in one click",
      body: "Branded, watermarked, view-only links. Or scheduled PDF reports. LPs see what you choose.",
    },
  ];
  return (
    <section id="solution" className="bg-paper2">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <SectionLabel number="02" label="SOLUTION" />
        <h2 className="serif font-bold text-4xl md:text-5xl leading-tight tracking-tight max-w-3xl">
          Pulso turns portfolio reporting into one continuous flow.
        </h2>
        <p className="serif italic text-muted mt-4 text-lg">
          Configure once. Pulso collects, normalizes, visualizes, and shares — automatically.
        </p>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-5">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-white rounded-lg p-7 shadow-card border-l-4 border-teal"
            >
              <div className="h-11 w-11 rounded-full bg-teal-50 flex items-center justify-center mb-5">
                <Icon className="h-5 w-5 text-teal-600" />
              </div>
              <div className="font-semibold text-lg">{title}</div>
              <p className="text-muted mt-2">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Settings,
      title: "Configure",
      body: "Custom metrics, cadence, currencies, FX rules — per company.",
    },
    {
      icon: Inbox,
      title: "Collect",
      body: "Pulso sends, reminds, escalates. Founders fill once or upload PDFs.",
    },
    {
      icon: Brain,
      title: "Synthesize",
      body: "AI normalizes financials. Validates outliers. Asks founders to confirm.",
    },
    {
      icon: Users,
      title: "Share",
      body: "Live dashboards for partners. Curated, watermarked views for LPs.",
    },
  ];
  return (
    <section className="bg-paper">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <SectionLabel number="03" label="HOW IT WORKS" />
        <h2 className="serif font-bold text-4xl md:text-5xl leading-tight tracking-tight">
          Four steps. Zero spreadsheets.
        </h2>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className="bg-white rounded-lg p-7 border border-line shadow-card relative"
            >
              <div className="h-9 w-9 rounded-full bg-navy text-gold serif font-bold text-base flex items-center justify-center">
                {i + 1}
              </div>
              <s.icon className="h-7 w-7 text-navy mt-6" strokeWidth={1.75} />
              <div className="font-semibold text-lg mt-4">{s.title}</div>
              <p className="text-muted text-sm mt-2">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 bg-navy text-white rounded-lg p-6 border-l-4 border-gold flex flex-wrap items-center gap-3">
          <span className="text-gold font-semibold tracking-wider text-xs">OUTCOME</span>
          <span className="text-white/90">
            LP-ready reports go from 60 days to same-day. Analysts focus on judgment, not data entry.
          </span>
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  const kpis = [
    { label: "Total Invested", value: "$48.2M", delta: "+ $4.1M QoQ" },
    { label: "Portfolio Companies", value: "23", delta: "2 new in Q1" },
    { label: "Avg. ARR Growth", value: "118%", delta: "y/y, top quartile" },
    { label: "Burn-Adjusted Runway", value: "14.2 mo", delta: "− 1.8 mo QoQ" },
  ];
  const watch = [
    { name: "Brio", note: "Runway < 9 mo", color: "bg-coral" },
    { name: "Caja", note: "Q1 not submitted", color: "bg-gold" },
    { name: "Norte", note: "ARR ↓ 12% QoQ", color: "bg-coral" },
    { name: "Solar.io", note: "Cash burn ↑ 28%", color: "bg-gold" },
  ];
  const bars = [12.4, 8.6, 6.2, 5.0, 4.8, 3.7, 2.9, 1.8];
  const max = Math.max(...bars);
  return (
    <section id="product" className="bg-paper2">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <SectionLabel number="04" label="PRODUCT" />
        <h2 className="serif font-bold text-4xl md:text-5xl leading-tight tracking-tight">
          A live, customizable dashboard for every fund.
        </h2>
        <div className="mt-12 bg-white rounded-xl shadow-cardHover overflow-hidden border border-line">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-paper">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-coral/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-gold/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-teal/80" />
            </div>
            <div className="ml-3 text-xs text-muted">
              app.pulso.vc / Patagonia Fund I — Q1 2026 dashboard
            </div>
          </div>
          <div className="grid grid-cols-12">
            {/* Sidebar */}
            <div className="hidden md:flex flex-col col-span-3 lg:col-span-2 bg-navy text-white py-6 px-4 gap-1 text-sm">
              {[
                ["Overview", true],
                ["Companies", false],
                ["Metrics", false],
                ["Reports", false],
                ["LPs", false],
                ["Settings", false],
              ].map(([label, active]) => (
                <div
                  key={label as string}
                  className={
                    "px-3 py-2 rounded-md " +
                    (active
                      ? "bg-white/5 text-gold border-l-2 border-gold pl-2.5 font-semibold"
                      : "text-white/65")
                  }
                >
                  {label as string}
                </div>
              ))}
            </div>
            {/* Body */}
            <div className="col-span-12 md:col-span-9 lg:col-span-10 p-6 bg-white">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k) => (
                  <div key={k.label} className="border border-line rounded-lg p-4 bg-paper">
                    <div className="text-xs text-muted">{k.label}</div>
                    <div className="serif font-bold text-2xl mt-1">{k.value}</div>
                    <div className="text-xs italic text-muted mt-1.5">{k.delta}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
                <div className="lg:col-span-2 border border-line rounded-lg p-5 bg-white">
                  <div className="text-sm font-semibold">
                    Portfolio ARR by company — Q1 2026 (USD, normalized)
                  </div>
                  <div className="mt-5 h-44 flex items-end gap-3">
                    {bars.map((v, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                        <div
                          className="w-full bg-teal rounded-sm"
                          style={{ height: `${(v / max) * 100}%` }}
                        />
                        <div className="text-[10px] text-muted">{i + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-navy text-white rounded-lg p-5">
                  <div className="text-gold text-xs font-semibold tracking-wider">
                    COMPANIES NEEDING ATTENTION
                  </div>
                  <div className="mt-4 space-y-3">
                    {watch.map((w) => (
                      <div key={w.name} className="flex items-center gap-3 text-sm">
                        <div className={`h-2 w-2 rounded-full ${w.color}`} />
                        <div className="font-semibold w-16">{w.name}</div>
                        <div className="text-white/65 text-xs">{w.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm italic text-muted">
            Every field, color, and chart is configurable per fund.
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-navy text-white font-semibold px-4 py-2.5 rounded-md hover:bg-navy-700 transition text-sm"
          >
            Open the live demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhyNow() {
  const forces = [
    {
      stat: "4.5×",
      headline: "LATAM VC AUM growth, 2018→2024",
      body: "From ~$4B to $20B+ committed across the region. New fund formation at all-time highs (LAVCA, 2025).",
    },
    {
      stat: "2024",
      headline: "AI extraction crossed the bar",
      body: "LLMs now reliably parse founder PDFs, mixed-currency financials, and unstructured updates — what required humans is now infra.",
    },
    {
      stat: "60%",
      headline: "of new LATAM funds are sub-$100M AUM",
      body: "Emerging managers can't afford Standard Metrics or hire 3 analysts. They need a tool built for them — not a stripped-down enterprise SaaS.",
    },
  ];
  return (
    <section className="bg-paper">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <SectionLabel number="05" label="WHY NOW" />
        <h2 className="serif font-bold text-4xl md:text-5xl leading-tight tracking-tight">
          Three forces collide for the first time.
        </h2>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {forces.map((f) => (
            <div
              key={f.headline}
              className="bg-white rounded-lg p-7 border border-line shadow-card border-t-4 border-t-gold"
            >
              <div className="serif font-bold text-5xl text-navy">{f.stat}</div>
              <div className="font-semibold mt-5">{f.headline}</div>
              <p className="text-muted text-sm mt-3 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 italic text-coral font-semibold text-center">
          The opportunity to build the LATAM portfolio OS exists for ~24 months. Then incumbents arrive.
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const tiers = [
    {
      name: "Starter",
      sub: "Sub-$25M AUM",
      price: "$500",
      cadence: "/mo",
      features: [
        "Up to 10 portfolio companies",
        "Custom forms + AI ingestion",
        "Standard dashboards",
        "Quarterly LP report",
      ],
      featured: false,
    },
    {
      name: "Growth",
      sub: "$25M – $100M AUM",
      price: "$1.5K",
      cadence: "/mo",
      features: [
        "Up to 40 portfolio companies",
        "Multi-currency + FX automation",
        "Fully custom dashboards & branding",
        "Unlimited LP seats",
      ],
      featured: true,
    },
    {
      name: "Scale",
      sub: "$100M+ AUM / multi-fund",
      price: "$4K+",
      cadence: "/mo",
      features: [
        "Unlimited companies + funds",
        "Audit logs, SSO, role-based access",
        "API + data warehouse export",
        "Dedicated CSM",
      ],
      featured: false,
    },
  ];
  return (
    <section id="pricing" className="bg-paper2">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <SectionLabel number="06" label="PRICING" />
        <h2 className="serif font-bold text-4xl md:text-5xl leading-tight tracking-tight">
          SaaS by AUM. LPs are free. The fund pays.
        </h2>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                "rounded-lg p-8 flex flex-col " +
                (t.featured
                  ? "bg-navy text-white border-t-4 border-gold shadow-cardHover"
                  : "bg-white border border-line shadow-card")
              }
            >
              {t.featured && (
                <div className="text-gold text-xs font-semibold tracking-wider mb-3">
                  MOST POPULAR
                </div>
              )}
              <div className={"serif font-bold text-3xl " + (t.featured ? "" : "text-navy")}>
                {t.name}
              </div>
              <div className={"text-sm mt-1 " + (t.featured ? "text-white/65" : "text-muted")}>
                {t.sub}
              </div>
              <div className="mt-6 flex items-baseline gap-1.5">
                <div className="serif font-bold text-5xl">{t.price}</div>
                <div className={t.featured ? "text-white/65" : "text-muted"}>{t.cadence}</div>
              </div>
              <div
                className={
                  "h-px my-6 " + (t.featured ? "bg-white/10" : "bg-line")
                }
              />
              <ul className="space-y-3 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={
                        "h-4 w-4 mt-0.5 shrink-0 " +
                        (t.featured ? "text-gold" : "text-teal-600")
                      }
                      strokeWidth={2.5}
                    />
                    <span className={t.featured ? "text-white/90" : ""}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center text-sm italic text-muted">
          Blended ACV $24K · 95% gross margin · CAC payback 6 mo (target) · Net retention 130%
        </div>
      </div>
    </section>
  );
}

function Competition() {
  const rows: Array<[string, string, string, string, string]> = [
    ["Setup time", "—", "weeks", "months", "hours"],
    ["AI ingestion of PDFs", "—", "no", "partial", "yes"],
    ["LATAM-native (FX, locales)", "DIY", "limited", "no", "yes"],
    ["Customizable dashboards", "manual", "limited", "yes", "yes"],
    ["Built for emerging managers", "—", "no", "no", "yes"],
    ["Price (sub-$50M AUM)", "free (toil)", "$$$", "$$$$", "$"],
  ];
  const cell = (val: string, isPulso: boolean) => {
    if (val === "—") return <Minus className="h-4 w-4 text-muted/40 mx-auto" />;
    if (isPulso)
      return <span className="font-semibold text-teal-600">{val}</span>;
    return <span className="italic text-muted">{val}</span>;
  };
  return (
    <section className="bg-paper">
      <div className="max-w-6xl mx-auto px-6 py-24">
        <SectionLabel number="07" label="COMPETITION" />
        <h2 className="serif font-bold text-4xl md:text-5xl leading-tight tracking-tight">
          Built where the incumbents don&apos;t bother to land.
        </h2>
        <div className="mt-12 bg-white rounded-lg border border-line shadow-card overflow-hidden">
          <div className="grid grid-cols-5 text-sm">
            <div className="bg-paper2 p-4 font-semibold border-b border-line"></div>
            <div className="bg-paper2 p-4 text-center font-semibold border-b border-line">
              Excel / Sheets
            </div>
            <div className="bg-paper2 p-4 text-center font-semibold border-b border-line">
              Carta
            </div>
            <div className="bg-paper2 p-4 text-center font-semibold border-b border-line">
              Standard Metrics
            </div>
            <div className="bg-navy p-4 text-center font-semibold text-gold border-b border-line">
              Pulso
            </div>
            {rows.map((r, i) => (
              <div key={i} className="contents">
                <div className="p-4 border-b border-line text-muted">{r[0]}</div>
                <div className="p-4 text-center border-b border-line">{cell(r[1], false)}</div>
                <div className="p-4 text-center border-b border-line">{cell(r[2], false)}</div>
                <div className="p-4 text-center border-b border-line">{cell(r[3], false)}</div>
                <div className="p-4 text-center border-b border-line border-l-4 border-l-gold bg-paper">
                  {cell(r[4], true)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 text-sm italic text-muted">
          Standard Metrics &amp; Carta target $250M+ funds. We start where they won&apos;t and earn the right to move up.
        </div>
      </div>
    </section>
  );
}

function VisionCTA() {
  const phases = [
    {
      tag: "Year 1",
      title: "Win LATAM emerging VCs",
      body: "Become the default portfolio OS for sub-$100M AUM funds across MX, BR, CO, CL.",
    },
    {
      tag: "Year 2-3",
      title: "Expand into PE & family offices",
      body: "Same workflow, deeper data. Multi-fund consolidation. Institutional LP rooms.",
    },
    {
      tag: "Year 4+",
      title: "Capital markets infrastructure",
      body: "Cap tables, secondaries data, fund admin. The Carta of LATAM private capital.",
    },
  ];
  return (
    <section className="bg-navy text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gold" />
      <div className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-xs tracking-[0.16em] font-semibold text-gold mb-4">
          08 · VISION
        </div>
        <h2 className="serif font-bold text-4xl md:text-5xl leading-tight tracking-tight max-w-3xl">
          From portfolio reporting to the financial OS for LATAM private capital.
        </h2>
        <div className="mt-14 space-y-5">
          {phases.map((p) => (
            <div key={p.tag} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <div className="md:col-span-2">
                <span className="inline-block bg-gold text-navy font-semibold text-xs tracking-wider px-3 py-1.5 rounded">
                  {p.tag.toUpperCase()}
                </span>
              </div>
              <div className="md:col-span-10">
                <div className="font-semibold text-lg">{p.title}</div>
                <p className="text-white/65 mt-1.5">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-16 border-2 border-gold rounded-lg p-8">
          <div className="text-gold text-xs font-semibold tracking-wider">THE ASK</div>
          <p className="mt-3 text-lg text-white/90 leading-relaxed">
            Raising $1.5M seed at a $12M post — 18-month runway. Hire 2 engineers + 1 design partner success. 25 paying funds by EOY.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-gold text-navy font-semibold px-5 py-3 rounded-md hover:bg-gold-600 transition"
            >
              See the product live
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:simon.villena2010@gmail.com"
              className="inline-flex items-center gap-2 text-white/90 hover:text-white font-medium px-5 py-3 rounded-md border border-white/20 hover:border-white/40 transition"
            >
              <Mail className="h-4 w-4" />
              simon.villena2010@gmail.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-navy-700 text-white/60 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-full bg-gold flex items-center justify-center">
            <Zap className="h-3 w-3 text-navy" strokeWidth={2.5} fill="currentColor" />
          </div>
          <span className="text-[11px] tracking-[0.18em] font-semibold text-white">PULSO</span>
          <span className="ml-2 text-white/40">· The portfolio OS for LATAM venture capital</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Globe2 className="h-3.5 w-3.5" />
          <span>MX · BR · CO · CL</span>
          <span className="mx-2 text-white/30">·</span>
          <span>YC S26</span>
        </div>
      </div>
    </footer>
  );
}
