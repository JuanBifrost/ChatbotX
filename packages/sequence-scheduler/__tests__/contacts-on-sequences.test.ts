import { beforeEach, describe, expect, test, vi } from "vitest"

const findManyInboxMock = vi.fn()
const findManyContactInboxMock = vi.fn()
const cancelPendingDispatchesMock = vi.fn()
const findManyContactsOnSeqMock = vi.fn()
const deleteWhereMock = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      inboxModel: { findMany: findManyInboxMock },
      contactInboxModel: { findMany: findManyContactInboxMock },
    },
  },
  inArray: (c: unknown, v: unknown) => ({ __inArray: [c, v] }),
}))

vi.mock("@chatbotx.io/database/schema", () => ({
  contactsOnSequenceModel: { id: "__contactsOnSequenceModel.id" },
}))

vi.mock("../src/dispatch-manager", () => ({
  cancelPendingDispatches: cancelPendingDispatchesMock,
}))

// Reusable mock db client with methods used in bulkRemoveIds and getAllSequenceIds
const mockDbClient = {
  query: {
    contactsOnSequenceModel: {
      findMany: findManyContactsOnSeqMock,
    },
  },
  delete: () => ({ where: deleteWhereMock }),
} as never

beforeEach(() => {
  findManyInboxMock.mockResolvedValue([])
  findManyContactInboxMock.mockResolvedValue([])
  cancelPendingDispatchesMock.mockResolvedValue([])
  findManyContactsOnSeqMock.mockResolvedValue([])
  deleteWhereMock.mockResolvedValue(undefined)
})

describe("calculateSequenceDiff", () => {
  test("returns empty toAdd and toRemove when both current and new are empty", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )

    const result = contactsOnSequencesUtils.calculateSequenceDiff([], [])

    expect(result).toEqual({ toAdd: [], toRemove: [] })
  })

  test("returns all new ids in toAdd and empty toRemove when current is empty", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )

    const result = contactsOnSequencesUtils.calculateSequenceDiff(
      [],
      ["seq-1", "seq-2"],
    )

    expect(result.toAdd).toEqual(expect.arrayContaining(["seq-1", "seq-2"]))
    expect(result.toAdd).toHaveLength(2)
    expect(result.toRemove).toEqual([])
  })

  test("returns empty toAdd and all current ids in toRemove when new is empty", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )

    const result = contactsOnSequencesUtils.calculateSequenceDiff(
      ["seq-a", "seq-b"],
      [],
    )

    expect(result.toAdd).toEqual([])
    expect(result.toRemove).toEqual(expect.arrayContaining(["seq-a", "seq-b"]))
    expect(result.toRemove).toHaveLength(2)
  })

  test("returns empty toAdd and toRemove when current and new are identical", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )

    const result = contactsOnSequencesUtils.calculateSequenceDiff(
      ["seq-1", "seq-2"],
      ["seq-1", "seq-2"],
    )

    expect(result).toEqual({ toAdd: [], toRemove: [] })
  })

  test("returns disjoint toAdd and toRemove for completely different sets", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )

    const result = contactsOnSequencesUtils.calculateSequenceDiff(
      ["old-1", "old-2"],
      ["new-1", "new-2"],
    )

    expect(result.toAdd).toEqual(expect.arrayContaining(["new-1", "new-2"]))
    expect(result.toRemove).toEqual(expect.arrayContaining(["old-1", "old-2"]))
  })

  test("returns only the non-overlapping delta for partially overlapping sets", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )

    // seq-keep is shared, seq-old is removed, seq-new is added
    const result = contactsOnSequencesUtils.calculateSequenceDiff(
      ["seq-keep", "seq-old"],
      ["seq-keep", "seq-new"],
    )

    expect(result.toAdd).toEqual(["seq-new"])
    expect(result.toRemove).toEqual(["seq-old"])
  })

  test("deduplicates duplicate ids in the inputs", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )

    const result = contactsOnSequencesUtils.calculateSequenceDiff(
      ["seq-1", "seq-1"],
      ["seq-2", "seq-2"],
    )

    expect(result.toAdd).toEqual(["seq-2"])
    expect(result.toRemove).toEqual(["seq-1"])
  })
})

describe("getAllSequenceIds", () => {
  test("returns an array of sequenceId strings from the rows", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )
    findManyContactsOnSeqMock.mockResolvedValue([
      { sequenceId: "seq-1" },
      { sequenceId: "seq-2" },
    ])

    const result = await contactsOnSequencesUtils.getAllSequenceIds(
      mockDbClient,
      { contactId: "contact-1" },
    )

    expect(result).toEqual(["seq-1", "seq-2"])
  })

  test("returns an empty array when no sequences are found", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )
    findManyContactsOnSeqMock.mockResolvedValue([])

    const result = await contactsOnSequencesUtils.getAllSequenceIds(
      mockDbClient,
      { contactId: "contact-1" },
    )

    expect(result).toEqual([])
  })
})

