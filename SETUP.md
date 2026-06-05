# Glamify Makeup — Setup & Credenciales (paso a paso)

> Guía para dar de alta servicios y juntar credenciales. Hecha para seguir tranquilo, sin vueltas.
> **Regla de oro de seguridad:** las claves **secretas** van solo en `.env.local` (que está en `.gitignore`) y en los **secrets de Cloudflare** (`wrangler secret put`). **Nunca** se pegan en el chat ni se suben a git.
>
> **Actualizado: 2026-06-04** — Migración Vercel → Cloudflare Workers.

---

## 0. Qué vamos a crear (orden)

1. **GitHub** → repo del proyecto.
2. **Supabase** → base de datos + auth + storage (lo más detallado).
3. **Cloudflare** → hosting en Workers (se conecta al repo).
4. Cargar las **variables de entorno**.

> Solo esto hace falta para arrancar **M0–M2**. Mercado Pago, MiCorreo y Resend vienen después (ver §6).

---

## 1. GitHub (repo)

1. Logueado con la cuenta nueva.
2. **New repository** → nombre: `glamify-makeup` → **Private** → **NO** marcar "Add a README" (ya tenemos archivos locales) → **Create**.
3. Copiá la URL del repo (HTTPS).
4. Para pushear desde tu compu, lo más simple es **GitHub CLI**: `gh auth login` (elegí GitHub.com → HTTPS → login con browser). *(Alternativa: Personal Access Token o SSH keys.)*

> El `git init` + primer commit + push lo hago yo en el scaffold de M0; vos solo necesitás el repo creado y estar logueado.

---

## 2. Supabase (el detallado)

### 2.1 Crear el proyecto
1. Entrá a **supabase.com** → **Sign in** (podés entrar con la cuenta de GitHub nueva).
2. **New project**:
   - **Organization:** creá una (ej. "Glamify").
   - **Name:** `glamify-makeup`.
   - **Database Password:** generá una fuerte y **guardala** (la vas a necesitar para la conexión). Si la perdés, se puede resetear.
   - **Region:** **South America (São Paulo)** → menor latencia para Argentina.
   - **Plan:** Free.
3. **Create new project** y esperá ~2 min a que se provisione.

### 2.2 Credenciales de API
En el proyecto → ⚙️ **Project Settings → API**:
- **Project URL** → será `NEXT_PUBLIC_SUPABASE_URL`
- Clave **`anon` / `public`** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(pública, va al cliente, OK)*
- Clave **`service_role` / `secret`** → `SUPABASE_SERVICE_ROLE_KEY` *(**SECRETA**, solo server)*

> Si tu panel muestra las claves nuevas: **publishable** ≈ anon, **secret** ≈ service_role.

### 2.3 Conexión a la base (para Prisma)
En ⚙️ **Project Settings → Database → Connection string → pestaña "Prisma" (ORM)**. Supabase te da **dos** strings ya armados (solo reemplazá `[YOUR-PASSWORD]`):
- **Pooled** (Transaction, puerto **6543**) → `DATABASE_URL` *(la app serverless usa esta)*
- **Direct** (puerto **5432**) → `DIRECT_URL` *(Prisma la usa para migraciones)*

> Copialos tal cual de esa pestaña; no los armes a mano.

### 2.4 Storage (imágenes de producto)
- **Decidido: usamos Supabase Storage** (no Cloudinary). Ya está acá, es gratis a tu escala e integrado.
- El bucket (`product-images`) lo creo yo en el scaffold; no tenés que hacer nada ahora.

### 2.5 Auth
- **Email** ya viene activo.
- **Google OAuth** lo configuramos en **M2** (te paso los pasos exactos ahí: crear credenciales en Google Cloud y pegarlas en Supabase).

---

## Crear el usuario administrador

El panel `/admin` se protege con Supabase Auth + una fila `User` con role `owner`.
Para crear (de forma idempotente) la cuenta de la dueña:

1. Definí en tu `.env` (no commitear):
   - `ADMIN_EMAIL` — email de acceso al panel.
   - `ADMIN_PASSWORD` — contraseña inicial (cambiable luego).
   - Ya deben estar: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
2. Corré:
   ```bash
   pnpm admin:create
   ```
   Crea el usuario en Supabase Auth (email confirmado) y la fila `User` (role `owner`).
   Es idempotente: si ya existe, reutiliza la cuenta de Auth y refresca la fila.
3. Entrá a `/admin/login` con ese email/contraseña.

---

## 3. Cloudflare (hosting)

### 3.1 Crear cuenta
1. Entrá a **dash.cloudflare.com** → **Sign up** (gratis).
2. Verificá tu email.

