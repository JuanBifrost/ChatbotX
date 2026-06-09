import { aiAgentsAuthenticatedAPI } from "./authenticated"
import aiAgentsWorkspaceTokenAPIs from "./workspace-token"

export const aiAgentsAPI = {
  ...aiAgentsAuthenticatedAPI,
  ...aiAgentsWorkspaceTokenAPIs,
}
