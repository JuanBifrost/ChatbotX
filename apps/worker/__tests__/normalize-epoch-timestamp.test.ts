import { describe, expect, test } from "vitest"
import { normalizeEpochTimestamp } from "../src/integration/utils/message"

describe("normalizeEpochTimestamp", () => {
  test("returns null for missing and invalid values", () => {
    expect(normalizeEpochTimestamp(null)).toBeNull()
    expect(normalizeEpochTimestamp(undefined)).toBeNull()
    expect(normalizeEpochTimestamp("abc")).toBeNull()
    expect(normalizeEpochTimestamp(Number.NaN)).toBeNull()
    expect(normalizeEpochTimestamp(-1)).toBeNull()
    expect(normalizeEpochTimestamp(0)).toBeNull()
  })

  test("normalizes epoch seconds to milliseconds", () => {
    expect(normalizeEpochTimestamp(1_700_000_000)).toEqual(
      new Date(1_700_000_000_000),
    )
    expect(normalizeEpochTimestamp("1700000000")).toEqual(
      new Date(1_700_000_000_000),
    )
  })

  test("keeps epoch milliseconds unchanged", () => {
    expect(normalizeEpochTimestamp(1_700_000_000_123)).toEqual(
      new Date(1_700_000_000_123),
    )
  })

  test("uses 10_000_000_000 as the seconds versus milliseconds boundary", () => {
    expect(normalizeEpochTimestamp(9_999_999_999)).toEqual(
      new Date(9_999_999_999_000),
    )
    expect(normalizeEpochTimestamp(10_000_000_000)).toEqual(
      new Date(10_000_000_000),
    )
  })
})
