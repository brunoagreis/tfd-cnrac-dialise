import fs from "node:fs/promises";
import path from "node:path";
import { refreshFinanciamentoIndicadoresJob } from "./src/local-refresh/reports/financiamento/refresh-financiamento-indicadores.js";
import { readConectaCredentials } from "./src/credentials/read-conecta-credentials.js";

const rootDir = process.cwd();
const config = JSON.parse(await fs.readFile(path.join(rootDir, "agent.config.json"), "utf8"));
const conectaCredentials = await readConectaCredentials({ required: true });

config.conectaCredentials = conectaCredentials;
config.adminDatabase = conectaCredentials.adminDatabase;
config.localDatabase = conectaCredentials.localDatabase;
config.localSchemaVersion = conectaCredentials.schemaVersion;
config.requiresReprovision = conectaCredentials.requiresReprovision;

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function cleanValue(line = "") {
  const idx = String(line).indexOf(":");
  return idx === -1 ? String(line).trim() : String(line).slice(idx + 1).trim();
}

async function readCredentialBlock(esusConfig = {}) {
  const configDir = String(esusConfig.configDir || "").trim();
  const credentialFileName = String(esusConfig.credentialFileName || "credenciais.txt").trim() || "credenciais.txt";

  if (!configDir) {
    throw new Error("Diretório do e-SUS não configurado em agent.config.json.");
  }

  const filePath = path.join(configDir, credentialFileName);
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  for (let i = 0; i < lines.length - 2; i += 1) {
    const header = normalizeText(lines[i]);
    const userLine = normalizeText(lines[i + 1]);
    const passwordLine = normalizeText(lines[i + 2]);

    if (header === "usuario com acesso de leitura" && userLine.startsWith("usuario:") && passwordLine.startsWith("senha:")) {
      return {
        user: cleanValue(lines[i + 1]),
        password: cleanValue(lines[i + 2]),
        filePath,
      };
    }
  }

  throw new Error(`Bloco de credenciais de leitura não encontrado em ${filePath}`);
}

function getConfiguredDatabase(config = {}) {
  return {
    host: config.esus?.dbHost || config.database?.host || "localhost",
    port: Number(config.esus?.dbPort || config.database?.port || 5432),
    database: config.esus?.dbName || config.database?.database || "esus",
    user: String(config.database?.user || "").trim(),
    password: String(config.database?.password || "").trim(),
    ssl: Boolean(config.database?.ssl || false),
  };
}

function buildConnection(config, credentialBlock) {
  return {
    host: config.esus?.dbHost || config.database?.host || "localhost",
    port: Number(config.esus?.dbPort || config.database?.port || 5432),
    database: config.esus?.dbName || config.database?.database || "esus",
    user: credentialBlock.user,
    password: credentialBlock.password,
    ssl: Boolean(config.database?.ssl || false),
  };
}

function buildLocalConnection(config = {}) {
  if (!config.localDatabase) {
    throw new Error("Banco local não configurado no credencialconecta.txt.");
  }

  return {
    host: config.localDatabase.host || "localhost",
    port: Number(config.localDatabase.port || 5432),
    database: config.localDatabase.database || "conectaaps_local",
    user: config.localDatabase.user || "conectaaps_app",
    password: config.localDatabase.password || "",
    ssl: Boolean(config.localDatabase.ssl || false),
  };
}

const configuredDatabase = getConfiguredDatabase(config);
const shouldReadCredentialFile = !configuredDatabase.user || !configuredDatabase.password;

const credentialBlock = shouldReadCredentialFile
  ? await readCredentialBlock(config.esus || {})
  : {
      user: configuredDatabase.user,
      password: configuredDatabase.password,
      filePath: "agent_config",
    };

const connection = buildConnection(config, credentialBlock);
const localConnection = buildLocalConnection(config);

process.env.CONECTAAPS_REFRESH_CODES = "ESTADIAMENTO_DRC,RELATORIO_ESTADIAMENTO_DRC_V1";
process.env.CONECTAAPS_REFRESH_ONLY = "ESTADIAMENTO_DRC,RELATORIO_ESTADIAMENTO_DRC_V1";
process.env.CONECTAAPS_SQL_TIMEOUT_MS = "900000";

const log = async (message, extra = null) => {
  const line = `[${new Date().toISOString()}] [INFO] ${message}${extra ? ` ${JSON.stringify(extra)}` : ""}`;
  console.log(line);
};

console.log("=== Atualização manual somente do Estadiamento DRC ===");
console.log(JSON.stringify({
  esusDatabase: `${connection.host}:${connection.port}/${connection.database}`,
  localDatabase: `${localConnection.host}:${localConnection.port}/${localConnection.database}`,
  refreshOnly: process.env.CONECTAAPS_REFRESH_ONLY,
}, null, 2));

const result = await refreshFinanciamentoIndicadoresJob.execute(config, {
  log,
  connection,
  localConnection,
});

console.log("=== Resultado ===");
console.log(JSON.stringify(result, null, 2));
