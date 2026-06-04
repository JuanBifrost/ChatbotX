import type {
  ButtonStepProps,
  MessengerTemplateButtonParam,
  MessengerTemplateParams,
  MetadataPayload,
  SendMessengerTemplateMessageStepSchema,
} from "@chatbotx.io/flow-config"
import {
  buttonTypes,
  encodeButtonPayload,
  extractMetadata,
} from "@chatbotx.io/flow-config"
import type { MessageHandlers } from "@chatbotx.io/sdk"
import type {
  FacebookSendMessageRequest,
  MessengerAuthValue,
} from "../../../schema"
import { MESSENGER_MESSAGE_METADATA } from "../../../schema"

type MessengerTemplateComponentParameter =
  | { type: "text"; text: string; parameter_name?: string }
  | { type: "image"; image: { link: string } }
  | { type: "POSTBACK"; payload: string }
  | { type: "URL"; url: string }

type MessengerTemplateComponent = {
  type: "header" | "body" | "buttons"
  parameters: MessengerTemplateComponentParameter[]
}

/**
 * Builds a complete Facebook Send API request for a Messenger utility template.
 *
 * Correct structure per docs (Mar 2026):
 *   messaging_type = "UTILITY"
 *   message.template.name / language.code / components
 *
 * NOT message.attachment.payload — that is the old generic-template shape.
 *
 * Button components come from two sources:
 *   - URL buttons: built from template.params.button (sub_type "url")
 *   - POSTBACK buttons: built from step.buttons[] with encoded flow payloads
 */
export function buildMessengerTemplateSendRequest(
  props: Parameters<
    MessageHandlers<
      MessengerAuthValue,
      SendMessengerTemplateMessageStepSchema
    >["sendFlowStep"]
  >[0],
): FacebookSendMessageRequest {
  const {
    ctx,
    data: { contact, flowId, flowVersionId, metadata, step },
  } = props
  const { template } = step

  const components = buildMessengerTemplateComponents(
    template.params,
    template.parameterFormat,
    {
      flowId,
      flowVersionId,
      metadata,
      flowButtons: step.buttons,
    },
  )

  const personaId = (
    ctx.integrationDetail as { personaId?: string } | undefined
  )?.personaId

  return {
    recipient: { id: contact.sourceId },
    messaging_type: "UTILITY",
    persona_id: personaId,
    message: {
      template: {
        name: template.name,
        language: { code: template.language },
        components,
      },
      metadata: MESSENGER_MESSAGE_METADATA,
    },
  }
}

export function buildMessengerTemplateComponents(
  params: MessengerTemplateParams,
  parameterFormat: "POSITIONAL" | "NAMED",
  flowContext?: {
    flowId?: string
    flowVersionId?: string
    metadata?: MetadataPayload
    flowButtons?: ButtonStepProps[]
  },
): MessengerTemplateComponent[] {
  const components: MessengerTemplateComponent[] = []

  if (params.header && params.header.length > 0) {
    // Messenger utility image headers are fixed at template creation via
    // header_handle — no image parameter is sent at send-time. Only text
    // placeholders within the header require a parameter here.
    const headerParameters: MessengerTemplateComponentParameter[] =
      params.header
        .filter((param) => param.type === "text")
        .map((param) => {
          const textParam: MessengerTemplateComponentParameter = {
            type: "text" as const,
            text: param.text ?? "",
          }
          if (parameterFormat === "NAMED" && param.parameter_name) {
            textParam.parameter_name = param.parameter_name
          }
          return textParam
        })
    if (headerParameters.length > 0) {
      components.push({ type: "header", parameters: headerParameters })
    }
  }

  if (params.body && params.body.length > 0) {
    const bodyParameters: MessengerTemplateComponentParameter[] =
      params.body.map((param) => {
        const textParam: MessengerTemplateComponentParameter = {
          type: "text" as const,
          text: param.text,
        }
        if (parameterFormat === "NAMED" && param.parameter_name) {
          textParam.parameter_name = param.parameter_name
        }
        return textParam
      })
    components.push({ type: "body", parameters: bodyParameters })
  }

  // URL button components — built from params.button (sub_type "url" only)
  if (params.button && params.button.length > 0) {
    for (const btn of params.button) {
      if (btn.sub_type === "url") {
        components.push(buildUrlButtonComponent(btn))
      }
    }
  }

  // POSTBACK button components — built from flow buttons with encoded payloads
  const flowButtons = flowContext?.flowButtons ?? []
  if (flowButtons.length > 0) {
    const { flowId = "", flowVersionId, metadata } = flowContext ?? {}
    const broadcastId = extractMetadata("broadcastId", metadata)
    const sequenceStepId = extractMetadata("sequenceStepId", metadata)
    for (const button of flowButtons) {
      // startExternalFlow: encode the button's own target flowId without a
      // buttonId so runFlowPostback takes the direct-start path instead of
      // the node-lookup path (which requires a live flow context).
      if (button.buttonType === buttonTypes.enum.startExternalFlow) {
        components.push({
          type: "buttons",
          parameters: [
            {
              type: "POSTBACK",
              payload: encodeButtonPayload({
                flowId: button.beforeStep.flowId,
                broadcastId,
                sequenceStepId,
              }),
            },
          ],
        })
        continue
      }

      components.push({
        type: "buttons",
        parameters: [
          {
            type: "POSTBACK",
            payload: encodeButtonPayload({
              flowId,
              flowVersionId,
              buttonId: button.id,
              broadcastId,
              sequenceStepId,
            }),
          },
        ],
      })
    }
  }

  return components
}

function buildUrlButtonComponent(
  param: MessengerTemplateButtonParam,
): MessengerTemplateComponent {
  return {
    type: "buttons",
    parameters: [{ type: "URL", url: param.text ?? "" }],
  }
}
