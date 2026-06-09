import {
  type DatabaseClient,
  db,
  eq,
  type RelationsFieldFilter,
} from "@chatbotx.io/database/client"
import type { AIMcpServerAuth } from "@chatbotx.io/database/partials"
import { aiMCPServerModel } from "@chatbotx.io/database/schema"
import type { AIMCPServerModel } from "@chatbotx.io/database/types"
import { createId } from "@chatbotx.io/utils"
import { BaseService } from "../base.service"

type FindByProps = {
  tx?: DatabaseClient
  where: Partial<{
    id?: RelationsFieldFilter<string>
    workspaceId?: RelationsFieldFilter<string>
    name?: RelationsFieldFilter<string>
  }>
}

export type CreateAIMcpServerRequest = {
  name: string
  url: string
  auth: AIMcpServerAuth
  availableTools: Record<string, unknown>
  selectedTools: string[]
}

export type UpdateAIMcpServerRequest = CreateAIMcpServerRequest

class AiMcpServerService extends BaseService {
  async findBy(props: FindByProps): Promise<AIMCPServerModel | undefined> {
    const { tx = db, where } = props
    return await tx.query.aiMCPServerModel.findFirst({
      where,
    })
  }

  async list(props: {
    tx?: DatabaseClient
    where: Partial<{
      workspaceId?: string
    }>
  }): Promise<AIMCPServerModel[]> {
    const { tx = db, where } = props
    return await tx.query.aiMCPServerModel.findMany({
      where,
    })
  }

  async create(workspaceId: string, data: CreateAIMcpServerRequest) {
    return await db
      .insert(aiMCPServerModel)
      .values({
        ...data,
        id: createId(),
        workspaceId,
      })
      .returning()
  }

  async update(id: string, data: UpdateAIMcpServerRequest) {
    return await db
      .update(aiMCPServerModel)
      .set(data)
      .where(eq(aiMCPServerModel.id, id))
      .returning()
  }

  async delete(id: string) {
    return await db
      .delete(aiMCPServerModel)
      .where(eq(aiMCPServerModel.id, id))
      .returning()
  }
}

export const aiMcpServerService = new AiMcpServerService()
