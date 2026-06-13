import { describe, expect, test } from "vitest"
import { flowStepHandlers } from "../src/integration/handlers/step"

describe("MailerLite worker step registration", () => {
  test("dispatches the MailerLite subscriber step", () => {
    expect(flowStepHandlers.mailerLiteAddSubscriber).toBeTypeOf("function")
  })
})
