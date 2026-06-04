import type { EmailTopicModel } from "@chatbotx.io/database/types"
import { getSortingStateParser } from "@chatbotx.io/ui/lib/parsers"
import { zodBigintAsString } from "@chatbotx.io/utils"
import {
  createSearchParamsCache,
  parseAsInteger,
  parseAsString,
} from "nuqs/server"
import z from "zod"
import { parseAsBigInt } from "@/lib/nuqs"
import { basePaginationRequest } from "@/lib/pagination"
import { emailTopicResource } from "./resource"

export const listEmailTopicsSearchParams = {
  page: parseAsInteger,
  perPage: parseAsInteger,
  name: parseAsString,
  sort: getSortingStateParser<EmailTopicModel>().withDefault([
    { id: "createdAt", desc: true },
  ]),
  folderId: parseAsBigInt,
}
export const listEmailTopicsSearchParamsCache = createSearchParamsCache(
  listEmailTopicsSearchParams,
)

export const listEmailTopicsRequest = basePaginationRequest.and(
  z.object({
    name: z.string().nullish(),
    folderId: zodBigintAsString().nullish(),
    workspaceId: zodBigintAsString(),
  }),
)
export type ListEmailTopicsRequest = z.infer<typeof listEmailTopicsRequest>

export const listEmailTopicsResponse = z.object({
  data: z.array(emailTopicResource),
  pageCount: z.number().int(),
})
export type ListEmailTopicsResponse = z.infer<typeof listEmailTopicsResponse>
