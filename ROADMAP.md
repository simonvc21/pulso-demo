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

**B.3 Permisos por company (analista escópeo)** ✅
- Tabla `user_company_access(user_id, company_id)`.
- RLS adicional: si role='analyst' y la company NO está en user_company_access, no la ve.
- UI en /settings/team: por usuario analyst, checklist de companies que puede ver.

**B.4 Bulk import de métricas históricas** *(parcial — CSV + Excel shipped, PDF pendiente)*
Para que un fondo que ya viene operando no pierda años de data al onboardearse.
- ✅ Botón "Import CSV" en `/data` (toolbar) y en el step Metrics del onboarding wizard.
- ✅ Acepta upload de archivo (.csv, max 2MB) o paste directo de texto.
- ✅ Parser permisivo (`lib/csv-metrics.ts`):
  - Headers tolerantes a sinónimos: `company_slug | company | name`, `quarter | period | q`, `arr_usd | arr`, etc. Case-insensitive, snake/space-insensitive.
  - Quarter formats aceptados: "Q1 2026", "Q1-2026", "Q1_2026", "2026 Q1", "2026-Q1".
  - Numeric: strip $, comas, %.
  - Acepta `null` por celda; rechaza filas donde TODAS las métricas están vacías.
- ✅ Modal de preview: muestra rows válidos (tabla scrollable) + errores línea-a-línea + headers reconocidos vs ignorados ANTES de commitear.
- ✅ Server action `bulkImportMetrics` resuelve company por slug O nombre (case-insensitive), upsert por `(company_id, quarter)` — re-uploadear es safe. Reporta inserted / updated / skipped + per-row errors.
- ✅ Plantilla descargable inline (botón "Download template" con sample CSV).
- ✅ B.4b: parser .xlsx via SheetJS `xlsx@0.18.5` (lib/xlsx-metrics.ts). Convierte la primera sheet del workbook a CSV string en cliente y lo manda al mismo `parseMetricsCsv` — el parser sigue siendo single source of truth de validación. Soporta .xlsx, .xlsm, .xls, .xlsb, .ods. Si hay múltiples sheets, importa la primera y avisa al user. Dynamic-imported para que el bundle de `/data` y `/onboarding` no cargue ~110 kB extra hasta que el usuario realmente elige un archivo Excel.
- Security note: xlsx@0.18.5 tiene CVEs conocidas (prototype pollution + ReDoS en formula parsing). Mitigado: pasamos `cellFormula:false` para deshabilitar el formula parser y todo el output va por el strict CSV validator antes de tocar la DB. Riesgo real ≈ 0 para nuestro uso.
- Pendiente B.4c: PDF/screenshot via Gemini Pro multi-modal — bigger lift, separate phase.

**Entregable B:** un nuevo fondo se onboardea sin Slack de soporte. GP invita a su analista que solo ve 3 de 12 companies. Sube su histórico de un Excel y queda toda la grilla poblada.

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

**D.1 Logo del fondo** ✅
- Subida a Supabase Storage bucket `org-assets` (RLS scoped por org via path matching).
- Reemplaza el "PULSO" del sidebar con el logo cuando está cargado.
- "Powered by Pulso" sigue en footer.

**D.2 Colores personalizables** ✅
- Settings → Branding: 3 color pickers (primary, accent, navy) con campo hex texto.
- Persiste en `organizations.theme_json`.
- Inyectado como CSS vars (`--theme-primary`, `--theme-accent`, `--theme-navy`) en `(gp)/layout.tsx`.

**D.3 Logos por company** ✅
- Subida en `/companies/[slug]/edit` con su propio uploader.
- Reemplaza el cuadrado-inicial en el list y en el detail page.

**D.4 Dark mode** *(pendiente)*
- Toggle en topbar.
- next-themes + Tailwind dark: classes en globals. Tocar las brand classes para soportar dark.

**D.5 Editor del dashboard**
- Cada widget (KPI card, bar chart, watch list, trend, activity) es draggable + resizable.
- Persistir layout en `users.dashboard_layout_json` (per-usuario, no per-fondo, para que cada uno arme el suyo).
- Botón "Add widget" con catálogo: KPIs custom, charts adicionales (cohorts, top movers, etc).

