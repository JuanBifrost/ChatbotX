import { describe, expect, test } from "vitest"
import {
  actionSteps,
  klaviyoSyncProfileDefaultFn,
  klaviyoSyncProfileSchema,
} from "../src"

describe("Klaviyo sync profile flow contract", () => {
  test("creates safe defaults with stable state ids", () => {
    const value = klaviyoSyncProfileDefaultFn()
    expect(value).toMatchObject({
      stepType: "klaviyoSyncProfile",
      emailField: "email",
      mergeFields: [],
    })
    expect(value.states.map((state) => state.stateType)).toEqual([
      "success",
      "error",
    ])
    expect(value.states.every((state) => Boolean(state.id))).toBe(true)
  })

  test("trims optional selectors", () => {
    const value = klaviyoSyncProfileSchema.parse({
      ...klaviyoSyncProfileDefaultFn(),
      listId: " list-1 ",
      titleField: " title ",
      orgField: " org ",
    })
    expect(value).toMatchObject({
      listId: "list-1",
      titleField: "title",
      orgField: "org",
    })
  })

  test("rejects duplicate properties", () => {
    const defaults = klaviyoSyncProfileDefaultFn()
    expect(() =>
      klaviyoSyncProfileSchema.parse({
        ...defaults,
        mergeFields: [
          { contactFieldId: "a", klaviyoProperty: "plan" },
          { contactFieldId: "b", klaviyoProperty: "plan" },
        ],
      }),
    ).toThrow()
  })

  test("drops legacy tag ids", () => {
    expect(
      klaviyoSyncProfileSchema.parse({
        ...klaviyoSyncProfileDefaultFn(),
        tagIds: ["legacy-tag"],
      }),
    ).not.toHaveProperty("tagIds")
  })

  test("is registered in the shared action union", () => {
    const defaults = klaviyoSyncProfileDefaultFn()
    expect(
      actionSteps.some((schema) => schema.safeParse(defaults).success),
    ).toBe(true)
  })
})
