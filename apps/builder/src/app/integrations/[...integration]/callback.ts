import {
  platformCredentialService,
  workspaceService,
} from "@chatbotx.io/business"
import { db } from "@chatbotx.io/database/client"
import type { IntegrationType } from "@chatbotx.io/database/partials"
import {
  integrationGoogleSheetsModel,
  integrationModel,
} from "@chatbotx.io/database/schema"
import { exchangeCodeForToken as exchangeInstagramCode } from "@chatbotx.io/integration-instagram"
import { exchangeCodeForToken as exchangeMessengerCode } from "@chatbotx.io/integration-messenger"
import type { AuthValue, Oauth2AuthValue } from "@chatbotx.io/sdk"
import {
  createId,
  getPublicUrlFromRequest,
  zodBigintAsString,
} from "@chatbotx.io/utils"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { env } from "@/env"
import { connectTiktokHandler } from "@/features/integration-tiktok/actions/connect.action"
import { connectZaloHandler } from "@/features/integration-zalo/actions/connect-zalo.action"
import { integrations } from "@/integration"
import { getCurrentUserId } from "@/lib/auth/utils"
import {
  encryptAuth,
  FB_INSTAGRAM_PENDING_AUTH_COOKIE,
  FB_MESSENGER_PENDING_AUTH_COOKIE,
  FB_PENDING_AUTH_MAX_AGE,
} from "@/lib/facebook-pending-auth"
import { logger } from "@/lib/log"

const FALLBACK_REDIRECT = "/manage"

const stateValidationSchema = z.object({
  workspaceId: zodBigintAsString().optional(),
  referer: z.url(),
})

function sanitizeReferer(referer: string): string {
  try {
    const refererOrigin = new URL(referer).origin
    const builderOrigin = new URL(env.NEXT_PUBLIC_BUILDER_URL).origin
    return refererOrigin === builderOrigin ? referer : FALLBACK_REDIRECT
  } catch {
    return FALLBACK_REDIRECT
  }
}

