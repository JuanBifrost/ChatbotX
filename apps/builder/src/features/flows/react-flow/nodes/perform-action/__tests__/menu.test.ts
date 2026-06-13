import { stepTypes } from "@chatbotx.io/flow-config"
import { describe, expect, test } from "vitest"
import type { TranslationFn } from "../../types"
import { performActionMenus } from "../menu"

describe("perform action MailerLite menu", () => {
  test("includes the MailerLite subscriber action", () => {
    const t = ((key: string) => key) as TranslationFn
    const items = performActionMenus(t).flatMap((item) => item.children ?? [])
    expect(
      items.some(
        (item) => item.stepType === stepTypes.enum.mailerLiteAddSubscriber,
      ),
    ).toBe(true)
  })
})
