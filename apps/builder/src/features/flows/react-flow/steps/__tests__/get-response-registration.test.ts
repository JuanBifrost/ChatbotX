import {
  actionSteps,
  getResponseAddContactDefaultFn,
  getResponseAddContactSchema,
  stepTypes,
} from "@chatbotx.io/flow-config"
import { describe, expect, test } from "vitest"

describe("getResponseAddContact step registration", () => {
  test("step type is defined in flow config", () => {
    expect(stepTypes.enum.getResponseAddContact).toBe("getResponseAddContact")
  })

  test("valid configured defaults parse with schema", () => {
    const defaults = {
      ...getResponseAddContactDefaultFn(),
      campaignId: "campaign-1",
    }

    const result = getResponseAddContactSchema.safeParse(defaults)
    expect(result.success).toBe(true)
    expect(defaults.stepType).toBe("getResponseAddContact")
    expect(defaults.emailField).toBe("email")
    expect(defaults.tags).toHaveLength(0)
    expect(defaults.states).toHaveLength(2)
  })

  test("getResponseAddContact is registered in shared actionSteps union", () => {
    const defaults = {
      ...getResponseAddContactDefaultFn(),
      campaignId: "campaign-1",
    }
    expect(
      actionSteps.some((schema) => schema.safeParse(defaults).success),
    ).toBe(true)
  })
})
