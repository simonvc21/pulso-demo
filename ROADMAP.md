# Pulso — Roadmap a MVP completo

**Estado actual:** demo click-through en Next.js 14 con datos mock (`lib/mock-data.ts`). Schema y auth en Supabase ya configurados (sesión 2 + 3). Falta cablear el frontend.

**Objetivo MVP:** que un fondo real (Patagonia Fund I como pilot) pueda *usar* Pulso de verdad — invitar founders, recibir métricas reales, compartir con LPs.

---

## Orden recomendado (de menor a mayor dependencia)

La regla: cada capa desbloquea la siguiente. Saltarse una rompe la cadena.

### Fase 1 — Auth + Persistencia ✅ infra lista, falta wiring

**Lo que ya está hecho (sesiones 2 y 3):**
- 8 tablas en Supabase (organizations, users, companies, metrics, forms, form_submissions, lps, share_links)
- Seed: Patagonia Fund I + 8 companies + 64 métricas + 3 forms + 6 LPs
- RLS policies activas en todas las tablas (16 policies)
- Trigger `handle_new_user()`: cuando alguien hace signup en Supabase Auth, crea su row en `public.users`. Si su email es `simon.villena2010@gmail.com`, lo auto-asigna como GP de Patagonia Fund I.
- Helper function `user_org_id()`: usada por las RLS policies para scope multi-tenant.

**1.1 Supabase Auth (1 día)** — pendiente cablear en frontend
- Magic link email + email/password + Google OAuth (los 3 métodos)
- Por qué Supabase Auth vs Clerk: single vendor, RLS nativo via `auth.uid()`, mismo publishable key que la DB, sin extra mensual hasta ~50K MAU
- Google OAuth requiere setup en Google Cloud Console (5-10 min) — opcional para MVP
- `middleware.ts` con `@supabase/ssr` que protege `/dashboard`, `/companies`, `/forms`, `/lps`
- Login page en `/login` con los 3 métodos

**1.2 Reemplazar mock-data.ts con queries (3-4 días)**
- `@supabase/supabase-js` + tipos generados (regenerar con `supabase gen types`)
- Server components hacen queries directas con la sesión del user (RLS filtra por org)
- Client components usan `createBrowserClient()` para mutations
- Drizzle ORM opcional (mejor DX type-safe, pero @supabase/supabase-js basta para MVP)

**Entregable de fase 1:** GP de Patagonia hace login con magic link, ve sus 8 companies cargadas desde Postgres, edita una, persiste. La app es real.

---

### Fase 2 — AI Extraction (semana 3)

**Por qué segundo:** es el "wow factor" diferenciador y lo que cierra ventas. Los GPs latam pagan por *no* tener que hacer data entry.

**2.1 Claude API integration**
- Endpoint `/api/extract` que recibe PDF/Excel y devuelve JSON estructurado
- Usar Claude Sonnet 4.6 con tool use forzado al schema de `metrics`
- Caché de extracciones por hash del archivo (Supabase Storage o tabla `extractions`)
- Cost guard: máximo 3 extracciones por submission, mostrar costo al usuario

**2.2 UI de upload-to-fill**
- Ya existe el flujo en `/fill/[id]` con AI flags — solo falta cablearlo a la API real
- Mostrar diff entre lo que el AI extrajo y lo que el founder editó (para mejorar el prompt)
- Confidence score por campo

**Entregable de fase 2:** founder de Brio sube su deck Q4, Pulso autocompleta ARR/cash/runway, founder confirma con un click.

---

### Fase 3 — Cadencias automáticas (semana 4)

**Por qué tercero:** sin esto, Pulso es "Google Forms con UI bonita". Las cadencias automáticas son el *pull* del producto.

**3.1 Resend para email**
- Templates: invitación inicial, recordatorio mensual/trimestral, "tu LP letter está listo"
- Branded por fondo (logo, color, firma del GP)

**3.2 Cron via Vercel Cron Jobs (o Supabase Edge Functions con pg_cron)**
- Job diario que revisa `forms` con cadencia activa y dispara emails al founder cuando toca
- Reminder a los 7 y 14 días si no respondió
- Webhook de Resend para tracking de open/click → poblar response rates en `/forms`

**Entregable de fase 3:** GP setup el form trimestral una vez, los 8 founders reciben email automático cada Q sin que el GP haga nada.

---

### Fase 4 — LP shares + Audit log (semana 5)

**Por qué cuarto:** desbloquea el lado LP del producto. Sin esto los GPs siguen mandando PDFs por email.

- Tabla `share_links` ya existe en el schema
- SECURITY DEFINER function `public.get_lp_letter(token)` para acceso anon sin exponer la tabla
- Watermark dinámico (email del LP) embebido en el render
- Audit log: quién vio qué letter, cuándo, desde qué IP (Supabase logs + tabla `share_link_views`)
- Copy-protection: bloquear print/save (no es 100% pero filtra al 90%)

**Entregable:** GP genera link único por LP, tracking de quién lo abrió.

---

### Fase 5 — Polish para pilot (semana 6)

- Multi-currency (CLP, ARS, MXN, BRL → USD por trimestre con rates históricos)
- CSV export para todo (los GPs hacen su modelo financiero en Excel, así es la realidad)
- Onboarding wizard: subir CSV de companies actuales y poblar la DB
- Alertas configurables (runway < X meses, ARR cae > Y%)

---

## Stack final propuesto

| Capa | Tecnología | Costo (~10 fondos) |
| --- | --- | --- |
| Hosting | Vercel | $20/mo Pro |
| Auth + DB | Supabase (Pro plan) | $25/mo |
| Email | Resend | $20/mo |
| AI | Claude API | ~$50/mo a esa escala |
| **Total runway** | | **~$115/mo** |

A 10 fondos x ~$200/mo (precio sugerido) = $2K MRR con $115 de costos. Margen sano para iterar.

**Cambio respecto a versión anterior:** eliminamos Clerk del stack. Supabase Auth cubre el caso, ahorra $25/mo y simplifica el stack a un único vendor para auth+DB.

---

## Cosas que NO hay que hacer todavía

- App móvil (los GPs usan laptop, no es prioridad)
- Integraciones con QuickBooks/Carta (nice to have, no es bloqueador)
- White-label (cuando haya 5+ fondos pagando)
- Marketplace de templates entre fondos (network effect, no MVP)

---

## Pilot framework

- Patagonia Fund I como pilot pagado a tarifa simbólica ($500/3 meses) o gratis a cambio de feedback semanal
- Métricas de éxito del pilot:
  - GP completa el setup sin Slack de soporte
  - 6 de 8 founders responden el primer form sin recordatorio manual
  - LP abre al menos 1 letter compartido
- Si los 3 se cumplen → cobrar $200/mo y empezar outbound a otros fondos LATAM