**D.6 Switch de idioma EN/ES** ✅ shipped (phase 2)
- ✅ Cookie-driven (`pulso_locale`) con `LocaleSwitcher` en el sidebar. Sin next-intl — usamos un wrapper liviano `lib/i18n.ts` (client-safe) + `lib/i18n-server.ts` (lee cookies) que devuelve `t(key, locale, vars?)`.
- ✅ Phase 1 (anterior): sidebar, topbar search, dashboard core + KPIs.
- ✅ Phase 2 (this pass): companies list + detail topbar/columns, data toolbar + tip + filter placeholder, notifications topbar + mark-all-read, forms topbar + new-form button, settings (todos los cards), LP portal (header / portfolio callout / letters empty state / company list + detail), onboarding stepper (5 step labels).
- Helper soporta interpolación `{{n}}` para "Explorá las {{n}} empresas" / "{{total}} totales · {{unread}} sin leer".
- Pendiente: form-builder internals (drag-drop UX), edit forms, /lps Add-LP modal, label de roles dentro de cards, modals de team management. Esos son strings menos visibles y más volátiles — los dejamos para un D.6c si hace falta.

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
- Gemini 2.5 (con la API key del proyecto) con tool calling.
- Tools: `query_companies`, `query_metrics`, `query_submissions`, `query_lps`,
  `query_news_updates` — todos respetando RLS via service role + filtro por organization_id.
- Ejemplos: "qué company tiene el peor runway?", "muéstrame el top 3 por ARR growth en Q1", "cuáles founders no respondieron este mes?", "qué noticias tuvo Vextra el último Q?".

**F.2 Chatbot para LP**
- Mismo Gemini pero con scope reducido al subset de companies que el GP haya autorizado mostrar a ese LP.
- "Cómo va Vextra?" → respuesta que solo usa los datos del último letter compartido.

**F.3 Cost guard**
- Cap diario por fondo. Cache de respuestas sobre prompts idénticos.

---

## Fase K — Newsletter + AI inteligente con Gemini (4-6 días)

Funda la integración de Gemini en toda la plataforma y agrega el flujo de
noticias/updates de cada startup como contenido editorial.

**K.0 Stack de AI compartido** *(prerequisito de K.1-K.4)*
- `lib/gemini.ts`: wrapper único sobre `@google/generative-ai`. Configura cliente con `GEMINI_API_KEY`. Helpers `generate(text)`, `generateJSON(schema, text)`, `generateWithTools(tools, prompt)`.
- Toda llamada AI pasa por este wrapper — un solo lugar para retries, cost cap, logging, switch de modelo.
- Decisión: arrancamos con `gemini-2.5-flash` para alertas + builder helper, `gemini-2.5-pro` para chatbot. Parametrizado en una constante `MODELS` para upgrade rápido.

**K.1 Forms con campos de noticias / updates** *(simple, sin AI)*
- Nuevo tipo de campo `news` (alias rico de `longtext`) y un grupo por defecto "Updates" sugerido al crear formularios.
- Detectar campos de tipo `news` o etiquetados con grupo "Updates"/"News" en `form_submissions.data_json` para alimentar el newsletter.

**K.2 Newsletter section en /dashboard**
- Nueva sección al final del dashboard tipo "Latest from your portfolio".
- Lee últimas N submissions con campos news/updates, agrupadas por company.
- Render: card grande por update con logo de la company (cuando D.3 esté), fecha, párrafo del update, link al detail. Diseño tipo Substack/newsletter ejecutivo.
- Filtros: por company, por keyword, por rango temporal.

**K.2.1 Newsletter section en /companies/[slug]** *(pendiente)*
- Cada company también tiene su feed de news/updates en su detail page,
  filtrado a esa company. Mismo componente PortfolioNewsletter pero scopeado.
- Va abajo del bloque de "Recent submissions" o reemplazándolo.

