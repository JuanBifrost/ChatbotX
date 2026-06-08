"use client"

import { useTranslations } from "next-intl"
import { useFormContext } from "react-hook-form"
import { AIIcon } from "../ai-generate-text/components/ai-icon"
import { BaseStepEditor } from "../base/editor"
import { AIModelDialog } from "./components/ai-model-dialog"

type AIGenerateTextAgentEditorProps = {
  parentName: string
}

export const AIGenerateTextAgentEditor = (
  props: AIGenerateTextAgentEditorProps,
) => {
  const { parentName } = props
  const t = useTranslations()

  const { getValues } = useFormContext()
  const provider = getValues(`${parentName}.provider`)

  return (
    <BaseStepEditor
      iconNode={<AIIcon provider={provider} showLabel={false} />}
      title={t("fields.flows.aiGenerateTextAgent", {
        aiName: t(`aiProviders.${provider}`),
      })}
    >
      <AIModelDialog parentName={parentName} />
    </BaseStepEditor>
  )
}
