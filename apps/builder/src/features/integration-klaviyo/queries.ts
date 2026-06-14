import { buildContext, integrationKlaviyoService } from "@chatbotx.io/business"
import { encryptedDataSchema, encryptUtils } from "@chatbotx.io/encryption"
import { klaviyoAuthSchema } from "@chatbotx.io/integration-klaviyo"

export const getKlaviyoContext = async (workspaceId: string) => {
  const row =
    await integrationKlaviyoService.findByWorkspaceIdOrFail(workspaceId)
  const auth = await encryptUtils.decryptObject(
    encryptedDataSchema.parse(row.auth),
    klaviyoAuthSchema,
  )
  return buildContext({
    workspaceId,
    integrationType: "klaviyo",
    integration: { ...row, auth },
  })
}
