# BIFROST deployment — ChatbotX IRIS

Use this skill when working on **BIFROST production** (`iris.bifrost.com.co`) or the **`bifrost` fork branch**.

## Canonical docs (read first)

| File | Purpose |
|---|---|
| `docs/bifrost/README.md` | Index |
| `docs/bifrost/GUIA_CHATBOTX_VPS_WHATSAPP.md` | Full VPS + WhatsApp + Meta guide |
| `docs/bifrost/Caddyfile.iris.example` | Production Caddy template (`/ws/*` → realtime required for live Inbox) |
| `docs/bifrost/DESARROLLO_Y_FORK.md` | Monorepo map, login customization, code paths |
| `docs/bifrost/PLAN_RESET_VPS.md` | Reset VPS workflow checklist |

## Repos

- **This repo:** `JuanBifrost/ChatbotX`, branch `bifrost` — source + BIFROST UI changes
- **Deploy:** `chatbotx-docker-compose` (fork pending) — Docker Compose on VPS
- **Upstream:** `ChatbotXIO/ChatbotX` — merge/sync only, do not deploy upstream images for BIFROST branding

## Rules

1. **VPS clean install:** do not restore old Postgres dump unless user explicitly asks.
2. **Login branding:** implement in source (`apps/builder/`, `apps/builder/public/brand/`), not Caddy CSS hacks, when using custom Docker images.
3. **Sign-up:** keep blocked at Caddy (403) in production; manual user creation only.
4. **Community edition:** max 1 workspace per `ownerId`; second operator = second user (Timanco pattern).
5. **WhatsApp webhook URL** includes channel ID — changes after channel recreation.
6. **Realtime Inbox:** Caddy must proxy `handle_path /ws/*` → `localhost:1999` on `iris` domain (§4.1). Browser does not use `ws.iris` subdomain.
7. **Never commit** production `.env`, secrets, or backup dumps.

## Related skills

- `integration-channel` — channels, webhooks, Platform Credentials
- `flow-step-development` — flow builder steps
- `builder-ui-i18n` — translations
- `chatbotx-basecode` — monorepo layout

## Backup reference (read-only)

`~/Backups/chatbotx-iris/chatbotx-backup-20260831_060933/` on the user's Mac.
