import { integrationMailchimpService } from "@chatbotx.io/business"
import { encryptedDataSchema, encryptUtils } from "@chatbotx.io/encryption"
import { mailchimpAuthSchema } from "@chatbotx.io/integration-mailchimp"

export const getMailchimpAuth = async (workspaceId: string) => {
  const row =
    await integrationMailchimpService.findByWorkspaceIdOrFail(workspaceId)
  const auth = await encryptUtils.decryptObject(
    encryptedDataSchema.parse(row.auth),
    mailchimpAuthSchema,
  )
  return { auth, row }
}
