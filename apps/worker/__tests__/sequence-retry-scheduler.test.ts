import { beforeEach, describe, expect, test, vi } from "vitest"

// ---------- db chain spies ----------
const updateSpy = vi.fn()
const setSpy = vi.fn()
const whereSpy = vi.fn()
const whereResolveSpy = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    update: (table: unknown) => {
      updateSpy(table)
      return {
        set: (values: unknown) => {
          setSpy(values)
          return {
            where: (...args: unknown[]) => {
              whereSpy(...args)
              return whereResolveSpy(...args)
            },
          }
        },
      }
    },
  },
  and: (...args: unknown[]) => ({ __and: args }),
  eq: (col: unknown, val: unknown) => ({ __eq: [col, val] }),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  sequenceDispatchModel: {
    id: { __col: "id" },
    workspaceId: { __col: "workspaceId" },
  },
}))

// Logger is a pino child logger — mock the whole module
const loggerErrorSpy = vi.fn()
vi.mock("../src/lib/logger", () => ({
  logger: { error: (...args: unknown[]) => loggerErrorSpy(...args) },
}))

import { RetrySchedulerService } from "../src/sequence-scheduler/services/retry-scheduler.service"

beforeEach(() => {
  whereResolveSpy.mockResolvedValue(undefined)
})

// ---------- tests ----------

describe("RetrySchedulerService", () => {
  describe("markDispatchFailed", () => {
    test("updates dispatch to failed status with the provided error message", async () => {
      // Act
      await new RetrySchedulerService().markDispatchFailed(
        "d1",
        "ws1",
        "something went wrong",
      )

      // Assert
      expect(updateSpy).toHaveBeenCalledTimes(1)
      const setArg = setSpy.mock.calls[0][0] as Record<string, unknown>
      expect(setArg.status).toBe("failed")
      expect(setArg.lastError).toBe("something went wrong")
    })

    test("stamps updatedAt with a current timestamp", async () => {
      // Arrange
      const before = Date.now()

      // Act
      await new RetrySchedulerService().markDispatchFailed("d1", "ws1", "err")

      // Assert
      const after = Date.now()
      const setArg = setSpy.mock.calls[0][0] as Record<string, unknown>
      expect(setArg.updatedAt).toBeInstanceOf(Date)
      const ts = (setArg.updatedAt as Date).getTime()
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })

    test("WHERE clause includes both dispatchId and workspaceId", async () => {
      // Act
      await new RetrySchedulerService().markDispatchFailed("d1", "ws1", "err")

      // Assert
      const whereArg = whereSpy.mock.calls[0][0] as { __and: unknown[] }
      expect(whereArg.__and).toHaveLength(2)
    })

    test("calls logger.error with dispatchId and errorMessage", async () => {
      // Act
      await new RetrySchedulerService().markDispatchFailed("d1", "ws1", "boom")

      // Assert
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ dispatchId: "d1", errorMessage: "boom" }),
        expect.any(String),
      )
    })
  })

  describe("markDispatchCanceled", () => {
    test("updates dispatch to canceled status", async () => {
      // Act
      await new RetrySchedulerService().markDispatchCanceled(
        "d1",
        "ws1",
        "step inactive",
      )

      // Assert
      const setArg = setSpy.mock.calls[0][0] as Record<string, unknown>
      expect(setArg.status).toBe("canceled")
    })

    test("stamps updatedAt with a current timestamp", async () => {
      // Arrange
      const before = Date.now()

      // Act
      await new RetrySchedulerService().markDispatchCanceled(
        "d1",
        "ws1",
        "reason",
      )

      // Assert
      const after = Date.now()
      const setArg = setSpy.mock.calls[0][0] as Record<string, unknown>
      expect(setArg.updatedAt).toBeInstanceOf(Date)
      const ts = (setArg.updatedAt as Date).getTime()
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })

    test("WHERE clause includes both dispatchId and workspaceId", async () => {
      // Act
      await new RetrySchedulerService().markDispatchCanceled(
        "d1",
        "ws1",
        "reason",
      )

      // Assert
      const whereArg = whereSpy.mock.calls[0][0] as { __and: unknown[] }
      expect(whereArg.__and).toHaveLength(2)
    })

    test("stores the reason string in lastError", async () => {
      await new RetrySchedulerService().markDispatchCanceled(
        "d1",
        "ws1",
        "step inactive",
      )

      const setArg = setSpy.mock.calls[0][0] as Record<string, unknown>
      expect(setArg.lastError).toBe("step inactive")
    })

    test("does NOT call logger.error (only markDispatchFailed logs)", async () => {
      // Act
      await new RetrySchedulerService().markDispatchCanceled(
        "d1",
        "ws1",
        "reason",
      )

      // Assert
      expect(loggerErrorSpy).not.toHaveBeenCalled()
    })
  })
})
