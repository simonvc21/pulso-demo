# Pulso — Landing copy

Texto autodidáctico, autodemostrable, self-onboarding. Diseñado para que un GP que entra desde un link pueda entender el producto, decidir si le sirve y crear su cuenta sin hablar con nadie.

Idioma: español rioplatense neutro. Tono: founder-direct, sin corporate-speak. Cada sección termina apuntando al mismo CTA: **Probalo en 5 min**.

Paleta y tipografía siguen `tailwind.config.ts`: navy `#0A1F44`, gold `#F4B740`, teal `#14B8A6`, coral `#EF4444`, paper `#F7F8FB`. Georgia para titulares, system-ui sans para body.

---

## 1. Hero

**Eyebrow** (gold, uppercase, tracking-wide):
> Portfolio OS para LATAM VC

**H1** (Georgia 56–64px, navy):
> El portfolio es tu producto. No deberías construirlo en Excel.

**Subhead** (sans 18–20px, navy/600, max-w 56ch):
> Pulso reemplaza Excel, Gmail y Drive con un sistema operativo para tu fondo: KPIs trimestrales, formularios para founders, cartas a LPs y watch list automática. Construido por y para fondos de venture capital en LATAM.

**CTA primary** (gold button, navy text):
> Probalo en 5 min →

**CTA secondary** (link, navy):
> Ver el dashboard demo

**Trust line** (muted, 13px, debajo de CTAs):
> Sin tarjeta. Sin demo. Sin sales call.

**Visual al lado del hero**: screenshot del dashboard real (`/dashboard`) en un mockup de laptop, ligeramente inclinado. Sombra suave (`shadow-cardHover`).

---

## 2. Problema (3 cards, fondo paper)

**Section title** (Georgia 36px, navy):
> Cómo manejás tu portfolio hoy

Tres cards, cada una con número en coral (`01`, `02`, `03`), título en navy, body en ink.

**01 · Excel se está rompiendo**
> Una hoja por trimestre. Fórmulas que nadie recuerda. Versiones distintas en cada laptop del equipo. Cada cierre se siente como arqueología.

**02 · Gmail es tu CRM**
> Persigue founders por WhatsApp y mail para que manden los KPIs. Mitad llegan tarde, mitad en formatos distintos. Reconciliar los números es manual.

**03 · Las cartas a LPs viven en Drive**
> Word + PDF. Sin tracking de quién leyó qué. Sin watermark. Cuando cambia un número en una company, hay que rehacer la carta entera a mano.

**Sub-callout** (Georgia italic 18px, navy/600, centrado):
> El portfolio es tu producto. No deberías construirlo en Excel.

---

## 3. Stats / costo (4 columnas)

**Section title** (Georgia 36px, navy):
> Lo que te está costando hoy

Cuatro stats en cards blancas con barra superior de color (coral / gold / coral / navy600).

| Stat | Caption |
|---|---|
| **6h** /sem | persiguiendo KPIs por mail |
| **3 días** | para cerrar la carta del trimestre a LPs |
| **40%** | de companies sin métricas al día en Q+30 |
| **$0** | de visibilidad sobre qué LP leyó tu carta |

**Footer line** (Georgia italic 16px, navy/600):
> Para un fondo de 12 companies, son ~300 horas/año en tareas que un sistema debería resolver.

---

## 4. Producto (4 features, layout asimétrico)

**Eyebrow** (gold uppercase):
> El producto

**H2** (Georgia 40px, navy):
> Una sola fuente de verdad para tu portfolio.

Cuatro features alternando lado: imagen-izquierda/texto-derecha, luego texto-izquierda/imagen-derecha, etc. Cada una con un número grande en teal/600 al inicio.

### 1 · Dashboard
> El estado del fondo, en 30 segundos.
>
> KPIs agregados (capital invertido, ARR, runway, watch list), gráfico de ARR por company, y una watch list que se llena sola cuando el burn supera el runway o el ARR cae dos trimestres seguidos. Sin reconciliar nada.

**Imagen**: screenshot de `/dashboard` con KPI cards y bar chart.

### 2 · Companies
> Ficha por startup, métricas históricas, founders.
>
> Cada company tiene su página: métricas trimestrales (ARR, burn, cash, headcount), founders con foto y LinkedIn, cap table simplificado, y links a deal docs. Comparable contra mediana de tu cohorte por stage y sector.

