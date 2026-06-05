import type { MessengerCredentialPublic } from "@chatbotx.io/database/partials"
import { generateAuthUrl } from "@chatbotx.io/integration-messenger"
import { getOriginUrlFromHeader } from "@/lib/domain"

export async function generateMessengerRedirectUri(
  publicConfig: MessengerCredentialPublic,
  workspaceId?: string | null,
) {
  const baseUrl = await getOriginUrlFromHeader()
  const redirectUrl = new URL(
    "/integrations/messenger/callback",
    baseUrl,
  ).toString()
  const referer = workspaceId
    ? new URL(`/space/${workspaceId}/dashboard`, baseUrl).toString()
    : baseUrl

  return generateAuthUrl({
    clientId: publicConfig.clientId,
    version: publicConfig.version,
    redirectUrl,
    stateParams: {
      workspaceId,
      referer,
    },
  })
}
