"use client"

import { Handle, Position } from "@xyflow/react"
import { useTranslations } from "next-intl"

type StepState = { id: string; stateType: string }

type StepStateHandlesProps = {
  states?: StepState[]
}

export function StepStateHandles({ states }: StepStateHandlesProps) {
  const t = useTranslations()

  const successState = states?.find((s) => s.stateType === "success")
  const errorState = states?.find((s) => s.stateType === "error")
  const skipState = states?.find((s) => s.stateType === "skip")

  if (!(successState || errorState || skipState)) {
    return null
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {successState && (
        <div className="relative flex items-center gap-2 text-xs">
          {t("states.success")}
          <div className="h-4 w-4 rounded-full border-2 border-green-500">
            <Handle
              className="right-[8px]! h-4! w-4! opacity-0!"
              id={successState.id}
              position={Position.Right}
              type="source"
            />
          </div>
        </div>
      )}
      {errorState && (
        <div className="relative flex items-center gap-2 text-xs">
          {t("states.error")}
          <div className="h-4 w-4 rounded-full border-2 border-red-500">
            <Handle
              className="right-[8px]! h-4! w-4! opacity-0!"
              id={errorState.id}
              position={Position.Right}
              type="source"
            />
          </div>
        </div>
      )}
      {skipState && (
        <div className="relative flex items-center gap-2 text-xs">
          {t("states.skip")}
          <div className="h-4 w-4 rounded-full border-2 border-yellow-500">
            <Handle
              className="right-[8px]! h-4! w-4! opacity-0!"
              id={skipState.id}
              position={Position.Right}
              type="source"
            />
          </div>
        </div>
      )}
    </div>
  )
}
