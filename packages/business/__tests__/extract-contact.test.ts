import { describe, expect, test } from "vitest"
import {
  extractContactInfo,
  hasPhoneNumber,
  parsePhoneNumber,
} from "../src/contact/extract-contact"

describe("extractContactInfo", () => {
  test("returns empty object for empty/short input", () => {
    expect(extractContactInfo("")).toEqual({})
    expect(extractContactInfo(null)).toEqual({})
    expect(extractContactInfo(undefined)).toEqual({})
    expect(extractContactInfo("abc")).toEqual({})
  })

  test("returns empty object when no contact info present", () => {
    expect(extractContactInfo("hello there how are you")).toEqual({})
  })

  test("extracts VN local-format phone with VN defaultCountry", () => {
    expect(extractContactInfo("Call me 0912345678", "VN")).toEqual({
      phoneNumber: "+84912345678",
    })
  })

  test("extracts email (lowercased + trimmed)", () => {
    expect(extractContactInfo("My email is Jane@Acme.COM")).toEqual({
      email: "jane@acme.com",
    })
  })

  test("extracts both phone and email", () => {
    const result = extractContactInfo("+1 415 555 0199 or alex@x.io")
    expect(result.email).toBe("alex@x.io")
    expect(result.phoneNumber).toBe("+14155550199")
  })

  test("rejects too-short numeric runs", () => {
    expect(extractContactInfo("My number 12345", "VN")).toEqual({})
  })

  test("extracts E.164 phone without defaultCountry", () => {
    expect(extractContactInfo("contact +84 90 1234 567")).toEqual({
      phoneNumber: "+84901234567",
    })
  })

  test("falls back to VN region when no defaultCountry", () => {
    expect(extractContactInfo("call 0912345678")).toEqual({
      phoneNumber: "+84912345678",
    })
  })

  test("falls back to US region when no defaultCountry", () => {
    expect(extractContactInfo("call 415-555-0199")).toEqual({
      phoneNumber: "+14155550199",
    })
  })

  test("does not extract Thai local format (TH not in fallback)", () => {
    expect(extractContactInfo("02 123 4567")).toEqual({})
  })

  test("ignores invalid region gracefully", () => {
    // Invalid CountryCode should not crash; falls through to fallback list.
    expect(extractContactInfo("call 415-555-0199", "ZZ")).toEqual({
      phoneNumber: "+14155550199",
    })
  })

  test("treats null defaultCountry same as undefined", () => {
    expect(extractContactInfo("call 0912345678", null)).toEqual({
      phoneNumber: "+84912345678",
    })
  })
})

describe("parsePhoneNumber (PHP port)", () => {
  test("returns null on empty / too-short input", () => {
    expect(parsePhoneNumber("")).toBeNull()
    expect(parsePhoneNumber(null)).toBeNull()
    expect(parsePhoneNumber("12345")).toBeNull()
  })

  test("parses VN local 10-digit mobile and preserves cleaned source", () => {
    const result = parsePhoneNumber("call me 0912345678 plz", "VN")
    expect(result).not.toBeNull()
    expect(result?.number.format("E.164")).toBe("+84912345678")
    expect(result?.phoneFromString).toBe("0912345678")
  })

  test("falls back to loose getCommonPhoneNumber on missed strict scan", () => {
    // 415-555-0199 has separators, the strict scan still catches it under US.
    const result = parsePhoneNumber("ring 415-555-0199 today")
    expect(result?.number.format("E.164")).toBe("+14155550199")
  })

  test("accepts region as array", () => {
    const result = parsePhoneNumber("0912345678", ["US", "VN"])
    expect(result?.number.format("E.164")).toBe("+84912345678")
  })
})

describe("hasPhoneNumber (PHP port)", () => {
  test("returns E.164 when source starts with +", () => {
    expect(hasPhoneNumber("contact +84 90 1234 567")).toBe("+84901234567")
  })

  test("returns E.164 when source starts with country code", () => {
    // "84912345678" — starts with VN country code "84".
    expect(hasPhoneNumber("ping 84912345678 thanks", "VN")).toBe("+84912345678")
  })

  test("returns raw cleaned source when local format with no + and no CC prefix", () => {
    // "0912345678" — local VN format, no + and does not start with "84".
    expect(hasPhoneNumber("ring 0912345678 ok", "VN")).toBe("0912345678")
  })

  test("explicit format arg wins (NATIONAL)", () => {
    expect(hasPhoneNumber("0912345678", "VN", "NATIONAL")).toBe("0912 345 678")
  })

  test("returns null on empty / unparseable input", () => {
    expect(hasPhoneNumber("")).toBeNull()
    expect(hasPhoneNumber("hello world no phone")).toBeNull()
  })
})

