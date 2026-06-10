import {
  type MailchimpAddMemberSchema,
  mailchimpAddMemberDefaultFn,
  mailchimpAddMemberSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import MailchimpAddMemberEditor from "./editor"
import MailchimpAddMemberViewer from "./viewer"

export const mailchimpAddMemberStep: StepDefinition<MailchimpAddMemberSchema> =
  {
    editor: MailchimpAddMemberEditor,
    viewer: MailchimpAddMemberViewer,
    validator: mailchimpAddMemberSchema,
    defaultFn: mailchimpAddMemberDefaultFn,
  }
