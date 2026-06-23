"use client"

const placeholdersText = `Placeholders disponíveis

Dados pessoais do paciente:
$nome_paciente, $paciente_nome, $requerente, $cpf, $paciente_cpf, $cns, $paciente_cns, $cartao_sus, $telefone_paciente, $paciente_telefone, $email_paciente, $paciente_email, $data_nascimento, $nascimento_paciente, $endereco_paciente.

Comuns a todos os módulos:
$protocolo, $modulo, $municipio, $municipio_paciente, $local_solicitante, $email_solicitante, $telefone_solicitante, $local_solicitado, $tipo_solicitacao, $observacoes, $observacoes_unidade, $user_sistema.

Dados clínicos/procedimento:
$sigtap, $codigo_sigtap, $sigtap_descricao, $descricao_sigtap, $procedimento, $procedimento_sigtap, $cid, $cid10, $especialidade, $subespecialidade, $peso, $altura, $tipo_sanguineo.

TFD:
$protocolo_tfd, $origem, $destino, $tipo_solicitacao, $data_agendamento.

CNRAC:
$protocolo_cnrac, $procedimento_cnrac, $cid_cnrac, $ficha_core, $origem, $destino.

Hemodiálise:
$protocolo_hemodialise, $peso, $altura, $tipo_sanguineo, $origem, $destino.

Judicial:
$protocolo_judicial, $numero_processo, $autos_acao, $processo, $pge_net, $numero_pge_net, $numero_oficio, $oficio, $tipo_intimacao, $data_recebimento, $data_reiteracao, $prazo_dias, $prazo_final.

Pré Judicial:
$protocolo_prejudicial, $data_agendamento, $numero_processo, $pge_net, $prazo_dias, $prazo_final.`

function cssString(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\A ")
}

export function JudicialEmailPlaceholdersStyle() {
  const content = cssString(placeholdersText)

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .admin-judicial-page .border-border:has(select option[value="demanda_judicial_cadastrada"]) .pb-3 .text-muted-foreground {
            display: none !important;
          }

          .admin-judicial-page .border-border:has(select option[value="demanda_judicial_cadastrada"]) .rounded-lg.border.border-dashed.border-border.p-3.text-xs.text-muted-foreground {
            font-size: 0 !important;
            color: transparent !important;
            background: hsl(var(--muted) / 0.35);
            border-style: dashed;
            max-height: 260px;
            overflow: auto;
          }

          .admin-judicial-page .border-border:has(select option[value="demanda_judicial_cadastrada"]) .rounded-lg.border.border-dashed.border-border.p-3.text-xs.text-muted-foreground::before {
            content: "${content}";
            display: block;
            white-space: pre-wrap;
            font-size: 12px;
            line-height: 1.55;
            color: hsl(var(--foreground));
          }
        `,
      }}
    />
  )
}
