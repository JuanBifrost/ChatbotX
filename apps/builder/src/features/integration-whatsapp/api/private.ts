import { withChatbotIdSchema } from "@/features/chatbots/schemas/resource"
import { chatbotAuthMiddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { listIntegrationWhatsapps } from "../queries"
import { listIntegrationWhatsappsResponse } from "../schemas/query"

export const privateAPIs = {
  listIntegrationWhatsapp: authorizedAPI
    .route({
      method: "GET",
      path: "/chatbots/{chatbotId}/integrations/whatsapp",
      summary: "List whatsapp integration",
      tags: ["Integrations"],
    })
    .input(withChatbotIdSchema)
    .use(chatbotAuthMiddleware, (input) => input.chatbotId)
    .output(listIntegrationWhatsappsResponse)
    .handler(async ({ input }) => {
      const { chatbotId, ...rest } = input
      const { data } = await listIntegrationWhatsapps({ ...rest, chatbotId })

      return data
    }),
}

export default privateAPIs
