import { type DatabaseClient, db } from "@chatbotx.io/database/client"
import type { ContactInboxModel } from "@chatbotx.io/database/types"

export const contactsOnSequencesUtils = {
  getAllSequenceIds: async (
    dbClient: DatabaseClient,
    where: { contactId: string },
  ): Promise<string[]> =>
    await dbClient.query.contactsOnSequenceModel
      .findMany({
        where,
        columns: {
          sequenceId: true,
        },
      })
      .then((sequences) => sequences.map((s) => s.sequenceId)),

  calculateSequenceDiff: (
    currentSequenceIds: string[],
    newSequenceIds: string[],
  ): { toAdd: string[]; toRemove: string[] } => {
    const currentSequenceIdSet = new Set(currentSequenceIds)
    const newSequenceIdSet = new Set(newSequenceIds)

    const toAdd = [...newSequenceIdSet].filter(
      (sequenceId) => !currentSequenceIdSet.has(sequenceId),
    )
    const toRemove = [...currentSequenceIdSet].filter(
      (sequenceId) => !newSequenceIdSet.has(sequenceId),
    )

    return { toAdd, toRemove }
  },
}

export type ContactsOnSequencesUtils = typeof contactsOnSequencesUtils

export async function getContactInboxes(
  workspaceId: string,
  contactId: string,
): Promise<ContactInboxModel[]> {
  const inboxes = await db.query.inboxModel.findMany({
    where: {
      workspaceId,
    },
    columns: {
      id: true,
    },
  })

  if (inboxes.length === 0) {
    return []
  }

  const contactInboxes = await db.query.contactInboxModel.findMany({
    where: {
      contactId,
      inboxId: {
        in: inboxes.map((inbox) => inbox.id),
      },
    },
  })

  return contactInboxes
}
