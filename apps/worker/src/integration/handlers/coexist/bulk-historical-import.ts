// biome-ignore-all lint/suspicious/noBitwiseOperators: bit-packing 63-bit snowflake IDs

import { db, eq, inArray, sql } from "@chatbotx.io/database/client"
import {
  attachmentModel,
  contactInboxModel,
  contactModel,
  conversationModel,
  messageModel,
  userQuotaModel,
  workspaceModel,
} from "@chatbotx.io/database/schema"
import type { InboxModel } from "@chatbotx.io/database/types"
import { emit } from "@chatbotx.io/event-bus"
import { emitContactCreated } from "@chatbotx.io/events"
import type { IncomingContact, IncomingMessage } from "@chatbotx.io/sdk"
import { createId } from "@chatbotx.io/utils"
import pLimit from "p-limit"
import { logger } from "../../../lib/logger"

// ---------- Coexist time-derived Message IDs ----------
// Layout mirrors `@chatbotx.io/utils` `createId()` shift so coexist IDs share
// the same numeric magnitude/length as live snowflakes:
//   high → low: [ 53 bits ms since epoch ][ 10 bits run partition ][ 4 bits seq ]
//   ts_shift = 14   (identical to uuniq layout)
// Epoch `2026-03-31` matches `createId()`. The high 53 bits being a pure
// function of `createdAt` guarantees `ORDER BY id` ≡ `ORDER BY createdAt` for
// historically-imported rows.

const COEXIST_EPOCH_MS = new Date("2004-02-01").getTime()
const COEXIST_TS_BITS = 53n
const COEXIST_PARTITION_BITS = 10n
const COEXIST_SEQ_BITS = 4n
const COEXIST_PARTITION_SHIFT = COEXIST_SEQ_BITS
const COEXIST_TS_SHIFT = COEXIST_PARTITION_BITS + COEXIST_SEQ_BITS
const COEXIST_PARTITION_MASK = (1n << COEXIST_PARTITION_BITS) - 1n
const COEXIST_SEQ_MASK = (1n << COEXIST_SEQ_BITS) - 1n
const COEXIST_MAX_TS = 1n << COEXIST_TS_BITS

export type HistoricalIdFactory = (date: Date) => string

const COEXIST_SEQ_SPACE = 1n << COEXIST_SEQ_BITS

export const createHistoricalIdFactory = (
  runId: string,
): HistoricalIdFactory => {
  const partition = BigInt(runId) & COEXIST_PARTITION_MASK
  const seqByTs = new Map<bigint, bigint>()

  return (date: Date): string => {
    const baseTs = BigInt(date.getTime() - COEXIST_EPOCH_MS)
    if (baseTs < 0n || baseTs >= COEXIST_MAX_TS) {
      throw new Error(
        `createHistoricalIdFactory: ${date.toISOString()} out of range`,
      )
    }
    let ts = baseTs
    while (ts < COEXIST_MAX_TS) {
      const next = seqByTs.get(ts) ?? 0n
      if (next < COEXIST_SEQ_SPACE) {
        seqByTs.set(ts, next + 1n)
        return (
          (ts << COEXIST_TS_SHIFT) |
          (partition << COEXIST_PARTITION_SHIFT) |
          next
        ).toString()
      }
      ts += 1n
    }
    throw new Error(
      `createHistoricalIdFactory: exhausted sequence space at ${date.toISOString()}`,
    )
  }
}

export const decodeHistoricalId = (
  id: string,
): { timestampMs: number; partition: number; seq: number } => {
  const v = BigInt(id)
  return {
    timestampMs: Number(v >> COEXIST_TS_SHIFT) + COEXIST_EPOCH_MS,
    partition: Number((v >> COEXIST_PARTITION_SHIFT) & COEXIST_PARTITION_MASK),
    seq: Number(v & COEXIST_SEQ_MASK),
  }
}

const isUniqueMessagePkViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) {
    return false
  }
  const e = err as { code?: string; constraint_name?: string }
  return e.code === "23505" && e.constraint_name === "Message_pkey"
}

