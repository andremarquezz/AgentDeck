import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const REQUEST_ID = 2;
const TIMEOUT_MS = 7000;

export const ACCOUNTS = [
  { id: 'jey', label: 'JEY', home: path.join(os.homedir(), '.codex-jey') },
  { id: 'americano', label: 'AMERICANO', home: path.join(os.homedir(), '.codex-americano') },
];

function isScoped(limit) {
  return typeof limit?.limitName === 'string' && limit.limitName.trim().length > 0;
}

function rawWindowMinutes(win) {
  if (!win) return undefined;
  if (typeof win.windowDurationMins === 'number') return win.windowDurationMins;
  if (typeof win.windowMinutes === 'number') return win.windowMinutes;
  return undefined;
}

function hasWindow(limit) {
  return [limit?.primary, limit?.secondary].some((win) => typeof rawWindowMinutes(win) === 'number');
}

function pickAccountWide(result) {
  const top = result?.rateLimits;
  if (top && !isScoped(top) && hasWindow(top)) return top;

  const values = Object.values(result?.rateLimitsByLimitId ?? {});
  const withWindows = values.find((limit) => limit && !isScoped(limit) && hasWindow(limit));
  if (withWindows) return withWindows;

  return values.find((limit) => limit && !isScoped(limit)) ?? null;
}

function normalizeWindow(raw) {
  if (!raw || typeof raw.usedPercent !== 'number') return null;
  const windowMinutes = rawWindowMinutes(raw);
  if (typeof windowMinutes !== 'number') return null;

  return {
    usedPercent: Math.max(0, Math.min(100, raw.usedPercent)),
    windowMinutes,
    resetsAt:
      typeof raw.resetsAt === 'number' && raw.resetsAt > 0
        ? new Date(raw.resetsAt * 1000).toISOString()
        : undefined,
  };
}

function normalizeLimits(result) {
  const limits = pickAccountWide(result);
  if (!limits) return null;

  const windows = [normalizeWindow(limits.primary), normalizeWindow(limits.secondary)].filter(Boolean);
  const fiveHour =
    windows.find((w) => w.windowMinutes === 300)
    ?? windows.find((w) => w.windowMinutes > 0 && w.windowMinutes < 1440);
  const sevenDay =
    windows.find((w) => w.windowMinutes === 10080)
    ?? windows.find((w) => w.windowMinutes >= 1440);

  if (!fiveHour && !sevenDay) return null;
  return { fiveHour, sevenDay };
}

function codexSpawnTarget() {
  const custom = process.env.JEY_CODEX_BIN;
  const binary = custom || (process.platform === 'win32' ? 'codex.cmd' : 'codex');
  const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(binary);
  return { binary: shell && /\s/.test(binary) ? '"' + binary + '"' : binary, shell };
}

function stopTree(child, shell) {
  try { child.kill('SIGKILL'); } catch {}
  if (process.platform === 'win32' && shell && child.pid) {
    try {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.on('error', () => {});
    } catch {}
  }
}

async function queryRateLimits(home) {
  const target = codexSpawnTarget();

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(target.binary, ['app-server'], {
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
        shell: target.shell,
        env: { ...process.env, CODEX_HOME: home },
      });
    } catch {
      resolve(null);
      return;
    }

    let done = false;
    let buffer = '';

    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stopTree(child, target.shell);
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
    if (typeof timer.unref === 'function') timer.unref();

    child.on('error', () => finish(null));
    child.on('exit', () => finish(null));
    child.stdin?.on('error', () => finish(null));

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;

        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message?.id !== REQUEST_ID) continue;

        finish(normalizeLimits(message.result));
        return;
      }
    });

    const frames = [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { clientInfo: { name: 'jey-codex-d200h', title: 'Jey Codex D200H', version: '1.0.0' } },
      },
      { jsonrpc: '2.0', method: 'initialized', params: {} },
      { jsonrpc: '2.0', id: REQUEST_ID, method: 'account/rateLimits/read', params: {} },
    ];

    try {
      child.stdin?.write(frames.map((frame) => JSON.stringify(frame)).join('\n') + '\n');
    } catch {
      finish(null);
    }
  });
}

export async function queryAccount(account) {
  if (!fs.existsSync(path.join(account.home, 'auth.json'))) {
    return { id: account.id, label: account.label, status: 'login', fiveHour: null, sevenDay: null };
  }

  const limits = await queryRateLimits(account.home);
  if (!limits) {
    return { id: account.id, label: account.label, status: 'error', fiveHour: null, sevenDay: null };
  }

  return {
    id: account.id,
    label: account.label,
    status: 'ok',
    fiveHour: limits.fiveHour,
    sevenDay: limits.sevenDay,
  };
}

export async function queryAllAccounts() {
  const results = await Promise.all(ACCOUNTS.map(queryAccount));
  return new Map(results.map((result) => [result.id, result]));
}
