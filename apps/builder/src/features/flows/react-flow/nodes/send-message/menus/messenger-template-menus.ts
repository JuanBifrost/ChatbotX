import type { ListInboxesResponse } from "@chatbotx.io/business"
import { stepTypes } from "@chatbotx.io/flow-config"
import { MessageSquareIcon } from "lucide-react"
import type { MenuData, MenuItem, TranslationFn } from "../../types"

export const messengerTemplateMenus = (
  t: TranslationFn,
  menuData?: MenuData,
  inbox?: ListInboxesResponse["data"][number],
): MenuItem[] => {
  let templates = menuData?.templates.messengerTemplates ?? []

  if (inbox) {
    templates = templates.filter(
      (template) => template.integrationMessenger?.inboxId === inbox.id,
    )
  }

  if (!templates || templates.length === 0) {
    return [
      {
        label: t("flows.actions.noTemplatesAvailable"),
        icon: MessageSquareIcon,
        stepType: null,
      },
    ]
  }

  return templates.map((template) => ({
    label: `${template.name} (${template.language})`,
    icon: MessageSquareIcon,
    stepType: stepTypes.enum.sendMessengerTemplateMessage,
    props: {
      template: {
        id: template.id,
        name: template.name,
        language: template.language,
        parameterFormat: template.parameterFormat,
        integrationMessengerId: template.integrationMessengerId,
        inboxId: template.integrationMessenger?.inboxId,
      },
    },
  }))
}
