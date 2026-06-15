import { zodBigintAsString } from "@chatbotx.io/utils"
import { z } from "zod"
import type { FlowNode } from "./nodes"
import type { BaseStepSchema } from "./steps/base"
import type { ButtonStepProps } from "./steps/button"
import type { SendCardStepSchema } from "./steps/send-card"
import type { WhatsappOptionListItem } from "./steps/whatsapp-option-list"

export const extractMetadata = (
  key: string,
  metadata?: { [key: string]: string },
): string | undefined => {
  if (!metadata) {
    return
  }

  return metadata[key] || undefined
}

export const buttonPayloadSchema = z
  .object({
    f: zodBigintAsString(),
    fv: zodBigintAsString().optional(),
    b: zodBigintAsString().optional(),
    br: zodBigintAsString().optional(),
    ss: zodBigintAsString().optional(),
    cid: zodBigintAsString().optional(),
  })
  .transform((data) => ({
    flowId: data.f,
    ...(data.fv ? { flowVersionId: data.fv } : {}),
    ...(data.b ? { buttonId: data.b } : {}),
    ...(data.br ? { broadcastId: data.br } : {}),
    ...(data.ss ? { sequenceStepId: data.ss } : {}),
    ...(data.cid ? { contactInboxId: data.cid } : {}),
  }))
export type ButtonPayload = z.infer<typeof buttonPayloadSchema>

export const encodeButtonPayload = (props: ButtonPayload): string => {
  const parts = [
    props.flowId,
    props.flowVersionId ?? "",
    props.buttonId ?? "",
    props.broadcastId ?? "",
    props.sequenceStepId ?? "",
    props.contactInboxId ?? "",
  ]
  while (parts.length > 2 && parts.at(-1) === "") {
    parts.pop()
  }
  return parts.join(":")
}

export const decodeButtonPayload = (payload: string): ButtonPayload | null => {
  try {
    if (payload.includes(":")) {
      const [f, fv, b, br, ss, cid] = payload.split(":")
      return buttonPayloadSchema.parse({
        f,
        fv: fv || undefined,
        b: b || undefined,
        br: br || undefined,
        ss: ss || undefined,
        cid: cid || undefined,
      })
    }
    // Legacy format: base64+JSON (payloads encoded before the colon format)
    return buttonPayloadSchema.parse(JSON.parse(atob(payload)))
  } catch {
    return null
  }
}

const MAGIC_LINK_PATHNAME_REGEX = /^\/r\/[^/]+\/[^/]+/
export const isMagicLinkUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)

    return MAGIC_LINK_PATHNAME_REGEX.test(urlObj.pathname)
  } catch {
    return false
  }
}

export const appendCodeToMagicLink = (url: string, code: string): string => {
  if (!isMagicLinkUrl(url)) {
    return url
  }

  const urlObj = new URL(url)
  urlObj.searchParams.set("code", code)
  return urlObj.toString()
}

export function getNodeFromButton(nodes: FlowNode[], buttonId: string) {
  let foundedButton: ButtonStepProps | null = null
  let foundedNodeId: string | null = null

  for (const node of nodes) {
    if (!("steps" in node.data.details && node.data.details.steps)) {
      continue
    }
    for (const step of node.data.details.steps as BaseStepSchema[]) {
      if (!("buttons" in step || "cards" in step || "options" in step)) {
        continue
      }

      let buttons: ButtonStepProps[] = []
      if ("buttons" in step) {
        buttons = step.buttons as ButtonStepProps[]
      } else if ("cards" in step) {
        const cards = step.cards as SendCardStepSchema[]
        buttons = cards.flatMap(
          (card) => (card.buttons ?? []) as ButtonStepProps[],
        )
      }

      const button = buttons.find((b) => b.id === buttonId)
      if (button) {
        foundedButton = button
        foundedNodeId = step.nodeId ?? node.id
        break
      }

      if ("options" in step) {
        const options = (step.options ?? []) as WhatsappOptionListItem[]
        const option = options.find((o) => o.id === buttonId)
        if (option) {
          foundedButton = {
            id: option.id,
            label: option.title,
            buttonType: null,
            beforeStep: null,
            steps: [],
          }
          foundedNodeId = step.nodeId ?? node.id
          break
        }
      }
    }
    if (foundedButton) {
      break
    }
  }

  return {
    button: foundedButton,
    nodeId: foundedNodeId,
  }
}