**K.3 Alertas heurísticas + AI body** *(extiende fase J.3)*
- `run_metric_alerts()` sigue siendo el detector. Cuando matchea, antes de insertar en `notifications`, llama a Gemini para escribir el `body`: contexto + recomendación accionable basada en los últimos 4 quarters de la company.
- Ejemplo: "Mira's runway dropped to 8.6 mo because burn jumped 45.8% QoQ. ARR is still growing 18% so it's likely investment, not crisis. Ask Camila about the new VP of Sales hire flagged last submission. Bridge conversation if no plan in 30d."
- Se cachea por (company_id, alert_kind, quarter) para no re-pagar.

**K.4 AI helper en form builder**
- En /forms/new y /forms/[slug]/edit, botón "Suggest with AI".
- Modal con input: "Describe this form in one sentence" → Gemini propone 6-10 campos con tipo, label, required, group.
- Por campo individual: "Rewrite to be clearer" / "Translate to Spanish" / "Generate help text".

**K.5 AI helper en LP letters** *(deferred a fase H polish)*
- "Generate this quarter's commentary" → Gemini lee las metrics y submissions del trimestre, escribe el "Letter from the GP".
- GP edita antes de enviar.

**K.6 Vector DB (pgvector) — deferred**
- Cuando el dataset crezca: enable extensión `vector`, embed `form_submissions.data_json` con `gemini-embedding-001`, RAG en chatbot Fase F.
- No empezamos acá — para 8 companies × 8 quarters el LLM ingiere todo el portfolio en cada query directamente.

**Entregable K:** dashboard tiene una sección de noticias con updates de los founders, las alertas son útiles (no genéricas), crear un form nuevo es asistido por AI, y todo sale con un solo `GEMINI_API_KEY` en env.

---

## Fase L — Customización profunda + bugs (varias sesiones)

Feedback sobre lo que falta para que la app se sienta verdaderamente personal de cada fondo y de cada company.

### Bugs urgentes (siguiente sesión)

**L.0.a Dismiss del banner Pulso AI no funciona**
- El botón "Dismiss" en `/dashboard` no tiene handler. Convertir el banner en client component, usar localStorage para persistir el dismiss por user.

**L.0.b Cap de tokens del chat muy bajo**
- `/api/chat` devuelve respuestas truncadas. `maxOutputTokens` actual = 600 — insuficiente para newsletter. Subir a 2500 para `gp` scope, 1500 para `lp`.

**L.0.c Branding colors no se aplican visualmente**
- En Settings → Branding cambiás los hex pero Tailwind sigue usando `bg-navy` / `text-gold` con valores fijos del config. Hace falta o:
  - convertir esos tokens también a CSS vars (igual que paper/ink/line ya están), o
  - inyectar un `<style>` con overrides específicos en el layout.
- Decisión: opción 2 (más conservador, no rompe los acentos cuando el theme está vacío).

**L.0.d LP chatbot UX**
- Verificar que `/lp` tenga el ChatDock activo y los suggestion chips correctos. Ya está implementado en `app/lp/layout.tsx` — confirmar que renderiza.

### UX simple (1-2 sesiones)

**L.1 Form builder: wizard "AI o manual" + arrancar vacío**
- Cambiar `defaultNewForm` para que sea `{name: "", cadence: "quarterly", fields: []}`.
- En `/forms/new`, antes de mostrar el builder, paso intro: "How would you like to start? [Build with AI] [Start blank]".
- "Build with AI" abre el modal de `suggestFormFields` directo. "Start blank" muestra el builder vacío con un empty state que dice "Add your first field from the left panel".

**L.2 Fund profile expandido**
- Nuevos campos en `organizations`: `description text`, `thesis text`, `website text`, `linkedin text`, `founded_year int`.
- En Settings → Fund: agregar textarea para tesis (Markdown) + descripción + links.
- Mostrar la tesis en el LP letter, en el chat context (para que Gemini conozca la tesis del fondo), y como tooltip en el sidebar.

### UX media (2-3 sesiones)

**L.3 Data tab más custom** *(parcial — reorder/hide + notas shipped)*
- ✅ Reordenar y hide/show de las 5 columnas existentes via "Columns" popover en el toolbar de `/data`. Persistencia per-org en `organizations.data_columns_json` (jsonb).
- ✅ Notas per-celda: nueva tabla `metric_notes(company_id, quarter, metric_key, note, author_user_id)` con RLS escopeada a la org. Cell tiene un dot dorado cuando hay nota; right-click o hover → icono → popover con textarea, ⌘↵ para guardar.
- ✅ Forward-compat: si añadimos una métrica nueva al `DATA_METRICS` constant, aparece automáticamente al final del orden existente (sin migration).
- ✅ Reset to default en el popover de columnas.
- Pendiente para L.3b: agregar/quitar columnas que NO sean parte del set fijo (necesita L.4 — métricas custom per company). Color-coding por threshold también queda para L.3b.

