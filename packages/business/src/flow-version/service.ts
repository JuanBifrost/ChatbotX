import { and, db, desc, eq } from "@chatbotx.io/database/client"
import { flowModel, flowVersionModel } from "@chatbotx.io/database/schema"
import type { FlowVersionModel } from "@chatbotx.io/database/types"
import { withCache } from "@chatbotx.io/redis"
import { BaseService } from "../base.service"
import { notFoundException } from "../errors"

class FlowVersionService extends BaseService {
  async list({
    flowId,
    workspaceId,
  }: {
    flowId: string
    workspaceId: string
  }): Promise<FlowVersionModel[]> {
    return await withCache(
      `flows:${flowId}:versions`,
      () =>
        db.query.flowVersionModel.findMany({
          where: { flowId, workspaceId, isDraft: false },
          orderBy: (table) => [desc(table.isLatest), desc(table.createdAt)],
        }),
      { tags: [`flows:${flowId}:versions`] },
    )
  }

  async findById({
    versionId,
    flowId,
    workspaceId,
  }: {
    versionId: string
    flowId: string
    workspaceId: string
  }): Promise<FlowVersionModel> {
    const version = await db.query.flowVersionModel.findFirst({
      where: { id: versionId, flowId, workspaceId, isDraft: false },
    })
    if (!version) {
      throw notFoundException("Flow version not found")
    }
    return version
  }

  async restore({ version }: { version: FlowVersionModel }): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(flowVersionModel)
        .set({ isLatest: false })
        .where(
          and(
            eq(flowVersionModel.flowId, version.flowId),
            eq(flowVersionModel.isLatest, true),
          ),
        )

      await tx
        .update(flowVersionModel)
        .set({ isLatest: true })
        .where(eq(flowVersionModel.id, version.id))

      await tx
        .update(flowModel)
        .set({ currentVersionId: version.id })
        .where(eq(flowModel.id, version.flowId))

      // Update draft version
      await tx
        .update(flowVersionModel)
        .set({
          nodes: version.nodes,
          edges: version.edges,
          startNodeId: version.startNodeId,
        })
        .where(
          and(
            eq(flowVersionModel.flowId, version.flowId),
            eq(flowVersionModel.isDraft, true),
          ),
        )
    })

    await this.invalidateCacheTags(`flows:${version.flowId}:versions`)
  }

  async invalidateList(flowId: string): Promise<void> {
    await this.invalidateCacheTags(`flows:${flowId}:versions`)
  }
}

export const flowVersionService = new FlowVersionService()
