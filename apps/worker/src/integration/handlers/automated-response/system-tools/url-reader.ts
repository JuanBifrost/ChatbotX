import type { systemFunctionNames } from "@chatbotx.io/ai"
import type {
  SystemToolExecutors,
  UrlContextInput,
} from "@chatbotx.io/ai/server"
import { normalizeError } from "universal-error-normalizer"
import { logger } from "../../../../lib/logger"
import { getContextSourceAdapter } from "./context-sources/registry"
import type { ConversationContextSnippet } from "./context-sources/types"
import { urlMetadataSchema } from "./context-sources/url-source"
import { summarizeSnippets } from "./fallback-text-utils"

function formatToolOutput(props: {
  fileOnlyTrigger: boolean
  snippets: ConversationContextSnippet[]
  summary: string
  url: string
}) {
  const output: string[] = []
  output.push(`URL: ${props.url}`)
  output.push(`Summary: ${props.summary}`)

  if (props.snippets.length > 0) {
    output.push("Relevant snippets:")
    for (const [index, snippet] of props.snippets.entries()) {
      output.push(`${index + 1}. ${snippet.content}`)
    }
  } else {
    output.push("Relevant snippets: No matching snippets were found yet.")
  }

  if (props.fileOnlyTrigger) {
    output.push(
      "Follow-up: Ask the user what specific section or detail from the URL they want to explore next.",
    )
  }

  return output.join("\n")
}

export function createUrlReaderExecutor(options: {
  fileOnlyTrigger: boolean
  triggerMessageId?: string
}): NonNullable<SystemToolExecutors[typeof systemFunctionNames.urlContext]> {
  return async (args: UrlContextInput, context) => {
    if (!context) {
      return "I can only read URLs when conversation context is available."
    }

    const adapter = getContextSourceAdapter("url")
    if (!adapter) {
      return "URL context is not available right now."
    }

    try {
      const preparedContext = await adapter.prepareContext({
        workspaceId: context.workspaceId,
        conversationId: context.conversationId,
        messageId: options.triggerMessageId,
        query: args.query,
        sourceHint: args.url,
        topK: 5,
      })

      if (!preparedContext) {
        return "I couldn't find a URL in this conversation to read context from. Please share a URL and ask your question."
      }

      const sourceStatus = preparedContext.resolvedSource.source.status

      if (sourceStatus === "pending" || sourceStatus === "processing") {
        return "The URL is still being processed. Please wait a moment and ask again."
      }

      if (sourceStatus === "error") {
        return "I wasn't able to read the content of that URL. It may be inaccessible or unsupported. Please try a different URL."
      }

      const snippets = preparedContext.snippets

      const parsedMeta = urlMetadataSchema.safeParse(
        preparedContext.resolvedSource.source.metadata,
      )
      const displayUrl =
        (parsedMeta.success ? parsedMeta.data.url : undefined) ??
        preparedContext.resolvedSource.source.title ??
        args.url ??
        "User-provided URL"

      const summary = summarizeSnippets(
        preparedContext.summary,
        snippets,
        "I found the URL, but I need a more specific question to extract relevant details.",
      )
      return formatToolOutput({
        url: displayUrl,
        snippets,
        summary,
        fileOnlyTrigger: options.fileOnlyTrigger,
      })
    } catch (error) {
      const normalizedError = normalizeError(error)
      logger.error(
        {
          error: normalizedError,
          conversationId: context.conversationId,
          workspaceId: context.workspaceId,
        },
        "[url-reader] url context tool execution failed",
      )

      return "I found the URL, but I couldn't read it completely. Please ask a more specific question or try another URL."
    }
  }
}
