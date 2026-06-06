import { z } from "zod"

const authorizedWebSearchDomainSchema = z.hostname()

export function normalizeAuthorizedWebSearchDomains(
  domains: string[],
): string[] {
  const normalizedDomains = new Set<string>()

  for (const domain of domains) {
    const normalizedDomain = domain.trim().toLowerCase()

    if (
      normalizedDomain &&
      authorizedWebSearchDomainSchema.safeParse(normalizedDomain).success
    ) {
      normalizedDomains.add(normalizedDomain)
    }
  }

  return Array.from(normalizedDomains)
}
