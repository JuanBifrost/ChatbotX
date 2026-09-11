"use client"

import type { ExternalRequestFieldsSchema } from "@chatbotx.io/flow-config"
import { useAction } from "next-safe-action/hooks"
import { useTranslations } from "next-intl"
import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react"
import { toast } from "sonner"
import { testExecuteJavascriptAction } from "@/features/flows/actions/test-execute-javascript-action"
import { testExternalRequestAction } from "@/features/flows/actions/test-external-request-action"
import { useWorkspaceId } from "@/hooks/routing"

type JsonSourceTab = "testResponse" | "pasteSample"

type TestResult = {
  statusCode: number
  durationMs: number
  inputSnapshot?: string
  responseBody: string
}

type JsonSourceContextValue = {
  execute: (input: ExternalRequestFieldsSchema) => void
  executeJavascript: (input: { code: string }) => void
  isPending: boolean
  testResult: TestResult | undefined
  testContactId: string | undefined
  setTestContactId: (contactId: string | undefined) => void
  pastedSample: string
  setPastedSample: (raw: string) => void
  activeTab: JsonSourceTab
  setActiveTab: (tab: JsonSourceTab) => void
  activeTargetIndex: number | null
  setActiveTargetIndex: (index: number | null) => void
}

const JsonSourceContext = createContext<JsonSourceContextValue | null>(null)

export const JsonSourceProvider = ({ children }: { children: ReactNode }) => {
  const t = useTranslations()
  const workspaceId = useWorkspaceId()
  const [pastedSample, setPastedSample] = useState("")
  const [activeTab, setActiveTab] = useState<JsonSourceTab>("pasteSample")
  const [activeTargetIndex, setActiveTargetIndex] = useState<number | null>(
    null,
  )
  const [testContactId, setTestContactId] = useState<string | undefined>()
  const [testResult, setTestResult] = useState<TestResult | undefined>()

  const handleTestSuccess = (data: TestResult | undefined) => {
    if (data) {
      setTestResult(data)
      setActiveTab("testResponse")
    }
  }

  const httpAction = useAction(
    testExternalRequestAction.bind(null, workspaceId),
    {
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
      onSuccess: ({ data }) => {
        handleTestSuccess(data)
      },
    },
  )

  const javascriptAction = useAction(
    testExecuteJavascriptAction.bind(null, workspaceId),
    {
      onError: ({ error }) => {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
      onSuccess: ({ data }) => {
        handleTestSuccess(data)
      },
    },
  )

  const value = useMemo<JsonSourceContextValue>(
    () => ({
      execute: (input) =>
        httpAction.execute({
          ...input,
          contactId: testContactId,
        }),
      executeJavascript: ({ code }) => {
        if (!testContactId) {
          toast.error(t("fields.testContact.required"))
          return
        }
        javascriptAction.execute({ code, contactId: testContactId })
      },
      isPending: httpAction.isPending || javascriptAction.isPending,
      testResult,
      testContactId,
      setTestContactId,
      pastedSample,
      setPastedSample,
      activeTab,
      setActiveTab,
      activeTargetIndex,
      setActiveTargetIndex,
    }),
    [
      httpAction,
      javascriptAction,
      testContactId,
      testResult,
      pastedSample,
      activeTab,
      activeTargetIndex,
      t,
    ],
  )

  return (
    <JsonSourceContext.Provider value={value}>
      {children}
    </JsonSourceContext.Provider>
  )
}

export const useJsonSourceContext = (): JsonSourceContextValue => {
  const context = useContext(JsonSourceContext)
  if (!context) {
    throw new Error(
      "useJsonSourceContext must be used within a JsonSourceProvider",
    )
  }
  return context
}
