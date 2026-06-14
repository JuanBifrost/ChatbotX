"use server"

import { integrationSendGridService } from "@chatbotx.io/business"
import { normalizeError } from "universal-error-normalizer"
import { workspaceIdrequestParams } from "@/features/common/schemas"
import { logger } from "@/lib/log"
import { workspaceActionClient } from "@/lib/safe-action"

export const disconnectSendGridAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .action(async ({ bindArgsParsedInputs: [workspaceId] }) => {
    try {
      await integrationSendGridService.disconnect(workspaceId)
    } catch (error) {
      logger.error(
        { err: normalizeError(error), workspaceId },
        "Failed to disconnect SendGrid",
      )
      throw error
    }
  })
