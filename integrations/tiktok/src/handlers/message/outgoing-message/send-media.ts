import { uploadTiktokMedia } from "../../../apis/message"
import type { TiktokSendMessageRequest } from "../../../schema"

export const uploadAndBuildImagePayload = async (
  accessToken: string,
  businessId: string,
  conversationId: string,
  imageUrl: string,
): Promise<TiktokSendMessageRequest> => {
  const mediaId = await uploadTiktokMedia(accessToken, businessId, imageUrl)
  return {
    business_id: businessId,
    recipient_type: "CONVERSATION",
    recipient: conversationId,
    message_type: "IMAGE",
    image: { media_id: mediaId },
  }
}
