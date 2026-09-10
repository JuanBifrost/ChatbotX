import { describe, expect, test } from "vitest"
import { listPhoneNumbersResponse } from "@/features/integration-whatsapp/schema"

const EMPTY_PAGING = {
  cursors: { before: "", after: "" },
}

describe("listPhoneNumbersResponse", () => {
  test("accepts Graph's default sparse phone_numbers payload", () => {
    const result = listPhoneNumbersResponse.safeParse({
      data: [
        {
          id: "1000000000000001",
          verified_name: "Example Line",
          code_verification_status: "VERIFIED",
          display_phone_number: "+57 300 000 0000",
          quality_rating: "GREEN",
        },
      ],
      paging: EMPTY_PAGING,
    })

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data.data[0]).toMatchObject({
      id: "1000000000000001",
      platform_type: "",
      throughput: {},
      webhook_configuration: {},
    })
  })

  test("coerces a numeric Graph id and null optional fields", () => {
    const result = listPhoneNumbersResponse.safeParse({
      data: [
        {
          id: 123456789,
          verified_name: null,
          code_verification_status: null,
          display_phone_number: "+57 300 000 0000",
          quality_rating: null,
          platform_type: null,
          throughput: null,
          webhook_configuration: null,
        },
      ],
      paging: EMPTY_PAGING,
    })

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }
    expect(result.data.data[0]?.id).toBe("123456789")
    expect(result.data.data[0]?.verified_name).toBe("")
    expect(result.data.data[0]?.quality_rating).toBe("")
    expect(result.data.data[0]?.throughput).toEqual({})
  })

  test("still accepts a full Cloud API phone-number object", () => {
    const result = listPhoneNumbersResponse.safeParse({
      data: [
        {
          id: "phone-1",
          verified_name: "Verified Phone",
          code_verification_status: "VERIFIED",
          display_phone_number: "+57 300 000 0000",
          quality_rating: "GREEN",
          platform_type: "CLOUD_API",
          throughput: { level: "STANDARD" },
          webhook_configuration: { application: "app-1" },
        },
      ],
      paging: EMPTY_PAGING,
    })

    expect(result.success).toBe(true)
  })

  test("rejects a row with no id", () => {
    const result = listPhoneNumbersResponse.safeParse({
      data: [{ display_phone_number: "+57 300 000 0000" }],
      paging: EMPTY_PAGING,
    })

    expect(result.success).toBe(false)
  })
})
