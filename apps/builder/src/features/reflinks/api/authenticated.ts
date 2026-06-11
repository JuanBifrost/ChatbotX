import { workspaceAuthorizedMidddleware } from "@/middlewares/auth"
import { authorizedAPI } from "@/orpc"
import { findReflink } from "../queries"
import { getReflinkRequest } from "../schemas/query"
import { reflinkResponse } from "../schemas/resource"

export const refLinkAuthenticatedAPI = {
  getRefLinksAuthenticatedAPI: authorizedAPI
    .route({
      method: "GET",
      path: "/workspaces/{workspaceId}/ref-links/{id}",
      summary: "Get a specific ref link",
      tags: ["Ref Links"],
    })
    .input(getReflinkRequest)
    .use(workspaceAuthorizedMidddleware, (input) => input.workspaceId)
    .output(reflinkResponse)
    .handler(
      async ({ input }) =>
        await findReflink({
          workspaceId: input.workspaceId,
          id: input.id,
        }),
    ),
}