describe("extractContactInfo — VN carrier prefixes", () => {
  // Viettel
  test("Viettel 096 prefix", () => {
    expect(extractContactInfo("liên hệ 0961234567", "VN").phoneNumber).toBe(
      "+84961234567",
    )
  })
  // Vinaphone
  test("Vinaphone 091 prefix", () => {
    expect(extractContactInfo("alo 0912345678", "VN").phoneNumber).toBe(
      "+84912345678",
    )
  })
  // Mobifone
  test("Mobifone 089 prefix", () => {
    expect(extractContactInfo("gọi 0898765432", "VN").phoneNumber).toBe(
      "+84898765432",
    )
  })
  // Newer 03x prefix (post-2018 reassignment)
  test("VN new 03x mobile prefix", () => {
    expect(extractContactInfo("sđt 0367123456", "VN").phoneNumber).toBe(
      "+84367123456",
    )
  })
  // 07x prefix
  test("VN 07x mobile prefix", () => {
    expect(extractContactInfo("phone 0789123456", "VN").phoneNumber).toBe(
      "+84789123456",
    )
  })
  // 05x prefix (Vietnamobile/Reddi)
  test("VN 05x mobile prefix", () => {
    expect(extractContactInfo("sđt 0521234567", "VN").phoneNumber).toBe(
      "+84521234567",
    )
  })
})

describe("extractContactInfo — VN international formats", () => {
  test("E.164 with +84 + spaces", () => {
    expect(extractContactInfo("ring +84 912 345 678").phoneNumber).toBe(
      "+84912345678",
    )
  })

  test("E.164 with +84 + dots", () => {
    expect(extractContactInfo("call +84.912.345.678").phoneNumber).toBe(
      "+84912345678",
    )
  })

  test("E.164 with +84 + dashes", () => {
    expect(extractContactInfo("phone +84-912-345-678").phoneNumber).toBe(
      "+84912345678",
    )
  })

  test("00-prefix international (00 → +)", () => {
    expect(extractContactInfo("intl 0084912345678", "VN").phoneNumber).toBe(
      "+84912345678",
    )
  })
})

describe("extractContactInfo — US formats", () => {
  test("parens + dash US", () => {
    expect(extractContactInfo("call (415) 555-0199").phoneNumber).toBe(
      "+14155550199",
    )
  })

  test("dot-separated US", () => {
    expect(extractContactInfo("ring 415.555.0199").phoneNumber).toBe(
      "+14155550199",
    )
  })

  test("dash-separated US with +1", () => {
    expect(extractContactInfo("call +1-415-555-0199").phoneNumber).toBe(
      "+14155550199",
    )
  })

  test("US toll-free 800", () => {
    expect(extractContactInfo("hotline 1-800-555-0199", "US").phoneNumber).toBe(
      "+18005550199",
    )
  })
})

describe("extractContactInfo — noisy / embedded text", () => {
  test("phone embedded in Vietnamese sentence", () => {
    expect(
      extractContactInfo(
        "Chào anh, anh có thể gọi cho em số 0912345678 nhé, cảm ơn.",
        "VN",
      ).phoneNumber,
    ).toBe("+84912345678")
  })

  test("phone with surrounding punctuation", () => {
    expect(extractContactInfo("[contact: 0912345678!]", "VN").phoneNumber).toBe(
      "+84912345678",
    )
  })

  test("phone after currency / numeric noise", () => {
    expect(
      extractContactInfo("price $99 then call 0912345678", "VN").phoneNumber,
    ).toBe("+84912345678")
  })

  test("phone embedded between words on one line", () => {
    expect(
      extractContactInfo("hotline:0912345678 thanks", "VN").phoneNumber,
    ).toBe("+84912345678")
  })
})

