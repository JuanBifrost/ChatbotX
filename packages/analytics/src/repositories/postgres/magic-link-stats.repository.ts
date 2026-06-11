import { magicLinkStatModel } from "@chatbotx.io/database/schema"
import { LinkStatsRepository } from "./link-stats.repository"

export const magicLinkStatsRepository = new LinkStatsRepository(
  magicLinkStatModel,
  {
    workspaceId: magicLinkStatModel.workspaceId,
    linkId: magicLinkStatModel.linkId,
    contactInboxId: magicLinkStatModel.contactInboxId,
    occurredAt: magicLinkStatModel.occurredAt,
  },
)
