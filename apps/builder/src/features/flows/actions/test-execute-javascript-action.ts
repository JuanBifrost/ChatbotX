"use server"

import { javascriptExecutionService } from "@chatbotx.io/business/javascript-execution"
import { buildJavascriptSandboxInput } from "@chatbotx.io/variables"
import { z } from "zod"
import {
  type WorkspaceIdRequestParams,
  workspaceIdrequestParams,
} from "@/features/common/schema"
import { loadTestContactVariables } from "@/features/flows/lib/load-test-contact-variables"
import { stringifySandboxValue } from "@/features/flows/lib/stringify-sandbox-value"
import { workspaceActionClient } from "@/lib/safe-action"

const testExecuteJavascriptInputSchema = z.object({
  code: z.string().trim().min(1),
  contactId: z.string().trim().min(1),
})

export const testExecuteJavascriptAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(testExecuteJavascriptInputSchema)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    }: {
      bindArgsParsedInputs: WorkspaceIdRequestParams
      parsedInput: z.infer<typeof testExecuteJavascriptInputSchema>
    }) => {
      const variables = await loadTestContactVariables({
        workspaceId,
        contactId: parsedInput.contactId,
      })
      const { code, input } = await buildJavascriptSandboxInput(
        parsedInput.code,
        variables,
      )

      const startedAt = performance.now()
      const result = await javascriptExecutionService.execute({
        code,
        input,
      })
      const durationMs = Math.round(performance.now() - startedAt)

      return {
        statusCode: 200,
        durationMs,
        responseBody: stringifySandboxValue(result.value),
      }
    },
  )
