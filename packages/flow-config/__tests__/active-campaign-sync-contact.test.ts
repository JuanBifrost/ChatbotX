import { describe, expect, test } from "vitest"
import {
  actionSteps,
  activeCampaignSyncContactDefaultFn,
  activeCampaignSyncContactSchema,
} from "../src"

describe("activeCampaignSyncContactSchema", () => {
  test("defaults to email-only sync and is registered in action steps", () => {
    const value = activeCampaignSyncContactDefaultFn()

    expect(value).toMatchObject({
      operation: "createOrUpdateContact",
      emailField: "email",
      phoneField: undefined,
      automationId: undefined,
      listIds: [],
      tagIds: [],
      fieldValues: [],
    })
    expect(activeCampaignSyncContactSchema.safeParse(value).success).toBe(true)
    expect(actionSteps.some((schema) => schema.safeParse(value).success)).toBe(
      true,
    )
  })

  test("rejects duplicate list and tag IDs after normalization", () => {
    const value = {
      ...activeCampaignSyncContactDefaultFn(),
      listIds: ["1", " 1 "],
      tagIds: ["2", " 2 "],
    }

    expect(activeCampaignSyncContactSchema.safeParse(value).success).toBe(false)
  })

  test("rejects duplicate ActiveCampaign field mappings", () => {
    const value = {
      ...activeCampaignSyncContactDefaultFn(),
      fieldValues: [
        { contactFieldId: "field-1", activeCampaignFieldId: "9" },
        { contactFieldId: "field-2", activeCampaignFieldId: "9" },
      ],
    }

    expect(activeCampaignSyncContactSchema.safeParse(value).success).toBe(false)
  })

  test("requires an automation for add contact to automation", () => {
    const value = {
      ...activeCampaignSyncContactDefaultFn(),
      operation: "addContactToAutomation",
      automationId: undefined,
    }

    expect(activeCampaignSyncContactSchema.safeParse(value).success).toBe(false)
    expect(
      activeCampaignSyncContactSchema.safeParse({
        ...value,
        automationId: "42",
      }).success,
    ).toBe(true)
  })
})
