"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react"
import { useStore } from "zustand"
import { type ContactStore, createContactStore } from "./contact-store"

export type ContactStoreApi = ReturnType<typeof createContactStore>

export const ContactStoreContext = createContext<ContactStoreApi | undefined>(
  undefined,
)

export type ContactStoreProviderProps = {
  workspaceId: string
  children: ReactNode
  autoInitialize?: boolean
}

export const ContactStoreProvider = ({
  workspaceId,
  autoInitialize = true,
  children,
}: ContactStoreProviderProps) => {
  const storeRef = useRef<ContactStoreApi>(null)
  if (!storeRef.current) {
    storeRef.current = createContactStore({
      workspaceId,
    })
  }

  useEffect(() => {
    if (storeRef.current && autoInitialize) {
      storeRef.current.getState().initialize()
    }
  }, [autoInitialize])

  return (
    <ContactStoreContext.Provider value={storeRef.current}>
      {children}
    </ContactStoreContext.Provider>
  )
}

export const useContactStore = <T,>(
  selector: (store: ContactStore) => T,
): T => {
  const contactStoreContext = useContext(ContactStoreContext)

  if (!contactStoreContext) {
    throw new Error("useContactStore must be used within ContactStoreProvider")
  }

  return useStore(contactStoreContext, selector)
}
