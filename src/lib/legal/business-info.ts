/** Fuente única de datos del negocio para páginas legales/contenido.
 *  Completar los [COMPLETAR] antes del launch (ver docs/LAUNCH.md). */
export const PLACEHOLDER_PREFIX = "[COMPLETAR";

export const businessInfo = {
  legalName: "Glamify Makeup",
  taxId: "27-44380532-5",
  taxCondition: "Monotributista Social",
  address: "Luján, Buenos Aires, Argentina",
  email: "gglamifymakeup@gmail.com",
  // El nº de WhatsApp se sirve desde Setting.whatsappNumber (DB); no duplicar acá.
  jurisdiction: "tribunales ordinarios correspondientes al domicilio de la parte consumidora",
  retractionDays: 10,
  paymentMethods: "Mercado Pago: tarjetas de crédito, débito y dinero en cuenta",
  consumerDefenseUrl: "https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario",
} as const;

export type BusinessInfo = typeof businessInfo;
