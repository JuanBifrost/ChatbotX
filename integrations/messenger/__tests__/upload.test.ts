import { HttpResponse, http, server } from "@chatbotx.io/vitest-config/msw"
import { beforeEach, describe, expect, test } from "vitest"
import { resumableUploadImage } from "../src/apis/upload"

const AUTH = {
  clientId: "app-123",
  tokens: { accessToken: "page-token" },
  metadata: {
    pageId: "page-123",
    version: "v23.0",
  },
} as never

function imageResponse() {
  return new HttpResponse(new Uint8Array([1, 2, 3]), {
    headers: { "content-type": "image/png" },
    status: 200,
  })
}

describe("resumableUploadImage", () => {
  let imageRequestHeaders: Headers | undefined

  beforeEach(() => {
    imageRequestHeaders = undefined
    server.use(
      http.get("https://graph.facebook.com/header.png", ({ request }) => {
        imageRequestHeaders = request.headers
        return imageResponse()
      }),
      http.get("https://storage.test/header.png", ({ request }) => {
        imageRequestHeaders = request.headers
        return imageResponse()
      }),
      http.post("https://graph.facebook.com/:version/:appId/uploads", () =>
        HttpResponse.json({ id: "upload-session" }),
      ),
      http.post("https://graph.facebook.com/:version/upload-session", () =>
        HttpResponse.json({ h: "header-handle" }),
      ),
    )
  })

  test("downloads template handles with bearer auth by default", async () => {
    await resumableUploadImage(AUTH, "https://graph.facebook.com/header.png")

    expect(imageRequestHeaders?.get("authorization")).toBe("Bearer page-token")
  })

  test("downloads public create-template images without bearer auth", async () => {
    await resumableUploadImage(AUTH, "https://storage.test/header.png", {
      authenticatedDownload: false,
    })

    expect(imageRequestHeaders?.get("authorization")).toBeNull()
  })
})
