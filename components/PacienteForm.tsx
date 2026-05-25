"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function PacienteForm() {
  const [cpf, setCpf] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function buscar() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/pacientes?cpf=${encodeURIComponent(cpf)}`);
      const data = await res.json();
      setResult({ ok: res.ok, data });
    } catch (e: any) {
      setResult({ ok: false, data: { error: e?.message || "Erro" } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>CPF</Label>
        <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
      </div>

      <Button onClick={buscar} disabled={loading || !cpf}>
        {loading ? "Buscando..." : "Buscar paciente"}
      </Button>

      {result && (
        <pre className="rounded-md border p-3 text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}