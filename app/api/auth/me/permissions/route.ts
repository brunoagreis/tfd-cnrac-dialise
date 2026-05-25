import { NextResponse } from "next/server"

export async function POST() {
  try {
    return NextResponse.json({
      ok: true,
      permissions: [],
    })
  } catch (error) {
    console.error("ME_PERMISSIONS_ERROR", error)
    return NextResponse.json(
      { ok: false, error: "Erro ao carregar permissões." },
      { status: 500 },
    )
  }
}