import { describe, expect, test } from "vitest"
import { operatorTypes } from "../src/partials"
import { applyContactFilter } from "../src/queries/contact-filter"

describe("applyContactFilter", () => {
  test("maps interactedInLast24h=true to a recent contact inbox existence check", () => {
    const where = applyContactFilter({
      operator: "and",
      conditions: [
        {
          field: "interactedInLast24h",
          operator: operatorTypes.enum.eq,
          value: "true",
        },
      ],
    })

    expect(where).toEqual({
      contactInboxes: {
        some: { lastIncomingMessageAt: { gte: expect.anything() } },
      },
    })
  })

  test("maps interactedInLast24h=false to an anti-existence check", () => {
    const where = applyContactFilter({
      operator: "and",
      conditions: [
        {
          field: "interactedInLast24h",
          operator: operatorTypes.enum.eq,
          value: "false",
        },
      ],
    })

    expect(where).toEqual({
      contactInboxes: {
        none: { lastIncomingMessageAt: { gte: expect.anything() } },
      },
    })
  })

  test("maps interactedInLast24h non-literal true values to the anti-existence check", () => {
    for (const value of ["TRUE", ""]) {
      const where = applyContactFilter({
        operator: "and",
        conditions: [
          {
            field: "interactedInLast24h",
            operator: operatorTypes.enum.eq,
            value,
          },
        ],
      })

      expect(where).toEqual({
        contactInboxes: {
          none: { lastIncomingMessageAt: { gte: expect.anything() } },
        },
      })
    }
  })
})
