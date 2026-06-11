import { refLinkAuthenticatedAPI } from "./authenticated"
import refLinksWorkspaceTokenAPIs from "./workspace-token"

export const refLinksAPI = {
  ...refLinkAuthenticatedAPI,
  ...refLinksWorkspaceTokenAPIs,
}
