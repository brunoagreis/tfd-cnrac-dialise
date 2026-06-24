"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Upload } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/lib/auth-context"
import { canAccessJudicialAdmin } from "@/lib/judicial-access"
import { CORE_TABLE_LABELS, CORE_TABLES, type CoreTable } from "@/lib/judicial-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ImportacoesCorePage() {
  const { user } = useAuth()
  const [table, setTable] = useState<CoreTable>("core_ambulatorial_finalizados")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  if (!canAccessJudicialAdmin(user)) {
    return <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">Somente administradores podem acessar esta página.</div>
  }

  async function handleImport() {
    if (!selectedFile) return toast.error("Selecione um arquivo Excel para importar.")
    try {
      setUploading(true)
      const formData = new FormData()
      formData.append("tipoImportacao", table)
      formData.append("file", selectedFile)
      const response = await fetch("/api/admin/judicial/core-importacoes", { method: "POST", body: formData })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json?.ok) return toast.error(json?.error || "Erro ao importar arquivo CORE.")
      const total = Number(json?.totalRegistros ?? 0)
      toast.success(`${CORE_TABLE_LABELS[table]} importado com sucesso. ${total} registro(s) processado(s).`)
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ""
    } catch (error) {
      console.error("CORE_IMPORT_ERROR", error)
      toast.error("Erro ao importar arquivo CORE.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importações CORE</h1>
          <p className="text-sm text-muted-foreground">Importar planilhas CORE ambulatorial e leitos.</p>
        </div>
        <Button asChild variant="outline" className="bg-transparent"><Link href="/admin/judicial"><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao Admin Judicial</Link></Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Importações CORE</CardTitle>
          <CardDescription>Selecione o tipo de importação e envie o arquivo Excel correspondente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">Regras de atualização</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li><strong>CORE Ambulatorial Finalizados</strong>: apaga apenas os registros do lote finalizados e mantém os em atendimento.</li>
              <li><strong>CORE Ambulatorial Em Atendimento</strong>: apaga apenas os registros do lote em atendimento e mantém os finalizados.</li>
              <li><strong>CORE Leitos</strong>: apaga todos os dados de core_leitos e substitui pelo novo arquivo.</li>
            </ul>
          </div>
          <div className="grid gap-3 md:grid-cols-[340px_1fr]">
            <div>
              <Label className="mb-1 block text-xs">Tipo de importação</Label>
              <select value={table} onChange={(e) => setTable(e.target.value as CoreTable)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CORE_TABLES.map((item) => <option key={item} value={item}>{CORE_TABLE_LABELS[item]}</option>)}
              </select>
            </div>
            <div className="flex items-end"><Button onClick={handleImport} disabled={uploading || !selectedFile}><Upload className="mr-2 h-4 w-4" />{uploading ? "Importando..." : "Importar arquivo"}</Button></div>
          </div>
          <div className="space-y-2">
            <Label className="block text-xs">Arquivo</Label>
            <Input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
            {selectedFile ? <div className="rounded-lg border border-border p-3 text-sm"><p className="font-medium text-foreground">{selectedFile.name}</p><p className="text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p></div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