describe("bulkRemoveIds", () => {
  test("returns immediately without any db call when sequenceIds is empty", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )

    await contactsOnSequencesUtils.bulkRemoveIds(mockDbClient, "contact-1", [])

    expect(findManyContactsOnSeqMock).not.toHaveBeenCalled()
    expect(cancelPendingDispatchesMock).not.toHaveBeenCalled()
    expect(deleteWhereMock).not.toHaveBeenCalled()
  })

  test("returns without deleting when no enrollments match the sequenceIds", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )
    findManyContactsOnSeqMock.mockResolvedValue([])

    await contactsOnSequencesUtils.bulkRemoveIds(mockDbClient, "contact-1", [
      "seq-1",
    ])

    expect(cancelPendingDispatchesMock).not.toHaveBeenCalled()
    expect(deleteWhereMock).not.toHaveBeenCalled()
  })

  test("calls cancelPendingDispatches once per enrollment then deletes all", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )
    const enrollments = [
      {
        id: "enroll-1",
        workspaceId: "ws-1",
        sequenceId: "seq-1",
        contactId: "c-1",
      },
      {
        id: "enroll-2",
        workspaceId: "ws-1",
        sequenceId: "seq-2",
        contactId: "c-1",
      },
    ]
    findManyContactsOnSeqMock.mockResolvedValue(enrollments)

    await contactsOnSequencesUtils.bulkRemoveIds(mockDbClient, "c-1", [
      "seq-1",
      "seq-2",
    ])

    expect(cancelPendingDispatchesMock).toHaveBeenCalledTimes(2)
    expect(cancelPendingDispatchesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: "enroll-1",
        workspaceId: "ws-1",
      }),
    )
    expect(cancelPendingDispatchesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: "enroll-2",
        workspaceId: "ws-1",
      }),
    )
    expect(deleteWhereMock).toHaveBeenCalledTimes(1)
  })

  test("passes the reason 'enrollment_removed' to cancelPendingDispatches", async () => {
    const { contactsOnSequencesUtils } = await import(
      "../src/contacts-on-sequences"
    )
    findManyContactsOnSeqMock.mockResolvedValue([
      {
        id: "enroll-1",
        workspaceId: "ws-1",
        sequenceId: "seq-1",
        contactId: "c-1",
      },
    ])

    await contactsOnSequencesUtils.bulkRemoveIds(mockDbClient, "c-1", ["seq-1"])

    expect(cancelPendingDispatchesMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "enrollment_removed" }),
    )
  })
})

describe("getContactInboxes", () => {
  test("returns contact inboxes matching workspace inboxes", async () => {
    const { getContactInboxes } = await import("../src/contacts-on-sequences")
    findManyInboxMock.mockResolvedValue([{ id: "inbox-1" }, { id: "inbox-2" }])
    const fakeContactInboxes = [
      { id: "ci-1", contactId: "contact-1", inboxId: "inbox-1" },
    ]
    findManyContactInboxMock.mockResolvedValue(fakeContactInboxes)

    const result = await getContactInboxes("ws-1", "contact-1")

    expect(result).toEqual(fakeContactInboxes)
  })

  test("returns empty array when no inboxes exist in the workspace", async () => {
    const { getContactInboxes } = await import("../src/contacts-on-sequences")
    findManyInboxMock.mockResolvedValue([])
    findManyContactInboxMock.mockResolvedValue([])

    const result = await getContactInboxes("ws-1", "contact-1")

    expect(result).toEqual([])
  })

  test("queries inboxModel scoped by workspaceId", async () => {
    const { getContactInboxes } = await import("../src/contacts-on-sequences")
    findManyInboxMock.mockResolvedValue([])
    findManyContactInboxMock.mockResolvedValue([])

    await getContactInboxes("my-workspace", "contact-1")

    expect(findManyInboxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "my-workspace" }),
      }),
    )
  })

  test("queries contactInboxModel scoped by contactId", async () => {
    const { getContactInboxes } = await import("../src/contacts-on-sequences")
    findManyInboxMock.mockResolvedValue([{ id: "inbox-99" }])
    findManyContactInboxMock.mockResolvedValue([])

    await getContactInboxes("ws-1", "my-contact")

    expect(findManyContactInboxMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contactId: "my-contact" }),
      }),
    )
  })
})
