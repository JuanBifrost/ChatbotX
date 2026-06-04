import { beforeEach, describe, expect, it, vi } from "vitest"

// ---------------------------------------------------------------------------
// Hoist mock function references
// ---------------------------------------------------------------------------

const { mockExecute, mockFindFirst, mockFindMany, mockEqFn, mockQueueAdd } =
  vi.hoisted(() => ({
    mockExecute: vi.fn(),
    mockFindFirst: vi.fn(),
    mockFindMany: vi.fn(),
    mockEqFn: vi.fn((col: unknown, val: unknown) => ({ __eq: [col, val] })),
    mockQueueAdd: vi.fn(),
  }))

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    execute: mockExecute,
    query: {
      integrationWhatsappModel: {
        findFirst: mockFindFirst,
        findMany: mockFindMany,
      },
    },
  },
  eq: mockEqFn,
  sql: new Proxy(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      __sql: { strings, values },
    }),
    {
      get: (_target, prop) => {
        if (prop === "identifier") {
          return (name: string) => ({ __ident: name })
        }
        return
      },
    },
  ),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  integrationWhatsappModel: { id: "id" },
}))

vi.mock("@chatbotx.io/worker-config", () => ({
  IntegrationJobAction: {
    coexistWhatsappFlush: "coexistWhatsappFlush",
    coexistMessengerSync: "coexistMessengerSync",
  },
  integrationQueue: { add: mockQueueAdd },
}))

