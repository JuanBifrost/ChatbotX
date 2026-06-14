import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

const apiSource = readFileSync(
  "src/features/integration-moosend/api/index.ts",
  "utf8",
)
const querySource = readFileSync(
  "src/features/integration-moosend/queries.ts",
  "utf8",
)

describe("Moosend API registration", () => {
  test("keeps mailing lists workspace-authorized and page bounded", () => {
    expect(apiSource).toContain(
      'path: "/workspaces/{workspaceId}/moosend/mailing-lists"',
    )
    expect(apiSource).toContain("workspaceAuthorizedMidddleware")
    expect(apiSource).toContain(".max(MOOSEND_EDITOR_PAGE_SIZE)")
    expect(apiSource).toContain(".output(moosendMailingListPageSchema)")
  })

  test("decrypts auth server-side and handles a missing integration", () => {
    expect(querySource).toContain("encryptedDataSchema.parse(row.auth)")
    expect(querySource).toContain("moosendAuthSchema")
    expect(querySource).toContain("return null")
    expect(apiSource).toContain('new ORPCError("FAILED_PRECONDITION"')
  })

  test("maps typed provider errors without exposing provider messages", () => {
    expect(apiSource).toContain('new ORPCError("TOO_MANY_REQUESTS"')
    expect(apiSource).toContain('error.kind === "user_not_enabled"')
    expect(apiSource).toContain("Moosend integration is unavailable")
    expect(apiSource).toContain("Moosend request failed")
    expect(apiSource).not.toContain("error.message")
  })
})
