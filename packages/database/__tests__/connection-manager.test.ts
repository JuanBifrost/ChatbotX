import { beforeEach, describe, expect, test, vi } from "vitest"
import { MessageShardConnectionManager } from "../src/sharding/message/connection-manager"

// ---------------------------------------------------------------------------
// getWriteShardInfo — exposes the workspace's write shard as an all-time
// time-range info so read paths can union it in. This guarantees back-dated
// historical-import rows (written into the active shard but outside its
// registered time-range) remain reachable on read.
// ---------------------------------------------------------------------------

const shardRecord = {
  id: "s1",
  name: "shard-1",
  host: "localhost",
  port: 5432,
  database: "shard_db",
  user: "shard_user",
  credentialRef: null,
  isActive: true,
  sslMode: "disable",
  shardKey: null,
  readHost: null,
  readPort: null,
}

function makeManager(
  registryOverrides: Record<string, unknown> = {},
): MessageShardConnectionManager {
  const registry = {
    countActiveShards: vi.fn().mockResolvedValue(1),
    findShardForWrite: vi.fn().mockResolvedValue(shardRecord),
    ...registryOverrides,
  }
  return new MessageShardConnectionManager({} as never, registry as never)
}

describe("MessageShardConnectionManager.getWriteShardInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("maps the workspace write shard to an all-time time-range info", async () => {
    const manager = makeManager()

    const info = await manager.getWriteShardInfo("ws-1")

    expect(info).not.toBeNull()
    expect(info?.shardId).toBe("s1")
    expect(info?.id).toBe("write:s1")
    expect(info?.startTime).toEqual(new Date(0))
    expect(info?.endTime).toBeNull()
    expect(info?.shard.id).toBe("s1")
  })

  test("returns null when sharding is disabled (no active shards)", async () => {
    const manager = makeManager({
      countActiveShards: vi.fn().mockResolvedValue(0),
    })

    const info = await manager.getWriteShardInfo("ws-1")

    expect(info).toBeNull()
  })

  test("returns null when no shard is assigned to the workspace", async () => {
    const manager = makeManager({
      findShardForWrite: vi.fn().mockResolvedValue(null),
    })

    const info = await manager.getWriteShardInfo("ws-1")

    expect(info).toBeNull()
  })
})
