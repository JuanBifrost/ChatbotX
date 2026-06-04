import {
  type SendMessengerTemplateMessageStepSchema,
  sendMessengerTemplateMessageStepDefaultFn,
  sendMessengerTemplateMessageStepSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import SendMessengerTemplateMessageStepEditor from "./editor"
import { SendMessengerTemplateMessageStepViewer } from "./viewer"

const sendMessengerTemplateMessageStep: StepDefinition<SendMessengerTemplateMessageStepSchema> =
  {
    editor: SendMessengerTemplateMessageStepEditor,
    viewer: SendMessengerTemplateMessageStepViewer,
    validator: sendMessengerTemplateMessageStepSchema,
    defaultFn: sendMessengerTemplateMessageStepDefaultFn,
  }

export default sendMessengerTemplateMessageStep
