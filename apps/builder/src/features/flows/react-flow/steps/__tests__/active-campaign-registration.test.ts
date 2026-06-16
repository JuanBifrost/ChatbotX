import {
  actionSteps,
  activeCampaignSyncContactDefaultFn,
  activeCampaignSyncContactSchema,
  stepTypes,
} from "@chatbotx.io/flow-config"
import { describe, expect, test } from "vitest"

describe("activeCampaignSyncContact step registration", () => {
  test("step type is defined in flow config", () => {
    expect(stepTypes.enum.activeCampaignSyncContact).toBe(
      "activeCampaignSyncContact",
    )
  })

  test("default values parse with schema", () => {
    const defaults = activeCampaignSyncContactDefaultFn()
    const result = activeCampaignSyncContactSchema.safeParse(defaults)
    expect(result.success).toBe(true)
    expect(defaults.stepType).toBe("activeCampaignSyncContact")
    expect(defaults.operation).toBe("createOrUpdateContact")
    expect(defaults.emailField).toBe("email")
    expect(defaults.automationId).toBeUndefined()
    expect(defaults.listIds).toHaveLength(0)
    expect(defaults.tagIds).toHaveLength(0)
    expect(defaults.fieldValues).toHaveLength(0)
    expect(defaults.states).toHaveLength(2)
  })

  test("activeCampaignSyncContact is registered in shared actionSteps union", () => {
    const defaults = activeCampaignSyncContactDefaultFn()
    expect(
      actionSteps.some((schema) => schema.safeParse(defaults).success),
    ).toBe(true)
  })
})
