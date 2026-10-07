param(
  [string]$Home = (Join-Path $HOME '.codex-americano')
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  throw 'codex CLI not found on PATH.'
}

New-Item $Home -ItemType Directory -Force | Out-Null
$env:CODEX_HOME = (Resolve-Path $Home).Path

Write-Host "AMERICANO CODEX_HOME: $env:CODEX_HOME" -ForegroundColor Cyan
Write-Host 'Opening Codex login for the AMERICANO account...' -ForegroundColor White
Write-Host 'This does not replace the JEY login in ~/.codex.' -ForegroundColor DarkGray

& codex login
if ($LASTEXITCODE -ne 0) {
  throw "codex login failed with exit code $LASTEXITCODE"
}

$auth = Join-Path $env:CODEX_HOME 'auth.json'
if (Test-Path $auth) {
  Write-Host ''
  Write-Host 'AMERICANO configured successfully.' -ForegroundColor Green
  Write-Host "Auth file: $auth"
  Write-Host 'The D200H daemon will pick it up automatically on the next refresh (<= 30s).'
} else {
  Write-Warning "Login command finished but $auth was not created."
}
