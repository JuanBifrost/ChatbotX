// @vitest-environment node

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "vitest"

const sequenceWorkerEntrypoints = [
  "src/sequence-scheduler/worker.ts",
  "src/sequence-scheduler/worker-producer.ts",
]
const consoleCallPattern = /\bconsole\./

describe("sequence worker logging", () => {
  test("entrypoints use structured logger instead of console calls", async () => {
    for (const relativePath of sequenceWorkerEntrypoints) {
      const source = await readFile(join(process.cwd(), relativePath), "utf8")

      expect(source, relativePath).not.toMatch(consoleCallPattern)
    }
  })
})
