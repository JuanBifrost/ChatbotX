import {
  type MoosendCreateContactSchema,
  moosendCreateContactDefaultFn,
  moosendCreateContactSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import MoosendCreateContactEditor from "./editor"
import MoosendCreateContactViewer from "./viewer"

export const moosendCreateContactStep: StepDefinition<MoosendCreateContactSchema> =
  {
    editor: MoosendCreateContactEditor,
    viewer: MoosendCreateContactViewer,
    validator: moosendCreateContactSchema,
    defaultFn: moosendCreateContactDefaultFn,
  }
