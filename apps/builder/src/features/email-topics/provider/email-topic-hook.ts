import { useMemo } from "react"
import { useEmailTopicStore } from "./email-topic-store-context"

export const useEmailTopicSelectOptions = (): {
  label: string
  value: string
}[] => {
  const emailTopics = useEmailTopicStore((state) => state.emailTopics)

  return useMemo(
    () =>
      emailTopics.map((topic) => ({
        label: topic.name,
        value: topic.id,
      })),
    [emailTopics],
  )
}
