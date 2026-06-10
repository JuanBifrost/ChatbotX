// @vitest-environment node
import { describe, expect, test } from "vitest"
import { buildMessengerMessageTemplateComponents } from "@/features/integration-messenger/message-templates/lib/build-template-components"
import {
  type CreateMessengerMessageTemplateRequest,
  createMessengerMessageTemplateRequest,
} from "@/features/integration-messenger/message-templates/schema/mutation"

const baseInput: CreateMessengerMessageTemplateRequest = {
  name: "test_utility",
  language: "vi",
  headerType: "none",
  headerText: "",
  headerVariables: [],
  body: "Hello {{1}}",
  bodyVariables: [{ key: "{{1}}", example: "Hung" }],
  buttons: [],
}

describe("buildMessengerMessageTemplateComponents", () => {
  test("builds body with double-wrapped examples and no buttons component", () => {
    expect(buildMessengerMessageTemplateComponents(baseInput)).toEqual([
      {
        type: "BODY",
        text: "Hello {{1}}",
        example: {
          body_text: [["Hung"]],
        },
      },
    ])
  })

  test("omits body example when body has no variables", () => {
    expect(
      buildMessengerMessageTemplateComponents({
        ...baseInput,
        body: "Plain body text",
        bodyVariables: [],
      }),
    ).toEqual([
      {
        type: "BODY",
        text: "Plain body text",
      },
    ])
  })

  test("builds text header with header_text example", () => {
    expect(
      buildMessengerMessageTemplateComponents({
        ...baseInput,
        headerType: "text",
        headerText: "Hi {{1}}",
        headerVariables: [{ key: "{{1}}", example: "Customer" }],
      }),
    ).toEqual([
      {
        type: "HEADER",
        format: "TEXT",
        text: "Hi {{1}}",
        example: {
          header_text: ["Customer"],
        },
      },
      {
        type: "BODY",
        text: "Hello {{1}}",
        example: {
          body_text: [["Hung"]],
        },
      },
    ])
  })

  test("omits text header example when header has no variables", () => {
    expect(
      buildMessengerMessageTemplateComponents({
        ...baseInput,
        headerType: "text",
        headerText: "PAMAOI XIN THONG BAO",
        headerVariables: [],
      }),
    ).toEqual([
      {
        type: "HEADER",
        format: "TEXT",
        text: "PAMAOI XIN THONG BAO",
      },
      {
        type: "BODY",
        text: "Hello {{1}}",
        example: {
          body_text: [["Hung"]],
        },
      },
    ])
  })

  test("builds image header with text example and uploaded handle", () => {
    expect(
      buildMessengerMessageTemplateComponents(
        {
          ...baseInput,
          headerType: "text_and_image",
          headerText: "Hi {{1}}",
          headerVariables: [{ key: "{{1}}", example: "Customer" }],
          headerImageUrl: "https://example.com/header.jpg",
        },
        "header-handle",
      ),
    ).toEqual([
      {
        type: "HEADER",
        format: "IMAGE",
        text: "Hi {{1}}",
        example: {
          header_text: ["Customer"],
          header_handle: ["header-handle"],
        },
      },
      {
        type: "BODY",
        text: "Hello {{1}}",
        example: {
          body_text: [["Hung"]],
        },
      },
    ])
  })

  test("omits image header text example when header has no variables", () => {
    expect(
      buildMessengerMessageTemplateComponents(
        {
          ...baseInput,
          headerType: "text_and_image",
          headerText: "PAMAOI XIN THONG BAO",
          headerVariables: [],
          headerImageUrl: "https://example.com/header.jpg",
        },
        "header-handle",
      ),
    ).toEqual([
      {
        type: "HEADER",
        format: "IMAGE",
        text: "PAMAOI XIN THONG BAO",
        example: {
          header_handle: ["header-handle"],
        },
      },
      {
        type: "BODY",
        text: "Hello {{1}}",
        example: {
          body_text: [["Hung"]],
        },
      },
    ])
  })

  test("builds all supported button types", () => {
    expect(
      buildMessengerMessageTemplateComponents({
        ...baseInput,
        buttons: [
          { type: "POSTBACK", title: "Start" },
          {
            type: "PHONE_NUMBER",
            title: "Call",
            phoneNumber: "+84123456789",
          },
          {
            type: "URL",
            title: "Open",
            url: "https://example.com/{{1}}",
            variables: ["abc"],
          },
        ],
      }),
    ).toEqual([
      {
        type: "BODY",
        text: "Hello {{1}}",
        example: {
          body_text: [["Hung"]],
        },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "POSTBACK",
            text: "Start",
            payload: "{{1}}",
          },
          {
            type: "PHONE_NUMBER",
            text: "Call",
            phone_number: "+84123456789",
          },
          {
            type: "URL",
            text: "Open",
            url: "https://example.com/{{1}}",
            example: {
              url_suffix_example: "https://example.com/abc",
            },
          },
        ],
      },
    ])
  })

  test("omits URL button example when variables are empty", () => {
    expect(
      buildMessengerMessageTemplateComponents({
        ...baseInput,
        buttons: [
          {
            type: "URL",
            title: "Open",
            url: "https://example.com",
            variables: [],
          },
        ],
      }),
    ).toEqual([
      {
        type: "BODY",
        text: "Hello {{1}}",
        example: {
          body_text: [["Hung"]],
        },
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "Open",
            url: "https://example.com",
          },
        ],
      },
    ])
  })
})

describe("createMessengerMessageTemplateRequest", () => {
  test("rejects empty URL variable examples", () => {
    expect(
      createMessengerMessageTemplateRequest.safeParse({
        ...baseInput,
        buttons: [
          {
            type: "URL",
            title: "Open",
            url: "https://example.com/{{1}}",
            variables: [""],
          },
        ],
      }).success,
    ).toBe(false)
  })

  test("rejects unsupported body placeholders", () => {
    expect(
      createMessengerMessageTemplateRequest.safeParse({
        ...baseInput,
        body: "Hello {{10}}",
        bodyVariables: [],
      }).success,
    ).toBe(false)

    expect(
      createMessengerMessageTemplateRequest.safeParse({
        ...baseInput,
        body: "Hello {{0}}",
        bodyVariables: [],
      }).success,
    ).toBe(false)
  })

  test("rejects more than one header variable", () => {
    expect(
      createMessengerMessageTemplateRequest.safeParse({
        ...baseInput,
        headerType: "text",
        headerText: "Hello {{1}} {{2}}",
        headerVariables: [
          { key: "{{1}}", example: "One" },
          { key: "{{2}}", example: "Two" },
        ],
      }).success,
    ).toBe(false)
  })

  test("rejects URL example count mismatch", () => {
    expect(
      createMessengerMessageTemplateRequest.safeParse({
        ...baseInput,
        buttons: [
          {
            type: "URL",
            title: "Open",
            url: "https://example.com/{{1}}",
            variables: [],
          },
        ],
      }).success,
    ).toBe(false)
  })

  test("rejects more than one URL variable", () => {
    expect(
      createMessengerMessageTemplateRequest.safeParse({
        ...baseInput,
        buttons: [
          {
            type: "URL",
            title: "Open",
            url: "https://example.com/{{1}}/{{2}}",
            variables: ["one", "two"],
          },
        ],
      }).success,
    ).toBe(false)
  })
})
