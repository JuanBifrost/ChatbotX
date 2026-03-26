import { createStore } from "zustand/vanilla"
import { client } from "@/lib/orpc/orpc"

export type IntegrationWhatsapp = {
  id: string
  name: string
}

export type IntegrationState = {
  loading: boolean
  error: string | null
  initialized: boolean

  chatbotId: string
  integrations: IntegrationWhatsapp[]
}

export type IntegrationActions = {
  initialize: () => Promise<void>
  getAllIntegrations: () => Promise<void>
}

export type IntegrationStore = IntegrationState & IntegrationActions

export const createIntegrationStore = (props: Partial<IntegrationState>) =>
  createStore<IntegrationStore>((set, get) => ({
    loading: false,
    error: null,
    initialized: false,

    chatbotId: "",
    integrations: [],
    ...props,

    initialize: async () => {
      const { initialized } = get()

      if (initialized) {
        return
      }

      try {
        await get().getAllIntegrations()
      } catch (error: unknown) {
        set({
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch integrations",
        })
      } finally {
        set({ initialized: true })
      }
    },

    getAllIntegrations: async () => {
      const { chatbotId, loading } = get()

      if (loading || !chatbotId) {
        return
      }

      try {
        set({ loading: true, error: null })

        const integrations =
          await client.integrationWhatsappAPIs.listIntegrationWhatsapp({
            chatbotId,
          })

        set({ integrations })
      } catch (error: unknown) {
        set({
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch integrations",
          integrations: [],
        })
      } finally {
        set({ loading: false })
      }
    },
  }))
