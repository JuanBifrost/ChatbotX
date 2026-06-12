---
name: security-review
description: Use before committing changes to auth, workspace scoping, channel webhooks, AI tools/MCP, permission settings, or anything handling untrusted channel content in ChatbotX. A repo-specific security checklist covering tenant isolation, prompt injection via channel content, the Bash permission allowlist, and secret handling. Read before security-sensitive work; pair with the global security-reviewer agent for deep dives.
---

# Security Review (ChatbotX)

A focused, repo-specific checklist. For OWASP-depth analysis dispatch the global `security-reviewer` agent; this skill is the ChatbotX-specific surface map and the things that bite here.

## 1. Tenant isolation (the #1 risk in a multi-workspace product)

- Every query that returns workspace data MUST be scoped by `workspaceId`, OR by an id that is provably workspace-bound by construction (trace it).
- Builder APIs go through `workspaceAuthorizedMidddleware` / `workspaceTokenAuthMidddleware` (triple-d — preserved typo). Confirm new oRPC routes use the authorized stack, not an unauthenticated handler.
- RAG/embedding queries: see the `rag-eval` agent. A `sourceId`-only filter with no `workspaceId` predicate is a defense-in-depth gap.
- Repositories/services are the boundary — app/integration code must not reach `db` directly (`.agents/rules/data-access.md`).

## 2. Prompt injection (untrusted channel content → agent context)

- Customer messages (WhatsApp/Messenger/webchat), uploaded documents, and fetched URLs are **untrusted**. When their content reaches an AI prompt or RAG context, it must be framed as data, not instructions (clear delimiters, "the following is user-provided content").
- Flag raw `content: row.content` passthrough from a context-source adapter into a model prompt (`apps/worker/.../context-sources/`, `packages/ai/`).

## 3. Tool / permission allowlist (`.claude/settings.local.json`)

- This file is git-ignored and local — but it is live in every agent session.
- **Never** put credential literals (`PGPASSWORD`, `DATABASE_URL` with a real password) inside `Bash(...)` allow-patterns. Use env indirection.
- **Never** grant wildcard exec: `Bash(pnpm *)`, `Bash(node *)`, `Bash(python3 *)`, `Bash(git *)`. Grant the specific commands you need (`Bash(pnpm lint)`, `Bash(pnpm --filter <x> test)`).
- **Never** auto-approve `cp` of any `.env`, or reads of `~`/`/etc`. Scope filesystem grants to the repo.
- Paths must be relative/repo-local, not machine-absolute, and must match this repo (`ChatbotX01`).

## 4. Secret handling

- No secrets in tracked files. `.env*` is never committed (`.agents/rules/git.md`, `/commit` guardrails).
- If a real credential is found in any file (even gitignored), **rotate it out-of-band** and remove it — being un-committed is not the same as being safe when it's live in agent context.
- MCP server: restrict CORS origins; accept tokens via `Authorization` header, never URL query params (they get logged).

## Stop condition

Produce a findings list (`file:line | risk | severity | fix`) ranked by severity. If a CRITICAL (secret-in-grant, wildcard exec, cross-tenant access, auth bypass) is found, state it first and recommend blocking the commit until fixed. If nothing security-relevant changed, say `SECURITY: not applicable to this diff` and stop — do not invent risks.
