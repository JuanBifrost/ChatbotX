"use client"

import { useTranslations } from "next-intl"
import { AIIcon } from "../ai-generate-text/components/ai-icon"
import { BaseStepEditor } from "../base/editor"
import { AIModelDialog } from "./components/ai-model-dialog"

type AISpeechToTextEditorProps = {
  parentName: string
}

const AISpeechToTextEditor = (props: AISpeechToTextEditorProps) => {
  const { parentName } = props
  const t = useTranslations()

  return (
    <BaseStepEditor
      iconNode={<AIIcon provider="openai" showLabel={false} />}
      title={t("fields.flows.aiSpeechToText", {
        aiName: t("aiProviders.openai"),
      })}
    >
      <AIModelDialog parentName={parentName} />
    </BaseStepEditor>
  )
}

export default AISpeechToTextEditor
