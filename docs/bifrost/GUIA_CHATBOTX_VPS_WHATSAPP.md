# Guía completa: ChatbotX en VPS BIFROST + WhatsApp Cloud API

> **Alcance:** Despliegue self-hosted de [ChatbotX Community](https://chatbotx.io) en VPS dedicado, registro de usuarios, transferencia de workspace, configuración de Meta (Facebook) y conexión de WhatsApp Manual Setup.  
> **Entorno de referencia:** `iris.bifrost.com.co` (VPS Contabo, Ubuntu 24.04, Docker Compose preempaquetado).  
> **Última validación:** Ago-2026 (producción POC BIFROST).  
> **Repo de trabajo:** fork [`JuanBifrost/ChatbotX`](https://github.com/JuanBifrost/ChatbotX), rama `bifrost` — ver [`README.md`](./README.md) y [`DESARROLLO_Y_FORK.md`](./DESARROLLO_Y_FORK.md).

---

## Índice

1. [Arquitectura y decisiones](#1-arquitectura-y-decisiones)
2. [Requisitos previos](#2-requisitos-previos)
3. [Despliegue en VPS](#3-despliegue-en-vps)
4. [Caddy + HTTPS](#4-caddy--https)
5. [Primer acceso y cuentas](#5-primer-acceso-y-cuentas)
    - [5.5 Registro cerrado + alta manual (producción)](#55-registro-cerrado--alta-manual-producción)
    - [5.6 Personalización del login BIFROST (Community)](#56-personalización-del-login-bifrost-community)
6. [Correos de registro (MailHog)](#6-correos-de-registro-mailhog)
7. [Community Edition: workspace único](#7-community-edition-workspace-único)
    - [7.1 Límite técnico](#71-límite-técnico)
    - [7.2 Opciones si necesitas varios workspaces](#72-opciones-si-necesitas-varios-workspaces)
    - [7.3 Intento fallido: `enterprise` sin licencia](#73-intento-fallido-enterprise-sin-licencia-ago-2026)
    - [7.4 Revertir si el worker no arranca](#74-revertir-si-el-worker-no-arranca)
    - [7.5 Segundo usuario + workspace propio (caso Timanco)](#75-segundo-usuario--workspace-propio-caso-timanco)
        - [7.5.7 WhatsApp Timanco: portafolio Meta separado](#757-whatsapp-timanco-portafolio-meta-separado)
8. [Transferir workspace al usuario principal](#8-transferir-workspace-al-usuario-principal)
9. [Super Admin y Platform Credentials](#9-super-admin-y-platform-credentials)
    - [9.4 Dominios Meta (OAuth / transferir proveedor)](#94-dominios-meta-oauth--embedded-signup--transferir-desde-otro-proveedor)
        - [9.4.1 Tras OAuth exitoso (Timanco)](#941-tras-oauth-exitoso-transferir-desde-otro-proveedor--validado-timanco-ago-2026)
10. [Crear app Meta (paso a paso verificado)](#10-crear-app-meta-paso-a-paso-verificado)
    - [10.6 ¿Cuándo crear app nueva? (mismo vs otro portafolio)](#106-cuándo-crear-app-nueva-mismo-vs-otro-portafolio)
11. [Conectar canal WhatsApp en ChatbotX](#11-conectar-canal-whatsapp-en-chatbotx)
    - [11.1 Primer canal — Manual Setup](#111-primer-canal--manual-setup)
    - [11.2 Segundo canal (mismo workspace)](#112-segundo-canal-mismo-workspace)
    - [11.3 Embedded Signup / OAuth (Transferir proveedor + Facebook)](#113-embedded-signup--oauth-transferir-proveedor--continuar-con-facebook)
12. [Webhook en Meta (crítico)](#12-webhook-en-meta-crítico)
13. [Almacenamiento de archivos e imágenes (RustFS)](#13-almacenamiento-de-archivos-e-imágenes-rustfs)
14. [Activar flujos y modo Bot](#14-activar-flujos-y-modo-bot)
15. [Verificación end-to-end](#15-verificación-end-to-end)
16. [Troubleshooting](#16-troubleshooting)
17. [Comandos útiles](#17-comandos-útiles)
18. [Referencias](#18-referencias)
    - [18.1 Oficiales (web)](#181-oficiales-web)
    - [18.2 Código fuente local (`ChatbotX-main`)](#182-código-fuente-local-chatbotx-main)

---

## 1. Arquitectura y decisiones

### Qué usar

| Opción | Repo | Cuándo |
|---|---|---|
| **Docker Compose (recomendado)** | `github.com/chatbotxio/chatbotx-docker-compose` | Usar el producto en producción/POC |
| Development | `github.com/ChatbotXIO/ChatbotX` | Solo si vas a modificar el código fuente |

### Dominios BIFROST (ejemplo)

| Subdominio | Servicio Docker | Puerto interno | Uso |
|---|---|---|---|
| `iris.bifrost.com.co` | `builder` (UI Next.js) | `3123` → `3000` | UI + **subida de archivos** (`/chatbotx/*` → RustFS) + **WebSocket Inbox** (`/ws/*` → realtime) |
| `ws.iris.bifrost.com.co` | `realtime` (WebSocket) | `1999` | Opcional — el navegador usa `iris…/ws/` (ver §4.1) |
| `cdn.iris.bifrost.com.co` | `filesystem` (RustFS) | `9000` | Opcional — lectura directa de assets |

> **Importante (Ago-2026):** las subidas de imágenes en flujos deben ir por **el mismo dominio** `iris.bifrost.com.co` (ruta `/chatbotx/*`), no por `cdn.iris`, para evitar errores CORS en el navegador. Ver §13.

### Stack ChatbotX en VPS

- **15 contenedores** aprox. (Postgres Timescale, Redis, builder, worker, mailhog, etc.)
- **Community Edition:** máximo **1 workspace** por instalación (seed `DEMO` con `demo@example.com`).

---

## 2. Requisitos previos

- VPS Ubuntu 22.04+ con **mínimo 4 GB RAM** (recomendado 8 GB+).
- DNS apuntando al VPS:
  - `iris.bifrost.com.co` → IP del VPS
  - `ws.iris.bifrost.com.co` → misma IP
  - `cdn.iris.bifrost.com.co` → misma IP
- Puertos abiertos: `22`, `80`, `443`.
- Cuenta [Meta Business](https://business.facebook.com/) con portfolio comercial.
- Número WhatsApp en **Cloud API** (no app WhatsApp Business móvil sola).
- **No** tener el mismo número con webhook activo en ManyChat, Chatwoot u otro sistema.

---

## 3. Despliegue en VPS

### 3.1 Instalar Docker

```bash
apt update
apt install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker --version
docker compose version
```

### 3.2 Clonar el repo correcto

```bash
cd ~
git clone https://github.com/chatbotxio/chatbotx-docker-compose.git chatbotx
cd chatbotx
```

> **No usar** el monorepo `ChatbotXIO/ChatbotX` salvo desarrollo del producto.

### 3.3 Generar secretos

```bash
# BETTER_AUTH_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY, REALTIME_API_KEY, JAVASCRIPT_EXECUTOR_TOKEN (hex 32 bytes)
openssl rand -hex 32
```

Crear `.env` (referencia; muchas variables van también en `docker-compose.yml`):

```bash
cat > .env << 'EOF'
BETTER_AUTH_SECRET=<generado>
REALTIME_API_KEY=<generado_hex>
ENCRYPTION_KEY=<generado_hex>
JAVASCRIPT_EXECUTOR_TOKEN=<generado_hex>
POSTGRES_PASSWORD=<password_seguro>
POSTGRES_USER=chatbotx
POSTGRES_DB=chatbotx
EOF
```

### 3.4 Ajustar `docker-compose.yml` (bloque `x-environment`)

Editar `x-environment: &common-vars` con los valores de producción:

```yaml
x-environment: &common-vars
  BETTER_AUTH_SECRET: <tu_secreto>
  PLATFORM_ADMIN_EMAIL: juan@bifrost.com.co   # ← Super Admin (ver §9)
  BETTER_AUTH_URL: https://iris.bifrost.com.co
  DATABASE_URL: postgresql://chatbotx:<POSTGRES_PASSWORD>@postgres:5432/chatbotx?schema=public
  ENCRYPTION_KEY: <hex_32>
  JAVASCRIPT_EXECUTOR_URL: http://javascript-executor:3210
  JAVASCRIPT_EXECUTOR_TOKEN: <hex_32>
  NEXT_PUBLIC_BUILDER_URL: https://iris.bifrost.com.co
  NEXT_PUBLIC_REALTIME_URL: https://ws.iris.bifrost.com.co
  # Assets e imágenes — MISMO dominio que la UI (evita CORS). Ver §13.
  NEXT_PUBLIC_ASSET_URL: https://iris.bifrost.com.co/chatbotx/public/
  S3_ENDPOINT: https://iris.bifrost.com.co
  S3_ACCESS_KEY_ID: chatbotx
  S3_SECRET_ACCESS_KEY: secretkey
  S3_BUCKET: chatbotx
  S3_REGION: us-west-2
  NEXT_PUBLIC_SMTP_FROM: noreply@iris.bifrost.com.co
  REALTIME_API_KEY: <hex_32>
  SMTP_SERVER: smtp://mailhog:1025

# Bloque RustFS (servicio filesystem) — agregar CORS:
x-rustfs-environment: &rustfs-environment
  RUSTFS_ACCESS_KEY: ${RUSTFS_ACCESS_KEY:-chatbotx}
  RUSTFS_SECRET_KEY: ${RUSTFS_SECRET_KEY:-secretkey}
  RUSTFS_CORS_ALLOWED_ORIGINS: https://iris.bifrost.com.co
```

**Correcciones obligatorias del repo oficial:**

| Error en repo | Corrección |
|---|---|
| `S3_ENPOINT` (typo) | **`S3_ENDPOINT`** — el código lee `S3_ENDPOINT`; sin esto, `presigned-upload` devuelve **400** |
| `S3_ENDPOINT: http://localhost:9000` | **`https://iris.bifrost.com.co`** — el navegador no puede subir a `localhost` ni a `filesystem` interno |
| `NEXT_PUBLIC_ASSET_URL` apuntando a `cdn.iris` | **`https://iris.bifrost.com.co/chatbotx/public/`** — mismo origen que la UI |
| `SMTP_SERVER: smtp://...@localhost:1025` | **`smtp://mailhog:1025`** — dentro del contenedor `builder`, `localhost` no alcanza MailHog |

### 3.5 Levantar servicios

```bash
cd ~/chatbotx
docker compose -p chatbotx pull
docker compose -p chatbotx up -d
docker compose -p chatbotx ps
```

La primera descarga de Postgres (~2.5 GB) puede tardar 10–20 min. Si falla por red:

```bash
docker pull timescale/timescaledb-ha:pg18.4-ts2.27.2-all
docker compose -p chatbotx up -d
```

### 3.6 Verificar que responde

```bash
curl -I http://127.0.0.1:3123
# Esperado: HTTP 307 → /auth/sign-in
```

`builder (unhealthy)` en `docker ps` **no es bloqueante** si la UI responde por HTTP.

---

## 4. Caddy + HTTPS

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

cat > /etc/caddy/Caddyfile << 'EOF'
iris.bifrost.com.co {
    # Lectura pública de archivos — ChatbotX genera URLs en /storage/public/...
    # Usar handle_path + {path} (NO {uri}: duplicaría /storage y devuelve 403).
    handle_path /storage/* {
        rewrite * /chatbotx{path}
        reverse_proxy localhost:9000
    }
    # Subidas S3/RustFS (presigned PUT) — mismo dominio que la UI (evita CORS)
    handle /chatbotx/* {
        reverse_proxy localhost:9000
    }
    # WebSocket tiempo real — Inbox sin refrescar (§4.1). OBLIGATORIO.
    handle_path /ws/* {
        reverse_proxy localhost:1999
    }
    reverse_proxy localhost:3123
}

ws.iris.bifrost.com.co {
    reverse_proxy localhost:1999
}

cdn.iris.bifrost.com.co {
    reverse_proxy localhost:9000
}
EOF

systemctl enable caddy
systemctl reload caddy

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Verificar: `curl -I https://iris.bifrost.com.co` → `307` a `/auth/sign-in`.

Plantilla completa (con registro cerrado y branding): `docs/bifrost/Caddyfile.iris.example`.

### 4.1 WebSocket tiempo real (Inbox sin refrescar)

El navegador **no** conecta a `ws.iris.bifrost.com.co`. ChatbotX deriva la URL desde `NEXT_PUBLIC_BUILDER_URL`:

```
wss://iris.bifrost.com.co/ws/parties/workspaces/<workspaceId>
```

Caddy debe enviar `/ws/*` al contenedor `realtime` (`localhost:1999`). Sin este bloque, las peticiones van al `builder` (Next.js) → **404 HTML** → hay que refrescar el Inbox para ver mensajes nuevos.

**Verificar en VPS:**

```bash
# Mal: content-type text/html (Next.js)
# Bien: respuesta del servicio realtime (401/405, no HTML)
curl -sI "https://iris.bifrost.com.co/ws/parties/workspaces/test" | head -5

docker compose -p chatbotx ps realtime
```

**DevTools (Chrome):** pestaña **Red → WS** → la conexión a `iris…/ws/…` debe permanecer **abierta** (no "Finished" a los pocos segundos).

**Variables relacionadas** (mismo valor en `builder`, `worker` y `realtime`):

| Variable | Uso |
|---|---|
| `REALTIME_BROADCAST_SECRET` | JWT worker → realtime (mín. 32 caracteres) |
| `REALTIME_API_KEY` | API interna realtime |

> `NEXT_PUBLIC_REALTIME_URL` en compose legado **no** es la URL que usa el navegador; la ruta pública es `<BUILDER_URL>/ws/`.

---

## 5. Primer acceso y cuentas

### Cuenta seed (instalación nueva)

| Campo | Valor |
|---|---|
| Email | `demo@example.com` |
| Password | `Demo@1234` |
| Workspace | `DEMO` (owner) |

### Registrar usuario principal

> **Producción BIFROST (recomendado):** registro público **cerrado** en Caddy — §5.5. Los usuarios los da de alta el administrador (SQL), no el formulario `/auth/sign-up`.

**Solo instalación inicial / laboratorio:**

1. Ir a `https://iris.bifrost.com.co/auth/sign-up`
2. Registrar con correo corporativo (ej. `juan@bifrost.com.co`)
3. Verificar email (ver §6)
4. Iniciar sesión

> En Community, el usuario nuevo **no verá workspace** hasta ser invitado o transferido el DEMO (§7–§8).  
> Para un **segundo operador con workspace propio** (ej. Líneas Timanco), ver §7.5.

### 5.5 Registro cerrado + alta manual (producción)

**Decisión BIFROST:** `iris.bifrost.com.co` es público en internet. El registro abierto permite que cualquiera cree cuenta. Con SMTP real podrían auto-verificarse; incluso con MailHog, no queremos cuentas basura. **Solución:** bloquear `/auth/sign-up` en Caddy y dar de alta usuarios solo por operaciones internas.

#### Modelo operativo

| Acción | Quién | Cómo |
|---|---|---|
| Crear usuario nuevo | Admin (Juan / ops) | §5.5.2 — SQL + contraseña temporal |
| Crear workspace (Community) | Admin | §7.5.3 — SQL (1 workspace por `ownerId`) |
| Agregar a workspace existente | Owner del workspace | Settings → Members → **Invite** (§5.5.4) |
| Iniciar sesión | Usuario dado de alta | `/auth/sign-in` (sigue abierto) |

#### 5.5.1 Bloquear registro en Caddy

En el VPS, editar `/etc/caddy/Caddyfile`. Dentro del bloque `iris.bifrost.com.co`, **antes** del `reverse_proxy localhost:3123`:

```caddy
iris.bifrost.com.co {
    handle_path /storage/* {
        rewrite * /chatbotx{path}
        reverse_proxy localhost:9000
    }
    handle /chatbotx/* {
        reverse_proxy localhost:9000
    }

    # --- Registro cerrado (§5.5) ---
    @signup path /auth/sign-up /auth/sign-up/*
    handle @signup {
        respond "Registro cerrado. Contacte al administrador BIFROST." 403
    }
    @signup_api path /api/auth/sign-up/*
    handle @signup_api {
        respond "Registro cerrado" 403
    }
    # --- fin registro cerrado ---

    # WebSocket tiempo real — §4.1
    handle_path /ws/* {
        reverse_proxy localhost:1999
    }

    reverse_proxy localhost:3123
}
```

Aplicar:

```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-signup-closed
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

**Verificar bloqueo** (debe devolver **403**):

```bash
curl -sI https://iris.bifrost.com.co/auth/sign-up | head -3
curl -sI -X POST https://iris.bifrost.com.co/api/auth/sign-up/email | head -3
```

**Qué sigue funcionando:** `/auth/sign-in`, invitaciones `/invitations/<código>`, webhooks WhatsApp, API del producto para usuarios ya autenticados.

#### 5.5.2 Alta manual de usuario (correo + contraseña)

ChatbotX Community **no tiene** panel “crear usuario” en self-hosted. El admin crea filas en `User` + `Account` (mismo esquema que `provisionResellerAccount` en el monorepo).

**Variables** — sustituir antes de ejecutar en el VPS:

| Variable | Ejemplo |
|---|---|
| `EMAIL` | `nuevo@bifrost.com.co` |
| `NAME` | `Operador Nuevo` |
| `PASSWORD` | contraseña temporal (comunicar por canal seguro) |
| `USER_ID` | ID snowflake nuevo (mayor que los existentes) |

**1. Listar IDs actuales** (no reutilizar):

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c \
  "SELECT id, email FROM \"User\" ORDER BY id::bigint DESC LIMIT 5;"
```

**2. Generar hash de contraseña** (mismo algoritmo que better-auth):

```bash
docker exec -e PASSWORD='CambiarEstaClave2026!' chatbotx-builder-1 node --input-type=module -e "
import { hashPassword } from 'better-auth/crypto';
const h = await hashPassword(process.env.PASSWORD);
console.log(h);
"
```

Si el import falla en el contenedor, alternativa: desbloquear sign-up unos minutos, registrar una sola vez, verificar con SQL y volver a bloquear Caddy.

**3. Insertar usuario** (email ya verificado — no depende de MailHog):

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -v ON_ERROR_STOP=1 -c "
BEGIN;

INSERT INTO \"User\" (
  id, \"createdAt\", \"updatedAt\", email, name, \"emailVerified\", \"isAnonymous\", \"mustChangePassword\", \"tenantId\"
) VALUES (
  '<USER_ID>',
  NOW(), NOW(),
  '<EMAIL>',
  '<NAME>',
  true,
  false,
  false,
  '1'
);

INSERT INTO \"Account\" (
  id, \"createdAt\", \"updatedAt\", \"accountId\", \"providerId\", password, \"userId\", \"tenantId\"
) VALUES (
  '<USER_ID_ACCOUNT>',
  NOW(), NOW(),
  '<USER_ID>',
  'credential',
  '<HASH>',
  '<USER_ID>',
  '1'
);

COMMIT;
"
```

> `USER_ID_ACCOUNT` = otro ID único (ej. `USER_ID` + 1).  
> Entregar al usuario: URL `https://iris.bifrost.com.co/auth/sign-in`, email y contraseña temporal.

**4. Workspace** — si necesita workspace propio (otro operador): §7.5.3. Si solo debe entrar a un workspace existente: §5.5.4 (invitación).

**5. Reiniciar builder** (opcional, refresco de sesión):

```bash
cd ~/chatbotx && docker compose -p chatbotx restart builder
```

#### 5.5.3 Eliminar usuario no autorizado (auditoría)

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
SELECT id, email, name, \"emailVerified\", \"createdAt\" FROM \"User\" ORDER BY \"createdAt\" DESC;
"
```

Solo eliminar si estás seguro de que no es owner de workspace con datos en producción. Consultar `Workspace.ownerId` antes de borrar.

#### 5.5.4 Invitar a un workspace (usuario ya existente)

Cuando el usuario **ya tiene cuenta** (creada por §5.5.2):

1. Owner del workspace → **Settings → Members → Invite**
2. Copiar enlace `https://iris.bifrost.com.co/invitations/<código>` (expira en 24 h)
3. El usuario inicia sesión y abre el enlace → **Join the team**
4. Verá el workspace en el selector sin otro registro

> Con registro cerrado, **no** envíes invitación a alguien que aún no tiene cuenta: créala antes con §5.5.2.

#### 5.5.5 Seguridad — qué queda protegido

| Riesgo | Con §5.5 |
|---|---|
| Registro público abierto | ❌ Bloqueado (403) |
| Verificación vía MailHog por extraños | ❌ No pueden registrarse |
| Ver bandejas ajenas sin invitación | ❌ Sin workspace = sin Inbox |
| Login de usuarios dados de alta | ✅ `/auth/sign-in` activo |
| Invitación a workspace | ✅ Con cuenta previa |

### 5.6 Personalización del login BIFROST (Community)

> **Validado:** Ago-2026 en `iris.bifrost.com.co` (Community Edition, sin licencia Enterprise).  
> **Tras reset VPS + imágenes propias (rama `bifrost`):** implementar logo, locale `es` y ocultar registro **en código fuente** (`apps/builder/…`); Caddy solo necesita 403 en sign-up (§5.5) y rutas de proxy — **no** css-override ni parches JS en contenedor. Ver [`DESARROLLO_Y_FORK.md`](./DESARROLLO_Y_FORK.md) § Personalización login.
> **Objetivo:** logo Bifröst, sin subtítulo “Sign in to ChatbotX”, sin enlace “Registrarse”, idioma español por defecto, registro cerrado (§5.5).

Community **no expone** el panel `/admin/branding` (eso es Enterprise). La personalización se hace con **assets persistentes en el host**, **Caddy** y **parches en el contenedor `builder`** (sin rebuild de imagen).

#### 5.6.1 Resultado final

| Elemento | Estado |
|---|---|
| Logo Bifröst (tema oscuro / claro) | ✅ `/brand/logo_white.svg`, `/brand/logo_black.svg` |
| Favicon | ✅ `/brand/icon_black.svg` |
| Subtítulo bajo el logo | ✅ Oculto |
| Enlace “¿No tiene cuenta? Registrarse” | ✅ Oculto (+ registro bloqueado §5.5) |
| Idioma del login | ✅ Español por defecto (`es`) |
| Botones de acceso | ✅ “Continuar con correo electrónico” / “Continuar con enlace mágico” |

#### 5.6.2 Estructura de archivos en el VPS (persistente)

Todo vive **fuera** de Docker para sobrevivir `docker compose pull` / recreación de contenedores:

```text
/opt/chatbotx-brand/
├── brand/
│   ├── logo_white.svg      # Login tema oscuro
│   ├── logo_black.svg      # Login tema claro
│   ├── icon_black.svg      # Favicon
│   ├── bifrost_logo.png    # Referencia (opcional)
│   └── bifrost-auth.css    # CSS auxiliar (ocultar título/registro)
└── css-override/
    ├── 401zonfix2f3_.css   # Copia del chunk CSS de Next + reglas BIFROST al final
    └── 1emqrgmppqmo4.css   # Idem (segundo chunk de estilos del login)
```

**Respaldo en contenedor** (opcional, se pierde al recrear imagen):

```bash
cd ~/chatbotx
docker compose cp /opt/chatbotx-brand/brand/. builder:/app/apps/builder/public/brand/
```

ChatbotX Community lee el logo del login desde rutas estáticas `/brand/*` (no desde la base de datos).

#### 5.6.3 Caddyfile — bloque completo que funciona

Dentro de `iris.bifrost.com.co`, **antes** de `reverse_proxy localhost:3123`:

```caddy
iris.bifrost.com.co {
    handle_path /storage/* {
        rewrite * /chatbotx{path}
        reverse_proxy localhost:9000
    }
    handle /chatbotx/* {
        reverse_proxy localhost:9000
    }

    # Registro cerrado (§5.5)
    @signup path /auth/sign-up /auth/sign-up/*
    handle @signup {
        respond "Registro cerrado. Contacte al administrador BIFROST." 403
    }
    @signup_api path /api/auth/sign-up/*
    handle @signup_api {
        respond "Registro cerrado" 403
    }

    # BIFROST: CSS del login — override de chunks Next (ocultar título y registro)
    handle /_next/static/chunks/401zonfix2f3_.css {
        rewrite * /401zonfix2f3_.css
        root * /opt/chatbotx-brand/css-override
        header Cache-Control "public, max-age=300"
        file_server
    }
    handle /_next/static/chunks/1emqrgmppqmo4.css {
        rewrite * /1emqrgmppqmo4.css
        root * /opt/chatbotx-brand/css-override
        header Cache-Control "public, max-age=300"
        file_server
    }

    # BIFROST: branding estático (logo, favicon, bifrost-auth.css)
    handle /brand/* {
        root * /opt/chatbotx-brand
        header Cache-Control "public, max-age=3600"
        file_server
    }

    # WebSocket tiempo real — Inbox sin refrescar (§4.1)
    handle_path /ws/* {
        reverse_proxy localhost:1999
    }

    reverse_proxy localhost:3123
}
```

Aplicar:

```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-login-bifrost
caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

**Verificar logo y CSS:**

```bash
curl -sI https://iris.bifrost.com.co/brand/logo_white.svg | head -3
curl -s https://iris.bifrost.com.co/brand/bifrost-auth.css
curl -sk --resolve iris.bifrost.com.co:443:127.0.0.1 \
  https://iris.bifrost.com.co/_next/static/chunks/401zonfix2f3_.css | tail -c 200
# Debe terminar con las reglas BIFROST (card-title / sign-up ocultos)
```

> Los nombres `401zonfix2f3_.css` y `1emqrgmppqmo4.css` son hashes de Next.js **de la build actual**. Si actualizas la imagen `builder`, pueden cambiar — ver §5.6.7.

#### 5.6.4 CSS — reglas que ocultan título y registro

Archivo `/opt/chatbotx-brand/brand/bifrost-auth.css`:

```css
[data-slot="card-title"] { display: none !important; }
[data-slot="card-content"] div:has(a[href="/auth/sign-up"]) { display: none !important; }
```

Esas mismas reglas se **añaden al final** de cada archivo en `/opt/chatbotx-brand/css-override/` (copia del CSS original del contenedor + append).

**Preparar override** (una vez, o tras actualizar imagen):

```bash
cd ~/chatbotx
# Copiar CSS original desde el contenedor
docker compose exec -T builder cat /app/apps/builder/.next/static/chunks/401zonfix2f3_.css \
  > /opt/chatbotx-brand/css-override/401zonfix2f3_.css
docker compose exec -T builder cat /app/apps/builder/.next/static/chunks/1emqrgmppqmo4.css \
  > /opt/chatbotx-brand/css-override/1emqrgmppqmo4.css

# Añadir reglas BIFROST al final de cada archivo
cat >> /opt/chatbotx-brand/css-override/401zonfix2f3_.css <<'CSS'

/* BIFROST login hide */
[data-slot="card-title"]{display:none!important}
[data-slot="card-content"] div:has(a[href="/auth/sign-up"]){display:none!important}
CSS

cp /opt/chatbotx-brand/css-override/401zonfix2f3_.css \
   /opt/chatbotx-brand/css-override/1emqrgmppqmo4.css
# (o repetir el append en el segundo si difiere)
```

`Cache-Control: max-age=300` en Caddy evita que Cloudflare cachee el override CSS por un año (`immutable` del origen).

#### 5.6.5 Parche JS en contenedor `builder`

Parchea los bundles compilados de Next.js dentro del contenedor (sin recompilar el monorepo).

**Guardar en el VPS** como `/opt/chatbotx-brand/scripts/patch-login-bifrost.js`:

```javascript
#!/usr/bin/env node
/** Parche login BIFROST — Community Edition. Oculta título y bloque de registro. */
const fs = require("fs");
const path = require("path");

const ROOT = "/app/apps/builder/.next";
const CARD_OLD =
  '(0,b.jsx)(c.CardTitle,{className:"text-slate-600 text-xl",children:a})';
const CARD_NEW =
  'a?(0,b.jsx)(c.CardTitle,{className:"text-slate-600 text-xl",children:a}):null';
const SIGNUP_RE =
  /,\(0,b\.jsx\)\("div",\{className:"text-center text-sm",children:\(0,b\.jsxs\)\("span",\{children:\[q\("auth\.dontHaveAnAccount"\),\(0,b\.jsx\)\(h\.default,\{className:"underline",href:x,children:q\("auth\.signUp"\)\}\)\]\}\)\}\)\)/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, out);
    else if (name.endsWith(".js") && !name.includes(".bak-bifrost")) out.push(fp);
  }
  return out;
}

function patchFile(fp) {
  let text = fs.readFileSync(fp, "utf8");
  const orig = text;
  if (text.includes(CARD_OLD) && !text.includes(CARD_NEW)) {
    text = text.split(CARD_OLD).join(CARD_NEW);
  }
  if (SIGNUP_RE.test(text)) {
    text = text.replace(SIGNUP_RE, ",null");
  }
  if (text !== orig) {
    const bak = `${fp}.bak-bifrost`;
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, orig);
    fs.writeFileSync(fp, text);
    return true;
  }
  return false;
}

let touched = 0;
for (const fp of walk(ROOT)) {
  if (patchFile(fp)) {
    touched++;
    console.log("OK", path.basename(fp));
  }
}
console.log("files_patched=" + touched);
```

**Guardar** `/opt/chatbotx-brand/scripts/patch-locale-es.js`:

```javascript
#!/usr/bin/env node
/** Idioma por defecto español (sin cookie NEXT_LOCALE). */
const fs = require("fs");
const path = require("path");

const ROOT = "/app/apps/builder/.next";
const REPLACEMENTS = [
  ['defaultLocale",0,"en"', 'defaultLocale",0,"es"'],
  ['NEXT_LOCALE")?.value||"en"', 'NEXT_LOCALE")?.value||"es"'],
  ['if(!e)return"en"', 'if(!e)return"es"'],
];

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, out);
    else if (name.endsWith(".js") && !name.includes(".bak-")) out.push(fp);
  }
  return out;
}

let touched = 0;
for (const fp of walk(ROOT)) {
  let text = fs.readFileSync(fp, "utf8");
  const orig = text;
  for (const [from, to] of REPLACEMENTS) {
    if (text.includes(from)) text = text.split(from).join(to);
  }
  if (text !== orig) {
    const bak = `${fp}.bak-locale`;
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, orig);
    fs.writeFileSync(fp, text);
    touched++;
    console.log("OK", path.basename(fp));
  }
}
console.log("files_patched=" + touched);
```

**Aplicar** (después de cada `docker compose pull` / recreación de `builder`):

```bash
cd ~/chatbotx
docker compose cp /opt/chatbotx-brand/scripts/patch-login-bifrost.js builder:/tmp/
docker compose cp /opt/chatbotx-brand/scripts/patch-locale-es.js builder:/tmp/
docker compose exec -T builder node /tmp/patch-login-bifrost.js
docker compose exec -T builder node /tmp/patch-locale-es.js
docker compose restart builder
```

#### 5.6.6 Cloudflare — purga de caché obligatoria

Tras cualquier cambio en login (JS, CSS o HTML), purgar en Cloudflare:

- `iris.bifrost.com.co/_next/static/chunks/*`
- o **purge everything** del dominio `iris.bifrost.com.co`

Los assets `/_next/static/*` del origen llevan `immutable` + 1 año; sin purga el navegador sigue mostrando título/registro en inglés aunque el servidor ya esté corregido.

**Verificación en el navegador:** ventana de incógnito + `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows).

**Verificación por curl:**

```bash
curl -s https://iris.bifrost.com.co/auth/sign-in | grep -E 'Sign en un|Registrarse|Continuar con correo' || true
# Esperado: solo "Continuar con correo" (español), sin "Sign en un" ni "Registrarse"
```

#### 5.6.7 Mantenimiento tras actualizar ChatbotX

| Qué persiste | Qué se pierde al `pull` / recreate `builder` |
|---|---|
| `/opt/chatbotx-brand/**` | Parches JS en `/app/apps/builder/.next/` |
| Bloques Caddy (`/brand/*`, css-override) | Copia en `public/brand/` del contenedor |
| Registro cerrado §5.5 | — |

**Checklist post-actualización:**

1. Copiar logos a `public/brand/` del contenedor nuevo (§5.6.2).
2. Detectar nombres nuevos de chunks CSS del login:
   ```bash
   curl -s https://iris.bifrost.com.co/auth/sign-in \
     | grep -oE '/_next/static/chunks/[^"]+\.css' | sort -u
   ```
3. Regenerar archivos en `/opt/chatbotx-brand/css-override/` y actualizar handles en Caddy (§5.6.3–5.6.4).
4. Ejecutar scripts §5.6.5.
5. Purgar caché Cloudflare (§5.6.6).

#### 5.6.8 Script único de reaplicación (referencia)

```bash
#!/bin/bash
# /opt/chatbotx-brand/scripts/reapply-login-bifrost.sh
set -euo pipefail
cd ~/chatbotx
docker compose cp /opt/chatbotx-brand/brand/. builder:/app/apps/builder/public/brand/
docker compose cp /opt/chatbotx-brand/scripts/patch-login-bifrost.js builder:/tmp/
docker compose cp /opt/chatbotx-brand/scripts/patch-locale-es.js builder:/tmp/
docker compose exec -T builder node /tmp/patch-login-bifrost.js
docker compose exec -T builder node /tmp/patch-locale-es.js
docker compose restart builder
echo "Listo. Purgar Cloudflare y probar en incógnito."
```

---

## 6. Correos de registro (MailHog)

En self-hosted, los correos **no llegan a Gmail/Outlook**. Van a **MailHog** dentro del VPS.

### Ver correos de verificación

**Opción A — Túnel SSH desde tu Mac:**

```bash
ssh -L 8025:127.0.0.1:8025 root@<IP_VPS>
```

Abrir en navegador: `http://localhost:8025`

**Opción B — Desde el VPS (API):**

```bash
curl -s http://127.0.0.1:8025/api/v2/messages | python3 -m json.tool
```

### Flujo típico

1. Usuario se registra en ChatbotX
2. Abrir MailHog → buscar email de verificación
3. Clic en el enlace de verificación
4. Volver a ChatbotX e iniciar sesión

### Síntoma: `Email not verified` al iniciar sesión

| Síntoma | Causa | Solución |
|---|---|---|
| Login muestra **Email not verified** | El correo de verificación está en **MailHog**, no en Gmail/Outlook | §6 — túnel `8025` y clic en el enlace |
| No puedes abrir MailHog | Puerto `8025` solo escucha en `127.0.0.1` del VPS | `ssh -L 8025:127.0.0.1:8025 root@<IP_VPS>` |

**Listar correos de verificación (API, en el VPS):**

```bash
curl -s http://127.0.0.1:8025/api/v2/messages \
  | python3 -c "
import sys, json, re
d = json.load(sys.stdin)
for m in d.get('items', [])[:10]:
    to = m['Content']['Headers'].get('To', [''])[0]
    subj = m['Content']['Headers'].get('Subject', [''])[0]
    print(to, '|', subj)
"
```

**Alternativa rápida (SQL)** — marcar email verificado sin abrir MailHog:

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
UPDATE \"User\"
SET \"emailVerified\" = true
WHERE email = '<EMAIL_DEL_USUARIO>'
RETURNING id, email, \"emailVerified\";
"
```

> Tras verificar, **cerrar sesión y volver a entrar** (o limpiar cookies del dominio `iris.bifrost.com.co`).

---

## 7. Community Edition: workspace único

### Comportamiento esperado

- Solo existe **1 workspace** (creado por seed: `DEMO`).
- El botón **Create Workspace** está **oculto** en código (`showCreateCard = !isCommunity()`).
- Usuarios nuevos registrados **no tienen workspace** hasta:
  - **Opción A:** Invitación desde `demo@example.com` → Settings → Members
  - **Opción B:** Transferencia por base de datos (§8, usado en BIFROST)

### Síntomas

| Síntoma | Causa |
|---|---|
| Usuario nuevo sin workspace | Cupo único ocupado por DEMO |
| No aparece "Crear workspace" | Limitación Community, no es bug |
| `demo@` sí ve DEMO | Es el owner del seed |
| `Workspace limit reached for this plan` | Community = 1 workspace por `ownerId` (§7.1) |

### 7.1 Límite técnico

En **Community self-hosted** (`NEXT_PUBLIC_EDITION: community`), el límite está **hardcodeado** en el backend:

| Constante / check | Valor | Archivo (monorepo) |
|---|---|---|
| `COMMUNITY_MAX_WORKSPACES` | **1** | `packages/business/src/workspace/service.ts` |
| UI `showCreateCard` | oculto si Community | `apps/builder/src/features/workspaces/components/workspaces-list.tsx` |

- Cuenta por **`ownerId`**: si `juan@bifrost.com.co` ya es owner de un workspace, no puede crear otro.
- **No depende** de usar `chatbotx-docker-compose` vs `ChatbotX-main` en desarrollo: misma lógica en las imágenes oficiales.
- La tabla `UserQuota` en Community self-hosted suele tener `workspacesLimit` vacío (`NULL`); el tope real lo impone el código Community, no la fila de quota.

### 7.2 Opciones si necesitas varios workspaces

| Opción | Viable en VPS actual | Notas |
|---|---|---|
| **A. Un workspace + miembros invitados** | ✅ Recomendado POC | §8 transferir owner + Settings → Members |
| **A2. Varios WhatsApp en el mismo workspace** | ✅ Community | §11.2 — no requiere otro workspace |
| **B. Licencia Enterprise** (`LICENSE_KEY`) | ✅ Oficial | `maxWorkspaces` en token; ver `ChatbotX-main/docs/licensing.md` |
| **C. Fork + imágenes Docker propias** | ⚠️ Alto mantenimiento | Parchear `COMMUNITY_MAX_WORKSPACES` en `ChatbotX-main`, build `builder`/`worker`, desplegar |
| **D. `NEXT_PUBLIC_EDITION: enterprise` sin licencia** | ❌ **No usar** | Rompe el worker — §7.3 |
| **E. Segundo usuario con su propio workspace** | ✅ Community | §7.5 — 1 workspace por `ownerId`; otro correo = otro cupo |

Para BIFROST POC (un operador / una marca `iris`), la opción **A** es la correcta.  
Para **otra marca/operador** con WhatsApp y flujos aislados (ej. Líneas Timanco), usar la opción **E** (§7.5).

### 7.3 Intento fallido: `enterprise` sin licencia (Ago-2026)

**Hipótesis probada en VPS `62.171.187.39`:** cambiar solo la variable de entorno para saltarse el límite Community:

```yaml
# NO HACER en imágenes oficiales sin LICENSE_KEY
NEXT_PUBLIC_EDITION: enterprise
```

**Resultado:**

1. `builder` recreó y arrancó (la UI podría mostrar "Crear workspace").
2. **`worker` entró en crash loop** y no procesó WhatsApp ni flujos:

```
This edition requires a valid LICENSE_KEY issued for this deployment. Refusing to start.
```

3. Causa: `assertLicenseAtStartup()` en `packages/business/src/enterprise/license/startup.ts` hace `process.exit(1)` si `edition` es `enterprise` o `cloud` y no hay `LICENSE_KEY` válida.
4. **Se revirtió** a `community` desde `docker-compose.yml.bak-edition`; worker y builder quedaron operativos.

**Conclusión:** en el stack actual (`ghcr.io/chatbotxio/chatbotx-*`) **no se puede** quitar el límite de workspaces solo con variables de entorno.

### 7.4 Revertir si el worker no arranca

Si aplicaste `enterprise`/`cloud` sin licencia y el worker reinicia en bucle:

```bash
cd ~/chatbotx

# Restaurar backup (si existe)
cp docker-compose.yml.bak-edition docker-compose.yml

# O forzar community manualmente
sed -i 's/NEXT_PUBLIC_EDITION: enterprise/NEXT_PUBLIC_EDITION: community/' docker-compose.yml
sed -i 's/NEXT_PUBLIC_EDITION: cloud/NEXT_PUBLIC_EDITION: community/' docker-compose.yml

grep NEXT_PUBLIC_EDITION docker-compose.yml
# Debe mostrar: NEXT_PUBLIC_EDITION: community

docker compose -p chatbotx up -d builder worker

# Verificar
docker compose -p chatbotx ps worker
docker compose -p chatbotx logs worker --tail=20
curl -sI http://127.0.0.1:3123/api/health | head -3
```

Esperado tras revertir: worker **Up** (no `Restarting`), health **200**.

### 7.5 Segundo usuario + workspace propio (caso Timanco)

Cuando necesitas **otro workspace** en Community (no otro canal WhatsApp en el mismo workspace — eso es §11.2), la vía correcta es **registrar un segundo usuario**: cada `ownerId` puede tener **1 workspace**.

**Caso validado Ago-2026 — Líneas Timanco:**

| Recurso | Valor |
|---|---|
| Usuario | `timanco@bifrost.com.co` |
| User ID | `11668251685715968` |
| Workspace | `Lineas Timanco` |
| Workspace ID | `11668251685717000` |
| WorkspaceMember (owner) ID | `11668251685717001` |
| WABA Timanco (pendiente conectar) | `1385906103014875` |
| Workspace BIFROST Taxi (Juan) | `11667520342818816` — **no se modifica** |

#### Flujo completo

1. **Registro** en `https://iris.bifrost.com.co/auth/sign-up` con correo del segundo operador — **o** alta manual §5.5.2 si registro cerrado en Caddy.
2. **Verificar email** — §6 (MailHog) o SQL de `emailVerified` (abajo).
3. **Crear workspace por SQL** — en Community el botón "Create Workspace" está oculto; un usuario nuevo no hereda el DEMO de Juan.
4. **Reiniciar** `builder` y `worker` tras cambios en DB.
5. **Conectar WhatsApp** del segundo operador en su workspace (§11.1) cuando corresponda.

#### 7.5.1 Verificar email (si sale `Email not verified`)

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
UPDATE \"User\"
SET \"emailVerified\" = true
WHERE email = 'timanco@bifrost.com.co'
RETURNING id, email, \"emailVerified\";
"
```

#### 7.5.2 Obtener IDs del nuevo usuario

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
SELECT id, email, name, \"emailVerified\", \"createdAt\"
FROM \"User\"
ORDER BY \"createdAt\" DESC;
"
```

Anotar `USER_ID` del correo nuevo (ej. `11668251685715968`).

#### 7.5.3 Crear workspace + membership (owner)

Generar IDs únicos (snowflake). En el VPS se usaron IDs nuevos mayores que los existentes. **No reutilizar** los IDs de Timanco si creas otro usuario.

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -v ON_ERROR_STOP=1 -c "
BEGIN;

INSERT INTO \"Workspace\" (
  id, \"createdAt\", \"updatedAt\", name, \"targetCountry\", language, timezone,
  \"brandColor\", \"developmentMode\", \"ownerId\", \"tenantId\", \"isActive\",
  \"defaultReplyFrequency\"
) VALUES (
  '<WORKSPACE_ID>',
  NOW(), NOW(),
  'Lineas Timanco',
  'CO',
  'es',
  'America/Bogota',
  '#016DFF',
  false,
  '<USER_ID>',
  '1',
  true,
  'allTime'
);

INSERT INTO \"WorkspaceMember\" (
  id, \"createdAt\", \"updatedAt\", \"workspaceId\", \"userId\", role,
  \"notificationChannels\", \"notificationTypes\", permissions
) VALUES (
  '<WORKSPACE_MEMBER_ID>',
  NOW(), NOW(),
  '<WORKSPACE_ID>',
  '<USER_ID>',
  'owner',
  '{\"messenger\": true, \"email\": true, \"telegram\": true, \"browser\": true}',
  '{\"notifyAdmin\": true, \"newMessageToHuman\": true, \"newOrder\": true}',
  '{\"superAdmin\": true, \"analytics\": true, \"flows\": true, \"contacts\": true, \"onlyAssignedContacts\": false, \"emailAndPhone\": true, \"broadcast\": true, \"ecommerce\": true}'
);

COMMIT;
"
```

> **Nota schema VPS (Ago-2026):** la imagen desplegada **no** tiene columna `capiLimitedDataUse` en `Workspace`. No incluirla en el `INSERT` o fallará con `column does not exist`.

#### 7.5.4 Reiniciar servicios

```bash
cd ~/chatbotx
docker compose -p chatbotx restart builder worker
```

#### 7.5.5 Verificar estado

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
SELECT w.id, w.name, u.email, u.\"emailVerified\"
FROM \"Workspace\" w
JOIN \"User\" u ON u.id = w.\"ownerId\"
ORDER BY w.\"createdAt\";
"
```

Esperado: dos filas — `Biftost Taxi` (Juan) y `Lineas Timanco` (Timanco).

#### 7.5.6 En la UI

1. Cerrar sesión si estabas logueado como otro usuario.
2. Iniciar sesión con `timanco@bifrost.com.co`.
3. Debe aparecer el workspace **Lineas Timanco**.
4. Siguiente paso operativo: conectar WhatsApp WABA `1385906103014875` — ver §7.5.7 (portafolio Meta **separado** → app nueva).

#### 7.5.7 WhatsApp Timanco: portafolio Meta separado

**Decisión validada Ago-2026:** Líneas Timanco opera en un **Meta Business Manager / portafolio distinto** al de BIFROST Taxi. En ese escenario **no se reutiliza** la app IRIS de Juan.

#### ¿Misma app o app nueva?

| Escenario Meta | ¿Reutilizar app IRIS? | Enfoque ChatbotX |
|---|---|---|
| **Mismo portafolio** — segunda WABA en el mismo Business Manager | ✅ Sí (usualmente) | Manual Setup (§11.1) o segundo canal (§11.2) con mismo System User |
| **Otro portafolio** — WABA en Business Manager ajeno (caso Timanco) | ❌ **No** | **App Meta nueva** (§10) + conexión en workspace Timanco — §7.5.7 (**Manual Setup** o **Transferir proveedor** + §9.4) |

La app IRIS (`1755626215639087`) solo administra activos del portafolio BIFROST. No puede suscribir webhooks ni emitir tokens válidos para la WABA `1385906103014875` si esa WABA vive en el portafolio de Timanco.

#### Mapa de recursos (BIFROST vs Timanco)

| Recurso | BIFROST Taxi (Juan) | Líneas Timanco |
|---|---|---|
| Meta Business / portafolio | BIFROST | **Timanco (aparte)** |
| App Meta | IRIS `1755626215639087` | **Nueva app** (crear §10) |
| System User + token | Del portafolio BIFROST | **Nuevo** en BM de Timanco |
| WABA ID | `1410723497626554` | `1385906103014875` |
| Workspace ChatbotX | `Biftost Taxi` (`11667520342818816`) | `Lineas Timanco` (`11668251685717000`) |
| Usuario ChatbotX | `juan@bifrost.com.co` | `timanco@bifrost.com.co` |
| Webhook en Meta | App **IRIS** | App **nueva de Timanco** |

#### Platform Credentials globales (§9) — no reemplazar

En self-hosted hay **un juego** de Platform Credentials en `/admin/platform-credentials` (configurado por `PLATFORM_ADMIN_EMAIL`, hoy Juan). Esas credenciales apuntan a la app **IRIS** y alimentan Embedded Signup / defaults de la instancia.

| Acción | ¿Hacerlo? |
|---|---|
| Mantener credenciales IRIS para Bifrost Taxi | ✅ Sí |
| **Sustituir** credenciales globales por las de Timanco | ❌ **No** — rompe o confunde el canal BIFROST |
| Conectar Timanco con **Manual Setup** + token del System User de Timanco | ✅ Sí — el canal usa el token pegado al conectar, no las credenciales globales de IRIS |

> Manual Setup marca la conexión como `isManual` en backend; el envío/recibo usa el **token del canal**, no el System User de Platform Credentials. Ver `packages/business/src/integration-whatsapp/service.ts`.

#### Pasos operativos — Timanco (otro portafolio)

Dos vías validadas en Ago-2026:

| Vía | Cuándo usarla | Documentación |
|---|---|---|
| **B — Manual Setup** | Número ya en Cloud API; evitar popup OAuth | Pasos B abajo |
| **B′ — Transferir desde otro proveedor** | Migrar número desde otro BSP (ManyChat, etc.) | §11.3 + §9.4 dominios Meta |

**A. En Meta (portafolio Timanco)** — repetir §10 en el Business Manager de Timanco:

1. Crear **app Meta nueva** (Business → WhatsApp + Login para empresas).
2. Crear **Configuration ID** (obligatorio para **Transferir proveedor** / Embedded Signup; opcional solo para Manual Setup).
3. **§9.4** — registrar dominio `iris.bifrost.com.co` + OAuth callback en la **app Timanco** (validado: sin esto el popup falla).
4. Crear **System User** en el BM de Timanco.
5. **Add Assets** → asignar la **app nueva** + WABA `1385906103014875` → Full Control.
6. **Generate new token** (Never) con permisos `whatsapp_business_management`, `whatsapp_business_messaging`, `whatsapp_business_manage_events`.

**B. En ChatbotX — Manual Setup** (workspace Lineas Timanco):

1. Iniciar sesión como `timanco@bifrost.com.co`.
2. Workspace **Lineas Timanco** → **Settings → Channels → Add WhatsApp**.
3. Si pide settings y Timanco no es super admin: las credenciales globales IRIS en §9 bastan como **puerta de entrada** de la instancia.
4. **Manual Setup** (§11.1):
   - *Connect an existing WhatsApp Business Account*
   - *Manual connect using System User Access token*
   - **WABA ID:** `1385906103014875`
   - **Access Token:** token del System User de **Timanco** (no el de BIFROST)
5. Copiar de la pantalla final:
   - **Webhook URL del canal** → `https://iris.bifrost.com.co/integrations/whatsapp/webhook/<ID_CANAL_TIMANCO>`
   - **Verify token** del canal (UUID nuevo, distinto al de Bifrost)

**B′. En ChatbotX — Transferir desde otro proveedor** (validado Ago-2026):

1. Mismos pasos 1–3 de **B**.
2. Marcar **Transferir teléfono desde otro proveedor de WhatsApp**.
3. Clic **Continuar** → popup **Continuar con Facebook** (Embedded Signup — §11.3).
4. Completar asistente de Meta (requiere §9.4 en la app del portafolio).
5. Tras éxito → §9.4.1 (verificación; webhook suele autoconfigurarse vía API).

> Detalle completo OAuth vs Manual: **§11.3**. Platform Credentials globales pueden seguir siendo IRIS; el popup muestra el nombre de la app de esas credenciales.

**C. En Meta (app nueva de Timanco)** — §12:

1. App **de Timanco** (no IRIS) → WhatsApp → Configuración → Webhooks.
2. Callback URL → URL **completa** del paso B.5 (con `<ID_CANAL_TIMANCO>`).
3. Verify token → el UUID del canal Timanco.
4. Verificar y guardar.
5. Suscribir **`messages`** y **`flows`**.

Verificación rápida:

```bash
curl -s "https://iris.bifrost.com.co/integrations/whatsapp/webhook/<ID_CANAL_TIMANCO>?hub.mode=subscribe&hub.verify_token=<VERIFY_TOKEN_TIMANCO>&hub.challenge=test123"
# Esperado: test123
```

#### Checklist Timanco (portafolio separado)

```
[ ] App Meta nueva creada en BM de Timanco (§10)
[ ] Dominios Meta en app Timanco: iris.bifrost.com.co + OAuth callback (§9.4)
[ ] Configuration ID en app Timanco (si usas Transferir proveedor)
[ ] System User Timanco con app + WABA 1385906103014875
[ ] Token permanente (Never) — solo si usas Manual Setup
[ ] Canal conectado en workspace Lineas Timanco (Manual §11.1 O OAuth Transferir §11.3)
[ ] Webhook del canal en app TIMANCO (no en IRIS) — §12 / §9.4.1
[ ] Platform Credentials globales IRIS sin modificar (§9)
[ ] Mensaje de prueba en Inbox de Lineas Timanco (§15)
```

#### Errores frecuentes (Timanco / otro portafolio)

| Error | Causa | Acción |
|---|---|---|
| Token inválido al conectar canal | Token del System User de **BIFROST** en WABA Timanco | Generar token en el BM de Timanco |
| Webhook verify falla | URL/token configurados en app **IRIS** en vez de app Timanco | Webhook en la app del portafolio correcto |
| Bifrost Taxi dejó de recibir mensajes | Se cambiaron Platform Credentials globales a Timanco | Restaurar credenciales IRIS en §9 |
| `phone_numbers` (#100) | App ID del canal no coincide con la WABA | Usar app creada en el mismo BM que la WABA |
| Dominio no incluido en la app (popup Meta) | App Meta sin `iris.bifrost.com.co` ni OAuth callback | §9.4 — dominios + redirect URI; reintentar popup |
| OAuth OK pero no llegan mensajes | Falta webhook del **canal** en app Timanco | §9.4.1 + §12 |

#### Errores frecuentes (segundo usuario)

| Error | Causa | Acción |
|---|---|---|
| `Email not verified` | Correo no verificado en MailHog | §7.5.1 o §6 |
| Pantalla vacía / sin workspace | Community no crea workspace al registrarse | §7.5.3 (SQL) |
| `Workspace limit reached` | Mismo usuario intenta crear un **segundo** workspace | Usar otro correo (nuevo `ownerId`) o §11.2 si solo necesitas otro WhatsApp |
| `column \"capiLimitedDataUse\" does not exist` | Schema del VPS más antiguo que el monorepo local | Omitir esa columna en el `INSERT` |

---

## 8. Transferir workspace al usuario principal

Cuando el owner del negocio debe ser `juan@bifrost.com.co` y no `demo@example.com`.

### 8.1 Obtener IDs

```bash
docker exec -it chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
SELECT id, email, name FROM \"User\";
SELECT id, name, \"ownerId\" FROM \"Workspace\";
SELECT id, \"workspaceId\", \"userId\", role FROM \"WorkspaceMember\";
"
```

Anotar:
- `USER_ID_JUAN` — id del usuario principal
- `WORKSPACE_ID` — id del workspace DEMO
- `WORKSPACE_MEMBER_DEMO` — fila owner de demo (para copiar permissions)

### 8.2 Transferir ownership

```bash
docker exec -it chatbotx-postgres-1 psql -U chatbotx -d chatbotx -v ON_ERROR_STOP=1 -c "
BEGIN;

UPDATE \"Workspace\"
SET \"ownerId\" = '<USER_ID_JUAN>'
WHERE id = '<WORKSPACE_ID>';

INSERT INTO \"WorkspaceMember\" (
  id, \"workspaceId\", \"userId\", role, permissions,
  \"notificationTypes\", \"notificationChannels\", \"createdAt\", \"updatedAt\"
)
SELECT
  '<NUEVO_ID_UNICO>',
  '<WORKSPACE_ID>',
  '<USER_ID_JUAN>',
  'owner',
  permissions,
  \"notificationTypes\",
  \"notificationChannels\",
  NOW(),
  NOW()
FROM \"WorkspaceMember\"
WHERE \"workspaceId\" = '<WORKSPACE_ID>' AND role = 'owner'
LIMIT 1
ON CONFLICT DO NOTHING;

COMMIT;
"
```

### 8.3 Reiniciar servicios

```bash
cd ~/chatbotx
docker compose -p chatbotx restart builder worker
```

### 8.4 En la UI

1. Cerrar sesión / volver a entrar con `juan@bifrost.com.co`
2. **Refresh All Permissions** (barra lateral)
3. Debe aparecer el workspace como **OWNER**

---

## 9. Super Admin y Platform Credentials

En self-hosted, **WhatsApp exige Platform Credentials propias** (no hay apps preconfiguradas de ChatbotX).

### 9.1 Habilitar Super Admin

Variable obligatoria en `docker-compose.yml`:

```yaml
PLATFORM_ADMIN_EMAIL: juan@bifrost.com.co
```

Reiniciar: `docker compose -p chatbotx up -d builder worker`

### 9.2 Acceder al panel

URL: `https://iris.bifrost.com.co/admin/platform-credentials`

> `/manage/platform-credentials` **no existe** en self-hosted (solo cloud).

### 9.3 Campos WhatsApp (Platform Credentials)

| Campo ChatbotX | Origen |
|---|---|
| App ID | Meta → App → Settings → Basic |
| App Secret | Misma página → Show |
| API Version | `v25.0` (o la activa en la app) |
| Webhook Verify Token | **Texto que tú inventas** (ej. `bifrost_iris_whatsapp_2026`) — **NO** es un token `EAA...` |
| App Config ID | Login para empresas → Configurations → WhatsApp Embedded Signup (§10) |
| System User ID | Graph API Explorer → `GET /me` con System User Token |
| System User Token | Business Settings → System Users → Generate Token (Never) |
| Business ID | Opcional — Business Settings → Business info |
| Business Name | Ej. `Bifrost` |

Tras guardar, ChatbotX muestra:
- Webhook URL plataforma: `https://iris.bifrost.com.co/integrations/whatsapp/webhook`
- Auth callback: `https://iris.bifrost.com.co/integrations/whatsapp/callback`

> **Varios portafolios Meta (Timanco):** estas credenciales son **globales de la instancia** y corresponden a la app **IRIS** (BIFROST). **No las reemplaces** por las de otro cliente. Timanco puede conectar por **Manual Setup** (§7.5.7) o **Transferir proveedor** (§9.4 + §9.4.1) con app propia en su portafolio.

### 9.4 Dominios Meta (OAuth / Embedded Signup / “Transferir desde otro proveedor”)

Si al conectar WhatsApp con **Embedded Signup** o **“Transferir teléfono desde otro proveedor”** se abre un popup de Facebook y aparece:

> *El dominio de esta URL no está incluido en los dominios de la app*

significa que la **app Meta usada en Platform Credentials** (App ID + Config ID del OAuth) **no tiene autorizado** el dominio de ChatbotX.

#### URLs que Meta debe aceptar (BIFROST)

| Uso | URL exacta |
|---|---|
| **OAuth callback** (Embedded Signup / transferir proveedor) | `https://iris.bifrost.com.co/integrations/whatsapp/callback` |
| **Webhook plataforma** (referencia) | `https://iris.bifrost.com.co/integrations/whatsapp/webhook` |
| **Dominio de la app** | `iris.bifrost.com.co` |

#### Configurar en Meta Developers (app que usa el OAuth)

En [developers.facebook.com/apps](https://developers.facebook.com/apps/) → **la app del flujo** (IRIS para Bifrost; **app nueva de Timanco** si cambiaste credenciales o creaste app aparte):

**1. Configuración → Básica**

| Campo | Valor |
|---|---|
| **Dominios de la app** | `iris.bifrost.com.co` |
| **URL de la política de privacidad** | URL válida (puede ser la de tu sitio) |
| **URL de eliminación de datos** | URL válida o la misma política |

**2. Configuración → Básica → Agregar plataforma → Sitio web** (si no existe)

| Campo | Valor |
|---|---|
| **URL del sitio** | `https://iris.bifrost.com.co` |

**3. Inicio de sesión con Facebook para empresas** → **Configuración**

| Campo | Valor |
|---|---|
| **URI de redireccionamiento de OAuth válidos** | `https://iris.bifrost.com.co/integrations/whatsapp/callback` |

> Copiar la URL desde ChatbotX: `/admin/platform-credentials` → tarjeta WhatsApp → **Auth callback URL**.

Guardar cambios y **esperar 1–2 minutos** antes de reintentar el popup.

#### ¿Qué flujo estás usando?

| Opción en ChatbotX | Requiere dominios Meta + Config ID | Timanco (otro portafolio) |
|---|---|---|
| **Transferir desde otro proveedor** | ✅ Sí (Embedded Signup OAuth) | ✅ Validado Ago-2026 — §11.3 + §9.4 |
| **Conectar cuenta existente** (coexistencia) | ✅ Sí | §11.3 + §9.4 |
| **Manual Setup** (token + WABA ID) | ❌ No abre popup OAuth | §11.1 |

Para **Líneas Timanco** hay dos caminos válidos: **Manual Setup** (§11.1) o **Transferir proveedor + Facebook** (§11.3). Con OAuth **no** pegas WABA ni token en ChatbotX.

#### 9.4.1 Tras OAuth exitoso (“Transferir desde otro proveedor”) — validado Timanco Ago-2026

Cuando el popup de Meta cierra sin error y ChatbotX redirige al workspace con el canal conectado:

1. **Verificar en ChatbotX** — Settings → Channels: el canal Timanco debe aparecer **conectado**.
2. **Webhook** — en flujo OAuth, ChatbotX llama `subscribeWebhook` por API al guardar el canal (`connect.action.ts`). **Normalmente no hace falta** pegar webhook a mano en Meta como en Manual Setup.
3. Si el **Inbox está vacío** tras enviar un WhatsApp de prueba:
   - Revisar §12 (webhook en app del portafolio correcto)
   - En Manual Setup sí aplica URL por canal (`/webhook/<ID>`); en OAuth suele usarse webhook de plataforma (`/integrations/whatsapp/webhook`) + suscripción API
4. **Prueba end-to-end** — mensaje al número Timanco → Inbox **Lineas Timanco** (§15).
5. **Verificación SMS/PIN** — si ChatbotX pide verificar el número, completar ese panel antes de probar el Inbox.

> Si usaste **Manual Setup** en lugar de OAuth, sí debes copiar Webhook URL + verify token del canal a Meta manualmente (§11.1 paso 5–6, §12).

---

## 10. Crear app Meta (paso a paso verificado)

### 10.1 Crear app nueva (recomendado para ChatbotX limpio)

1. [developers.facebook.com/apps](https://developers.facebook.com/apps/) → **Crear app**
2. Tipo: **Business** / Empresa
3. Caso de uso: **Conectarte con clientes a través de WhatsApp**
4. **No** marcar solo "Inicio de sesión con Facebook" (login de usuarios — no sirve para Config ID)

### 10.2 Agregar productos

En la app nueva, agregar:

1. **WhatsApp** → Configurar
2. **Inicio de sesión con Facebook para empresas** (Facebook Login **for Business**) → Configurar

> Si no aparece en el menú, URL directa:  
> `https://developers.facebook.com/apps/<APP_ID>/fb-login-for-business/configurations/`

### 10.3 Crear Configuration ID (Embedded Signup)

**Login para empresas → Configuraciones → Crear configuración**

| Paso del asistente | Valor |
|---|---|
| Nombre | `Bifrost` |
| Variación | **WhatsApp Embedded Signup** |
| Token de acceso | **Token de usuario del sistema** (System user) — no token de usuario personal |
| Activos | **Páginas** (mínimo; marcar "Activo requerido" si Meta lo exige) |
| Permisos | `whatsapp_business_management`, `whatsapp_business_messaging`, `whatsapp_business_manage_events` |

Al finalizar → copiar **Configuration ID** → pegar en ChatbotX Platform Credentials.

### 10.4 System User y token permanente

1. [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)
2. Crear System User (rol Admin) si no existe
3. **Add Assets** → asignar la app + WABA → Full Control
4. **Generate new token** → app correcta → expiración **Never**
5. Permisos mínimos:
   - `business_management`
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `whatsapp_business_manage_events`
6. **System User ID:** Graph API Explorer → pegar token → `GET /me` → copiar `id`

### 10.5 Datos del número (API Setup)

En la app con producto WhatsApp → **Configuración de la API**:

| Dato | Uso en ChatbotX |
|---|---|
| **WABA ID** | Canal → Manual Setup |
| **Phone Number ID** | Identificador del número en Graph API |
| **Display number** | El que el cliente escribe en WhatsApp |

### 10.6 ¿Cuándo crear app nueva? (mismo vs otro portafolio)

| Pregunta | Respuesta |
|---|---|
| ¿Segundo número en el **mismo** workspace y **mismo** portafolio Meta? | **No** hace falta app nueva — §11.2 (mismo workspace, otro canal) |
| ¿Segundo workspace, **mismo** portafolio Meta (otra WABA)? | **No** obligatorio — reutilizar app IRIS + Manual Setup (§7.5 + §11.1) |
| ¿Segundo workspace, **otro** portafolio / Business Manager (Timanco)? | **Sí — app Meta nueva** en el BM del cliente (§7.5.7) |

**Regla práctica:** si la WABA no es administrable desde el Business Manager donde vive la app IRIS, crea app nueva en el portafolio dueño de esa WABA.

**BIFROST POC — referencia:**

| Marca | Portafolio Meta | App Meta |
|---|---|---|
| BIFROST Taxi | BIFROST | IRIS `1755626215639087` |
| Líneas Timanco | Timanco (separado) | **Pendiente** — crear §10 en BM Timanco |

---

## 11. Conectar canal WhatsApp en ChatbotX

> **Community:** el límite es **1 workspace**, no 1 WhatsApp. Varios números van en el **mismo workspace** como canales distintos (§11.2).  
> **No** crear un workspace nuevo para un segundo número — ver §7.

### 11.1 Primer canal — Manual Setup

Flujo donde **tú pegas** WABA ID y token. No abre popup de Facebook.

1. Workspace → **Settings → Channels → Add WhatsApp**
2. Si aparece *"You need to add settings..."* → completar §9 primero
3. Activar **Manual Setup**:
   - *Connect an existing WhatsApp Business Account*
   - *Manual connect using System User Access token*
4. Pegar **WABA ID** + **Access Token** (System User permanente)
5. Pantalla final muestra:
   - **Webhook URL del canal** (con ID al final — §12)
   - **Verify token del canal** (UUID, distinto al de Platform Credentials)
6. Configurar webhook en Meta → §12

> ¿Prefieres no pegar datos y usar Facebook? Ver **§11.3** (Transferir proveedor + OAuth).

**Canal BIFROST POC (referencia):**

| Campo | Valor |
|---|---|
| Integration ID | `11667642312441856` |
| Nombre en UI | `Bifrost` |
| Webhook | `https://iris.bifrost.com.co/integrations/whatsapp/webhook/11667642312441856` |
| Workspace | `Biftost Taxi` (`11667520342818816`) |

---

### 11.2 Segundo canal (mismo workspace)

Usar cuando necesitas **otro número de WhatsApp** sin otro workspace (p. ej. segunda línea, otro cliente, número de prueba).

#### Requisitos previos

- Mismo workspace (ej. **Biftost Taxi**)
- **Platform Credentials** ya configuradas (§9) — suelen servir para todos los canales de la instancia
- Por número nuevo:
  - **WABA ID** (puede ser la misma u otra cuenta de negocio)
  - **Phone Number ID** (si Meta lo pide en el flujo)
  - **System User Access Token** con permisos `whatsapp_business_management` y `whatsapp_business_messaging`
  - Número en estado **CONNECTED** en Meta (WhatsApp Manager)

#### Pasos en ChatbotX

1. Entrar al workspace existente (**no** crear workspace nuevo)
2. **Settings → Channels → Add channel → WhatsApp**
3. **Manual Setup** (igual que §11.1):
   - *Connect an existing WhatsApp Business Account*
   - *Manual connect using System User Access token*
4. Pegar **WABA ID** y **Access Token** del **segundo número**
5. Completar nombre del canal (ej. `Bifrost Línea 2`)
6. Copiar de la pantalla final (cada canal es único):
   - **Webhook URL** → `https://iris.bifrost.com.co/integrations/whatsapp/webhook/<ID_NUEVO>`
   - **Verify token** del canal (UUID nuevo)

#### Pasos en Meta (por canal)

Repetir §12 para el **ID y verify token del canal nuevo**:

1. App Meta correcta (IRIS u otra según la WABA)
2. **WhatsApp → Configuración → Webhooks**
3. Callback URL → URL **completa** con `<ID_NUEVO>`
4. Verify token → token **del canal nuevo** (no reutilizar el del primer canal)
5. Verificar y guardar
6. Suscribir **`messages`** y **`flows`**

Verificación rápida:

```bash
curl -s "https://iris.bifrost.com.co/integrations/whatsapp/webhook/<ID_NUEVO>?hub.mode=subscribe&hub.verify_token=<VERIFY_TOKEN_NUEVO>&hub.challenge=test123"
# Esperado: test123
```

#### Misma WABA vs WABA distinta

| Escenario | Comportamiento Meta | Recomendación BIFROST |
|---|---|---|
| **Segundo número en otra WABA** | Cada WABA tiene su `subscribed_apps` y `override_callback_uri` | ✅ Caso ideal — dos canales independientes |
| **Segundo número en la misma WABA** | Meta permite **un** `override_callback_uri` por WABA; el último configurado puede reemplazar al anterior | ⚠️ Probar con cuidado; puede afectar el primer número |
| **App Meta vieja (Bifrost 3.5) activa** | Dos webhooks compiten | Desactivar webhook en la app que no uses (§12.6) |

> Código de referencia: `integrations/whatsapp/src/api/webhook.ts` — suscripción por `wabaId` con `override_callback_uri`.

#### Listar canales en el VPS

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
SELECT id, name, \"workspaceId\",
       auth->'metadata'->>'webhookUrl' AS webhook_url
FROM \"IntegrationWhatsapp\"
ORDER BY id;
"
```

#### Checklist segundo canal

```
[ ] Mismo workspace (NO workspace nuevo — §7)
[ ] Settings → Channels → Add WhatsApp → Manual Setup
[ ] WABA ID + System User token del número 2
[ ] Webhook URL con ID_NUEVO copiada en Meta
[ ] Verify token del canal 2 (distinto al canal 1)
[ ] messages + flows suscritos
[ ] Webhook app vieja desactivado si compite (§12.6)
[ ] Mensaje de prueba al número 2 → Inbox OK
[ ] Mensaje de prueba al número 1 → sigue OK (regresión)
```

#### Flujos e Inbox

- Cada canal puede tener su **Inbox** / conversaciones separadas en la misma UI
- Los **flujos** son del workspace: configura **Starting Step** o keywords por canal si hace falta routing distinto
- Tras conectar, revisar que las conversaciones nuevas entren en modo **Bot** (§14.4)

---

### 11.3 Embedded Signup / OAuth (Transferir proveedor + Continuar con Facebook)

**Validado Ago-2026 (Timanco).** Flujo guiado por Meta: **no pegas WABA ID, token ni Phone Number ID** en formularios de ChatbotX.

#### Cuándo usar este flujo

| Situación | ¿Usar OAuth (§11.3)? |
|---|---|
| Número en **otro BSP** (ManyChat, 360dialog, etc.) y quieres migrarlo | ✅ Activar **Transferir teléfono desde otro proveedor** |
| Número **ya en Cloud API** en tu Business Manager | ✅ OAuth (toggle transferir opcional) |
| No quieres popup / dominios OAuth en Meta | ❌ Usar **Manual Setup** (§11.1) |
| Portafolio Meta separado (Timanco) | ✅ Tras §9.4 dominios en app del cliente |

#### Pasos en ChatbotX

1. Workspace → **Settings → Channels → Add WhatsApp**
2. (Opcional) Activar **Transferir teléfono desde otro proveedor de WhatsApp** — Meta usa `only_waba_sharing` (migración desde otro BSP).
3. **No** activar Manual Setup.
4. Clic **Continuar** → se abre popup **Continuar con Facebook** (nombre de la app = Platform Credentials, ej. *Bifrost IRIS*).
5. Iniciar sesión con cuenta Facebook que tenga acceso al **Business Manager** y **WABA** del número.
6. Completar el **asistente de Meta** (negocio, WABA, número, pasos de migración si aplica).
7. ChatbotX recibe el `code` OAuth, intercambia token y conecta el canal automáticamente.

#### Qué automatiza ChatbotX (vs Manual Setup)

| Paso | Manual Setup (§11.1) | OAuth / Transferir + Facebook (§11.3) |
|---|---|---|
| WABA ID | Lo pegas tú | Lo resuelve del token (`deriveSignupTargets`) |
| Access Token | Lo pegas tú | Del `code` OAuth (`exchangeAccessToken`) |
| Phone Number ID | Lo pegas tú | Lista la WABA y elige (o autoselecciona si hay uno) |
| System User en WABA | Manual en BM | `addSystemUser` en servidor |
| Suscripción webhook | Copias URL a Meta (§12) | `subscribeWebhook` por API al conectar |
| Webhook URL en auth | Por canal `/webhook/<ID>` | Plataforma `/integrations/whatsapp/webhook` |

Código de referencia: `apps/builder/src/features/integration-whatsapp/actions/connect.action.ts`, `libs/embedded-signup.ts` (`transferPhoneNumber` → `only_waba_sharing`).

#### Requisitos previos (OAuth)

1. **Platform Credentials** en `/admin/platform-credentials` (App ID, Secret, **Configuration ID**, System User, etc.) — §9.
2. **Dominios Meta** en la app del OAuth — §9.4 (`iris.bifrost.com.co` + callback).
3. Cuenta Facebook con permisos sobre la WABA objetivo.
4. Para **Timanco** (otro portafolio): dominios en la **app Timanco** aunque las credenciales globales sigan siendo IRIS.

#### Qué sigue siendo manual (aun con Facebook)

- Completar pasos del **asistente Meta** (permisos, elegir WABA, migración BSP, PIN/OTP si Meta lo pide).
- **Verificación del número** en ChatbotX si Meta devuelve `verification_required` (panel SMS en la UI).
- Si el Inbox no recibe mensajes: troubleshooting §12 / §16 (webhook, app incorrecta, WABA sin suscripción).

#### Popup “Continuar como [usuario]”

- Es normal que muestre el nombre de la **app de Platform Credentials** (ej. *Bifrost IRIS*).
- Debes continuar con usuario que tenga acceso al BM de la WABA que conectas (Timanco ≠ cuenta personal sin permisos).
- Meta puede advertir: *“Las cuentas nuevas no tienen aprobación para acceder al administrador comercial”* — usar cuenta con BM existente.

#### Comparación rápida

```
Manual Setup     →  Formularios ChatbotX + webhook copiado a Meta (§11.1, §12)
OAuth + Facebook →  Asistente Meta + autoconexión en ChatbotX (§11.3, §9.4)
```

---

## 12. Webhook en Meta (crítico)

> **Causa #1 de "envié hola y no aparece":** webhook no configurado o URL incompleta.

### 12.1 URL correcta (canal)

Formato:

```
https://iris.bifrost.com.co/integrations/whatsapp/webhook/<INTEGRATION_WHATSAPP_ID>
```

Ejemplo real BIFROST:

```
https://iris.bifrost.com.co/integrations/whatsapp/webhook/11667642312441856
```

**No** usar solo `iris.bifrost.com.co/integration...` — debe incluir `/integrations/whatsapp/webhook/` + ID numérico del canal.

### 12.2 Verify token

Usar el token **del canal** (pantalla post-conexión), no el de Platform Credentials.

### 12.3 Configurar en Meta UI

App correcta → **WhatsApp → Configuración → Webhooks**:

1. Callback URL → pegar URL **completa**
2. Verify token → pegar token del canal
3. **Verificar y guardar**
4. Suscribir campos: **`messages`** y **`flows`**

### 12.4 Configurar vía Graph API (alternativa validada)

Si la UI de Meta no muestra WhatsApp en app nueva, suscribir con **App Access Token** (`APP_ID|APP_SECRET`):

```bash
APP_TOKEN="<APP_ID>|<APP_SECRET>"
URL="https://iris.bifrost.com.co/integrations/whatsapp/webhook/<INTEGRATION_ID>"
VT="<VERIFY_TOKEN_DEL_CANAL>"

curl -s -X POST "https://graph.facebook.com/v25.0/<APP_ID>/subscriptions" \
  -d "object=whatsapp_business_account" \
  -d "callback_url=$URL" \
  -d "verify_token=$VT" \
  -d "fields=messages,flows" \
  -d "access_token=$APP_TOKEN"
```

Respuesta esperada: `{"success":true}`

Verificar:

```bash
curl -s "https://graph.facebook.com/v25.0/<APP_ID>/subscriptions?access_token=$APP_TOKEN"
```

### 12.5 Probar verificación del endpoint

```bash
curl -s "https://iris.bifrost.com.co/integrations/whatsapp/webhook/<INTEGRATION_ID>?hub.mode=subscribe&hub.verify_token=<VERIFY_TOKEN>&hub.challenge=test123"
# Esperado: test123
```

### 12.6 Conflicto: dos apps en la misma WABA

Si la WABA tiene suscritas **Bifrost 3.5** (vieja) y **Bifrost IRIS** (nueva), desactivar webhook en la app que **no** usa ChatbotX (ej. la que apuntaba a n8n/Chatwoot).

```bash
curl -s "https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps" \
  -H "Authorization: Bearer <SYSTEM_USER_TOKEN>"
```

---

## 13. Almacenamiento de archivos e imágenes (RustFS)

ChatbotX usa **RustFS** (S3-compatible) en el contenedor `filesystem` (puerto `9000`). Las imágenes de flujos, media library y adjuntos pasan por `POST /api/presigned-upload` y luego un `PUT` firmado al storage.

### 13.1 Flujo de subida y lectura

ChatbotX usa **dos rutas** en el mismo dominio (`iris`):

| Ruta | Uso | Destino Caddy |
|---|---|---|
| `/chatbotx/*` | **PUT** presigned (subida) | `localhost:9000` (RustFS) |
| `/storage/*` | **GET** público (vista en UI, `_next/image`) | `localhost:9000/chatbotx/...` |

La URL pública que guarda la app es `{BUILDER_URL}/storage/public/...` (no `/chatbotx/`).  
En desarrollo, Next.js reescribe `/storage/:path*` → `S3_ENDPOINT/chatbotx/:path*`. En producción, **Caddy** debe hacer lo mismo (§4 y §13.3).

```
Navegador (iris.bifrost.com.co)
  → POST /api/presigned-upload                    (builder devuelve publicUrl en /storage/...)
  → PUT https://iris.bifrost.com.co/chatbotx/...  (sube a RustFS vía Caddy)
  → GET https://iris.bifrost.com.co/storage/...   (preview en Flow Builder / _next/image)
```

### 13.2 Variables obligatorias (`docker-compose.yml`)

En `x-environment: &common-vars`:

```yaml
NEXT_PUBLIC_ASSET_URL: https://iris.bifrost.com.co/chatbotx/public/
S3_ENDPOINT: https://iris.bifrost.com.co
S3_ACCESS_KEY_ID: chatbotx
S3_SECRET_ACCESS_KEY: secretkey
S3_BUCKET: chatbotx
S3_REGION: us-west-2
```

En `x-rustfs-environment: &rustfs-environment`:

```yaml
RUSTFS_CORS_ALLOWED_ORIGINS: https://iris.bifrost.com.co
```

### 13.3 Caddy — rutas `/storage/*` y `/chatbotx/*` en `iris`

Sin `/chatbotx/*`, las subidas van a otro subdominio (`cdn.iris`) y el navegador bloquea por **CORS**.  
Sin `/storage/*`, la subida puede funcionar pero la **preview** falla con **404** en `_next/image?url=.../storage/public/...`.

```caddy
iris.bifrost.com.co {
    # GET público: /storage/public/... → RustFS /chatbotx/public/...
    # IMPORTANTE: handle_path + {path}. Con {uri} queda /chatbotx/storage/... → 403
    handle_path /storage/* {
        rewrite * /chatbotx{path}
        reverse_proxy localhost:9000
    }
    # PUT presigned
    handle /chatbotx/* {
        reverse_proxy localhost:9000
    }
    reverse_proxy localhost:3123
}
```

Tras editar: `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy`

**Verificar lectura pública** (debe ser **200** o **403** de RustFS, no **404** del builder):

```bash
curl -sI "https://iris.bifrost.com.co/storage/public/" | head -5
# Mal: HTTP/2 404 o 308 hacia la app Next.js
# Bien: HTTP/2 403 (RustFS sin listado) o 200 si el objeto existe
```

### 13.4 Aplicar cambios y reiniciar

```bash
cd ~/chatbotx
# Backup recomendado
cp docker-compose.yml docker-compose.yml.bak-storage

docker compose -p chatbotx up -d filesystem builder worker
```

### 13.5 Verificar storage

```bash
# RustFS healthy
curl -I http://127.0.0.1:9000/health

# CORS preflight (debe incluir access-control-allow-origin)
curl -si -X OPTIONS \
  -H 'Origin: https://iris.bifrost.com.co' \
  -H 'Access-Control-Request-Method: PUT' \
  https://iris.bifrost.com.co/chatbotx/public/ | head -12
```

Respuesta esperada: `access-control-allow-origin: https://iris.bifrost.com.co`

### 13.6 Workaround sin subir archivo

En el nodo de imagen del Flow Builder → **Insertar enlace** → pegar URL pública (`https://...jpg`). No pasa por RustFS.

---

## 14. Activar flujos y modo Bot

Un flujo **no responde solo** por existir. Hacen falta tres cosas: **publicar**, **encender** y **configurar disparador**. Además, la conversación debe estar en modo **Bot**.

### 14.1 Publicar el flujo

1. **Automation → Flows** → abrir el flujo
2. Armar el **Starting Step** (WhatsApp u omnicanal)
3. Clic en **Publish** (botón verde, arriba a la derecha)

Hasta publicar, los cambios son solo borrador.

### 14.2 Activar el toggle Status

En la lista de **Flows**, columna **Status** → switch **ON**.

Si está OFF, ChatbotX trata el flujo como inactivo.

### 14.3 Configurar disparador

| Método | Dónde | Cuándo usar |
|---|---|---|
| **Keywords** | Automation → Keywords → Contact | `hola`, `taxi`, `menu` |
| **Default Reply** | Settings → General → Default Reply | Respuesta a cualquier mensaje sin keyword |
| **Triggers** | Triggers → Create Rule | Eventos (ej. New Contact) |
| **Manual** | Inbox → Send Flow | Pruebas o atención humana |

Prioridad de mensajes entrantes: **Keywords → AI Agent → Default Reply**.

### 14.4 Transferir a Bot (crítico)

Si la conversación está en modo **Human**, el bot **no responde** aunque el flujo esté publicado.

**Manual (Inbox):**

1. Abrir la conversación
2. Si no ves el botón "Bot activo", la conversación está en modo humano
3. Usar **Transfer to Bot** / habilitar bot en el menú de la conversación

**En el flujo (automatizar):**

Agregar al inicio del flujo la acción **Perform Action → Transfer Conversation to Bot** (nodo `enableBot`).

**SQL — reactivar bot en todas las conversaciones del workspace** (solo si hace falta limpiar pruebas):

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
UPDATE \"Conversation\"
SET \"botEnabled\" = true, \"botResumeAt\" = NULL
WHERE \"workspaceId\" = '<WORKSPACE_ID>';
"
```

---

## 15. Verificación end-to-end

1. Platform Credentials guardadas (§9)
2. Canal WhatsApp creado (§11)
3. Webhook Meta verificado con URL **completa** (§12)
4. Storage configurado: `S3_ENDPOINT`, Caddy `/chatbotx/*`, CORS RustFS (§13)
5. Flujo publicado, Status ON, keyword o default reply configurado (§14)
6. Conversación en modo **Bot** (§14.4)
7. Enviar **mensaje nuevo** al número conectado (los anteriores al webhook no se reenvían)
8. Debe aparecer en **Inbox** y responder el bot
9. **Opcional:** subir imagen en un nodo del flujo → sin error CORS ni `presigned-upload` 400

### Consultas de diagnóstico en DB

```bash
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c "
SELECT COUNT(*) AS messages FROM \"Message\";
SELECT COUNT(*) AS conversations FROM \"Conversation\";
SELECT id, name, \"phoneNumberId\", \"wabaId\", \"registrationStatus\"
FROM \"IntegrationWhatsapp\";
"
```

### Logs

```bash
cd ~/chatbotx
docker compose -p chatbotx logs builder --since=30m | grep -i whatsapp
docker compose -p chatbotx logs worker --since=30m | grep -iE "error|whatsapp"
```

---

## 16. Troubleshooting

### UI / Cuentas

| Problema | Causa | Solución |
|---|---|---|
| `502` en `iris.bifrost.com.co` | ChatbotX no levantado | `docker compose -p chatbotx up -d` |
| Email de registro no llega | SMTP local MailHog | §6 — túnel puerto `8025` (solo ops; registro público cerrado §5.5) |
| Cualquiera puede registrarse | `/auth/sign-up` abierto | §5.5.1 — bloquear en Caddy |
| Login en inglés o con “Registrarse” / subtítulo ChatbotX | Caché Cloudflare o parches JS perdidos tras `pull` | §5.6 — purgar caché + reaplicar scripts |
| Nuevo operador sin cuenta | Registro cerrado | §5.5.2 alta manual SQL |
| **`Email not verified`** al login | Verificación pendiente (correo en MailHog) | §6 — MailHog o SQL `emailVerified` |
| Usuario nuevo sin workspace | Community = 1 workspace por owner; UI sin "Crear workspace" | §8 (transferir DEMO) o §7.5 (segundo usuario + SQL) |
| `Workspace limit reached for this plan` al crear workspace | Confundido con segundo WhatsApp | §7 — usar §11.2 (mismo workspace, nuevo canal) |
| Segundo WhatsApp no recibe mensajes | Webhook del canal 2 no configurado o URL sin ID | §11.2 + §12 |
| Primer WhatsApp dejó de funcionar tras conectar el segundo | Misma WABA, webhook sobrescrito | §11.2 — revisar `override_callback_uri` por WABA |
| Timanco no conecta / token inválido | WABA en **otro portafolio** con app/token de BIFROST | §7.5.7 — app nueva + System User Timanco + Manual Setup |
| Popup Meta: dominio no incluido en la app | App Timanco sin dominios OAuth de `iris` | §9.4 — dominios + callback; validado que funciona |
| OAuth Timanco OK, inbox vacío | Webhook del canal no configurado en app Timanco | §9.4.1 + §12 |
| Bifrost dejó de funcionar tras configurar Timanco | Se cambiaron Platform Credentials globales | Restaurar IRIS en §9; Timanco no usa credenciales globales |
| Worker `Restarting` tras cambiar edición | `enterprise`/`cloud` sin `LICENSE_KEY` | §7.4 — revertir a `community` |
| `LICENSE_KEY is not configured` en logs worker | Edición enterprise sin licencia | §7.3–§7.4 — **no** usar enterprise sin licencia |
| `/admin` da 404 | Falta `PLATFORM_ADMIN_EMAIL` | §9.1 + reiniciar builder |
| "You need to add settings..." en WhatsApp | Sin Platform Credentials | §9 |

### Meta / Credenciales

| Problema | Causa | Solución |
|---|---|---|
| No encuentro Configuration ID | Falta producto Login para empresas | §10.2 — URL directa configurations |
| Confundí Verify Token con token `EAA...` | Campos distintos | Verify Token = texto inventado; `EAA...` = System User Token |
| `PIN Mismatch` (#133005) | Re-registro con PIN incorrecto | Si número ya `CONNECTED` en Meta, ignorar o resetear PIN en WhatsApp Manager |
| App vieja y nueva en misma WABA | Dos webhooks compitiendo | Desactivar webhook en app que no usa ChatbotX |

### Webhook / Mensajes

| Problema | Causa | Solución |
|---|---|---|
| Envié hola, no aparece | Webhook no configurado | §12 |
| URL truncada en UI | Solo se leyó parte del dominio | Copiar con botón 📋 — incluir ID del canal |
| Webhook verify falla | Token incorrecto o URL incompleta | §12.5 |
| Logs: `Unable to find conversation` | Receipts de mensajes **salientes** viejos | Normal si no hay conversación previa; no bloquea inbound |
| `builder (unhealthy)` | Healthcheck interno | OK si `curl :3123` responde 307 |
| `ECONNREFUSED 127.0.0.1:1025` | SMTP apunta a localhost | `SMTP_SERVER: smtp://mailhog:1025` |

### Errores al crear canal

| Error | Causa | Solución |
|---|---|---|
| `phone_numbers` field not exist (#100) | Token/app incorrectos al validar | Revisar App ID del canal vs Platform Credentials |
| `Before override callback uri...` (#100) | Suscribir `messages` antes de override | Configurar webhook en UI o §12.4 |

### Flujos / Bot

| Problema | Causa | Solución |
|---|---|---|
| Flujo no responde a `hola` | No publicado, Status OFF o sin keyword/default reply | §14.1–§14.3 |
| Mensaje en Inbox pero sin respuesta del bot | Conversación en modo **Human** | §14.4 — Transfer to Bot |
| Solo funciona con "Send Flow" manual | Falta keyword o default reply | §14.3 |
| Default Reply no dispara | Flujo inactivo o no publicado | Publish + toggle Status ON |

### Inbox / tiempo real

| Problema | Causa | Solución |
|---|---|---|
| Mensajes nuevos solo al **refrescar** F5 | Falta `handle_path /ws/*` en Caddy → WS va a Next.js (404) | §4.1 — proxy `/ws/*` → `localhost:1999` |
| DevTools WS **"Finished"** en ~3 s | Misma causa o `REALTIME_BROADCAST_SECRET` distinto entre servicios | §4.1 + unificar secreto en compose |
| `curl …/ws/parties/…` devuelve **HTML** | Caddy no enruta `/ws` al realtime | Añadir bloque §4.1 y `systemctl reload caddy` |

### Subida de imágenes / Storage

| Problema | Causa | Solución |
|---|---|---|
| `POST /api/presigned-upload` **400** | Typo `S3_ENPOINT` en compose (falta `S3_ENDPOINT`) | Corregir a `S3_ENDPOINT: https://iris.bifrost.com.co` — §13.2 |
| `presigned-upload` 400 + `Path is required` | Request mal formado (raro en UI) | Recargar página; verificar workspace activo |
| **CORS** bloqueado: `cdn.iris` desde `iris` | Subdominios distintos; RustFS sin CORS | §13 — mismo dominio `iris` + `RUSTFS_CORS_ALLOWED_ORIGINS` |
| `PUT` a `cdn.iris...` **ERR_FAILED** | CDN no alcanzable o SSL/CORS en Cloudflare | Usar `S3_ENDPOINT: https://iris.bifrost.com.co` + ruta Caddy `/chatbotx/*` |
| Imagen sube pero no se ve (preview) | Falta ruta Caddy `/storage/*` | §13.3 — proxy a RustFS con prefijo `/chatbotx` |
| `_next/image` **404** con URL `/storage/public/...` | Falta ruta Caddy `/storage/*` | Añadir `handle_path /storage/*` en Caddyfile (§4, §13.3) |
| `_next/image` **403** con URL `/storage/public/...` | Rewrite Caddy usa `{uri}` → `/chatbotx/storage/...` | Usar `handle_path` + `rewrite * /chatbotx{path}` |
| Imagen sube pero no se ve | `NEXT_PUBLIC_ASSET_URL` incorrecta (legacy) | Opcional: `https://iris.bifrost.com.co/chatbotx/public/` — la app usa `/storage/` por defecto |

**Diagnóstico rápido en DevTools (Network):**

1. `presigned-upload` → debe ser **200** (no 400); respuesta incluye `publicUrl` con `/storage/public/...`
2. `PUT` siguiente → URL debe ser `https://iris.bifrost.com.co/chatbotx/...` (no `cdn.iris`)
3. `PUT` → status **200** (no CORS error)
4. Preview / `_next/image` → GET a `https://iris.bifrost.com.co/storage/public/...` debe ser **200** (no 404)

**Script de corrección en VPS** (referencia — validado Ago-2026):

```bash
cd ~/chatbotx
cp docker-compose.yml docker-compose.yml.bak-storage

# Corregir typo y endpoint
sed -i 's/S3_ENPOINT:/S3_ENDPOINT:/' docker-compose.yml
sed -i 's|S3_ENDPOINT: http://localhost:9000|S3_ENDPOINT: https://iris.bifrost.com.co|' docker-compose.yml
sed -i 's|NEXT_PUBLIC_ASSET_URL: https://cdn.iris.bifrost.com.co/chatbotx/public/|NEXT_PUBLIC_ASSET_URL: https://iris.bifrost.com.co/chatbotx/public/|' docker-compose.yml

# CORS RustFS (si no existe la línea)
grep -q 'RUSTFS_CORS_ALLOWED_ORIGINS' docker-compose.yml || \
  sed -i '/RUSTFS_SECRET_KEY:/a\  RUSTFS_CORS_ALLOWED_ORIGINS: https://iris.bifrost.com.co' docker-compose.yml

docker compose -p chatbotx up -d filesystem builder worker
```

**Corrección Caddy `/storage/*`** (preview de imágenes — validado Ago-2026):

```bash
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-storage

# Insertar bloque /storage/* antes de /chatbotx/* si no existe
grep -q 'handle_path /storage/' /etc/caddy/Caddyfile || sed -i '/handle \/chatbotx\//i\
    handle_path /storage/* {\
        rewrite * /chatbotx{path}\
        reverse_proxy localhost:9000\
    }' /etc/caddy/Caddyfile

caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy

# Verificar que /storage/ ya no devuelve 404 del builder
curl -sI "https://iris.bifrost.com.co/storage/public/" | head -5
```

---

## 17. Comandos útiles

```bash
# Estado contenedores
cd ~/chatbotx && docker compose -p chatbotx ps

# Reiniciar app
docker compose -p chatbotx restart builder worker

# Logs
docker compose -p chatbotx logs builder worker --tail=100

# Health HTTP
curl -I https://iris.bifrost.com.co

# MailHog (en VPS)
curl -s http://127.0.0.1:8025/api/v2/messages

# Postgres shell
docker exec -it chatbotx-postgres-1 psql -U chatbotx -d chatbotx

# Webhook URL del canal activo
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -t -A -c \
  "SELECT auth->'metadata'->>'webhookUrl' FROM \"IntegrationWhatsapp\" LIMIT 1;"

# Verificar storage S3/RustFS
grep -E 'S3_|NEXT_PUBLIC_ASSET|RUSTFS_CORS' ~/chatbotx/docker-compose.yml
curl -I http://127.0.0.1:9000/health

# CORS preflight storage
curl -si -X OPTIONS \
  -H 'Origin: https://iris.bifrost.com.co' \
  -H 'Access-Control-Request-Method: PUT' \
  https://iris.bifrost.com.co/chatbotx/public/ | head -10

# Conversaciones en modo humano (bot desactivado)
docker exec chatbotx-postgres-1 psql -U chatbotx -d chatbotx -c \
  "SELECT COUNT(*) AS human_mode FROM \"Conversation\" WHERE \"botEnabled\" = false;"
```

---

## 18. Referencias

> Esta guía cubre **despliegue y operación en VPS** (`chatbotx-docker-compose`).  
> El **código fuente** vive en este mismo repo (rama `bifrost`); no mezclar pasos de deploy con cambios de producto sin build de imagen propia.

### 18.1 Oficiales (web)

- [ChatbotX Docker Compose](https://chatbotx.io/docs/installation/docker-compose)
- [Environment Variables (S3)](https://chatbotx.io/docs/configuration/environment-variables)
- [Platform Credentials](https://chatbotx.io/docs/super-admin/platform-credentials)
- [WhatsApp Manual Setup](https://chatbotx.io/docs/channels/whatsapp-manual-setup)
- [Flow Management](https://chatbotx.io/docs/automation/flows)
- [Keywords](https://chatbotx.io/docs/automation/keywords)
- [RustFS CORS](https://docs.rustfs.com/en/administration/cors)
- [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/)

### 18.2 Código fuente (este repo — rama `bifrost`)

Fork BIFROST del monorepo upstream `ChatbotXIO/ChatbotX`.  
Índice detallado: [`DESARROLLO_Y_FORK.md`](./DESARROLLO_Y_FORK.md) · mapa general: [`AGENTS.md`](../../AGENTS.md) (raíz del repo)

| Tema (esta guía) | Archivo local de referencia |
|---|---|
| §7 límite 1 workspace | `packages/business/src/workspace/service.ts` (`COMMUNITY_MAX_WORKSPACES`) |
| §7.5 segundo usuario / Timanco | Esta guía — SQL `Workspace` + `WorkspaceMember` |
| §5.5 registro cerrado / alta manual | Caddy 403 sign-up + SQL User/Account |
| §5.6 login BIFROST (logo, español, ocultar registro) | **VPS legacy:** `/opt/chatbotx-brand/`, Caddy + parches JS. **Rama `bifrost`:** `apps/builder/public/brand/`, i18n `es`, `sign-in.tsx` — ver `DESARROLLO_Y_FORK.md` |
| §9.4 dominios Meta / transferir proveedor | OAuth callback `iris.bifrost.com.co` — validado Timanco |
| §9.4.1 post-OAuth Timanco | Webhook del canal tras Transferir proveedor |
| §10.6 cuándo crear app nueva | Mismo BM vs otro BM |
| §7 licencia / enterprise | `docs/licensing.md`, `packages/business/src/enterprise/license/startup.ts` |
| §11.1 Manual Setup WhatsApp | Esta guía — WABA + token + webhook manual |
| §11.3 OAuth / Transferir proveedor | Embedded Signup; sin pegar WABA/token — validado Timanco |
| §11.2 segundo canal WhatsApp | `integrations/whatsapp/src/api/webhook.ts` |
| §12 broker host / webhook URL | `docs/tenancy.md` |
| §13 storage `/storage` vs `/chatbotx` | `packages/business/src/platform/derive-urls.ts`, `apps/builder/next.config.ts` |
| §14 flujos Publish / draft | `docs/flows.md` |
| Automatización API (CLI/MCP) | `SKILL.md` (raíz), `.agents/skills/public-api-tooling/SKILL.md` |
| Pasos custom en flujos | `.agents/skills/flow-step-development/SKILL.md` |
| Mapa general del repo | `AGENTS.md`, `.agents/skills/chatbotx-basecode/SKILL.md` |

**No usar** el monorepo directamente en VPS sin imagen Docker — usar `chatbotx-docker-compose` apuntando a imágenes build desde rama `bifrost` (§1).

---

## Checklist rápido (imprimible)

```
[ ] VPS + Docker + DNS (iris / ws / cdn)
[ ] chatbotx-docker-compose up -d
[ ] Caddy HTTPS OK + rutas /storage/* y /chatbotx/* en iris (§4, §13)
[ ] S3_ENDPOINT (no S3_ENPOINT) → https://iris.bifrost.com.co (§13)
[ ] NEXT_PUBLIC_ASSET_URL → https://iris.bifrost.com.co/chatbotx/public/
[ ] RUSTFS_CORS_ALLOWED_ORIGINS → https://iris.bifrost.com.co
[ ] SMTP → mailhog:1025
[ ] PLATFORM_ADMIN_EMAIL configurado
[ ] Registro público cerrado en Caddy (§5.5.1)
[ ] Login personalizado BIFROST: logo + español + sin registro en UI (§5.6)
[ ] Scripts en /opt/chatbotx-brand/scripts/ + purga Cloudflare tras cambios (§5.6.6)
[ ] Usuarios dados de alta solo por admin (§5.5.2) — no sign-up público
[ ] Usuario principal operativo (Juan)
[ ] NEXT_PUBLIC_EDITION: community (NO cambiar a enterprise sin LICENSE_KEY — §7.3)
[ ] Workspace transferido al owner (§8)
[ ] (Opcional) Segundo usuario + workspace propio — Timanco §7.5
[ ] (Timanco) App Meta Timanco + dominios §9.4 + canal (Manual §11.1 o OAuth §11.3)
[ ] Platform Credentials WhatsApp (§9) — solo IRIS/BIFROST; no reemplazar por Timanco
[ ] App Meta nueva + Login para empresas + Config ID (§10)
[ ] System User token + ID
[ ] Canal WhatsApp Manual Setup (§11.1)
[ ] (Opcional) Segundo canal WhatsApp mismo workspace (§11.2)
[ ] Webhook Meta URL COMPLETA + messages/flows (§12)
[ ] Flujo publicado + Status ON + keyword/default reply (§14)
[ ] Conversación en modo Bot (§14.4)
[ ] Subida de imagen en flujo OK (§13)
[ ] Mensaje de prueba en Inbox (§15)
```

---

*Documento mantenido por el equipo BIFROST. Actualizar al cambiar dominio, app Meta o versión de ChatbotX.*
