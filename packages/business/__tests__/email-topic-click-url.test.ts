import { describe, expect, test } from "vitest"
import {
  signEmailClickUrl,
  verifyEmailClickToken,
} from "../src/email-topic/click-url"

const URL_RE = /^[A-Za-z0-9\-_]+$/ // base64url alphabet, no padding

describe("email-topic click url signing", () => {
  test("round-trips the destination url", async () => {
    const url = "https://customer.example.com/landing?utm=abc&x=1"
    const token = await signEmailClickUrl(url)
    expect(await verifyEmailClickToken(token)).toBe(url)
  })

  test("produces a URL-safe (base64url) token", async () => {
    const token = await signEmailClickUrl("https://example.com")
    expect(token).toMatch(URL_RE)
  })

  test("rejects a tampered token", async () => {
    const token = await signEmailClickUrl("https://example.com")
    // Flip a character in the middle of the token to corrupt the ciphertext.
    const mid = Math.floor(token.length / 2)
    const tampered = `${token.slice(0, mid)}${token[mid] === "A" ? "B" : "A"}${token.slice(mid + 1)}`
    await expect(verifyEmailClickToken(tampered)).rejects.toThrow()
  })

  test("rejects a non-token string", async () => {
    await expect(verifyEmailClickToken("https://evil.com")).rejects.toThrow()
  })
})
