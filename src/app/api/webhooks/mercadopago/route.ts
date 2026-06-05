import { NextResponse } from "next/server";
import { processWebhook, defaultWebhookDeps } from "@/lib/orders/webhook-service";

/** Webhook de Mercado Pago (blueprint 04 §2/§7). Verifica firma + consulta el pago a MP. */
export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  let dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // MP a veces postea sin body parseable; el data.id de la query alcanza.
  }
  if (!dataId && body && typeof body === "object" && "data" in body) {
    const data = (body as { data?: { id?: string | number } }).data;
    if (data?.id != null) dataId = String(data.id);
  }

  // Ignorar notificaciones que no son de pago (ej. merchant_order) sin id de pago.
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? (body as { type?: string } | null)?.type;
  if (!dataId || (type && type !== "payment")) {
    return NextResponse.json({ ok: true, detail: "ignored" }, { status: 200 });
  }

  const result = await processWebhook(
    { dataId, xSignature: request.headers.get("x-signature"), xRequestId: request.headers.get("x-request-id") },
    defaultWebhookDeps(),
  );
  return NextResponse.json({ ok: result.status === 200, detail: result.detail }, { status: result.status });
}
