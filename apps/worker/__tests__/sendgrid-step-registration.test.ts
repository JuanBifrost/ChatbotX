import { stepTypes } from "@chatbotx.io/flow-config"
import { describe, expect, test } from "vitest"
import { flowStepHandlers } from "../src/integration/handlers/step"

describe("sendGridAddContact step dispatch registration", () => {
  test("sendGridAddContact is registered in flowStepHandlers", () => {
    expect(flowStepHandlers).toHaveProperty(stepTypes.enum.sendGridAddContact)
    expect(typeof flowStepHandlers[stepTypes.enum.sendGridAddContact]).toBe(
      "function",
    )
  })
})
