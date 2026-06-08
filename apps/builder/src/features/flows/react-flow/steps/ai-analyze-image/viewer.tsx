"use client"

import type { AIAnalyzeImageSchema } from "@chatbotx.io/flow-config"
import { useTranslations } from "next-intl"
import { AIIcon } from "../ai-generate-text/components/ai-icon"
import { StepStateHandles } from "../base/step-state-handles"

type AIAnalyzeImageViewerProps = {
  data: AIAnalyzeImageSchema
}

export const AIAnalyzeImageViewer = (props: AIAnalyzeImageViewerProps) => {
  const { data } = props
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex w-full items-center justify-center gap-2 text-center font-bold">
        <AIIcon
          label={t("fields.flows.aiAnalyzeImage", {
            aiName: t(`aiProviders.${data.provider}`),
          })}
          provider={data.provider}
        />
      </div>
      <StepStateHandles states={data.states} />
    </div>
  )
}
