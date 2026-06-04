import type { ContactHandlers } from "@chatbotx.io/sdk"
import type { TiktokAuthValue } from "../schema"

// Contact name comes from content.from in the webhook payload (set in incoming-message.ts).
// Customer avatar is not available — TikTok's Business Messaging API requires Messaging Partner
// approval to access the conversations endpoint that returns user_avatar.
export const contactHandlers: Partial<ContactHandlers<TiktokAuthValue>> = {}
