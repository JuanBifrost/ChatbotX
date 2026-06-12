import { beforeEach, describe, expect, test, vi } from "vitest"

const findFirstMock = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      sequenceStepModel: {
        findFirst: findFirstMock,
      },
    },
  },
}))

describe("calculateNextRunAtFromStep", () => {
  test("returns a clone of specificDateTime when delayUnit is specificTime", async () => {
    const { calculateNextRunAtFromStep } = await import(
      "../src/calculate-next-run-at"
    )
    const specificDateTime = new Date("2024-06-01T10:00:00.000Z")
    const step = {
      delayDays: 0,
      delayMinutes: 0,
      delayUnit: "specificTime",
      specificDateTime,
    }

    const result = calculateNextRunAtFromStep(step)

    expect(result.getTime()).toBe(specificDateTime.getTime())
    expect(result).not.toBe(specificDateTime)
  })

  test("returns baseTime as same reference when delay is zero", async () => {
    const { calculateNextRunAtFromStep } = await import(
      "../src/calculate-next-run-at"
    )
    const baseTime = new Date("2024-01-01T12:00:00.000Z")
    const step = {
      delayDays: 0,
      delayMinutes: 0,
      delayUnit: null,
      specificDateTime: null,
    }

    const result = calculateNextRunAtFromStep(step, baseTime)

    expect(result).toBe(baseTime)
  })

  test("returns baseTime as same reference when both delayDays and delayMinutes are zero", async () => {
    const { calculateNextRunAtFromStep } = await import(
      "../src/calculate-next-run-at"
    )
    const baseTime = new Date("2024-03-15T09:30:00.000Z")
    const step = {
      delayDays: 0,
      delayMinutes: 0,
      delayUnit: "days",
      specificDateTime: null,
    }

    const result = calculateNextRunAtFromStep(step, baseTime)

    expect(result).toBe(baseTime)
  })

  test("adds days and minutes to baseTime when delay is positive", async () => {
    const { calculateNextRunAtFromStep } = await import(
      "../src/calculate-next-run-at"
    )
    const baseTime = new Date("2024-01-01T00:00:00.000Z")
    const step = {
      delayDays: 2,
      delayMinutes: 30,
      delayUnit: null,
      specificDateTime: null,
    }

    const result = calculateNextRunAtFromStep(step, baseTime)

    const DAY_IN_MS = 24 * 60 * 60 * 1000
    const MINUTE_IN_MS = 60 * 1000
    const expected = new Date(
      baseTime.getTime() + 2 * DAY_IN_MS + 30 * MINUTE_IN_MS,
    )
    expect(result).toEqual(expected)
  })

  test("adds only days when delayMinutes is zero", async () => {
    const { calculateNextRunAtFromStep } = await import(
      "../src/calculate-next-run-at"
    )
    const baseTime = new Date("2024-01-10T06:00:00.000Z")
    const step = {
      delayDays: 5,
      delayMinutes: 0,
      delayUnit: null,
      specificDateTime: null,
    }

    const result = calculateNextRunAtFromStep(step, baseTime)

    const expected = new Date(baseTime.getTime() + 5 * 24 * 60 * 60 * 1000)
    expect(result).toEqual(expected)
  })

  test("ignores specificDateTime when delayUnit is not specificTime", async () => {
    const { calculateNextRunAtFromStep } = await import(
      "../src/calculate-next-run-at"
    )
    const baseTime = new Date("2024-01-01T00:00:00.000Z")
    const specificDateTime = new Date("2099-12-31T00:00:00.000Z")
    const step = {
      delayDays: 0,
      delayMinutes: 0,
      delayUnit: "days",
      specificDateTime,
    }

    const result = calculateNextRunAtFromStep(step, baseTime)

    // delay is zero → returns baseTime, not specificDateTime
    expect(result).toBe(baseTime)
  })
})

describe("calculateNextRunAt", () => {
  beforeEach(() => {
    findFirstMock.mockResolvedValue(undefined)
  })

  test("returns enrolledAt with null nextStepId when no first step is found", async () => {
    const { calculateNextRunAt } = await import("../src/calculate-next-run-at")
    const enrolledAt = new Date("2024-01-15T08:00:00.000Z")
    findFirstMock.mockResolvedValue(undefined)

    const result = await calculateNextRunAt("seq-abc", enrolledAt)

    expect(result).toEqual({ nextRunAt: enrolledAt, nextStepId: null })
  })

  test("returns computed nextRunAt and step id when first step exists with a delay", async () => {
    const { calculateNextRunAt } = await import("../src/calculate-next-run-at")
    const enrolledAt = new Date("2024-01-01T00:00:00.000Z")
    findFirstMock.mockResolvedValue({
      id: "step-xyz",
      delayDays: 3,
      delayMinutes: 0,
      delayUnit: null,
      specificDateTime: null,
    })

    const result = await calculateNextRunAt("seq-abc", enrolledAt)

    expect(result.nextStepId).toBe("step-xyz")
    expect(result.nextRunAt).toEqual(
      new Date(enrolledAt.getTime() + 3 * 24 * 60 * 60 * 1000),
    )
  })

  test("returns enrolledAt as nextRunAt when first step has zero delay", async () => {
    const { calculateNextRunAt } = await import("../src/calculate-next-run-at")
    const enrolledAt = new Date("2024-05-01T12:00:00.000Z")
    findFirstMock.mockResolvedValue({
      id: "step-zero",
      delayDays: 0,
      delayMinutes: 0,
      delayUnit: null,
      specificDateTime: null,
    })

    const result = await calculateNextRunAt("seq-abc", enrolledAt)

    expect(result.nextStepId).toBe("step-zero")
    // zero delay → calculateNextRunAtFromStep returns baseTime (same ref = enrolledAt)
    expect(result.nextRunAt).toBe(enrolledAt)
  })

  test("uses provided transaction client instead of the default db", async () => {
    const { calculateNextRunAt } = await import("../src/calculate-next-run-at")
    const txFindFirstMock = vi.fn().mockResolvedValue(undefined)
    const txClient = {
      query: {
        sequenceStepModel: {
          findFirst: txFindFirstMock,
        },
      },
    }
    const enrolledAt = new Date("2024-01-01T00:00:00.000Z")

    await calculateNextRunAt("seq-abc", enrolledAt, txClient as never)

    expect(txFindFirstMock).toHaveBeenCalledTimes(1)
    expect(findFirstMock).not.toHaveBeenCalled()
  })
})
