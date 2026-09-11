import { describe, expect, test } from "vitest"
import { pickPreferredTestInbox } from "../load-test-contact-variables"

const inbox = (
  overrides: Partial<{
    id: string
    channel: string
    lastIncomingMessageAt: Date | null
  }>,
) =>
  ({
    id: "1",
    channel: "webchat",
    lastIncomingMessageAt: null,
    ...overrides,
  }) as Parameters<typeof pickPreferredTestInbox>[0][number]

describe("pickPreferredTestInbox", () => {
  test("returns null when there are no inboxes", () => {
    expect(pickPreferredTestInbox([])).toBeNull()
  })

  test("prefers a WhatsApp inbox over a more recently messaged webchat inbox", () => {
    const picked = pickPreferredTestInbox([
      inbox({
        id: "web",
        channel: "webchat",
        lastIncomingMessageAt: new Date("2026-09-11T12:00:00Z"),
      }),
      inbox({
        id: "wa",
        channel: "whatsapp",
        lastIncomingMessageAt: new Date("2026-01-01T00:00:00Z"),
      }),
    ])
    expect(picked?.id).toBe("wa")
  })

  test("falls back to the most recently messaged inbox when none is WhatsApp", () => {
    const picked = pickPreferredTestInbox([
      inbox({
        id: "old",
        channel: "messenger",
        lastIncomingMessageAt: new Date("2026-01-01T00:00:00Z"),
      }),
      inbox({
        id: "new",
        channel: "telegram",
        lastIncomingMessageAt: new Date("2026-09-11T12:00:00Z"),
      }),
    ])
    expect(picked?.id).toBe("new")
  })
})
