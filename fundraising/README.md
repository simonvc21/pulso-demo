# Pulso · Fundraising kit

Carpeta con todos los documentos para levantar la pre-seed/seed de Pulso.

> **Estado actual de la ronda:** Pre-seed · Target USD 500.000 · SAFE @ $5M cap, 20% discount.
> **Última actualización:** 2026-05-02

---

## Cómo usar esta carpeta

Tres tipos de docs adentro, con prioridad y orden de uso:

1. **`01-one-pager.docx`** — el primer doc que mandás. Va por mail antes de cualquier call con un investor. Una página A4. Editable.
2. **`02-financial-model.xlsx`** — proyección 24 meses. La compartís con investors que ya pasaron el primer filtro. Editable: cambiá las celdas en azul de la tab `Assumptions`.
3. **`03-cap-table.xlsx`** — capitalización actual + simulación post-ronda. La compartís con quien va a invertir en serio.
4. **`04-ip-assignment-founder.docx`** — cesión de propiedad intelectual del founder a la sociedad. **Firmalo lo antes posible**, idealmente en la incorporación de la sociedad. Es el doc legal más barato y el que más cuesta arreglar después.
5. **`05-founders-agreement.docx`** — vesting (4y/1y cliff), roles, equity, departure clauses. Aplica especialmente con co-fundadores. Si sos solo founder, igual te sirve para alinear con la Sociedad y mostrar a inversores que el vesting está pactado.
6. **`06-mutual-nda.docx`** — NDA mutuo para usar **solo cuando un investor pida números detallados antes de seguir el proceso**. Heads-up: la mayoría de VCs top no firman NDAs antes del term sheet. No lo uses con todos.

Los 4 docx son **templates con placeholders entre [BRACKETS]**. Antes de firmar nada, revisión legal obligatoria.

---

## Status de cada doc

| # | Doc | Status | Acción siguiente |
|---|---|---|---|
| 01 | one-pager.docx | ✅ Listo | Ajustar nombre de empresa anterior + revisar números de mercado |
| 02 | financial-model.xlsx | ✅ Listo | Calibrar assumptions con tu ICP real |
| 03 | cap-table.xlsx | ✅ Listo | Cargar SAFE de Roberto cuando firme |
| 04 | ip-assignment-founder.docx | 🟡 Template | Revisión abogado · Firmar al incorporar |
| 05 | founders-agreement.docx | 🟡 Template | Revisión abogado · Firmar pre-funding |
| 06 | mutual-nda.docx | 🟡 Template | Revisión abogado · Tener listo para LPs que lo pidan |

---

## Lo que NO está en esta carpeta (todavía)

Estos docs los vas a necesitar a medida que avance la ronda. Los armamos cuando llegue el momento — no antes, pierdas tiempo:

| Doc | Cuándo lo vas a necesitar |
|---|---|
| **Pitch deck** | Ya está en `/brand/pulso-pitch-deck.pptx` ✅ |
| **SAFE template firmado** | Cuando un investor diga sí. Usá [Y Combinator post-money SAFE](https://www.ycombinator.com/documents/) — no escribas el tuyo. |
| **Investor outreach tracker** | Empezás a contactar 10+ investors. Hojita con: nombre, fondo, intro_via, status, last_contact, notes. Te puedo armar uno cuando arranques outreach. |
| **Customer reference list** | A partir de Series A. 3-5 founders/usuarios que acepten hablar con el VC. |
| **Security questionnaire response** | Cuando un fondo te haga DD técnica. SOC 2 readiness no antes de Seed institucional. |
| **Estados financieros formales** | Cuando tengas $20K+ MRR. Antes de eso, tu modelo + bank statements alcanzan. |
| **Estructura Delaware C-Corp** | Si vas a levantar de un VC USA, antes de la Seed institucional. Lawyer + Stripe Atlas o Gunderson. |
| **Cláusula de no competencia con empleados** | Cuando contrates Eng 1. |
| **Privacy policy + Terms of service** | Cuando empieces a aceptar customers pagos. Borrowea de algún SaaS conocido y adaptá. |

---

## Decisiones legales que tenés que tomar antes de la primera firma

### 1. ¿Sociedad LATAM o Delaware C-Corp?

| | LATAM (S.A. / S.A.S.) | Delaware C-Corp |
|---|---|---|
| **Costo setup** | $1-3K | $5-15K (con flippeo) |
| **VCs USA invertirán?** | Difícil | Sí |
| **Founders LATAM viven en…** | Local | Cualquier lugar |
| **Cuándo sirve** | Si tu mercado es 100% LATAM y vas a fundraising local | Si planeás VC USA en algún momento |

**Para Pulso:** vas a querer flippear a Delaware antes de la Seed institucional. Cuanto antes, menos costoso. Pero para pre-seed con angels LATAM podés arrancar local y flippear después.

### 2. SAFE post-money vs pre-money?

YC cambió a post-money SAFE en 2018. Es el estándar hoy. Calculás dilución en el mismo SAFE; menos sorpresas en la conversión. **Usá post-money SAFE.**

### 3. Valuation cap vs MFN sin cap?

- **Cap fijo:** clarito para todos. Más fácil cerrar. Riesgo: si hacés Seed muy grande, los SAFEs convierten a un % chico.
- **MFN (Most Favored Nation) sin cap:** el SAFE adopta el cap del próximo SAFE/round. Útil si no sabés a qué valuation cerrar.

**Para Pulso:** cap fijo $5M post-money. Es el mid del rango pre-seed LATAM 2026 ($3M-$8M). Discount 20% es estándar.

---

## Convenciones del kit

- **Idioma:** español rioplatense neutro (los docs legales también — la versión en inglés se traduce cuando flipean a Delaware).
- **Marca:** todos los docs llevan logo Pulso (top-left), navy + gold + teal, Georgia para titulares.
- **Templates:** placeholders entre `[BRACKETS]`. Banner amarillo arriba de cada doc legal indicando que requiere revisión legal.
- **Color de cells (Excel):** azul = input editable, negro = fórmula, verde = link a otra tab, amarillo = assumption clave.

---

## Next steps recomendados (esta semana)

1. **Hoy:** ajustar el one-pager — corregir "[empresa anterior]" por tu trayectoria real, validar el TAM con datos LAVCA 2024.
2. **Hoy:** abrí el financial model. En la tab Assumptions, ajustá las celdas amarillas con tu ICP real. Si tu mes 12 va a ser más conservador (2 nuevos en vez de 4), bajalo. Es preferible underpromise/overdeliver.
3. **Esta semana:** abogado para revisar 04, 05, 06 + decidir Delaware vs local.
4. **Esta semana:** firma 04 (IP assignment) en cuanto incorpores la sociedad. Aunque sea solo, firmá.
5. **Próximas 2 semanas:** primer outreach a 10 angels LATAM con el one-pager + link al demo.
6. **Tracker outreach:** decime cuando arranques, te armo el tracker en una hoja.

---

## Recursos externos útiles

- **YC SAFE templates:** https://www.ycombinator.com/documents/
- **Carta cap table guide:** https://carta.com/learn/equity/cap-tables/
- **LAVCA reports (LATAM VC data):** https://lavca.org/research/
- **Stripe Atlas (Delaware C-Corp en 1 click):** https://stripe.com/atlas
- **Pulley (cap table tool gratis hasta cierta escala):** https://pulley.com
