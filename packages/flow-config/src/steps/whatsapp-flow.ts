import { createId, zodBigintAsString } from "@chatbotx.io/utils"
import { z } from "zod"
import { baseStepSchema } from "./base"
import { type ButtonStepProps, buttonStepSchema } from "./button"
import { stepTypes } from "./step-action"

export const WHATSAPP_FLOW_BODY_MAX = 1024
export const WHATSAPP_FLOW_BUTTON_MAX = 20
export const WHATSAPP_FLOW_PARAM_KEY_MAX = 64

const UNRESOLVED_VARIABLE_PLACEHOLDER = /^\{\{[^}]+\}\}$/

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isEmptyDropdownId = (id: unknown): boolean => {
  if (typeof id !== "string") {
    return id === null || id === undefined
  }
  const trimmed = id.trim()
  return trimmed.length === 0 || UNRESOLVED_VARIABLE_PLACEHOLDER.test(trimmed)
}

const sanitizeActionDataValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const sanitizedItem = sanitizeActionDataValue(item)
      if (
        isPlainObject(sanitizedItem) &&
        "id" in sanitizedItem &&
        isEmptyDropdownId(sanitizedItem.id)
      ) {
        return []
      }
      return [sanitizedItem]
    })
  }
  if (isPlainObject(value)) {
    const next: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      next[key] = sanitizeActionDataValue(child)
    }
    return next
  }
  return value
}

/** Drops dropdown rows whose `id` is blank or still a `{{variable}}` token. */
export const sanitizeWhatsappFlowActionData = (
  actionData: Record<string, unknown> | null | undefined,
): Record<string, unknown> | undefined => {
  if (!isPlainObject(actionData) || Object.keys(actionData).length === 0) {
    return
  }
  const sanitized = sanitizeActionDataValue(actionData)
  return isPlainObject(sanitized) ? sanitized : undefined
}

export const stringifyWhatsappFlowActionData = (actionData: unknown): string => {
  if (!isPlainObject(actionData) || Object.keys(actionData).length === 0) {
    return ""
  }
  return JSON.stringify(actionData, null, 2)
}

export const parseWhatsappFlowActionDataJson = (
  raw: string,
):
  | { success: true; data: Record<string, unknown> | null }
  | { success: false } => {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return { success: true, data: null }
  }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!isPlainObject(parsed)) {
      return { success: false }
    }
    return { success: true, data: parsed }
  } catch {
    return { success: false }
  }
}

export const whatsappFlowFieldMappingSchema = z.object({
  paramKey: z.string().trim().min(1).max(WHATSAPP_FLOW_PARAM_KEY_MAX),
  paramLabel: z.string().optional(),
  customFieldId: zodBigintAsString().nullable(),
})
export type WhatsappFlowFieldMapping = z.infer<
  typeof whatsappFlowFieldMappingSchema
>

export const whatsappFlowDataSchema = z.object({
  id: zodBigintAsString().nullable(),
  sourceId: z.string(),
  startScreenId: z.string().nullable(),
  fieldMappings: z.array(whatsappFlowFieldMappingSchema),
  actionData: z.record(z.string(), z.unknown()).nullable().optional(),
})
export type WhatsappFlowData = z.infer<typeof whatsappFlowDataSchema>

export const whatsappFlowStepSchema = baseStepSchema.extend({
  stepType: z.literal(stepTypes.enum.whatsappFlow),
  text: z.string().trim().min(1).max(WHATSAPP_FLOW_BODY_MAX),
  buttons: z.array(buttonStepSchema).min(1).max(1),
  inboxId: zodBigintAsString().nullable(),
  flow: whatsappFlowDataSchema,
})
export type WhatsappFlowStepSchema = z.infer<typeof whatsappFlowStepSchema>

export const whatsappFlowDialogFormSchema = z.object({
  buttonLabel: z.string().trim().min(1).max(WHATSAPP_FLOW_BUTTON_MAX),
  flow: whatsappFlowDataSchema.extend({
    id: zodBigintAsString(),
    sourceId: z.string().trim().min(1),
    startScreenId: z.string().trim().min(1),
  }),
})
export type WhatsappFlowDialogFormValues = z.infer<
  typeof whatsappFlowDialogFormSchema
>

export const whatsappFlowDefaultButton = (
  label = "button #1",
): ButtonStepProps => ({
  id: createId(),
  label,
  buttonType: null,
  beforeStep: null,
  steps: [],
})

export const whatsappFlowStepDefaultFn = (
  props: Partial<WhatsappFlowStepSchema> = {},
): WhatsappFlowStepSchema => ({
  text: "",
  buttons: [whatsappFlowDefaultButton()],
  inboxId: null,
  flow: {
    id: null,
    sourceId: "",
    startScreenId: null,
    fieldMappings: [],
    actionData: null,
  },
  ...props,
  id: createId(),
  stepType: stepTypes.enum.whatsappFlow,
})
