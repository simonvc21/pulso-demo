# Pulso — Roadmap

**Estado actual (2026-05-01):** demo live en https://pulso-demo-three.vercel.app con Supabase Auth, RLS multi-tenant, todas las páginas GP cableadas a Postgres, /share y /fill funcionando con SECURITY DEFINER RPCs, builder de forms que crea + edita + envía. Login con `simon.villena2010@gmail.com` / `Pulso2026!`.

**Lo que ya funciona end-to-end:**
- Marketing landing en /
- Login con email+password y magic link
- Dashboard, companies, forms, LPs, settings, fill, share — todo persiste en Postgres
- Form builder crea y edita templates, toggle de tipo, opciones para select
- Add LP modal real
- Export CSV de companies
- Share link a LP con watermark, expiración y view counter

**Objetivo MVP:** un fondo nuevo abre la cuenta, sube su portafolio actual en menos de 30 minutos, invita a sus founders, y le envía a sus LPs un letter el mismo día.

---

## Fase 1 — Auth + persistencia ✅ HECHO

Sesiones 1-4. Skipping detail — ver historial de commits.

---

## Fase A — UX inmediato y polish del builder (1-2 días) — EMPIEZA AHORA

Lo que falta para que el GP-pilot no tenga fricción visible al hacer onboarding manual del primer fondo.

**A.1 Drag-and-drop en el form builder**
- Reemplazar las flechitas ↑↓ con DnD de verdad (`@dnd-kit/core` + `@dnd-kit/sortable`).
- Persistir el orden en `forms.fields_json` (array order = render order).
- Funciona en /forms/new y /forms/[slug]/edit.

**A.2 Recipientes por startup**
- Nueva tabla `form_recipients(form_id, company_id)` con UNIQUE.
- En el panel derecho del builder, sección Recipients: pickea companies del fondo (default = todas).
- `submit_public_form` ya valida company_slug; agregar `get_form_recipients(form_id)` para mostrar quién está en scope.
- Quita el "8 founders · All active companies" hardcoded.

**A.3 Botón "Volver" en preview**
- /fill/[id] y /share/[token] cuando se acceden con `?preview=1` (sólo el GP autenticado), muestran un banner sticky arriba con "← Volver al GP view" que regresa a /forms/[slug] o /lps.

**A.4 Editar perfil de fondo en Settings**
- Hoy Settings muestra fund.name/vintage/size_usd/deployed_usd como read-only.
- Convertirlo en form editable con server action `updateFund`.
- RLS: la policy `org_update_own` ya permite update si user.organization_id = id.

**A.5 Editar company desde su detalle**
- Botón "Edit" en /companies/[slug] arriba a la derecha (al lado de Email founder).
- Edita name, sector, country, stage, status, flag, invested_usd, ownership_pct, founder_*, description.
- Server action `updateCompany`.

**A.6 LP login (Supabase Auth con role=lp)**
- Mismo /login, pero al hacer login el trigger `handle_new_user` chequea si el email aparece en `lps.email`. Si sí, asigna role='lp' y organization_id de ese LP.
- Nuevo layout `/lp/(layout)` para la zona LP — solo ve los share_links que le pertenecen.
- Página `/lp/letters` lista todos los letters compartidos con ese LP (`share_links.lp_id = lps.id WHERE lps.organization_id = ?`).
- Mantener share links anónimos por token para LPs que no quieren cuenta (ya está).

**Entregable A:** demo navegable de punta a punta, builder pulido, fund/company editables, LPs con cuenta o por link.

---

## Fase B — Onboarding y multi-usuario (3-5 días)

Lo que destraba que un fondo nuevo se sume sin que yo (Simon) le haga el setup manual.

**B.1 Onboarding wizard `/onboarding`**
- Step 1: nombre del fondo, vintage, size_usd, currency, logo (subida a Supabase Storage).
- Step 2: subir CSV / Excel / PDF / imagen del portafolio. Endpoint `/api/extract` con Claude Sonnet 4.7 + tool use forzado al schema de `companies` + `metrics`.
- Step 3: review + edit de lo extraído. El usuario confirma cada company antes de insert.
- Step 4: invitar founders por email (lista de mails, magic links).
- Disparado automáticamente cuando alguien se loguea por primera vez sin organization_id.

**B.2 Invitar usuarios al fondo**
- Tabla `user_invitations(id, organization_id, email, role, invited_by, accepted_at, expires_at)`.
- Server action `inviteUser({email, role})` que mete una row + dispara magic link.
- El trigger `handle_new_user` chequea si el email tiene una invitación pendiente; si sí, le asigna org+role.
- /settings/team: lista usuarios + invitaciones pendientes, revocar, cambiar rol.
- Roles: gp, managing_partner, analyst, viewer (y lp / founder fuera del lado GP).

