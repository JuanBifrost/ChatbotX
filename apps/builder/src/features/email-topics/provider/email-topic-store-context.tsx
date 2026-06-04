"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react"
import { useStore } from "zustand"
import {
  createEmailTopicStore,
  type EmailTopicStore,
} from "./email-topic-store"

export type EmailTopicStoreApi = ReturnType<typeof createEmailTopicStore>

export const EmailTopicStoreContext = createContext<
  EmailTopicStoreApi | undefined
>(undefined)

export type EmailTopicStoreProviderProps = {
  workspaceId: string
  children: ReactNode
  autoInitialize?: boolean
}

export const EmailTopicStoreProvider = ({
  workspaceId,
  autoInitialize = true,
  children,
}: EmailTopicStoreProviderProps) => {
  const storeRef = useRef<EmailTopicStoreApi>(null)
  if (!storeRef.current) {
    storeRef.current = createEmailTopicStore({ workspaceId })
  }

  useEffect(() => {
    if (storeRef.current && autoInitialize) {
      storeRef.current.getState().initialize()
    }
  }, [autoInitialize])

  return (
    <EmailTopicStoreContext.Provider value={storeRef.current}>
      {children}
    </EmailTopicStoreContext.Provider>
  )
}

export const useEmailTopicStore = <T,>(
  selector: (store: EmailTopicStore) => T,
): T => {
  const ctx = useContext(EmailTopicStoreContext)
  if (!ctx) {
    throw new Error(
      "useEmailTopicStore must be used within EmailTopicStoreProvider",
    )
  }
  return useStore(ctx, selector)
}
