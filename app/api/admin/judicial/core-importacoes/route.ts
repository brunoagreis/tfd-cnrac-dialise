import { NextResponse } from "next/server"
import { Readable } from "node:stream"
import { parse } from "csv-parse"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type TipoImportacao =
  | "core_ambulatorial_finalizados"
  | "core_ambulatorial_em_atendimento"
  | "core_leitos"

const AMB_COLUMN_ORDER = [
  "tipo_lote",
  "nr_ficha",
  "prioridade",
  "situacao_ficha",
  "nome_paciente",
  "nome_mae",
  "data_nascimento",
  "idade",
  "sexo",
  "cns",
  "municipio_nascimento",
  "nacionalidade",
  "paciente_nomade",
  "municipio_onde_reside",
  "telefone_paciente",
  "data_solicitacao",
  "tipo_atendimento",
  "subtipo_atendimento",
  "cnes_unidade_solicitante",
  "unidade_solicitante",
  "municipio_solicitante",
  "telefone_unidade",
  "profissional_solicitante",
  "conselho_profissional_solicitante",
  "usuario_abertura_ficha",
  "solicitacao_judicial",
  "recurso_solicitado",
  "regulado",
  "codigo_procedimento_solicitado",
  "procedimento_solicitado",
  "especialidade",
  "sub_especialidade",
  "complemento",
  "situacao_procedimento",
  "unidade_reguladora_final",
  "profissional_regulador",
  "conselho_profissional_regulador",
  "data_hora_assuncao_ficha",
  "data_hora_finalizacao_regulacao",
  "cid_principal",
  "descricao_cid_principal",
  "cnes_unidade_executante",
  "unidade_executante",
  "municipio_executante",
  "profissional_executante",
  "conselho_profissional_executante",
  "data_hora_acao_agendamento",
  "data_hora_agendamento",
  "data_hora_recepcao",
  "atendimento_recepcao",
  "motivo_recepcao",
  "motivo_cancelamento_agendamento",
  "justificativa_cancelamento_agendamento",
  "motivo_cancelamento_solicitacao",
  "justificativa_cancelamento_solicitacao",
  "contato_telefonico_realizado",
  "contato_resolucao",
  "observacao",
  "tipo_consulta",
  "data_prevista_retorno",
  "data_hora_finalizacao_ficha",
] as const

const LEITOS_COLUMN_ORDER = [
  "numero_ficha",
  "prioridade",
  "situacao_ficha",
  "nome_paciente",
  "nome_mae",
  "data_nascimento",
  "idade",
  "sexo",
  "carater_internacao",
  "cns",
  "municipio_nascimento",
  "nacionalidade",
  "paciente_nomade",
  "municipio_onde_reside",
  "telefone_paciente",
  "data_solicitacao",
  "cnes_unidade_solicitante",
  "nome_unidade_solicitante",
  "municipio_solicitante",
  "data_validacao_profissional_solicitante",
  "profissional_solicitante",
  "conselho_solicitante",
  "numero_documento_solicitante",
  "solicitacao_judicial",
  "cid10",
  "recurso_solicitado",
  "codigo_procedimento_solicitado",
  "procedimento_solicitado",
  "status_procedimento",
  "cod_procedimento_especial_1",
  "descricao_procedimento_especial_1",
  "quantidade_procedimento_especial_1",
  "cod_procedimento_especial_2",
  "descricao_procedimento_especial_2",
  "quantidade_procedimento_especial_2",
  "cod_procedimento_especial_3",
  "descricao_procedimento_especial_3",
  "quantidade_procedimento_especial_3",
  "cod_procedimento_especial_4",
  "descricao_procedimento_especial_4",
  "quantidade_procedimento_especial_4",
  "cod_procedimento_especial_5",
  "descricao_procedimento_especial_5",
  "quantidade_procedimento_especial_5",
  "cod_procedimento_especial_6",
  "descricao_procedimento_especial_6",
  "quantidade_procedimento_especial_6",
  "cod_procedimento_especial_7",
  "descricao_procedimento_especial_7",
  "quantidade_procedimento_especial_7",
  "cod_procedimento_especial_8",
  "descricao_procedimento_especial_8",
  "quantidade_procedimento_especial_8",
  "cod_procedimento_especial_9",
  "descricao_procedimento_especial_9",
  "quantidade_procedimento_especial_9",
  "cod_procedimento_especial_10",
  "descricao_procedimento_especial_10",
  "quantidade_procedimento_especial_10",
  "solicitou_mudanca_procedimento",
  "codigo_mudanca_procedimento_principal_solicitado",
  "mudanca_procedimento_principal_solicitado",
  "codigo_solicitacao_procedimento_especial_1",
  "solicitacao_procedimento_especial_1",
  "codigo_solicitacao_procedimento_especial_2",
  "solicitacao_procedimento_especial_2",
  "cnes_unidade_executante",
  "nome_unidade_executante",
  "municipio_executante",
  "profissional_executante",
  "conselho_executante",
  "numero_documento_executante",
  "data_prevista_internacao",
  "unidade_reguladora_final",
  "profissional_regulador",
  "conselho_regulador",
  "numero_documento_regulador",
  "data_hora_assuncao_regulacao",
  "data_hora_finalizacao_regulacao",
  "motivo_cancelamento_solicitacao",
  "justificativa_cancelamento_solicitacao",
  "medico_pre_autorizador",
  "data_hora_pre_autorizacao",
  "pre_autorizado",
  "justificativa_recusa_pre_autorizado",
  "data_hora_admissao_paciente",
  "paciente_internado",
  "motivo_internacao",
  "justificativa_internacao",
  "data_hora_alta_paciente",
  "descricao_saida_paciente",
  "motivo_saida_paciente",
  "medico_autorizador_aih",
  "data_hora_autorizacao_aih",
  "recusa_aih",
  "justificativa_recusa_aih",
  "numero_aih",
  "data_hora_emissao_aih",
  "data_hora_finalizacao_ficha",
] as const

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ""
  return String(value).trim()
}

