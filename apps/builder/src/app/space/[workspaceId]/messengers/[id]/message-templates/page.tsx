import { db, inArray } from "@chatbotx.io/database/client"
import { integrationMessengerModel } from "@chatbotx.io/database/schema"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { MessengerMessageTemplatesTable } from "@/features/integration-messenger/message-templates/message-templates-table"
import { messengerMessageTemplateService } from "@/features/integration-messenger/message-templates/queries"
import { listMessengerMessageTemplatesSearchParamsCache } from "@/features/integration-messenger/message-templates/schema/query"
import { findIntegrationMessenger } from "@/features/integration-messenger/queries"
import { getAllWorkspaceMembers } from "@/features/workspace-members/queries"
import { withWorkspaceIdAndIdSchema } from "@/features/workspaces/schema/resource"
import { getCurrentUserId } from "@/lib/auth/utils"

export default async function MessengerMessageTemplatesPage(props: {
  params: Promise<{ workspaceId: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { data } = withWorkspaceIdAndIdSchema.safeParse(await props.params)
  if (!data) {
    return notFound()
  }

  const { workspaceId, id } = data
  const search = listMessengerMessageTemplatesSearchParamsCache.parse(
    await props.searchParams,
  )

  let integrationMessenger: Awaited<ReturnType<typeof findIntegrationMessenger>>
  try {
    integrationMessenger = await findIntegrationMessenger({ workspaceId, id })
  } catch {
    return notFound()
  }

  // Clone targets = every Messenger channel across all workspaces where the
  // current user is an owner ("admin"), excluding the current channel.
  const userId = await getCurrentUserId()
  let channels: { id: string; name: string }[] = []
  if (userId) {
    const { workspaceMembers } = await getAllWorkspaceMembers(userId)
    const ownerWorkspaceIds = Array.from(
      new Set(
        workspaceMembers
          .filter((member) => member.role === "owner")
          .map((member) => member.workspaceId),
      ),
    )
    if (ownerWorkspaceIds.length > 0) {
      const rows = await db
        .select({
          id: integrationMessengerModel.id,
          name: integrationMessengerModel.name,
          pageId: integrationMessengerModel.pageId,
        })
        .from(integrationMessengerModel)
        .where(
          inArray(integrationMessengerModel.workspaceId, ownerWorkspaceIds),
        )
      // Exclude the current Facebook Page (by pageId) — it may be connected in
      // more than one workspace, so filtering by integration id alone is not enough.
      channels = rows
        .filter((channel) => channel.pageId !== integrationMessenger.pageId)
        .map((channel) => ({ id: channel.id, name: channel.name }))
    }
  }

  const promises = messengerMessageTemplateService.listPaginated({
    where: {
      workspaceId,
      integrationMessengerId: id,
      name: search.name,
    },
    page: search.page,
    perPage: search.perPage,
  })

  return (
    <Suspense>
      <MessengerMessageTemplatesTable
        channels={channels}
        integrationMessenger={integrationMessenger}
        promises={promises}
      />
    </Suspense>
  )
}
