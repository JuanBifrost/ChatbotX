import { describe, expect, it } from "vitest"
import { normalizeWhatsappDisplayPhoneNumber } from "../src/api/phone-number"

describe("normalizeWhatsappDisplayPhoneNumber", () => {
  it("canonicalizes a VN E.164 display number to digits-only", () => {
    expect(normalizeWhatsappDisplayPhoneNumber("+84 28 3822 9999")).toBe(
      "842838229999",
    )
  })

  it("canonicalizes a non-VN (US) E.164 number — not VN-specific", () => {
    expect(normalizeWhatsappDisplayPhoneNumber("+1 213-373-4253")).toBe(
      "12133734253",
    )
  })

  it("canonicalizes a UK E.164 number", () => {
    expect(normalizeWhatsappDisplayPhoneNumber("+44 7911 123456")).toBe(
      "447911123456",
    )
  })

  it("no longer force-prefixes a leading-0 local number with VN code 84", () => {
    // Old behaviour returned "84901234567"; the VN hardcode is gone, so an
    // unparseable local number falls back to a plain digit strip.
    expect(normalizeWhatsappDisplayPhoneNumber("0901234567")).toBe("0901234567")
  })
})
