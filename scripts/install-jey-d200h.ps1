param(
  [switch]$SkipDeps,
  [switch]$SkipDaemonInstall,
  [switch]$NoPluginCopy
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
$PluginName = 'com.ulanzi.ulanzistudio.agentdeck.ulanziPlugin'
$PluginRoot = Join-Path $Root 'plugin-ulanzi'
$PluginSource = Join-Path $PluginRoot $PluginName
$PluginOut = Join-Path (Join-Path $PluginRoot 'dist') $PluginName
$StudioPlugins = Join-Path $env:APPDATA 'Ulanzi\UlanziDeck\Plugins'
$StudioPluginTarget = Join-Path $StudioPlugins $PluginName

function Step([string]$Message) {
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name not found. $Hint"
  }
}

function Run([string]$Command, [string[]]$Args) {
  & $Command @Args
  if ($LASTEXITCODE -ne 0) {
    throw "$Command failed with exit code $LASTEXITCODE"
  }
}

Write-Host ''
Write-Host '=========================================' -ForegroundColor DarkCyan
Write-Host '  JEY D200H Codex Monitor - Installer' -ForegroundColor White
Write-Host '=========================================' -ForegroundColor DarkCyan

Require-Command 'node' 'Install Node.js 22, 24 or 26.'
Require-Command 'pnpm' 'Install it with: npm install -g pnpm'
Require-Command 'npm' 'npm is bundled with Node.js.'
Require-Command 'codex' 'Install the Codex CLI first.'

Push-Location $Root
try {
  if (-not $SkipDeps) {
    Step 'Installing workspace dependencies'
    Run 'pnpm' @('install', '--frozen-lockfile')
  }

  Step 'Building shared, hooks and personal daemon'
  Run 'pnpm' @('--filter', '@agentdeck/shared', 'build')
  Run 'pnpm' @('--filter', '@agentdeck/hooks', 'build')
  Run 'pnpm' @('--filter', '@agentdeck/bridge', 'build')

  Step 'Building self-contained Ulanzi plugin'
  if (Test-Path $PluginOut) {
    Remove-Item $PluginOut -Recurse -Force
  }
  New-Item (Join-Path $PluginOut 'plugin') -ItemType Directory -Force | Out-Null
  New-Item (Join-Path $PluginOut 'resources') -ItemType Directory -Force | Out-Null

  $BundleOut = Join-Path (Join-Path $PluginOut 'plugin') 'app.js'
  Run 'pnpm' @(
    'dlx', 'esbuild@0.28.2',
    (Join-Path $PluginRoot 'src\app.ts'),
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node20',
    '--external:ws',
    "--outfile=$BundleOut",
    '--log-level=warning'
  )
  Set-Content -Path (Join-Path (Join-Path $PluginOut 'plugin') 'package.json') -Value '{ "type": "module" }' -Encoding utf8

  Copy-Item (Join-Path $PluginSource 'manifest.json') $PluginOut -Force
  Get-ChildItem $PluginSource -Filter '*.json' -File |
    Where-Object { $_.Name -ne 'manifest.json' } |
    ForEach-Object { Copy-Item $_.FullName (Join-Path $PluginOut $_.Name) -Force }

  Copy-Item (Join-Path $PluginSource 'resources\*') (Join-Path $PluginOut 'resources') -Recurse -Force
  foreach ($extra in @('property-inspector', 'libs')) {
    $src = Join-Path $PluginSource $extra
    if (Test-Path $src) {
      Copy-Item $src (Join-Path $PluginOut $extra) -Recurse -Force
    }
  }

  $runtime = Join-Path $env:TEMP ("agentdeck-ulanzi-runtime-" + [guid]::NewGuid().ToString('N'))
  New-Item $runtime -ItemType Directory -Force | Out-Null
  try {
    @{
      name = 'agentdeck-ulanzi-runtime'
      private = $true
      dependencies = @{
        '@resvg/resvg-wasm' = '2.6.2'
        'ws' = '^8.20.0'
      }
    } | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $runtime 'package.json') -Encoding utf8

    Push-Location $runtime
    try {
      Run 'npm' @('install', '--omit=dev', '--no-audit', '--no-fund', '--silent')
    } finally {
      Pop-Location
    }

    Copy-Item (Join-Path $runtime 'node_modules\@resvg\resvg-wasm\index_bg.wasm') (Join-Path $PluginOut 'resources\resvg.wasm') -Force
    New-Item (Join-Path $PluginOut 'node_modules') -ItemType Directory -Force | Out-Null
    Copy-Item (Join-Path $runtime 'node_modules\ws') (Join-Path $PluginOut 'node_modules\ws') -Recurse -Force
  } finally {
    Remove-Item $runtime -Recurse -Force -ErrorAction SilentlyContinue
  }

  $required = @(
    'manifest.json',
    'plugin\app.js',
    'plugin\package.json',
    'resources\resvg.wasm',
    'resources\fonts\IBMPlexSans-Regular.ttf',
    'resources\fonts\IBMPlexSans-Bold.ttf',
    'resources\fonts\JetBrainsMono-Regular.ttf',
    'resources\fonts\JetBrainsMono-Bold.ttf',
    'node_modules\ws'
  )
  foreach ($item in $required) {
    if (-not (Test-Path (Join-Path $PluginOut $item))) {
      throw "Packaged plugin is missing: $item"
    }
  }

  $native = Get-ChildItem $PluginOut -Recurse -File |
    Where-Object { $_.Extension -in @('.node', '.dll', '.so', '.dylib') }
  if ($native) {
    throw "Unexpected native binary in plugin package: $($native.FullName -join ', ')"
  }

  if (-not $NoPluginCopy) {
    Step 'Installing custom plugin into Ulanzi Studio'
    New-Item $StudioPlugins -ItemType Directory -Force | Out-Null
    if (Test-Path $StudioPluginTarget) {
      Remove-Item $StudioPluginTarget -Recurse -Force
    }
    Copy-Item $PluginOut $StudioPluginTarget -Recurse -Force
    Write-Host "Installed: $StudioPluginTarget" -ForegroundColor Green
  }

  if (-not $SkipDaemonInstall) {
    Step 'Installing personal daemon as a loopback-only Windows Scheduled Task'
    Run 'node' @((Join-Path $Root 'bridge\dist\cli.js'), 'daemon', 'install', '--loopback')
  }

  Step 'Checking live Codex account quotas'
  $check = @"
