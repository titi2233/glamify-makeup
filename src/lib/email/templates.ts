import { formatARS } from "@/lib/money";
import { CORREO_TRACKING_URL } from "@/lib/shipping/tracking";

/** Escapa HTML para interpolar texto del usuario en cuerpos de email (anti-inyección). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface OrderEmailItem {
  name: string;
  variantName?: string | null;
  qty: number;
  lineTotal: number;
}
export interface OrderEmailData {
  orderNumber: string;
  contactName: string;
  contactEmail: string;
  items: OrderEmailItem[];
  subtotal: number;
  shippingCost: number;
  discountTotal: number;
  total: number;
  shippingMethod: string;
  oversoldLines?: Array<{ name: string }>;
  /** Monto realmente acreditado por MP (para reconciliar contra `total` en la alerta a la dueña). */
  amountPaid?: number;
  /** Resultado del auto-import a MiCorreo (para avisarle a la dueña si hay que cargarlo a mano). */
  micorreoImport?: { imported: boolean; detail: string };
}
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function itemLabel(it: OrderEmailItem): string {
  return it.variantName ? `${it.name} — ${it.variantName}` : it.name;
}
function itemsHtml(items: OrderEmailItem[]): string {
  return items
    .map((it) => `<tr><td>${itemLabel(it)} × ${it.qty}</td><td style="text-align:right">${formatARS(it.lineTotal)}</td></tr>`)
    .join("");
}
function itemsText(items: OrderEmailItem[]): string {
  return items.map((it) => `- ${itemLabel(it)} × ${it.qty}: ${formatARS(it.lineTotal)}`).join("\n");
}
function totalsBlock(d: OrderEmailData): string {
  const rows = [
    ["Subtotal", d.subtotal],
    ...(d.discountTotal > 0 ? [["Descuento", -d.discountTotal] as const] : []),
    ["Envío", d.shippingCost],
    ["Total", d.total],
  ] as Array<readonly [string, number]>;
  return rows.map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">${formatARS(v)}</td></tr>`).join("");
}

