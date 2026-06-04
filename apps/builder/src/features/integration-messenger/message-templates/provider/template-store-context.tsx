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
  createMessengerTemplateStore,
  type MessengerTemplateStore,
} from "./template-store"

export type MessengerTemplateStoreApi = ReturnType<
  typeof createMessengerTemplateStore
>

export const MessengerTemplateStoreContext = createContext<
  MessengerTemplateStoreApi | undefined
>(undefined)

export type MessengerTemplateStoreProviderProps = {
  workspaceId: string
  integrationMessengerId?: string
  children: ReactNode
  autoInitialize?: boolean
}

export const MessengerTemplateStoreProvider = ({
  workspaceId,
  integrationMessengerId,
  autoInitialize = true,
  children,
}: MessengerTemplateStoreProviderProps) => {
  const storeRef = useRef<MessengerTemplateStoreApi>(null)
  if (!storeRef.current) {
    storeRef.current = createMessengerTemplateStore({
      workspaceId,
      integrationMessengerId,
    })
  }

  useEffect(() => {
    if (storeRef.current && autoInitialize) {
      storeRef.current.getState().initialize()
    }
  }, [autoInitialize])

  return (
    <MessengerTemplateStoreContext.Provider value={storeRef.current}>
      {children}
    </MessengerTemplateStoreContext.Provider>
  )
}

export const useMessengerTemplateStore = <T,>(
  selector: (store: MessengerTemplateStore) => T,
): T => {
  const templateStoreContext = useContext(MessengerTemplateStoreContext)

  if (!templateStoreContext) {
    throw new Error(
      "useMessengerTemplateStore must be used within MessengerTemplateStoreProvider",
    )
  }

  return useStore(templateStoreContext, selector)
}
