import { rescue } from "../exception"
import { createTiktokBusinessClient } from "../lib/http-client"
import type { TiktokApiResponse, TiktokSendMessageRequest } from "../schema"

type SendMessageResult = {
  message_id?: string
}

type UploadMediaResult = {
  media_id?: string
}

export const uploadTiktokMedia = (
  accessToken: string,
  businessId: string,
  imageUrl: string,
): Promise<string> =>
  rescue("business/message/media/upload", async () => {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageUrl}`)
    }
    const blob = await imageResponse.blob()

    const form = new FormData()
    form.append("business_id", businessId)
    form.append("file", blob)
    form.append("media_type", "IMAGE")

    const client = createTiktokBusinessClient(accessToken)
    const response = await client.postFormData<
      TiktokApiResponse<UploadMediaResult>
    >("business/message/media/upload/", form)

    const mediaId = response.data?.media_id
    if (!mediaId) {
      throw new Error("No media_id in TikTok upload response")
    }
    return mediaId
  })

export const sendTiktokMessage = (
  accessToken: string,
  payload: TiktokSendMessageRequest,
): Promise<string | undefined> =>
  rescue("business/message/send", async () => {
    const client = createTiktokBusinessClient(accessToken)
    const response = await client.post<TiktokApiResponse<SendMessageResult>>(
      "business/message/send/",
      { json: payload },
    )
    return response.data?.message_id
  })
