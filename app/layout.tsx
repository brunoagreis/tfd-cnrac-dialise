import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { Providers } from "@/components/providers"

import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
})

export const metadata: Metadata = {
  title: "SIGAJUS - Painel Administrativo",
  description:
    "Sistema de gestão judicial e regulação em saúde - TFD, CNRAC, Hemodiálise, Judicial e Pré Judicial",
  icons: {
    icon: "/icon-sigajus.png",
    shortcut: "/icon-sigajus.png",
    apple: "/icon-sigajus.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0c7bb3",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}