**Imagen**: screenshot de `/companies/[slug]`.

### 3 · Forms con AI
> El founder responde, vos validás.
>
> Mandás un form (link directo, sin login del lado del founder). Cuando responde, AI valida los números contra trimestres anteriores y flagea anomalías: "burn subió 22% QoQ — confirmá causa", "runway < 8 meses si no cierra ronda en 60 días". Cada respuesta queda atada a la company. Los flags ya están priorizados cuando abrís el dashboard.

**Imagen**: split-screen del form (founder side) y el panel de AI flags (GP side).

### 4 · LP Portal
> Cartas trimestrales con watermark, una sola fuente.
>
> Generás la carta una vez basada en datos del fondo (no copiás ningún número). Compartís un link por LP, cada uno con watermark de su email. Trackeás aperturas. Si cambia un número en una company, la carta se regenera sola.

**Imagen**: screenshot de `/share/[token]` con watermark visible.

---

## 5. Self-onboarding (timeline interactivo)

**Eyebrow** (gold uppercase):
> Self-onboarding

**H2** (Georgia 40px, navy):
> 5 minutos hasta tu primer KPI en pantalla.

**Subhead** (sans 18px, navy/600):
> Sin demo, sin sales call. Sign up con tu mail y el seed dataset (Patagonia Fund I, 8 companies, 64 métricas trimestrales) ya está cargado para que veas el producto real, no un mockup.

Timeline horizontal con 5 pasos, cada uno con chip de tiempo en teal/50:

| Tiempo | Paso | Detalle |
|---|---|---|
| **00:00** | Sign up | Email + magic link. Sin tarjeta. |
| **01:00** | Tu fondo, listo | Patagonia I cargado como ejemplo. Lo renombrás en Settings. |
| **02:30** | Primer KPI | Abrís el dashboard: $22.4M desplegados, 8 companies, ARR agregado. |
| **04:00** | Primer form | Un click → URL que mandás al founder. Los datos vuelven a Pulso. |
| **05:00** | Primer share a LP | Generás un share link con watermark del email del LP. |

**CTA** (gold, centrado debajo):
> Empezar ahora →

---

## 6. Por qué LATAM (sección dark)

**Section title** (Georgia 36px, white sobre navy):
> Hecho para fondos de LATAM, no traducido.

Cuatro bloques con barra lateral gold:

**USD + ARS + BRL + CLP + MXN**
> Cada company puede reportar en su moneda. Conversión al cierre del trimestre, no al day-one. Los reportes a LPs salen en USD pero podés ver cada company en local.

**Español y portugués**
> Founders responden los forms en su idioma. La carta a tus LPs gringos sale en inglés con un click — Pulso traduce manteniendo los números intactos.

**Founder relationships**
> Los founders LATAM no quieren otro Notion ni una herramienta gringa que les pidan instalar. Pulso es minimal: tres campos, dos minutos, lo guardan.

**Tu data, en tu Postgres**
> Supabase + Row Level Security por fondo. Si te vas, te llevás un dump SQL. Sin lock-in, sin "exportá un CSV y rezá".

**Footer** (Georgia italic 14px, gold):
> Construido por un GP de LATAM, para fondos de LATAM. No es un producto americano con i18n.

---

## 7. Pricing (3 tiers)

**Section title** (Georgia 36px, navy):
> Pricing: por fondo, no por seat.

**Subhead** (sans 16px, muted):
> Si tu fondo crece, vos pagás más, no tu equipo.

### Starter — **$0**
Hasta 5 companies.
- Dashboard + Companies
- 1 form template
- 1 LP, sin watermark
- Soporte por comunidad

> CTA: **Empezar gratis →**

### Growth — **$890** /mes  *Recomendado*
Hasta 20 companies.
- Todo Starter
- Forms ilimitados con AI
- LP portal con watermark
- Tracking de cartas
- Soporte directo del equipo (email + WhatsApp)

> CTA: **Empezar 14 días free →**

### Platform — **Custom**
Fondos > 20 companies.
- Todo Growth
- SSO + RBAC
- Postgres dedicado
- API + webhooks
- On-prem opcional

> CTA: **Hablanos →**

