"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@chatbotx.io/ui/components/ui/alert-dialog"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useState } from "react"
import { toast } from "sonner"
import { SettingRow } from "@/components/setting-row"
import { AiIntegrationApiKeyDialog } from "@/features/integration-ai/components/ai-integration-api-key-dialog"
import { connectKlaviyoAction } from "../actions/connect.action"
import { disconnectKlaviyoAction } from "../actions/disconnect.action"
import { connectKlaviyoSchema } from "../schemas"

export function ManageKlaviyo(props: {
  workspaceId: string
  isConnected: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const t = useTranslations()
  const featureName = t("fields.klaviyo.label")
  const { form, handleSubmitWithAction } = useHookFormAction(
    connectKlaviyoAction.bind(null, props.workspaceId),
    zodResolver(connectKlaviyoSchema),
    {
      actionProps: {
        onSuccess: () => {
          setOpen(false)
          router.refresh()
          toast.success(t("messages.connectSuccess", { feature: featureName }))
        },
        onError: ({ error }) =>
          error.serverError && toast.error(error.serverError),
      },
      formProps: { mode: "onChange", defaultValues: { apiKey: "" } },
    },
  )
  const { executeAsync: disconnect, isPending } = useAction(
    disconnectKlaviyoAction.bind(null, props.workspaceId),
    {
      onSuccess: () => {
        router.refresh()
        toast.success(t("messages.disconnectSuccess", { feature: featureName }))
      },
      onError: ({ error }) =>
        error.serverError && toast.error(error.serverError),
    },
  )

  return (
    <SettingRow
      description={t("klaviyo.setting.description")}
      label={t("klaviyo.setting.label")}
    >
      {props.isConnected ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive">
              {t("actions.disconnect")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("messages.disconnectFeature", { feature: featureName })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("messages.disconnectFeatureDescription", {
                  feature: featureName,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPending}
                onClick={async (event) => {
                  event.preventDefault()
                  await disconnect()
                }}
              >
                {isPending && <Loader2Icon className="animate-spin" />}
                {t("actions.disconnect")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <AiIntegrationApiKeyDialog
          credentialLabel={t("klaviyo.fields.apiKey")}
          form={form}
          onOpenChange={setOpen}
          onSubmit={handleSubmitWithAction}
          open={open}
          title={featureName}
        />
      )}
    </SettingRow>
  )
}