export const handleCallback = async (
  integrationType: IntegrationType,
  req: NextRequest,
) => {
  if (!(integrationType in integrations)) {
    return notFound()
  }

  // Parse state params to get workspace info
  const url = new URL(getPublicUrlFromRequest(req))
  let rawState: unknown
  try {
    rawState = JSON.parse(
      atob(decodeURIComponent(url.searchParams.get("state") || "")),
    )
  } catch {
    logger.debug(
      { url: url.toString() },
      "state param is not valid base64/JSON",
    )
    return notFound()
  }
  const { data: stateParams } = stateValidationSchema.safeParse(rawState)
  if (!stateParams) {
    logger.debug({ url: url.toString() }, "state is not valid")
    return notFound()
  }

  // Facebook returns ?error=access_denied when the user cancels
  if (url.searchParams.get("error")) {
    return redirect(sanitizeReferer(stateParams.referer))
  }

  const userId = await getCurrentUserId()
  if (!userId) {
    return notFound()
  }

  const workspace = stateParams.workspaceId
    ? await workspaceService.findById({ id: stateParams.workspaceId })
    : await workspaceService.create({
        data: {
          name: "New Workspace",
          ownerId: userId,
        },
        createdBy: userId,
      })

  if (stateParams.workspaceId && workspace.ownerId !== userId) {
    logger.warn(
      { userId, workspaceId: stateParams.workspaceId },
      "workspace ownership mismatch in OAuth callback",
    )
    return notFound()
  }

  const safeReferer = sanitizeReferer(stateParams.referer)
  const code = url.searchParams.get("code") ?? ""

  let authResult: AuthValue
  let googleSheetsAuth: Oauth2AuthValue | null = null
  switch (integrationType) {
    case "messenger": {
      const messengerCredential =
        await platformCredentialService.resolveForOwner({
          ownerId: workspace.ownerId,
          type: "messenger",
        })
      if (!messengerCredential) {
        return notFound()
      }

      const callbackUrl = new URL(
        "/integrations/messenger/callback",
        safeReferer,
      ).toString()

      const userToken = await exchangeMessengerCode(
        messengerCredential.config,
        code,
        callbackUrl,
      )
      const token = await encryptAuth({
        userToken,
        workspaceId: workspace.id,
        referer: safeReferer,
        version: messengerCredential.config.version,
        expiresAt: Date.now() + FB_PENDING_AUTH_MAX_AGE * 1000,
      })
      const cookieStore = await cookies()
      cookieStore.set(FB_MESSENGER_PENDING_AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: FB_PENDING_AUTH_MAX_AGE,
        path: "/channels/messenger/select",
      })
      return redirect(
        new URL("/channels/messenger/select", safeReferer).toString(),
      )
    }

    case "instagram": {
      const instagramCredential =
        await platformCredentialService.resolveForOwner({
          ownerId: workspace.ownerId,
          type: "instagram",
        })
      if (!instagramCredential) {
        return notFound()
      }

      const callbackUrl = new URL(
        "/integrations/instagram/callback",
        safeReferer,
      ).toString()

      const { accessToken: userToken } = await exchangeInstagramCode(
        instagramCredential.config,
        code,
        callbackUrl,
      )
      const token = await encryptAuth({
        userToken,
        workspaceId: workspace.id,
        referer: safeReferer,
        version: instagramCredential.config.version,
        expiresAt: Date.now() + FB_PENDING_AUTH_MAX_AGE * 1000,
      })
      const cookieStore = await cookies()
      cookieStore.set(FB_INSTAGRAM_PENDING_AUTH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: FB_PENDING_AUTH_MAX_AGE,
        path: "/channels/instagram/select",
      })
      return redirect(
        new URL("/channels/instagram/select", safeReferer).toString(),
      )
    }

    case "tiktok": {
      const tiktokCredential = await platformCredentialService.resolveForOwner({
        ownerId: workspace.ownerId,
        type: "tiktok",
      })
      if (!tiktokCredential) {
        return notFound()
      }

      const tiktokCallbackUrl = new URL(
        "/integrations/tiktok/callback",
        url,
      ).toString()

      await connectTiktokHandler({
        tiktokSettings: tiktokCredential.config,
        workspaceId: workspace.id,
        req,
        redirectUrl: tiktokCallbackUrl,
      })

      return redirect(safeReferer)
    }

    case "zalo": {
      const zaloCredential = await platformCredentialService.resolveForOwner({
        ownerId: workspace.ownerId,
        type: "zalo",
      })
      if (!zaloCredential) {
        return notFound()
      }

      await connectZaloHandler({
        zaloSettings: zaloCredential.config,
        workspaceId: workspace.id,
        req,
      })

      return redirect(safeReferer)
    }

    case "googleSheets": {
      const googleCredential = await platformCredentialService.resolveForOwner({
        ownerId: workspace.ownerId,
        type: "google",
      })
      if (!googleCredential) {
        return notFound()
      }

      const callbackUrl = new URL(
        "/integrations/google-sheets/callback",
        url,
      ).toString()
      logger.debug({ callbackUrl }, "debug google sheets callback request")

      authResult = (await integrations.googleSheets.handleRequest?.({
        config: {
          ...googleCredential.config,
          redirectUrl: callbackUrl,
        },
        req,
      })) as unknown as Oauth2AuthValue
      googleSheetsAuth = authResult
      break
    }

    default:
      return notFound()
  }

  if (!authResult) {
    return notFound()
  }

  await db.transaction(async (tx) => {
    const integrationId = createId()

    await tx.insert(integrationModel).values({
      id: integrationId,
      workspaceId: workspace.id,
      integrationType,
    })

    if (integrationType === "googleSheets" && googleSheetsAuth) {
      await tx.insert(integrationGoogleSheetsModel).values({
        workspaceId: workspace.id,
        integrationId,
        auth: googleSheetsAuth,
      })
    }
  })

  return redirect(stateParams.referer)
}