/** Email de confirmación a la clienta. */
export function orderConfirmationEmail(d: OrderEmailData): EmailContent {
  const subject = `¡Gracias por tu compra! Pedido ${d.orderNumber} — Glamify Makeup`;
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1 style="color:#FF2E93">¡Gracias, ${d.contactName}! 💄</h1>
    <p>Recibimos tu pedido <strong>${d.orderNumber}</strong>. Te avisamos cuando lo despachemos.</p>
    <table style="width:100%;border-collapse:collapse">${itemsHtml(d.items)}</table>
    <hr/>
    <table style="width:100%;border-collapse:collapse">${totalsBlock(d)}</table>
    <p>Envío: ${d.shippingMethod}.</p>
    <p>Cualquier duda, escribinos por WhatsApp.</p>
  </div>`;
  const text = `¡Gracias, ${d.contactName}!\nPedido ${d.orderNumber}\n\n${itemsText(d.items)}\n\nSubtotal: ${formatARS(d.subtotal)}\nDescuento: ${formatARS(d.discountTotal)}\nEnvío: ${formatARS(d.shippingCost)}\nTotal: ${formatARS(d.total)}\nEnvío: ${d.shippingMethod}`;
  return { subject, html, text };
}

/** Email de alerta a la dueña (nuevo pedido pagado), con alerta de oversell si corresponde. */
export function newOrderAlertEmail(d: OrderEmailData): EmailContent {
  const oversell = d.oversoldLines && d.oversoldLines.length > 0;
  const amountMismatch = d.amountPaid != null && Math.abs(d.amountPaid - d.total) > 0.01;
  // Sólo cuenta como "no cargado" si sabemos el resultado y fue negativo. Sin dato → no alarmar.
  const notImported = d.micorreoImport != null && !d.micorreoImport.imported;
  const needsReview = oversell || amountMismatch || notImported;
  const subject = needsReview
    ? `⚠️ Nuevo pedido ${d.orderNumber} — REVISAR`
    : `🛍️ Nuevo pedido pagado ${d.orderNumber} (${formatARS(d.total)})`;
  const oversellHtml = oversell
    ? `<div style="background:#FEE;padding:8px;border-radius:8px">
        <strong>Oversell:</strong> sin stock suficiente para:
        <ul>${d.oversoldLines!.map((l) => `<li>${l.name}</li>`).join("")}</ul>
        Coordinar con la clienta por WhatsApp.
      </div>`
    : "";
  const amountHtml = amountMismatch
    ? `<div style="background:#FEE;padding:8px;border-radius:8px">
        <strong>Monto:</strong> MP acreditó ${formatARS(d.amountPaid!)} pero el total del pedido es ${formatARS(d.total)}. Revisar antes de despachar.
      </div>`
    : "";
  const importHtml = notImported
    ? `<div style="background:#FEE;padding:8px;border-radius:8px">
        <strong>MiCorreo:</strong> este envío <strong>NO se cargó solo</strong> (${escapeHtml(d.micorreoImport!.detail)}).
        Entrá al pedido en el panel y tocá "Reintentar carga en MiCorreo", o cargalo a mano.
      </div>`
    : "";
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1>Nuevo pedido ${d.orderNumber}</h1>
    ${oversellHtml}
    ${amountHtml}
    ${importHtml}
    <p>Cliente: ${d.contactName} — ${d.contactEmail}</p>
    <table style="width:100%;border-collapse:collapse">${itemsHtml(d.items)}</table>
    <table style="width:100%;border-collapse:collapse">${totalsBlock(d)}</table>
    <p>Envío: ${d.shippingMethod}.</p>
  </div>`;
  const text = `Nuevo pedido ${d.orderNumber}\nCliente: ${d.contactName} (${d.contactEmail})\nTotal: ${formatARS(d.total)}${oversell ? `\n⚠️ OVERSELL: ${d.oversoldLines!.map((l) => l.name).join(", ")}` : ""}${amountMismatch ? `\n⚠️ MONTO: acreditado ${formatARS(d.amountPaid!)} ≠ total ${formatARS(d.total)}` : ""}${notImported ? `\n⚠️ MiCorreo NO cargó solo: ${d.micorreoImport!.detail}` : ""}`;
  return { subject, html, text };
}

export interface DispatchEmailData {
  orderNumber: string;
  contactName: string;
  trackingNumber: string;
  /** Servicio de envío (ej. "Correo Argentino Clásico"), opcional. */
  service?: string | null;
}

/**
 * Email a la clienta cuando su pedido se despacha (la dueña cargó el tracking).
 * Cumple la promesa publicada en el sitio ("recibís el número de seguimiento por email").
 * Linkea la página de rastreo de Correo Argentino y muestra el número para pegar.
 */