function hasAnyValue(values: unknown[]) {
  return values.some((value) => String(value ?? "").trim() !== "")
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "NULL"
  const text = String(value).replace(/'/g, "''")
  return `'${text}'`
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function mapRow(
  raw: Record<string, unknown>,
  columns: readonly string[],
  extra?: Record<string, string>,
) {
  const mapped: Record<string, string> = {}

  for (const column of columns) {
    mapped[column] = normalizeCell(raw[column] ?? "")
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      mapped[key] = value
    }
  }

  return mapped
}

function isAmbulatorialHeader(row: unknown[]) {
  const normalized = row.map((cell) => normalizeHeader(cell))
  return normalized.includes("nr_ficha") && normalized.includes("nome_paciente")
}

function isLeitosHeader(row: unknown[]) {
  const normalized = row.map((cell) => normalizeHeader(cell))
  return normalized.includes("numero_ficha") && normalized.includes("nome_paciente")
}

async function detectCsvDelimiterFromFileHead(file: File) {
  const head = await file.slice(0, 65536).text()
  const firstNonEmptyLine =
    head
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""

  const options = [";", ",", "\t"] as const

  let best = ";"
  let bestCount = -1

  for (const option of options) {
    const count = firstNonEmptyLine.split(option).length
    if (count > bestCount) {
      best = option
      bestCount = count
    }
  }

  return best
}

async function insertCoreAmbulatorialBatch(
  tipoLote: "finalizados" | "em_atendimento",
  batch: Record<string, string>[],
) {
  if (!batch.length) return

  const columns = AMB_COLUMN_ORDER.join(", ")
  const valuesList = batch
    .map(
      (row) =>
        `(${AMB_COLUMN_ORDER.map((column) => sqlValue(row[column])).join(", ")})`,
    )
    .join(", ")

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.core_ambulatorial (${columns}) VALUES ${valuesList}`,
  )
}

async function insertCoreLeitosBatch(batch: Record<string, string>[]) {
  if (!batch.length) return

  const columns = LEITOS_COLUMN_ORDER.join(", ")
  const valuesList = batch
    .map(
      (row) =>
        `(${LEITOS_COLUMN_ORDER.map((column) => sqlValue(row[column])).join(", ")})`,
    )
    .join(", ")

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.core_leitos (${columns}) VALUES ${valuesList}`,
  )
}

