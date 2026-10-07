$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Name = 'com.ulanzi.ulanzistudio.jeycodex.ulanziPlugin'
$Source = Join-Path $Root "dist\$Name"
$Plugins = Join-Path $env:APPDATA 'Ulanzi\UlanziDeck\Plugins'
$Target = Join-Path $Plugins $Name

Push-Location $Root
try {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22+ nao encontrado.'
  }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm nao encontrado.'
  }
  if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw 'Codex CLI nao encontrado no PATH.'
  }

  Write-Host '==> Instalando dependencias' -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { throw 'npm install falhou.' }

  Write-Host '==> Gerando plugin minimalista' -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'build falhou.' }

  Write-Host '==> Instalando no Ulanzi Studio' -ForegroundColor Cyan
  New-Item $Plugins -ItemType Directory -Force | Out-Null
  Remove-Item $Target -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item $Source $Target -Recurse -Force

  Write-Host ''
  Write-Host 'INSTALADO.' -ForegroundColor Green
  Write-Host "Plugin: $Target"
  Write-Host ''
  Write-Host 'Feche COMPLETAMENTE o Ulanzi Studio, inclusive o icone da bandeja, e abra novamente.' -ForegroundColor Yellow
  Write-Host 'Depois procure por Codex Limits e arraste as 4 acoes para as teclas.'
} finally {
  Pop-Location
}
