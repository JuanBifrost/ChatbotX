import { decodeButtonPayload } from "@chatbotx.io/flow-config"
import { beforeEach, describe, expect, test, vi } from "vitest"

const { mockGetWhatsappClient, mockSendMessage, mockLogger } = vi.hoisted(
  () => {
    const sendMessage = vi.fn()
    return {
      mockGetWhatsappClient: vi.fn(() => ({ sendMessage })),
      mockSendMessage: sendMessage,
      mockLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    }
  },
)

vi.mock("../src/client", () => ({
  getWhatsappClient: mockGetWhatsappClient,
}))

vi.mock("../src/lib/logger", () => ({
  logger: mockLogger,
}))

const { sendFlowStep } = await import(
  "../src/handlers/message/outgoing-message"
)

const FLOW_ID = "1000000000001"
const FLOW_VERSION_ID = "1000000000002"
const BUTTON_ID = "1000000000010"
const PHONE_NUMBER_ID = "pn-1"
const META_FLOW_ID = "wa-flow-source"

const ctx = {
  auth: { metadata: { phoneNumber: { id: PHONE_NUMBER_ID } } },
} as never

const contact = { id: "contact-1", sourceId: "84123456789" } as never

const gpsCurrent = {
  id: "gps_current",
  title: "Enviar mi ubicación actual",
  description: "Compartir GPS por WhatsApp",
}

const makeStep = (actionData?: Record<string, unknown> | null) => ({
  id: "step-1",
  stepType: "whatsappFlow",
  text: "Elige tu punto de recogida",
  buttons: [
    {
      id: BUTTON_ID,
      label: "Elegir dirección",
      buttonType: null,
      beforeStep: null,
      steps: [],
    },
  ],
  inboxId: null,
  flow: {
    id: "1",
    sourceId: META_FLOW_ID,
    startScreenId: "ELEGIR_DIRECCION",
    fieldMappings: [],
    ...(actionData === undefined ? {} : { actionData }),
  },
})

const sendWhatsappFlow = (actionData?: Record<string, unknown> | null) =>
  sendFlowStep({
    ctx,
    data: {
      contact,
      flowId: FLOW_ID,
      flowVersionId: FLOW_VERSION_ID,
      step: makeStep(actionData),
    },
  } as never)

type FlowActionParameters = {
  flow_token?: string
  flow_id?: string
  flow_cta?: string
  flow_action?: string
  flow_action_payload?: {
    screen?: string
    data?: {
      direcciones?: Array<{ id: string; title: string }>
      nombre?: string
    }
  }
}

const lastInteractive = () =>
  mockSendMessage.mock.lastCall?.[2] as {
    type?: string
    action?: { name?: string; parameters?: FlowActionParameters }
  }

describe("WhatsApp sendFlowStep — whatsappFlow action data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSendMessage.mockResolvedValue({
      messaging_product: "whatsapp",
      messages: [{ id: "wamid.flow-1" }],
    })
  })

  test("sends only the start screen when actionData is omitted", async () => {
    await sendWhatsappFlow()

    const parameters = lastInteractive().action?.parameters
    expect(lastInteractive()).toMatchObject({ type: "flow" })
    expect(parameters?.flow_action_payload).toEqual({
      screen: "ELEGIR_DIRECCION",
    })
    expect(parameters?.flow_action_payload).not.toHaveProperty("data")
  })

  test("includes three saved addresses plus gps_current", async () => {
    await sendWhatsappFlow({
      nombre: "Juan",
      direcciones: [
        { id: "1555732", title: "Oficinas Bifrost" },
        { id: "1387087", title: "Oficinas Bifrost 3" },
        { id: "1356258", title: "TIMANA" },
        gpsCurrent,
      ],
    })

    expect(
      lastInteractive().action?.parameters?.flow_action_payload?.data
        ?.direcciones,
    ).toHaveLength(4)
  })

  test("drops empty address slots and keeps gps_current", async () => {
    await sendWhatsappFlow({
      nombre: "Juan",
      direcciones: [
        { id: "1555732", title: "Oficinas Bifrost" },
        { id: "", title: "{{address_text_1}}" },
        { id: "{{address_id_2}}", title: "{{address_text_2}}" },
        gpsCurrent,
      ],
    })

    expect(
      lastInteractive().action?.parameters?.flow_action_payload?.data
        ?.direcciones,
    ).toEqual([{ id: "1555732", title: "Oficinas Bifrost" }, gpsCurrent])
  })

  test("sends only gps_current when no saved addresses resolve", async () => {
    await sendWhatsappFlow({
      nombre: "Nuevo",
      direcciones: [
        { id: "", title: "{{address_text_0}}" },
        { id: "{{address_id_1}}", title: "{{address_text_1}}" },
        gpsCurrent,
      ],
    })

    expect(
      lastInteractive().action?.parameters?.flow_action_payload?.data
        ?.direcciones,
    ).toEqual([gpsCurrent])
  })

  test("uses a ChatbotX-encoded flow_token, not a free-form string", async () => {
    await sendWhatsappFlow()

    const flowToken = lastInteractive().action?.parameters?.flow_token
    expect(flowToken).not.toBe("prueba-juan-001")
    expect(decodeButtonPayload(flowToken ?? "")).toEqual({
      flowId: FLOW_ID,
      flowVersionId: FLOW_VERSION_ID,
      buttonId: BUTTON_ID,
    })
  })
})
