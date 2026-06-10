import type { CreateMessengerMessageTemplateRequest } from "../schema/mutation"

type TemplateVariable = {
  key: string
  example: string
}

type TemplateButton = CreateMessengerMessageTemplateRequest["buttons"][number]

export type MessengerTemplateComponent =
  | {
      type: "HEADER"
      format: "TEXT"
      text: string
      example: { header_text: string[] }
    }
  | {
      type: "HEADER"
      format: "IMAGE"
      text: string
      example: { header_text: string[]; header_handle: string[] }
    }
  | {
      type: "BODY"
      text: string
      example: { body_text: string[][] }
    }
  | {
      type: "BUTTONS"
      buttons: MessengerTemplateButtonComponent[]
    }

export type MessengerTemplateButtonComponent =
  | {
      type: "URL"
      text: string
      url: string
      example?: string[]
    }
  | {
      type: "PHONE_NUMBER"
      text: string
      phone_number: string
    }
  | {
      type: "POSTBACK"
      text: string
      payload: "{{1}}"
    }

function buildHeaderTextExample(variables: TemplateVariable[]) {
  return variables.map((variable) => variable.example)
}

function buildButton(button: TemplateButton): MessengerTemplateButtonComponent {
  if (button.type === "URL") {
    return {
      type: "URL",
      text: button.title,
      url: button.url,
      ...(button.variables.length > 0 ? { example: button.variables } : {}),
    }
  }

  if (button.type === "PHONE_NUMBER") {
    return {
      type: "PHONE_NUMBER",
      text: button.title,
      phone_number: button.phoneNumber,
    }
  }

  return {
    type: "POSTBACK",
    text: button.title,
    payload: "{{1}}",
  }
}

export function buildMessengerMessageTemplateComponents(
  input: CreateMessengerMessageTemplateRequest,
  headerHandle?: string,
): MessengerTemplateComponent[] {
  const components: MessengerTemplateComponent[] = []

  if (input.headerType === "text") {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: input.headerText,
      example: {
        header_text: buildHeaderTextExample(input.headerVariables),
      },
    })
  }

  if (input.headerType === "text_and_image") {
    components.push({
      type: "HEADER",
      format: "IMAGE",
      text: input.headerText,
      example: {
        header_text: buildHeaderTextExample(input.headerVariables),
        header_handle: headerHandle ? [headerHandle] : [],
      },
    })
  }

  components.push({
    type: "BODY",
    text: input.body,
    example: {
      body_text: [input.bodyVariables.map((variable) => variable.example)],
    },
  })

  if (input.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map(buildButton),
    })
  }

  return components
}
