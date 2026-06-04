import { db } from "@chatbotx.io/database/client"
import type { IntegrationTiktokModel } from "@chatbotx.io/database/types"
import { assertCurrentUserCanAccessChatbot } from "@/lib/auth/utils"

export const listIntegrationTiktoks = async ({
  where,
}: {
  where: Partial<Pick<IntegrationTiktokModel, "workspaceId">>
}): Promise<{ data: IntegrationTiktokModel[] }> => {
  const data = await db.query.integrationTiktokModel.findMany({
    where,
    orderBy: {
      createdAt: "asc",
    },
  })
  return { data }
}

export const findIntegrationTiktok = async ({
  workspaceId,
}: {
  workspaceId: string
}): Promise<IntegrationTiktokModel | null> => {
  await assertCurrentUserCanAccessChatbot(workspaceId)

  return (
    (await db.query.integrationTiktokModel.findFirst({
      where: { workspaceId },
    })) ?? null
  )
}

export const findIntegrationTiktokByOpenId = async ({
  openId,
}: {
  openId: string
}): Promise<IntegrationTiktokModel | null> =>
  (await db.query.integrationTiktokModel.findFirst({
    where: { openId },
  })) ?? null
