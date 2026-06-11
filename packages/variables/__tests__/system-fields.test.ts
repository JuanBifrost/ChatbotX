import { systemFieldTypes } from "@chatbotx.io/database/partials"
import type { ContactModel } from "@chatbotx.io/database/types"
import { describe, expect, test, vi } from "vitest"

const { mockFindLatestContactLastReadAt, mockFindLatestLastIncomingMessageAt } =
  vi.hoisted(() => ({
    mockFindLatestContactLastReadAt: vi.fn(),
    mockFindLatestLastIncomingMessageAt: vi.fn(),
  }))

vi.mock("@chatbotx.io/business", () => ({
  contactInboxService: {
    findLatestContactLastReadAtByContactId: mockFindLatestContactLastReadAt,
    findLatestLastIncomingMessageAtByContactId:
      mockFindLatestLastIncomingMessageAt,
  },
}))

const { getSystemFieldValue } = await import("../src/utils")

const contact = {
  id: "contact-1",
  workspaceId: "workspace-1",
  timezone: "UTC",
} as ContactModel

describe("getSystemFieldValue", () => {
  test("last_seen uses the latest contact inbox read timestamp", async () => {
    mockFindLatestContactLastReadAt.mockResolvedValue(
      new Date("2026-01-02T03:04:05.000Z"),
    )

    await expect(
      getSystemFieldValue(contact, systemFieldTypes.enum.last_seen),
    ).resolves.toBe("2026-01-02")
    expect(mockFindLatestContactLastReadAt).toHaveBeenCalledWith({
      contactId: "contact-1",
    })
  })

  test("last_interaction uses the latest inbound contact inbox timestamp", async () => {
    mockFindLatestLastIncomingMessageAt.mockResolvedValue(
      new Date("2026-01-02T03:04:05.000Z"),
    )

    await expect(
      getSystemFieldValue(contact, systemFieldTypes.enum.last_interaction),
    ).resolves.toBe("2026-01-02 03:04:05")
    expect(mockFindLatestLastIncomingMessageAt).toHaveBeenCalledWith({
      contactId: "contact-1",
    })
  })

  test("last_seen and last_interaction return null when no inbox timestamp exists", async () => {
    mockFindLatestContactLastReadAt.mockResolvedValue(null)
    mockFindLatestLastIncomingMessageAt.mockResolvedValue(null)

    await expect(
      getSystemFieldValue(contact, systemFieldTypes.enum.last_seen),
    ).resolves.toBeNull()
    await expect(
      getSystemFieldValue(contact, systemFieldTypes.enum.last_interaction),
    ).resolves.toBeNull()
  })

  test("last_seen formats using the contact timezone", async () => {
    mockFindLatestContactLastReadAt.mockResolvedValue(
      new Date("2026-01-01T23:30:00.000Z"),
    )

    await expect(
      getSystemFieldValue(
        { ...contact, timezone: "Asia/Ho_Chi_Minh" } as ContactModel,
        systemFieldTypes.enum.last_seen,
      ),
    ).resolves.toBe("2026-01-02")
  })

  test("last_interaction formats date and time using the contact timezone", async () => {
    mockFindLatestLastIncomingMessageAt.mockResolvedValue(
      new Date("2026-01-01T23:30:00.000Z"),
    )

    await expect(
      getSystemFieldValue(
        { ...contact, timezone: "Asia/Ho_Chi_Minh" } as ContactModel,
        systemFieldTypes.enum.last_interaction,
      ),
    ).resolves.toBe("2026-01-02 06:30:00")
  })

  test("last_seen and last_interaction fall back to UTC when timezone is null", async () => {
    const utcContact = { ...contact, timezone: null } as ContactModel
    mockFindLatestContactLastReadAt.mockResolvedValue(
      new Date("2026-01-01T23:30:00.000Z"),
    )
    mockFindLatestLastIncomingMessageAt.mockResolvedValue(
      new Date("2026-01-01T23:30:00.000Z"),
    )

    await expect(
      getSystemFieldValue(utcContact, systemFieldTypes.enum.last_seen),
    ).resolves.toBe("2026-01-01")
    await expect(
      getSystemFieldValue(utcContact, systemFieldTypes.enum.last_interaction),
    ).resolves.toBe("2026-01-01 23:30:00")
  })
})
