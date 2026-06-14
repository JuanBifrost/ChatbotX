import {
  actionSteps,
  sendGridAddContactDefaultFn,
  sendGridAddContactSchema,
  stepTypes,
} from "@chatbotx.io/flow-config"
import { describe, expect, test } from "vitest"

describe("sendGridAddContact step registration", () => {
  test("step type is defined in flow config", () => {
    expect(stepTypes.enum.sendGridAddContact).toBe("sendGridAddContact")
  })

  test("default values parse with schema", () => {
    const defaults = sendGridAddContactDefaultFn()
    const result = sendGridAddContactSchema.safeParse(defaults)
    expect(result.success).toBe(true)
    expect(defaults.stepType).toBe("sendGridAddContact")
    expect(defaults.emailField).toBe("email")
    expect(defaults.listId).toBeUndefined()
    expect(defaults.phoneField).toBeUndefined()
    expect(defaults.mergeFields).toHaveLength(0)
    expect(defaults.states).toHaveLength(2)
  })

  test("sendGridAddContact is registered in shared actionSteps union", () => {
    const defaults = sendGridAddContactDefaultFn()
    expect(
      actionSteps.some((schema) => schema.safeParse(defaults).success),
    ).toBe(true)
  })
})
