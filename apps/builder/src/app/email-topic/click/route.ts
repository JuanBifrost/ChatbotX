import { emailTopicAnalyticsService } from "@chatbotx.io/analytics"
import { verifyEmailClickToken } from "@chatbotx.io/business"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token = searchParams.get("r")
  const signedUrl = searchParams.get("u")

  if (token) {
    await emailTopicAnalyticsService.recordClick(token)
  }

  if (signedUrl) {
    try {
      const url = await verifyEmailClickToken(signedUrl)
      return NextResponse.redirect(url, { status: 302 })
    } catch {
      // Tampered, malformed, or expired token: never redirect to an
      // attacker-controlled target. Fall through to a safe same-origin redirect.
    }
  }

  return NextResponse.redirect(origin, { status: 302 })
}
