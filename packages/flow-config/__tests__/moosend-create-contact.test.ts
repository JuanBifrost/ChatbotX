import { describe, expect, test } from "vitest"
import {
  actionSteps,
  moosendCreateContactDefaultFn,
  moosendCreateContactSchema,
} from "../src"

describe("moosendCreateContactSchema", () => {
  test("provides state defaults and registers in the shared union", () => {
    const value = moosendCreateContactDefaultFn()
    expect(value).toMatchObject({
      emailField: "email",
      listId: "",
    })
    expect(value.states).toHaveLength(2)
    expect(actionSteps.some((schema) => schema.safeParse(value).success)).toBe(
      false,
    )

    const valid = { ...value, listId: "list-1" }
    expect(moosendCreateContactSchema.safeParse(valid).success).toBe(true)
    expect(actionSteps.some((schema) => schema.safeParse(valid).success)).toBe(
      true,
    )
  })

  test("requires a mailing list and email field", () => {
    const value = moosendCreateContactDefaultFn()
    expect(moosendCreateContactSchema.safeParse(value).success).toBe(false)
    expect(
      moosendCreateContactSchema.safeParse({
        ...value,
        listId: "list-1",
        emailField: " ",
      }).success,
    ).toBe(false)
  })
})
