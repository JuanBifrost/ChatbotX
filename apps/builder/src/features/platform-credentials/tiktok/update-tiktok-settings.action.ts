"use server"

import { platformCredentialService } from "@chatbotx.io/business"
import {
  type TiktokCredential,
  type TiktokCredentialUpdate,
  tiktokCredentialUpdateSchema,
} from "@chatbotx.io/database/partials"
import type { UserModel } from "@chatbotx.io/database/types"
import { getTranslations } from "next-intl/server"
import { isCloud } from "@/env"
import { authActionClient } from "@/lib/safe-action"

export const updateTiktokSettingAction = authActionClient
  .inputSchema(tiktokCredentialUpdateSchema)
  .action(
    async ({
      ctx,
      parsedInput,
    }: {
      ctx: { user: UserModel }
      parsedInput: TiktokCredentialUpdate
    }) => {
      const scopedUserId = isCloud() ? ctx.user.id : undefined
      const existing = await platformCredentialService.findDecrypted({
        userId: scopedUserId,
        type: "tiktok",
      })

      const t = await getTranslations()

      const clientSecret =
        parsedInput.clientSecret || existing?.config.clientSecret
      if (!clientSecret) {
        throw new Error(t("platformSettings.errors.tiktokAppSecretRequired"))
      }

      const config: TiktokCredential = {
        clientId: parsedInput.clientId,
        clientSecret,
      }

      await platformCredentialService.upsert({
        userId: scopedUserId,
        type: "tiktok",
        config,
      })
    },
  )
