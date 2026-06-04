import { describe, expect, test } from "vitest"
import { facebookMessageAttachmentPayloadSchema } from "../src/schema"

describe("facebookMessageAttachmentPayloadSchema", () => {
  test("rejects template_type 'utility' — utility messages use message.template not attachment", () => {
    const result = facebookMessageAttachmentPayloadSchema.safeParse({
      template_type: "utility",
    })
    expect(result.success).toBe(false)
  })

  test("accepts template_type 'generic'", () => {
    const result = facebookMessageAttachmentPayloadSchema.safeParse({
      template_type: "generic",
    })
    expect(result.success).toBe(true)
  })
})
