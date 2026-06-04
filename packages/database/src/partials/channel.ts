import { z } from "zod"

export const channelTypes = z.enum([
  "omnichannel",
  "webchat",
  "messenger",
  "whatsapp",
  "zalo",
  "smtp",
  "telegram",
  "instagram",
  "tiktok",
])
export type ChannelType = z.infer<typeof channelTypes>
