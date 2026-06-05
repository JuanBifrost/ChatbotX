"use client"

import type { InstagramAccount } from "@chatbotx.io/integration-instagram"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@chatbotx.io/ui/components/ui/card"
import { useTranslations } from "next-intl"
import { InstagramAccounts } from "@/features/integration-instagram/components/instagram-accounts"

type SelectAccountProps = {
  accounts: InstagramAccount[]
  workspaceId: string
}

export function SelectAccount({ accounts, workspaceId }: SelectAccountProps) {
  const t = useTranslations()

  return (
    <Card className="mx-auto mt-40 max-w-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {t("actions.connectFeature", { feature: "Instagram" })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <InstagramAccounts accounts={accounts} workspaceId={workspaceId} />
      </CardContent>
    </Card>
  )
}
