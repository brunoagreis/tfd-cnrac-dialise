const fs = require("fs");

function moj(hex) {
  return Buffer.from(hex.match(/../g).map((h) => parseInt(h, 16))).toString("latin1");
}

const replacements = [
  ["c381", "\u00c1"], ["c380", "\u00c0"], ["c382", "\u00c2"], ["c383", "\u00c3"],
  ["c387", "\u00c7"], ["c389", "\u00c9"], ["c38a", "\u00ca"], ["c38d", "\u00cd"],
  ["c393", "\u00d3"], ["c394", "\u00d4"], ["c395", "\u00d5"], ["c39a", "\u00da"],
  ["c3a1", "\u00e1"], ["c3a0", "\u00e0"], ["c3a2", "\u00e2"], ["c3a3", "\u00e3"],
  ["c3a7", "\u00e7"], ["c3a9", "\u00e9"], ["c3aa", "\u00ea"], ["c3ad", "\u00ed"],
  ["c3b3", "\u00f3"], ["c3b4", "\u00f4"], ["c3b5", "\u00f5"], ["c3ba", "\u00fa"]
];

function fixMojibake(path) {
  if (!fs.existsSync(path)) return;
  let text = fs.readFileSync(path, "utf8");
  for (const [hex, good] of replacements) {
    text = text.split(moj(hex)).join(good);
  }
  fs.writeFileSync(path, text, "utf8");
}

fixMojibake("components/modules/judicial-case-detail.tsx");
fixMojibake("components/modules/email-os-panel.tsx");
fixMojibake("app/api/email-os/route.ts");

let panelPath = "components/modules/email-os-panel.tsx";
let panel = fs.readFileSync(panelPath, "utf8");

panel = panel.replace(
  /function isAdmin\(user: any\) \{[\s\S]*?\n\}/,
  `function isAdmin(user: any) {
  const role = String(user?.role || user?.perfil || user?.tipo || user?.nivel || "").toUpperCase()
  return role.includes("ADMIN") || role.includes("ADMINISTRADOR") || user?.isAdmin === true
}`
);

if (!panel.includes("async function inativarOs")) {
  panel = panel.replace(
    /(\s*)async function transfer\(os: any\) \{/,
    `$1async function inativarOs(os: any) {
$1  if (!isAdmin(user)) return toast.error("Somente administrador pode inativar OS.")
$1  if (!confirm(\`Inativar a OS \${os.protocolo || os.id}? Ela deixara de aparecer para todos.\`)) return
$1  const response = await fetch("/api/email-os", {
$1    method: "POST",
$1    headers: { "Content-Type": "application/json" },
$1    body: JSON.stringify({ action: "inativar", id: os.id, osId: os.id, user }),
$1  })
$1  const json = await response.json().catch(() => ({}))
$1  if (!response.ok || !json?.ok) return toast.error(json?.error || "Erro ao inativar OS.")
$1  toast.success("OS inativada.")
$1  await load()
$1}

$1async function transfer(os: any) {`
  );
}

panel = panel.replace("md:grid-cols-[180px_1fr_auto_auto]", "md:grid-cols-[180px_1fr_auto_auto_auto]");

if (!panel.includes("Inativar OS")) {
  panel = panel.replace(
    /<Button type="button" onClick=\{\(\) => setRegisteringOs\(os\)\}>Cadastrar[^<]*<\/Button>/,
    `{isAdmin(user) ? <Button type="button" variant="destructive" onClick={() => inativarOs(os)}>Inativar OS</Button> : null}$&`
  );
}

fs.writeFileSync(panelPath, panel, "utf8");

let apiPath = "app/api/email-os/route.ts";
let api = fs.readFileSync(apiPath, "utf8");

api = api.replace(
  "WHERE COALESCE(status, 'AGUARDANDO_CADASTRO') <> 'CONVERTIDA'",
  "WHERE COALESCE(status, 'AGUARDANDO_CADASTRO') NOT IN ('CONVERTIDA', 'INATIVA')"
);

if (!api.includes('action === "inativar"')) {
  api = api.replace(
    "const body = await req.json().catch(() => ({}))",
    `const body = await req.json().catch(() => ({}))
    const action = String(body?.action || "").trim().toLowerCase()

    if (action === "inativar") {
      const user = body?.user || {}
      const role = String(user?.role || user?.perfil || user?.tipo || user?.nivel || "").toUpperCase()
      const isAdmin = role.includes("ADMIN") || role.includes("ADMINISTRADOR") || user?.isAdmin === true

      if (!isAdmin) {
        return NextResponse.json({ ok: false, error: "Somente administrador pode inativar OS." }, { status: 403 })
      }

      const id = String(body?.id || body?.osId || "").trim()
      if (!id) {
        return NextResponse.json({ ok: false, error: "ID da OS obrigatorio." }, { status: 400 })
      }

      await prisma.$executeRawUnsafe("UPDATE public.judicial_email_os SET status = 'INATIVA' WHERE id::text = $1", id)
      return NextResponse.json({ ok: true })
    }`
  );
}

fs.writeFileSync(apiPath, api, "utf8");

console.log("Correcoes aplicadas.");
