import { beforeEach, describe, expect, test, vi } from "vitest"

const findManyDispatchMock = vi.fn()
const returningUpdateMock = vi.fn()
const whereUpdateMock = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  // db is not used directly in sequence-dispatch.ts; only the helpers are
  db: {},
  and: (...a: unknown[]) => ({ __and: a }),
  eq: (c: unknown, v: unknown) => ({ __eq: [c, v] }),
  inArray: (c: unknown, v: unknown) => ({ __inArray: [c, v] }),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  sequenceDispatchModel: {
    id: { __col: "sequenceDispatchModel.id" },
    status: { __col: "sequenceDispatchModel.status" },
    workspaceId: { __col: "sequenceDispatchModel.workspaceId" },
  },
}))

// Reusable mock client whose update chain terminates at returningUpdateMock
const mockDbClient = {
  query: {
    sequenceDispatchModel: { findMany: findManyDispatchMock },
  },
  update: () => ({
    set: () => ({
      where: (arg: unknown) => {
        whereUpdateMock(arg)
        return { returning: returningUpdateMock }
      },
    }),
  }),
} as never

beforeEach(() => {
  findManyDispatchMock.mockResolvedValue([])
  returningUpdateMock.mockResolvedValue([])
  whereUpdateMock.mockReset()
})

describe("sequenceDispatchUtils.bulkCancelPendingDispatches", () => {
  test("returns empty array when no pending dispatches are found", async () => {
    const { sequenceDispatchUtils } = await import("../src/sequence-dispatch")
    findManyDispatchMock.mockResolvedValue([])

    const result = await sequenceDispatchUtils.bulkCancelPendingDispatches({
      dbClient: mockDbClient,
      workspaceId: "ws-1",
      enrollmentId: "enroll-1",
    })

    expect(result).toEqual([])
  })

  test("does not call update when no pending dispatches are found", async () => {
    const { sequenceDispatchUtils } = await import("../src/sequence-dispatch")
    findManyDispatchMock.mockResolvedValue([])

    await sequenceDispatchUtils.bulkCancelPendingDispatches({
      dbClient: mockDbClient,
      workspaceId: "ws-1",
      enrollmentId: "enroll-1",
    })

    expect(returningUpdateMock).not.toHaveBeenCalled()
  })

  test("returns empty array when update affects no rows (concurrent cancel)", async () => {
    const { sequenceDispatchUtils } = await import("../src/sequence-dispatch")
    findManyDispatchMock.mockResolvedValue([
      {
        id: "d-1",
        bucket: 10,
        sequenceId: "seq-1",
        contactId: "c-1",
        stepId: "s-1",
      },
    ])
    returningUpdateMock.mockResolvedValue([]) // update matched nothing

    const result = await sequenceDispatchUtils.bulkCancelPendingDispatches({
      dbClient: mockDbClient,
      workspaceId: "ws-1",
      enrollmentId: "enroll-1",
    })

    expect(result).toEqual([])
  })

  test("returns mapped {id, bucket} pairs when dispatches are successfully canceled", async () => {
    const { sequenceDispatchUtils } = await import("../src/sequence-dispatch")
    const pendingDispatches = [
      {
        id: "d-1",
        bucket: 10,
        sequenceId: "seq-1",
        contactId: "c-1",
        stepId: "s-1",
      },
      {
        id: "d-2",
        bucket: 20,
        sequenceId: "seq-1",
        contactId: "c-1",
        stepId: "s-2",
      },
    ]
    findManyDispatchMock.mockResolvedValue(pendingDispatches)
    returningUpdateMock.mockResolvedValue(pendingDispatches) // non-empty → success path

    const result = await sequenceDispatchUtils.bulkCancelPendingDispatches({
      dbClient: mockDbClient,
      workspaceId: "ws-1",
      enrollmentId: "enroll-1",
    })

    expect(result).toEqual([
      { id: "d-1", bucket: 10 },
      { id: "d-2", bucket: 20 },
    ])
  })

  // UPDATE WHERE must include workspaceId + status=pending for partition pruning.
  test("UPDATE WHERE includes workspaceId and status=pending", async () => {
    const { sequenceDispatchUtils } = await import("../src/sequence-dispatch")
    findManyDispatchMock.mockResolvedValue([
      {
        id: "d-1",
        bucket: 1,
        sequenceId: "seq-1",
        contactId: "c-1",
        stepId: "s-1",
      },
    ])
    returningUpdateMock.mockResolvedValue([{ id: "d-1", bucket: 1 }])

    await sequenceDispatchUtils.bulkCancelPendingDispatches({
      dbClient: mockDbClient,
      workspaceId: "ws-1",
      enrollmentId: "enroll-1",
    })

    const where = whereUpdateMock.mock.calls[0][0] as {
      __and: Array<
        | { __eq: [{ __col: string }, unknown] }
        | { __inArray: [{ __col: string }, unknown] }
      >
    }
    const conditions = where.__and ?? []
    const eqConditions = conditions.filter((c) => "__eq" in c) as Array<{
      __eq: [{ __col: string }, unknown]
    }>
    const colNames = eqConditions.map((c) => c.__eq[0].__col)
    const colValues = Object.fromEntries(
      eqConditions.map((c) => [c.__eq[0].__col, c.__eq[1]]),
    )

    expect(colNames).toContain("sequenceDispatchModel.workspaceId")
    expect(colNames).toContain("sequenceDispatchModel.status")
    expect(colValues["sequenceDispatchModel.status"]).toBe("pending")
  })

  test("calls update exactly once regardless of how many dispatches are found", async () => {
    const { sequenceDispatchUtils } = await import("../src/sequence-dispatch")
    const dispatches = Array.from({ length: 5 }, (_, i) => ({
      id: `d-${i}`,
      bucket: i,
      sequenceId: "seq-1",
      contactId: "c-1",
      stepId: `s-${i}`,
    }))
    findManyDispatchMock.mockResolvedValue(dispatches)
    returningUpdateMock.mockResolvedValue(dispatches)

    await sequenceDispatchUtils.bulkCancelPendingDispatches({
      dbClient: mockDbClient,
      workspaceId: "ws-1",
      enrollmentId: "enroll-1",
    })

    expect(returningUpdateMock).toHaveBeenCalledTimes(1)
  })

  test("uses the provided workspaceId and enrollmentId when querying pending dispatches", async () => {
    const { sequenceDispatchUtils } = await import("../src/sequence-dispatch")
    findManyDispatchMock.mockResolvedValue([])

    await sequenceDispatchUtils.bulkCancelPendingDispatches({
      dbClient: mockDbClient,
      workspaceId: "my-workspace",
      enrollmentId: "my-enrollment",
    })

    expect(findManyDispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollmentId: "my-enrollment",
          workspaceId: "my-workspace",
          status: "pending",
        }),
      }),
    )
  })
})
