// biome-ignore-all lint/suspicious/noBitwiseOperators: bit-packing assertions
// biome-ignore-all lint/performance/useTopLevelRegex: scoped error-message matchers
import { createId, resolveId } from "@chatbotx.io/utils"
import { describe, expect, it } from "vitest"
import {
  createHistoricalIdFactory,
  decodeHistoricalId,
} from "../src/integration/handlers/coexist/bulk-historical-import"

// Must match COEXIST_EPOCH_MS in bulk-historical-import.ts (the uuniq epoch,
// so historical IDs decode back to real wall-clock createdAt).
const EPOCH_MS = new Date("2004-02-01").getTime()
const RUN_ID = "12345"

describe("createHistoricalIdFactory", () => {
  it("produces strictly increasing IDs for monotonically increasing dates", () => {
    const make = createHistoricalIdFactory(RUN_ID)
    const ids = [0, 1, 2, 100, 1000].map((delta) =>
      make(new Date(EPOCH_MS + delta)),
    )
    for (let i = 1; i < ids.length; i++) {
      const a = ids[i - 1] as string
      const b = ids[i] as string
      expect(BigInt(a) < BigInt(b)).toBe(true)
    }
  })

  it("returns distinct IDs for two calls with the same date (sequence advances)", () => {
    const make = createHistoricalIdFactory(RUN_ID)
    const date = new Date(EPOCH_MS + 5000)
    const a = make(date)
    const b = make(date)
    expect(a).not.toBe(b)
    expect(BigInt(a) < BigInt(b)).toBe(true)
  })

  it("round-trips date through decodeHistoricalId", () => {
    const make = createHistoricalIdFactory(RUN_ID)
    const date = new Date(EPOCH_MS + 1_234_567)
    const id = make(date)
    const decoded = decodeHistoricalId(id)
    expect(decoded.timestampMs).toBe(date.getTime())
    expect(decoded.partition).toBe(Number(BigInt(RUN_ID) & 0x3ffn))
    expect(decoded.seq).toBe(0)
  })

  it("throws when date is before the epoch", () => {
    const make = createHistoricalIdFactory(RUN_ID)
    expect(() => make(new Date(EPOCH_MS - 1))).toThrow(/out of range/)
  })

  it("100 runs × 16 same-ms IDs produce 1,600 unique IDs across distinct partitions", () => {
    const date = new Date(EPOCH_MS + 999)
    const all = new Set<string>()
    for (let r = 0; r < 100; r++) {
      // Distinct run partitions: spread across the 10-bit space.
      const make = createHistoricalIdFactory(String(r * 7 + 1))
      for (let i = 0; i < 16; i++) {
        all.add(make(date))
      }
    }
    expect(all.size).toBe(100 * 16)
  })

  it("bumps timestamp forward when sequence space (16) is exhausted in one ms", () => {
    const make = createHistoricalIdFactory(RUN_ID)
    const date = new Date(EPOCH_MS + 42)
    const ids: string[] = []
    for (let i = 0; i < 17; i++) {
      ids.push(make(date))
    }
    // First 16 land on ms=42; the 17th wraps and lands on ms=43.
    expect(decodeHistoricalId(ids[15] as string).timestampMs).toBe(
      date.getTime(),
    )
    expect(decodeHistoricalId(ids[16] as string).timestampMs).toBe(
      date.getTime() + 1,
    )
    // Monotonicity preserved across the wrap.
    expect(BigInt(ids[15] as string) < BigInt(ids[16] as string)).toBe(true)
  })

  it("id order matches createdAt order regardless of call order", () => {
    // Graph streams newest-first; factory must still produce IDs whose numeric
    // order matches `createdAt` order so `ORDER BY id` reflects chronology.
    const make = createHistoricalIdFactory(RUN_ID)
    const later = make(new Date(EPOCH_MS + 1000))
    const earlier = make(new Date(EPOCH_MS + 500))
    expect(BigInt(earlier) < BigInt(later)).toBe(true)
  })

  it("preserves chronological id order across many out-of-order inserts", () => {
    const make = createHistoricalIdFactory(RUN_ID)
    const deltas = [5000, 100, 3000, 50, 4000, 200, 10, 4500, 1500]
    const pairs = deltas.map((d) => ({
      delta: d,
      id: make(new Date(EPOCH_MS + d)),
    }))
    const sortedByTs = [...pairs].sort((a, b) => a.delta - b.delta)
    const sortedById = [...pairs].sort((a, b) =>
      BigInt(a.id) < BigInt(b.id) ? -1 : 1,
    )
    expect(sortedById.map((p) => p.delta)).toEqual(
      sortedByTs.map((p) => p.delta),
    )
  })
})

describe("ID validity via uuniq Snowflake.resolve()", () => {
  it("createId() output resolves to a valid snowflake", () => {
    const id = createId()
    expect(id).toMatch(/^\d+$/)
    const resolved = resolveId(id)
    expect(typeof resolved.created_at).toBe("string")
    expect(Number.isNaN(Date.parse(resolved.created_at))).toBe(false)
    expect(typeof resolved.place_id).toBe("number")
    expect(typeof resolved.sequence).toBe("number")
  })

  it("makeMessageId(date) output resolves under the same Snowflake decoder as createId()", () => {
    // Shared ts_shift=14 means coexist factory IDs are well-formed snowflakes
    // under the same uuniq layout `createId()` uses. created_at decoded from
    // the id must round-trip to the input date at second-precision (uuniq
    // formats `created_at` as an ISO string truncated by its internal encoder).
    const make = createHistoricalIdFactory(RUN_ID)
    const date = new Date(EPOCH_MS + 1_234_567)
    const id = make(date)
    expect(id).toMatch(/^\d+$/)
    const resolved = resolveId(id)
    expect(typeof resolved.created_at).toBe("string")
    const decodedMs = Date.parse(resolved.created_at)
    expect(Number.isNaN(decodedMs)).toBe(false)
    // uuniq's resolve recovers the ms timestamp; allow 1 ms tolerance for any
    // rounding inside the library's anybase encoder.
    expect(Math.abs(decodedMs - date.getTime())).toBeLessThanOrEqual(1)
  })

  it("createId() and makeMessageId() share id length / magnitude", () => {
    // Both use ts_shift=14 against the same epoch, so a coexist id minted for
    // "now" and a live createId() called now must have the same digit count.
    const liveId = createId()
    const coexistId = createHistoricalIdFactory(RUN_ID)(new Date())
    expect(coexistId.length).toBe(liveId.length)
  })
})
