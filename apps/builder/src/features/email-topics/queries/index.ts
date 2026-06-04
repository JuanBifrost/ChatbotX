import { emailTopicService } from "@chatbotx.io/business"
import { assertCurrentUserCanAccessChatbot } from "@/lib/auth/utils"
import type { ListEmailTopicsRequest } from "../schema/query"

export const listEmailTopicsRSC = async (
  input: ListEmailTopicsRequest & { workspaceId: string },
) => {
  await assertCurrentUserCanAccessChatbot(input.workspaceId)
  return emailTopicService.list(input)
}
