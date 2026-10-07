$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Module = Join-Path $Root 'bridge\dist\codex-account-usage.js'

if (-not (Test-Path $Module)) {
  throw 'Personal daemon is not built yet. Run scripts\install-jey-d200h.ps1 first.'
}

Push-Location $Root
try {
  $code = @"
import { refreshCodexAccountsUsage } from './bridge/dist/codex-account-usage.js';
const accounts = await refreshCodexAccountsUsage(true);
if (!accounts.length) {
  console.log('No account found. Expected JEY at ~/.codex and AMERICANO at ~/.codex-americano.');
  process.exit(2);
}
for (const a of accounts) {
  const rows = [a.rateLimits.primary, a.rateLimits.secondary]
    .filter(Boolean)
    .sort((x, y) => x.windowMinutes - y.windowMinutes);
  console.log(a.label);
  for (const w of rows) {
    const name = w.windowMinutes >= 1440 ? '7D' : '5H';
    const left = Math.max(0, Math.min(100, 100 - w.usedPercent));
    const reset = w.resetsAt ?? 'unknown reset';
    console.log(`  ${name}: ${Math.round(left)}% left | reset ${reset}`);
  }
}
"@
  & node --input-type=module -e $code
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
