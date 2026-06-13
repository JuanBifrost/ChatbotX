import {
  and,
  type DatabaseClient,
  db,
  eq,
  type Transaction,
} from "@chatbotx.io/database/client"
import { contactsOnSequenceModel } from "@chatbotx.io/database/schema"
import {
  calculateNextRunAtFromStep,
  cancelPendingDispatches,
  enrollContactInSequence,
  removeDispatchesFromSchedule,
} from "@chatbotx.io/sequence-scheduler"
import { BaseService } from "../base.service"
import { logger } from "../logger"

type DrizzleClient = DatabaseClient | Transaction
type DispatchToRemove = { id: string; bucket: number }
type RemoveReason = "enrollment_removed" | "unsubscribed_via_flow"

type RemoveContactSequencesForContactsParams = {
  client?: DrizzleClient
  contactIds: string[]
  removeFromSchedule?: boolean
  reason: RemoveReason
  sequenceIds: string[]
  useTransaction?: boolean
  workspaceId: string
}

type RemoveContactSequencesForContactParams = {
  client?: DrizzleClient
  contactId: string
  removeFromSchedule?: boolean
  reason: RemoveReason
  sequenceIds: string[]
  useTransaction?: boolean
  workspaceId: string
}

type UpdateContactSequencesParams = {
  contactId: string
  sequenceIds: string[]
  workspaceId: string
}

class ContactSequenceService extends BaseService {
  async removeContactSequencesForContacts(
    params: RemoveContactSequencesForContactsParams,
  ): Promise<DispatchToRemove[]> {
    const { workspaceId, contactIds, sequenceIds, reason } = params
    const client = params.client ?? db
    const removeFromSchedule = params.removeFromSchedule ?? true
    const useTransaction = params.useTransaction ?? !params.client

    if (params.client && params.useTransaction) {
      throw new Error("client and useTransaction are mutually exclusive")
    }

    if (contactIds.length === 0 || sequenceIds.length === 0) {
      return []
    }

    const removeWithClient = async (tx: DrizzleClient) => {
      const enrollments = await tx.query.contactsOnSequenceModel.findMany({
        where: {
          contactId: { in: contactIds },
          sequenceId: { in: sequenceIds },
          workspaceId,
        },
        columns: {
          id: true,
          workspaceId: true,
        },
      })

      return await this.removeEnrollmentsWithClient(tx, enrollments, reason)
    }

    const dispatchesToRemove: DispatchToRemove[] = useTransaction
      ? await this.runInTransaction(removeWithClient)
      : await removeWithClient(client)

    if (removeFromSchedule) {
      try {
        await removeDispatchesFromSchedule(dispatchesToRemove)
      } catch (err) {
        logger.warn(
          { err, dispatchCount: dispatchesToRemove.length },
          "Failed to remove dispatches from schedule after DB commit",
        )
      }
    }

    return dispatchesToRemove
  }

  async removeContactSequencesForContact(
    params: RemoveContactSequencesForContactParams,
  ) {
    return await this.removeContactSequencesForContacts({
      workspaceId: params.workspaceId,
      contactIds: [params.contactId],
      sequenceIds: params.sequenceIds,
      reason: params.reason,
      client: params.client,
      removeFromSchedule: params.removeFromSchedule,
      useTransaction: params.useTransaction,
    })
  }

  async updateContactSequences(params: UpdateContactSequencesParams) {
    const { workspaceId, contactId, sequenceIds } = params
    const result = await db.transaction(async (tx) => {
      const currentIds = await this.getCurrentSequenceIds(
        contactId,
        workspaceId,
        tx,
      )
      const { toAdd, toRemove } = this.calculateSequenceDiff(
        currentIds,
        sequenceIds,
      )

      const dispatchesToRemove = await this.removeContactSequencesForContact({
        workspaceId,
        contactId,
        sequenceIds: toRemove,
        reason: "enrollment_removed",
        client: tx,
        removeFromSchedule: false,
      })

      await this.addContactSequences(contactId, toAdd, workspaceId, tx)

      const returnedSequences = await tx.query.contactsOnSequenceModel.findMany(
        {
          where: {
            contactId,
            workspaceId,
          },
          with: { sequence: true },
        },
      )

      return { returnedSequences, dispatchesToRemove }
    })

    try {
      await removeDispatchesFromSchedule(result.dispatchesToRemove)
    } catch (err) {
      logger.warn(
        { err, dispatchCount: result.dispatchesToRemove.length },
        "Failed to remove dispatches from schedule after DB commit",
      )
    }

    return result.returnedSequences
  }