**B.3 Permisos por company (analista escópeo)**
- Tabla `user_company_access(user_id, company_id)`.
- RLS adicional: si role='analyst' y la company NO está en user_company_access, no la ve.
- UI en /settings/team: por usuario analyst, checklist de companies que puede ver.

**Entregable B:** un nuevo fondo se onboardea sin Slack de soporte. GP invita a su analista que solo ve 3 de 12 companies.

---

## Fase C — Email + cadencias automáticas (3 días)

**C.1 Resend para email**
- Conectar Resend (cuenta nueva o existente). Domain del fondo via DNS records (DKIM/SPF) o `noreply@pulso.vc` fallback.
- Templates: invitación a founder, recordatorio mensual/trimestral, "tu LP letter está listo".
- Branded por fondo: logo, color, firma del GP.

**C.2 Cron para cadencias**
- Vercel Cron Jobs (preferido — gratis hasta cierto volumen) o Supabase pg_cron.
- Job diario `daily-form-dispatch`: revisa `forms.cadence` + `forms.last_sent_at`, manda emails con tokens únicos `/fill/<form>?company=<slug>&token=...`.
- Job diario `daily-reminders`: founders sin submission después de 7d → reminder; 14d → escalar al GP.
- Webhook de Resend → tabla `email_events` para tracking open/click → poblar `forms.response_rate`.

**C.3 Email-from-the-fund (deferred a fase white-label)**
- Per ahora todos los emails salen desde `noreply@pulso.vc`. Cuando un fondo conecta su dominio (fase D), pasamos a `noreply@<sufondo>.com`.

**Entregable C:** GP setup el form trimestral una vez, los founders reciben email automático cada Q.

---

## Fase J — Notificaciones (in-app + AI alerts) (2-3 días)

Bell icon en el topbar con feed de eventos. Mezcla notificaciones de actividad del sistema con alertas heurísticas y, después, alertas con LLM en Fase F.

**J.1 Tabla `notifications` + bell + feed**
- `notifications(id, organization_id, user_id, kind, title, body, link, metadata_json, read_at, created_at)`.
- `kind` enum: `form_submitted`, `form_sent`, `reminder_sent`, `lp_viewed_letter`, `metric_alert_runway`, `metric_alert_arr_drop`, `metric_alert_burn_spike`, `member_joined`, `letter_published`.
- RLS: cada user ve sus notificaciones (filtradas por user_id IS NULL OR user_id = current_user) dentro de su org.
- Bell con contador de no-leídas en el topbar; dropdown con últimas 10; "Mark all as read" + página `/notifications` con historial completo.

**J.2 Triggers automáticos del sistema**
- Trigger Postgres `after_insert_form_submission` → notifica al GP con kind=form_submitted, link al detail de la company.
- Trigger en `forms.last_sent_at` UPDATE → kind=form_sent (al GP que disparó el send).
- Trigger en `share_links.view_count` UPDATE → kind=lp_viewed_letter (al GP de la org del share).
- Trigger en `users` INSERT (cuando alguien acepta una invitación) → kind=member_joined al GP.
- Trigger en `forms` UPDATE (when active flips false→true after a long pause, etc.) — opcional.

**J.3 Alertas de métricas heurísticas (sin LLM)**
- Cron diario `daily-metric-alerts` (Vercel Cron Job) corre reglas determinísticas sobre los últimos 2 quarters:
  - `runway < 9 mo` → kind=metric_alert_runway
  - `ARR cae > 10% QoQ` → kind=metric_alert_arr_drop
  - `burn sube > 25% QoQ sin que ARR siga` → kind=metric_alert_burn_spike
- Cada regla genera 1 notificación por company por trigger por trimestre (no spammear).
- Reglas configurables por fondo en `/settings/alerts` (umbrales editables).

**J.4 Alertas con AI (depende de Fase F)**
- Cuando Fase F (AI chatbot) ya tenga el tool use sobre la DB, el mismo cron diario lanza una corrida de Claude con prompt "qué es lo más urgente que el GP debería saber esta semana?".
- Resultado se guarda como kind=ai_insight con confidence + summary.
- Cap de 3 ai_insights/semana por fondo para controlar costo.

**J.5 Email digest**
- Trigger sobre `notifications` INSERT → si el user tiene `email_digest_frequency = realtime`, manda mail al toque (Resend).
- Si `daily` o `weekly`, cron junta las pendientes y manda un solo digest.
- Configurable en `/settings/notifications`.

**Entregable J:** GP abre la app y ve "Vextra acaba de enviar Q1 financials", "Brio runway < 9mo según último submit", "Andina abrió tu LP letter hace 2h". Click → va al sitio relevante. Email digest opcional.

---

## Fase D — Personalización y white-label (3-4 días)

Para que cada fondo sienta que es *su* tool, no Pulso.

**D.1 Logo del fondo**
- Subida a Supabase Storage bucket `org-assets`.
- Reemplaza el "PULSO" del sidebar/topbar/share/fill con el logo del fondo cuando esté disponible.
- Mantener "Powered by Pulso" en footer del share (link de marketing).