async function importCoreAmbulatorialCsv(
  file: File,
  fileName: string,
  tipoLote: "finalizados" | "em_atendimento",
) {
  const delimiter = await detectCsvDelimiterFromFileHead(file)

  await prisma.$executeRawUnsafe(
    `DELETE FROM public.core_ambulatorial WHERE tipo_lote = ${sqlValue(tipoLote)}`,
  )

  const parser = parse({
    bom: true,
    delimiter,
    columns: (header: string[]) => header.map((item) => normalizeHeader(item)),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })

  const source = Readable.fromWeb(file.stream() as any)
  const records = source.pipe(parser)

  let batch: Record<string, string>[] = []
  let totalRegistros = 0

  for await (const record of records) {
    batch.push(
      mapRow(record as Record<string, unknown>, AMB_COLUMN_ORDER, {
        tipo_lote: tipoLote,
      }),
    )

    if (batch.length >= 100) {
      await insertCoreAmbulatorialBatch(tipoLote, batch)
      totalRegistros += batch.length
      batch = []
    }
  }

  if (batch.length > 0) {
    await insertCoreAmbulatorialBatch(tipoLote, batch)
    totalRegistros += batch.length
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.core_importacoes (tipo_importacao, nome_arquivo, total_registros)
     VALUES (${sqlValue(
       tipoLote === "finalizados"
         ? "core_ambulatorial_finalizados"
         : "core_ambulatorial_em_atendimento",
     )}, ${sqlValue(fileName)}, ${totalRegistros})`,
  )

  return totalRegistros
}

async function importCoreLeitosCsv(file: File, fileName: string) {
  const delimiter = await detectCsvDelimiterFromFileHead(file)

  await prisma.$executeRawUnsafe(`DELETE FROM public.core_leitos`)

  const parser = parse({
    bom: true,
    delimiter,
    columns: (header: string[]) => header.map((item) => normalizeHeader(item)),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  })

  const source = Readable.fromWeb(file.stream() as any)
  const records = source.pipe(parser)

  let batch: Record<string, string>[] = []
  let totalRegistros = 0

  for await (const record of records) {
    batch.push(
      mapRow(record as Record<string, unknown>, LEITOS_COLUMN_ORDER),
    )

    if (batch.length >= 50) {
      await insertCoreLeitosBatch(batch)
      totalRegistros += batch.length
      batch = []
    }
  }

  if (batch.length > 0) {
    await insertCoreLeitosBatch(batch)
    totalRegistros += batch.length
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.core_importacoes (tipo_importacao, nome_arquivo, total_registros)
     VALUES (${sqlValue("core_leitos")}, ${sqlValue(fileName)}, ${totalRegistros})`,
  )

  return totalRegistros
}

async function readXlsxFile(file: File, tipoImportacao: TipoImportacao) {
  const XLSXModule = await import("xlsx")
  const XLSX = (XLSXModule as any).default ?? XLSXModule

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(Buffer.from(arrayBuffer), {
    type: "buffer",
    cellDates: false,
    dense: true,
  })

  const expectedMode =
    tipoImportacao === "core_leitos" ? "leitos" : "ambulatorial"

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]

    const directRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
      blankrows: false,
    })

    if (directRows.length > 0) {
      const directHeaders = Object.keys(directRows[0]).map((item) =>
        normalizeHeader(item),
      )
      const isAmb =
        directHeaders.includes("nr_ficha") &&
        directHeaders.includes("nome_paciente")
      const isLeito =
        directHeaders.includes("numero_ficha") &&
        directHeaders.includes("nome_paciente")

      if (
        (expectedMode === "ambulatorial" && isAmb) ||
        (expectedMode === "leitos" && isLeito)
      ) {
        const normalizedRows = directRows.map((row) => {
          const obj: Record<string, unknown> = {}
          for (const [key, value] of Object.entries(row)) {
            obj[normalizeHeader(key)] = value
          }
          return obj
        })

        return {
          sheetName,
          headerIndex: 0,
          headers: directHeaders,
          rows: normalizedRows,
        }
      }
    }

    const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
      sheet,
      {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      },
    )

    const rows = matrix.filter((row) => hasAnyValue(row))
    if (!rows.length) continue

    let headerIndex = -1

    for (let i = 0; i < Math.min(rows.length, 50); i++) {
      const row = rows[i]
      if (expectedMode === "ambulatorial" && isAmbulatorialHeader(row)) {
        headerIndex = i
        break
      }
      if (expectedMode === "leitos" && isLeitosHeader(row)) {
        headerIndex = i
        break
      }
    }

    if (headerIndex === -1) continue

    const headerRow = rows[headerIndex].map((item) => String(item ?? "").trim())
    const normalizedHeaders = headerRow.map((item) => normalizeHeader(item))

    const dataRows = rows
      .slice(headerIndex + 1)
      .filter((row) => hasAnyValue(row))

    const resultRows = dataRows.map((row) => {
      const obj: Record<string, unknown> = {}
      normalizedHeaders.forEach((header, index) => {
        if (!header) return
        obj[header] = row[index] ?? ""
      })
      return obj
    })

    return {
      sheetName,
      headerIndex,
      headers: normalizedHeaders,
      rows: resultRows,
    }
  }

  return {
    sheetName: "",
    headerIndex: -1,
    headers: [] as string[],
    rows: [] as Record<string, unknown>[],
  }
}

async function replaceCoreAmbulatorial(
  tipoLote: "finalizados" | "em_atendimento",
  fileName: string,
  rows: Record<string, string>[],
) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM public.core_ambulatorial WHERE tipo_lote = ${sqlValue(tipoLote)}`,
  )

  const chunks = chunkArray(rows, 100)

  for (const chunk of chunks) {
    await insertCoreAmbulatorialBatch(tipoLote, chunk)
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.core_importacoes (tipo_importacao, nome_arquivo, total_registros)
     VALUES (${sqlValue(
       tipoLote === "finalizados"
         ? "core_ambulatorial_finalizados"
         : "core_ambulatorial_em_atendimento",
     )}, ${sqlValue(fileName)}, ${rows.length})`,
  )
}

