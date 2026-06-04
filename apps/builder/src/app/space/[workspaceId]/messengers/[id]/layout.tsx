import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { AppBreadcrumb } from "@/components/app-breadcrumb"
import { MessengerSettingTabs } from "@/features/integration-messenger/components/messenger-setting-tabs"

type LayoutProps = {
  children: ReactNode
  params: Promise<{ workspaceId: string; id: string }>
}

export default async function MessengerLayout({
  children,
  params,
}: LayoutProps) {
  const t = await getTranslations()
  const resolvedParams = await params
  const workspaceId = getIdFromParams(resolvedParams, "workspaceId")
  if (!workspaceId) {
    return notFound()
  }
  const integrationId = getIdFromParams(resolvedParams, "id")
  if (!integrationId) {
    return notFound()
  }

  return (
    <>
      <AppBreadcrumb
        items={[
          {
            label: t("channels.title"),
            href: `/space/${workspaceId}/settings/channels`,
          },
          { label: t("fields.messenger.label"), href: "" },
        ]}
      />
      <MessengerSettingTabs />

      <div>{children}</div>
    </>
  )
}
