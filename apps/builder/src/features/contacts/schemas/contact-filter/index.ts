import {
  type FormFieldType,
  formFieldTypes,
  type OperatorType,
} from "@chatbotx.io/database/partials"
import { z } from "zod"
import { booleanOperators } from "./boolean-filter"
import { datetimeOperators } from "./datetime-filter"
import { contactFilterConditionSchemas } from "./definitions"
import { multiSelectOperators } from "./multi-select-filter"
import { numberOperators } from "./number"
import { selectOperators } from "./select-filter"
import { textOperators } from "./text-filter"

export {
  CONTACT_FILTER_FIELD_DEFINITIONS,
  type ContactFilterFieldDefinition,
  type ContactFilterOptionSource,
  type ContactFilterSchemaKind,
  contactFilterConditionSchemas,
} from "./definitions"

export const mappingConditions: Record<FormFieldType, OperatorType[]> = {
  [formFieldTypes.enum.multiSelect]: multiSelectOperators,
  [formFieldTypes.enum.select]: selectOperators,
  [formFieldTypes.enum.text]: textOperators,
  [formFieldTypes.enum.boolean]: booleanOperators,
  [formFieldTypes.enum.datetime]: datetimeOperators,
  [formFieldTypes.enum.number]: numberOperators,
}

export type ContactFilterCondition = z.infer<
  (typeof contactFilterConditionSchemas)[number]
>

/** One validated condition row (matches `conditions` elements in {@link contactFilterCriteriaSchema}). */
// The trailing cast keeps `z.infer` aligned with the value the resolver derives —
// without it, Zod v4 widens the dynamic-array discriminated union output to
// `unknown`, diverging from react-hook-form's inferred field type. The runtime
// object is the real discriminated union; only the static output type is pinned.
export const singleContactFilterConditionSchema = z.discriminatedUnion(
  "field",
  // Zod v4 narrows discriminatedUnion options tighter than inferred schema tuples.
  // @ts-expect-error Expected readonly [$ZodTypeDiscriminable, ...]; runtime union is correct.
  contactFilterConditionSchemas,
) as unknown as z.ZodType<ContactFilterCondition>

export const contactFilterCriteriaSchema = z.object({
  operator: z.enum(["and", "or"]),
  conditions: z.array(singleContactFilterConditionSchema),
})

export type ContactFilterCriteria = z.infer<typeof contactFilterCriteriaSchema>

export const contactFilterRequest = z.object({
  contactFilter: contactFilterCriteriaSchema,
})
export type ContactFilterRequest = z.infer<typeof contactFilterRequest>
