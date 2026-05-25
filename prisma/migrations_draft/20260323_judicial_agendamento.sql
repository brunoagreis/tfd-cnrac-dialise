-- Draft inicial de migração dos módulos Judicial + Pré Judicial + Agendamento da Demanda
-- Objetivo: criar base relacional mínima para substituir o fake/localStorage

CREATE TABLE IF NOT EXISTS judicial_cases (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL,
  origem_modulo TEXT NOT NULL,
  origem_protocolo TEXT NOT NULL,
  numero_processo TEXT NOT NULL UNIQUE,
  municipio_residencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  monitoring_mode TEXT NOT NULL DEFAULT 'HUMANO',
  monitoring_mode_reason TEXT,
  scheduling_status TEXT NOT NULL DEFAULT 'FORA_FILA',
  scheduling_requested_at TIMESTAMP,
  scheduling_reserved_at TIMESTAMP,
  appointment_date TIMESTAMP,
  appointment_confirmed_at TIMESTAMP,
  last_monitored_at TIMESTAMP,
  priority INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS judicial_procedures (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES judicial_cases(id) ON DELETE CASCADE,
  sigtap_code TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS judicial_cids (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES judicial_cases(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS judicial_fichas (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES judicial_cases(id) ON DELETE CASCADE,
  system_name TEXT NOT NULL,
  number_value TEXT,
  requested_inclusion BOOLEAN NOT NULL DEFAULT FALSE,
  has_judicial_mark BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_name TEXT,
  notes TEXT NOT NULL,
  included_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS judicial_movements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES judicial_cases(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  appointment_date TIMESTAMP,
  state_amount NUMERIC(14,2),
  municipality_amount NUMERIC(14,2),
  response_requested_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT,
  created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS municipality_manifestations (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES judicial_cases(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT,
  created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS judicial_attachments (
  id TEXT PRIMARY KEY,
  judicial_movement_id TEXT REFERENCES judicial_movements(id) ON DELETE CASCADE,
  municipality_manifestation_id TEXT REFERENCES municipality_manifestations(id) ON DELETE CASCADE,
  case_id TEXT REFERENCES judicial_cases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT,
  created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS pre_judicial_cases (
  id TEXT PRIMARY KEY,
  paciente_id TEXT NOT NULL,
  origem_modulo TEXT NOT NULL,
  origem_protocolo TEXT NOT NULL,
  numero_protocolo TEXT NOT NULL UNIQUE,
  municipio_residencia TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ATIVO',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 50,
  deadline_at TIMESTAMP NOT NULL,
  scheduling_status TEXT NOT NULL DEFAULT 'FORA_FILA',
  scheduling_requested_at TIMESTAMP,
  scheduling_reserved_at TIMESTAMP,
  scheduling_response_deadline_at TIMESTAMP,
  appointment_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pre_judicial_procedures (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES pre_judicial_cases(id) ON DELETE CASCADE,
  sigtap_code TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS pre_judicial_cids (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES pre_judicial_cases(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS pre_judicial_movements (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES pre_judicial_cases(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL,
  description TEXT NOT NULL,
  due_at TIMESTAMP,
  appointment_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT,
  created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS pre_judicial_attachments (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES pre_judicial_cases(id) ON DELETE CASCADE,
  movement_id TEXT REFERENCES pre_judicial_movements(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_id TEXT,
  created_by_name TEXT
);

CREATE TABLE IF NOT EXISTS municipality_contacts (
  id TEXT PRIMARY KEY,
  municipality_name TEXT NOT NULL UNIQUE,
  emails_json JSONB NOT NULL,
  phones_json JSONB NOT NULL,
  contacts_json JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS judicial_email_templates (
  id TEXT PRIMARY KEY,
  template_type TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS core_import_rows (
  id TEXT PRIMARY KEY,
  table_type TEXT NOT NULL,
  ficha_number TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  cpf TEXT,
  appointment_date TIMESTAMP,
  procedure_code TEXT,
  procedure_description TEXT,
  status_text TEXT NOT NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS judicial_core_history (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES judicial_cases(id) ON DELETE CASCADE,
  table_type TEXT NOT NULL,
  ficha_number TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  appointment_date TIMESTAMP,
  procedure_code TEXT,
  procedure_description TEXT,
  status_text TEXT NOT NULL,
  imported_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS agenda_offers (
  id TEXT PRIMARY KEY,
  specialty TEXT NOT NULL,
  sub_specialty TEXT,
  procedure_code TEXT,
  procedure_description TEXT,
  cid_code TEXT,
  agenda_date TIMESTAMP NOT NULL,
  seats INTEGER NOT NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS judicial_audit_events (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  user_id TEXT,
  user_name TEXT,
  action_name TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pre_judicial_audit_events (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  user_id TEXT,
  user_name TEXT,
  action_name TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