### 3.2 Conectar repo (después de M0, cuando el código esté pusheado)
**Opción A — Por dashboard (fácil):**
1. Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Seleccioná el repo `titi2233/glamify-makeup`.
3. Build settings:
   - **Build command:** `npm run build:worker`
   - **Build output:** `.open-next`
4. Deploy.

**Opción B — Por CLI (más control):**
```bash
npm run build:worker && wrangler deploy
```

### 3.3 Variables de entorno en Cloudflare
Las secrets se cargan con el CLI de Wrangler:
```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put DATABASE_URL
wrangler secret put DIRECT_URL
# (más adelante)
# wrangler secret put MP_ACCESS_TOKEN
# wrangler secret put MP_WEBHOOK_SECRET
# wrangler secret put RESEND_API_KEY
```

Las variables **públicas** (`NEXT_PUBLIC_*`) van en `wrangler.jsonc` bajo `[vars]` o en el dashboard:
```jsonc
{
  "vars": {
    "NEXT_PUBLIC_SUPABASE_URL": "https://xxxxx.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "eyJ..."
  }
}
```

### 3.4 Dominio custom
1. Dashboard → **Workers & Pages** → tu worker → **Custom Domains**.
2. Agregar `glamifymakeup.site`.
3. Cloudflare maneja DNS + SSL automáticamente si el dominio está en Cloudflare.

### 3.5 ¿Por qué Cloudflare y no Vercel?
- **Uso comercial gratis** — Cloudflare Workers permite uso comercial en el plan free. Vercel Hobby no (ToS "no comercial").
- **100K req/día gratis** + assets estáticos ilimitados.
- **Cron Triggers incluidos** (5 gratis) — para carrito abandonado y autocancel de pedidos.
- **Sin cold starts** — edge global (300+ ciudades).
- Si el tráfico crece → Workers Paid ($5/mes, 10M req/mes).

---

## 4. Variables de entorno (`.env.local`)

El `.env.local` ya fue creado con las credenciales reales. El `.env.example` sirve de referencia:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # SECRETA
DATABASE_URL=...                     # pooled 6543 (?pgbouncer=true)
DIRECT_URL=...                       # direct 5432

# (más adelante)
# MP_ACCESS_TOKEN=...                # M2 (sandbox) / M5 (prod) — SECRETA
# MP_WEBHOOK_SECRET=...              # M2 — SECRETA
# RESEND_API_KEY=...                 # M5 — SECRETA
# NEXT_PUBLIC_POSTHOG_KEY=...        # M4
# NEXT_PUBLIC_POSTHOG_HOST=...       # M4
```

---

## 5. Qué compartir conmigo y qué NO

- **Yo NO necesito tus secretos.** Escribo el código que lee de `process.env`; vos llenás el `.env.local` en tu compu.
- **Públicas** (`NEXT_PUBLIC_*`, anon key, Project URL): no hay drama si aparecen, pero igual mejor en env.
- **Secretas** (`service_role`, `DATABASE_URL`, `DIRECT_URL`, password, MP token, Resend): **nunca** en el chat ni en git.
- Si necesito un valor **no secreto** puntual (ej. la Project URL), te lo pido.

---

## 6. Cronograma de credenciales por milestone

| Cuándo | Servicio | Qué necesitás |
|---|---|---|
| **Ahora (M0)** | GitHub · Supabase · Cloudflare | repo + URL/anon/service_role + DATABASE_URL/DIRECT_URL + cuenta Cloudflare |
| **M2** ✔ | Mercado Pago (sandbox) | `MP_ACCESS_TOKEN` (TEST) + `MP_WEBHOOK_SECRET` — carrito, checkout, webhook implementados |
| **M5 (launch)** | MiCorreo · Resend · MP (prod) · Dominio | API Correo · API key + dominio verificado · token PROD · DNS → Cloudflare |

---

## E2E del panel de administración (M3)

El test `tests/e2e/admin.spec.ts` ejecuta el DoD de M3: login → crear producto
con variante+stock → crear cupón → abrir un pedido y cambiarle el estado.

Prerequisitos (una vez por entorno):

1. Crear el admin (idempotente):
   ```bash
   ADMIN_EMAIL=owner@glamify.test ADMIN_PASSWORD=una-clave-fuerte pnpm admin:create
   ```
2. Seedear catálogo + pedido de muestra (`GLM-E2E001`, estado `paid`):
   ```bash
   pnpm db:seed
   ```
3. Correr el e2e con las mismas credenciales en el entorno:
   ```bash
   ADMIN_EMAIL=owner@glamify.test ADMIN_PASSWORD=una-clave-fuerte pnpm test:e2e -- admin.spec.ts
   ```

Si `ADMIN_EMAIL`/`ADMIN_PASSWORD` no están definidas, el test se **saltea**
(no falla), para no romper CI en entornos sin admin configurado.