### Modelo de datos grande (1 semana cada uno)

**L.4 Métricas custom por company** *(parcial — additive shipped, /data spreadsheet integration pendiente)*
Hoy todas las companies tienen el mismo schema de 5 métricas universales. L.4 agrega métricas extra per-company sin romper nada de eso.
- ✅ Approach **additive** (no replace): la tabla `metrics` queda como está (las 5 universales se siguen agregando para los KPIs del dashboard, LP letter, etc.). Las métricas custom viven en tablas separadas.
- ✅ Migration: enum `custom_metric_type` (currency / number / percent / ratio / count) + `metric_definitions(organization_id, label, type, unit)` con UNIQUE(org, label) + `custom_metric_values(company_id, metric_definition_id, quarter, value)` con UNIQUE(company, definition, quarter). RLS escopeada via `user_org_id()` y `can_access_company`. Cascade delete por company y por definition.
- ✅ UI editor en `/companies/[slug]/edit` → bloque "Custom metrics" con form para crear definitions (label + type + unit), tabla inline con quarters como columnas, edición autosave por celda, delete metric.
- ✅ Detail page `/companies/[slug]` → stat strip (5 cards con latest + QoQ delta) + grid de mini line charts (uno por metric).
- ✅ Surfaced a `lib/chat-context.ts`: cada company en el JSON dump ahora tiene un array `custom_metrics: [{ label, type, unit, values: [{quarter, value}] }]`. Pulso AI puede responder "¿qué NPS tiene Acme?" o "comparame el GMV de las dos marketplaces".
- Pendiente L.4b: integrar al `/data` spreadsheet (aparecen como columnas extra opcionales, requiere repensar el schema del column-config L.3 para soportar mix de universales + custom).
- Pendiente L.4c: surfaced a LP letter cuando GP marca un custom metric como "share with LPs".
- Pendiente L.4d: bulk import CSV/xlsx de custom metrics (extender B.4).

**L.5 Dashboard editor de widgets** *(reverted — UX no nos gustó)*
- Se shippeó y se removió el mismo día. La columna `organizations.dashboard_config_json` queda en la DB (null para todos), por si volvemos a explorar.
- Si lo retomamos: el approach de drag/resize/accent funcionaba pero la edición in-place se sentía pesada. Idea para L.5b: en vez de toggle "Edit" pesado, una pestaña /dashboard/customize separada con preview side-by-side.

**L.6 Companies: instrumento de inversión + links**
Nuevos campos en `companies`:
- `investment_instrument enum` ("safe", "convertible_note", "equity", "saft", "warrant", "loan").
- `safe_cap_usd numeric` y `safe_discount_pct numeric` (sólo cuando aplica).
- `website text` y `linkedin_url text`.
UI:
- Editor en `/companies/[slug]/edit`: nuevo bloque "Investment terms" con tipo + cap + discount + website + linkedin.
- En `/companies/[slug]` mostrar el badge del instrumento al lado del Stage, y los íconos de website/linkedin junto al founder.
- Surface a Pulso AI (chat-context) y al LP letter para que se vea cómo está estructurada la inversión.

**L.7 LPs ven dashboards de cada company del portfolio** ✅ shipped
- Nuevo `/lp/companies` (lista con logo + sector + stage + ARR + QoQ + status) y `/lp/companies/[slug]` (detalle con KPIs, 4 charts, newsletter, sin botones de edit/send).
- RLS: NO requirió migration. `user_org_id()` ya escopea por org y `can_access_company` aplica el branch "no rows in user_company_access = full access" para roles no-admin (incluido `lp`). LPs ya leían `companies` + `metrics`; sólo faltaba la UI.
- Nav: header del LP layout ahora tiene botones "Letters" y "Portfolio". Home `/lp` muestra un card destacado al portfolio antes de la lista de letters.
- Investment instrument badges + website/linkedin links de L.6 también renderizan en la detalle LP.
- Pendiente para L.7b si lo necesitamos: flag `companies.lp_visible bool` para esconder companies "critical" del LP.

