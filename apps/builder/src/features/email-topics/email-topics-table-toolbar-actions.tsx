"use client"

import type { EmailTopicModel } from "@chatbotx.io/database/types"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import type { Table } from "@tanstack/react-table"
import { FolderUpIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ChangeFolderDialog } from "../folders/change-folder"
import { DeleteEmailTopicsDialog } from "./delete-email-topic-dialog"

type EmailTopicsTableToolbarActionsProps = {
  table: Table<EmailTopicModel>
  workspaceId: string
}

export function EmailTopicsTableToolbarActions({
  table,
  workspaceId,
}: EmailTopicsTableToolbarActionsProps) {
  const t = useTranslations()
  const [openChangeFolder, setOpenChangeFolder] = useState(false)

  const selectedRows = table.getFilteredSelectedRowModel().rows

  return (
    <div className="flex items-center gap-2">
      {selectedRows.length > 0 ? (
        <>
          <DeleteEmailTopicsDialog
            emailTopics={selectedRows.map((row) => row.original)}
            onSuccess={() => table.toggleAllRowsSelected(false)}
            workspaceId={workspaceId}
          />
          <ChangeFolderDialog
            currentFolderId={null}
            folderType="emailTopic"
            modelIds={selectedRows.map((row) => row.original.id)}
            onOpenChange={setOpenChangeFolder}
            open={openChangeFolder}
            trigger={
              <Button type="button" variant="outline">
                <FolderUpIcon aria-hidden="true" className="size-4" />
                {t("actions.move")}
              </Button>
            }
            workspaceId={workspaceId}
          />
        </>
      ) : null}
    </div>
  )
}
