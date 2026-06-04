"use client"

import type { SendMessengerTemplateMessageStepSchema } from "@chatbotx.io/flow-config"
import { Card, CardContent } from "@chatbotx.io/ui/components/ui/card"
import { MessageSquareIcon } from "lucide-react"
import { ButtonGroupViewer } from "../button/viewer"

type SendMessengerTemplateMessageStepViewerProps = {
  data: SendMessengerTemplateMessageStepSchema
}

export const SendMessengerTemplateMessageStepViewer = (
  props: SendMessengerTemplateMessageStepViewerProps,
) => {
  const { data } = props

  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="bg-gray-200 px-4 py-2 dark:bg-neutral-600">
          <div className="mb-1 flex items-center gap-2">
            <MessageSquareIcon size={16} />
            <span className="font-medium text-sm">
              {data.template.name || "Template Message"}
            </span>
          </div>
          {data.template.language && (
            <div className="text-muted-foreground text-xs">
              {data.template.language}
            </div>
          )}
        </div>

        {data.buttons.length > 0 && <ButtonGroupViewer data={data.buttons} />}
      </CardContent>
    </Card>
  )
}
