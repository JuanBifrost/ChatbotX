import { beforeEach, describe, expect, test, vi } from "vitest"

const PRIVATE_LOCK_KEY_PATTERN =
  /^drip:sync-subscriber:[a-f0-9]{64}:[a-f0-9]{64}$/

const state = {
  auth: { authType: "custom", apiToken: "secret-token" },
  fields: {} as Record<string, string>,
}

type LockProps = {
  key: string
  timeoutInSeconds: number
  fn: () => Promise<void>
}

const runAction = vi.fn(async () => undefined)
const runExclusive = vi.fn(async (props: LockProps) => await props.fn())

vi.mock("@chatbotx.io/business", () => ({
  buildContext: vi.fn(async ({ integration }: { integration: unknown }) => ({
    auth: state.auth,
    integration,
  })),
  integrationDripService: {
    findByWorkspaceIdOrFail: vi.fn(async () => ({ auth: "encrypted" })),
  },
}))

vi.mock("@chatbotx.io/encryption", () => ({
  encryptedDataSchema: { parse: vi.fn((value: unknown) => value) },
  encryptUtils: {
    decryptObject: vi.fn(async () => state.auth),
  },
}))

vi.mock("@chatbotx.io/integration-drip", () => ({
  DRIP_HTTP_TIMEOUT_MS: 15_000,
  dripAuthSchema: {},
  integration: { runAction },
}))

vi.mock("@chatbotx.io/redis", () => ({
  distributedLock: { runExclusive },
}))

vi.mock("../src/integration/handlers/contact-field-map", () => ({
  getContactFieldMap: vi.fn(async () => state.fields),
}))

vi.mock("../src/lib/logger", () => ({
  logger: { error: vi.fn() },
}))

const { subscribeDripSubscriber } = await import(
  "../src/integration/handlers/drip-handler"
)

const createProps = () =>
  ({
    conversation: {
      id: "conversation-1",
      workspaceId: "workspace-1",
      contactId: "contact-1",
    },
    step: {
      id: "step-1",
      accountId: "123",
      emailField: "email",
      phoneField: "phone",
      tags: ["vip"],
      mergeFields: [{ contactFieldId: "company", dripField: "company_name" }],
    },
  }) as Parameters<typeof subscribeDripSubscriber>[0]

beforeEach(() => {
  state.fields = {
    email: " Person@Example.COM ",
    phone: " 123 ",
    first_name: " Ada ",
    last_name: " Lovelace ",
    company: " Analytical Engines ",
  }
  vi.clearAllMocks()
  runAction.mockResolvedValue(undefined)
  runExclusive.mockImplementation(async (props: LockProps) => await props.fn())
})

describe("subscribeDripSubscriber", () => {
  test("normalizes the payload and serializes without exposing account or email", async () => {
    await expect(subscribeDripSubscriber(createProps())).resolves.toEqual({
      status: "success",
      result: null,
    })

    expect(runAction).toHaveBeenCalledWith("syncSubscriber", {
      ctx: expect.any(Object),
      props: {
        accountId: "123",
        email: "person@example.com",
        first_name: "Ada",
        last_name: "Lovelace",
        phone: "123",
        tags: ["vip"],
        custom_fields: { company_name: "Analytical Engines" },
      },
    })

    const lockKey = runExclusive.mock.calls[0]?.[0].key
    expect(lockKey).toMatch(PRIVATE_LOCK_KEY_PATTERN)
    expect(lockKey).not.toContain(":123:")
    expect(lockKey).not.toContain("person@example.com")
  })

  test("returns the error state without calling Drip when email is empty", async () => {
    state.fields.email = " "

    await expect(subscribeDripSubscriber(createProps())).resolves.toEqual({
      status: "error",
      errorMessage: "Drip subscriber email is empty",
      result: null,
    })
    expect(runExclusive).not.toHaveBeenCalled()
    expect(runAction).not.toHaveBeenCalled()
  })
})
