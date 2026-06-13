import { beforeEach, describe, expect, test, vi } from "vitest"

const setSpy = vi.fn<(values: Record<string, unknown>) => unknown>()
const whereSpy = vi.fn<(arg: unknown) => Promise<unknown>>()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        setSpy(values)
        return { where: whereSpy }
      },
    }),
  },
  and: (...args: unknown[]) => ({ __and: args }),
  eq: (c: unknown, v: unknown) => ({ __eq: [c, v] }),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  sequenceDispatchModel: {
    id: { __column: "id" },
    workspaceId: { __column: "workspaceId" },
    status: { __column: "status" },
  },
}))

const cols = (where: {
  __and?: Array<{ __eq?: [{ __column: string }, unknown] }>
}) =>
  (where.__and ?? []).flatMap((condition) =>
    condition.__eq ? [condition.__eq[0].__column] : [],
  )

beforeEach(() => {
  setSpy.mockReset()
  whereSpy.mockReset().mockResolvedValue(undefined)
})

describe("revertDispatchToPending", () => {
  test("sets status=pending and WHERE includes id + workspaceId + status=running", async () => {
    const { revertDispatchToPending } = await import(
      "../src/sequence-scheduler/revert-dispatch"
    )

    await revertDispatchToPending("d1", "w1")

    expect(setSpy.mock.calls[0][0]).toMatchObject({
      status: "pending",
      lockedAt: null,
      lockOwner: null,
      updatedAt: expect.any(Date),
    })
    const c = cols(whereSpy.mock.calls[0][0] as { __and: [] })
    expect(c).toEqual(expect.arrayContaining(["id", "workspaceId", "status"]))
  })
})
