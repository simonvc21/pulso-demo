# Pulso — Roadmap a MVP completo

> Estado actual: demo click-through en Next.js 14 con datos mock (lib/mock-data.ts). Sin backend, sin auth, sin persistencia.
> >
> >> Objetivo MVP: que un fondo real (Patagonia Fund I como pilot) pueda *usar* Pulso de verdad — invitar founders, recibir métricas reales, compartir con LPs.
> >>
> >> ---
> >>
> >> ## Orden recomendado (de menor a mayor dependencia)
> >>
> >> La regla: cada capa desbloquea la siguiente. Saltarse una rompe la cadena.
> >>
> >> ### Fase 1 — Auth + Persistencia (semana 1–2)
> >>
> >> **Por qué primero:** sin esto no hay producto. Todo lo demás (AI, emails, LP shares) asume que existe un usuario logueado y datos persistidos por fondo.
> >>
> >> **1.1 Clerk para auth (1–2 días)**
> >> - Multi-tenant desde día 1: cada fondo es una organization en Clerk
> >> - - GP / Analyst / LP roles via Clerk metadata
> >>   - - Login con Google + email magic link (los GPs latam usan Google Workspace)
> >>     - - Por qué Clerk vs Auth0: setup en 30 min, UI lista, free tier hasta 10K MAUs
> >>       - - middleware.ts que protege /dashboard, /companies, /forms, /lps
> >>        
> >>         - **1.2 Supabase (Postgres) + Drizzle ORM (3–4 días)**
> >>         - - Por qué Supabase: hosted Postgres + Row Level Security gratis, mismo stack que Vercel ya tienes
> >>           - - Por qué Drizzle vs Prisma: type-safe sin generación, edge-compatible, más rápido de migrar
> >>             - - Schema aplicado: organizations, users, companies, metrics, forms, form_submissions, lps, share_links
> >>               - - Migración inicial: convertir lib/mock-data.ts a seed SQL (LISTO en sesión 2)
> >>                 - - RLS: cada fondo solo ve sus datos (policies pendientes hasta cablear Clerk JWT)
> >>                  
> >>                   - **Entregable de fase 1:** GP de Patagonia se loguea, ve sus 8 companies (cargadas desde Postgres), edita una, persiste.
> >>                  
> >>                   - ---
> >>
> >> ### Fase 2 — AI Extraction (semana 3)
> >>
> >> **Por qué segundo:** es el "wow factor" diferenciador y lo que cierra ventas. Los GPs latam pagan por *no* tener que hacer data entry.
> >>
> >> **2.1 Claude API integration**
> >> - Endpoint /api/extract que recibe PDF/Excel y devuelve JSON estructurado
> >> - - Usar Claude Sonnet 4.6 con tool use forzado al schema de metrics
> >>   - - Caché de extracciones por hash del archivo
> >>     - - Cost guard: máximo 3 extracciones por submission, mostrar costo al usuario
> >>      
> >>       - **2.2 UI de upload-to-fill**
> >>       - - Ya existe el flujo en /fill/[id] con AI flags — solo falta cablearlo a la API real
> >>         - - Mostrar diff entre lo que el AI extrajo y lo que el founder editó (para mejorar el prompt)
> >>           - - Confidence score por campo
> >>            
> >>             - **Entregable de fase 2:** founder de Brio sube su deck Q4, Pulso autocompleta ARR/cash/runway, founder confirma con un click.
> >>            
> >>             - ---
> >>
> >> ### Fase 3 — Cadencias automáticas (semana 4)
> >>
> >> **Por qué tercero:** sin esto, Pulso es "Google Forms con UI bonita". Las cadencias automáticas son el *pull* del producto.
> >>
> >> **3.1 Resend para email**
> >> - Templates: invitación inicial, recordatorio mensual/trimestral, "tu LP letter está listo"
> >> - - Branded por fondo (logo, color, firma del GP)
> >>  
> >>   - **3.2 Cron via Vercel Cron Jobs**
> >>   - - Job diario que revisa forms con cadencia activa y dispara emails al founder cuando toca
> >>     - - Reminder a los 7 y 14 días si no respondió
> >>       - - Webhook de Resend para tracking de open/click → poblar response rates en /forms
> >>        
> >>         - **Entregable de fase 3:** GP setup el form trimestral una vez, los 8 founders reciben email automático cada Q sin que el GP haga nada.
> >>        
> >>         - ---
> >>
> >> ### Fase 4 — LP shares + Audit log (semana 5)
> >>
> >> **Por qué cuarto:** desbloquea el lado LP del producto. Sin esto los GPs siguen mandando PDFs por email.
> >>
> >> - Signed URLs via share_links.token con expiración configurable
> >> - - Watermark dinámico (email del LP) embebido en el render
> >>   - - Audit log: quién vio qué letter, cuándo, desde qué IP
> >>     - - Copy-protection: bloquear print/save (no es 100% pero filtra al 90%)
> >>      
> >>       - **Entregable:** GP genera link único por LP, tracking de quién lo abrió.
> >>      
> >>       - ---
> >>
> >> ### Fase 5 — Polish para pilot (semana 6)
> >>
> >> - Multi-currency (CLP, ARS, MXN, BRL → USD por trimestre con rates históricos)
> >> - - CSV export para todo (los GPs hacen su modelo financiero en Excel, así es la realidad)
> >>   - - Onboarding wizard: subir CSV de companies actuales y poblar la DB
> >>     - - Alertas configurables (runway < X meses, ARR cae > Y%)
> >>      
> >>       - ---
> >>
> >> ## Stack final propuesto
> >>
> >> | Capa | Tecnología | Costo (~10 fondos) |
> >> | --- | --- | --- |
> >> | Hosting | Vercel | $20/mo Pro |
> >> | Auth | Clerk | $0 hasta 10K MAU |
> >> | DB | Supabase | $25/mo Pro |
> >> | Email | Resend | $20/mo |
> >> | AI | Claude API | ~$50/mo a esa escala |
> >> | **Total runway** | | **~$115/mo** |
> >>
> >> A 10 fondos x ~$200/mo (precio sugerido) = $2K MRR con $115 de costos. Margen sano para iterar.
> >>
> >> ---
> >>
> >> ## Cosas que NO hay que hacer todavía
> >>
> >> - App móvil (los GPs usan laptop, no es prioridad)
> >> - - Integraciones con QuickBooks/Carta (nice to have, no es bloqueador)
> >>   - - White-label (cuando haya 5+ fondos pagando)
> >>     - - Marketplace de templates entre fondos (network effect, no MVP)
> >>      
> >>       - ---
> >>
> >> ## Pilot framework
> >>
> >> - Patagonia Fund I como pilot pagado a tarifa simbólica ($500/3 meses) o gratis a cambio de feedback semanal
> >> - - Métricas de éxito del pilot:
> >>   -   - GP completa el setup sin Slack de soporte
> >>       -   - 6 de 8 founders responden el primer form sin recordatorio manual
> >>           -   - LP abre al menos 1 letter compartido
> >>               - - Si los 3 se cumplen → cobrar $200/mo y empezar outbound a otros fondos LATAM
> >>                 - 
