import { describe, expect, test } from "vitest"
import { stringifySandboxValue } from "../stringify-sandbox-value"

describe("stringifySandboxValue", () => {
  test("renders objects as pretty JSON", () => {
    expect(stringifySandboxValue({ latitude: 1.8, address_text: "Oficinas" }))
      .toBe(`{
  "latitude": 1.8,
  "address_text": "Oficinas"
}`)
  })

  test("turns undefined into JSON null so the tree can parse it", () => {
    expect(stringifySandboxValue(undefined)).toBe("null")
  })
})
