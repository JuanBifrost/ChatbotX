import { getInstagramAccount } from "@chatbotx.io/integration-instagram"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SelectAccount } from "@/features/integration-instagram/components/select-accounts"
import type { FacebookAuthCallback } from "@/lib/facebook-pending-auth"
import {
  decryptAuth,
  FB_INSTAGRAM_PENDING_AUTH_COOKIE,
} from "@/lib/facebook-pending-auth"

export const dynamic = "force-dynamic"

export default async function InstagramSelectPage() {
  const token = (await cookies()).get(FB_INSTAGRAM_PENDING_AUTH_COOKIE)?.value

  const auth = token ? await decryptAuth<FacebookAuthCallback>(token) : null

  if (!auth) {
    redirect("/channels/create")
  }

  const account = await getInstagramAccount(auth.userToken)

  if (!account) {
    redirect("/channels/create")
  }

  return <SelectAccount account={account} workspaceId={auth.workspaceId} />
}
