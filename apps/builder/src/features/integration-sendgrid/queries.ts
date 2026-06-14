import { buildContext, integrationSendGridService } from "@chatbotx.io/business"
import { encryptedDataSchema, encryptUtils } from "@chatbotx.io/encryption"
import { sendGridAuthSchema } from "@chatbotx.io/integration-sendgrid"

export const getSendGridContext = async (workspaceId: string) => {
  const row =
    await integrationSendGridService.findByWorkspaceIdOrFail(workspaceId)
  const auth = await encryptUtils.decryptObject(
    encryptedDataSchema.parse(row.auth),
    sendGridAuthSchema,
  )
  return buildContext({
    workspaceId,
    integrationType: "sendGrid",
    integration: { ...row, auth },
  })
}
