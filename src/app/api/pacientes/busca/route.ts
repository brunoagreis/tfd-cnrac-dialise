import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "Informe CPF ou CNS" }, { status: 400 });
  }

  const onlyDigits = q.replace(/\D/g, "");

  const paciente = await prisma.paciente.findFirst({
    where: {
      OR: [
        { cpf: q },
        { cpf: maskCpf(onlyDigits) },
        { cartaoSus: onlyDigits },
        { cartaoSus: q },
      ],
    },
    include: { telefones: true },
  });

  if (!paciente) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    paciente: {
      cpf: paciente.cpf,
      cartaoSus: paciente.cartaoSus,
      nome: paciente.nome,
      dataNascimento: paciente.dataNascimento.toISOString().slice(0, 10),
      email: paciente.email || "",
      municipio: paciente.municipio,
      endereco: paciente.endereco,
      telefones: paciente.telefones.map((t) => t.value),
    },
  });
}

function maskCpf(digits: string) {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}