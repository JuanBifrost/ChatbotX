import { beforeEach, describe, expect, test, vi } from "vitest"

// ---------- db chain spies ----------
const findFirstSpy = vi.fn()
const updateSpy = vi.fn()
const setSpy = vi.fn()
const whereSpy = vi.fn()
const returningSpy = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      sequenceDispatchModel: {
        findFirst: (...args: unknown[]) => findFirstSpy(...args),
      },
    },
    update: (table: unknown) => {
      updateSpy(table)
      return {
        set: (values: unknown) => {
          setSpy(values)
          return {
            where: (...args: unknown[]) => {
              whereSpy(...args)
              return { returning: (...a: unknown[]) => returningSpy(...a) }
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
    status: { __col: "status" },
  },
}))

import { DispatchProcessorService } from "../src/sequence-scheduler/services/dispatch-processor.service"

// ---------- shared fixtures ----------

function makeDispatch(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1",
    workspaceId: "ws1",
    status: "pending",
    runAtMs: Date.now() - 5000,
    sequence: {},
    contact: {},
    enrollment: {},
    ...overrides,
  } as unknown as Parameters<DispatchProcessorService["validateDispatch"]>[0]
}

beforeEach(() => {
  findFirstSpy.mockResolvedValue(undefined)
  returningSpy.mockResolvedValue([])
})

// ---------- tests ----------

describe("DispatchProcessorService", () => {
  describe("fetchDispatch", () => {
    test("returns the dispatch when db finds a record", async () => {
      // Arrange
      const dispatch = makeDispatch()
      findFirstSpy.mockResolvedValue(dispatch)

      // Act
      const result = await new DispatchProcessorService().fetchDispatch("d1")

      // Assert
      expect(result).toEqual(dispatch)
    })

    test("returns null when db returns undefined (not found)", async () => {
      // Arrange
      findFirstSpy.mockResolvedValue(undefined)

      // Act
      const result = await new DispatchProcessorService().fetchDispatch(
        "missing",
      )

      // Assert
      expect(result).toBeNull()
    })

    test("returns null and logs error when db throws", async () => {
      // Arrange
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined)
      findFirstSpy.mockRejectedValue(new Error("connection refused"))

      // Act
      const result = await new DispatchProcessorService().fetchDispatch("d1")

      // Assert
      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[ERROR fetchDispatch]"),
        expect.any(Error),
      )
    })

    test("queries with id and fetches sequence/contact/enrollment relations", async () => {
      // Arrange
      findFirstSpy.mockResolvedValue({ id: "d99" })

      // Act
      await new DispatchProcessorService().fetchDispatch("d99")

      // Assert
      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "d99" }),
          with: { sequence: true, contact: true, enrollment: true },
        }),
      )
    })
  })

  describe("validateDispatch", () => {
    test("returns false when status is running", () => {
      // Arrange
      const dispatch = makeDispatch({ status: "running" })

      // Act + Assert
      expect(new DispatchProcessorService().validateDispatch(dispatch)).toBe(
        false,
      )
    })

    test("returns false when status is failed", () => {
      // Arrange
      const dispatch = makeDispatch({ status: "failed" })

      // Act + Assert
      expect(new DispatchProcessorService().validateDispatch(dispatch)).toBe(
        false,
      )
    })

    test("returns false when status is completed", () => {
      // Arrange
      const dispatch = makeDispatch({ status: "completed" })

      // Act + Assert
      expect(new DispatchProcessorService().validateDispatch(dispatch)).toBe(
        false,
      )
    })

    test("returns true when dispatch is pending", () => {
      // Arrange
      const dispatch = makeDispatch({ status: "pending" })

      // Act + Assert
      expect(new DispatchProcessorService().validateDispatch(dispatch)).toBe(
        true,
      )
    })

    test("returns false when dispatch is null", () => {
      expect(new DispatchProcessorService().validateDispatch(null)).toBe(false)
    })
  })

  describe("isDispatchReady", () => {
    test("returns true when runAtMs is in the past", () => {
      // Arrange
      const dispatch = makeDispatch({ runAtMs: Date.now() - 10_000 })

      // Act + Assert
      expect(
        new DispatchProcessorService().isDispatchReady(
          dispatch as NonNullable<typeof dispatch>,
        ),
      ).toBe(true)
    })

    test("returns true when runAtMs is within the 1 second tolerance window", () => {
      // Arrange
      const dispatch = makeDispatch({ runAtMs: Date.now() + 800 })

      // Act + Assert
      expect(
        new DispatchProcessorService().isDispatchReady(
          dispatch as NonNullable<typeof dispatch>,
        ),
      ).toBe(true)
    })

    test("returns false when runAtMs is beyond the tolerance window", () => {
      // Arrange
      const dispatch = makeDispatch({ runAtMs: Date.now() + 60_000 })

      // Act + Assert
      expect(
        new DispatchProcessorService().isDispatchReady(
          dispatch as NonNullable<typeof dispatch>,
        ),
      ).toBe(false)
    })
  })

  describe("lockDispatch", () => {
    test("returns true when a row is updated (lock acquired)", async () => {
      // Arrange
      returningSpy.mockResolvedValue([{ id: "d1" }])
      const dispatch = makeDispatch() as NonNullable<typeof makeDispatch>

      // Act
      const result = await new DispatchProcessorService().lockDispatch(
        dispatch as NonNullable<typeof dispatch>,
      )

      // Assert
      expect(result).toBe(true)
    })

    test("returns false when no rows updated — optimistic lock lost", async () => {
      // Arrange
      returningSpy.mockResolvedValue([])
      const dispatch = makeDispatch() as NonNullable<typeof makeDispatch>

      // Act
      const result = await new DispatchProcessorService().lockDispatch(
        dispatch as NonNullable<typeof dispatch>,
      )

      // Assert
      expect(result).toBe(false)
    })

    test("sets status to running with a fresh lockedAt timestamp", async () => {
      // Arrange
      returningSpy.mockResolvedValue([{ id: "d1" }])
      const dispatch = makeDispatch() as NonNullable<typeof makeDispatch>

      // Act
      const before = Date.now()
      await new DispatchProcessorService().lockDispatch(
        dispatch as NonNullable<typeof dispatch>,
      )
      const after = Date.now()

      // Assert
      const setArg = setSpy.mock.calls[0][0] as Record<string, unknown>
      expect(setArg.status).toBe("running")
      expect(setArg.lockedAt).toBeInstanceOf(Date)
      const ts = (setArg.lockedAt as Date).getTime()
      expect(ts).toBeGreaterThanOrEqual(before)
      expect(ts).toBeLessThanOrEqual(after)
    })

    test("WHERE clause uses id + workspaceId + status=pending for optimistic concurrency", async () => {
      // Arrange
      returningSpy.mockResolvedValue([])
      const dispatch = makeDispatch() as NonNullable<typeof makeDispatch>

      // Act
      await new DispatchProcessorService().lockDispatch(
        dispatch as NonNullable<typeof dispatch>,
      )

      // Assert — three conditions prevent double-claiming
      const whereArg = whereSpy.mock.calls[0][0] as { __and: unknown[] }
      expect(whereArg.__and).toHaveLength(3)
    })
  })
})
