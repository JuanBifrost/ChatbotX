import z from "zod"

export const flowNodeStepSchema = z.object({
  stepType: z.string().optional(),
})

export const flowNodeDetailsSchema = z.object({
  steps: z.array(flowNodeStepSchema).optional(),
})

export const flowNodeDataSchema = z.object({
  isStartNode: z.boolean().optional(),
  details: flowNodeDetailsSchema.optional(),
})

export const flowNodeSchema = z.object({
  data: flowNodeDataSchema.optional(),
})

export type FlowNodeStep = z.infer<typeof flowNodeStepSchema>
export type FlowNodeDetails = z.infer<typeof flowNodeDetailsSchema>
export type FlowNodeData = z.infer<typeof flowNodeDataSchema>
export type FlowNode = z.infer<typeof flowNodeSchema>

export const flowVersionWithNodesSchema = z.object({
  nodes: z.array(flowNodeSchema),
})

export const flowWithVersionsSchema = z.object({
  flowVersions: z.array(flowVersionWithNodesSchema),
})

export type FlowVersionWithNodes = z.infer<typeof flowVersionWithNodesSchema>
export type FlowWithVersions = z.infer<typeof flowWithVersionsSchema>
