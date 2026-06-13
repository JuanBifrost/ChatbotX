import {
  type DripSubscribeSubscriberSchema,
  dripSubscribeSubscriberDefaultFn,
  dripSubscribeSubscriberSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import DripSubscribeSubscriberEditor from "./editor"
import DripSubscribeSubscriberViewer from "./viewer"

export const dripSubscribeSubscriberStep: StepDefinition<DripSubscribeSubscriberSchema> =
  {
    editor: DripSubscribeSubscriberEditor,
    viewer: DripSubscribeSubscriberViewer,
    validator: dripSubscribeSubscriberSchema,
    defaultFn: dripSubscribeSubscriberDefaultFn,
  }
