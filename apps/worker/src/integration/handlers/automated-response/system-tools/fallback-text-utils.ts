import type { ConversationContextSnippet } from "./context-sources/types"

const FALLBACK_MAX_TEXT_CHARS = 40_000
const FALLBACK_SNIPPET_LIMIT = 3
const PARAGRAPH_SEPARATOR_REGEX = /\n{2,}/g
const QUERY_TERM_SEPARATOR_REGEX = /\s+/
const WHITESPACE_REGEX = /\s+/g

export { FALLBACK_MAX_TEXT_CHARS }

function splitPlainTextToSnippets(text: string): string[] {
  return text
    .split(PARAGRAPH_SEPARATOR_REGEX)
    .map((segment) => segment.replace(WHITESPACE_REGEX, " ").trim())
    .filter(Boolean)
}

export function pickRelevantFallbackSnippets(
  text: string,
  query: string,
): ConversationContextSnippet[] {
  const normalizedQuery = query.toLowerCase()
  const queryTerms = normalizedQuery
    .split(QUERY_TERM_SEPARATOR_REGEX)
    .map((term) => term.trim())
    .filter((term) => term.length > 2)
    .slice(0, 8)

  const segments = splitPlainTextToSnippets(text)
  if (segments.length === 0) {
    return []
  }

  if (queryTerms.length === 0) {
    return segments.slice(0, FALLBACK_SNIPPET_LIMIT).map((segment, index) => ({
      chunkIndex: index,
      content: segment.slice(0, 500),
      similarity: null,
      source: "fallback_parse",
    }))
  }

  const scoredSegments = segments
    .map((segment, index) => {
      const lowered = segment.toLowerCase()
      const score = queryTerms.reduce(
        (acc, term) => (lowered.includes(term) ? acc + 1 : acc),
        0,
      )
      return { segment, score, index }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.index - right.index
    })

  return scoredSegments.slice(0, FALLBACK_SNIPPET_LIMIT).map((item) => ({
    chunkIndex: item.index,
    content: item.segment.slice(0, 500),
    similarity: item.score > 0 ? item.score : null,
    source: "fallback_parse",
  }))
}

export function summarizeSnippets(
  summary: null | string,
  snippets: ConversationContextSnippet[],
  emptyFallback: string,
): string {
  if (summary?.trim()) {
    return summary.trim().slice(0, 500)
  }

  if (snippets.length === 0) {
    return emptyFallback
  }

  return snippets[0]?.content.slice(0, 500) ?? ""
}
