/** Fuente única de datos del negocio para páginas legales/contenido.
 *  Completar los [COMPLETAR] antes del launch (ver docs/LAUNCH.md). */
export const PLACEHOLDER_PREFIX = "[COMPLETAR";

export const businessInfo = {
  legalName: "Glamify Makeup",
  taxId: "No aplica (Emprendimiento local)",
  taxCondition: "Emprendedor",
  address: "Buenos Aires, Argentina",
  email: "gglamifymakeup@gmail.com",
  whatsapp: "5492323582495",
  jurisdiction: "Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires",
  retractionDays: 10,
  paymentMethods: "Mercado Pago: tarjetas de crédito, débito y dinero en cuenta",
  consumerDefenseUrl: "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario",
} as const;

export type BusinessInfo = typeof businessInfo;
