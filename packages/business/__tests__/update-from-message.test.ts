import { beforeEach, describe, expect, test, vi } from "vitest"

const { mockFindFirstWorkspace, mockUpdate, mockSet, mockWhere } = vi.hoisted(
  () => ({
    mockFindFirstWorkspace: vi.fn(),
    mockUpdate: vi.fn(),
    mockSet: vi.fn(),
    mockWhere: vi.fn(),
  }),
)

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    update: mockUpdate,
    query: {
      workspaceModel: { findFirst: mockFindFirstWorkspace },
    },
  },
  and: vi.fn((...args: unknown[]) => ({ __and: args })),
  eq: vi.fn(),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  contactModel: {
    id: "id",
    phoneNumber: "phoneNumber",
    email: "email",
    workspaceId: "workspaceId",
  },
}))

import { updateContactFromMessage } from "../src/contact/update-from-message"

beforeEach(() => {
  vi.clearAllMocks()
  mockFindFirstWorkspace.mockResolvedValue({ targetCountry: "VN" })
  mockSet.mockReturnValue({ where: mockWhere })
  mockWhere.mockResolvedValue(undefined)
  mockUpdate.mockReturnValue({ set: mockSet })
})

describe("updateContactFromMessage", () => {
  test("no-ops on empty text — no workspace lookup, no update", async () => {
    const result = await updateContactFromMessage({
      contactId: "c1",
      workspaceId: "w1",
      text: "",
    })
    expect(result).toEqual({})
    expect(mockFindFirstWorkspace).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test("no-ops on null text", async () => {
    const result = await updateContactFromMessage({
      contactId: "c1",
      workspaceId: "w1",
      text: null,
    })
    expect(result).toEqual({})
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test("phone-only message → updates phoneNumber only", async () => {
    const result = await updateContactFromMessage({
      contactId: "c1",
      workspaceId: "w1",
      text: "call me at 0912345678",
    })
    expect(result).toEqual({ phoneNumber: "+84912345678" })
    expect(mockSet).toHaveBeenCalledWith({ phoneNumber: "+84912345678" })
  })

  test("email-only message → updates email only", async () => {
    const result = await updateContactFromMessage({
      contactId: "c1",
      workspaceId: "w1",
      text: "reach me at jane@acme.com",
    })
    expect(result).toEqual({ email: "jane@acme.com" })
    expect(mockSet).toHaveBeenCalledWith({ email: "jane@acme.com" })
  })

  test("both phone + email → single UPDATE with both fields", async () => {
    const result = await updateContactFromMessage({
      contactId: "c1",
      workspaceId: "w1",
      text: "phone 0912345678 mail jane@acme.com",
    })
    expect(result).toEqual({
      phoneNumber: "+84912345678",
      email: "jane@acme.com",
    })
    expect(mockSet).toHaveBeenCalledOnce()
    expect(mockSet).toHaveBeenCalledWith({
      phoneNumber: "+84912345678",
      email: "jane@acme.com",
    })
  })

  test("no extraction match → no UPDATE", async () => {
    const result = await updateContactFromMessage({
      contactId: "c1",
      workspaceId: "w1",
      text: "hello how are you today",
    })
    expect(result).toEqual({})
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  test("missing workspace.targetCountry falls back to extractor defaults", async () => {
    mockFindFirstWorkspace.mockResolvedValueOnce(undefined)
    const result = await updateContactFromMessage({
      contactId: "c1",
      workspaceId: "w1",
      text: "ring +84 912 345 678",
    })
    expect(result.phoneNumber).toBe("+84912345678")
    expect(mockSet).toHaveBeenCalledWith({ phoneNumber: "+84912345678" })
  })

  test("overwrites unconditionally — no SELECT before UPDATE", async () => {
    // No call to findFirst(contactModel) anywhere — only workspace lookup.
    await updateContactFromMessage({
      contactId: "c1",
      workspaceId: "w1",
      text: "new number 0912345678",
    })
    expect(mockFindFirstWorkspace).toHaveBeenCalledOnce()
    expect(mockSet).toHaveBeenCalledWith({ phoneNumber: "+84912345678" })
  })

  test("channel-agnostic: same call shape works for any caller (no channel arg)", async () => {
    // The helper takes no channel param — callers from messenger, whatsapp,
    // telegram, zalo, webchat all invoke it the same way. Asserting the
    // surface (3 props only) is what every channel touches it with.
    const props = {
      contactId: "c1",
      workspaceId: "w1",
      text: "ping 0912345678",
    }
    await updateContactFromMessage(props)
    expect(mockSet).toHaveBeenCalledWith({ phoneNumber: "+84912345678" })
  })
})
