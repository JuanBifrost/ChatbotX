import { and, db, eq } from "@chatbotx.io/database/client"
import { broadcastStatuses, channelTypes } from "@chatbotx.io/database/partials"
import {
  broadcastModel,
  contactsOnBroadcastsModel,
} from "@chatbotx.io/database/schema"
import {
  BROADCAST_PAYLOAD_TYPE,
  type MessengerTemplateParams,
  type WaTemplateParams,
} from "@chatbotx.io/flow-config"
import {
  ChatJobAction,
  chatQueue,
  IntegrationJobAction,
  integrationQueue,
} from "@chatbotx.io/worker-config"
import { logger } from "../../lib/logger"

const DEFAULT_BROADCAST_RATE_LIMIT = 500

export const processBroadcastContacts = async () => {
  const broadcasts = await db.query.broadcastModel.findMany({
    where: {
      status: broadcastStatuses.enum.sending,
    },
  })

  if (broadcasts.length === 0) {
    return { processed: 0 }
  }

  let totalProcessed = 0

  for (const broadcast of broadcasts) {
    const contactsOnBroadcasts =
      await db.query.contactsOnBroadcastsModel.findMany({
        where: {
          broadcastId: broadcast.id,
          sent: false,
        },
        with: {
          conversation: true,
          contactInbox: true,
        },
        limit: DEFAULT_BROADCAST_RATE_LIMIT,
      })

    if (contactsOnBroadcasts.length === 0) {
      await db
        .update(broadcastModel)
        .set({ status: "sent" })
        .where(eq(broadcastModel.id, broadcast.id))
      continue
    }

    await Promise.allSettled(
      contactsOnBroadcasts.map(async (contactOnBroadcast) => {
        try {
          if (broadcast.flowId) {
            await integrationQueue.add(IntegrationJobAction.sendFlow, {
              type: IntegrationJobAction.sendFlow,
              data: {
                flowId: broadcast.flowId,
                conversationId: contactOnBroadcast.conversationId,
                contactInboxId: contactOnBroadcast.contactInboxId,
                metadata: {
                  type: BROADCAST_PAYLOAD_TYPE,
                  broadcastId: broadcast.id,
                  contactInboxId: contactOnBroadcast.contactInboxId,
                },
              },
            })
          }

          if (broadcast.templateId) {
            if (broadcast.channel === channelTypes.enum.messenger) {
              // create-broadcast.action stores { ...templateParams, buttons: [...] } in templateData.
              // Separate buttons so the job type receives the correct shape.
              type RawMessengerData = MessengerTemplateParams & {
                buttons?: Array<{ id: string; label: string; flowId?: string }>
              }
              const rawMessengerData = broadcast.templateData as
                | RawMessengerData
                | undefined
              const { buttons: broadcastButtons, ...cleanMessengerParams } =
                rawMessengerData ?? ({} as RawMessengerData)

              await chatQueue.add(ChatJobAction.sendMessengerTemplateMessage, {
                type: ChatJobAction.sendMessengerTemplateMessage,
                data: {
                  conversation: contactOnBroadcast.conversation,
                  contactInbox: contactOnBroadcast.contactInbox,
                  templateId: broadcast.templateId,
                  broadcastId: broadcast.id,
                  templateData:
                    Object.keys(cleanMessengerParams).length > 0
                      ? (cleanMessengerParams as MessengerTemplateParams)
                      : undefined,
                  buttons: broadcastButtons,
                  metadata: {
                    type: BROADCAST_PAYLOAD_TYPE,
                    broadcastId: broadcast.id,
                    contactInboxId: contactOnBroadcast.contactInboxId,
                  },
                },
              })
            } else {
              await chatQueue.add(ChatJobAction.sendWhatsappTemplateMessage, {
                type: ChatJobAction.sendWhatsappTemplateMessage,
                data: {
                  conversation: contactOnBroadcast.conversation,
                  contactInbox: contactOnBroadcast.contactInbox,
                  templateId: broadcast.templateId,
                  broadcastId: broadcast.id,
                  templateData: broadcast.templateData as
                    | WaTemplateParams
                    | undefined,
                  metadata: {
                    type: BROADCAST_PAYLOAD_TYPE,
                    broadcastId: broadcast.id,
                    contactInboxId: contactOnBroadcast.contactInboxId,
                  },
                },
              })
            }
          }

          await db
            .update(contactsOnBroadcastsModel)
            .set({ sent: true })
            .where(
              and(
                eq(
                  contactsOnBroadcastsModel.broadcastId,
                  contactOnBroadcast.broadcastId,
                ),
                eq(
                  contactsOnBroadcastsModel.contactId,
                  contactOnBroadcast.contactId,
                ),
              ),
            )

          totalProcessed++
        } catch (error) {
          logger.error(
            { err: error, contactOnBroadcast },
            "Error processing broadcast contact",
          )
        }
      }),
    )
  }

  return { processed: totalProcessed }
}
