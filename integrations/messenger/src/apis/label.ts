import type { Context } from "@chatbotx.io/sdk"
import { DEFAULT_API_VERSION } from "../constants"
import { rescue } from "../exception"
import { facebookGraphClient } from "../lib/http-client"
import type { MessengerAuthValue } from "../schema"

export interface MessengerLabel {
  id: string
  page_label_name: string
}

export const createCustomLabel = (props: {
  ctx: Context<MessengerAuthValue>
  pageId: string
  name: string
}): Promise<{ id: string }> => {
  const { ctx, pageId, name } = props
  const { version = DEFAULT_API_VERSION } = ctx.auth
  const endpoint = `${version}/${pageId}/custom_labels?page_label_name=${encodeURIComponent(name)}`

  return rescue(endpoint, async () => {
    const response: { id: string } = await facebookGraphClient.post(endpoint, {
      headers: {
        Authorization: `Bearer ${ctx.auth.tokens.accessToken}`,
      },
    })
    return { id: response.id }
  })
}

export const deleteCustomLabel = (props: {
  ctx: Context<MessengerAuthValue>
  labelId: string
}): Promise<{ success: boolean }> => {
  const { ctx, labelId } = props
  const { version = DEFAULT_API_VERSION } = ctx.auth
  const endpoint = `${version}/${labelId}`

  return rescue(endpoint, async () => {
    const response: { success: boolean } = await facebookGraphClient.delete(
      endpoint,
      {
        headers: {
          Authorization: `Bearer ${ctx.auth.tokens.accessToken}`,
        },
      },
    )
    return { success: response.success ?? true }
  })
}

export const assignLabelToUser = (props: {
  ctx: Context<MessengerAuthValue>
  labelId: string
  psid: string
}): Promise<{ success: boolean }> => {
  const { ctx, labelId, psid } = props
  const { version = DEFAULT_API_VERSION } = ctx.auth
  const endpoint = `${version}/${labelId}/label?user=${encodeURIComponent(psid)}`

  return rescue(endpoint, async () => {
    const response: { success: boolean } = await facebookGraphClient.post(
      endpoint,
      {
        headers: {
          Authorization: `Bearer ${ctx.auth.tokens.accessToken}`,
        },
      },
    )
    return { success: response.success ?? true }
  })
}

export const removeLabelFromUser = (props: {
  ctx: Context<MessengerAuthValue>
  labelId: string
  psid: string
}): Promise<{ success: boolean }> => {
  const { ctx, labelId, psid } = props
  const { version = DEFAULT_API_VERSION } = ctx.auth
  const endpoint = `${version}/${labelId}/label`

  return rescue(endpoint, async () => {
    const response: { success: boolean } = await facebookGraphClient.delete(
      endpoint,
      {
        headers: {
          Authorization: `Bearer ${ctx.auth.tokens.accessToken}`,
        },
        searchParams: {
          user: psid,
        },
      },
    )
    return { success: response.success ?? true }
  })
}

export const getUserLabels = (props: {
  ctx: Context<MessengerAuthValue>
  psid: string
}): Promise<MessengerLabel[]> => {
  const { ctx, psid } = props
  const { version = DEFAULT_API_VERSION } = ctx.auth
  const endpoint = `${version}/${psid}/custom_labels`

  return rescue(endpoint, async () => {
    const response: { data: MessengerLabel[] } = await facebookGraphClient.get(
      endpoint,
      {
        headers: {
          Authorization: `Bearer ${ctx.auth.tokens.accessToken}`,
        },
        searchParams: {
          fields: "page_label_name",
        },
      },
    )
    return response.data ?? []
  })
}
