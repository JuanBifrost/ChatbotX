import { integrationWhatsappCoexistAPIs } from "./coexist"
import { integrationWhatsappInternalAPIs } from "./private"

export const integrationWhatsappAPIs = {
  ...integrationWhatsappInternalAPIs,
  ...integrationWhatsappCoexistAPIs,
}