**D.2 Colores personalizables**
- Settings → Branding: pickers para primary, accent, background.
- Persistir en `organizations.theme_json`.
- Inyectar en `<html style="--color-primary: ...">` desde el layout server component.

**D.3 Logos por company**
- Subida en /companies/[slug]/edit.
- Reemplaza el cuadrado de inicial en el avatar.

**D.4 Dark mode**
- Toggle en topbar.
- next-themes + Tailwind dark: classes en globals.

**D.5 Editor del dashboard**
- Cada widget (KPI card, bar chart, watch list, trend, activity) es draggable + resizable.
- Persistir layout en `users.dashboard_layout_json` (per-usuario, no per-fondo, para que cada uno arme el suyo).
- Botón "Add widget" con catálogo: KPIs custom, charts adicionales (cohorts, top movers, etc).

**D.6 Switch de idioma EN/ES**
- next-intl. Reemplazar todos los strings hardcoded por `t('...')`.
- Detectar Accept-Language en server side, default a en.
- Toggle en topbar.

**Entregable D:** fondo con su logo, colores y dashboard custom. Light/dark. EN/ES.

---

## Fase E — Tabla tipo Excel (2 días)

Nueva pestaña /data o /table — los GPs hacen sus modelos en Excel, así es la realidad.

- Grilla por company × métrica × quarter.
- Editable inline (click cell → input).
- Columnas filtrables/sortables.
- Export a CSV (ya está) y XLSX.
- Vista alternativa "by company" (1 fila por company, todas las métricas) y "by quarter" (1 fila por quarter, todas las companies).

---

## Fase F — AI Chat (3-5 días)

Sidebar derecho persistente. Distintos contextos según rol.

**F.1 Chatbot para GP**
- Claude Opus 4.7 con tool use.
- Tools: `query_companies`, `query_metrics`, `query_submissions` — todos respetando RLS via service role + filtro por organization_id.
- Ejemplos: "qué company tiene el peor runway?", "muéstrame el top 3 por ARR growth en Q1", "cuáles founders no respondieron este mes?".

**F.2 Chatbot para LP**
- Mismo Claude pero con scope reducido al subset de companies que el GP haya autorizado mostrar a ese LP.
- "Cómo va Vextra?" → respuesta que solo usa los datos del último letter compartido.

**F.3 Cost guard**
- Cap diario por fondo. Cache de respuestas sobre prompts idénticos.

---

## Fase G — Settings avanzado (2 días)

- Cancelar suscripción + downgrade.
- Billing con Stripe (subscription per organization).
- Audit log: quién hizo qué, cuándo, IP. Tabla `audit_log` poblada por triggers de Postgres.
- Backup/export del fondo entero a JSON.
- 2FA opcional (TOTP via Supabase Auth).

---

## Fase H — Compartir con LPs, seguro (2 días)

- LP login (ya en fase A.6) + share links anónimos (ya está).
- Nueva tabla `share_link_views(share_link_id, viewed_at, ip, user_agent)` para audit.
- Copy/print protection en /share/[token]: CSS tricks + watermark con email del LP, JS para bloquear keyboard shortcuts (no es 100%, filtra el 90%).
- "Revoke link" desde /lps/[id].
- Expiración configurable por share (default 60d).
- Email automático al GP cuando un LP abre el letter por primera vez.

---

## Fase I — Pulir para pilot real (semana N)

Originalmente "fase 5". Estas tareas se hacen al final.

- Multi-currency (CLP, ARS, MXN, BRL → USD por trimestre con rates históricos).
- Alertas configurables: runway < X meses, ARR cae > Y%, form sin responder > Z días.
- Sync con QuickBooks/Contabilizei/Xero para no pedirle nada al founder (long-tail).
- App móvil (probablemente NUNCA — los GPs usan laptop).

---

## Stack final propuesto

| Capa | Tecnología | Costo (~10 fondos) |
| --- | --- | --- |
| Hosting | Vercel | $20/mo Pro |
| Auth + DB | Supabase (Pro plan) | $25/mo |
| Email | Resend | $20/mo |
| AI | Claude API | ~$50/mo a esa escala |
| Storage (logos, uploads) | Supabase Storage | incluido |
| **Total runway** | | **~$115/mo** |

A 10 fondos x ~$200/mo (precio sugerido) = $2K MRR con $115 de costos. Margen sano para iterar.

---

## Pilot framework

- Patagonia Fund I como pilot pagado a tarifa simbólica ($500/3 meses) o gratis a cambio de feedback semanal
- Métricas de éxito del pilot:
  - GP completa el setup sin Slack de soporte (validar fase B)
  - 6 de 8 founders responden el primer form sin recordatorio manual (validar fase C)
  - LP abre al menos 1 letter compartido (validar fase A.6 + H)
- Si los 3 se cumplen → cobrar $200/mo y empezar outbound a otros fondos LATAM
