// @vitest-environment node

import { afterEach, describe, expect, test, vi } from "vitest"

const BUILDER_URL = "https://app.example.com"
const BROKER_URL = "https://broker.example.com"

async function loadWith(envOverrides: Record<string, string | undefined>) {
  vi.resetModules()
  vi.doMock("@/env", () => ({
    env: {
      NEXT_PUBLIC_BUILDER_URL: BUILDER_URL,
      ...envOverrides,
    },
  }))
  return await import("@/lib/oauth-broker")
}

afterEach(() => {
  vi.resetModules()
  vi.doUnmock("@/env")
})

describe("getBrokerOrigin", () => {
  test("returns the dedicated broker origin when configured", async () => {
    const { getBrokerOrigin } = await loadWith({
      NEXT_PUBLIC_BROKER_URL: `${BROKER_URL}/some/path`,
    })

    expect(getBrokerOrigin()).toBe(BROKER_URL)
  })

  test("falls back to the builder URL for single-domain deploys", async () => {
    const { getBrokerOrigin } = await loadWith({
      NEXT_PUBLIC_BROKER_URL: undefined,
    })

    expect(getBrokerOrigin()).toBe(BUILDER_URL)
  })
})

describe("buildBrokerCallbackUrl", () => {
  test("builds an absolute URL on the broker host when configured", async () => {
    const { buildBrokerCallbackUrl } = await loadWith({
      NEXT_PUBLIC_BROKER_URL: BROKER_URL,
    })

    expect(buildBrokerCallbackUrl("/integrations/whatsapp/webhook")).toBe(
      `${BROKER_URL}/integrations/whatsapp/webhook`,
    )
  })

  test("builds on the builder host when no broker is configured", async () => {
    const { buildBrokerCallbackUrl } = await loadWith({
      NEXT_PUBLIC_BROKER_URL: undefined,
    })

    expect(buildBrokerCallbackUrl("/integrations/whatsapp/webhook")).toBe(
      `${BUILDER_URL}/integrations/whatsapp/webhook`,
    )
  })
})

describe("isBrokerHost", () => {
  test("matches the broker host and rejects a white-label custom domain", async () => {
    const { isBrokerHost } = await loadWith({
      NEXT_PUBLIC_BROKER_URL: BROKER_URL,
    })

    expect(isBrokerHost("broker.example.com")).toBe(true)
    expect(isBrokerHost("chat.reseller.com")).toBe(false)
  })
})
