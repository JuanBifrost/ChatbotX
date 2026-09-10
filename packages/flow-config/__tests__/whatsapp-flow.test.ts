import { describe, expect, test } from "vitest"
import {
  parseWhatsappFlowActionDataJson,
  sanitizeWhatsappFlowActionData,
  stringifyWhatsappFlowActionData,
  whatsappFlowStepDefaultFn,
  whatsappFlowStepSchema,
} from "../src"

const gpsCurrent = {
  id: "gps_current",
  title: "Enviar mi ubicación actual",
  description: "Compartir GPS por WhatsApp",
}

describe("whatsappFlow actionData contract", () => {
  test("defaults include a null actionData payload", () => {
    const value = whatsappFlowStepDefaultFn()
    expect(value.flow.actionData).toBeNull()
  })

  test("accepts a published step that has no actionData key yet", () => {
    const published = whatsappFlowStepDefaultFn()
    const parsed = whatsappFlowStepSchema.safeParse({
      ...published,
      text: "Choose pickup",
      flow: {
        id: published.flow.id,
        sourceId: "wa-flow-1",
        startScreenId: "ELEGIR_DIRECCION",
        fieldMappings: published.flow.fieldMappings,
      },
    })
    expect(parsed.success).toBe(true)
  })

  test("accepts an actionData object with contact variables", () => {
    const parsed = whatsappFlowStepSchema.safeParse({
      ...whatsappFlowStepDefaultFn(),
      text: "Choose pickup",
      flow: {
        id: "1",
        sourceId: "wa-flow-1",
        startScreenId: "ELEGIR_DIRECCION",
        fieldMappings: [],
        actionData: {
          nombre: "{{userName}}",
          direcciones: [{ id: "{{address_id_0}}", title: "{{address_text_0}}" }],
        },
      },
    })
    expect(parsed.success).toBe(true)
  })
})

describe("sanitizeWhatsappFlowActionData", () => {
  test("returns undefined when actionData is missing or empty", () => {
    expect(sanitizeWhatsappFlowActionData(null)).toBeUndefined()
    expect(sanitizeWhatsappFlowActionData(undefined)).toBeUndefined()
    expect(sanitizeWhatsappFlowActionData({})).toBeUndefined()
  })

  test("keeps three saved addresses plus gps_current", () => {
    const result = sanitizeWhatsappFlowActionData({
      nombre: "Juan",
      direcciones: [
        { id: "1555732", title: "Oficinas Bifrost" },
        { id: "1387087", title: "Oficinas Bifrost 3" },
        { id: "1356258", title: "TIMANA" },
        gpsCurrent,
      ],
    })
    expect(result?.direcciones).toHaveLength(4)
  })

  test("drops blank and unresolved dropdown ids and keeps gps_current", () => {
    const result = sanitizeWhatsappFlowActionData({
      nombre: "Juan",
      direcciones: [
        { id: "1555732", title: "Oficinas Bifrost" },
        { id: "", title: "{{address_text_1}}" },
        { id: "{{address_id_2}}", title: "{{address_text_2}}" },
        gpsCurrent,
      ],
    })
    expect(result?.direcciones).toEqual([
      { id: "1555732", title: "Oficinas Bifrost" },
      gpsCurrent,
    ])
  })

  test("keeps only gps_current when no saved addresses resolve", () => {
    const result = sanitizeWhatsappFlowActionData({
      nombre: "Nuevo",
      direcciones: [
        { id: "  ", title: "" },
        { id: "{{address_id_1}}", title: "{{address_text_1}}" },
        gpsCurrent,
      ],
    })
    expect(result?.direcciones).toEqual([gpsCurrent])
  })
})

describe("whatsappFlow actionData JSON helpers", () => {
  test("round-trips an object and treats blank input as null", () => {
    const data = { nombre: "{{userName}}" }
    expect(
      parseWhatsappFlowActionDataJson(stringifyWhatsappFlowActionData(data)),
    ).toEqual({ success: true, data })
    expect(parseWhatsappFlowActionDataJson("  ")).toEqual({
      success: true,
      data: null,
    })
  })

  test("rejects arrays, primitives, and invalid JSON", () => {
    expect(parseWhatsappFlowActionDataJson("[]").success).toBe(false)
    expect(parseWhatsappFlowActionDataJson('"hola"').success).toBe(false)
    expect(parseWhatsappFlowActionDataJson("{").success).toBe(false)
  })
})
