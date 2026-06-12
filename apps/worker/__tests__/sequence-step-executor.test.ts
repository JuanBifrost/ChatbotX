import { beforeEach, describe, expect, test, vi } from "vitest"

// ---------- db spies ----------
const findFirstSpy = vi.fn()

vi.mock("@chatbotx.io/database/client", () => ({
  db: {
    query: {
      sequenceStepModel: {
        findFirst: (...args: unknown[]) => findFirstSpy(...args),
      },
    },
  },
}))

import type { StepWithFlow } from "../src/sequence-scheduler/services/step-executor.service"
import { StepExecutorService } from "../src/sequence-scheduler/services/step-executor.service"

// ---------- fixtures ----------

function makeStep(overrides: Partial<StepWithFlow> = {}): StepWithFlow {
  return {
    id: "step-1",
    order: 1,
    isActive: true,
    flow: { id: "flow-1" },
    ...overrides,
  } as unknown as StepWithFlow
}

beforeEach(() => {
  findFirstSpy.mockResolvedValue(undefined)
})

// ---------- tests ----------

describe("StepExecutorService", () => {
  describe("fetchStep", () => {
    test("returns the step when db finds a record", async () => {
      // Arrange
      const step = makeStep()
      findFirstSpy.mockResolvedValue(step)

      // Act
      const result = await new StepExecutorService().fetchStep("step-1")

      // Assert
      expect(result).toEqual(step)
    })

    test("returns undefined when db returns undefined (not found)", async () => {
      // Arrange
      findFirstSpy.mockResolvedValue(undefined)

      // Act
      const result = await new StepExecutorService().fetchStep("missing")

      // Assert
      expect(result).toBeUndefined()
    })

    test("queries by id with flow relation included", async () => {
      // Arrange
      findFirstSpy.mockResolvedValue(makeStep())

      // Act
      await new StepExecutorService().fetchStep("step-99")

      // Assert
      expect(findFirstSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: "step-99" }),
          with: { flow: true },
        }),
      )
    })
  })

  describe("validateStep", () => {
    test("returns invalid with step_not_found reason when step is undefined", () => {
      // Arrange + Act
      const result = new StepExecutorService().validateStep(undefined)

      // Assert
      expect(result).toEqual({ valid: false, reason: "step_not_found" })
    })

    test("returns invalid with step_inactive reason when step.isActive is false", () => {
      // Arrange
      const step = makeStep({ isActive: false })

      // Act
      const result = new StepExecutorService().validateStep(step)

      // Assert
      expect(result).toEqual({ valid: false, reason: "step_inactive" })
    })

    test("returns invalid with flow_not_configured reason when step.flow is null", () => {
      // Arrange
      const step = makeStep({ flow: null as unknown as StepWithFlow["flow"] })

      // Act
      const result = new StepExecutorService().validateStep(step)

      // Assert
      expect(result).toEqual({ valid: false, reason: "flow_not_configured" })
    })

    test("returns valid with the step when all checks pass", () => {
      // Arrange
      const step = makeStep()

      // Act
      const result = new StepExecutorService().validateStep(step)

      // Assert
      expect(result).toEqual({ valid: true, step })
    })

    test("checks isActive before flow — inactive step with no flow yields step_inactive", () => {
      // Arrange — both isActive=false and flow=null; inactive should win
      const step = makeStep({
        isActive: false,
        flow: null as unknown as StepWithFlow["flow"],
      })

      // Act
      const result = new StepExecutorService().validateStep(step)

      // Assert
      expect(result).toEqual({ valid: false, reason: "step_inactive" })
    })
  })
})
