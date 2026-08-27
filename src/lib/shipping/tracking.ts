/**
 * Página pública de rastreo de Correo Argentino.
 *
 * Verificado 2026-08-27: la página NO acepta el número de seguimiento por query string,
 * así que linkeamos la página y mostramos el número aparte para que la clienta lo pegue.
 * Un link fijo nunca se rompe; un deep-link inventado sí.
 */
export const CORREO_TRACKING_URL = "https://www.correoargentino.com.ar/seguimiento-de-envios";