export type HistoricalMessage = IncomingMessage & { createdAt?: Date }

export type ContactImportLink = {
  contactInboxId: string
  contactId: string
  conversationId: string
}

export type BulkImportContactsResult = {
  importedContacts: number
  skippedContacts: number
  /** sourceId → resolved link (existing or newly inserted). */
  contactInboxIds: Map<string, ContactImportLink>
  /** Non-throw failure (e.g. workspace contact cap hit). */
  failureReason?: string
}

export type BulkImportMessagesResult = {
  importedMessages: number
  skippedMessages: number
  /** Attachment row IDs inserted alongside imported messages. Empty when no
   *  message in this call carried an `attachments[]` payload. Callers enqueue
   *  one `coexistAttachmentDownload` job per ID to mirror bytes to S3. */
  insertedAttachmentIds: string[]
}

/**
 * Legacy combined contact+messages entry used by WhatsApp coexist flush. New
 * Messenger sync path calls `bulkImportContacts` and `bulkImportMessages`
 * independently.
 */
export type HistoricalContactMessages = {
  contact: IncomingContact
  messages: HistoricalMessage[]
}

export type BulkImportHistoricalResult = {
  importedContacts: number
  importedMessages: number
  skippedContacts: number
  skippedMessages: number
  failedMessages: number
  contactInboxIds: Map<string, string>
  /** Aggregated Attachment row IDs across every per-contact insert in the
   *  batch. Caller drives the post-commit download enqueue. */
  insertedAttachmentIds: string[]
  failureReason?: string
}

/**
 * Phase 1 of Coexist historical sync: dedup contacts by sourceId, resolve
 * existing ContactInbox rows, lock WorkspaceUsage to enforce the per-workspace
 * contact cap, and bulk-insert new Contact/ContactInbox/Conversation rows.
 *
 * Race-safe via `onConflictDoNothing` + post-insert re-select for losers, with
 * orphan Contact cleanup. Idempotent — re-running with the same batch returns
 * the existing links without creating duplicates.
 *
 * Returns one `ContactImportLink` per dedup'd sourceId (existing + newly
 * created). Callers use this map to dispatch downstream avatar / message
 * fetches without an additional DB lookup.
 */
