import { db } from "@chatbotx.io/database/client"
import type {
  ListContactTagsRequest,
  ListContactTagsResponse,
} from "../schemas/contact-tag"

export async function listContactTags(
  input: ListContactTagsRequest,
): Promise<ListContactTagsResponse> {
  const data = await db.query.tagModel.findMany({
    where: {
      workspaceId: input.workspaceId,
      deletedAt: { isNull: true as const },
      contactsToTags: {
        contactId: input.contactId,
      },
    },
  })

  return {
    data,
  }
}
