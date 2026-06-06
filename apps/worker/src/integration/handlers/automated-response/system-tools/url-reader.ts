import type { systemFunctionNames } from "@chatbotx.io/ai"
import type {
  SystemToolExecutors,
  UrlContextInput,
} from "@chatbotx.io/ai/server"
import { Readability } from "@mozilla/readability"
import { htmlToText } from "html-to-text"
import { JSDOM } from "jsdom"
import { normalizeError } from "universal-error-normalizer"
import { logger } from "../../../../lib/logger"
import { assertPublicUrl } from "../../../../lib/ssrf-guard"
import { getContextSourceAdapter } from "./context-sources/registry"
import type { ConversationContextSnippet } from "./context-sources/types"
import { urlMetadataSchema } from "./context-sources/url-source"
import {
  FALLBACK_MAX_TEXT_CHARS,
  pickRelevantFallbackSnippets,
  summarizeSnippets,
} from "./fallback-text-utils"

const FALLBACK_FETCH_TIMEOUT_MS = 10_000
const FALLBACK_MAX_RESPONSE_BYTES = 500_000
const FALLBACK_MAX_REDIRECTS = 3

function extractReadableText(html: string, url: string): string {
  try {
    const dom = new JSDOM(html, { url })
    const article = new Readability(dom.window.document).parse()
    if (article?.textContent && article.textContent.trim().length > 200) {
      return article.textContent.trim()
    }
  } catch {
    // Readability parse failure — fall back to htmlToText
  }
  return htmlToText(html, { wordwrap: false })
}

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

async function fetchSafe(
  url: string,
  signal: AbortSignal,
  redirectsLeft = FALLBACK_MAX_REDIRECTS,
): Promise<Response> {
  assertPublicUrl(url, "URL context")

  const response = await fetch(url, {
    signal,
    redirect: "manual",
    headers: {
      "User-Agent": "ChatbotX-URLContext/1.0",
      Accept: "text/html,text/plain;q=0.9",
    },
  })

  if (response.status >= 300 && response.status < 400) {
    if (redirectsLeft <= 0) {
      throw new Error("Too many redirects")
    }
    const location = response.headers.get("location")
    if (!location) {
      throw new Error("Redirect with no Location header")
    }
    return fetchSafe(new URL(location, url).href, signal, redirectsLeft - 1)
  }

  return response
}

async function fetchUrlText(url: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    FALLBACK_FETCH_TIMEOUT_MS,
  )

  try {
    const response = await fetchSafe(url, controller.signal)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType = response.headers.get("content-type") ?? ""
    const isSupported =
      contentType.includes("text/html") || contentType.includes("text/plain")
    if (!isSupported) {
      throw new Error(`Unsupported content type: ${contentType}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body")
    }

    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      if (value) {
        totalBytes += value.byteLength
        chunks.push(value)
        if (totalBytes >= FALLBACK_MAX_RESPONSE_BYTES) {
          await reader.cancel()
          break
        }
      }
    }

    const combined = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }

    const rawHtml = new TextDecoder().decode(combined)
    const text = extractReadableText(rawHtml, url)
    return text.slice(0, FALLBACK_MAX_TEXT_CHARS)
  } finally {
    clearTimeout(timeoutId)
  }
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

      let snippets = preparedContext.snippets

      if (snippets.length === 0) {
        const parsedMeta = urlMetadataSchema.safeParse(
          preparedContext.resolvedSource.source.metadata,
        )
        const resolvedUrl =
          (parsedMeta.success ? parsedMeta.data.url : undefined) ??
          preparedContext.resolvedSource.source.title ??
          args.url

        if (resolvedUrl) {
          try {
            const text = await fetchUrlText(resolvedUrl)
            snippets = pickRelevantFallbackSnippets(text, args.query)
          } catch (fetchError) {
            const normalizedFetchError = normalizeError(fetchError)
            logger.warn(
              {
                error: normalizedFetchError,
                conversationId: context.conversationId,
                workspaceId: context.workspaceId,
                url: resolvedUrl,
              },
              "[url-reader] fallback URL fetch failed",
            )
          }
        }
      }

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
