import { createId } from "@chatbotx.io/utils"
import { describe, expect, it } from "vitest"
import {
  buildHistoricalIdMaker,
  DRIFT_THRESHOLD_MS,
  decodeLegacyTimestampMs,
} from "../scripts/coexist-id-layout.mjs"

describe("coexist backfill id layout", () => {
  it("decodes a real createId() snowflake back to ~now (epoch must match createId = 2004-02-01)", () => {
    // Regression for the epoch bug: with the old wrong epoch (2026-03-31) this
    // decoded ~22 years into the future, flagging the entire Message table.
    const before = Date.now()
    const id = createId()
    const after = Date.now()

    const decoded = decodeLegacyTimestampMs(id)

    expect(decoded).toBeGreaterThanOrEqual(before - DRIFT_THRESHOLD_MS)
    expect(decoded).toBeLessThanOrEqual(after + DRIFT_THRESHOLD_MS)
  })

  it("does not flag a freshly-minted id as drifted", () => {
    const decoded = decodeLegacyTimestampMs(createId())
    expect(Math.abs(decoded - Date.now())).toBeLessThan(DRIFT_THRESHOLD_MS)
  })

  it("does not throw for pre-2026 historical timestamps", () => {
    // The old epoch made baseTs negative for any history before 2026-03-31,
    // aborting the backfill mid-run.
    const make = buildHistoricalIdMaker("12345")
    expect(() => make(Date.UTC(2024, 5, 1))).not.toThrow()
    expect(() => make(Date.UTC(2021, 0, 1))).not.toThrow()
  })

  it("generates monotonically increasing ids for increasing createdAt (same partition)", () => {
    const make = buildHistoricalIdMaker("777")
    const early = BigInt(make(Date.UTC(2024, 0, 1)))
    const late = BigInt(make(Date.UTC(2025, 0, 1)))
    expect(late).toBeGreaterThan(early)
  })

  it("disambiguates same-millisecond collisions via the seq field", () => {
    const make = buildHistoricalIdMaker("9")
    const ms = Date.UTC(2024, 2, 2, 2, 2, 2)
    const a = make(ms)
    const b = make(ms)
    expect(a).not.toBe(b)
    expect(BigInt(b)).toBeGreaterThan(BigInt(a))
  })
})
