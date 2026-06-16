const TRAILING_SLASH_PATTERN = /\/+$/
const API_SUFFIX_PATTERN = /\/api\/3\/?$/i
const LEADING_SLASH_PATTERN = /^\/+/

export const ACTIVE_CAMPAIGN_HTTP_TIMEOUT_MS = 15_000

export const normalizeActiveCampaignApiUrl = (apiUrl: string) =>
  apiUrl
    .trim()
    .replace(TRAILING_SLASH_PATTERN, "")
    .replace(API_SUFFIX_PATTERN, "")

export const activeCampaignPath = (path: string) =>
  `api/3/${path.replace(LEADING_SLASH_PATTERN, "")}`

export const activeCampaignAccountsPath = () => activeCampaignPath("accounts")
export const activeCampaignAutomationsPath = () =>
  activeCampaignPath("automations")
export const activeCampaignListsPath = () => activeCampaignPath("lists")
export const activeCampaignTagsPath = () => activeCampaignPath("tags")
export const activeCampaignFieldsPath = () => activeCampaignPath("fields")
export const activeCampaignContactSyncPath = () =>
  activeCampaignPath("contact/sync")
export const activeCampaignContactAutomationsPath = () =>
  activeCampaignPath("contactAutomations")
export const activeCampaignContactAutomationsForContactPath = (
  contactId: string,
) => activeCampaignPath(`contacts/${contactId}/contactAutomations`)
export const activeCampaignContactTagsPath = () =>
  activeCampaignPath("contactTags")
export const activeCampaignContactListsPath = () =>
  activeCampaignPath("contactLists")
