# Estado — Auditoría de pre-lanzamiento

**Cerrada.** 6/6 fases completas, 2026-08-27/28.

| Fase | Superficie | Veredicto |
|---|---|---|
| 1 | Pago real E2E | 🔴 sin timeout en llamadas a MP (arreglable, patrón ya existe en el repo) |
| 2 | Datos de prueba en DB de prod | 🔴 **bloqueante** — dev y prod comparten la misma DB, sin guard en seed/scripts |
| 3 | Saldo prepago MiCorreo | 🟢 código correcto — riesgo 100% operativo (hábito de recarga) |
| 4 | Pesos reales de productos | 🟢 código correcto — riesgo 100% operativo (pesar y cargar productos reales) |
| 5 | Legal/fiscal Argentina | 🔴 sin facturación AFIP en el flujo, sin checkbox de aceptación de T&C |
| 6 | Config de producción | 🔴 email de confirmación sin try/catch en el webhook (dinero de por medio), SETUP.md incompleto |

Ver `docs/audit/reports/SUMMARY.md` para el veredicto consolidado go/no-go y el detalle completo en cada `0N-*.md`.

**Siguiente paso:** los fixes de código (fases 1 y 6) van por `protocolo-fixes-general` en una sesión aparte — auditar ≠ fixear. Las decisiones de negocio (fase 2, 5) requieren input de Lazar antes de tocar nada.
