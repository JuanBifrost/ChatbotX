"use client"

import { BotIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { BaseStepEditor } from "../base/editor"

export const AIDeleteMessageHistoryEditor = () => {
  const t = useTranslations()

  return (
    <BaseStepEditor
      icon={BotIcon}
      title={t("flows.actions.aiDeleteMessageHistory")}
    />
  )
}
