import { Pool } from "pg"
import { logger } from "../../logger"
import { resolveShardCredentials } from "./credentials"
import { envInt } from "./env"
import type { ShardConfig } from "./types"

export interface CreateShardPoolOptions {
  connectionTimeoutMillis?: number
  idleTimeoutMillis?: number
  max?: number
  min?: number
}

const ENV_DEFAULTS = {
  max: envInt("SHARD_POOL_MAX", 10, { min: 1 }),
  min: envInt("SHARD_POOL_MIN", 2),
  idleTimeoutMillis: envInt("SHARD_POOL_IDLE_TIMEOUT_MS", 30_000),
  connectionTimeoutMillis: envInt("SHARD_POOL_CONNECT_TIMEOUT_MS", 5000),
}

function buildSslConfig(sslMode: string) {
  if (sslMode === "disable") {
    return
  }
  return { rejectUnauthorized: sslMode !== "require" }
}

function attachPoolErrorHandler(
  pool: Pool,
  props: { role: "primary" | "read"; shardId: string },
): Pool {
  pool.on("error", (error) => {
    logger.error(
      { err: error, role: props.role, shardId: props.shardId },
      "Unexpected idle shard pool error",
    )
  })
  return pool
}

export function createShardPool(
  shard: ShardConfig,
  options: CreateShardPoolOptions = {},
): Pool {
  const { password, sslMode } = resolveShardCredentials({
    credentialRef: shard.credentialRef,
    sslMode: shard.sslMode,
  })

  const merged = { ...ENV_DEFAULTS, ...options }

  return attachPoolErrorHandler(
    new Pool({
      host: shard.host,
      port: shard.port ?? 5432,
      database: shard.database,
      user: shard.user,
      password,
      ssl: buildSslConfig(sslMode),
      max: merged.max,
      min: merged.min,
      idleTimeoutMillis: merged.idleTimeoutMillis,
      connectionTimeoutMillis: merged.connectionTimeoutMillis,
    }),
    { role: "primary", shardId: shard.id },
  )
}

export function createReadShardPool(
  shard: ShardConfig,
  options: CreateShardPoolOptions = {},
): Pool | null {
  if (!shard.readHost) {
    return null
  }

  const { password, sslMode } = resolveShardCredentials({
    credentialRef: shard.credentialRef,
    sslMode: shard.sslMode,
  })

  const merged = { ...ENV_DEFAULTS, ...options }

  return attachPoolErrorHandler(
    new Pool({
      host: shard.readHost,
      port: shard.readPort ?? shard.port ?? 5432,
      database: shard.database,
      user: shard.user,
      password,
      ssl: buildSslConfig(sslMode),
      max: merged.max,
      min: merged.min,
      idleTimeoutMillis: merged.idleTimeoutMillis,
      connectionTimeoutMillis: merged.connectionTimeoutMillis,
    }),
    { role: "read", shardId: shard.id },
  )
}
