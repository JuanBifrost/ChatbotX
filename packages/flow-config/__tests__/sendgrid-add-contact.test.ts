import { describe, expect, test } from "vitest"
import {
  actionSteps,
  sendGridAddContactDefaultFn,
  sendGridAddContactSchema,
} from "../src"

describe("sendGridAddContactSchema", () => {
  test("provides safe defaults and registers in the shared union", () => {
    const value = sendGridAddContactDefaultFn()
    expect(value).toMatchObject({
      emailField: "email",
      listId: undefined,
      phoneField: undefined,
      mergeFields: [],
    })
    expect(sendGridAddContactSchema.safeParse(value).success).toBe(true)
    expect(actionSteps.some((schema) => schema.safeParse(value).success)).toBe(
      true,
    )
  })

  test("normalizes empty optional values", () => {
    const result = sendGridAddContactSchema.parse({
      ...sendGridAddContactDefaultFn(),
      listId: " ",
      phoneField: "",
    })
    expect(result.listId).toBeUndefined()
    expect(result.phoneField).toBeUndefined()
  })

  test("rejects duplicate target fields", () => {
    const value = {
      ...sendGridAddContactDefaultFn(),
      mergeFields: [
        { contactFieldId: "field-1", sendGridField: "target" },
        { contactFieldId: "field-2", sendGridField: "target" },
      ],
    }
    expect(sendGridAddContactSchema.safeParse(value).success).toBe(false)
  })
})
