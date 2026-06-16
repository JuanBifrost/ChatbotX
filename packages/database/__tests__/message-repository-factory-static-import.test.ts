import { expect, test } from "vitest"
import { createMessageRepository } from "../src/repositories/message/message-repository.factory"

test("message repository factory loads with the static sharding module", () => {
  expect(createMessageRepository).toBeTypeOf("function")
})
