import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface AIState {
  messages: Message[]
  isLoading: boolean
  isPanelOpen: boolean
  selectedContext: string | null
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  setLoading: (loading: boolean) => void
  setPanelOpen: (open: boolean) => void
  setSelectedContext: (context: string | null) => void
  clearMessages: () => void
}

export const useAIStore = create<AIState>((set) => ({
  messages: [],
  isLoading: false,
  isPanelOpen: true,
  selectedContext: null,
  addMessage: (message) => set((state) => ({
    messages: [
      ...state.messages,
      {
        ...message,
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now()
      }
    ]
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setPanelOpen: (open) => set({ isPanelOpen: open }),
  setSelectedContext: (context) => set({ selectedContext: context }),
  clearMessages: () => set({ messages: [] })
}))
