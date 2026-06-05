import { getUserInstagramAccounts } from "@chatbotx.io/integration-instagram"
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

  const accounts = await getUserInstagramAccounts(auth.userToken, auth.version)

  return <SelectAccount accounts={accounts} workspaceId={auth.workspaceId} />
}
