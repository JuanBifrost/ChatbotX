import { describe, expect, test } from "vitest"

// Pure function — no mocks required

// January 1 2024 is a Monday (getDay() === 1).
// All Date constructors below use local-time form (year, month, day, h, m, s, ms)
// so that date-fns getHours / getMinutes / getDay operate on predictable local values.

describe("calculateNextValidSendTime", () => {
  test("returns baseTime unchanged when anytime is true", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    const baseTime = new Date(2024, 0, 1, 10, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: true,
      sendDays: '["monday"]',
      sendTimeStart: "09:00",
      sendTimeEnd: "17:00",
    })

    expect(result).toBe(baseTime)
  })

  test("rolls to startOfDay next allowed day when current day is not in sendDays", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Monday Jan 1 2024 at 10:00
    const baseTime = new Date(2024, 0, 1, 10, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: '["tuesday"]',
      sendTimeStart: null,
      sendTimeEnd: null,
    })

    // Should land on Tuesday Jan 2 at 00:00
    const expected = new Date(2024, 0, 2, 0, 0, 0, 0)
    expect(result).toEqual(expected)
  })

  test("snaps to window start time when current time is before the send window", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Monday Jan 1 at 07:00 — before 09:00 window
    const baseTime = new Date(2024, 0, 1, 7, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: '["monday"]',
      sendTimeStart: "09:00",
      sendTimeEnd: "17:00",
    })

    // Same day, snapped to 09:00:00.000
    const expected = new Date(2024, 0, 1, 9, 0, 0, 0)
    expect(result).toEqual(expected)
  })

  test("snaps to window start on next allowed day when time equals window end", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Monday at exactly 17:00 — boundary triggers >= endTimeInMin → rolls to next day.
    // Next day (Tuesday) midnight is BEFORE window start (09:00) → snaps to 09:00.
    const baseTime = new Date(2024, 0, 1, 17, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: '["monday","tuesday"]',
      sendTimeStart: "09:00",
      sendTimeEnd: "17:00",
    })

    // Lands on Tuesday Jan 2 at window start 09:00
    const expected = new Date(2024, 0, 2, 9, 0, 0, 0)
    expect(result).toEqual(expected)
  })

  test("snaps to window start on next allowed day when time is after window end", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Monday at 20:00 — past window → rolls to Tuesday midnight → snaps to 09:00.
    const baseTime = new Date(2024, 0, 1, 20, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: '["monday","tuesday"]',
      sendTimeStart: "09:00",
      sendTimeEnd: "17:00",
    })

    const expected = new Date(2024, 0, 2, 9, 0, 0, 0)
    expect(result).toEqual(expected)
  })

  test("returns unchanged time when time is inside the send window", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Monday at 12:00 — inside 09:00-17:00
    const baseTime = new Date(2024, 0, 1, 12, 30, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: '["monday"]',
      sendTimeStart: "09:00",
      sendTimeEnd: "17:00",
    })

    expect(result).toEqual(baseTime)
  })

  test("returns unchanged time when no time window is set and day is allowed", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    const baseTime = new Date(2024, 0, 1, 5, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: '["monday"]',
      sendTimeStart: null,
      sendTimeEnd: null,
    })

    expect(result).toEqual(baseTime)
  })

  test("falls back to ALL_DAYS when sendDays is invalid JSON", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Monday — present in ALL_DAYS fallback, no time window
    const baseTime = new Date(2024, 0, 1, 10, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: "not-valid-json",
      sendTimeStart: null,
      sendTimeEnd: null,
    })

    expect(result).toEqual(baseTime)
  })

  test("allows all days when sendDays is null", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Saturday — should be allowed since null → ALL_DAYS
    const baseTime = new Date(2024, 0, 6, 14, 0, 0, 0) // Saturday Jan 6 2024
    // getDay() for Jan 6 2024 = Saturday = 6 → DAY_NAMES[6] = "saturday"

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: null,
      sendTimeStart: null,
      sendTimeEnd: null,
    })

    expect(result).toEqual(baseTime)
  })

  test("returns original baseTime after MAX_ATTEMPTS when sendDays is empty array", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Empty sendDays → no day is ever allowed → 14 attempts → returns baseTime
    const baseTime = new Date(2024, 0, 1, 10, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: "[]",
      sendTimeStart: null,
      sendTimeEnd: null,
    })

    // MAX_ATTEMPTS exhausted → returns original baseTime reference
    expect(result).toBe(baseTime)
  })

  test("skips multiple non-allowed days before landing on an allowed one", async () => {
    const { calculateNextValidSendTime } = await import(
      "../src/send-time-validator"
    )
    // Monday Jan 1 — only friday is allowed
    const baseTime = new Date(2024, 0, 1, 10, 0, 0, 0)

    const result = calculateNextValidSendTime(baseTime, {
      anytime: false,
      sendDays: '["friday"]',
      sendTimeStart: null,
      sendTimeEnd: null,
    })

    // Friday Jan 5 2024 at 00:00
    const expected = new Date(2024, 0, 5, 0, 0, 0, 0)
    expect(result).toEqual(expected)
  })
})
