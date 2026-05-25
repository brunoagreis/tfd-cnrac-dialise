import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function onlyDigits(value: string) {
  return (value || "").replace(/\D/g, "");
}

function maskCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11) return null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cpfInput = url.searchParams.get("cpf")?.trim() ?? "";

    // 🔥 aqui a diferença: em vez de 400, você pode devolver found:false
    // (se quiser manter 400, me fala; mas pro front costuma ser melhor found:false)
    if (!cpfInput) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    const cpfDigits = onlyDigits(cpfInput);
    const cpfMasked = maskCpf(cpfInput);

    const OR: { cpf: string }[] = [];

    // tenta exatamente como veio
    OR.push({ cpf: cpfInput });

    // tenta só dígitos (caso você tenha salvo assim em algum lugar)
    if (cpfDigits) OR.push({ cpf: cpfDigits });

    // tenta mascarado padrão 000.000.000-00
    if (cpfMasked) OR.push({ cpf: cpfMasked });

    const paciente = await prisma.paciente.findFirst({
      where: { OR },
      include: {
        telefones: true,
        demandas: {
          include: {
            anexos: true,
            notificacoes: true,
            telefonesSolicitante: true,
          },
        },
      },
    });

    // ✅ aqui também muda: nada de 404
    if (!paciente) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json({ found: true, paciente }, { status: 200 });
  } catch (err) {
    console.error("GET /api/pacientes erro:", err);
    return NextResponse.json({ found: false }, { status: 500 });
  }
}