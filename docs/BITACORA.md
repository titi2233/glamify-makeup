# Bitácora

Una línea por cierre de sesión, escrita sola por el hook de cierre.
Solo historia — lo que se hizo, que no caduca. Lo vigente vive en `.claude/ESTADO.md`;
lo que está abierto se consulta en los PRs y el CI, no se escribe acá.

- **2026-08-27 21:26** `docs-auditoria-pre-lanzamiento` — 6 bugs de código cerrados (guard de entorno + su propio bug de `.env`, timeout MP + mensaje en español, try/catch email webhook, checkbox de T&C verificado end-to-end, bug de hidratación en breadcrumbs); juez completo verde (typecheck, lint, 465 tests, build); decisión y gotchas documentados
- **2026-08-27 21:28** `docs-auditoria-pre-lanzamiento` — commit + push de los 6 fixes + auditoría completa; árbol limpio
- **2026-08-27 21:50** `main` — merge + push a main completo, código verificado
- **2026-08-27 21:55** `main` — reintenté, mismo error exacto: "your account is locked due to a billing issue" — no se resolvió del lado de GitHub
- **2026-08-27 21:58** `main` — causa real confirmada con tu sesión real de GitHub (captura del banner de billing): autorización de tarjeta fallida, no es tema de repo público/privado
- **2026-08-28 23:18** `main` — primera compra real de punta a punta verificada: pago, webhook, auto-import a MiCorreo, reembolso manual — todo funcionó
