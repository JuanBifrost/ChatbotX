import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(async () => ({
    contact: { id: "contact-1", email: "a@example.com" },
    contactInbox: null,
    conversation: null,
    customFieldsMap: new Map(),
    workspace: null,
  })),
  getSystemFieldValue: vi.fn(async () => null as string | null),
  buildJavascriptSandboxInput: vi.fn(async (code: string) => ({
    code,
    input: {} as Record<string, unknown>,
  })),
  executeAndMap: vi.fn(async () => ({ value: null })),
}))

vi.mock("@chatbotx.io/variables", () => ({
  contactVariableService: { getAll: mocks.getAll },
  getSystemFieldValue: mocks.getSystemFieldValue,
  buildJavascriptSandboxInput: mocks.buildJavascriptSandboxInput,
  extractVariables: vi.fn(() => []),
  interpolate: vi.fn((text: string) => text),
  resolveContactVariablesDeep: vi.fn(
    async (_id: string, value: unknown) => value,
  ),
}))

vi.mock("@chatbotx.io/business/javascript-execution", () => ({
  javascriptExecutionService: { executeAndMap: mocks.executeAndMap },
}))

const { handleExecuteJavascript } = await import(
  "../src/integration/handlers/tool-handler"
)

const createProps = () =>
  ({
    contactInbox: null,
    conversation: {
      id: "conversation-1",
      workspaceId: "workspace-1",
      contactId: "contact-1",
    },
    step: {
      id: "step-1",
      stepType: "executeJavascript",
      code: "return input.first_name",
      customFieldId: "field-1",
      mapping: [],
      states: [],
    },
  }) as Parameters<typeof handleExecuteJavascript>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getAll.mockResolvedValue({
    contact: { id: "contact-1", email: "a@example.com" },
    contactInbox: null,
    conversation: null,
    customFieldsMap: new Map(),
    workspace: null,
  })
  mocks.getSystemFieldValue.mockResolvedValue(null)
  mocks.buildJavascriptSandboxInput.mockImplementation(async (code: string) => ({
    code,
    input: {},
  }))
  mocks.executeAndMap.mockResolvedValue({ value: null })
})

describe("handleExecuteJavascript", () => {
  test("sends the sandbox payload from buildJavascriptSandboxInput to executeAndMap", async () => {
    const rewrittenCode =
      'return ("" + input["fullname upper"] + " ").toLowerCase();'
    mocks.buildJavascriptSandboxInput.mockResolvedValue({
      code: rewrittenCode,
      input: { "fullname upper": "MÁ CHÁN" },
    })

    const props = createProps()
    await handleExecuteJavascript(props)

    expect(mocks.buildJavascriptSandboxInput).toHaveBeenCalledWith(
      props.step.code,
      expect.objectContaining({ contact: expect.anything() }),
    )
    expect(mocks.executeAndMap).toHaveBeenCalledTimes(1)
    const call = mocks.executeAndMap.mock.calls[0]?.[0] as {
      code: string
      input: Record<string, unknown>
      mapping: { jsonPath: string; outputFieldId: string }[]
    }
    expect(call.code).toBe(rewrittenCode)
    expect(call.input["fullname upper"]).toBe("MÁ CHÁN")
    expect(call.mapping).toEqual([])
  })

  test("forwards the step JSON-path mapping to executeAndMap", async () => {
    const props = createProps()
    props.step.mapping = [
      { jsonPath: "latitude", outputFieldId: "field-lat" },
      { jsonPath: "longitude", outputFieldId: "field-lng" },
    ]
    await handleExecuteJavascript(props)

    const call = mocks.executeAndMap.mock.calls[0]?.[0] as {
      mapping: { jsonPath: string; outputFieldId: string }[]
    }
    expect(call.mapping).toEqual(props.step.mapping)
  })

  test("returns a success result on successful execution", async () => {
    await expect(handleExecuteJavascript(createProps())).resolves.toEqual({
      status: "success",
      result: null,
    })
  })

  test("returns an error result with the message when an Error is thrown", async () => {
    mocks.executeAndMap.mockRejectedValue(new Error("execution failed"))

    await expect(handleExecuteJavascript(createProps())).resolves.toEqual({
      status: "error",
      errorMessage: "execution failed",
      result: null,
    })
  })

  test("returns a generic error result when a non-Error value is thrown", async () => {
    mocks.executeAndMap.mockRejectedValue("some string failure")

    await expect(handleExecuteJavascript(createProps())).resolves.toEqual({
      status: "error",
      errorMessage: "JavaScript execution failed",
      result: null,
    })
  })

  test("routes an output type mismatch to the error result with its actionable message", async () => {
    // executeAndMap throws a ChatbotXException (which extends Error) when
    // the sandbox's result doesn't fit the output field's declared type —
    // this proves that failure reaches the step's error branch instead of
    // being swallowed or reported as a generic success.
    mocks.executeAndMap.mockRejectedValue(
      new Error(
        'JavaScript returned "Abcd 123", which is not a valid number value for the output field "Age".',
      ),
    )

    await expect(handleExecuteJavascript(createProps())).resolves.toEqual({
      status: "error",
      errorMessage:
        'JavaScript returned "Abcd 123", which is not a valid number value for the output field "Age".',
      result: null,
    })
  })

  test("forwards contact variables from getAll into buildJavascriptSandboxInput", async () => {
    const variables = {
      contact: { id: "contact-1", email: "a@example.com" },
      contactInbox: null,
      conversation: null,
      customFieldsMap: new Map([
        ["age", { key: "age", type: "number", value: "30", description: "" }],
      ]),
      workspace: null,
    }
    mocks.getAll.mockResolvedValue(variables)

    const props = createProps()
    await handleExecuteJavascript(props)

    expect(mocks.buildJavascriptSandboxInput).toHaveBeenCalledWith(
      props.step.code,
      variables,
    )
  })
})

// The suite above mocks @chatbotx.io/variables entirely, so it only pins the
// WIRING between the handler and buildJavascriptSandboxInput — not the
// sandbox payload itself. That coverage lives in
// packages/variables/__tests__/interpolate-into-javascript.test.ts.
