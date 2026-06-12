import { beforeEach, describe, expect, test, vi } from "vitest"

const findManyDispatchMock = vi.fn()
const returningUpdateMock = vi.fn()

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
  },
}))

// Reusable mock client whose update chain terminates at returningUpdateMock
const mockDbClient = {
  query: {
    sequenceDispatchModel: { findMany: findManyDispatchMock },
  },
  update: () => ({
    set: () => ({
      where: () => ({
        returning: returningUpdateMock,
      }),
    }),
  }),
} as never

beforeEach(() => {
  findManyDispatchMock.mockResolvedValue([])
  returningUpdateMock.mockResolvedValue([])
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
