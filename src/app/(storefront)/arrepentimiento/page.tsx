import type { Metadata } from "next";
import { Prose } from "@/components/legal/prose";
import { businessInfo } from "@/lib/legal/business-info";
import { RetractionForm } from "./retraction-form";

export const metadata: Metadata = {
  title: "Botón de Arrepentimiento",
  description:
    "Ejercé tu derecho de arrepentimiento (art. 34 Ley 24.240). Tenés 10 días corridos para revocar tu compra sin costo.",
};

export default function ArrepentimientoPage() {
  return (
    <Prose>
      <h1>Botón de Arrepentimiento</h1>
      <p>
        De acuerdo con el art. 34 de la Ley 24.240 de Defensa del Consumidor y la Resolución 424/2020 de la
        Secretaría de Comercio Interior, podés revocar tu compra dentro de los{" "}
        <strong>{businessInfo.retractionDays} días corridos</strong> desde la recepción del producto o desde la
        celebración del contrato (lo que ocurra último), sin necesidad de justificar tu decisión y sin costo alguno.
      </p>

      <h2>Cómo ejercer tu derecho</h2>
      <ul>
        <li>Completá el formulario con tus datos y el número de pedido (si lo tenés a mano).</li>
        <li>
          Al enviar la solicitud vas a recibir un <strong>número de constancia</strong> en pantalla.
        </li>
        <li>Te contactamos por email para coordinar la devolución del producto y el reintegro del importe.</li>
        <li>
          El producto debe devolverse en las mismas condiciones en que lo recibiste. El reintegro se realiza una
          vez recibida la devolución, por el mismo medio de pago utilizado.
        </li>
      </ul>

      <h2>Reclamos ante Defensa del Consumidor</h2>
      <p>
        Si necesitás asistencia, podés iniciar un reclamo en{" "}
        <a href={businessInfo.consumerDefenseUrl} target="_blank" rel="noopener noreferrer">
          la Ventanilla Única de Defensa del Consumidor
        </a>
        .
      </p>

      <h2>Solicitud de arrepentimiento</h2>
      <RetractionForm />
    </Prose>
  );
}
