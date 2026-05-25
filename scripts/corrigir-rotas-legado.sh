#!/usr/bin/env bash
set -euo pipefail

echo '== Limpando rotas legadas conflitantes do App Router =='

for path in app/minha-conta app/permissoes app/unidades app/usuarios; do
  if [ -e "$path" ]; then
    rm -rf "$path"
    echo "Removido: $path"
  else
    echo "Nao existe: $path"
  fi
done

if [ -d .next ]; then
  rm -rf .next
  echo 'Cache .next removido.'
fi

echo 'Concluido. Agora rode novamente o projeto.'
