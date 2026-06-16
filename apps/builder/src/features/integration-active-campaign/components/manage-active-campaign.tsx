"use client"

import { InputField } from "@chatbotx.io/ui/components/form/input-field"
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useState } from "react"
import { toast } from "sonner"
import { SettingRow } from "@/components/setting-row"
import { connectActiveCampaignAction } from "../actions/connect.action"
import { disconnectActiveCampaignAction } from "../actions/disconnect.action"
import { connectActiveCampaignSchema } from "../schemas"

export function ManageActiveCampaign(props: {
  workspaceId: string
  isConnected: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const t = useTranslations()
  const featureName = t("fields.activeCampaign.label")

  const { form, handleSubmitWithAction } = useHookFormAction(
    connectActiveCampaignAction.bind(null, props.workspaceId),
    zodResolver(connectActiveCampaignSchema),
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
      formProps: {
        mode: "onChange",
        defaultValues: { apiUrl: "", apiKey: "" },
      },
    },
  )
  const { execute: disconnect, isPending } = useAction(
    disconnectActiveCampaignAction.bind(null, props.workspaceId),
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
      description={t("activeCampaign.setting.description")}
      label={t("activeCampaign.setting.label")}
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
                onClick={(event) => {
                  event.preventDefault()
                  disconnect()
                }}
              >
                {isPending && <Loader2Icon className="animate-spin" />}
                {t("actions.disconnect")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              {t("actions.connect")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {t("actions.connectFeature", { feature: featureName })}
              </DialogTitle>
              <DialogDescription>
                {t("activeCampaign.dialog.description")}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form className="space-y-4" onSubmit={handleSubmitWithAction}>
                <InputField
                  label={t("activeCampaign.fields.apiUrl")}
                  name="apiUrl"
                  placeholder={t("activeCampaign.fields.apiUrlPlaceholder")}
                  required
                />
                <InputField
                  label={t("activeCampaign.fields.apiKey")}
                  name="apiKey"
                  required
                  type="password"
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      {t("actions.cancel")}
                    </Button>
                  </DialogClose>
                  <Button
                    disabled={
                      !form.formState.isValid || form.formState.isSubmitting
                    }
                    type="submit"
                  >
                    {form.formState.isSubmitting && (
                      <Loader2Icon className="animate-spin" />
                    )}
                    {t("actions.confirm")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </SettingRow>
  )
}
