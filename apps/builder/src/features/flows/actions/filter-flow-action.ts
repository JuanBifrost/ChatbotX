import type { FlowNode, FlowWithVersions } from "../schemas/flow-node"

export function hasStartNode(nodes: FlowNode[], stepType: string): boolean {
  if (!Array.isArray(nodes)) {
    return false
  }

  return nodes
    .filter((node) => node?.data?.isStartNode === true)
    .some((node) =>
      node?.data?.details?.steps?.some((step) => step?.stepType === stepType),
    )
}

export function filterFlowsByStartStepType<T extends FlowWithVersions>(
  flows: T[],
  stepType: string,
): T[] {
  return flows.filter((flow) =>
    flow.flowVersions.some((version) => hasStartNode(version.nodes, stepType)),
  )
}

export function filterFlowsByTemplateIds<T extends FlowWithVersions>(
  flows: T[],
  templateIds: string[],
): T[] {
  if (!Array.isArray(flows) || templateIds.length === 0) {
    return []
  }

  return flows.filter((flow) =>
    flow.flowVersions.some((version) => {
      if (!Array.isArray(version.nodes)) {
        return false
      }

      return version.nodes.some((node) => {
        const steps = node?.data?.details?.steps
        if (!Array.isArray(steps)) {
          return false
        }

        return steps.some((step) => {
          if (step?.stepType !== "WA_TM01") {
            return false
          }

          const stepWithTemplate = step as unknown as {
            template?: { id?: string }
          }
          const templateId = stepWithTemplate?.template?.id
          return (
            typeof templateId === "string" && templateIds.includes(templateId)
          )
        })
      })
    }),
  )
}
