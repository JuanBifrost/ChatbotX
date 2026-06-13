import { describe, expect, test } from "vitest"
import {
  actionSteps,
  mailerLiteAddSubscriberDefaultFn,
  mailerLiteAddSubscriberSchema,
} from "../src"

describe("MailerLite add subscriber flow contract", () => {
  test("creates safe defaults with stable state ids", () => {
    const value = mailerLiteAddSubscriberDefaultFn()
    expect(value).toMatchObject({
      stepType: "mailerLiteAddSubscriber",
      emailField: "email",
      status: "unconfirmed",
      mergeFields: [],
    })
    expect(value.states.map((state) => state.stateType)).toEqual([
      "success",
      "error",
    ])
    expect(value.states.every((state) => Boolean(state.id))).toBe(true)
  })

  test("trims optional group and accepts an explicit status", () => {
    const value = mailerLiteAddSubscriberSchema.parse({
      ...mailerLiteAddSubscriberDefaultFn(),
      groupId: " group-1 ",
      status: "active",
    })
    expect(value.groupId).toBe("group-1")
    expect(value.status).toBe("active")
  })

  test("rejects duplicate provider targets", () => {
    const defaults = mailerLiteAddSubscriberDefaultFn()
    expect(() =>
      mailerLiteAddSubscriberSchema.parse({
        ...defaults,
        mergeFields: [
          { contactFieldId: "a", mailerLiteField: "plan" },
          { contactFieldId: "b", mailerLiteField: "plan" },
        ],
      }),
    ).toThrow()
  })

  test("accepts mappings to MailerLite default fields", () => {
    const defaults = mailerLiteAddSubscriberDefaultFn()
    expect(
      mailerLiteAddSubscriberSchema.parse({
        ...defaults,
        mergeFields: [
          { contactFieldId: "a", mailerLiteField: "name" },
          { contactFieldId: "b", mailerLiteField: "last_name" },
          { contactFieldId: "c", mailerLiteField: "phone" },
        ],
      }),
    ).toMatchObject({
      mergeFields: [
        { contactFieldId: "a", mailerLiteField: "name" },
        { contactFieldId: "b", mailerLiteField: "last_name" },
        { contactFieldId: "c", mailerLiteField: "phone" },
      ],
    })
  })

  test("is registered in the shared action union", () => {
    const defaults = mailerLiteAddSubscriberDefaultFn()
    expect(
      actionSteps.some((schema) => schema.safeParse(defaults).success),
    ).toBe(true)
  })
})
