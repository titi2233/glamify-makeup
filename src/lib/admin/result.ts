/**
 * Resultado uniforme de toda Server Action del panel admin (M3).
 * `ok:false` siempre trae `error` legible para la dueña; `ok:true` puede traer
 * el `id` del registro creado/editado para redirigir.
 */
export interface AdminResult {
  ok: boolean;
  error?: string;
  id?: string;
}
