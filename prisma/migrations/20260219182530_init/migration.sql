-- CreateEnum
CREATE TYPE "Module" AS ENUM ('tfd', 'cnrac', 'hemodialise');

-- CreateEnum
CREATE TYPE "CategoriaAnexo" AS ENUM ('pessoal', 'laudo', 'checklist', 'outros');

-- CreateEnum
CREATE TYPE "TipoSolicitacao" AS ENUM ('inclusao', 'substituicao', 'alta', 'outros');

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cartaoSus" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "municipio" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telefone_paciente" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "telefone_paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demandas" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "modulo" "Module" NOT NULL,
    "localSolicitante" TEXT NOT NULL,
    "emailSolicitante" TEXT NOT NULL,
    "acaoJudicial" BOOLEAN NOT NULL DEFAULT false,
    "codigoSigtap" TEXT NOT NULL,
    "descricaoSigtap" TEXT NOT NULL,
    "cid10" TEXT NOT NULL,
    "especialidade" TEXT NOT NULL,
    "subespecialidade" TEXT,
    "peso" TEXT,
    "altura" TEXT,
    "tipoSanguineo" TEXT,
    "observacoesUnidade" TEXT,
    "localSolicitado" TEXT,
    "tipoSolicitacao" "TipoSolicitacao",
    "criadoPor" TEXT,
    "criadoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demandas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telefone_solicitante" (
    "id" TEXT NOT NULL,
    "demandaId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "telefone_solicitante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexos" (
    "id" TEXT NOT NULL,
    "demandaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "categoria" "CategoriaAnexo" NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoPor" TEXT,
    "criadoPorNome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "modulo" "Module" NOT NULL,
    "mensagem" TEXT NOT NULL,
    "destinatarioId" TEXT NOT NULL,
    "pacienteNome" TEXT,
    "demandaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_cpf_key" ON "pacientes"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "demandas_protocolo_key" ON "demandas"("protocolo");

-- CreateIndex
CREATE INDEX "notificacoes_protocolo_idx" ON "notificacoes"("protocolo");

-- AddForeignKey
ALTER TABLE "telefone_paciente" ADD CONSTRAINT "telefone_paciente_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demandas" ADD CONSTRAINT "demandas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telefone_solicitante" ADD CONSTRAINT "telefone_solicitante_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "demandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "demandas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_demandaId_fkey" FOREIGN KEY ("demandaId") REFERENCES "demandas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
