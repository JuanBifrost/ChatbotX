import { refLinkStatModel } from "@chatbotx.io/database/schema"
import { LinkStatsRepository } from "./link-stats.repository"

export const refLinkStatsRepository = new LinkStatsRepository(
  refLinkStatModel,
  {
    workspaceId: refLinkStatModel.workspaceId,
    linkId: refLinkStatModel.linkId,
    contactInboxId: refLinkStatModel.contactInboxId,
    occurredAt: refLinkStatModel.occurredAt,
  },
)
