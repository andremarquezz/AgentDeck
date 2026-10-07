import fs from 'fs';
import os from 'os';
import path from 'path';
import type { CodexAccountUsage } from '@agentdeck/shared';
import { loadDaemonSettings } from './daemon-settings.js';
import { queryCodexRateLimitsLive } from './codex-rate-limits-live.js';

export interface CodexAccountConfig {
  id: string;
  label: string;
  home: string;
  enabled: boolean;
}

/**
 * Personal D200H defaults. JEY uses the ordinary Codex home already configured
 * on the machine. AMERICANO gets its own home and simply stays absent until
 * that profile is logged in.
 */
const PERSONAL_DEFAULTS: CodexAccountConfig[] = [
  { id: 'jey', label: 'JEY', home: '~/.codex', enabled: true },
  { id: 'americano', label: 'AMERICANO', home: '~/.codex-americano', enabled: true },
];

export const CODEX_ACCOUNT_REFRESH_MS = 30_000;
const FAILED_CACHE_TTL_MS = 2 * 60_000;

function expandHome(input: string): string {
  const value = input.trim();
  if (value === '~') return os.homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(os.homedir(), value.slice(2));
  }
  return path.resolve(value);
}

function validAccount(value: unknown): CodexAccountConfig | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  const home = typeof raw.home === 'string' ? raw.home.trim() : '';
  if (!id || !label || !home) return null;
  return { id, label, home, enabled: raw.enabled !== false };
}

export function loadCodexAccountConfigs(
  settings: Record<string, unknown> = loadDaemonSettings(),
): CodexAccountConfig[] {
  const configured = Array.isArray(settings.codexAccounts)
    ? settings.codexAccounts.map(validAccount).filter((x): x is CodexAccountConfig => x != null)
    : [];
  const source = configured.length > 0 ? configured : PERSONAL_DEFAULTS;
  return source
    .filter((account) => account.enabled)
    .map((account) => ({ ...account, home: expandHome(account.home) }));
}

interface CachedAccount {
  usage: CodexAccountUsage;
  refreshedAtMs: number;
}

const cache = new Map<string, CachedAccount>();
let inFlight: Promise<CodexAccountUsage[]> | null = null;
let lastRefreshStartedMs = 0;

function configuredAccountHasAuth(account: CodexAccountConfig): boolean {
  try {
    return fs.existsSync(path.join(account.home, 'auth.json'));
  } catch {
    return false;
  }
}

export function getCodexAccountsUsage(): CodexAccountUsage[] {
  const configured = new Set(loadCodexAccountConfigs().map((account) => account.id));
  return [...cache.entries()]
    .filter(([id]) => configured.has(id))
    .map(([, entry]) => entry.usage);
}

/**
 * Fetch each account directly from its own `codex app-server` using that
 * profile's CODEX_HOME. There is deliberately no rollout/passive reconciliation
 * here: this fork is personal and the live account answer is the source of
 * truth for the Ulanzi gauges.
 */
export function refreshCodexAccountsUsage(force = false): Promise<CodexAccountUsage[]> {
  const now = Date.now();
  if (!force && inFlight) return inFlight;
  if (!force && lastRefreshStartedMs > 0 && now - lastRefreshStartedMs < CODEX_ACCOUNT_REFRESH_MS) {
    return Promise.resolve(getCodexAccountsUsage());
  }

  lastRefreshStartedMs = now;
  const accounts = loadCodexAccountConfigs();

  inFlight = Promise.all(accounts.map(async (account) => {
    if (!configuredAccountHasAuth(account)) {
      cache.delete(account.id);
      return;
    }

    const limits = await queryCodexRateLimitsLive({ codexHome: account.home });
    if (limits) {
      cache.set(account.id, {
        usage: { id: account.id, label: account.label, rateLimits: limits },
        refreshedAtMs: Date.now(),
      });
      return;
    }

    const previous = cache.get(account.id);
    if (previous && Date.now() - previous.refreshedAtMs > FAILED_CACHE_TTL_MS) {
      cache.delete(account.id);
    }
  })).then(() => getCodexAccountsUsage())
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function __resetCodexAccountUsageForTest(): void {
  cache.clear();
  inFlight = null;
  lastRefreshStartedMs = 0;
}