export function shipmentDispatchedEmail(d: DispatchEmailData): EmailContent {
  const subject = `📦 ¡Tu pedido ${d.orderNumber} está en camino! — Glamify Makeup`;
  const svc = d.service ? ` por ${escapeHtml(d.service)}` : "";
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1 style="color:#FF2E93">¡Ya salió, ${escapeHtml(d.contactName)}! 📦</h1>
    <p>Despachamos tu pedido <strong>${escapeHtml(d.orderNumber)}</strong>${svc}.</p>
    <p>Tu número de seguimiento es:</p>
    <p style="font-size:20px;font-weight:bold;color:#FF2E93">${escapeHtml(d.trackingNumber)}</p>
    <p>
      Rastrealo en
      <a href="${CORREO_TRACKING_URL}" style="color:#FF2E93">Correo Argentino</a>
      pegando ese número (puede tardar hasta 24 h en aparecer).
    </p>
    <p>Cualquier duda, escribinos por WhatsApp. 💕</p>
  </div>`;
  const text = `¡Ya salió, ${d.contactName}!\nDespachamos tu pedido ${d.orderNumber}${d.service ? ` por ${d.service}` : ""}.\n\nSeguimiento: ${d.trackingNumber}\nRastrealo en ${CORREO_TRACKING_URL} (puede tardar hasta 24 h en aparecer).`;
  return { subject, html, text };
}

export interface AbandonedCartEmailData {
  name?: string | null;
  items: OrderEmailItem[];
  recoverUrl: string;
}

/** Email de recupero de carrito abandonado (un único recordatorio a 24h). */
export function abandonedCartEmail(d: AbandonedCartEmailData): EmailContent {
  const hi = d.name ? `${d.name}, ` : "";
  const subject = "Te quedó algo en el carrito 💄 — Glamify Makeup";
  const rows = d.items
    .map((it) => `<tr><td>${itemLabel(it)} × ${it.qty}</td><td style="text-align:right">${formatARS(it.lineTotal)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1 style="color:#FF2E93">${hi}¿lo dejamos para después? 💕</h1>
    <p>Guardamos tu carrito. Estos productos te están esperando:</p>
    <table style="width:100%;border-collapse:collapse">${rows}</table>
    <p style="margin-top:16px">
      <a href="${d.recoverUrl}" style="background:#FF2E93;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;display:inline-block">Volver a mi carrito</a>
    </p>
    <p style="font-size:12px;color:#999">Si ya compraste o no te interesa, ignorá este mensaje.</p>
  </div>`;
  const text = `${hi}te quedó algo en el carrito:\n\n${d.items.map((it) => `- ${itemLabel(it)} × ${it.qty}: ${formatARS(it.lineTotal)}`).join("\n")}\n\nVolvé a tu carrito: ${d.recoverUrl}`;
  return { subject, html, text };
}

export interface RetractionEmailData {
  ticket: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  orderNumber?: string | null;
  reason?: string | null;
}

/** Alerta a la dueña: nueva solicitud del Botón de Arrepentimiento (Res. 424/2020). */
export function retractionAlertEmail(d: RetractionEmailData): EmailContent {
  const subject = `📨 Solicitud de arrepentimiento ${d.ticket}`;
  const row = (k: string, v?: string | null) =>
    v ? `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v)}</td></tr>` : "";
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1 style="color:#FF2E93">Solicitud de arrepentimiento ${d.ticket}</h1>
    <p>Un/a consumidor/a ejerció el derecho de arrepentimiento (art. 34 Ley 24.240). Contactalo/a para coordinar la devolución y el reintegro.</p>
    <table style="width:100%;border-collapse:collapse">
      ${row("Nombre", d.contactName)}${row("Email", d.contactEmail)}${row("Teléfono", d.contactPhone)}${row("Pedido", d.orderNumber)}${row("Motivo", d.reason)}
    </table>
  </div>`;
  const text = `Solicitud de arrepentimiento ${d.ticket}\nNombre: ${d.contactName}\nEmail: ${d.contactEmail}\nTeléfono: ${d.contactPhone ?? "-"}\nPedido: ${d.orderNumber ?? "-"}\nMotivo: ${d.reason ?? "-"}`;
  return { subject, html, text };
}

export interface RetractionReceiptData {
  ticket: string;
  date: string;
  contactName: string;
}

/** Constancia al consumidor: comprobante del ejercicio del derecho de arrepentimiento. */
export function retractionReceiptEmail(d: RetractionReceiptData): EmailContent {
  const name = escapeHtml(d.contactName);
  const subject = `Constancia de arrepentimiento ${d.ticket} — Glamify Makeup`;
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1 style="color:#FF2E93">Recibimos tu solicitud 💄</h1>
    <p>Hola ${name}, registramos tu solicitud de arrepentimiento.</p>
    <p>Constancia: <strong>${escapeHtml(d.ticket)}</strong><br/>Fecha: ${escapeHtml(d.date)}</p>
    <p>Te vamos a contactar para coordinar la devolución del producto y el reintegro del importe. Guardá este correo como comprobante.</p>
  </div>`;
  const text = `Recibimos tu solicitud de arrepentimiento.\nConstancia: ${d.ticket}\nFecha: ${d.date}\nTe contactaremos para coordinar la devolución y el reintegro. Guardá este correo como comprobante.`;
  return { subject, html, text };
}
