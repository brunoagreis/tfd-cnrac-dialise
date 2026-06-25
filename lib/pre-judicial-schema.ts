import { prisma } from "@/lib/prisma"

let ensured = false

export async function ensurePreJudicialSchema() {
  if (ensured) return
  ensured = true

  try {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public.pre_judicial_casos (id TEXT PRIMARY KEY, paciente_id TEXT, patient_name TEXT, cpf TEXT, municipality_name TEXT, origin_module TEXT, origin_protocol TEXT, protocol_number TEXT, active BOOLEAN DEFAULT TRUE, status TEXT DEFAULT 'ativo', priority INTEGER DEFAULT 100, received_at DATE, action_records TEXT, pge_net_number TEXT, deadline_days INTEGER, deadline_at TIMESTAMPTZ, deadline_warning_level TEXT, scheduling_status TEXT DEFAULT 'fora_fila', scheduling_requested_at TIMESTAMPTZ, scheduling_reserved_at TIMESTAMPTZ, scheduling_response_deadline_at TIMESTAMPTZ, appointment_date TIMESTAMPTZ, municipality_id TEXT, municipality_ibge TEXT, created_by TEXT, created_by_name TEXT, created_by_email TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS paciente_id TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS patient_name TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS cpf TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS municipality_name TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS origin_module TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS origin_protocol TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS protocol_number TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo'`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 100`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS received_at DATE`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS action_records TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS pge_net_number TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS deadline_days INTEGER`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS deadline_warning_level TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS scheduling_status TEXT DEFAULT 'fora_fila'`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS scheduling_requested_at TIMESTAMPTZ`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS scheduling_reserved_at TIMESTAMPTZ`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS scheduling_response_deadline_at TIMESTAMPTZ`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS appointment_date TIMESTAMPTZ`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS municipality_id TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS municipality_ibge TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS created_by TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS created_by_name TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS created_by_email TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_casos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public.pre_judicial_procedimentos (id TEXT PRIMARY KEY, caso_id TEXT, sigtap_code TEXT, description TEXT, specialty TEXT, sub_specialty TEXT, situation TEXT, active BOOLEAN DEFAULT TRUE, created_by TEXT, created_by_name TEXT, created_by_email TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS caso_id TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS sigtap_code TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS description TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS specialty TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS sub_specialty TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS situation TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS created_by TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS created_by_name TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS created_by_email TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_procedimentos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`)

    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS public.pre_judicial_cids (id TEXT PRIMARY KEY, caso_id TEXT, code TEXT, description TEXT, active BOOLEAN DEFAULT TRUE, created_by TEXT, created_by_name TEXT, created_by_email TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS caso_id TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS code TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS description TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS created_by TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS created_by_name TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS created_by_email TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`)
    await prisma.$executeRawUnsafe(`ALTER TABLE public.pre_judicial_cids ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`)
  } catch (error) {
    ensured = false
    console.error("[ensurePreJudicialSchema] erro:", error)
    throw error
  }
}
