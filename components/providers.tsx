"use client"

import type { ReactNode } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { PermissionsProvider } from "@/lib/permissions"
import { StoreProvider } from "@/lib/store-context"
import { JudicialProvider } from "@/lib/judicial-context"
import { PreJudicialProvider } from "@/lib/pre-judicial-context"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PermissionsProvider>
        <StoreProvider>
          <JudicialProvider>
            <PreJudicialProvider>{children}</PreJudicialProvider>
          </JudicialProvider>
        </StoreProvider>
      </PermissionsProvider>
    </AuthProvider>
  )
}