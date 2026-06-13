// @vitest-environment node

import { beforeEach, describe, expect, test, vi } from "vitest"

const { removeContactSequencesForContactsSpy } = vi.hoisted(() => ({
  removeContactSequencesForContactsSpy: vi.fn(),
}))

vi.mock("@/lib/safe-action", () => {
  const chain: Record<string, unknown> = {}
  chain.bindArgsSchemas = () => chain
  chain.inputSchema = () => chain
  chain.action = (fn: unknown) => fn
  return { workspaceActionClient: chain }
})

vi.mock("@chatbotx.io/business/contact-sequence", () => ({
  contactSequenceService: {
    removeContactSequencesForContacts: removeContactSequencesForContactsSpy,
  },
}))

const { removeContactSequenceAction } = await import(
  "../src/features/contacts/actions/remove-contact-sequence.action"
)

type ActionHandler = (args: {
  bindArgsParsedInputs: [string]
  parsedInput: { ids: string[]; sequences: string[] }
}) => Promise<unknown>

const callAction = removeContactSequenceAction as unknown as ActionHandler
const WORKSPACE_ID = "ws-1"

describe("removeContactSequenceAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    removeContactSequencesForContactsSpy.mockResolvedValue(undefined)
  })

  test("delegates sequence removal to the business service", async () => {
    await callAction({
      bindArgsParsedInputs: [WORKSPACE_ID],
      parsedInput: { ids: ["contact-1"], sequences: ["sequence-1"] },
    })

    expect(removeContactSequencesForContactsSpy).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      contactIds: ["contact-1"],
      sequenceIds: ["sequence-1"],
      reason: "enrollment_removed",
    })
  })

  test("chunks contact ids before delegating to the business service", async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `contact-${index}`)

    await callAction({
      bindArgsParsedInputs: [WORKSPACE_ID],
      parsedInput: { ids, sequences: ["sequence-1"] },
    })

    expect(removeContactSequencesForContactsSpy).toHaveBeenCalledTimes(2)
    expect(removeContactSequencesForContactsSpy).toHaveBeenNthCalledWith(1, {
      workspaceId: WORKSPACE_ID,
      contactIds: ids.slice(0, 1000),
      sequenceIds: ["sequence-1"],
      reason: "enrollment_removed",
    })
    expect(removeContactSequencesForContactsSpy).toHaveBeenNthCalledWith(2, {
      workspaceId: WORKSPACE_ID,
      contactIds: ids.slice(1000),
      sequenceIds: ["sequence-1"],
      reason: "enrollment_removed",
    })
  })
})
