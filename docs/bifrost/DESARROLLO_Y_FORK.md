# Desarrollo y fork BIFROST — ChatbotX (monorepo)

> **Alcance:** referencia de **código fuente** en este repositorio.  
> **Operación VPS** (`iris`): ver [`GUIA_CHATBOTX_VPS_WHATSAPP.md`](./GUIA_CHATBOTX_VPS_WHATSAPP.md).  
> **Plan de reset:** ver [`PLAN_RESET_VPS.md`](./PLAN_RESET_VPS.md).

---

## Fork BIFROST

| Item | Valor |
|---|---|
| Upstream | `https://github.com/ChatbotXIO/ChatbotX` |
| Fork | `https://github.com/JuanBifrost/ChatbotX` |
| Rama de trabajo | **`bifrost`** |
| Clone local | `…/- BIFROST/ChatbotX` |

**Flujo:** cambios BIFROST en `bifrost` → build imágenes Docker propias → deploy con `chatbotx-docker-compose` (fork propio apuntando a esas imágenes).

---

## Cuándo usar qué

| Necesidad | Dónde mirar |
|---|---|
| Levantar ChatbotX en producción | [`GUIA_CHATBOTX_VPS_WHATSAPP.md`](./GUIA_CHATBOTX_VPS_WHATSAPP.md) + repo `chatbotx-docker-compose` |
| Entender cómo funciona el código | Este monorepo + `AGENTS.md` + skills abajo |
| Modificar login, logos, i18n | Este monorepo, rama `bifrost` |
| WhatsApp / Meta / webhooks | Guía VPS §9–§12 + `integration-channel` skill |

---

## Personalización login (rama `bifrost`)

Objetivo: español, logo Bifröst, sin título "Sign in to ChatbotX", sin enlace "Registrarse".  
Registro público sigue bloqueado en **Caddy** (403) — ver guía §5.5.

| Cambio | Archivo(s) previsto(s) |
|---|---|
| Logos | `apps/builder/public/brand/logo_white.svg`, `logo_black.svg`, favicon |
| Locale por defecto `es` | `apps/builder/src/i18n/config.ts` |
| Ocultar título / signup en UI | `apps/builder/src/features/auth/` (sign-in, shared) |
| Textos auth en español | `apps/builder/src/i18n/locales/es.json` |

> **Pendiente:** el usuario entregará logos nuevos tras reset VPS. No commitear secretos ni `.env` de producción.

**VPS anterior (legacy):** parches Caddy + JS en contenedor — documentados en guía §5.6 solo como referencia histórica. **No replicar** en instalación limpia con imágenes propias.

---

## Docs upstream (`docs/`)

| Archivo | Contenido |
|---|---|
| `docs/licensing.md` | Ediciones, `LICENSE_KEY`, límites Enterprise |
| `docs/flows.md` | Ciclo draft → Publish → versiones publicadas |
| `docs/tenancy.md` | Tenancy, dominios custom, broker host para webhooks OAuth |
| `docs/tech-stack.md` | Stack (Drizzle, BullMQ, RustFS, etc.) |
| `docs/request-workflow.md` | Flujo de requests en builder |
| `docs/websocket.md` | Realtime / PartySocket |
| `docs/push-notifications.md` | FCM / Expo push |

---

## Skills de agente (`.agents/skills/`)

### Operación BIFROST / integración

| Skill | Uso |
|---|---|
| `bifrost-deployment/SKILL.md` | Punto de entrada: docs `docs/bifrost/` |
| `integration-channel/SKILL.md` | WhatsApp, webhooks, Platform Credentials, canales |
| `flow-step-development/SKILL.md` | Nodos y pasos de flujos con ramas success/error |
| `public-api-tooling/SKILL.md` | API pública, CLI, MCP |
| `chatbotx-basecode/SKILL.md` | Mapa del monorepo |

### Desarrollo del producto

| Skill | Uso |
|---|---|
| `drizzle-database/SKILL.md` | Schema y migraciones PostgreSQL |
| `orpc-api/SKILL.md` | Endpoints oRPC / OpenAPI en builder |
| `worker-development/SKILL.md` | Jobs BullMQ en `apps/worker` |
| `feature-scaffold/SKILL.md` | Crear features nuevas en builder |
| `builder-ui-i18n/SKILL.md` | Traducciones UI |
| `turborepo-workflow/SKILL.md` | pnpm workspaces, turbo |
| `testing-workflow/SKILL.md` | Lint, tests locales |

---

## Otros puntos de entrada

| Archivo | Contenido |
|---|---|
| `AGENTS.md` | Contexto para asistentes AI; invariantes del repo |
| `SKILL.md` (raíz) | CLI `chatbotx` y MCP |
| `.env.example` | Variables de entorno (desarrollo local) |
| `docker-compose.yml` | Infra local (Postgres, Redis, RustFS, MailHog) |

---

## Límites de workspace (Community vs Enterprise)

| Edición | Límite workspaces | Dónde se aplica |
|---|---|---|
| **community** (VPS BIFROST) | **1** por `ownerId` | `packages/business/src/workspace/service.ts` → `COMMUNITY_MAX_WORKSPACES` |
| **enterprise** + `LICENSE_KEY` | Según token | `docs/licensing.md` |

**No funciona:** `NEXT_PUBLIC_EDITION=enterprise` sin `LICENSE_KEY` — el worker hace `process.exit(1)`. Ver guía §7.3.

| Escenario | Enfoque | Doc |
|---|---|---|
| Varios WhatsApp, mismo operador | Un workspace + varios canales | Guía §11.2 |
| Otro operador / marca (Timanco) | Segundo usuario + workspace propio | Guía §7.5 |
| Otro portafolio Meta | App Meta nueva + OAuth o Manual Setup | Guía §7.5.7, §11.3 |

---

## Rutas de código frecuentes

| Tema | Ruta |
|---|---|
| Límite Community | `packages/business/src/workspace/service.ts` |
| Startup licencia (worker) | `packages/business/src/enterprise/license/startup.ts` |
| UI workspaces | `apps/builder/src/features/workspaces/components/workspaces-list.tsx` |
| Presigned upload | `apps/builder/src/app/api/presigned-upload/route.ts` |
| Storage URLs | `packages/business/src/platform/derive-urls.ts` |
| Webhook WhatsApp | `integrations/whatsapp/src/handlers/webhook.ts` |
| URL webhook en UI | `apps/builder/src/features/integration-whatsapp/actions/webhook-url.ts` |

---

## Datos de referencia (instalación anterior — no restaurar)

| Item | Valor |
|---|---|
| Usuarios | `juan@bifrost.com.co`, `timanco@bifrost.com.co`, `demo@example.com` |
| Canal WhatsApp | **Bifrost** — webhook ID antiguo `11667642312441856` (cambiará tras reset) |
| Backup Mac | `~/Backups/chatbotx-iris/chatbotx-backup-20260831_060933/` |

---

*Documentación BIFROST dentro del fork ChatbotX. La copia en `bifrost35` (commit `a70b270`) queda como histórico; la fuente viva es `docs/bifrost/` en este repo.*