export const bulkImportContacts = async (props: {
  inbox: InboxModel
  workspaceId: string
  contacts: IncomingContact[]
}): Promise<BulkImportContactsResult> => {
  const { inbox, workspaceId, contacts } = props

  const empty: BulkImportContactsResult = {
    importedContacts: 0,
    skippedContacts: 0,
    contactInboxIds: new Map(),
  }
  if (contacts.length === 0) {
    return empty
  }

  // Dedup by sourceId — prefer first non-null field across duplicates.
  const dedup = new Map<string, IncomingContact>()
  for (const entry of contacts) {
    const key = entry.sourceId
    if (!key) {
      continue
    }
    const existing = dedup.get(key)
    if (!existing) {
      dedup.set(key, { ...entry })
      continue
    }
    dedup.set(key, {
      sourceId: existing.sourceId,
      phoneNumber: existing.phoneNumber ?? entry.phoneNumber,
      phoneNumberId: existing.phoneNumberId ?? entry.phoneNumberId,
      firstName: existing.firstName ?? entry.firstName,
      lastName: existing.lastName ?? entry.lastName,
      email: existing.email ?? entry.email,
      avatar: existing.avatar ?? entry.avatar,
      gender: existing.gender ?? entry.gender,
    })
  }

  if (dedup.size === 0) {
    return empty
  }

  const sourceIds = [...dedup.keys()]
  const newContactCreatedEvents: Array<{
    workspaceId: string
    contactId: string
    contactInboxId: string
    sourceId: string
    firstName?: string
    phoneNumber?: string
    email?: string
    channel: string
    source: string
    createdAt: Date
  }> = []

  let importedContacts = 0
  let skippedContacts = 0
  let failureReason: string | undefined
  const contactInboxIds = new Map<string, ContactImportLink>()

  await db.transaction(async (tx) => {
    // 1. Find existing ContactInbox rows.
    const existingRows = await tx
      .select({
        id: contactInboxModel.id,
        sourceId: contactInboxModel.sourceId,
        contactId: contactInboxModel.contactId,
      })
      .from(contactInboxModel)
      .where(
        sql`${contactInboxModel.inboxId} = ${inbox.id} AND ${contactInboxModel.sourceId} IN ${sourceIds}`,
      )

    const resolved = new Map<string, ContactImportLink>()
    const existingContactIds = new Set<string>()

    for (const row of existingRows) {
      existingContactIds.add(row.contactId)
      resolved.set(row.sourceId, {
        contactInboxId: row.id,
        contactId: row.contactId,
        conversationId: "",
      })
    }

    // Resolve conversation ids for existing contacts. Heal orphans (existing
    // ContactInbox + Contact but missing Conversation) by inserting one now,
    // so downstream callers never receive an empty conversationId.
    if (existingContactIds.size > 0) {
      const conversations = await tx
        .select({
          id: conversationModel.id,
          contactId: conversationModel.contactId,
        })
        .from(conversationModel)
        .where(inArray(conversationModel.contactId, [...existingContactIds]))
      const convByContact = new Map(
        conversations.map((c) => [c.contactId, c.id]),
      )

      const orphanContactIds = [...existingContactIds].filter(
        (cid) => !convByContact.has(cid),
      )
      if (orphanContactIds.length > 0) {
        await tx
          .insert(conversationModel)
          .values(
            orphanContactIds.map((cid) => ({
              id: createId(),
              workspaceId,
              contactId: cid,
            })),
          )
          .onConflictDoNothing({ target: [conversationModel.contactId] })
        const healed = await tx
          .select({
            id: conversationModel.id,
            contactId: conversationModel.contactId,
          })
          .from(conversationModel)
          .where(inArray(conversationModel.contactId, orphanContactIds))
        for (const c of healed) {
          convByContact.set(c.contactId, c.id)
        }
      }

      for (const link of resolved.values()) {
        const cid = convByContact.get(link.contactId)
        if (cid) {
          link.conversationId = cid
        }
      }
    }

    const newEntries = [...dedup.entries()].filter(
      ([sourceId]) => !resolved.has(sourceId),
    )

    // 2. Cap check under row lock.
    let acceptedNew: typeof newEntries = newEntries
    if (newEntries.length > 0) {
      const usageRows = await tx.execute<{
        contactsCount: number
        maxContacts: number
      }>(
        sql`SELECT "contactsCount", "maxContacts" FROM "WorkspaceUsage" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`,
      )
      const usage = usageRows.rows[0]
      if (usage) {
        const slots = Math.max(0, usage.maxContacts - usage.contactsCount)
        acceptedNew = newEntries.slice(0, slots)
        const rejected = newEntries.slice(slots)
        skippedContacts = rejected.length
        if (rejected.length > 0) {
          failureReason = `workspace contact cap reached (${usage.contactsCount}/${usage.maxContacts}) — ${rejected.length} contact(s) rejected`
        }
      } else {
        logger.warn(
          { workspaceId },
          "[coexist] WorkspaceUsage row missing — rejecting all new contacts",
        )
        skippedContacts = newEntries.length
        acceptedNew = []
        failureReason = `WorkspaceUsage row missing for workspace ${workspaceId} — all ${newEntries.length} new contact(s) rejected`
      }
    }

    // 3. Insert Contact + ContactInbox + Conversation for acceptedNew.
    if (acceptedNew.length > 0) {
      const contactRows = acceptedNew.map(([, entry]) => ({
        id: createId(),
        workspaceId,
        firstName: entry.firstName,
        lastName: entry.lastName,
        email: entry.email,
        phoneNumber: entry.phoneNumber,
        avatar: entry.avatar,
        lastActivityAt: new Date(),
      }))

      await tx.insert(contactModel).values(contactRows)

      const contactInboxRows = acceptedNew.map(([sourceId], i) => ({
        id: createId(),
        inboxId: inbox.id,
        contactId: contactRows[i]?.id,
        originalContactId: contactRows[i]?.id,
        source: inbox.channel,
        sourceId,
        channel: inbox.channel,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      const conversationRows = acceptedNew.map((_entry, i) => ({
        id: createId(),
        workspaceId,
        contactId: contactRows[i]?.id,
      }))

      const insertedInboxes = await tx
        .insert(contactInboxModel)
        .values(contactInboxRows)
        .onConflictDoNothing({
          target: [contactInboxModel.inboxId, contactInboxModel.sourceId],
        })
        .returning({
          id: contactInboxModel.id,
          sourceId: contactInboxModel.sourceId,
          contactId: contactInboxModel.contactId,
        })

      const insertedSourceIds = new Set(insertedInboxes.map((r) => r.sourceId))

      // Race recovery — any acceptedNew sourceId not inserted lost to a
      // concurrent insert; re-SELECT winners + delete pre-allocated orphans.
      const racedSourceIds = acceptedNew
        .map(([sourceId]) => sourceId)
        .filter((s) => !insertedSourceIds.has(s))

      if (racedSourceIds.length > 0) {
        const winners = await tx
          .select({
            id: contactInboxModel.id,
            sourceId: contactInboxModel.sourceId,
            contactId: contactInboxModel.contactId,
          })
          .from(contactInboxModel)
          .where(
            sql`${contactInboxModel.inboxId} = ${inbox.id} AND ${contactInboxModel.sourceId} IN ${racedSourceIds}`,
          )
        for (const w of winners) {
          insertedInboxes.push(w)
          insertedSourceIds.add(w.sourceId)
        }

        const racedSet = new Set(racedSourceIds)
        const orphanIds: string[] = []
        for (let i = 0; i < acceptedNew.length; i++) {
          const sourceId = acceptedNew[i]?.[0]
          const contactId = contactRows[i]?.id
          if (sourceId && contactId && racedSet.has(sourceId)) {
            orphanIds.push(contactId)
          }
        }
        if (orphanIds.length > 0) {
          await tx
            .delete(contactModel)
            .where(inArray(contactModel.id, orphanIds))
        }
      }

      const trulyNew = acceptedNew.length - racedSourceIds.length
      importedContacts = trulyNew

      const racedSet2 = new Set(racedSourceIds)
      const conversationsToInsert = conversationRows.filter(
        (_row, i) => !racedSet2.has(acceptedNew[i]?.[0]),
      )
      if (conversationsToInsert.length > 0) {
        await tx
          .insert(conversationModel)
          .values(conversationsToInsert)
          .onConflictDoNothing({ target: [conversationModel.contactId] })
      }

      if (trulyNew > 0) {
        const workspaceRow = await tx
          .select({ ownerId: workspaceModel.ownerId })
          .from(workspaceModel)
          .where(eq(workspaceModel.id, workspaceId))
          .limit(1)
        const ownerId = workspaceRow[0]?.ownerId
        if (ownerId) {
          await tx
            .insert(userQuotaModel)
            .values({
              userId: ownerId,
              contactsUsed: trulyNew,
              syncedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: userQuotaModel.userId,
              set: {
                contactsUsed: sql`${userQuotaModel.contactsUsed} + ${trulyNew}`,
                updatedAt: sql`CURRENT_TIMESTAMP`,
              },
            })
        }
      }

      // Resolve conversation ids for everything just inserted (or raced).
      const acceptedContactIds = insertedInboxes.map((r) => r.contactId)
      const newConversations = await tx
        .select({
          id: conversationModel.id,
          contactId: conversationModel.contactId,
        })
        .from(conversationModel)
        .where(inArray(conversationModel.contactId, acceptedContactIds))
      const convByContactNew = new Map(
        newConversations.map((c) => [c.contactId, c.id]),
      )

      for (const inboxRow of insertedInboxes) {
        const convId = convByContactNew.get(inboxRow.contactId)
        if (!convId) {
          continue
        }
        resolved.set(inboxRow.sourceId, {
          contactInboxId: inboxRow.id,
          contactId: inboxRow.contactId,
          conversationId: convId,
        })

        const entry = dedup.get(inboxRow.sourceId)
        if (entry) {
          newContactCreatedEvents.push({
            workspaceId,
            contactId: inboxRow.contactId,
            contactInboxId: inboxRow.id,
            sourceId: inboxRow.sourceId,
            firstName: entry.firstName,
            phoneNumber: entry.phoneNumber,
            email: entry.email,
            channel: inbox.channel,
            source: inbox.channel,
            createdAt: new Date(),
          })
        }
      }
    }

    for (const [sourceId, link] of resolved) {
      contactInboxIds.set(sourceId, link)
    }
  })

  // Post-commit side effects.
  for (const ev of newContactCreatedEvents) {
    emitContactCreated(
      ev.workspaceId,
      ev.contactId,
      ev.firstName,
      ev.phoneNumber,
      ev.email,
    ).catch((error) => {
      logger.error(error, "[coexist] Failed to emit contactCreated event")
    })

    emit("analytics:dashboard", {
      eventType: "contact:created",
      workspaceId: ev.workspaceId,
      contactId: ev.contactInboxId,
      occurredAt: ev.createdAt,
      source: ev.source,
      sourceId: ev.sourceId,
      channel: ev.channel,
      metadata: {
        triggerContext: {
          triggerSource: "worker",
          triggerHandler: "bulkImportContacts",
          triggerType: "contact_created",
        },
      },
    })?.catch((error) => {
      logger.error(error, "[coexist] Failed to emit contact:created")
    })
  }

  return {
    importedContacts,
    skippedContacts,
    contactInboxIds,
    failureReason,
  }
}

/**
 * Phase 2 of Coexist historical sync: bulk-insert messages for one resolved
 * Contact/ContactInbox/Conversation triple. Idempotent via the
 * (contactInboxId, sourceId) unique constraint — retries never duplicate rows.
 *
 * Chunks INSERTs at 1000 rows to stay under the Postgres 65535-param limit.
 * On a cross-run PK collision (partition+ms+seq clash), regenerates IDs from
 * the factory and retries the chunk once.
 *
 * When `contactEnrichment` is provided (phone/email discovered while scanning
 * message bodies), COALESCE-fills the parent Contact row in the same tx so
 * downstream UI sees the enrichment atomically with the new messages.
 */
export const bulkImportMessages = async (props: {
  workspaceId: string
  runId: string
  contactInboxId: string
  contactId: string
  conversationId: string
  messages: HistoricalMessage[]
  contactEnrichment?: { phoneNumber?: string; email?: string }
  /**
   * Optional shared ID factory. Phase 2 of Messenger sync creates ONE factory
   * per run and passes it to every per-conv `bulkImportMessages` call so the
   * seq counter is shared across convs — without this, two messages from
   * different convs that share a `created_time` (sub-second resolution from
   * Graph) would emit the same ID and hit the unique PK retry path.
   */
  idFactory?: HistoricalIdFactory
}): Promise<BulkImportMessagesResult> => {
  const {
    workspaceId,
    runId,
    contactInboxId,
    contactId,
    conversationId,
    messages,
    contactEnrichment,
    idFactory,
  } = props

  const empty: BulkImportMessagesResult = {
    importedMessages: 0,
    skippedMessages: 0,
    insertedAttachmentIds: [],
  }

  const hasEnrichment =
    contactEnrichment != null &&
    Boolean(contactEnrichment.phoneNumber || contactEnrichment.email)

  if (messages.length === 0 && !hasEnrichment) {
    return empty
  }

  const makeMessageId = idFactory ?? createHistoricalIdFactory(runId)
  let importedMessages = 0
  let skippedMessages = 0
  const insertedAttachmentIds: string[] = []

  await db.transaction(async (tx) => {
    if (hasEnrichment && contactEnrichment) {
      await tx.execute(sql`
        UPDATE "Contact" SET
          "phoneNumber" = COALESCE("phoneNumber", ${contactEnrichment.phoneNumber ?? null}::text),
          "email"       = COALESCE("email",       ${contactEnrichment.email ?? null}::text)
        WHERE "id" = ${contactId}
          AND (
            (${contactEnrichment.phoneNumber ?? null}::text IS NOT NULL AND "phoneNumber" IS NULL)
            OR (${contactEnrichment.email ?? null}::text IS NOT NULL AND "email" IS NULL)
          )
      `)
    }

    if (messages.length === 0) {
      return
    }

    const messageRows: (typeof messageModel.$inferInsert)[] = messages.map(
      (msg) => {
        const isOutgoing = msg.messageType === "outgoing"
        const createdAt = msg.createdAt ?? new Date()
        return {
          id: makeMessageId(createdAt),
          conversationId,
          contactInboxId,
          senderType: isOutgoing ? "user" : "contact",
          workspaceId,
          sourceId: msg.sourceId,
          senderId: isOutgoing ? null : contactId,
          messageType: msg.messageType,
          text: msg.text,
          contentType: msg.contentType,
          contentAttributes: msg.contentAttributes,
          createdAt,
          updatedAt: createdAt,
        }
      },
    )

    // Map message.sourceId → its attachments[] so post-insert we can resolve
    // each inserted Message row to the right Attachment payload. Skip messages
    // without attachments to avoid empty lookups.
    const attachmentsBySourceId = new Map<
      string,
      NonNullable<IncomingMessage["attachments"]>
    >()
    for (const msg of messages) {
      if (msg.attachments && msg.attachments.length > 0) {
        attachmentsBySourceId.set(msg.sourceId, msg.attachments)
      }
    }

    const CHUNK_SIZE = 1000
    let insertedTotal = 0
    const insertedMessageBySourceId = new Map<string, string>()
    for (let i = 0; i < messageRows.length; i += CHUNK_SIZE) {
      const chunk = messageRows.slice(i, i + CHUNK_SIZE)
      let inserted: { id: string; sourceId: string | null }[]
      try {
        inserted = await tx
          .insert(messageModel)
          .values(chunk)
          .onConflictDoNothing({
            target: [messageModel.contactInboxId, messageModel.sourceId],
          })
          .returning({
            id: messageModel.id,
            sourceId: messageModel.sourceId,
          })
      } catch (err) {
        if (!isUniqueMessagePkViolation(err)) {
          throw err
        }
        logger.warn(
          { runId, chunkStart: i, chunkSize: chunk.length },
          "[coexist] Message PK collision — regenerating IDs and retrying",
        )
        const retried = chunk.map((row) => ({
          ...row,
          id: makeMessageId(row.createdAt as Date),
        }))
        inserted = await tx
          .insert(messageModel)
          .values(retried)
          .onConflictDoNothing({
            target: [messageModel.contactInboxId, messageModel.sourceId],
          })
          .returning({
            id: messageModel.id,
            sourceId: messageModel.sourceId,
          })
      }
      insertedTotal += inserted.length
      for (const row of inserted) {
        if (row.sourceId) {
          insertedMessageBySourceId.set(row.sourceId, row.id)
        }
      }
    }
    importedMessages = insertedTotal
    skippedMessages = messages.length - insertedTotal

    // Insert Attachment rows for newly-inserted messages only. Messages that
    // hit the (contactInboxId, sourceId) conflict are skipped — their
    // attachments were inserted on the original successful run, so re-inserting
    // here would duplicate. No unique constraint on (messageId, sourceId)
    // means correctness depends on the message-level conflict guard above.
    if (attachmentsBySourceId.size > 0) {
      const attachmentRows: (typeof attachmentModel.$inferInsert)[] = []
      for (const [sourceId, atts] of attachmentsBySourceId) {
        const messageId = insertedMessageBySourceId.get(sourceId)
        if (!messageId) {
          continue
        }
        for (const att of atts) {
          attachmentRows.push({
            id: createId(),
            workspaceId,
            conversationId,
            messageId,
            sourceId: att.sourceId,
            fileType: att.fileType,
            mimeType: att.mimeType,
            originPath: att.originPath,
            size: att.size,
            width: att.width ?? undefined,
            height: att.height ?? undefined,
            name: att.name,
          })
        }
      }
      if (attachmentRows.length > 0) {
        const insertedAtt = await tx
          .insert(attachmentModel)
          .values(attachmentRows)
          .returning({ id: attachmentModel.id })
        for (const r of insertedAtt) {
          insertedAttachmentIds.push(r.id)
        }
      }
    }
  })

  // Touch parent contact lastActivityAt so list ordering reflects sync. Best
  // effort — failure here doesn't roll back the message insert.
  if (importedMessages > 0) {
    try {
      await db
        .update(contactModel)
        .set({ lastActivityAt: new Date() })
        .where(eq(contactModel.id, contactId))
    } catch (error) {
      logger.warn(
        { error, contactId },
        "[coexist] failed to bump lastActivityAt",
      )
    }
  }

  return {
    importedMessages,
    skippedMessages,
    insertedAttachmentIds,
  }
}

/**
 * Backward-compat combined import for WhatsApp coexist flush. Internally
 * delegates to `bulkImportContacts` + per-contact `bulkImportMessages`.
 * Preserves the prior return shape (sourceId → contactInboxId map and
 * aggregate counters).
 */
export const bulkImportHistorical = async (props: {
  inbox: InboxModel
  workspaceId: string
  runId: string
  batch: HistoricalContactMessages[]
}): Promise<BulkImportHistoricalResult> => {
  const { inbox, workspaceId, runId, batch } = props

  const contactsResult = await bulkImportContacts({
    inbox,
    workspaceId,
    contacts: batch.map((b) => b.contact),
  })

  const contactInboxIds = new Map<string, string>()
  for (const [sourceId, link] of contactsResult.contactInboxIds) {
    contactInboxIds.set(sourceId, link.contactInboxId)
  }

  let importedMessages = 0
  let skippedMessages = 0
  let failedMessages = 0
  const insertedAttachmentIds: string[] = []

  const limit = pLimit(3)
  await Promise.all(
    batch.map((entry) =>
      limit(async () => {
        if (entry.messages.length === 0) {
          return
        }
        const link = contactsResult.contactInboxIds.get(entry.contact.sourceId)
        if (!link) {
          // No link = the contact could not be set up (import error or workspace
          // cap) so its messages can never be imported. Count as FAILED, not
          // skipped: "skipped" means an intentional no-op (duplicate / outside
          // the retention window), whereas this is an error condition — same
          // semantics as the catch branch below.
          failedMessages += entry.messages.length
          return
        }
        try {
          const res = await bulkImportMessages({
            workspaceId,
            runId,
            contactInboxId: link.contactInboxId,
            contactId: link.contactId,
            conversationId: link.conversationId,
            messages: entry.messages,
          })
          importedMessages += res.importedMessages
          skippedMessages += res.skippedMessages
          for (const id of res.insertedAttachmentIds) {
            insertedAttachmentIds.push(id)
          }
        } catch (error) {
          logger.error(
            { error, runId, sourceId: entry.contact.sourceId },
            "[coexist] bulkImportMessages threw inside bulkImportHistorical",
          )
          failedMessages += entry.messages.length
        }
      }),
    ),
  )

  return {
    importedContacts: contactsResult.importedContacts,
    skippedContacts: contactsResult.skippedContacts,
    importedMessages,
    skippedMessages,
    failedMessages,
    contactInboxIds,
    insertedAttachmentIds,
    failureReason: contactsResult.failureReason,
  }
}