vi.mock("@chatbotx.io/logger", () => ({
  getChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// Import handler after mocks
// ---------------------------------------------------------------------------

import { scanCoexistRuns } from "../src/schedule/handlers/scan-coexist-runs"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The first db.execute call is always the cap-failed UPDATE (returns nothing meaningful). */
const mockCapUpdate = () => {
  mockExecute.mockResolvedValueOnce({ rows: [] })
}

/** The second db.execute call is the atomic pick UPDATE…RETURNING. */
const mockPickRows = (rows: object[]) => {
  mockExecute.mockResolvedValueOnce({ rows })
}

/** Subsequent db.execute calls (per-run failure updates) resolve silently. */
const mockRunUpdate = () => {
  mockExecute.mockResolvedValue({ rows: [] })
}

const waRun = {
  id: "run-wa-1",
  attempts: 1,
  channel: "whatsapp" as const,
  integrationId: "int-wa-1",
  workspaceId: "ws-1",
}

const msRun = {
  id: "run-ms-1",
  attempts: 2,
  channel: "messenger" as const,
  integrationId: "int-ms-1",
  workspaceId: "ws-2",
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("scanCoexistRuns", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("(a) init row older than 10s gets picked and enqueued", async () => {
    mockCapUpdate()
    mockPickRows([waRun])
    mockRunUpdate()
    mockFindMany.mockResolvedValue([
      { id: "int-wa-1", phoneNumberId: "phone-123" },
    ])
    mockQueueAdd.mockResolvedValue(undefined)

    await scanCoexistRuns()

    expect(mockQueueAdd).toHaveBeenCalledTimes(1)
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "coexistWhatsappFlush",
      expect.objectContaining({
        type: "coexistWhatsappFlush",
        data: expect.objectContaining({
          runId: "run-wa-1",
          phoneNumberId: "phone-123",
        }),
      }),
      expect.objectContaining({ jobId: "coexist-run-run-wa-1-1" }),
    )
  })

  it("(b) running row stale >1h gets picked, status reset to init, attempts incremented", async () => {
    const staleRun = {
      ...waRun,
      id: "run-stale-1",
      attempts: 3,
      channel: "whatsapp" as const,
    }
    mockCapUpdate()
    mockPickRows([staleRun])
    mockRunUpdate()
    mockFindMany.mockResolvedValue([
      { id: staleRun.integrationId, phoneNumberId: "phone-stale" },
    ])
    mockQueueAdd.mockResolvedValue(undefined)

    await scanCoexistRuns()

    // The RETURNING row already has the incremented attempts value from the UPDATE
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "coexistWhatsappFlush",
      expect.anything(),
      expect.objectContaining({
        jobId: `coexist-run-${staleRun.id}-${staleRun.attempts}`,
      }),
    )
  })

  it("(c) row at attempts>=5 is NOT picked — cap UPDATE runs first, second execute returns empty", async () => {
    // Cap update fires first (marks failed)
    mockCapUpdate()
    // Pick query returns nothing (the capped row was already excluded/updated)
    mockPickRows([])

    await scanCoexistRuns()

    // Two execute calls total (cap + pick), no enqueue
    expect(mockExecute).toHaveBeenCalledTimes(2)
    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  it("(d) jobId format is coexist-run-<id>-<attempts>", async () => {
    const run = {
      id: "abc-123",
      attempts: 4,
      channel: "messenger" as const,
      integrationId: "int-1",
      workspaceId: "ws-1",
    }
    mockCapUpdate()
    mockPickRows([run])
    mockQueueAdd.mockResolvedValue(undefined)

    await scanCoexistRuns()

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "coexistMessengerSync",
      expect.anything(),
      expect.objectContaining({ jobId: "coexist-run-abc-123-4" }),
    )
  })

  it("(e) WhatsApp branch fetches phoneNumberId; messenger branch skips that lookup", async () => {
    mockCapUpdate()
    mockPickRows([waRun, msRun])
    mockRunUpdate()
    mockFindMany.mockResolvedValue([
      { id: "int-wa-1", phoneNumberId: "phone-wa" },
    ])
    mockQueueAdd.mockResolvedValue(undefined)

    await scanCoexistRuns()

    // findMany called exactly once (batch for WhatsApp runs only), findFirst never called
    expect(mockFindMany).toHaveBeenCalledTimes(1)
    expect(mockFindFirst).not.toHaveBeenCalled()
    expect(mockQueueAdd).toHaveBeenCalledTimes(2)

    // WhatsApp job has phoneNumberId in data
    const waCall = mockQueueAdd.mock.calls.find(
      ([name]) => name === "coexistWhatsappFlush",
    )
    expect(waCall).toBeDefined()
    expect(waCall?.[1].data).toMatchObject({
      phoneNumberId: "phone-wa",
      runId: "run-wa-1",
    })

    // Messenger job has integrationId + workspaceId, no phoneNumberId
    const msCall = mockQueueAdd.mock.calls.find(
      ([name]) => name === "coexistMessengerSync",
    )
    expect(msCall).toBeDefined()
    expect(msCall?.[1].data).toMatchObject({
      integrationId: "int-ms-1",
      workspaceId: "ws-2",
      runId: "run-ms-1",
    })
    expect(msCall?.[1].data).not.toHaveProperty("phoneNumberId")
  })

  it("(e.2) WhatsApp run with missing phoneNumberId is marked failed, not enqueued", async () => {
    mockCapUpdate()
    mockPickRows([waRun])
    // Integration exists but phoneNumberId is null
    mockFindMany.mockResolvedValue([{ id: "int-wa-1", phoneNumberId: null }])
    // The per-run failure UPDATE
    mockExecute.mockResolvedValue({ rows: [] })

    await scanCoexistRuns()

    expect(mockQueueAdd).not.toHaveBeenCalled()
    // Three total execute calls: cap + pick + failure update for missing phoneNumberId
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })

  it("(e.3) WhatsApp run with missing integration is marked failed, not enqueued", async () => {
    mockCapUpdate()
    mockPickRows([waRun])
    // findMany returns empty — integration not found
    mockFindMany.mockResolvedValue([])
    mockExecute.mockResolvedValue({ rows: [] })

    await scanCoexistRuns()

    expect(mockQueueAdd).not.toHaveBeenCalled()
  })

  it("no-op when pick query returns empty rows", async () => {
    mockCapUpdate()
    mockPickRows([])

    await scanCoexistRuns()

    expect(mockQueueAdd).not.toHaveBeenCalled()
    expect(mockFindFirst).not.toHaveBeenCalled()
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("enqueue error is caught per-run and does not abort remaining runs", async () => {
    mockCapUpdate()
    mockPickRows([msRun, { ...msRun, id: "run-ms-2", attempts: 1 }])
    mockQueueAdd
      .mockRejectedValueOnce(new Error("Redis down"))
      .mockResolvedValueOnce(undefined)

    await expect(scanCoexistRuns()).resolves.not.toThrow()
    // Second run still attempted
    expect(mockQueueAdd).toHaveBeenCalledTimes(2)
  })

  it("(H6) multiple whatsapp runs execute ONE findMany batch, not N findFirst calls", async () => {
    const waRun2 = {
      id: "run-wa-2",
      attempts: 1,
      channel: "whatsapp" as const,
      integrationId: "int-wa-2",
      workspaceId: "ws-1",
    }
    mockCapUpdate()
    mockPickRows([waRun, waRun2])
    mockRunUpdate()
    // findMany returns both integrations in a single call
    mockFindMany.mockResolvedValue([
      { id: "int-wa-1", phoneNumberId: "phone-111" },
      { id: "int-wa-2", phoneNumberId: "phone-222" },
    ])
    mockQueueAdd.mockResolvedValue(undefined)

    await scanCoexistRuns()

    // findMany called exactly ONCE (batch), findFirst never called
    expect(mockFindMany).toHaveBeenCalledTimes(1)
    expect(mockFindFirst).not.toHaveBeenCalled()

    // Both runs enqueued with correct phoneNumberIds
    expect(mockQueueAdd).toHaveBeenCalledTimes(2)
    const calls = mockQueueAdd.mock.calls.map(([, payload]) => payload.data)
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runId: "run-wa-1",
          phoneNumberId: "phone-111",
        }),
        expect.objectContaining({
          runId: "run-wa-2",
          phoneNumberId: "phone-222",
        }),
      ]),
    )
  })

  it("(H6.2) whatsapp run whose integration is absent in findMany batch is marked failed", async () => {
    mockCapUpdate()
    mockPickRows([waRun])
    // findMany returns empty — no matching integration
    mockFindMany.mockResolvedValue([])
    mockExecute.mockResolvedValue({ rows: [] })

    await scanCoexistRuns()

    expect(mockQueueAdd).not.toHaveBeenCalled()
    // cap + pick + failure update = 3 execute calls
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })
})
