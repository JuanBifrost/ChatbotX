import { db, eq, isDatabaseError } from "@chatbotx.io/database/client"
import {
  integrationModel,
  integrationMoosendModel,
} from "@chatbotx.io/database/schema"
import { encryptUtils } from "@chatbotx.io/encryption"
import type { AuthValue } from "@chatbotx.io/sdk"
import { createId } from "@chatbotx.io/utils"
import { BaseService } from "../base.service"

const WORKSPACE_UNIQUE_CONSTRAINT = "IntegrationMoosend_workspaceId_key"

const isWorkspaceUniqueViolation = (error: unknown): boolean =>
  isDatabaseError(error) &&
  error.cause.code === "23505" &&
  "constraint" in error.cause &&
  error.cause.constraint === WORKSPACE_UNIQUE_CONSTRAINT

class IntegrationMoosendService extends BaseService {
  findByWorkspaceId(workspaceId: string) {
    return db.query.integrationMoosendModel.findFirst({
      where: { workspaceId },
    })
  }

  async findByWorkspaceIdOrFail(workspaceId: string) {
    const integration = await this.findByWorkspaceId(workspaceId)
    if (!integration) {
      throw new Error("Moosend integration not found")
    }
    return integration
  }

  async upsert(props: { workspaceId: string; auth: AuthValue }) {
    const encryptedAuth = await encryptUtils.encryptObject(props.auth)

    const updateExisting = async () => {
      const [updated] = await db
        .update(integrationMoosendModel)
        .set({ auth: encryptedAuth })
        .where(eq(integrationMoosendModel.workspaceId, props.workspaceId))
        .returning({ id: integrationMoosendModel.id })
      return updated?.id
    }

    const existingId = await updateExisting()
    if (existingId) {
      return existingId
    }

    const integrationId = createId()
    const moosendId = createId()
    try {
      await db.transaction(async (tx) => {
        await tx.insert(integrationModel).values({
          id: integrationId,
          workspaceId: props.workspaceId,
          integrationType: "moosend",
        })
        await tx.insert(integrationMoosendModel).values({
          id: moosendId,
          workspaceId: props.workspaceId,
          integrationId,
          auth: encryptedAuth,
        })
      })
      return moosendId
    } catch (error) {
      if (!isWorkspaceUniqueViolation(error)) {
        throw error
      }
      const winnerId = await updateExisting()
      if (!winnerId) {
        throw error
      }
      return winnerId
    }
  }

  async disconnect(workspaceId: string) {
    const existing = await this.findByWorkspaceId(workspaceId)
    if (!existing) {
      return
    }
    await db.transaction(async (tx) => {
      await tx
        .delete(integrationMoosendModel)
        .where(eq(integrationMoosendModel.id, existing.id))
      await tx
        .delete(integrationModel)
        .where(eq(integrationModel.id, existing.integrationId))
    })
  }
}

export const integrationMoosendService = new IntegrationMoosendService()
