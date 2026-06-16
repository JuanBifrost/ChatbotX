import { describe, expect, test } from "vitest"
import {
  actionSteps,
  getResponseAddContactDefaultFn,
  getResponseAddContactSchema,
} from "../src"

describe("getResponseAddContactSchema", () => {
  test("defaults to email and success/error states and is registered", () => {
    const value = getResponseAddContactDefaultFn()

    expect(value).toMatchObject({
      stepType: "getResponseAddContact",
      emailField: "email",
      campaignId: "",
      tags: [],
      dayOfCycle: undefined,
    })
    expect(value.states).toHaveLength(2)
    expect(
      getResponseAddContactSchema.safeParse({
        ...value,
        campaignId: "campaign-1",
      }).success,
    ).toBe(true)
    expect(
      actionSteps.some(
        (schema) =>
          schema.safeParse({ ...value, campaignId: "campaign-1" }).success,
      ),
    ).toBe(true)
  })

  test("trims optional day of cycle to undefined", () => {
    const result = getResponseAddContactSchema.parse({
      ...getResponseAddContactDefaultFn(),
      campaignId: "campaign-1",
      dayOfCycle: " ",
    })

    expect(result.dayOfCycle).toBeUndefined()
  })

  test("rejects duplicate tag IDs after normalization", () => {
    const value = {
      ...getResponseAddContactDefaultFn(),
      campaignId: "campaign-1",
      tags: ["tag-1", " tag-1 "],
    }

    expect(getResponseAddContactSchema.safeParse(value).success).toBe(false)
  })
})
