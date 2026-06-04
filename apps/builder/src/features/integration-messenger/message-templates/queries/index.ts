import { type DatabaseClient, db } from "@chatbotx.io/database/client"
import type { MessengerTemplateStatus } from "@chatbotx.io/database/partials"
import type { ListMessengerMessageTemplatesResponse } from "@/features/integration-messenger/message-templates/schema/query"

export const messengerMessageTemplateService = {
  list: async (props: {
    tx?: DatabaseClient
    where: {
      workspaceId: string
      inboxId?: string
      integrationMessengerId?: string
      status?: MessengerTemplateStatus
    }
  }): Promise<ListMessengerMessageTemplatesResponse> => {
    const { tx = db, where } = props

    // Resolve integrationMessengerId from inboxId when only inboxId is given.
    // Relying on nested relational filtering for inboxId is fragile and ORM-
    // version-sensitive because messengerMessageTemplateModel has no direct
    // inboxId column.
    let resolvedIntegrationMessengerId = where.integrationMessengerId

    if (!resolvedIntegrationMessengerId && where.inboxId) {
      const integration = await tx.query.integrationMessengerModel.findFirst({
        where: {
          workspaceId: where.workspaceId,
          inboxId: where.inboxId,
        },
        columns: { id: true },
      })
      resolvedIntegrationMessengerId = integration?.id
    }

    return tx.query.messengerMessageTemplateModel.findMany({
      where: {
        status: where.status,
        integrationMessengerId: resolvedIntegrationMessengerId,
        integrationMessenger: {
          workspaceId: where.workspaceId,
        },
      },
      with: {
        integrationMessenger: true,
      },
      orderBy: { createdAt: "asc" },
    })
  },
}
