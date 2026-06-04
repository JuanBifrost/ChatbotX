// biome-ignore-all lint/suspicious/noBitwiseOperators: bit-packing 63-bit snowflake IDs
/**
 * Pure ID-layout helpers for coexist historical Message IDs, extracted from the
 * backfill script so they can be unit-tested without a database connection.
 *
 * Layout (fits a signed 63-bit bigint):
 *   [ ts: ms since 2004-02-01 epoch (<=53 bits) ][ 10 bits partition ][ 4 bits seq ]
 *   (partition + seq occupy the low 14 bits; ts is shifted left by 14)
 *
 * The epoch MUST match `createId()` (uuniq Snowflake epoch 2004-02-01) so that a
 * legacy id decodes back to its real wall-clock createdAt. Using a different
 * epoch here is the bug that previously flagged the entire Message table for
 * re-ID and threw on any pre-epoch history.
 */
export const EPOCH_MS = new Date("2004-02-01").getTime()

const TS_BITS = 53n
const PARTITION_BITS = 10n
const SEQ_BITS = 4n
const PARTITION_SHIFT = SEQ_BITS
const TS_SHIFT = PARTITION_BITS + SEQ_BITS
const PARTITION_MASK = (1n << PARTITION_BITS) - 1n
const MAX_TS = 1n << TS_BITS
const SEQ_SPACE = 1n << SEQ_BITS

// Legacy uuniq layout shares the same ts_shift = 14 (53 ts · 4 place_id · 10 seq).
const LEGACY_TS_SHIFT = 14n

export const DRIFT_THRESHOLD_MS = 60_000

export const decodeLegacyTimestampMs = (idStr) =>
  Number(BigInt(idStr) >> LEGACY_TS_SHIFT) + EPOCH_MS

export const buildHistoricalIdMaker = (partitionSource) => {
  const partition = BigInt(partitionSource) & PARTITION_MASK
  const seqByTs = new Map()
  return (createdAtMs) => {
    const baseTs = BigInt(createdAtMs - EPOCH_MS)
    if (baseTs < 0n || baseTs >= MAX_TS) {
      throw new Error(`out of range: ${new Date(createdAtMs).toISOString()}`)
    }
    let ts = baseTs
    while (ts < MAX_TS) {
      const next = seqByTs.get(ts) ?? 0n
      if (next < SEQ_SPACE) {
        seqByTs.set(ts, next + 1n)
        return (
          (ts << TS_SHIFT) |
          (partition << PARTITION_SHIFT) |
          next
        ).toString()
      }
      ts += 1n
    }
    throw new Error(
      `exhausted seq space at ${new Date(createdAtMs).toISOString()}`,
    )
  }
}
