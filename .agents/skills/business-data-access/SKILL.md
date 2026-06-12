---
name: business-data-access
description: >-
  Implement or modify ChatbotX business services, repositories, cache
  invalidation, event emission, and data-access boundaries. Use when app,
  worker, or integration code needs database-backed reads or mutations without
  importing db directly.
---

# Business Data Access

Use this skill whenever code outside `packages/business` or
`packages/database/src/repositories` needs database-backed behavior.

## Boundary Rule

Do not add direct database imports in:

- `apps/builder`
- `apps/worker`
- `integrations`

These layers call services from `@chatbotx.io/business` or repositories from
`@chatbotx.io/database/repositories`. Legacy direct `db` imports are exceptions,
not examples to copy.

Allowed direct `db` usage:

- `packages/business/src/**`
- `packages/database/src/repositories/**`

## Choosing Service vs Repository

Use a business service when the method has business semantics, authorization
adjacent constraints, cache invalidation, event emission, composition across
tables, or is reused by app and worker code.

Use a repository when the method is a low-level persistence concern such as
shard routing, specialized pagination, or reusable raw query mechanics.

## Service Pattern

Services live in `packages/business/src/<domain>/`.

```
<domain>/
  service.ts
  index.ts
```

Typical shape:

```typescript
import { type DatabaseClient, db } from "@chatbotx.io/database/client"
import { BaseService } from "../base.service"

class ExampleService extends BaseService {
  async doThing(props: {
    workspaceId: string
    tx?: DatabaseClient
  }) {
    const { workspaceId, tx = db } = props
    // query/mutate with tx
    await this.invalidateCacheTags([`examples:${workspaceId}`])
  }
}

export const exampleService = new ExampleService()
```

Also export from:

- `packages/business/src/<domain>/index.ts`
- `packages/business/src/index.ts`

## Transaction Pattern

- Accept `tx?: DatabaseClient` in service methods that may compose with other operations.
- Default to `db` inside the service: `const { tx = db } = props`.
- Pass `tx` through nested service/repository calls.

## Cache and Events

- Extend `BaseService` to use `invalidateCacheTags()`.
- Use `withCache` from `@chatbotx.io/redis` only around stable reads with clear keys.
- Emit domain events from services when mutations affect downstream workflows.
- Fire-and-forget events should handle `.catch(() => {})` if the local pattern does.

## Repository Pattern

Repositories live in `packages/database/src/repositories/<domain>/`.

```
repositories/<domain>/
  repository.ts
  index.ts
```

Export new repositories from `packages/database/src/repositories/index.ts`.
Use the `drizzle-database` skill for schema, relation, and migration work.

## App Layer Usage

Builder feature queries/actions should call services:

```typescript
import { tagService } from "@chatbotx.io/business"

export const listTags = async (params: { workspaceId: string }) => {
  return tagService.list({ workspaceId: params.workspaceId })
}
```

Workers and integrations follow the same boundary.

## Verification

Before finishing:

- Search changed app/worker/integration files for new direct `db` imports.
- Add or update focused service/repository tests when behavior is non-trivial.
- Run the smallest relevant test/typecheck script from the touched workspace.
