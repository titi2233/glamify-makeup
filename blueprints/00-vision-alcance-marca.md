# 00 — Visión, alcance y marca

> **Propósito:** fijar el "norte" del proyecto antes de tocar datos, diseño o código. Qué es Glamify, para quién, qué vamos a construir (y qué no), y cómo sabremos que salió bien.
>
> Estado: ✅ **aprobado** (estructura; datos de §12 a completar) · Fecha: 2026-06-03

---

## 1. Propuesta de valor

**Glamify Makeup** vende maquillaje y accesorios con foco en **accesibilidad, resultados visibles y tendencia**, para chicas que quieren verse bien sin gastar de más ni navegar un catálogo insoportable.

No compite por "lujo" ni por "profesionalismo aspiracional vacío". Compite por:
- **bueno, bonito y barato**
- productos que se entienden rápido
- looks y resultados visibles
- compra impulsiva y reposición frecuente
- compra fácil por redes y feria

En una línea: **glam accesible**, estética cuidada pero no intimidante, lógica de venta pensada para rotación rápida.

## 2. Misión y visión

- **Misión:** hacer que el maquillaje y los accesorios lindos, usables y en tendencia estén al alcance de chicas que quieren verse mejor sin complicarse ni pagar de más.
- **Visión:** marca local fuerte y recordable (Luján y alrededores), con comunidad propia, venta recurrente por web/redes, presencia en ferias y un catálogo ordenado por rotación.

## 3. ADN de marca y tono de voz

**Tono:** cercano, femenino, directo, vendedor pero no pesado, moderno. Energía de *"te muestro algo lindo y práctico"*, **nada de humo**.

**Pilares diferenciales:**
1. **Accesibilidad real** — precios de compra impulsiva + combos de feria.
2. **Resultados visibles** — mostrar cómo queda, no prometer.
3. **Tendencia + practicidad** — formatos que resuelven rápido (lip combos, sorpresitas, rubor, labiales, máscara, arqueador).
4. **Compra fácil** — cero fricción (IG, TikTok, WhatsApp, web, feria).
5. **Estética cuidada** — *girly clean + acento glam + color puntual* (paleta rosa). Identidad sólida, no reventa genérica.
6. **Rotación y margen** — todo empuja rentabilidad, no solo likes.

> **Implicancia para el ecommerce:** la marca dice "resultados reales, no humo". Esto **prohíbe** patrones oscuros falsos (stock/contadores truchos) — además de chocar con la ley (ver §9). Toda la persuasión del sitio se construye sobre datos **reales** (ver blueprint 06).

## 4. Público objetivo (personas)

- **Núcleo (16–24):** compran por impulso, estética, tendencia y precio. Quieren verse lindas rápido y gastar poco.
- **Secundario (25–35):** más reposición; buscan algo útil, rendidor y fácil de llevar; responden a combos funcionales.
- **Público feria:** consumo emocional, visual y espontáneo (niñas con acompañante, chicas que gastan más por combo).

**Qué buscan:** algo lindo sin analizar demasiado, que se vea bien en mano y puesto, precio accesible, combos convenientes, "me lo llevo ahora", novedades.

**Comportamiento de compra (hoy):** cierran por DM/WhatsApp y presencial; reaccionan a ofertas simples; necesitan ver el resultado; sensibles a urgencia legítima y stock limitado; prefieren contenido corto y visual.

> **Implicancia para el ecommerce:** **checkout como invitado** (sin obligar a crear cuenta), mobile-first, fotos/resultados grandes, decisión simplificada con combos y precios claros. El sitio tiene que **bajar la fricción** que hoy resuelve el DM.

## 5. Modelo de negocio

- **Productos** (líneas prioritarias): sorpresitas de feria, labial mate, labial gloss, máscara/arqueador, rubor. Baja rotación a reposicionar: delineadores, polvos, esponjas, brochas, bases/correctores, iluminadores.
- **Canales:** feria (fines de semana), IG/TikTok, WhatsApp/DM, y ahora **web propia** (este proyecto).
- **Margen:** **100%+** sobre costo en cada producto → habilita combos, promos controladas y absorber envío gratis sobre umbral.
- **Dinámicas comerciales:** sorpresitas (entrada barata/gancho), combos/bundles para subir ticket, anclaje de precio.

## 6. Objetivos del ecommerce

**Corto plazo**
- Convertir el tráfico de IG/TikTok en ventas web (link en bio → compra sin pasar por DM).
- Subir ticket promedio con combos y umbral de envío gratis.
- Catálogo ordenado por rotación; "héroes" bien visibles.

**Mediano plazo**
- Venta web estable más allá de la feria.
- Recurrencia/recompra (clientas que vuelven).
- Identidad visual sólida y reconocible.

**Largo plazo**
- Marca local fuerte y recordable, con ingresos más predecibles y un sistema de ventas que no dependa del clima ni del ánimo del día.

