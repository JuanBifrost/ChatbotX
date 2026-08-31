# Documentación BIFROST — ChatbotX IRIS

> **Origen:** consolidado desde `bifrost35` commit `a70b270` (Ago-2026).  
> **Repo de trabajo:** este fork — [`JuanBifrost/ChatbotX`](https://github.com/JuanBifrost/ChatbotX), rama **`bifrost`**.  
> **Producción:** `https://iris.bifrost.com.co`

---

## Índice de documentos

| Documento | Para qué |
|---|---|
| [**GUIA_CHATBOTX_VPS_WHATSAPP.md**](./GUIA_CHATBOTX_VPS_WHATSAPP.md) | Guía completa: VPS, Caddy, DNS, usuarios, Meta, WhatsApp, RustFS, flujos, troubleshooting |
| [**DESARROLLO_Y_FORK.md**](./DESARROLLO_Y_FORK.md) | Mapa del monorepo, skills, rutas de código, personalización login en rama `bifrost` |
| [**PLAN_RESET_VPS.md**](./PLAN_RESET_VPS.md) | Orden de trabajo: reset VPS limpio + deploy desde fork |

---

## Repos relacionados

| Repo | Uso |
|---|---|
| **Este repo** (`JuanBifrost/ChatbotX`, rama `bifrost`) | Código fuente + personalización BIFROST |
| `chatbotxio/chatbotx-docker-compose` | Plantilla deploy (fork propio pendiente) |
| `ChatbotXIO/ChatbotX` | Upstream — sync periódico a rama `bifrost` |

---

## Rutas clave en este monorepo

| Tema | Ruta |
|---|---|
| Logos / branding | `apps/builder/public/brand/` |
| Login / auth UI | `apps/builder/src/features/auth/` |
| Locale español | `apps/builder/src/i18n/` |
| WhatsApp webhook | `integrations/whatsapp/src/handlers/webhook.ts` |
| Límite Community 1 workspace | `packages/business/src/workspace/service.ts` |

---

## Backup de referencia (Mac)

Instalación anterior IRIS (solo lectura, no restaurar en VPS limpio):

```
~/Backups/chatbotx-iris/chatbotx-backup-20260831_060933/
```

Contiene: `.env`, `Caddyfile`, `docker-compose.yml`, dump Postgres, logos viejos, exports de usuarios/canales.

---

## Skill de agente

Asistentes AI: [`.agents/skills/bifrost-deployment/SKILL.md`](../../.agents/skills/bifrost-deployment/SKILL.md)

---

*Mantenido por el equipo BIFROST. Actualizar al cambiar dominio, app Meta o flujo de deploy.*
