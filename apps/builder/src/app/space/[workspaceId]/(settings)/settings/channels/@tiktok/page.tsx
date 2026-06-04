import {
  platformCredentialService,
  workspaceService,
} from "@chatbotx.io/business"
import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { listIntegrationTiktoks } from "@/features/integration-tiktok/queries"
import { TiktokManage } from "@/features/integration-tiktok/tiktok-manage"

export default async function SettingChannelTiktokPage(props: {
  params: Promise<{ workspaceId: string }>
}) {
  const workspaceId = getIdFromParams(await props.params, "workspaceId")
  if (!workspaceId) {
    return notFound()
  }

  const workspace = await workspaceService.find({ where: { id: workspaceId } })
  if (!workspace) {
    return notFound()
  }

  const credential = await platformCredentialService.resolveForOwner({
    ownerId: workspace.ownerId,
    type: "tiktok",
  })
  const isEnabled = Boolean(credential?.publicConfig.clientId)

  const promises = Promise.all([
    listIntegrationTiktoks({
      where: { workspaceId },
    }),
  ])

  return (
    <TiktokManage
      isEnabled={isEnabled}
      promises={promises}
      workspaceId={workspaceId}
    />
  )
}
