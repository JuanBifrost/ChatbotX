import {
  type SendGridAddContactSchema,
  sendGridAddContactDefaultFn,
  sendGridAddContactSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import SendGridAddContactEditor from "./editor"
import SendGridAddContactViewer from "./viewer"

export const sendGridAddContactStep: StepDefinition<SendGridAddContactSchema> =
  {
    editor: SendGridAddContactEditor,
    viewer: SendGridAddContactViewer,
    validator: sendGridAddContactSchema,
    defaultFn: sendGridAddContactDefaultFn,
  }
