import {
  contactCustomFieldService,
  contactService,
} from "@chatbotx.io/business"
import { systemFieldTypes } from "@chatbotx.io/database/partials"

export const getContactFieldMap = async (props: {
  workspaceId: string
  contactId: string
}): Promise<Record<string, string>> => {
  const [contact, customFields] = await Promise.all([
    contactService.findByIdOrFail({
      workspaceId: props.workspaceId,
      id: props.contactId,
    }),
    contactCustomFieldService.listValues({ contactId: props.contactId }),
  ])

  return {
    [systemFieldTypes.enum.first_name]: contact.firstName ?? "",
    [systemFieldTypes.enum.last_name]: contact.lastName ?? "",
    [systemFieldTypes.enum.full_name]: contact.fullName ?? "",
    [systemFieldTypes.enum.email]: contact.email ?? "",
    [systemFieldTypes.enum.phone]: contact.phoneNumber ?? "",
    [systemFieldTypes.enum.avatar]: contact.avatar ?? "",
    [systemFieldTypes.enum.locale]: contact.locale ?? "",
    [systemFieldTypes.enum.gender]: contact.gender ?? "",
    [systemFieldTypes.enum.timezone]: contact.timezone ?? "",
    [systemFieldTypes.enum.user_id]: contact.id,
    [systemFieldTypes.enum.workspace_id]: props.workspaceId,
    ...Object.fromEntries(
      customFields.map((field) => [field.customFieldId, field.value]),
    ),
  }
}
