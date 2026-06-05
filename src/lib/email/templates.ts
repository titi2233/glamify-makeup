import { formatARS } from "@/lib/money";

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
  const subject = oversell
    ? `⚠️ Nuevo pedido ${d.orderNumber} — REVISAR STOCK`
    : `🛍️ Nuevo pedido pagado ${d.orderNumber} (${formatARS(d.total)})`;
  const oversellHtml = oversell
    ? `<div style="background:#FEE;padding:8px;border-radius:8px">
        <strong>Oversell:</strong> sin stock suficiente para:
        <ul>${d.oversoldLines!.map((l) => `<li>${l.name}</li>`).join("")}</ul>
        Coordinar con la clienta por WhatsApp.
      </div>`
    : "";
  const html = `<div style="font-family:sans-serif;color:#6E0B3F">
    <h1>Nuevo pedido ${d.orderNumber}</h1>
    ${oversellHtml}
    <p>Cliente: ${d.contactName} — ${d.contactEmail}</p>
    <table style="width:100%;border-collapse:collapse">${itemsHtml(d.items)}</table>
    <table style="width:100%;border-collapse:collapse">${totalsBlock(d)}</table>
    <p>Envío: ${d.shippingMethod}.</p>
  </div>`;
  const text = `Nuevo pedido ${d.orderNumber}\nCliente: ${d.contactName} (${d.contactEmail})\nTotal: ${formatARS(d.total)}${oversell ? `\n⚠️ OVERSELL: ${d.oversoldLines!.map((l) => l.name).join(", ")}` : ""}`;
  return { subject, html, text };
}
