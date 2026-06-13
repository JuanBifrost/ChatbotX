import { integrationMailerLiteService } from "@chatbotx.io/business"
import { encryptedDataSchema, encryptUtils } from "@chatbotx.io/encryption"
import { mailerLiteAuthSchema } from "@chatbotx.io/integration-mailer-lite"

export const getMailerLiteAuth = async (workspaceId: string) => {
  const row =
    await integrationMailerLiteService.findByWorkspaceIdOrFail(workspaceId)
  const auth = await encryptUtils.decryptObject(
    encryptedDataSchema.parse(row.auth),
    mailerLiteAuthSchema,
  )
  return { auth, row }
}
