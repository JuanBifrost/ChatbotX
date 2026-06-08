import { aiTimeouts } from "@chatbotx.io/ai"
import { aiIntegrationService, getAIModel } from "@chatbotx.io/ai/server"
import { db } from "@chatbotx.io/database/client"
import type { AISpeechToTextSchema } from "@chatbotx.io/flow-config"
import { experimental_transcribe as transcribe } from "ai"
import ky from "ky"
import { normalizeError } from "universal-error-normalizer"
import { z } from "zod"
import { logger } from "../../../lib/logger"
import { saveResultToCustomField } from "../../utils/contact"
import { sendMessageWithRender } from "../../utils/message"
import type { ExecuteStepProps } from "../flow"
import type { ExecuteStepResult } from "../step"

const supportedAudioMimeTypes = z.enum([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/x-wav",
  "audio/mp3",
])

export async function handleAISpeechToText({
  conversation,
  step,
}: ExecuteStepProps<AISpeechToTextSchema>): Promise<ExecuteStepResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), aiTimeouts.aiTotal)

  try {
    const aiConfig = await aiIntegrationService.findBy({
      workspaceId: conversation.workspaceId,
      provider: step.provider,
    })

    if (!aiConfig) {
      logger.warn(
        { workspaceId: conversation.workspaceId, provider: step.provider },
        "[ai-speech-to-text] AI configuration not found",
      )
      return {
        status: "error",
        errorMessage: "AI integration not found",
        result: null,
      }
    }

    const openaiProvider = getAIModel(aiConfig, "openai")

    // Resolve Audio URL
    const audioUrl = await getCustomFieldValue(
      step.inputFieldId,
      conversation.contactId,
    )

    if (!audioUrl) {
      return {
        status: "error",
        errorMessage: "No audio URL provided",
        result: null,
      }
    }

    const response = await ky.head(audioUrl, {
      signal: controller.signal,
      throwHttpErrors: false,
    })
    const contentType = response.headers.get("content-type")

    if (
      !(
        contentType &&
        (supportedAudioMimeTypes.options as string[]).includes(contentType)
      )
    ) {
      return {
        status: "error",
        errorMessage: `Unsupported audio format: ${contentType || "unknown"}`,
        result: null,
      }
    }

    if (!("transcription" in openaiProvider)) {
      throw new Error(
        `Provider ${step.provider} does not support transcription`,
      )
    }

    const transcript = await transcribe({
      model: openaiProvider.transcription(step.model),
      audio: new URL(audioUrl),
      abortSignal: controller.signal,
    })

    await sendMessageWithRender(conversation.id, transcript.text)

    if (step.outputFieldId) {
      await saveResultToCustomField({
        contactId: conversation.contactId,
        customFieldId: step.outputFieldId,
        fullText: transcript.text,
        workspaceId: conversation.workspaceId,
      })
    }

    return { status: "success", result: null }
  } catch (err) {
    const error = normalizeError(err)
    logger.error(error, "[ai-speech-to-text] Step failed")
    return { status: "error", errorMessage: error.message, result: null }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function getCustomFieldValue(
  customFieldId: string,
  contactId: string,
): Promise<string | null> {
  const customField = await db.query.contactCustomFieldModel.findFirst({
    where: {
      contactId,
      customFieldId,
    },
  })

  return customField?.value || null
}
