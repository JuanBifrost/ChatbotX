import { getSafeSinceTime } from "@chatbotx.io/database/repositories"

/**
 * Full-history lower bound used when a conversation has no usable
 * `contactInbox.lastMessageAt` anchor (e.g. historical imports never set it).
 */
const FULL_HISTORY_SINCE = new Date(0)

/**
 * Resolve the `sinceTime` window for a sharded last-message lookup.
 *
 * Sharded reads (findLastByConversation) need a lower-bound time window to limit
 * which shards/chunks are scanned. The normal message flow keeps
 * `contactInbox.lastMessageAt` current, so we derive a tight window from it.
 *
 * Historical imports populate messages but never set `lastMessageAt`. Deriving
 * the window from a missing/now anchor would exclude the back-dated rows, so the
 * preview shows nothing. When the anchor is absent we fall back to a full-history
 * scan — `ORDER BY createdAt DESC LIMIT 1` stays cheap with the conversation
 * index, and correctness beats the lost scan-window optimization for this case.
 *
 * @param lastMessageAt The contact inbox anchor, or null/undefined when unknown.
 * @param anchor Optional transform applied to the anchor before flooring
 *   (e.g. `endOfHour` to widen the upper edge).
 */
export function resolveLastMessageSinceTime(
  lastMessageAt: Date | null | undefined,
  anchor: (date: Date) => Date = (date) => date,
): Date {
  if (!lastMessageAt) {
    return FULL_HISTORY_SINCE
  }
  return getSafeSinceTime(anchor(lastMessageAt)) ?? FULL_HISTORY_SINCE
}
