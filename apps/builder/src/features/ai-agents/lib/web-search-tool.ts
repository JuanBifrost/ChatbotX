import { systemFunctionNames, toolPrefixes } from "@chatbotx.io/ai"
import { z } from "zod"

export const MAX_WEB_SEARCH_AUTHORIZED_DOMAINS = 20

const authorizedWebSearchDomainSchema = z.hostname()

export const webSearchToolValue = `${toolPrefixes.enum.sys}:${systemFunctionNames.webSearch}`

type WebSearchAuthorizedDomain = {
  value: string
}

export function isWebSearchSelected(tools?: string[] | null): boolean {
  return Boolean(tools?.includes(webSearchToolValue))
}

export function normalizeWebSearchDomains(
  domains?: WebSearchAuthorizedDomain[] | null,
): string[] {
  const normalizedDomains = new Set<string>()

  for (const domain of domains ?? []) {
    const normalizedDomain = domain.value.trim().toLowerCase()

    if (
      normalizedDomain &&
      authorizedWebSearchDomainSchema.safeParse(normalizedDomain).success
    ) {
      normalizedDomains.add(normalizedDomain)
    }
  }

  return Array.from(normalizedDomains)
}