**L.8 Onboarding wizard expandido (extiende B.1)** ✅ shipped
- `/onboarding` ahora tiene 5 steps todos skippeables: **Fund** → **LPs** → **Team** → **Portfolio** → **Metrics**.
  1. Fund: nombre, vintage, size, currency, **descripción, tesis (visible para LPs), website**. Persiste en `organizations` con los campos de L.2.
  2. LPs: lista repeatable (nombre, type, commitment, country, email). Insert en `lps`. Match por email cuando el LP se loguea.
  3. Team: invite-by-email con role select (existente — ya estaba en B.1).
  4. Portfolio: tabla entry de companies (existente). Stub button "Upload CSV / Excel / PDF · coming soon" para B.4.
  5. Metrics: backfill manual quarterly por company × quarter (ARR / cash / burn / revenue / headcount). Upsert por `(company_id, quarter)` para idempotencia. Stub upload button para B.4.
- Seed: NO se aplicó cambio — el trigger `handle_new_user` ya deja `organization_id = NULL` para emails nuevos (sólo `simon.villena2010@gmail.com` recibe Patagonia). Cuentas nuevas ya arrancan vacías → caen en `/onboarding`. Mover el seed a `scripts/seed-demo.sql` queda como cleanup futuro.
- Pendiente para L.8b: sub-step opcional "Create your first form" + parsers reales en B.4.

**L.9 Plans & subscriptions en Settings**
Nueva sección entre "Branding" y "Team":
- Card "Subscription" muestra el plan actual (Starter/Growth/Scale del pricing del landing) y el ciclo de billing.
- Botones: "Upgrade plan" (modal con los 3 tiers comparados), "Downgrade", "Cancel subscription".
- Backend: integrar Stripe Customer Portal (más rápido que UI propia). Una sola tabla `subscriptions(organization_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)`.
- Webhook `/api/stripe/webhook` actualiza la tabla en eventos `customer.subscription.*`.
- Para el demo: stub seguro que lee/escribe la tabla pero las acciones reales redirigen al Stripe Portal cuando STRIPE_SECRET_KEY esté seteado.

**L.10 Form scheduling — calendar view + GP-controlled cadence** *(parcial — schedule + calendar shipped, email firing pendiente Fase C)*
- ✅ Migration: `form_schedules(form_id UNIQUE, cadence enum monthly|quarterly|annual|ad_hoc, send_day_of_month, anchor_month, reminder_offsets_days int[], next_send_at, last_sent_at, active)`. RLS via existing org membership.
- ✅ Helper `lib/form-schedule.ts` (client-safe): `computeNextSendAt(cadence, dom, anchorMonth, fromIso)` — UTC-deterministic, used by both server actions y client preview. `expandSchedule()` materializa los próximos N sends + reminder dates para el calendar.
- ✅ Editor en `/forms/[slug]/edit` → bloque "Schedule": cadence picker (4 cards), day-of-month input (clamped 1–28), anchor month (quarterly/annual only), reminder offsets como toggle pills (1/2/3/7/14 días antes), live preview del próximo send + reminder dates. Pause/Resume buttons.
- ✅ `/forms` ahora tiene toggle Cards / Calendar. La calendar view es un month-grid con cada día mostrando sends (teal pill, Send icon) y reminders (gris, Bell icon). Navegación entre meses con prev/next/today. Click en cualquier evento abre el form.
- ✅ Server actions: `upsertFormSchedule` (recomputa `next_send_at` server-side), `pauseFormSchedule`, `resumeFormSchedule`. Reminder offsets sanitizados (positive ints, max 5, deduped).
- Pendiente: cron job `/api/cron/form-scheduler` que dispare los emails reales — bloqueado por Fase C (Resend).
- Pendiente: founders ven "Due in 3 days" inline en `/fill/[id]`.
- Pendiente: GP puede "Send now" desde el calendar (existe en form detail page).

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
