import { DEFAULT_API_VERSION } from "../constants"
import { rescue } from "../exception"
import { facebookGraphClient } from "../lib/http-client"
import type { FacebookPage } from "../schema"

const FACEBOOK_OAUTH_BASE = "https://www.facebook.com"

const MESSENGER_SCOPES = [
  "email",
  "public_profile",
  "pages_manage_ads",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_read_user_content",
  "pages_manage_posts",
  "pages_manage_engagement",
  "pages_messaging",
  "pages_show_list",
  "business_management",
  "pages_utility_messaging",
]

export function generateAuthUrl({
  clientId,
  version = DEFAULT_API_VERSION,
  redirectUrl,
  stateParams,
}: {
  clientId: string
  version?: string
  redirectUrl: string
  stateParams?: Record<string, unknown>
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUrl,
    scope: MESSENGER_SCOPES.join(","),
    response_type: "code",
    state: Buffer.from(JSON.stringify(stateParams ?? {})).toString("base64"),
  })
  return `${FACEBOOK_OAUTH_BASE}/${version}/dialog/oauth?${params.toString()}`
}

export function exchangeCodeForToken(
  settings: { clientId: string; clientSecret: string; version?: string },
  code: string,
  redirectUrl: string,
): Promise<string> {
  const { version = DEFAULT_API_VERSION } = settings
  const endpoint = `${version}/oauth/access_token`

  return rescue(endpoint, async () => {
    const res: { access_token: string } = await facebookGraphClient.get(
      endpoint,
      {
        searchParams: {
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          redirect_uri: redirectUrl,
          code,
        },
      },
    )
    return res.access_token
  })
}

export function getUserPages(
  userAccessToken: string,
  version: string = DEFAULT_API_VERSION,
): Promise<FacebookPage[]> {
  const endpoint = `${version}/me/accounts`

  return rescue(endpoint, async () => {
    const res: { data: FacebookPage[] } = await facebookGraphClient.get(
      endpoint,
      {
        searchParams: {
          fields: "id,name,access_token,category,tasks",
          access_token: userAccessToken,
        },
      },
    )
    return res.data
  })
}
