import {
  type ActiveCampaignSyncContactSchema,
  activeCampaignSyncContactDefaultFn,
  activeCampaignSyncContactSchema,
} from "@chatbotx.io/flow-config"
import type { StepDefinition } from "../definition"
import ActiveCampaignSyncContactEditor from "./editor"
import ActiveCampaignSyncContactViewer from "./viewer"

export const activeCampaignSyncContactStep: StepDefinition<ActiveCampaignSyncContactSchema> =
  {
    editor: ActiveCampaignSyncContactEditor,
    viewer: ActiveCampaignSyncContactViewer,
    validator: activeCampaignSyncContactSchema,
    defaultFn: activeCampaignSyncContactDefaultFn,
  }
