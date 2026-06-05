"use client"

import { BotIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { BaseStepViewer } from "../base/viewer"

export const AIDeleteMessageHistoryViewer = () => {
  const t = useTranslations()

  return (
    <BaseStepViewer
      icon={BotIcon}
      title={t("flows.actions.aiDeleteMessageHistory")}
    />
  )
}
