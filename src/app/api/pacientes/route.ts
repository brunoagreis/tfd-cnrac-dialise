import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const paciente = await prisma.paciente.create({
      data: {
        cpf: body.cpf,
        cartaoSus: body.cartaoSus,
        nome: body.nome,
        dataNascimento: new Date(body.dataNascimento),
        email: body.emailPaciente,
        municipio: body.municipio,
        endereco: body.endereco,
        telefones: {
          create: body.telefones.map((t: any) => ({
            numero: t.value,
          })),
        },
      },
    });

    return NextResponse.json(paciente);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Erro ao criar paciente" },
      { status: 500 }
    );
  }
}