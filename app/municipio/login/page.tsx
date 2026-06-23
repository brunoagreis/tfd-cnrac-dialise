"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MunicipalityPortalLogo } from "@/components/municipio/municipality-portal-logo"

export default function MunicipioLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [accessKey, setAccessKey] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    try {
      setLoading(true)
      const response = await fetch("/api/municipio/acesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: accessKey }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Acesso não autorizado.")
        return
      }
      toast.success("Acesso realizado com sucesso.")
      router.push("/municipio")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted px-4 py-6">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-center">
          <MunicipalityPortalLogo variant="color" className="h-16 w-auto max-w-[300px] object-contain" />
        </div>
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Portal do Município</CardTitle>
            <CardDescription>Entre com o e-mail cadastrado para acompanhar as demandas do município.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="municipio@email.gov.br" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accessKey">Chave de acesso</Label>
                <Input id="accessKey" type="password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} placeholder="Chave de acesso" required />
              </div>
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Entrar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
