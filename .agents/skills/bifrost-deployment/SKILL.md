# Fork working branch (`bifrost`)

Use this skill when working on the fork’s working branch `bifrost`.

## Rules

1. **Never open a PR from `bifrost` to ChatbotXIO** (or to this fork’s `main`). Product donations: branch `feat/...` from `upstream/main`, then cherry-pick the product commit.
2. **Never commit** `.env`, secrets, dumps, hostnames, emails, IPs, or provider IDs.
3. Operations runbooks for this deploy stay **off this public remote** (local disk or a private repo). Do not add a `docs/bifrost/` tree here.

## Related skills

- `integration-channel` — channels, webhooks, Platform Credentials
- `flow-step-development` — flow builder steps
- `builder-ui-i18n` — translations
- `chatbotx-basecode` — monorepo layout
