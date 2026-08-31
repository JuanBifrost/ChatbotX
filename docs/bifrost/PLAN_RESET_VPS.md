# Plan: reset VPS limpio + deploy desde fork `bifrost`

> **Estado:** Ago-2026 — VPS en reset; logos nuevos pendientes del usuario.  
> **Dominio:** `iris.bifrost.com.co` (sin cambios de DNS previstos).

---

## Fase 0 — Antes del reset (hecho)

- [x] Backup en Mac: `~/Backups/chatbotx-iris/chatbotx-backup-20260831_060933/`
- [x] Documentación en este repo: `docs/bifrost/`
- [x] Fork `JuanBifrost/ChatbotX`, rama `bifrost` publicada

---

## Fase 1 — Código (rama `bifrost`, local)

1. Recibir logos nuevos del usuario.
2. Copiar a `apps/builder/public/brand/`.
3. Implementar personalización login (ver [`DESARROLLO_Y_FORK.md`](./DESARROLLO_Y_FORK.md)):
   - `defaultLocale: "es"`
   - Ocultar título y enlace registro en sign-in
   - Textos `es.json` si hace falta
4. Probar local: `pnpm dev` (builder en `:3123`).
5. Commit en rama `bifrost` (cuando el usuario lo pida).

---

## Fase 2 — Imágenes Docker (pendiente)

1. Fork `chatbotxio/chatbotx-docker-compose` → cuenta `JuanBifrost`.
2. Configurar build/push de `builder` + `worker` desde rama `bifrost` (GHCR u otro registry).
3. Apuntar `docker-compose.yml` del fork deploy a imágenes propias.

> Detalle de variables y Caddy: [`GUIA_CHATBOTX_VPS_WHATSAPP.md`](./GUIA_CHATBOTX_VPS_WHATSAPP.md) §3–§4, §13.

---

## Fase 3 — VPS limpio

1. Ubuntu 24.04 + Docker (guía §3.1).
2. DNS ya apuntando: `iris`, `ws.iris`, `cdn.iris`.
3. Clonar **fork** de `chatbotx-docker-compose` (no upstream sin personalizar).
4. Generar **secretos nuevos** (`openssl rand` — guía §3.3).
5. Ajustar `docker-compose.yml` (`x-environment`) — guía §3.4 y checklist §18.
6. Caddy: HTTPS + **403 en `/auth/sign-up`** (§5.5) + `/chatbotx/*`, `/storage/*` (§4, §13).
7. **Sin** css-override ni parches JS si las imágenes ya traen login BIFROST.
8. `docker compose up -d` — validar `curl -I https://iris.bifrost.com.co`.

---

## Fase 4 — Configuración inicial (DB vacía)

1. Alta manual usuarios: `juan@bifrost.com.co`, `timanco@bifrost.com.co` (§5.5.2).
2. `PLATFORM_ADMIN_EMAIL` = Juan (§9).
3. Platform Credentials WhatsApp IRIS/BIFROST (§9).
4. App Meta + canal WhatsApp Manual Setup u OAuth (§10–§11).
5. **Webhook Meta** con URL nueva del canal (el ID **no** será `11667642312441856`).
6. Publicar flujos, activar bot (§14).
7. Prueba end-to-end (§15).

---

## Fase 5 — Timanco (cuando aplique)

- Usuario `timanco@bifrost.com.co` + workspace propio (§7.5).
- App Meta Timanco + dominios §9.4.
- Canal WhatsApp Timanco (§7.5.7, §11.3).

---

## Qué NO hacer en VPS limpio

| Evitar | Motivo |
|---|---|
| Restaurar dump Postgres del backup | Instalación limpia acordada |
| Reutilizar parches Caddy §5.6 legacy | Van en imagen Docker `bifrost` |
| `NEXT_PUBLIC_EDITION=enterprise` sin licencia | Worker no arranca (§7.3) |
| Subir `.env` con secretos a GitHub | Seguridad |

---

## Checklist rápido post-reset

```
[ ] VPS + Docker + Caddy
[ ] Fork docker-compose + imágenes bifrost
[ ] Secretos nuevos en .env
[ ] iris / ws / cdn DNS OK
[ ] Registro 403 en Caddy
[ ] Login ES + logo BIFROST (desde imagen)
[ ] Usuario Juan + Super Admin
[ ] Platform Credentials
[ ] WhatsApp Bifrost + webhook Meta actualizado
[ ] Flujo publicado + prueba inbox
[ ] (Opcional) Timanco §7.5
```

---

Ver checklist ampliado al final de [`GUIA_CHATBOTX_VPS_WHATSAPP.md`](./GUIA_CHATBOTX_VPS_WHATSAPP.md).
