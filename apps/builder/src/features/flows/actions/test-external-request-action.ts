"use server"

import { contactInboxService, externalRequestService } from "@chatbotx.io/business"
import {
  type ExternalRequestFieldsSchema,
  externalRequestFieldsSchema,
} from "@chatbotx.io/flow-config"
import { resolveContactVariablesDeep } from "@chatbotx.io/variables"
import { z } from "zod"
import {
  type WorkspaceIdRequestParams,
  workspaceIdrequestParams,
} from "@/features/common/schema"
import {
  assertTestContactAccess,
  pickPreferredTestInbox,
} from "@/features/flows/lib/load-test-contact-variables"
import { workspaceActionClient } from "@/lib/safe-action"

const testExternalRequestInputSchema = z.intersection(
  externalRequestFieldsSchema,
  z.object({
    contactId: z.string().trim().min(1).optional(),
  }),
)

type TestExternalRequestInput = z.infer<typeof testExternalRequestInputSchema>

export const testExternalRequestAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(testExternalRequestInputSchema)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    }: {
      bindArgsParsedInputs: WorkspaceIdRequestParams
      parsedInput: TestExternalRequestInput
    }) => {
      const { contactId, ...requestFields } = parsedInput
      let input: ExternalRequestFieldsSchema = requestFields

      if (contactId) {
        await assertTestContactAccess({ workspaceId, contactId })
        const inboxes = await contactInboxService.listByContactId({
          workspaceId,
          contactId,
        })
        input = await resolveContactVariablesDeep(contactId, requestFields, {
          contactInbox: pickPreferredTestInbox(inboxes) ?? "",
        })
      }

      const result = await externalRequestService.execute(input, {
        workspaceId,
        contactId,
      })

      return {
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        responseBody: result.responseBody,
      }
    },
  )
