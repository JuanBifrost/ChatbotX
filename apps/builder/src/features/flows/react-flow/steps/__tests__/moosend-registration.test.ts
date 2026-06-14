import {
  actionSteps,
  moosendCreateContactDefaultFn,
  moosendCreateContactSchema,
  stepTypes,
} from "@chatbotx.io/flow-config"
import { describe, expect, test } from "vitest"

describe("moosendCreateContact step registration", () => {
  test("defines the type and default state tuple", () => {
    const defaults = moosendCreateContactDefaultFn()
    expect(stepTypes.enum.moosendCreateContact).toBe("moosendCreateContact")
    expect(defaults.emailField).toBe("email")
    expect(defaults.listId).toBe("")
    expect(defaults.states).toHaveLength(2)
  })

  test("registers valid values in the shared action union", () => {
    const value = { ...moosendCreateContactDefaultFn(), listId: "list-1" }
    expect(moosendCreateContactSchema.safeParse(value).success).toBe(true)
    expect(actionSteps.some((schema) => schema.safeParse(value).success)).toBe(
      true,
    )
  })
})