describe("extractContactInfo — multi-number text (first valid wins)", () => {
  test("two VN mobiles → first match wins", () => {
    expect(
      extractContactInfo("primary 0912345678 backup 0987654321", "VN")
        .phoneNumber,
    ).toBe("+84912345678")
  })

  test("invalid-then-valid → returns valid one", () => {
    // 7-digit run gets skipped by MIN_DIGITS=8; loose fallback may catch it
    // but the strict-pass second-run wins first.
    const out = extractContactInfo("ref 1234567 phone 0912345678", "VN")
    expect(out.phoneNumber).toBe("+84912345678")
  })
})

describe("extractContactInfo — negative / robustness", () => {
  test("only digits but too short", () => {
    expect(extractContactInfo("code 1234567", "VN").phoneNumber).toBeUndefined()
  })

  test("pure prose returns nothing", () => {
    expect(
      extractContactInfo("hello how are you today", "VN").phoneNumber,
    ).toBeUndefined()
  })

  test("ID-card-like 12 digits with country defaultCountry still tolerated", () => {
    // 12-digit IDs CAN look like a phone. Document current behavior:
    // VN treats this as a possible-but-invalid landline → rejected.
    expect(
      extractContactInfo("CMND 012345678901", "VN").phoneNumber,
    ).toBeUndefined()
  })

  test("international + prefix wins over region (UK landline accepted)", () => {
    // `+44 ...` is parsed using `+44` regardless of the region hint. The
    // FIXED_LINE-skip rule only fires when `region !== "VN"`; since VN is the
    // first region tried, the UK landline slips through. Documented behavior —
    // PHP exhibits the same.
    expect(extractContactInfo("UK +44 20 7946 0958").phoneNumber).toBe(
      "+442079460958",
    )
  })

  test("garbage with separators only", () => {
    expect(
      extractContactInfo("--- ... +++ () ___", "VN").phoneNumber,
    ).toBeUndefined()
  })
})

describe("extractContactInfo — combined phone + email", () => {
  test("phone before email", () => {
    expect(
      extractContactInfo("hi 0912345678 mail jane@acme.com", "VN"),
    ).toEqual({
      phoneNumber: "+84912345678",
      email: "jane@acme.com",
    })
  })

  test("email before phone", () => {
    expect(
      extractContactInfo("email jane@acme.com phone +84 912 345 678"),
    ).toEqual({
      phoneNumber: "+84912345678",
      email: "jane@acme.com",
    })
  })

  test("phone on one line, email on next", () => {
    expect(extractContactInfo("0912345678\njane@acme.com", "VN")).toEqual({
      phoneNumber: "+84912345678",
      email: "jane@acme.com",
    })
  })
})

describe("extractContactInfo — skip flags", () => {
  test("skipPhone skips phone extraction, email still returned", () => {
    expect(
      extractContactInfo("call 0912345678 mail jane@acme.com", "VN", {
        skipPhone: true,
      }),
    ).toEqual({ email: "jane@acme.com" })
  })

  test("skipEmail skips email extraction, phone still returned", () => {
    expect(
      extractContactInfo("call 0912345678 mail jane@acme.com", "VN", {
        skipEmail: true,
      }),
    ).toEqual({ phoneNumber: "+84912345678" })
  })

  test("both skip flags returns empty object", () => {
    expect(
      extractContactInfo("call 0912345678 mail jane@acme.com", "VN", {
        skipPhone: true,
        skipEmail: true,
      }),
    ).toEqual({})
  })

  test("undefined options preserves default 2-arg behavior", () => {
    expect(
      extractContactInfo("call 0912345678 mail jane@acme.com", "VN"),
    ).toEqual({ phoneNumber: "+84912345678", email: "jane@acme.com" })
  })

  test("empty options object behaves like no options", () => {
    expect(
      extractContactInfo("call 0912345678 mail jane@acme.com", "VN", {}),
    ).toEqual({ phoneNumber: "+84912345678", email: "jane@acme.com" })
  })
})

describe("extractContactInfo — region preference", () => {
  test("defaultCountry tried first, then fallback to VN/US", () => {
    // PH-style not provided so VN parses 0912345678 successfully.
    expect(extractContactInfo("call 0912345678", "PH").phoneNumber).toBe(
      "+84912345678",
    )
  })

  test("US number under VN defaultCountry still resolves via US fallback", () => {
    // "+1 ..." is unambiguously US — VN parse fails, US fallback succeeds.
    expect(extractContactInfo("US +1 415 555 0199", "VN").phoneNumber).toBe(
      "+14155550199",
    )
  })
})
