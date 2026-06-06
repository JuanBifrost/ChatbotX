import type { DatabaseClient } from "../../client"
import { db } from "../../client"
import { ConversationEmbeddingRepository } from "./repository"

export function createConversationEmbeddingRepository(
  client: DatabaseClient = db,
): ConversationEmbeddingRepository {
  return new ConversationEmbeddingRepository(client)
}

export {
  type AiConversationEmbeddingModel,
  ConversationEmbeddingRepository,
  type EmbeddingChunkInput,
  type VectorSearchRow,
} from "./repository"
