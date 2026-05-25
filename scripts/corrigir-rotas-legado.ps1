$ErrorActionPreference = 'Stop'

Write-Host '== Limpando rotas legadas conflitantes do App Router ==' -ForegroundColor Cyan

$paths = @(
  'app/minha-conta',
  'app/permissoes',
  'app/unidades',
  'app/usuarios'
)

foreach ($path in $paths) {
  if (Test-Path $path) {
    Remove-Item $path -Recurse -Force
    Write-Host "Removido: $path" -ForegroundColor Yellow
  } else {
    Write-Host "Nao existe: $path" -ForegroundColor DarkGray
  }
}

if (Test-Path '.next') {
  Remove-Item '.next' -Recurse -Force
  Write-Host 'Cache .next removido.' -ForegroundColor Yellow
}

Write-Host 'Concluido. Agora rode novamente o projeto.' -ForegroundColor Green
