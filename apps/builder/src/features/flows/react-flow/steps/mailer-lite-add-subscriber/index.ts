import {
  type MailerLiteAddSubscriberSchema,
  mailerLiteAddSubscriberDefaultFn,
  mailerLiteAddSubscriberSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import MailerLiteAddSubscriberEditor from "./editor"
import MailerLiteAddSubscriberViewer from "./viewer"

export const mailerLiteAddSubscriberStep: StepDefinition<MailerLiteAddSubscriberSchema> =
  {
    editor: MailerLiteAddSubscriberEditor,
    viewer: MailerLiteAddSubscriberViewer,
    validator: mailerLiteAddSubscriberSchema,
    defaultFn: mailerLiteAddSubscriberDefaultFn,
  }
