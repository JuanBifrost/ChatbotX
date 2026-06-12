---
name: builder-ui-i18n
description: >-
  Build or modify ChatbotX builder UI components, forms, tables, dialogs,
  shared UI usage, and translations. Use for user-facing React/Next.js UI in
  apps/builder, especially when labels, placeholders, menus, or validation
  messages are added or changed.
---

# Builder UI and i18n

Use for `apps/builder` UI work. Pair with `feature-scaffold` for new feature
modules and pages.

## UI Stack

- React 19 + Next.js app router.
- Shared components come from `@chatbotx.io/ui/*`.
- Builder also has local components under `apps/builder/src/components`.
- Forms use React Hook Form, Zod, and next-safe-action adapter.
- URL state commonly uses `nuqs`.
- Icons should use the project icon library when available.

## i18n Rule

All user-facing strings must use translations. Do not hardcode labels,
placeholders, button text, empty states, tab names, toasts, or dialog copy in
builder UI.

Primary files:

- `apps/builder/messages/en.json`
- `apps/builder/messages/vi.json`

Before adding keys, check existing `fields.*`, common actions, table labels, and
feature namespaces. Add both English and Vietnamese values for new keys.

Typical component pattern:

```typescript
"use client"

import { useTranslations } from "next-intl"

export const ExampleButton = () => {
  const t = useTranslations("features.examples")
  return <Button>{t("create")}</Button>
}
```

## Form Pattern

- Server actions with `bindArgsSchemas` must be bound before passing to hooks:
  `createThingAction.bind(null, workspaceId)`.
- No-input delete actions call `execute()` with no arguments, not `execute({})`.
- Validation schemas live near the feature, usually `schema/action.ts`.
- Prefer shared form components from `@chatbotx.io/ui`.

## Layout and Components

- Mirror sibling features for tables, dialogs, toolbar actions, and columns.
- Keep server components responsible for data promises and client components
  responsible for interaction.
- Pages receive Promise `params` / `searchParams`.
- Client components unwrap server promises with `use(promises)` where this repo
  already follows that pattern.
- Public routes need `apps/builder/src/proxy.ts` public route registration.

## Styling Guidance

- Keep operational UI dense, scan-friendly, and consistent with existing builder
  screens.
- Do not create landing-page style layouts for product workflows.
- Avoid nested cards and oversized hero typography inside tools.
- Ensure button and table text fits at mobile and desktop sizes.

## Verification

Run targeted checks for touched UI:

```bash
pnpm --filter builder check-types
pnpm --filter builder test
pnpm lint
```

If visual layout risk is high, start the builder dev server and inspect the page.
