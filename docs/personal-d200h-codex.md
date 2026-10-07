# Personal D200H Codex quota monitor (JEY + AMERICANO)

This fork uses the Ulanzi D200H primarily as a live Codex quota display.

## Accounts

The daemon queries two independent Codex homes:

- **JEY** — `~/.codex`
- **AMERICANO** — `~/.codex-americano`

Each home is queried directly through that profile's own `codex app-server`
(`account/rateLimits/read`). The four intended readings are:

- JEY 5H
- JEY 7D
- AMERICANO 5H
- AMERICANO 7D

The displayed percentage is **remaining quota**. The fill shrinks as the quota is
consumed. Reset time stays visible under the percentage.

## Windows install from this checkout

Open PowerShell in the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-jey-d200h.ps1
```

The script:

1. installs workspace dependencies;
2. builds shared/hooks/bridge;
3. bundles a self-contained Ulanzi plugin;
4. installs it into `%APPDATA%\Ulanzi\UlanziDeck\Plugins\`;
5. installs the personal daemon as a **loopback-only** Windows Scheduled Task;
6. performs a live quota probe.

Fully close Ulanzi Studio (including its tray process) and reopen it after the
script finishes.

## Configure AMERICANO

JEY can continue using the normal Codex login in `~/.codex`.

To add the second account without replacing JEY:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\login-codex-americano.ps1
```

That launches `codex login` with `CODEX_HOME=~/.codex-americano`. Once the
login succeeds, the daemon discovers AMERICANO automatically within 30 seconds.

## Check quotas without the D200H

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-codex-quotas.ps1
```

This asks both configured accounts live and prints their 5H/7D remaining
percentage plus reset instants.

## Refresh behavior

- automatic live refresh: **30 seconds**;
- pressing a usage gauge: **immediate refresh**;
- a missing `auth.json`: that account is not rendered;
- failed live reads are not replaced by an anonymous/default Codex account.

## Optional custom homes

`~/.agentdeck/settings.json` can override the profile paths:

```json
{
  "codexAccounts": [
    { "id": "jey", "label": "JEY", "home": "~/.codex" },
    { "id": "americano", "label": "AMERICANO", "home": "~/.codex-americano" }
  ]
}
```

The labels are intentionally short and rendered in the top-right of each gauge.
