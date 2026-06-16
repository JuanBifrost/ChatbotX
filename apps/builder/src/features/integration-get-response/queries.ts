import { integrationGetResponseService } from "@chatbotx.io/business"
import { encryptedDataSchema, encryptUtils } from "@chatbotx.io/encryption"
import { getResponseAuthSchema } from "@chatbotx.io/integration-get-response"

export const getGetResponseAuth = async (workspaceId: string) => {
  const row =
    await integrationGetResponseService.findByWorkspaceIdOrFail(workspaceId)
  const auth = await encryptUtils.decryptObject(
    encryptedDataSchema.parse(row.auth),
    getResponseAuthSchema,
  )
  return { auth, row }
}
