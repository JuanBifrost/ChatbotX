import { rescue } from "../exception"
import { createTiktokClient } from "../lib/http-client"
import type { TiktokApiResponse, TiktokUserInfo } from "../schema"

export const getUserInfo = ({
  accessToken,
}: {
  accessToken: string
}): Promise<TiktokUserInfo> =>
  rescue("user/info", async () => {
    const client = createTiktokClient(accessToken)
    const response = await client.get<
      TiktokApiResponse<{ user: TiktokUserInfo }>
    >("user/info/", {
      searchParams: { fields: "open_id,display_name,avatar_url,username" },
    })
    return response.data.user
  })
