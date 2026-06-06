/** Fuente única de datos del negocio para páginas legales/contenido.
 *  Completar los [COMPLETAR] antes del launch (ver docs/LAUNCH.md). */
export const PLACEHOLDER_PREFIX = "[COMPLETAR";

export const businessInfo = {
  legalName: "[COMPLETAR: razón social o nombre y apellido del/la titular]",
  taxId: "[COMPLETAR: CUIT/CUIL]",
  taxCondition: "[COMPLETAR: condición fiscal (ej. Monotributo)]",
  address: "[COMPLETAR: domicilio comercial/legal]",
  email: "[COMPLETAR: email de contacto]",
  whatsapp: "[COMPLETAR: WhatsApp con código país, ej. +54 9 11 ...]",
  jurisdiction: "[COMPLETAR: jurisdicción (ej. Tribunales Ordinarios de la Pcia. de Buenos Aires)]",
  retractionDays: 10,
  paymentMethods: "[COMPLETAR: medios de pago aceptados (ej. Mercado Pago: tarjetas y dinero en cuenta)]",
  consumerDefenseUrl: "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario",
} as const;

export type BusinessInfo = typeof businessInfo;
