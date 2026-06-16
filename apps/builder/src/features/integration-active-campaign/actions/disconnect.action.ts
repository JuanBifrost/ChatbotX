"use server"

import { integrationActiveCampaignService } from "@chatbotx.io/business"
import { normalizeError } from "universal-error-normalizer"
import { workspaceIdrequestParams } from "@/features/common/schemas"
import { logger } from "@/lib/log"
import { workspaceActionClient } from "@/lib/safe-action"

export const disconnectActiveCampaignAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .action(async ({ bindArgsParsedInputs: [workspaceId] }) => {
    try {
      await integrationActiveCampaignService.disconnect(workspaceId)
    } catch (error) {
      logger.error(
        { err: normalizeError(error), workspaceId },
        "Failed to disconnect ActiveCampaign",
      )
      throw error
    }
  })
