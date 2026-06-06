import type { DatabaseClient } from "../../client"
import { db } from "../../client"
import { ConversationSourceRepository } from "./repository"

export function createConversationSourceRepository(
  client: DatabaseClient = db,
): ConversationSourceRepository {
  return new ConversationSourceRepository(client)
}

export {
  type AiConversationSourceModel,
  type AiConversationSourceWithAttachment,
  ConversationSourceRepository,
  type CreateConversationSourceInput,
  type UpdateConversationSourceInput,
} from "./repository"
