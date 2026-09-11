import { describe, expect, test } from "vitest"
import { sanitizeJavascriptInputSnapshot } from "../sanitize-javascript-input-snapshot"

describe("sanitizeJavascriptInputSnapshot", () => {
  test("redacts keys that look like secrets", () => {
    const snapshot = sanitizeJavascriptInputSnapshot({
      flow_origen_id: "1387087",
      api_key: "secret-value",
      nested: { access_token: "abc" },
    })

    expect(snapshot).toEqual({
      flow_origen_id: "1387087",
      api_key: "[redacted]",
      nested: { access_token: "[redacted]" },
    })
  })
})
