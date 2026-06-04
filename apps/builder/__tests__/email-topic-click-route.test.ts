// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest"

const recordClick = vi.fn().mockResolvedValue(undefined)
const verifyEmailClickToken = vi.fn()

vi.mock("@chatbotx.io/analytics", () => ({
  emailTopicAnalyticsService: { recordClick },
}))

vi.mock("@chatbotx.io/business", () => ({
  verifyEmailClickToken,
}))

afterEach(() => {
  vi.clearAllMocks()
})

const { GET } = await import("../src/app/email-topic/click/route")

test("redirects to the verified destination with 302", async () => {
  verifyEmailClickToken.mockResolvedValueOnce("https://example.com/path")
  const req = new Request("http://localhost/email-topic/click?r=tok&u=signed")
  const res = await GET(req)
  expect(res.status).toBe(302)
  expect(res.headers.get("location")).toBe("https://example.com/path")
  expect(verifyEmailClickToken).toHaveBeenCalledWith("signed")
})

test("redirects to same-origin when the token is tampered or expired", async () => {
  verifyEmailClickToken.mockRejectedValueOnce(new Error("invalid token"))
  const req = new Request(
    "http://localhost/email-topic/click?r=tok&u=https%3A%2F%2Fevil.com",
  )
  const res = await GET(req)
  expect(res.status).toBe(302)
  // Open-redirect guard: never forwards to an attacker-supplied target.
  expect(res.headers.get("location")).toBe("http://localhost/")
})

test("redirects to same-origin when the u param is missing", async () => {
  const req = new Request("http://localhost/email-topic/click?r=tok")
  const res = await GET(req)
  expect(res.status).toBe(302)
  expect(res.headers.get("location")).toBe("http://localhost/")
  expect(verifyEmailClickToken).not.toHaveBeenCalled()
})

test("calls recordClick with the token from ?r param", async () => {
  verifyEmailClickToken.mockResolvedValueOnce("https://example.com")
  const req = new Request(
    "http://localhost/email-topic/click?r=tok-123&u=signed",
  )
  await GET(req)
  expect(recordClick).toHaveBeenCalledOnce()
  expect(recordClick).toHaveBeenCalledWith("tok-123")
})

test("does not call recordClick when r param is missing", async () => {
  verifyEmailClickToken.mockResolvedValueOnce("https://example.com")
  const req = new Request("http://localhost/email-topic/click?u=signed")
  await GET(req)
  expect(recordClick).not.toHaveBeenCalled()
})
