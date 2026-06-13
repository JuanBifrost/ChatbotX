import { db, type Transaction } from "@chatbotx.io/database/client"
import { contactsOnSequenceModel } from "@chatbotx.io/database/schema"
import { sequenceConnections } from "@chatbotx.io/redis"
import { SchedulerClient } from "@chatbotx.io/scheduler"
import { createId } from "@chatbotx.io/utils"
import { getContactInboxes } from "./contacts-on-sequences"
import { createDispatch } from "./dispatch-manager"

type DrizzleClient = typeof db | Transaction
type DispatchToSchedule = { id: string; bucket: number; runAtMs: string }

export type EnrollContactParams = {
  workspaceId: string
  client?: DrizzleClient
  contactId: string
  enrolledAt?: Date
  nextRunAt: Date
  nextStepId: string | null
  sequenceId: string
}

export async function enrollContactInSequence(params: EnrollContactParams) {
  const {
    workspaceId,
    contactId,
    sequenceId,
    nextRunAt,
    nextStepId,
    enrolledAt = new Date(),
    client,
  } = params

  const enroll = async (
    dbClient: DrizzleClient,
  ): Promise<DispatchToSchedule[]> => {
    const existing = await dbClient.query.contactsOnSequenceModel.findFirst({
      where: {
        contactId,
        sequenceId,
        workspaceId,
      },
      columns: { id: true },
    })

    if (existing) {
      return []
    }

    const enrollmentId = createId()
    const [enrollment] = await dbClient
      .insert(contactsOnSequenceModel)
      .values({
        id: enrollmentId,
        workspaceId,
        contactId,
        sequenceId,
        currentStep: 0,
        status: "active",
        nextRunAt,
        nextStepId,
        enrolledAt,
      })
      .returning({ id: contactsOnSequenceModel.id })

    if (!(nextStepId && enrollment)) {
      return []
    }

    const contactInboxes = await getContactInboxes(workspaceId, contactId)
    const dispatches: DispatchToSchedule[] = []

    for (const contactInbox of contactInboxes) {
      const dispatch = await createDispatch({
        workspaceId,
        sequenceId,
        contactId,
        contactInboxId: contactInbox.id,
        stepId: nextStepId,
        enrollmentId: enrollment.id,
        runAt: nextRunAt,
        client: dbClient,
      })

      dispatches.push(dispatch)
    }

    return dispatches
  }

  const dispatches = client
    ? await enroll(client)
    : await db.transaction(enroll)

  if (dispatches.length === 0) {
    return
  }

  const redisClient = await sequenceConnections.useExisting()
  const scheduler = new SchedulerClient(redisClient)
  for (const dispatch of dispatches) {
    await scheduler.addToSchedule(
      dispatch.bucket,
      dispatch.id,
      Number(dispatch.runAtMs),
    )
  }
}
export interface EnrollContactsBulkParams {
  enrolledAt?: Date
  enrollments: Array<{
    contactId: string
    sequenceId: string
    nextRunAt: Date
    nextStepId: string | null
  }>
  workspaceId: string
}
export async function enrollContactsInSequenceBulk(
  params: EnrollContactsBulkParams,
) {
  const { workspaceId, enrollments, enrolledAt = new Date() } = params
  const createdEnrollments = await db
    .insert(contactsOnSequenceModel)
    .values(
      enrollments.map((e) => ({
        id: createId(),
        workspaceId,
        contactId: e.contactId,
        sequenceId: e.sequenceId,
        currentStep: 0,
        status: "active" as const,
        nextRunAt: e.nextRunAt,
        nextStepId: e.nextStepId,
        enrolledAt,
      })),
    )
    .onConflictDoNothing()
    .returning({
      id: contactsOnSequenceModel.id,
      contactId: contactsOnSequenceModel.contactId,
      sequenceId: contactsOnSequenceModel.sequenceId,
      nextRunAt: contactsOnSequenceModel.nextRunAt,
      nextStepId: contactsOnSequenceModel.nextStepId,
    })
  const redisClient = await sequenceConnections.useExisting()
  const scheduler = new SchedulerClient(redisClient)
  for (const enrollment of createdEnrollments) {
    if (!(enrollment.nextStepId && enrollment.nextRunAt)) {
      continue
    }

    const contactInboxes = await getContactInboxes(
      workspaceId,
      enrollment.contactId,
    )

    for (const contactInbox of contactInboxes) {
      const dispatch = await createDispatch({
        workspaceId,
        sequenceId: enrollment.sequenceId,
        contactId: enrollment.contactId,
        contactInboxId: contactInbox.id,
        stepId: enrollment.nextStepId,
        enrollmentId: enrollment.id,
        runAt: enrollment.nextRunAt,
      })

      await scheduler.addToSchedule(
        dispatch.bucket,
        dispatch.id,
        Number(dispatch.runAtMs),
      )
    }
  }
}
