import { db, eq } from "@chatbotx.io/database/client"
import { integrationModel } from "@chatbotx.io/database/schema"
import type { IntegrationModel } from "@chatbotx.io/database/types"
import { BaseService } from "../base.service"

class IntegrationService extends BaseService {
  async listByWorkspaceId(workspaceId: string): Promise<IntegrationModel[]> {
    return await db
      .select()
      .from(integrationModel)
      .where(eq(integrationModel.workspaceId, workspaceId))
  }
}

export const integrationService = new IntegrationService()
