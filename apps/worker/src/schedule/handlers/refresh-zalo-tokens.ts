import { zaloIntegrationService } from "@chatbotx.io/business"
import {
  calculateExpiresAt,
  refreshAccessToken,
  type ZaloAuthValue,
} from "@chatbotx.io/integration-zalo"
import { logger } from "../../lib/logger"

export async function refreshZaloTokens(): Promise<void> {
  const integrations = await zaloIntegrationService.findAll()
  logger.info(`[refreshZaloTokens] found=${integrations.length}`)

  for (const integration of integrations) {
    try {
      const auth = integration.auth as ZaloAuthValue
      if (!auth.tokens.refreshToken) {
        logger.warn(
          `[refreshZaloTokens] id=${integration.id} skipped: no refreshToken`,
        )
        continue
      }

      const newTokens = await refreshAccessToken(auth, auth.tokens.refreshToken)

      await zaloIntegrationService.updateAuth(integration.id, {
        ...auth,
        tokens: {
          ...auth.tokens,
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          expiresAt: calculateExpiresAt(newTokens.expires_in),
        },
      })

      logger.info(`[refreshZaloTokens] id=${integration.id} refreshed`)
    } catch (error) {
      logger.error(error, `[refreshZaloTokens] id=${integration.id} failed`)
    }
  }
}
