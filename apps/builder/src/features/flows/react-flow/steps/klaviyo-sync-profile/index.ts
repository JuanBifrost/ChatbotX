import {
  type KlaviyoSyncProfileSchema,
  klaviyoSyncProfileDefaultFn,
  klaviyoSyncProfileSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import KlaviyoSyncProfileEditor from "./editor"
import KlaviyoSyncProfileViewer from "./viewer"

export const klaviyoSyncProfileStep: StepDefinition<KlaviyoSyncProfileSchema> =
  {
    editor: KlaviyoSyncProfileEditor,
    viewer: KlaviyoSyncProfileViewer,
    validator: klaviyoSyncProfileSchema,
    defaultFn: klaviyoSyncProfileDefaultFn,
  }
