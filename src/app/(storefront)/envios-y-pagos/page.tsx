import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/legal/prose";
import { businessInfo } from "@/lib/legal/business-info";
import { getFreeShippingThreshold } from "@/lib/orders/checkout-data";
import { formatARS } from "@/lib/money";

export const metadata: Metadata = {
  title: "Envíos y pagos",
  description: "Zonas, costos y plazos de envío, envío gratis y medios de pago en Glamify Makeup.",
};

export default async function EnviosYPagosPage() {
  const threshold = await getFreeShippingThreshold();

  return (
    <Prose>
      <h1>Envíos y pagos</h1>

      <h2>Envíos</h2>
      <p>
        Enviamos a toda la Argentina a través de Correo Argentino, con opción de entrega a domicilio o retiro en
        sucursal. El costo se calcula según tu código postal al momento del checkout.
      </p>
      <ul>
        <li>El costo final se muestra en el carrito y el checkout antes de pagar.</li>
        <li>Despacho dentro de las 24 a 72 horas hábiles de acreditado el pago.</li>
        <li>Recibís el número de seguimiento por email cuando despachamos.</li>
      </ul>

      <h2>Envío gratis</h2>
      <p>
        Tenés <strong>envío gratis</strong> en compras desde {formatARS(threshold)}. En el carrito te mostramos
        cuánto te falta para alcanzarlo.
      </p>

      <h2>Medios de pago</h2>
      <p>
        Aceptamos {businessInfo.paymentMethods}. El pago se procesa de forma segura con Mercado Pago (Checkout Pro);
        Glamify Makeup no almacena los datos de tu tarjeta.
      </p>

      <h2>Cambios y devoluciones</h2>
      <p>
        Podés ejercer el derecho de arrepentimiento dentro de los {businessInfo.retractionDays} días corridos desde el{" "}
        <Link href="/arrepentimiento">Botón de Arrepentimiento</Link>. Para cualquier consulta, escribinos por{" "}
        <Link href="/contacto">contacto</Link>.
      </p>
    </Prose>
  );
}
