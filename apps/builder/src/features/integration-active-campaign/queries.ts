import {
  buildContext,
  integrationActiveCampaignService,
} from "@chatbotx.io/business"
import { encryptedDataSchema, encryptUtils } from "@chatbotx.io/encryption"
import { activeCampaignAuthSchema } from "@chatbotx.io/integration-active-campaign"

const getActiveCampaignAuth = async (workspaceId: string) => {
  const row =
    await integrationActiveCampaignService.findByWorkspaceIdOrFail(workspaceId)
  const auth = await encryptUtils.decryptObject(
    encryptedDataSchema.parse(row.auth),
    activeCampaignAuthSchema,
  )
  return { auth, row }
}

export const getActiveCampaignContext = async (workspaceId: string) => {
  const { auth, row } = await getActiveCampaignAuth(workspaceId)
  return buildContext({
    workspaceId,
    integrationType: "activeCampaign",
    integration: { ...row, auth },
  })
}
