import {
  type AIDeleteMessageHistorySchema,
  aiDeleteMessageHistoryDefaultFn,
  aiDeleteMessageHistorySchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import { AIDeleteMessageHistoryEditor } from "./editor"
import { AIDeleteMessageHistoryViewer } from "./viewer"

export const aiDeleteMessageHistoryStep: StepDefinition<AIDeleteMessageHistorySchema> =
  {
    editor: AIDeleteMessageHistoryEditor,
    viewer: AIDeleteMessageHistoryViewer,
    validator: aiDeleteMessageHistorySchema,
    defaultFn: aiDeleteMessageHistoryDefaultFn,
  }
