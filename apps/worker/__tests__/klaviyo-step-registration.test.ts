import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

describe("Klaviyo worker step registration", () => {
  test("dispatches Klaviyo sync profile steps", () => {
    const source = readFileSync("src/integration/handlers/step.ts", "utf8")
    expect(source).toContain(
      'import { syncKlaviyoProfile } from "./klaviyo-handler"',
    )
    expect(source).toContain(
      "[stepTypes.enum.klaviyoSyncProfile]: syncKlaviyoProfile",
    )
  })
})
