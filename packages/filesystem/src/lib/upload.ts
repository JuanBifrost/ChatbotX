import type { ObjectCannedACL } from "@aws-sdk/client-s3"
import { createId } from "@chatbotx.io/utils"
import { getImageDimensions, pathJoin } from "./helper"
import { DEFAULT_MIME_TYPE, type UploadedFile } from "./schema"
import { uploader } from "./uploader"

export async function uploadFile(
  file: File,
  path: string,
  acl = "public-read",
): Promise<UploadedFile> {
  const buffer = (await file.arrayBuffer()) as unknown as Buffer
  await uploader.putObject(path, buffer, {
    ACL: acl as ObjectCannedACL,
    ContentLength: file.size,
    ContentType: file.type,
  })

  const imageDimensions = await getImageDimensions(file.type, buffer)

  return {
    name: file.name,
    originPath: path,
    size: file.size,
    ...imageDimensions,
  }
}

export async function uploadMultipleFiles(
  files: File[],
  prefix: string,
  acl = "public-read",
): Promise<UploadedFile[]> {
  return await Promise.all(
    files.map((file) => uploadFile(file, pathJoin(prefix, createId()), acl)),
  )
}

export async function uploadFileFromUrl(
  url: string,
  path: string,
  acl = "public-read",
): Promise<UploadedFile> {
  const response = await fetch(url, { redirect: "follow" as const })
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`)
  }

  const mimeType = (response.headers.get("content-type") || DEFAULT_MIME_TYPE)
    .split(";")[0]
    .trim()
  const headerLength = Number.parseInt(
    response.headers.get("content-length") ?? "0",
    10,
  )

  let name = createId()
  try {
    const u = new URL(url)
    const last = u.pathname.split("/").pop() ?? ""
    if (last) {
      name = decodeURIComponent(last)
    }
  } catch (error) {
    console.error("uploadFileFromUrl: invalid URL", error)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const size = headerLength || buffer.byteLength

  await uploader.putObject(path, buffer, {
    ACL: acl as ObjectCannedACL,
    ContentType: mimeType,
    ContentLength: size,
  })

  const imageDimensions = await getImageDimensions(mimeType, buffer)

  return {
    name,
    originPath: path,
    size,
    ...imageDimensions,
  }
}
