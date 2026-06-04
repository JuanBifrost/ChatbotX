import { emailTopicService } from "@chatbotx.io/business"
import { zodBigintAsString } from "@chatbotx.io/utils"
import z from "zod"
import { withWorkspaceIdSchema } from "@/features/workspaces/schema/resource"
import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import {
  createEmailTopicRequest,
  updateEmailTopicRequest,
} from "../schema/action"
import {
  listEmailTopicsRequest,
  listEmailTopicsResponse,
} from "../schema/query"

const privateListWorkspaceEmailTopicsAPI = authorizedAPI
  .route({
    method: "GET",
    path: "/workspaces/{workspaceId}/email-topics",
    summary: "List email topics",
    tags: ["EmailTopics"],
  })
  .input(listEmailTopicsRequest.and(withWorkspaceIdSchema))
  .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
  .output(listEmailTopicsResponse)
  .handler(async ({ input }) => await emailTopicService.list(input))

const privateCreateWorkspaceEmailTopicAPI = authorizedAPI
  .route({
    method: "POST",
    path: "/workspaces/{workspaceId}/email-topics",
    summary: "Create an email topic",
    tags: ["EmailTopics"],
  })
  .input(createEmailTopicRequest.and(withWorkspaceIdSchema))
  .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
  .output(z.object({ id: zodBigintAsString() }))
  .handler(async ({ input }) => {
    const { workspaceId, ...data } = input
    const topic = await emailTopicService.create({ workspaceId, data })
    return { id: topic.id }
  })

const privateUpdateEmailTopicAPI = authorizedAPI
  .route({
    method: "PUT",
    path: "/workspaces/{workspaceId}/email-topics/{id}",
    summary: "Update email topic",
    tags: ["EmailTopics"],
  })
  .input(
    updateEmailTopicRequest
      .and(withWorkspaceIdSchema)
      .and(z.object({ id: zodBigintAsString() })),
  )
  .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
  .handler(async ({ input }) => {
    const { workspaceId, id, ...data } = input
    return await emailTopicService.update({ workspaceId, id, data })
  })

const privateDeleteEmailTopicAPI = authorizedAPI
  .route({
    method: "DELETE",
    path: "/workspaces/{workspaceId}/email-topics/{id}",
    summary: "Delete email topic",
    tags: ["EmailTopics"],
  })
  .input(withWorkspaceIdSchema.and(z.object({ id: zodBigintAsString() })))
  .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
  .handler(async ({ input }) => {
    await emailTopicService.delete({
      workspaceId: input.workspaceId,
      ids: [input.id],
    })
  })

export const privateEmailTopicsAPI = {
  privateListWorkspaceEmailTopicsAPI,
  privateCreateWorkspaceEmailTopicAPI,
  privateUpdateEmailTopicAPI,
  privateDeleteEmailTopicAPI,
}
