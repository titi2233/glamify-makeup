import type { Metadata } from "next";
import Link from "next/link";
import { Prose } from "@/components/legal/prose";
import { businessInfo } from "@/lib/legal/business-info";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Cómo Glamify Makeup trata y protege tus datos personales (Ley 25.326).",
};

export default function PrivacidadPage() {
  return (
    <Prose>
      <h1>Política de Privacidad</h1>
      <p>
        En Glamify Makeup protegemos tus datos personales conforme a la Ley 25.326 de Protección de los Datos
        Personales. Esta política explica qué datos recolectamos, con qué fin y cuáles son tus derechos.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li>Titular: {businessInfo.legalName}</li>
        <li>CUIT/CUIL: {businessInfo.taxId}</li>
        <li>Domicilio: {businessInfo.address}</li>
        <li>Contacto: {businessInfo.email}</li>
      </ul>

      <h2>2. Datos que recolectamos</h2>
      <ul>
        <li>Datos de contacto: nombre, email, teléfono.</li>
        <li>Datos de pedido y envío: dirección, localidad, código postal.</li>
        <li>Datos de navegación: páginas vistas y eventos de uso (analítica).</li>
      </ul>
      <p>No recolectamos ni almacenamos datos de tarjetas: el pago lo procesa Mercado Pago.</p>

      <h2>3. Finalidad</h2>
      <p>
        Usamos tus datos para procesar pedidos y envíos, brindar soporte, cumplir obligaciones legales y —si lo
        consentís— enviarte comunicaciones de marketing y recuperar carritos.
      </p>

      <h2>4. Base legal y consentimiento</h2>
      <p>
        El tratamiento se basa en la ejecución del contrato de compra y en tu consentimiento para las comunicaciones
        comerciales y la analítica. Podés retirar el consentimiento en cualquier momento.
      </p>

      <h2>5. Destinatarios</h2>
      <p>
        Compartimos datos solo con proveedores necesarios para operar: Mercado Pago (pagos), Correo Argentino u otro
        operador logístico (envíos), Resend (emails), Supabase y Cloudflare (infraestructura) y PostHog (analítica).
        No vendemos tus datos a terceros.
      </p>

      <h2>6. Tus derechos (ARCO)</h2>
      <p>
        Tenés derecho a acceder, rectificar, actualizar y suprimir tus datos. Para ejercerlos, escribinos a{" "}
        {businessInfo.email}. El titular de los datos puede ejercer el derecho de acceso en forma gratuita a
        intervalos no inferiores a seis meses (art. 14, inc. 3, Ley 25.326).
      </p>

      <h2>7. Conservación</h2>
      <p>
        Conservamos los datos mientras dure la relación comercial y los plazos legales aplicables (por ejemplo,
        obligaciones fiscales y contables).
      </p>

      <h2>8. Baja de comunicaciones</h2>
      <p>
        Podés darte de baja de los emails de marketing en cualquier momento desde el enlace del correo o
        escribiéndonos a {businessInfo.email}.
      </p>

      <h2>9. Cookies y analítica</h2>
      <p>
        Usamos analítica (PostHog) con un banner de consentimiento. Podés rechazar la captura desde ese banner; la
        decisión se guarda en tu navegador.
      </p>

      <h2>10. Autoridad de control</h2>
      <p>
        La Agencia de Acceso a la Información Pública (AAIP), órgano de control de la Ley 25.326, tiene la atribución
        de atender denuncias y reclamos respecto del incumplimiento de las normas sobre protección de datos
        personales. Más información y nuestra{" "}
        <Link href="/terminos">información de contacto</Link> están disponibles en el sitio.
      </p>
    </Prose>
  );
}
