# Fork working branch (`bifrost`)

Read this skill at the start of any session that touches this fork, a `git push`, a PR to ChatbotXIO, or “where are the runbooks?”.

**Do not** put production hostnames, operator emails, server IPs, provider tokens, or Meta/WABA/webhook IDs into tracked files. That leak already happened once (`docs/bifrost/` on the public fork). History was rewritten; GitHub Support was asked to prune dangling SHAs.

## Where things are (2026-09-10)

| What | Where |
| --- | --- |
| Public fork | `JuanBifrost/ChatbotX`, working branch **`bifrost`** |
| Mac clone | `/Users/juan/Documents/Documentos - MacBook Pro de Juan/- BIFROST/ChatbotX` |
| Operations runbooks (GUIA, Caddy template, CONTRIBUIR, Heimdall notes, test flows) | **Outside git**, iDrive Desktop: `/Users/juan/Desktop/Escritorio - MacBook Pro de Juan/bifrost-docs-privado/` |
| Deploy source on the server | `/root/chatbotx-src` on branch `bifrost` (never SSH unless the operator asks that turn) |
| Upstream | `ChatbotXIO/ChatbotX` (`upstream` remote). Do not `git push upstream`. |

Gitignore (already on `bifrost`): `/docs/bifrost/`, `/scripts/bifrost/`, `/.bifrost-local/`. Never `git add -f` those paths.

Open product PRs (clean; no runbooks):

- https://github.com/ChatbotXIO/ChatbotX/pull/1135 — native WhatsApp location request
- https://github.com/ChatbotXIO/ChatbotX/pull/1136 — Execute JavaScript JSON-path mapping

Do **not** open a PR from `bifrost` to ChatbotXIO or to fork `main`. Closed fork PR #1 was that mistake.

## Before every `git push` (public remotes)

Run from the clone. Stop if any check fails.

1. `git status` — only the files you intend. No `docs/bifrost/`, `scripts/bifrost/`, `.env`, dumps, `* 2.ts` macOS duplicates.
2. `git diff --name-only` and `git diff --cached --name-only` — same rule.
3. Search the staged diff, not the whole laptop:

```bash
git diff --cached | rg -i 'docs/bifrost|\.env|Caddyfile|password\s*=|BEGIN .*PRIVATE KEY|EAAB|EAAG|sk-ant-|sk-proj-|AKIA[0-9A-Z]{16}'
```

If `rg` prints anything other than a placeholder (`<PASSWORD>`, `secretkey` in upstream `.env.example`), do not push.

4. Confirm destination: `git push origin bifrost` is the fork working branch. Product donations use `origin feat/...` only (see below). Never push runbooks to `origin`.
5. Do not use `git add -A` or `git add .`.

macOS: zsh does not treat `#` as a comment unless `setopt interactivecomments`. Paste commands without `#` lines.

## Donating a feature to ChatbotXIO

One PR per feature. Branch from `upstream/main`, not from `bifrost`:

```bash
git fetch upstream main
git checkout -b feat/your-feature upstream/main
git cherry-pick COMMIT_ON_BIFROST
git push -u origin feat/your-feature
```

Open compare against **ChatbotXIO** `main`, not against this fork’s `main`.

Before opening the PR:

```bash
git diff --name-only upstream/main...HEAD
git diff --name-only upstream/main...HEAD | rg -i 'docs/bifrost|public/brand|\.env|Caddyfile'
```

Empty `rg` output required. After push: `git checkout bifrost`.

Announce on Discord `#feedback` (not `#development`, which is a read-only commit feed).

## Updating the server after a `bifrost` push

Operator runs (do not SSH unless asked):

```bash
cd /root/chatbotx-src
git fetch origin
git pull origin bifrost
```

If the branch was force-pushed, `git pull` will not fast-forward; they must `git reset --hard origin/bifrost`. Rebuild images only when product code changed, not for docs/gitignore.

`feat/...` branches are for GitHub PRs only. Production stays on `bifrost`.

## Syncing ChatbotXIO into `bifrost`

History on `bifrost` was rewritten to drop runbooks. A naive `git merge upstream/main` can duplicate commits. Do not merge upstream in a hurry; plan the merge (rebase unique product commits or a careful merge) and keep branding/login out of ChatbotXIO PRs.

## Related skills

- `integration-channel` — channels, webhooks, Platform Credentials
- `flow-step-development` — flow builder steps
- `builder-ui-i18n` — translations
- `chatbotx-basecode` — monorepo layout
- `security-review` — before auth, tokens, or anything that might commit secrets
