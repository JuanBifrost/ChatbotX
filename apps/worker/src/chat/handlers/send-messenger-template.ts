import { broadcastToWorkspaceParty } from "@chatbotx.io/business"
import { db, eq } from "@chatbotx.io/database/client"
import { messageModel } from "@chatbotx.io/database/schema"
import type {
  ContactInboxModel,
  ConversationModel,
} from "@chatbotx.io/database/types"
import { emit } from "@chatbotx.io/event-bus"
import type { MetadataPayload } from "@chatbotx.io/flow-config"
import {
  type ButtonStepProps,
  buttonStepDefaultFn,
  buttonTypes,
  extractMessengerTemplateParams,
  type MessengerTemplateComponent,
  type MessengerTemplateParams,
  messageEventTypeSchema,
  type SendMessengerTemplateMessageStepSchema,
  startExternalFlowStepDefaultFn,
  stepTypes,
} from "@chatbotx.io/flow-config"
import { RealtimeEventType } from "@chatbotx.io/partysocket-config"
import { parseSdkError } from "@chatbotx.io/sdk"
import { createId } from "@chatbotx.io/utils"
import { contactVariableService } from "@chatbotx.io/variables"
import type {
  BotResponseTrackingContext,
  ChatJobSendMessengerTemplateMessage,
} from "@chatbotx.io/worker-config"
import {
  replaceMessengerTemplateVariables,
  validateMessengerTemplate,
} from "../../integration/handlers/messenger-template-handler"
import { logger } from "../../lib/logger"
import { sendFlowStepToChannel } from "./send-message"

export interface ProcessMessengerTemplateParams {
  broadcastId?: string
  contactInbox: ContactInboxModel
  conversation: ConversationModel
  flow?: {
    id: string
    versionId?: string
  }
  metadata?: MetadataPayload
  step?: SendMessengerTemplateMessageStepSchema
  template: SendMessengerTemplateMessageStepSchema["template"]
  trackingContext?: BotResponseTrackingContext
}

export interface ProcessMessengerTemplateResult {
  message: typeof messageModel.$inferSelect
  messageId: string
  providerMessageId?: string
}

export async function processMessengerTemplate(
  params: ProcessMessengerTemplateParams,
): Promise<ProcessMessengerTemplateResult> {
  const {
    conversation,
    contactInbox,
    template,
    broadcastId,
    flow,
    step,
    trackingContext,
    metadata,
  } = params

  const eventLogData = {
    context: {
      workspaceId: conversation.workspaceId,
      contactId: conversation.contactId,
      conversationId: conversation.id,
      channel: contactInbox.channel,
      contactInboxId: contactInbox.id,
    },
    action: {
      flowId: flow?.id || "",
      flowVersionId: flow?.versionId || "",
    },
    stepId: step?.id || "",
    nodeId: step?.nodeId || "",
    metadata,
  }

  let newMessage: typeof messageModel.$inferSelect | null = null

  try {
    const validated = await validateMessengerTemplate(
      template.id,
      contactInbox.inboxId,
    )
    if (!validated) {
      logger.error(
        { templateId: template.id, inboxId: contactInbox.inboxId },
        "Messenger template validation failed - not approved or not found",
      )
      throw new Error(`Messenger template validation failed: ${template.id}`)
    }

    const variables = await contactVariableService.getAll(
      conversation.contactId,
    )
    const replacedParams = await replaceMessengerTemplateVariables({
      templateParams: template.params,
      variables,
      parameterFormat: template.parameterFormat,
    })

    const contentAttributes = {
      type: "messenger_template",
      template: {
        name: template.name,
        language: template.language,
        id: template.id,
        params: replacedParams,
        parameterFormat: template.parameterFormat,
      },
      stepId: step?.id,
      nodeId: step?.nodeId,
      ...(broadcastId && { broadcastId }),
      ...(flow && { flowId: flow.id }),
      ...(flow && { flowVersionId: flow.versionId }),
      ...(trackingContext && { trackingContext }),
      metadata,
    }

    const messageData: typeof messageModel.$inferInsert = {
      id: createId(),
      contactInboxId: contactInbox.id,
      workspaceId: conversation.workspaceId,
      conversationId: conversation.id,
      messageType: "outgoing",
      contentType: "text",
      senderType: "bot",
      sourceId: null,
      text: `Template: ${template.name}`,
      contentAttributes,
    }

    newMessage = await db
      .insert(messageModel)
      .values(messageData)
      .returning()
      .then((result) => result[0])

    if (!newMessage) {
      throw new Error("Failed to insert message record")
    }

    broadcastToWorkspaceParty(conversation.workspaceId, {
      eventType: RealtimeEventType.messageCreated,
      data: newMessage,
    })

    const result = await sendFlowStepToChannel({
      conversation,
      contactInbox,
      flowId: flow?.id ?? "",
      flowVersionId: flow?.versionId,
      step: {
        id: step?.id ?? createId(),
        nodeId: step?.nodeId ?? createId(),
        stepType: stepTypes.enum.sendMessengerTemplateMessage,
        buttons: step?.buttons ?? [],
        template: { ...template, params: replacedParams },
      },
      metadata,
      messageId: newMessage.id,
    })

    await emit(messageEventTypeSchema.enum["message:sent"], {
      ...eventLogData,
      action: { messageId: newMessage.id, flowId: flow?.id || "" },
      occurredAt: new Date(),
    })

    const providerMessageId = result?.messageIds?.[0]

    if (providerMessageId) {
      await db
        .update(messageModel)
        .set({ sourceId: providerMessageId })
        .where(eq(messageModel.id, newMessage.id))
    }

    return {
      messageId: newMessage.id,
      providerMessageId,
      message: { ...newMessage, sourceId: providerMessageId || null },
    }
  } catch (error) {
    logger.error(
      {
        error,
        messageId: newMessage?.id,
        conversationId: conversation.id,
        templateId: template.id,
      },
      "Failed to send Messenger template to provider",
    )

    await emit(messageEventTypeSchema.enum["message:failed"], {
      ...eventLogData,
      action: {
        messageId: newMessage?.id || "",
        flowId: flow?.id || "",
      },
      errorData: await parseSdkError(error),
      occurredAt: new Date(),
    })

    throw error
  }
}

