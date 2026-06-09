"use server"

import { aiFunctionService } from "@chatbotx.io/business"
import { zodBigintAsString } from "@chatbotx.io/utils"
import { getTranslations } from "next-intl/server"
import { workspaceActionClient } from "@/lib/safe-action"

export const deleteAIFunctionAction = workspaceActionClient
  .bindArgsSchemas([zodBigintAsString(), zodBigintAsString()])
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId, aiFunctionId],
    } = props
    const t = await getTranslations()
    return aiFunctionService.deleteAIFunction({ workspaceId, aiFunctionId }, t)
  })
