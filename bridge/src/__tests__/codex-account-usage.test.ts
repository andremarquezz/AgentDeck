import { describe, expect, it } from 'vitest';
import os from 'os';
import path from 'path';
import { loadCodexAccountConfigs } from '../codex-account-usage.js';

describe('loadCodexAccountConfigs', () => {
  it('defaults to JEY and AMERICANO personal Codex homes', () => {
    expect(loadCodexAccountConfigs({})).toEqual([
      {
        id: 'jey',
        label: 'JEY',
        home: path.join(os.homedir(), '.codex'),
        enabled: true,
      },
      {
        id: 'americano',
        label: 'AMERICANO',
        home: path.join(os.homedir(), '.codex-americano'),
        enabled: true,
      },
    ]);
  });

  it('allows overriding homes without changing the deck account model', () => {
    const accounts = loadCodexAccountConfigs({
      codexAccounts: [
        { id: 'jey', label: 'JEY', home: '~/profiles/jey' },
        { id: 'americano', label: 'AMERICANO', home: '~/profiles/americano' },
      ],
    });
    expect(accounts.map((account) => ({ id: account.id, label: account.label }))).toEqual([
      { id: 'jey', label: 'JEY' },
      { id: 'americano', label: 'AMERICANO' },
    ]);
    expect(accounts[0].home).toBe(path.join(os.homedir(), 'profiles', 'jey'));
    expect(accounts[1].home).toBe(path.join(os.homedir(), 'profiles', 'americano'));
  });

  it('drops disabled or malformed account rows', () => {
    const accounts = loadCodexAccountConfigs({
      codexAccounts: [
        { id: 'jey', label: 'JEY', home: '~/.codex', enabled: true },
        { id: 'americano', label: 'AMERICANO', home: '~/.codex-americano', enabled: false },
        { id: '', label: 'BROKEN', home: '~/.broken' },
      ],
    });
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe('jey');
  });
});
