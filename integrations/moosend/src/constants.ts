export const MOOSEND_API_BASE_URL = "https://api.moosend.com/v3/" as const
export const MOOSEND_HTTP_TIMEOUT_MS = 15_000
export const MOOSEND_EDITOR_PAGE_SIZE = 20

export const moosendListsPagePath = (page: number, pageSize: number) =>
  `lists/${page}/${pageSize}.json`

export const moosendSubscribePath = (listId: string) =>
  `subscribers/${encodeURIComponent(listId)}/subscribe.json`