import { refreshCodexAccountsUsage } from './bridge/dist/codex-account-usage.js';
const accounts = await refreshCodexAccountsUsage(true);
if (!accounts.length) {
  console.log('No configured Codex account auth.json was found.');
  process.exit(2);
}
for (const a of accounts) {
  const windows = [a.rateLimits.primary, a.rateLimits.secondary].filter(Boolean);
  const parts = windows.map(w => {
    const label = w.windowMinutes >= 1440 ? '7D' : '5H';
    const remaining = Math.max(0, Math.min(100, 100 - w.usedPercent));
    return `${label} ${Math.round(remaining)}% left`;
  });
  console.log(`${a.label}: ${parts.join(' | ') || 'no rolling-window quota returned'}`);
}
"@
  & node --input-type=module -e $check
  if ($LASTEXITCODE -notin @(0, 2)) {
    throw "Codex quota verification failed with exit code $LASTEXITCODE"
  }

  Write-Host ''
  Write-Host 'DONE.' -ForegroundColor Green
  Write-Host '1. Fully close Ulanzi Studio (including the tray icon) and reopen it.'
  Write-Host '2. Add four AgentDeck keys for JEY 5H/7D + AMERICANO 5H/7D.'
  Write-Host '3. If AMERICANO is not configured yet, run:'
  Write-Host '   powershell -ExecutionPolicy Bypass -File .\scripts\login-codex-americano.ps1' -ForegroundColor Yellow
  Write-Host '4. Gauges refresh automatically every 30s; press a gauge to refresh immediately.'
} finally {
  Pop-Location
}