export async function sendMessengerTemplateMessage(
  data: ChatJobSendMessengerTemplateMessage["data"],
) {
  const {
    conversation,
    templateId,
    broadcastId,
    templateData,
    buttons: jobButtons,
    contactInbox,
    metadata,
  } = data

  const eventLogData = {
    context: {
      workspaceId: conversation.workspaceId,
      contactId: conversation.contactId,
      conversationId: conversation.id,
      channel: contactInbox.channel,
      contactInboxId: contactInbox.id,
    },
    action: {
      flowId: "",
    },
    stepId: "",
    nodeId: "",
    metadata,
  }

  try {
    const validated = await validateMessengerTemplate(
      templateId,
      contactInbox.inboxId,
    )

    if (!validated) {
      const error = new Error(
        `Messenger template not found or not approved: templateId=${templateId}, inboxId=${contactInbox.inboxId}`,
      )
      await emit(messageEventTypeSchema.enum["message:failed"], {
        ...eventLogData,
        action: { messageId: "", flowId: "" },
        errorData: await parseSdkError(error),
        occurredAt: new Date(),
      })
      throw error
    }

    const { template } = validated
    const parameterFormat =
      (template.parameterFormat as "POSITIONAL" | "NAMED") || "POSITIONAL"

    // buttons is now a separate typed field in the job data (T5 fix)
    const storedButtons = jobButtons

    const templateParams: MessengerTemplateParams =
      templateData ??
      extractMessengerTemplateParams(
        (template.components as MessengerTemplateComponent[]) || [],
        parameterFormat,
      )

    // Find any active flow in the workspace to use as encoding context for
    // template buttons that have no configured flowId. On tap, runFlowPostback
    // will locate this flow but the fresh buttonId (cuid2) won't exist in its
    // nodes, so getNodeFromButton returns undefined → graceful no-op return.
    // This mirrors how send-text step buttons with no action work.
    const contextFlow = storedButtons?.some((b) => !b.flowId)
      ? await db.query.flowModel.findFirst({
          where: { workspaceId: conversation.workspaceId, active: true },
        })
      : null

    // Reconstruct ButtonStepProps for ALL stored broadcast buttons.
    // Buttons with a flowId → startExternalFlow; buttons without → null type
    // (no-op on tap via the contextFlow encoding above).
    const stepButtons: ButtonStepProps[] = (storedButtons ?? []).map(
      (b): ButtonStepProps =>
        b.flowId
          ? {
              id: createId(),
              label: b.label,
              buttonType: buttonTypes.enum.startExternalFlow,
              beforeStep: startExternalFlowStepDefaultFn({ flowId: b.flowId }),
              steps: [],
            }
          : buttonStepDefaultFn({ label: b.label }),
    )

    const result = await processMessengerTemplate({
      conversation,
      contactInbox,
      template: {
        id: template.id,
        name: template.name,
        language: template.language,
        parameterFormat,
        params: templateParams,
      },
      broadcastId,
      metadata,
      // Pass contextFlow so unconfigured buttons are encoded with a valid flowId.
      ...(contextFlow && { flow: { id: contextFlow.id } }),
      ...(stepButtons.length > 0 && {
        step: {
          id: createId(),
          nodeId: createId(),
          stepType: stepTypes.enum.sendMessengerTemplateMessage,
          template: {
            id: template.id,
            name: template.name,
            language: template.language,
            parameterFormat,
            params: templateParams,
          },
          buttons: stepButtons,
        },
      }),
    })

    return result
  } catch (error) {
    logger.error(
      {
        error,
        conversationId: conversation.id,
        templateId,
        broadcastId,
      },
      "Error sending Messenger template message for broadcast",
    )
    throw error
  }
}
