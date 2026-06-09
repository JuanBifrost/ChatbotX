import { db, eq } from "@chatbotx.io/database/client"
import { webhookModel } from "@chatbotx.io/database/schema"
import type { WebhookModel } from "@chatbotx.io/database/types"
import { BaseService } from "../base.service"

class WebhookService extends BaseService {
  async listByWorkspaceId(workspaceId: string): Promise<WebhookModel[]> {
    return await db
      .select()
      .from(webhookModel)
      .where(eq(webhookModel.workspaceId, workspaceId))
  }
}

export const webhookService = new WebhookService()
