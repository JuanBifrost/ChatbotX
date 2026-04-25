import ky from "ky"

export async function verifyOpenAIApiKey(apiKey: string) {
  try {
    await ky.get("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    return true
  } catch {
    return false
  }
}
