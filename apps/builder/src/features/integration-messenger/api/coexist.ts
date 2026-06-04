import { and, db, eq } from "@chatbotx.io/database/client"
import {
  coexistSyncRunModel,
  integrationMessengerModel,
} from "@chatbotx.io/database/schema"
import { z } from "zod"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"

const setCoexistMessengerRequest = z.object({
  workspaceId: z.string(),
  integrationId: z.string(),
  enabled: z.boolean(),
})
export type SetCoexistMessengerRequest = z.infer<
  typeof setCoexistMessengerRequest
>

const setCoexistMessengerResponse = z.discriminatedUnion("success", [
  z.object({ success: z.literal(true) }),
  z.object({
    success: z.literal(false),
    reason: z.string().optional(),
    msg: z.string().optional(),
  }),
])
export type SetCoexistMessengerResponse = z.infer<
  typeof setCoexistMessengerResponse
>

export const integrationMessengerCoexistAPIs = {
  setCoexistMessengerAPI: authorizedAPI
    .route({
      method: "POST",
      path: "/workspaces/{workspaceId}/integrations/messenger/{integrationId}/coexist",
      summary: "Enable or disable Messenger coexist sync",
      tags: ["Integrations"],
    })
    .input(setCoexistMessengerRequest)
    .output(setCoexistMessengerResponse)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .handler(async ({ input }) => {
      const { workspaceId, integrationId, enabled } = input

      // Tenancy-guarded UPDATE — returning() confirms the row belonged to
      // this workspace before we enqueue any sync.
      const [updated] = await db
        .update(integrationMessengerModel)
        .set({ coexistEnabled: enabled })
        .where(
          and(
            eq(integrationMessengerModel.id, integrationId),
            eq(integrationMessengerModel.workspaceId, workspaceId),
          ),
        )
        .returning({ id: integrationMessengerModel.id })

      if (!updated) {
        return { success: false }
      }

      if (enabled) {
        await db.insert(coexistSyncRunModel).values({
          workspaceId: input.workspaceId,
          integrationId: input.integrationId,
          channel: "messenger",
          status: "init",
          triggerSource: "popup-enable",
        })
      }

      return { success: true }
    }),
}
