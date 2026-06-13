"use server"

import { contactSequenceService } from "@chatbotx.io/business/contact-sequence"
import {
  type WorkspaceIdRequestParams,
  workspaceIdrequestParams,
} from "@/features/common/schemas"
import { workspaceActionClient } from "@/lib/safe-action"
import {
  type RemoveContactSequenceRequest,
  removeContactSequenceRequest,
} from "../schemas/contact-sequence"

const CHUNK_SIZE = 1000

export const removeContactSequenceAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(removeContactSequenceRequest)
  .action(
    async ({
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    }: {
      bindArgsParsedInputs: WorkspaceIdRequestParams
      parsedInput: RemoveContactSequenceRequest
    }) => {
      for (let i = 0; i < parsedInput.ids.length; i += CHUNK_SIZE) {
        const contactIdChunk = parsedInput.ids.slice(i, i + CHUNK_SIZE)

        await contactSequenceService.removeContactSequencesForContacts({
          workspaceId,
          contactIds: contactIdChunk,
          sequenceIds: parsedInput.sequences,
          reason: "enrollment_removed",
        })
      }
    },
  )
