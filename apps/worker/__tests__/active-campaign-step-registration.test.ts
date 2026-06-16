import { stepTypes } from "@chatbotx.io/flow-config"
import { describe, expect, test } from "vitest"
import { flowStepHandlers } from "../src/integration/handlers/step"

describe("activeCampaignSyncContact step dispatch registration", () => {
  test("activeCampaignSyncContact is registered in flowStepHandlers", () => {
    expect(flowStepHandlers).toHaveProperty(
      stepTypes.enum.activeCampaignSyncContact,
    )
    expect(
      typeof flowStepHandlers[stepTypes.enum.activeCampaignSyncContact],
    ).toBe("function")
  })
})
