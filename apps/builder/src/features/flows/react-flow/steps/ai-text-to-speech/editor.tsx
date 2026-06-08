"use client"

import { useTranslations } from "next-intl"
import { AIIcon } from "../ai-generate-text/components/ai-icon"
import { BaseStepEditor } from "../base/editor"
import { AIModelDialog } from "./components/ai-model-dialog"

type AITextToSpeechEditorProps = {
  parentName: string
}

const AITextToSpeechEditor = ({ parentName }: AITextToSpeechEditorProps) => {
  const t = useTranslations()

  return (
    <BaseStepEditor
      iconNode={<AIIcon provider="openai" showLabel={false} />}
      title={t("fields.flows.aiTextToSpeech", {
        aiName: t("aiProviders.openai"),
      })}
    >
      <AIModelDialog parentName={parentName} />
    </BaseStepEditor>
  )
}

export default AITextToSpeechEditor
