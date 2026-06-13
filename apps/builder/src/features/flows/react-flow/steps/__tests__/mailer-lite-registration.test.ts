import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

describe("MailerLite flow step registration", () => {
  test("registers the MailerLite subscriber action", () => {
    const source = readFileSync(
      "src/features/flows/react-flow/steps/index.tsx",
      "utf8",
    )
    expect(source).toContain(
      'import { mailerLiteAddSubscriberStep } from "./mailer-lite-add-subscriber"',
    )
    expect(source).toContain(
      "[stepTypes.enum.mailerLiteAddSubscriber]: mailerLiteAddSubscriberStep",
    )
  })
})
