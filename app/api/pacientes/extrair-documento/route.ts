import { createRequire } from "node:module"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const runtimeRequire = createRequire(import.meta.url)

function ensurePdfParseNodePolyfills() {
  const globalObject = globalThis as any

  if (!globalObject.DOMMatrix) {
    globalObject.DOMMatrix = class DOMMatrix {
      a: number
      b: number
      c: number
      d: number
      e: number
      f: number

      constructor(init?: any) {
        this.a = 1
        this.b = 0
        this.c = 0
        this.d = 1
        this.e = 0
        this.f = 0

        if (Array.isArray(init) && init.length >= 6) {
          this.a = Number(init[0]) || 1
          this.b = Number(init[1]) || 0
          this.c = Number(init[2]) || 0
          this.d = Number(init[3]) || 1
          this.e = Number(init[4]) || 0
          this.f = Number(init[5]) || 0
        } else if (init && typeof init === "object") {
          this.a = Number(init.a ?? init.m11 ?? this.a) || this.a
          this.b = Number(init.b ?? init.m12 ?? this.b) || this.b
          this.c = Number(init.c ?? init.m21 ?? this.c) || this.c
          this.d = Number(init.d ?? init.m22 ?? this.d) || this.d
          this.e = Number(init.e ?? init.m41 ?? this.e) || this.e
          this.f = Number(init.f ?? init.m42 ?? this.f) || this.f
        }
      }

      get m11() { return this.a }
      get m12() { return this.b }
      get m21() { return this.c }
      get m22() { return this.d }
      get m41() { return this.e }
      get m42() { return this.f }

      multiplySelf() { return this }
      preMultiplySelf() { return this }
      translateSelf() { return this }
      scaleSelf() { return this }
      rotateSelf() { return this }
      skewXSelf() { return this }
      skewYSelf() { return this }
      invertSelf() { return this }

      transformPoint(point?: any) {
        const x = Number(point?.x ?? 0)
        const y = Number(point?.y ?? 0)

        return {
          x: this.a * x + this.c * y + this.e,
          y: this.b * x + this.d * y + this.f,
          z: Number(point?.z ?? 0),
          w: Number(point?.w ?? 1),
        }
      }

      toFloat32Array() {
        return Float32Array.from([
          this.a, this.b, 0, 0,
          this.c, this.d, 0, 0,
          0, 0, 1, 0,
          this.e, this.f, 0, 1,
        ])
      }

      toFloat64Array() {
        return Float64Array.from([
          this.a, this.b, 0, 0,
          this.c, this.d, 0, 0,
          0, 0, 1, 0,
          this.e, this.f, 0, 1,
        ])
      }

      toString() {
        return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`
      }
    }
  }

  if (!globalObject.ImageData) {
    globalObject.ImageData = class ImageData {
      data: Uint8ClampedArray
      width: number
      height: number

      constructor(data: Uint8ClampedArray, width: number, height?: number) {
        this.data = data
        this.width = width
        this.height = height ?? Math.floor(data.length / 4 / Math.max(width, 1))
      }
    }
  }

  if (!globalObject.Path2D) {
    globalObject.Path2D = class Path2D {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
      roundRect() {}
    }
  }
}

// NAO_SALVA_ARQUIVO_PACIENTE: o arquivo é lido apenas em memória para preencher o formulário; não é persistido em disco nem no banco.

type ExtractedPatientFields = {
  cpf?: string
  cns?: string
  nome?: string
  dataNascimento?: string
  telefone?: string
  telefones?: string[]
  endereco?: string
  numero?: string
  complemento?: string
  cep?: string
  bairro?: string
  cidade?: string
  rawText?: string
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "")
}

function normalizeSpaces(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim()
}

function normalizeKey(value: unknown) {
  return normalizeSpaces(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
}

function linesFromText(value: unknown) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeSpaces(line))
    .filter(Boolean)
}

function findLineIndex(lines: string[], labels: string[]) {
  const normalizedLabels = labels.map(normalizeKey)

  return lines.findIndex((line) => {
    const key = normalizeKey(line)
    return normalizedLabels.some((label) => key === label || key.startsWith(label + ":"))
  })
}

function readAfterLabel(lines: string[], labels: string[]) {
  const index = findLineIndex(lines, labels)
  if (index < 0) return ""

  const currentLine = lines[index]
  const colonIndex = currentLine.indexOf(":")
  if (colonIndex >= 0) {
    const sameLineValue = normalizeSpaces(currentLine.slice(colonIndex + 1))
    if (sameLineValue) return sameLineValue
  }

  for (let offset = 1; offset <= 4; offset++) {
    const next = lines[index + offset]
    if (!next) continue

    const nextKey = normalizeKey(next)

    if (
      /^(NOME|CPF|CNS|DATA|SEXO|RACA|RAÃ‡A|ENDERECO|ENDEREÃ‡O|CONTATOS|DOCUMENTOS|TIPO|LOGRADOURO|NUMERO|NÃšMERO|BAIRRO|CEP|MUNICIPIO|MUNICÍPIO|TELEFONE|DDD)\b/.test(nextKey)
    ) {
      continue
    }

    return next
  }

  return ""
}

function formatDateForInput(value: unknown) {
  const text = String(value ?? "")
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return ""

  return `${match[3]}-${match[2]}-${match[1]}`
}

function formatCpf(value: unknown) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length !== 11) return ""

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2")
}

function formatCep(value: unknown) {
  const digits = onlyDigits(value).slice(0, 8)
  if (digits.length !== 8) return ""
  return digits.replace(/^(\d{5})(\d)/, "$1-$2")
}

function formatPhone(ddd: string, number: string) {
  const digits = onlyDigits(ddd + number).slice(0, 11)

  if (digits.length < 10) return ""

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
  }

  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
}

function normalizeCity(value: unknown) {
  const text = normalizeSpaces(value)
  if (!text) return ""

  return text
    .replace(/\s+-\s+[A-Z]{2}$/i, "")
    .replace(/\s+\/\s+[A-Z]{2}$/i, "")
    .trim()
}

function extractPatientFields(rawText: string): ExtractedPatientFields {
  const lines = linesFromText(rawText)
  const joined = lines.join("\n")

  const fields: ExtractedPatientFields = {
    rawText: rawText.slice(0, 8000),
  }

  const cnsLabel = readAfterLabel(lines, ["CNS"])
  const cnsMatch =
    onlyDigits(cnsLabel).match(/\d{15}/) ||
    onlyDigits(joined).match(/\d{15}/)

  if (cnsMatch) fields.cns = cnsMatch[0]

  const cpfLabel = readAfterLabel(lines, ["CPF"])
  const cpfMatch =
    cpfLabel.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/) ||
    joined.match(/CPF\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)

  if (cpfMatch) fields.cpf = formatCpf(cpfMatch[1] || cpfMatch[0])

  const nome = readAfterLabel(lines, ["Nome", "Nome do paciente", "Nome completo"])
  if (nome && !/^---+$/.test(nome)) fields.nome = nome.toUpperCase()

  const nascimentoLabel = readAfterLabel(lines, ["Data de Nascimento", "Nascimento"])
  const nascimento =
    formatDateForInput(nascimentoLabel) ||
    formatDateForInput(joined.match(/Data\s+de\s+Nascimento\s*:?\s*([^\n]+)/i)?.[1])

  if (nascimento) fields.dataNascimento = nascimento

  const cepLabel = readAfterLabel(lines, ["CEP"])
  const cep = formatCep(cepLabel || joined.match(/CEP\s*:?\s*(\d{5}-?\d{3})/i)?.[1])
  if (cep) fields.cep = cep

  const bairro = readAfterLabel(lines, ["Bairro"])
  if (bairro) fields.bairro = bairro.toUpperCase()

  const tipoLogradouro = readAfterLabel(lines, ["Tipo Logradouro", "Tipo de Logradouro"])
  const logradouro = readAfterLabel(lines, ["Logradouro", "Endereço", "Endereco"])
  const enderecoParts = [tipoLogradouro, logradouro]
    .map((item) => normalizeSpaces(item))
    .filter(Boolean)

  if (enderecoParts.length > 0) {
    fields.endereco = enderecoParts.join(" ").toUpperCase()
  }

  const numero = readAfterLabel(lines, ["Número", "Numero"])
  if (numero) fields.numero = numero.toUpperCase()

  const complemento = readAfterLabel(lines, ["Complemento"])
  if (complemento) fields.complemento = complemento.toUpperCase()

  const cidade =
    readAfterLabel(lines, ["Município de Residência", "Municipio de Residência", "Município", "Municipio"]) ||
    readAfterLabel(lines, ["Cidade"])

  if (cidade) fields.cidade = normalizeCity(cidade).toUpperCase()

  const dddLine = readAfterLabel(lines, ["DDD"])
  const telefoneLine = readAfterLabel(lines, ["Número", "Numero", "Telefone", "Telefone(s)"])

  const dddMatch = joined.match(/\((\d{2})\)/)
  const phoneMatch =
    joined.match(/\(?(\d{2})\)?\s*(9?\d{4})[-\s]?(\d{4})/) ||
    null

  let telefone = ""

  if (phoneMatch) {
    telefone = formatPhone(phoneMatch[1], `${phoneMatch[2]}${phoneMatch[3]}`)
  } else if (dddMatch && telefoneLine) {
    telefone = formatPhone(dddMatch[1], telefoneLine)
  } else if (dddLine && telefoneLine) {
    telefone = formatPhone(dddLine, telefoneLine)
  }

  if (telefone) {
    fields.telefone = telefone
    fields.telefones = [telefone]
  }


  // EXTRATOR_ESPECIFICO_SISREG
  // O PDF do SISREG vem em duas colunas; o texto extraído mistura rótulos como:
  // "Nome: Nome Social / Apelido:" e "Tipo Logradouro: Logradouro:".
  // Este bloco corrige os principais campos quando esse layout for identificado.
  if (/CONSULTA AO CADASTRO DE PACIENTES SUS/i.test(joined)) {
    const readSisreg = (regex: RegExp) => normalizeSpaces(joined.match(regex)?.[1] ?? "")

    const sisregCns = readSisreg(/CNS:\s*\n\s*(\d{15})/i)
    if (sisregCns) fields.cns = sisregCns

    const sisregCpf = readSisreg(/CPF:\s*\n\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i)
    if (sisregCpf) fields.cpf = formatCpf(sisregCpf)

    const sisregNome = readSisreg(/Nome:\s*Nome Social\s*\/\s*Apelido:\s*\n([^\n]+)/i)
    if (sisregNome) {
      fields.nome = sisregNome.replace(/\s+---.*$/i, "").toUpperCase()
    }

    const sisregNascimento = readSisreg(/Data de Nascimento:\s*Tipo Sanguíneo:\s*\n\s*(\d{2}\/\d{2}\/\d{4})/i)
    if (sisregNascimento) fields.dataNascimento = formatDateForInput(sisregNascimento)

    const sisregEndereco = readSisreg(/Tipo Logradouro:\s*Logradouro:\s*\n([^\n]+)/i)
    if (sisregEndereco) fields.endereco = sisregEndereco.toUpperCase()

    const sisregComplementoNumero = readSisreg(/Complemento:\s*N[úu]mero:\s*\n([^\n]+)/i)
    if (sisregComplementoNumero) {
      const numeroMatch = sisregComplementoNumero.match(/\b(\d+[A-Z]?)$/i)
      if (numeroMatch) {
        fields.numero = numeroMatch[1].toUpperCase()
        const complementoLimpo = sisregComplementoNumero.replace(new RegExp("\\s*" + numeroMatch[1] + "$", "i"), "").trim()
        if (complementoLimpo) fields.complemento = complementoLimpo.toUpperCase()
      } else {
        fields.complemento = sisregComplementoNumero.toUpperCase()
      }
    }

    const sisregBairroCep = readSisreg(/Bairro:\s*CEP:\s*\n([^\n]+)/i)
    if (sisregBairroCep) {
      const cepMatch = sisregBairroCep.match(/\d{5}-?\d{3}/)
      if (cepMatch) fields.cep = formatCep(cepMatch[0])

      const bairroLimpo = sisregBairroCep.replace(/\d{5}-?\d{3}.*/g, "").trim()
      if (bairroLimpo) fields.bairro = bairroLimpo.toUpperCase()
    }

    const sisregCidade = readSisreg(/País de Residência:\s*Município de Residência:\s*\n(?:BRASIL\s+)?([^\n]+)/i)
    if (sisregCidade) fields.cidade = normalizeCity(sisregCidade).toUpperCase()

    const sisregTelefone = joined.match(/CELULAR\s*\(?(\d{2})\)?\s*(9?\d{4})[-\s]?(\d{4})/i)
    if (sisregTelefone) {
      const telefoneFormatado = formatPhone(sisregTelefone[1], `${sisregTelefone[2]}${sisregTelefone[3]}`)
      if (telefoneFormatado) {
        fields.telefone = telefoneFormatado
        fields.telefones = [telefoneFormatado]
      }
    }
  }

  return fields
}

async function loadPdfParse() {
  ensurePdfParseNodePolyfills()

  const pdfModule = runtimeRequire("pdf-parse")
  return (pdfModule as any).default || pdfModule
}

async function extractPdfText(buffer: Buffer) {
  const pdfParse = await loadPdfParse()
  const parsed = await pdfParse(buffer)
  return String(parsed?.text ?? "")
}

async function extractImageText(buffer: Buffer) {
  const tesseract = await import("tesseract.js")
  const recognize = (tesseract as any).recognize || (tesseract as any).default?.recognize

  if (typeof recognize !== "function") {
    throw new Error("Mecanismo OCR não disponível no servidor.")
  }

  const languages = ["por+eng", "por", "eng"]
  let lastError: unknown = null

  for (const language of languages) {
    try {
      const result = await recognize(buffer, language)
      const text = String(result?.data?.text ?? "")
      if (text.trim()) return text
    } catch (error) {
      lastError = error
      console.error(`[OCR paciente] falha com idioma ${language}:`, error)
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  return ""
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Envie uma imagem ou PDF do paciente." },
        { status: 400 },
      )
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: "Arquivo muito grande. Envie arquivo de até 10 MB." },
        { status: 400 },
      )
    }

    const mime = String(file.type || "").toLowerCase()
    const name = String(file.name || "").toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())

    let rawText = ""

    try {
      if (mime.includes("pdf") || name.endsWith(".pdf")) {
        rawText = await extractPdfText(buffer)
      } else if (
        mime.startsWith("image/") ||
        /\.(png|jpg|jpeg|webp)$/i.test(name)
      ) {
        rawText = await extractImageText(buffer)
      } else {
        return NextResponse.json(
          { ok: false, error: "Formato não suportado. Envie PNG, JPG, JPEG, WEBP ou PDF." },
          { status: 400 },
        )
      }
    } catch (readError) {
      console.error("[POST /api/pacientes/extrair-documento] falha na leitura:", readError)

      return NextResponse.json(
        {
          ok: false,
          error:
            "Não foi possível extrair texto do arquivo. Se for PDF escaneado, envie uma imagem/print nítido da tela. Se for PDF, confirme se o texto pode ser selecionado.",
          detail:
            readError instanceof Error ? readError.message : "Falha desconhecida na leitura.",
        },
        { status: 422 },
      )
    }

    if (false) {
      return NextResponse.json(
        { ok: false, error: "Formato não suportado. Envie PNG, JPG, JPEG, WEBP ou PDF." },
        { status: 400 },
      )
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Não foi possível ler texto do arquivo. Se for PDF escaneado, envie uma imagem/print nítido da tela.",
        },
        { status: 422 },
      )
    }

    const fields = extractPatientFields(rawText)

    return NextResponse.json({
      ok: true,
      fields,
      found: Object.fromEntries(
        Object.entries(fields).filter(([key, value]) => key !== "rawText" && Boolean(value)),
      ),
    })
  } catch (error) {
    console.error("[POST /api/pacientes/extrair-documento] erro:", error)

    return NextResponse.json(
      {
        ok: false,
        error:
          "Erro ao ler o arquivo. Verifique se a imagem está nítida ou se o PDF possui texto selecionável.",
      },
      { status: 500 },
    )
  }
}
