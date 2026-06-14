import { z } from "zod"

export const integrationTypes = z.enum([
  "chatbotx",
  "claude",
  "deepseek",
  "drip",
  "gemini",
  "googleSheets",
  "instagram",
  "mailchimp",
  "mailerLite",
  "messenger",
  "openai",
  "sendGrid",
  "smtp",
  "telegram",
  "tiktok",
  "webchat",
  "whatsapp",
  "zalo",
])
export type IntegrationType = z.infer<typeof integrationTypes>
