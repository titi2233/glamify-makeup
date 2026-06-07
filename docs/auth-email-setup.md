# Auth: emails de confirmación + checklist de deploy

Operativa para dejar los emails de confirmación de registro funcionando en
producción (`https://glamifymakeup.site`) y el proyecto listo para deploy.

> Contexto del problema: los correos de confirmación no llegaban porque el SMTP
> compartido de Supabase tiene un rate limit muy bajo (~2–3 emails/hora) y se
> agota (`email rate limit exceeded`). La solución es SMTP propio con Resend +
> subir los rate limits de Auth.

---

## 1. SMTP propio con Resend (elimina el rate limit del SMTP compartido)

### 1.1 Verificar el dominio en Resend (PREREQUISITO ineludible)
Tener la `RESEND_API_KEY` **no alcanza**: Resend solo deja enviar desde un
dominio verificado (salvo `onboarding@resend.dev`, que únicamente te permite
mandarte mails a vos mismo). Hay que verificar `glamifymakeup.site`:

1. Resend → **Domains** → **Add Domain** → `glamifymakeup.site`.
2. Resend devuelve registros **SPF (TXT)** + **DKIM (CNAME/TXT)** (y opcional
   DMARC). Cargalos en el DNS del dominio (Cloudflare → **DNS → Records**).
3. Esperá a que el estado del dominio pase a **Verified** (minutos, hasta ~1 h
   por propagación DNS).
4. Resend → **API Keys**: usá la key existente (`re_...`) o creá una con permiso
   *Sending access*. Esta misma key se usa como password SMTP (paso 1.2).

### 1.2 Configurar el SMTP propio en Supabase
Dashboard de Supabase → **Authentication** → **Emails** → pestaña **SMTP
Settings** (en algunos proyectos: **Project Settings → Authentication → SMTP**).

1. Activá **Enable Custom SMTP**.
2. Completá **exactamente**:

   | Campo                | Valor                                        |
   | -------------------- | -------------------------------------------- |
   | **Sender email**     | `no-reply@glamifymakeup.site` (dominio verificado en Resend) |
   | **Sender name**      | `Glamify Makeup`                             |
   | **Host**             | `smtp.resend.com`                            |
   | **Port**             | `465` (TLS implícito) — alternativa `587` STARTTLS |
   | **Username**         | `resend` (literal — NO el email)             |
   | **Password**         | la API key de Resend → `re_...`              |

3. **Save**.

> Error más común: poner el email del remitente en **Username**. Debe ser la
> cadena literal `resend`; si no, falla la autenticación SMTP (`535`).

### 1.3 Subir los rate limits de Auth
Aun con SMTP propio, Supabase aplica **su** límite de envío de emails.
Dashboard → **Authentication → Rate Limits → "Rate limit for sending emails"** →
subilo a un valor acorde al volumen real (ej. 30–100/hora).

### 1.4 Verificar
- Registrá una clienta de prueba con un email tuyo → debería llegar el mail
  **desde `no-reply@glamifymakeup.site`** (no desde `…@mail.app.supabase.io`).
- **Supabase → Logs → Auth Logs**: buscá `rate limit` / errores SMTP (`535`,
  timeouts). Query útil en **Logs → Logs Explorer**:
  ```sql
  select timestamp, event_message, metadata.status, metadata.msg, metadata.error
  from auth_logs
  where event_message ilike '%mail%' or event_message ilike '%rate limit%'
  order by timestamp desc limit 100;
  ```
- **Resend → Emails/Logs**: cada envío aparece con estado `delivered` /
  `bounced` / `complained`. Si Supabase dice "enviado" pero Resend marca
  `bounced`, el problema es de entrega (dominio/inbox), no de Supabase.

---

## 2. Confirmación de email independiente del dispositivo (OTP / `token_hash`)

### Por qué
El flujo PKCE por defecto (`{{ .ConfirmationURL }}` → `/auth/callback?code=…`)
exige la cookie `code_verifier` del **mismo navegador** que inició el registro.
Si la clienta se registra en desktop y abre el link en el celular, falla con
`both auth code and code verifier should be non-empty`.

La ruta **`/auth/confirm`** (`src/app/auth/confirm/route.ts`) usa
`supabase.auth.verifyOtp({ type, token_hash })`, que canjea el `token_hash` del
email sin depender de ninguna cookie previa → **funciona en cualquier
dispositivo**. Éxito → `mergeCartForCurrentCustomer()` + redirect a `/cuenta`;
error → `/ingresar?error=oauth`.

### Configurar la plantilla en Supabase
Dashboard → **Authentication → Email Templates → "Confirm signup"**. Reemplazá
el `href` del botón/enlace por:

```
https://glamifymakeup.site/auth/confirm?token_hash={{ .TokenHash }}&type=signup
```

- Equivalente portable (usa el Site URL configurado): `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
- Opcional, destino post-confirmación distinto de `/cuenta`: agregar
  `&next=/ruta-relativa` (la ruta valida que sea interna; anti open-redirect).

> `/auth/callback` (PKCE) se mantiene para **Google OAuth** y como degradación:
> si todavía NO actualizaste la plantilla, el flujo viejo sigue andando.

---

## 3. Evitar 500 al registrar un email ya existente
`signUpAction` (`src/app/(storefront)/ingresar/actions.ts`) ahora consulta
`prisma.customer` por email **antes** de `signUp`. Si ya existe, devuelve
`{ ok: false, error: "El correo electrónico ya está registrado." }` en vez de
caer en el `upsert` que chocaba con el `@unique` de `email` (Supabase, por
anti-enumeración, devolvía un user con id NUEVO) → ya no hay 500. Además se
captura defensivamente el `P2002` por si dos requests corren en paralelo.

---

## 4. Checklist de deploy

### 4.1 Secrets en Cloudflare (`wrangler secret put <KEY>`)
Las públicas (`NEXT_PUBLIC_*`) ya están en `wrangler.jsonc → vars`. Faltan los
**secretos** (nunca en `wrangler.jsonc` ni en git):

```bash
wrangler secret put DATABASE_URL              # Postgres (pooled, runtime)
wrangler secret put DIRECT_URL                # Postgres directo (solo migraciones)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY # operaciones server-side / storage
wrangler secret put MP_ACCESS_TOKEN           # MercadoPago (PROD)
wrangler secret put MP_WEBHOOK_SECRET         # validación webhook MP
wrangler secret put RESEND_API_KEY            # emails transaccionales de LA APP (cron)
```

Verificar lo ya cargado: `wrangler secret list` (y `wrangler whoami` para
confirmar la cuenta/proyecto).

> Nota: `RESEND_API_KEY` en Cloudflare es para los emails que manda **la app**
> (cron de carrito abandonado, etc.). La key que usa **Supabase** para el SMTP
> propio (paso 1.2) se carga en el dashboard de Supabase, no acá. Son dos usos
> distintos de la misma cuenta de Resend.

### 4.2 Migraciones Prisma
Estado actual (verificado contra la DB de prod): **al día**, las 5 migraciones
ya aplicadas — no hay pendientes, no hace falta `migrate deploy`. Antes de cada
deploy, re-verificar:

```bash
pnpm exec prisma migrate status
# Si hubiera pendientes:
pnpm exec prisma migrate deploy
```

### 4.3 Build
```bash
pnpm typecheck          # tipos (OK)
pnpm test -- launch-readiness   # gate de placeholders legales (OK)
pnpm build              # Next.js prod build
pnpm build:worker       # bundle OpenNext para Workers (corre en CI/Linux; EPERM en Windows)
pnpm deploy             # build:worker + wrangler deploy
```
