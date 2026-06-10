import ky from "ky"
import { type RefObject, useRef } from "react"
import useSWRImmutable from "swr/immutable"

export const callAPI = <T>(url: string | null) => {
  const random = useRef(Date.now())
  const { data, error, isLoading } = useSWRImmutable<T>(
    url ? [url, random] : null,
    (args: [string, RefObject<number>]) => ky.get(args[0]).json(),
  )

  return {
    data,
    error,
    isLoading,
  }
}