**Compare row** debajo (link discreto):
> ¿Compartimos características? Mirá la tabla completa.

---

## 8. FAQ (acordeón, 6 preguntas)

**Q: ¿Mis datos están seguros?**
Sí. Supabase con RLS scope-by-fondo, encriptación at-rest y in-transit, y backups diarios. Te podés llevar un dump SQL en cualquier momento. Si querés on-prem, te lo deployamos en tu cloud (tier Platform).

**Q: ¿Qué pasa con los founders? ¿Tienen que crear cuenta?**
No. Reciben un link único al form. Lo abren, responden 4–8 campos, listo. Sin login, sin instalar nada. Si querés, después podés invitarlos a ver su company page.

**Q: ¿La AI alucina números?**
La AI no genera datos: valida los que el founder ingresa contra históricos del propio Pulso y flagea inconsistencias. Vos seguís siendo dueño del juicio final — Pulso solo te ahorra el trabajo de revisar tres trimestres en otra pestaña.

**Q: ¿Soporta moneda local?**
Sí. Cada company tiene su moneda primaria. Pulso convierte a USD usando el tipo de cambio del último día del trimestre (BCRA / BCB / etc.). Podés ver cada KPI en local o en USD con un toggle.

**Q: ¿Cómo importo desde Excel?**
Subís el archivo. Pulso intenta mapear columnas automáticamente; lo que no reconoce, te pide que lo confirmes. Cinco minutos para 8 companies × 4 trimestres. Si tu Excel es horrible, te ayudamos en el chat (tier Growth+).

**Q: ¿Puedo probarlo sin pagar?**
Sí. Starter es gratis para siempre hasta 5 companies. Growth tiene 14 días free, sin tarjeta para empezar. Todo el seed data del demo está disponible para que juegues sin compromiso.

---

## 9. Footer / segundo CTA (sección navy)

**H2** (Georgia 48px, white, centrado):
> Probalo en 5 minutos.<br>Sin demo, sin sales call.

**CTA primary** (gold button, navy, grande):
> Crear cuenta →

**Sub-CTA** (link, white):
> Mandar pregunta a Simon (GP) · simon@pulso.app

**Footer estándar**:
- Logo Pulso (mono-white) izquierda
- Links: Producto · Pricing · FAQ · Status · Privacidad · Términos
- "Hecho en Buenos Aires · 2026"
- Copy: © 2026 Pulso

---

## Notas de implementación

**Componentes a crear** (Next.js App Router, server-first):
- `app/(landing)/page.tsx` — composición de secciones
- `components/landing/Hero.tsx`
- `components/landing/Problem.tsx`
- `components/landing/Stats.tsx`
- `components/landing/Feature.tsx` (recibe lado izq/der como prop)
- `components/landing/Onboarding.tsx`
- `components/landing/Latam.tsx` (dark section)
- `components/landing/Pricing.tsx`
- `components/landing/FAQ.tsx` (cliente, acordeón)
- `components/landing/FooterCTA.tsx`

**Imágenes necesarias**:
- Hero: screenshot real de `/dashboard` con datos de Patagonia Fund I
- Feature 1: misma del hero, con zoom a la watch list
- Feature 2: `/companies/tienda`
- Feature 3: split de `/fill/[id]` (founder) + panel de flags
- Feature 4: `/share/[token]` con watermark visible

**SEO**:
- `<title>`: "Pulso — Portfolio OS para LATAM VC"
- `<meta description>`: "Reemplazá Excel, Gmail y Drive con un sistema operativo para tu fondo. KPIs, formularios para founders, cartas a LPs. Probalo en 5 minutos."
- OG image: cover del deck (slide 1) exportado a PNG 1200×630

**Analytics events** (Plausible/PostHog):
- `landing_view` (1x)
- `cta_click` con prop `location` ("hero" | "onboarding" | "footer" | "pricing-{tier}")
- `faq_open` con prop `question`
- `signup_start` (cuando hacen click en cualquier CTA primario)

**Performance**:
- Hero screenshot: WebP + AVIF, lazy load por debajo del fold
- Las 4 imágenes de features: `next/image` con `loading="lazy"` y `placeholder="blur"`
- Sin animaciones en mobile (preferencia de movimiento + perf)
- Total page weight target: < 350KB
