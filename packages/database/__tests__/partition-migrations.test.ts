import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const drizzleDir = join(import.meta.dirname, "../drizzle")

const contactOnBroadcastSql = readFileSync(
  join(
    drizzleDir,
    "20260612235000_partition_contact_on_broadcast/migration.sql",
  ),
  "utf8",
)

const sequenceSql = readFileSync(
  join(
    drizzleDir,
    "20260612235500_partition_contact_on_sequence_and_dispatch/migration.sql",
  ),
  "utf8",
)

function insertColumns(sql: string, tableName: string) {
  const match = new RegExp(
    `INSERT INTO "${tableName}" \\((?<columns>[\\s\\S]*?)\\)\\s*SELECT`,
  ).exec(sql)

  if (!match?.groups?.columns) {
    throw new Error(`Missing INSERT column list for ${tableName}`)
  }

  return match.groups.columns
}

describe("partition migrations", () => {
  test("ContactOnBroadcast copy uses explicit columns and excludes generated isRead", () => {
    expect(contactOnBroadcastSql).not.toContain("SELECT *")

    const columns = insertColumns(
      contactOnBroadcastSql,
      "ContactOnBroadcast_new",
    )
    expect(columns).toContain('"broadcastId"')
    expect(columns).toContain('"sent"')
    expect(columns).not.toContain('"isRead"')
  })

  test("SequenceDispatch copy excludes generated isRead and stale ContactOnSequence columns", () => {
    expect(sequenceSql).not.toContain("SELECT *")

    const dispatchColumns = insertColumns(sequenceSql, "SequenceDispatch_new")
    expect(dispatchColumns).toContain('"status"')
    expect(dispatchColumns).toContain('"workspaceId"')
    expect(dispatchColumns).not.toContain('"isRead"')

    const enrollmentColumns = insertColumns(
      sequenceSql,
      "ContactOnSequence_new",
    )
    expect(enrollmentColumns).not.toContain('"errorCount"')
  })

  test("validates new partitioned tables before irreversible drops", () => {
    const broadcastValidation = contactOnBroadcastSql.indexOf(
      "ContactOnBroadcast_new expected 64 partitions",
    )
    const broadcastDrop = contactOnBroadcastSql.indexOf(
      'DROP TABLE "ContactOnBroadcast_old"',
    )
    expect(broadcastValidation).toBeGreaterThanOrEqual(0)
    expect(broadcastValidation).toBeLessThan(broadcastDrop)

    const sequenceValidation = sequenceSql.indexOf(
      "SequenceDispatch_new expected 64 partitions",
    )
    const sequenceDrop = sequenceSql.indexOf(
      'DROP TABLE "SequenceDispatch_old"',
    )
    expect(sequenceValidation).toBeGreaterThanOrEqual(0)
    expect(sequenceValidation).toBeLessThan(sequenceDrop)
  })

  test("SequenceDispatch uses workspace hash partitioning without idempotency registry", () => {
    expect(sequenceSql).toContain(
      'CONSTRAINT "SequenceDispatch_new_pkey" PRIMARY KEY ("id", "workspaceId")',
    )
    expect(sequenceSql).toContain('PARTITION BY HASH ("workspaceId")')
    expect(sequenceSql).toContain(
      'CREATE UNIQUE INDEX "SequenceDispatch_idempotencyKey_key_new"',
    )
    expect(sequenceSql).toContain(
      'ON "SequenceDispatch_new" ("idempotencyKey", "workspaceId")',
    )
    expect(sequenceSql).toContain(
      'CREATE INDEX "SequenceDispatch_pending_runAtMs_idx_new"',
    )
    expect(sequenceSql).toContain(
      'CREATE INDEX "SequenceDispatch_pending_bucket_runAtMs_idx_new"',
    )
    expect(sequenceSql).not.toContain('PARTITION BY LIST ("status")')
    expect(sequenceSql).not.toContain('"SequenceDispatchIdempotency"')
  })
})