  private async removeEnrollmentsWithClient(
    client: DrizzleClient,
    enrollments: Array<{ id: string; workspaceId: string }>,
    reason: RemoveReason,
  ): Promise<DispatchToRemove[]> {
    if (enrollments.length === 0) {
      return []
    }

    const canceledDispatches = (
      await Promise.all(
        enrollments.map((enrollment) =>
          cancelPendingDispatches({
            client,
            enrollmentId: enrollment.id,
            workspaceId: enrollment.workspaceId,
            reason,
            removeFromSchedule: false,
          }),
        ),
      )
    ).flat()

    await Promise.all(
      enrollments.map((enrollment) =>
        client
          .delete(contactsOnSequenceModel)
          .where(
            and(
              eq(contactsOnSequenceModel.id, enrollment.id),
              eq(contactsOnSequenceModel.workspaceId, enrollment.workspaceId),
            ),
          ),
      ),
    )

    return canceledDispatches
  }

  private async getCurrentSequenceIds(
    contactId: string,
    workspaceId: string,
    client: DrizzleClient = db,
  ) {
    const sequences = await client.query.contactsOnSequenceModel.findMany({
      where: {
        contactId,
        workspaceId,
      },
      columns: {
        sequenceId: true,
      },
    })

    return sequences.map((sequence) => sequence.sequenceId)
  }

  private calculateSequenceDiff(currentIds: string[], newIds: string[]) {
    const currentSet = new Set(currentIds)
    const newSet = new Set(newIds)

    return {
      toAdd: newIds.filter((id) => !currentSet.has(id)),
      toRemove: currentIds.filter((id) => !newSet.has(id)),
    }
  }

  private async addContactSequences(
    contactId: string,
    sequenceIds: string[],
    workspaceId: string,
    client: DrizzleClient = db,
  ) {
    if (sequenceIds.length === 0) {
      return
    }

    const now = new Date()
    const nextRunAtMap = await this.calculateNextRunAtBulk(
      sequenceIds,
      now,
      client,
    )

    for (const sequenceId of sequenceIds) {
      const nextRun = nextRunAtMap.get(sequenceId) ?? {
        nextRunAt: now,
        nextStepId: null,
      }

      await enrollContactInSequence({
        workspaceId,
        contactId,
        sequenceId,
        nextRunAt: nextRun.nextRunAt,
        nextStepId: nextRun.nextStepId,
        enrolledAt: now,
        client,
      })
    }
  }

  private async calculateNextRunAtBulk(
    sequenceIds: string[],
    enrolledAt: Date,
    client: DrizzleClient,
  ) {
    const firstSteps = await client.query.sequenceStepModel.findMany({
      where: {
        sequenceId: { in: sequenceIds },
        order: 0,
        isActive: true,
      },
      columns: {
        id: true,
        sequenceId: true,
        delayDays: true,
        delayMinutes: true,
        delayUnit: true,
        specificDateTime: true,
      },
    })

    const stepMap = new Map(firstSteps.map((step) => [step.sequenceId, step]))
    const resultMap = new Map<
      string,
      { nextRunAt: Date; nextStepId: string | null }
    >()

    for (const sequenceId of sequenceIds) {
      const step = stepMap.get(sequenceId)
      if (!step) {
        resultMap.set(sequenceId, { nextRunAt: enrolledAt, nextStepId: null })
        continue
      }

      resultMap.set(sequenceId, {
        nextRunAt: calculateNextRunAtFromStep(step, enrolledAt),
        nextStepId: step.id,
      })
    }

    return resultMap
  }

  private async runInTransaction<T>(
    callback: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    return await db.transaction(callback)
  }
}

export const contactSequenceService = new ContactSequenceService()
