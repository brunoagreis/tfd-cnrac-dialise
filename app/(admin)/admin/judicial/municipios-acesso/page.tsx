"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type AccessItem = {
  id: string
  municipioNome: string
  email: string
  ativo: boolean
  senhaCadastrada: boolean
}

export default function MunicipiosAcessoPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<AccessItem[]>([])
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Acesso restrito.</div>
  }

  async function load() {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/judicial/municipios-acesso", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) {
        toast.error(json?.error || "Erro ao carregar.")
        return
      }
      setItems(Array.isArray(json.items) ? json.items : [])
    } finally {
      setLoading(false)
    }
  }

  async function save(item: AccessItem, ativo?: boolean) {
    const response = await fetch("/api/admin/judicial/municipios-acesso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, password: secrets[item.id] || undefined, ativo }),
    })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || !json?.ok) {
      toast.error(json?.error || "Erro ao salvar.")
      return
    }
    setItems(Array.isArray(json.items) ? json.items : [])
    setSecrets((current) => ({ ...current, [item.id]: "" }))
    toast.success("Acesso atualizado.")
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acesso dos municípios</h1>
          <p className="text-sm text-muted-foreground">Defina a senha para os e-mails cadastrados na aba Municípios.</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link></Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Logins municipais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" variant="outline" className="bg-transparent" onClick={load} disabled={loading}>{loading ? "Atualizando..." : "Atualizar"}</Button>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr><th className="px-3 py-3">Município</th><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Senha</th><th className="px-3 py-3">Nova senha</th><th className="px-3 py-3">Opções</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{item.municipioNome}</td>
                    <td className="px-3 py-3">{item.email}</td>
                    <td className="px-3 py-3">{item.ativo ? "Ativo" : "Inativo"}</td>
                    <td className="px-3 py-3">{item.senhaCadastrada ? "Cadastrada" : "Sem senha"}</td>
                    <td className="px-3 py-3"><Input type="password" value={secrets[item.id] || ""} onChange={(e) => setSecrets((current) => ({ ...current, [item.id]: e.target.value }))} placeholder="mín. 6 caracteres" /></td>
                    <td className="px-3 py-3"><div className="flex gap-2"><Button size="sm" onClick={() => save(item)}>Salvar</Button><Button size="sm" variant="outline" className="bg-transparent" onClick={() => save(item, !item.ativo)}>{item.ativo ? "Inativar" : "Ativar"}</Button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
