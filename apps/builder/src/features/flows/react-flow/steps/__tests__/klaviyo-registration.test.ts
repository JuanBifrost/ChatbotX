import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

describe("Klaviyo flow step registration", () => {
  test("registers the Klaviyo sync profile action", () => {
    const source = readFileSync(
      "src/features/flows/react-flow/steps/index.tsx",
      "utf8",
    )
    expect(source).toContain(
      'import { klaviyoSyncProfileStep } from "./klaviyo-sync-profile"',
    )
    expect(source).toContain(
      "[stepTypes.enum.klaviyoSyncProfile]: klaviyoSyncProfileStep",
    )
  })
})
