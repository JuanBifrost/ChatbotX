"use client"

import { Switch } from "@chatbotx.io/ui/components/ui/switch"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { client } from "@/lib/orpc/orpc"

type MessengerCoexistToggleProps = {
  workspaceId: string
  integrationId: string
  initialEnabled: boolean
}

export function MessengerCoexistToggle({
  workspaceId,
  integrationId,
  initialEnabled,
}: MessengerCoexistToggleProps) {
  const t = useTranslations()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, setPending] = useState(false)

  const handleToggle = async (next: boolean) => {
    setPending(true)
    try {
      await client.integrationMessengerAPIs.setCoexistMessengerAPI({
        workspaceId,
        integrationId,
        enabled: next,
      })
      setEnabled(next)
    } catch {
      toast.error(t("messages.unknownError"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Switch
          checked={enabled}
          disabled={pending}
          onCheckedChange={handleToggle}
        />
        <span className="font-medium text-sm">{t("coexist.toggleLabel")}</span>
      </div>
      <p className="text-muted-foreground text-xs">
        {t("coexist.toggleHelperMessenger")}
      </p>
    </div>
  )
}
