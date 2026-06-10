import { createId, zodBigintAsString } from "@chatbotx.io/utils"
import { z } from "zod"
import {
  errorStateDefaultFn,
  errorStateSchema,
  successStateDefaultFn,
  successStateSchema,
} from "../states"
import { stepTypes } from "./step-action"

export const mailchimpMergeFieldMappingSchema = z.object({
  tag: z.string().min(1),
  name: z.string().optional(),
  type: z.string().optional(),
  customFieldId: z.string(),
})

export const mailchimpAddMemberSchema = z.object({
  id: zodBigintAsString(),
  stepType: z.literal(stepTypes.enum.mailchimpAddMember),
  listId: z.string().min(1),
  email: z.string().min(1),
  doubleOptIn: z.boolean(),
  tags: z.array(z.string()),
  mergeFields: z.array(mailchimpMergeFieldMappingSchema),
  states: z.tuple([successStateSchema, errorStateSchema]),
})
export type MailchimpAddMemberSchema = z.infer<typeof mailchimpAddMemberSchema>

export const mailchimpAddMemberDefaultFn = (): MailchimpAddMemberSchema => ({
  id: createId(),
  stepType: stepTypes.enum.mailchimpAddMember,
  listId: "",
  email: "email",
  doubleOptIn: false,
  tags: [],
  mergeFields: [],
  states: [successStateDefaultFn(), errorStateDefaultFn()],
})
