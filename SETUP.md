# Glamify Makeup — Setup & Credenciales (paso a paso)

> Guía para dar de alta servicios y juntar credenciales. Hecha para seguir tranquilo, sin vueltas.
> **Regla de oro de seguridad:** las claves **secretas** van solo en `.env.local` (que está en `.gitignore`) y en las *env vars* de Vercel. **Nunca** se pegan en el chat ni se suben a git.

---

## 0. Qué vamos a crear (orden)

1. **GitHub** → repo del proyecto.
2. **Supabase** → base de datos + auth + storage (lo más detallado).
3. **Vercel** → hosting (se conecta al repo).
4. Cargar las **variables de entorno**.

> Solo esto hace falta para arrancar **M0–M2**. Mercado Pago, MiCorreo y Resend vienen después (ver §6).

---

## 1. GitHub (repo)

1. Logueado con la cuenta nueva.
2. **New repository** → nombre: `glamify-makeup` → **Private** → **NO** marcar "Add a README" (ya tenemos archivos locales) → **Create**.
3. Copiá la URL del repo (HTTPS).
4. Para pushear desde tu compu, lo más simple es **GitHub CLI**: `gh auth login` (elegí GitHub.com → HTTPS → login con browser). *(Alternativa: Personal Access Token.)*

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

## 3. Vercel

1. **vercel.com** → **Sign up** con la cuenta de **GitHub nueva** (queda todo linkeado).
2. (Después de M0, cuando el repo esté pusheado) → **Add New Project → Import** `glamify-makeup`.
3. Cargar las **Environment Variables** (las mismas del `.env.local`) en **Project → Settings → Environment Variables**.
4. **Region de funciones:** São Paulo (`gru1`) para latencia AR (Project Settings).

---

## 4. Variables de entorno (`.env.local`)

El `.env.example` lo creo en el scaffold. Esta es la lista que vas a llenar:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # SECRETA
DATABASE_URL=...                     # pooled 6543 (?pgbouncer=true&connection_limit=1)
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
| **Ahora (M0)** | GitHub · Supabase · Vercel | repo + URL/anon/service_role + DATABASE_URL/DIRECT_URL + cuenta Vercel |
| **M2** | Mercado Pago (sandbox) · Google OAuth | access token TEST + public key · client id/secret |
| **M5 (launch)** | MiCorreo · Resend · MP (prod) · Dominio | API Correo · API key + dominio verificado · token PROD · DNS → Vercel |
