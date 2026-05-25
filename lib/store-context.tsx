"use client"

import { createContext, useContext, type ReactNode } from "react"
import { useGlobalStore } from "@/lib/demo-data"

type StoreType = ReturnType<typeof useGlobalStore>

const StoreContext = createContext<StoreType | undefined>(undefined)

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useGlobalStore()
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used inside StoreProvider")
  return ctx
}