async function replaceCoreLeitos(
  fileName: string,
  rows: Record<string, string>[],
) {
  await prisma.$executeRawUnsafe(`DELETE FROM public.core_leitos`)

  const chunks = chunkArray(rows, 50)

  for (const chunk of chunks) {
    await insertCoreLeitosBatch(chunk)
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.core_importacoes (tipo_importacao, nome_arquivo, total_registros)
     VALUES (${sqlValue("core_leitos")}, ${sqlValue(fileName)}, ${rows.length})`,
  )
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const tipoImportacao = String(formData.get("tipoImportacao") ?? "").trim() as TipoImportacao
    const file = formData.get("file")

    if (
      tipoImportacao !== "core_ambulatorial_finalizados" &&
      tipoImportacao !== "core_ambulatorial_em_atendimento" &&
      tipoImportacao !== "core_leitos"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tipo de importação inválido.",
          debug: { tipoImportacaoRecebido: tipoImportacao },
        },
        { status: 400 },
      )
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Arquivo não enviado.",
          debug: { tipoRecebido: typeof file },
        },
        { status: 400 },
      )
    }

    const lowerName = file.name.toLowerCase()
    const isCsv = lowerName.endsWith(".csv") || lowerName.endsWith(".txt")

    if (isCsv) {
      if (tipoImportacao === "core_ambulatorial_finalizados") {
        const totalRegistros = await importCoreAmbulatorialCsv(
          file,
          file.name,
          "finalizados",
        )

        return NextResponse.json({
          ok: true,
          tabela: "core_ambulatorial",
          tipoLote: "finalizados",
          totalRegistros,
          sheetName: "csv",
        })
      }

      if (tipoImportacao === "core_ambulatorial_em_atendimento") {
        const totalRegistros = await importCoreAmbulatorialCsv(
          file,
          file.name,
          "em_atendimento",
        )

        return NextResponse.json({
          ok: true,
          tabela: "core_ambulatorial",
          tipoLote: "em_atendimento",
          totalRegistros,
          sheetName: "csv",
        })
      }

      const totalRegistros = await importCoreLeitosCsv(file, file.name)

      return NextResponse.json({
        ok: true,
        tabela: "core_leitos",
        totalRegistros,
        sheetName: "csv",
      })
    }

    const workbook = await readXlsxFile(file, tipoImportacao)

    if (!workbook.rows.length) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Não foi possível localizar o cabeçalho ou não há linhas de dados no arquivo.",
          debug: {
            fileName: file.name,
            fileSize: file.size,
            sheetName: workbook.sheetName,
            headerIndex: workbook.headerIndex,
            headers: workbook.headers,
            totalRows: workbook.rows.length,
            tipoImportacao,
          },
        },
        { status: 400 },
      )
    }

    if (tipoImportacao === "core_ambulatorial_finalizados") {
      const mappedRows = workbook.rows.map((row) =>
        mapRow(row, AMB_COLUMN_ORDER, { tipo_lote: "finalizados" }),
      )

      await replaceCoreAmbulatorial("finalizados", file.name, mappedRows)

      return NextResponse.json({
        ok: true,
        tabela: "core_ambulatorial",
        tipoLote: "finalizados",
        totalRegistros: mappedRows.length,
        sheetName: workbook.sheetName,
      })
    }

    if (tipoImportacao === "core_ambulatorial_em_atendimento") {
      const mappedRows = workbook.rows.map((row) =>
        mapRow(row, AMB_COLUMN_ORDER, { tipo_lote: "em_atendimento" }),
      )

      await replaceCoreAmbulatorial("em_atendimento", file.name, mappedRows)

      return NextResponse.json({
        ok: true,
        tabela: "core_ambulatorial",
        tipoLote: "em_atendimento",
        totalRegistros: mappedRows.length,
        sheetName: workbook.sheetName,
      })
    }

    const mappedRows = workbook.rows.map((row) =>
      mapRow(row, LEITOS_COLUMN_ORDER),
    )

    await replaceCoreLeitos(file.name, mappedRows)

    return NextResponse.json({
      ok: true,
      tabela: "core_leitos",
      totalRegistros: mappedRows.length,
      sheetName: workbook.sheetName,
    })
  } catch (error: any) {
    console.error("[POST /api/admin/judicial/core-importacoes] erro:", error)

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Falha ao importar arquivo CORE.",
      },
      { status: 500 },
    )
  }
}