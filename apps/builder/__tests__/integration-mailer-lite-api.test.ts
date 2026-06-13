import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

const apiSource = readFileSync(
  "src/features/integration-mailer-lite/api/index.ts",
  "utf8",
)

describe("MailerLite API registration", () => {
  test("keeps both resources workspace-authorized and page bounded", () => {
    expect(apiSource).toContain(
      'path: "/workspaces/{workspaceId}/mailer-lite/groups"',
    )
    expect(apiSource).toContain(
      'path: "/workspaces/{workspaceId}/mailer-lite/fields"',
    )
    expect(apiSource.match(/workspaceAuthorizedMidddleware/gu)?.length).toBe(3)
    expect(apiSource).toContain(".max(MAILER_LITE_EDITOR_PAGE_SIZE)")
  })

  test("maps provider rate limits without exposing the provider body", () => {
    expect(apiSource).toContain('new ORPCError("TOO_MANY_REQUESTS"')
    expect(apiSource).toContain("MailerLite rate limit exceeded")
  })
})
