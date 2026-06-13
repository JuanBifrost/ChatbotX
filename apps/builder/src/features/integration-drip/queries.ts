import { buildContext, integrationDripService } from "@chatbotx.io/business"
import { encryptedDataSchema, encryptUtils } from "@chatbotx.io/encryption"
import { dripAuthSchema } from "@chatbotx.io/integration-drip"

const getDripAuth = async (workspaceId: string) => {
  const row = await integrationDripService.findByWorkspaceIdOrFail(workspaceId)
  const auth = await encryptUtils.decryptObject(
    encryptedDataSchema.parse(row.auth),
    dripAuthSchema,
  )
  return { auth, row }
}

export const getDripContext = async (workspaceId: string) => {
  const { auth, row } = await getDripAuth(workspaceId)
  return buildContext({
    workspaceId,
    integrationType: "drip",
    integration: { ...row, auth },
  })
}
