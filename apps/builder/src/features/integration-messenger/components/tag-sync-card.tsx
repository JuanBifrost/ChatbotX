"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@chatbotx.io/ui/components/ui/card"
import { Label } from "@chatbotx.io/ui/components/ui/label"
import { Switch } from "@chatbotx.io/ui/components/ui/switch"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useState } from "react"
import { toast } from "sonner"
import { toggleMessengerTagSyncAction } from "../actions/toggle-tag-sync.action"

interface TagSyncCardProps {
  integrationId: string
  pageId: string
  syncTagEnabledAt: Date | null
  workspaceId: string
}

export function TagSyncCard({
  workspaceId,
  integrationId,
  pageId,
  syncTagEnabledAt,
}: TagSyncCardProps) {
  const t = useTranslations()
  const [enabled, setEnabled] = useState(Boolean(syncTagEnabledAt))

  const { execute, isPending } = useAction(
    toggleMessengerTagSyncAction.bind(null, workspaceId, integrationId),
    {
      onSuccess: ({ data }) => {
        setEnabled(Boolean(data?.syncTagEnabledAt))
        toast.success(t("messenger.tagSync.toggleSuccess"))
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Error")
      },
    },
  )

  const tosUrl = `https://fb.com/${pageId}/inbox/page_contact_tos`

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("messenger.tagSync.title")}</CardTitle>
        <CardDescription>{t("messenger.tagSync.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <div className="mb-2 flex items-center gap-3">
            <Switch
              checked={enabled}
              disabled={isPending}
              onCheckedChange={() => execute({ enabled: !enabled })}
            />
            <Label className="text-base">
              {t("messenger.tagSync.labelSync")}
            </Label>
          </div>
        </div>
        <p className="text-destructive text-sm italic">
          {t("messenger.tagSync.termsRequired")}{" "}
          <a
            className="underline"
            href={tosUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {tosUrl}
          </a>
        </p>
      </CardContent>
    </Card>
  )
}
