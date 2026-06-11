import {
  listFlowNodeContactsResponse,
  magicLinkContactStatsSchema,
  magicLinkStatsSchema,
  refLinkAnalyticsService,
  refLinkTimeseriesRow,
} from "@chatbotx.io/analytics"
import { os } from "@orpc/server"
import { z } from "zod"
import { logger } from "../lib/log"

export const analyticsReflinkRoutes = os.router({
  refLinkStats: os
    .route({
      method: "GET",
      path: "/analytics/ref-links-stats",
      summary: "Get ref link stats",
      tags: ["Analytics"],
    })
    .input(magicLinkStatsSchema)
    .output(z.object({ data: z.array(refLinkTimeseriesRow) }))
    .handler(async ({ input }) => {
      try {
        const data =
          await refLinkAnalyticsService.getRefLinkStatsByDateRange(input)
        return { data }
      } catch (error) {
        logger.error({ err: error }, "[analytics:refLinkStats] failed")
        throw error
      }
    }),
  refLinkContacts: os
    .route({
      method: "GET",
      path: "/analytics/ref-links-contacts",
      summary: "Get ref link contacts",
      tags: ["Analytics"],
    })
    .input(magicLinkContactStatsSchema)
    .output(listFlowNodeContactsResponse)
    .handler(async ({ input }) => {
      try {
        return await refLinkAnalyticsService.getRefLinkContactStats(input)
      } catch (error) {
        logger.error({ err: error }, "[analytics:refLinkContacts] failed")
        throw error
      }
    }),
})
