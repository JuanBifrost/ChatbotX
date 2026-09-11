"use client"

import type { ExecuteJavascriptStepSchema } from "@chatbotx.io/flow-config"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import { Loader2Icon, PlayIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useFormContext } from "react-hook-form"
import { useJsonSourceContext } from "../external-request/components/json-source-context"
import { TestContactPicker } from "../shared/test-contact-picker"

export const TestJavascriptPanel = () => {
  const t = useTranslations()
  const { getValues } = useFormContext<ExecuteJavascriptStepSchema>()
  const {
    executeJavascript,
    isPending,
    testResult,
    testContactId,
    setTestContactId,
  } = useJsonSourceContext()

  const handleTestNow = () => {
    executeJavascript({ code: getValues("code") })
  }

  return (
    <div className="flex flex-col gap-2">
      <TestContactPicker
        onChange={setTestContactId}
        value={testContactId}
      />

      <Button
        disabled={isPending || !testContactId}
        onClick={handleTestNow}
        size="sm"
        type="button"
        variant="outline"
      >
        {isPending ? (
          <Loader2Icon className="me-2 size-4 animate-spin" />
        ) : (
          <PlayIcon className="me-2 size-4" />
        )}
        {t("actions.testNow")}
      </Button>
      {!testContactId && (
        <p className="text-muted-foreground text-xs">
          {t("fields.testContact.required")}
        </p>
      )}

      {testResult && (
        <div className="flex flex-col gap-3 text-xs">
          {testResult.inputSnapshot ? (
            <div className="flex flex-col gap-1 rounded-md border bg-muted/50 p-3">
              <div className="font-medium">
                {t("fields.javascriptCode.inputSnapshot")}
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all">
                {testResult.inputSnapshot}
              </pre>
            </div>
          ) : null}
          <div className="flex flex-col gap-1 rounded-md border bg-muted/50 p-3">
            <div className="flex gap-2 font-medium">
              <span>{t("fields.javascriptCode.returnValue")}</span>
              <span>{testResult.durationMs}ms</span>
            </div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all">
              {testResult.responseBody}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
