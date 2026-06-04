import type { TiktokCredentialPublic } from "@chatbotx.io/database/partials"
import { generateAuthUrl } from "@chatbotx.io/integration-tiktok"
import { getOriginUrlFromHeader } from "@/lib/domain"

export async function generateTiktokRedirectUri(
  publicConfig: TiktokCredentialPublic,
  workspaceId?: string | null,
) {
  const baseUrl = await getOriginUrlFromHeader()
  const redirectUrl = new URL(
    "/integrations/tiktok/callback",
    baseUrl,
  ).toString()
  const referer = workspaceId
    ? new URL(`/space/${workspaceId}/dashboard`, baseUrl).toString()
    : baseUrl

  return generateAuthUrl({
    clientId: publicConfig.clientId,
    redirectUrl,
    stateParams: {
      workspaceId,
      referer,
    },
  })
}
