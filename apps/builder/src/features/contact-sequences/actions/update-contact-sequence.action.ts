"use server"

import { contactService } from "@chatbotx.io/business"
import { contactSequenceService } from "@chatbotx.io/business/contact-sequence"
import { workspaceIdrequestParams } from "@/features/common/schemas"
import { workspaceActionClient } from "@/lib/safe-action"
import { updateContactSequenceRequest } from "../schema"

export const updateContactSequenceAction = workspaceActionClient
  .bindArgsSchemas(workspaceIdrequestParams)
  .inputSchema(updateContactSequenceRequest)
  .action(async (props) => {
    const {
      bindArgsParsedInputs: [workspaceId],
      parsedInput,
    } = props

    const contact = await contactService.findByIdOrFail({
      workspaceId,
      id: parsedInput.contactId,
    })

    return await contactSequenceService.updateContactSequences({
      workspaceId,
      contactId: contact.id,
      sequenceIds: parsedInput.sequences,
    })
  })
