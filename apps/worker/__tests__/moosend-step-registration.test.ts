import { stepTypes } from "@chatbotx.io/flow-config"
import { describe, expect, test } from "vitest"
import { flowStepHandlers } from "../src/integration/handlers/step"

describe("moosendCreateContact step dispatch registration", () => {
  test("registers the Moosend handler", () => {
    expect(flowStepHandlers).toHaveProperty(stepTypes.enum.moosendCreateContact)
    expect(typeof flowStepHandlers[stepTypes.enum.moosendCreateContact]).toBe(
      "function",
    )
  })
})
