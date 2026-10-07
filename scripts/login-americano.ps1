param(
  [string]$Home = (Join-Path $HOME '.codex-americano')
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  throw 'Codex CLI nao encontrado no PATH.'
}

New-Item $Home -ItemType Directory -Force | Out-Null
$env:CODEX_HOME = (Resolve-Path $Home).Path

Write-Host "CODEX_HOME AMERICANO: $env:CODEX_HOME" -ForegroundColor Cyan
Write-Host 'Faca login com a conta AMERICANO. O login JEY em ~/.codex nao sera alterado.' -ForegroundColor Yellow

codex login
if ($LASTEXITCODE -ne 0) {
  throw "codex login falhou com codigo $LASTEXITCODE"
}

if (Test-Path (Join-Path $env:CODEX_HOME 'auth.json')) {
  Write-Host 'AMERICANO configurado. O D200H atualiza em ate 30 segundos.' -ForegroundColor Green
} else {
  Write-Warning 'O login terminou, mas auth.json nao foi encontrado.'
}
