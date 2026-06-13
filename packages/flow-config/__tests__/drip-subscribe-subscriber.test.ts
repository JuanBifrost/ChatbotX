import { describe, expect, test } from "vitest"
import {
  actionSteps,
  dripSubscribeSubscriberDefaultFn,
  dripSubscribeSubscriberSchema,
} from "../src"

describe("dripSubscribeSubscriberSchema", () => {
  test("requires an account before the default can be saved", () => {
    const value = dripSubscribeSubscriberDefaultFn()

    expect(value).toMatchObject({
      accountId: "",
      emailField: "email",
      phoneField: undefined,
      tags: [],
      mergeFields: [],
    })
    expect(dripSubscribeSubscriberSchema.safeParse(value).success).toBe(false)
    expect(
      dripSubscribeSubscriberSchema.safeParse({ ...value, accountId: "123" })
        .success,
    ).toBe(true)
    expect(
      actionSteps.some(
        (schema) => schema.safeParse({ ...value, accountId: "123" }).success,
      ),
    ).toBe(true)
  })

  test("trims tags and rejects duplicates after normalization", () => {
    const value = {
      ...dripSubscribeSubscriberDefaultFn(),
      tags: ["vip", " vip "],
    }

    expect(dripSubscribeSubscriberSchema.safeParse(value).success).toBe(false)
  })

  test("rejects duplicate Drip field mappings", () => {
    const value = {
      ...dripSubscribeSubscriberDefaultFn(),
      mergeFields: [
        { contactFieldId: "field-1", dripField: "company" },
        { contactFieldId: "field-2", dripField: "company" },
      ],
    }

    expect(dripSubscribeSubscriberSchema.safeParse(value).success).toBe(false)
  })
})
