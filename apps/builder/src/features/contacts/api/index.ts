import { contactsAuthenticatedAPI } from "./authenticated"
import workspaceTokenAuthAPIs from "./workspace-token"

export const contactsAPIs = {
  ...workspaceTokenAuthAPIs,
  ...contactsAuthenticatedAPI,
}