## 7. Métricas de éxito (KPIs)

> ⚠️ **Faltan números reales** (ver §12). Propongo el set de KPIs; los targets los completás vos cuando tengamos datos.

| KPI | Definición | Target inicial (a definir) |
|-----|-----------|----------------------------|
| Tasa de conversión web | pedidos / visitas | _TBD_ |
| Ticket promedio (AOV) | $ promedio por pedido | _TBD_ |
| % pedidos con envío gratis | pedidos ≥ umbral / total | _TBD_ |
| Carritos recuperados | recuperados / abandonados | _TBD_ |
| Recompra | clientas con ≥2 pedidos | _TBD_ |
| Stock crítico | SKUs bajo mínimo | minimizar |

## 8. Alcance (qué SÍ y qué NO)

**Fase 1 — tienda completa y excelente (entra):**
- Storefront: home, catálogo con filtros/búsqueda, ficha de producto, carrito, checkout invitado.
- Cobro con Mercado Pago Checkout Pro.
- Envíos: cálculo por código postal (Correo Argentino) + tabla de zonas editable + retiro en persona + envío gratis sobre umbral.
- Panel de la dueña: CRUD de productos, control de stock, gestión de pedidos y envíos, promos/cupones, dashboard simple.
- Conversión real: stock bajo real, barra de envío gratis, combos con anclaje, reseñas, carrito abandonado, upsell.
- Cimientos: SEO, Open Graph, analytics, código testeado.

**Fase 2 — lujos (NO entra ahora):**
- Checkout embebido on-site (MP Bricks).
- Programa de puntos/fidelidad.
- API viva de Correo si no está disponible el día 1 (se arranca con tabla de zonas).
- PWA / experiencia app-like.

## 9. Restricciones y "la verdad sobre gratis"

- ✅ **Gratis:** Supabase (free tier), dominio ya comprado, código propio, sin comisión de plataforma.
- ⚠️ **Mercado Pago cobra comisión por venta** — inevitable en cualquier solución.
- ✅ **Cloudflare Workers (free):** hosting gratuito con uso comercial permitido. 100K req/día, assets estáticos ilimitados. Si el tráfico crece: Workers Paid ($5/mes).
- **Legal (Argentina):** rige la **Ley 24.240 (Defensa del Consumidor)** y Lealtad Comercial → prohibido scarcity/urgencia falsa, precios engañosos y costos ocultos. La persuasión va sobre datos reales.
- **Operación:** la dueña gestiona sola; la UX del panel debe ser **"que la entienda un nene"**.
- **Volumen:** hoy bajo (poco stock y pocas ventas). Diseñamos para **crecer**, sin sobre-ingeniería para escala que no existe aún.

## 10. Decisiones y supuestos

- Build **custom** (no plataforma).
- **Mercado Pago Checkout Pro** para cobro (Fase 1).
- **Correo Argentino** operador principal de envíos.
- Dominio **`glamifymakeup.site`**.
- **Sin deadline** — se prioriza calidad sobre lanzar rápido.
- SKU **autogenerado** (la dueña no piensa en eso).
- **Mercado:** Argentina, ARS, español (sin multi-moneda/idioma; se deja preparado).
- **Variantes de producto:** soportadas (tono/color con stock y SKU propios); también productos sin variantes.
- **Compra:** checkout como **invitado** + **cuenta opcional** (historial, favoritos, recompra).
- **WhatsApp:** botón de **consultas** en el sitio; la venta se cierra en la web.
- **Alcance inicial:** core de Fase 1 completo; lujos de Fase 2 (puntos, Bricks, PWA) quedan para después.

## 11. Riesgos (del análisis FODA, adaptados a la web)

- **Dispersión de marca** → unificar estética girly-clean (blueprint 02).
- **Baja rotación traba caja** → exhibición/bundles para esos SKUs (blueprint 06).
- **Dependencia de impulso** → recompra y email/WhatsApp marketing (06).
- **Competencia por precio** → diferenciar por marca, combos y experiencia, no por guerra de precios.
- **Atención manual** → la web automatiza el cierre que hoy se hace a mano en DM.

## 12. Datos a completar (para cerrar este blueprint)

Para afinar KPIs, pricing y prioridades necesito (cuando tengas):
- Ventas mensuales promedio (aprox).
- Lista de productos reales con **precio de venta** y **costo** por unidad.
- Ticket promedio actual (feria y DM).
- Si hay clientas recurrentes y cuánto compran.
- Cuánto deja neto una feria típica.

> Nada de esto bloquea avanzar: podemos seguir con el 01 (datos) en paralelo y volver a completar acá.

---

## Preguntas abiertas de este documento

1. ¿El alcance Fase 1 / Fase 2 te cierra, o movés algo de fase?
2. ¿Querés agregar algún objetivo o KPI que no esté?
3. ¿Hay algo de la marca (tono, pilares) que ajustarías para la web?
