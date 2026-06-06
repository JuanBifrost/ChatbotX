import { and, desc, eq, inArray, ne } from "drizzle-orm"
import type { DatabaseClient } from "../../client"
import type {
  AIConversationSourceStatus,
  AIConversationSourceType,
} from "../../partials"
import { aiConversationSourceModel, attachmentModel } from "../../schema"
import type { AttachmentModel } from "../../types"

export type AiConversationSourceModel =
  typeof aiConversationSourceModel.$inferSelect

export type AiConversationSourceWithAttachment = AiConversationSourceModel & {
  attachment: AttachmentModel | null
}

export type CreateConversationSourceInput = {
  id: string
  attachmentId?: null | string
  conversationId: string
  messageId: string
  metadata?: null | Record<string, unknown>
  mimeType?: null | string
  sourceKey: string
  sourceType: AIConversationSourceType
  status: AIConversationSourceStatus
  title?: null | string
  workspaceId: string
}

export type UpdateConversationSourceInput = Partial<{
  contentHash: null | string
  errorMessage: null | string
  metadata: null | Record<string, unknown>
  status: AIConversationSourceStatus
  summary: null | string
  updatedAt: Date
}>

export class ConversationSourceRepository {
  private readonly client: DatabaseClient

  constructor(client: DatabaseClient) {
    this.client = client
  }

  findByKey(params: {
    sourceKey: string
    sourceType: AIConversationSourceType
    workspaceId: string
  }): Promise<AiConversationSourceModel | undefined> {
    return this.client.query.aiConversationSourceModel.findFirst({
      where: {
        workspaceId: params.workspaceId,
        sourceType: params.sourceType,
        sourceKey: params.sourceKey,
      },
    })
  }

  findLatestByConversation(params: {
    conversationId: string
    sourceType: AIConversationSourceType
    workspaceId: string
  }): Promise<AiConversationSourceModel | undefined> {
    return this.client.query.aiConversationSourceModel.findFirst({
      where: {
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
        sourceType: params.sourceType,
      },
      orderBy: (table) => [desc(table.createdAt)],
    })
  }

  findByIdWithAttachment(
    id: string,
  ): Promise<AiConversationSourceWithAttachment | undefined> {
    return this.client.query.aiConversationSourceModel.findFirst({
      where: { id },
      with: { attachment: true },
    }) as Promise<AiConversationSourceWithAttachment | undefined>
  }

  async createOrIgnore(
    values: CreateConversationSourceInput,
  ): Promise<AiConversationSourceModel | undefined> {
    const created = await this.client
      .insert(aiConversationSourceModel)
      .values(values)
      .onConflictDoNothing({
        target: [
          aiConversationSourceModel.workspaceId,
          aiConversationSourceModel.sourceType,
          aiConversationSourceModel.sourceKey,
        ],
      })
      .returning()
      .then((rows) => rows[0])

    return (
      created ??
      this.findByKey({
        workspaceId: values.workspaceId,
        sourceType: values.sourceType,
        sourceKey: values.sourceKey,
      })
    )
  }

  update(
    id: string,
    set: UpdateConversationSourceInput,
  ): Promise<AiConversationSourceModel | undefined> {
    return this.client
      .update(aiConversationSourceModel)
      .set({ ...set, updatedAt: set.updatedAt ?? new Date() })
      .where(eq(aiConversationSourceModel.id, id))
      .returning()
      .then((rows) => rows[0])
  }

  findDocumentAttachments(params: {
    conversationId: string
    limit: number
    supportedMimeTypes: string[]
    workspaceId: string
  }): Promise<AttachmentModel[]> {
    return this.client
      .select()
      .from(attachmentModel)
      .where(
        and(
          eq(attachmentModel.workspaceId, params.workspaceId),
          eq(attachmentModel.conversationId, params.conversationId),
          inArray(attachmentModel.mimeType, params.supportedMimeTypes),
        ),
      )
      .orderBy(desc(attachmentModel.createdAt))
      .limit(params.limit)
  }

  async deleteOlderByConversation(params: {
    conversationId: string
    exceptSourceKey: string
    sourceType: AIConversationSourceType
    workspaceId: string
  }): Promise<void> {
    await this.client
      .delete(aiConversationSourceModel)
      .where(
        and(
          eq(aiConversationSourceModel.workspaceId, params.workspaceId),
          eq(aiConversationSourceModel.conversationId, params.conversationId),
          eq(aiConversationSourceModel.sourceType, params.sourceType),
          ne(aiConversationSourceModel.sourceKey, params.exceptSourceKey),
        ),
      )
  }

  findAttachmentsByConversation(params: {
    conversationId: string
    limit: number
    workspaceId: string
  }): Promise<AttachmentModel[]> {
    return this.client.query.attachmentModel.findMany({
      where: {
        workspaceId: params.workspaceId,
        conversationId: params.conversationId,
      },
      orderBy: { createdAt: "desc" },
      limit: params.limit,
    })
  }
}
