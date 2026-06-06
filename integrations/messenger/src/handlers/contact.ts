import type { ContactHandlers } from "@chatbotx.io/sdk"
import { assignLabelToUser, removeLabelFromUser } from "../apis/label"
import { getUserProfile } from "../apis/user"
import type { MessengerAuthValue } from "../schema"

export const contactHandlers: Partial<ContactHandlers<MessengerAuthValue>> = {
  getProfile: getUserProfile,
  assignLabel: async ({ ctx, data }) => {
    await assignLabelToUser({ ctx, labelId: data.labelId, psid: data.sourceId })
  },
  removeLabel: async ({ ctx, data }) => {
    await removeLabelFromUser({
      ctx,
      labelId: data.labelId,
      psid: data.sourceId,
    })
  },
}
