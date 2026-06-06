import { endOfHour } from "date-fns"
import { describe, expect, test, vi } from "vitest"

// Stub getSafeSinceTime so the test exercises resolveLastMessageSinceTime's
// branch logic deterministically without loading the database module graph.
// The stub subtracts one hour, mirroring the real "previous hour" behavior.
const ONE_HOUR_MS = 3_600_000
vi.mock("@chatbotx.io/database/repositories", () => ({
  getSafeSinceTime: (date: Date) => new Date(date.getTime() - ONE_HOUR_MS),
}))

import { resolveLastMessageSinceTime } from "../src/features/conversations/queries/last-message-window"

describe("resolveLastMessageSinceTime", () => {
  test("falls back to epoch (full history) when lastMessageAt is null", () => {
    expect(resolveLastMessageSinceTime(null)).toEqual(new Date(0))
  })

  test("falls back to epoch when lastMessageAt is undefined", () => {
    expect(resolveLastMessageSinceTime(undefined)).toEqual(new Date(0))
  })

  test("derives a tight window from the anchor when lastMessageAt is present", () => {
    const lastMessageAt = new Date("2026-03-10T05:30:00.000Z")

    const result = resolveLastMessageSinceTime(lastMessageAt)

    // Present anchor → NOT the epoch fallback.
    expect(result).not.toEqual(new Date(0))
    expect(result).toEqual(new Date(lastMessageAt.getTime() - ONE_HOUR_MS))
  })

  test("applies the anchor transform before flooring", () => {
    const lastMessageAt = new Date("2026-03-10T05:30:00.000Z")

    const result = resolveLastMessageSinceTime(lastMessageAt, endOfHour)

    expect(result).toEqual(
      new Date(endOfHour(lastMessageAt).getTime() - ONE_HOUR_MS),
    )
  })
})
