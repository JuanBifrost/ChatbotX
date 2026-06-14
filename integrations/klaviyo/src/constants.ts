export const KLAVIYO_API_BASE_URL = "https://a.klaviyo.com/api/" as const
export const KLAVIYO_API_REVISION = "2026-04-15"
export const KLAVIYO_HTTP_TIMEOUT_MS = 15_000
export const KLAVIYO_LIST_PAGE_SIZE = 10

export const KLAVIYO_LISTS_PATH = "lists"
export const KLAVIYO_PROFILE_IMPORT_PATH = "profile-import"

export const klaviyoListProfilesPath = (listId: string) =>
  `lists/${encodeURIComponent(listId)}/relationships/profiles`
