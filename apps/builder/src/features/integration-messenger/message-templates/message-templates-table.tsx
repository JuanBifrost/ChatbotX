"use client"

import type { IntegrationMessengerModel } from "@chatbotx.io/database/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@chatbotx.io/ui/components/ui/alert-dialog"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chatbotx.io/ui/components/ui/table"
import { CopyIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import React, { useState } from "react"
import { toast } from "sonner"
import { deleteMessengerMessageTemplateAction } from "./actions/delete-message-template"
import { CloneMessageTemplateDialog } from "./clone-message-template-dialog"
import { MessengerMessageTemplatesTableToolbarActions } from "./message-templates-table-toolbar-actions"
import type { MessengerMessageTemplateResource } from "./schema/resource"

type Channel = {
  id: string
  name: string
}

type MessengerMessageTemplatesTableProps = {
  integrationMessenger: IntegrationMessengerModel
  promises: Promise<MessengerMessageTemplateResource[]>
  channels: Channel[]
}

function DeleteTemplateButton({
  workspaceId,
  integrationMessengerId,
  templateId,
}: {
  workspaceId: string
  integrationMessengerId: string
  templateId: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { execute, isPending } = useAction(
    deleteMessengerMessageTemplateAction.bind(
      null,
      workspaceId,
      integrationMessengerId,
      templateId,
    ),
    {
      onSuccess() {
        toast.success(
          t("messages.deletedSuccess", {
            feature: t("fields.messageTemplate.label"),
          }),
        )
        router.refresh()
      },
      onError({ error }) {
        if (error.serverError) {
          toast.error(error.serverError)
        }
      },
    },
  )

  return (
    <>
      <Button
        disabled={isPending}
        onClick={() => setConfirmOpen(true)}
        size="sm"
        title={t("actions.remove")}
        variant="destructive"
      >
        <Trash2Icon className="size-4" />
        <span className="sr-only">{t("actions.remove")}</span>
      </Button>

      <AlertDialog onOpenChange={setConfirmOpen} open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("messages.deleteFeature", {
                feature: t("fields.messageTemplate.label"),
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("messages.deleteConfirmation", {
                feature: t("fields.messageTemplate.label"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={isPending}
              onClick={() => {
                setConfirmOpen(false)
                execute()
              }}
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function MessengerMessageTemplatesTable({
  integrationMessenger,
  promises,
  channels,
}: MessengerMessageTemplatesTableProps) {
  const t = useTranslations()
  const data = React.use(promises)

  const [cloneTarget, setCloneTarget] =
    useState<MessengerMessageTemplateResource | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fields.name.label")}</TableHead>
              <TableHead>{t("fields.language.label")}</TableHead>
              <TableHead>{t("fields.category.label")}</TableHead>
              <TableHead>{t("fields.status.label")}</TableHead>
              <TableHead>{t("actions.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((mt) => (
              <TableRow key={mt.id}>
                <TableCell>{mt.name}</TableCell>
                <TableCell>{mt.language}</TableCell>
                <TableCell>{mt.category}</TableCell>
                <TableCell>{mt.status}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {mt.status === "APPROVED" && (
                      <Button
                        onClick={() => setCloneTarget(mt)}
                        size="sm"
                        title={t("actions.clone")}
                        variant="outline"
                      >
                        <CopyIcon className="size-4" />
                        <span className="sr-only">{t("actions.clone")}</span>
                      </Button>
                    )}
                    {mt.status !== "APPROVED" && <div className="size-9" />}
                    <DeleteTemplateButton
                      integrationMessengerId={integrationMessenger.id}
                      templateId={mt.id}
                      workspaceId={integrationMessenger.workspaceId}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
              <TableRow>
                <TableCell className="text-center" colSpan={5}>
                  {t("messages.noData")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col items-center justify-center p-4">
        <MessengerMessageTemplatesTableToolbarActions
          integrationMessengerId={integrationMessenger.id}
          workspaceId={integrationMessenger.workspaceId}
        />
      </div>

      <CloneMessageTemplateDialog
        channels={channels}
        cloneTarget={cloneTarget}
        key={cloneTarget?.id ?? ""}
        onClose={() => setCloneTarget(null)}
        sourceIntegrationMessengerId={integrationMessenger.id}
        workspaceId={integrationMessenger.workspaceId}
      />
    </div>
  )
}
