import { describe, expect, it } from 'vitest';
import { openClawSessionSettings, sessionSettingOptionLabel } from '../session-settings.js';

// Shapes captured from a live OpenClaw Gateway `sessions.list` (2026.9.8, 2026-10-06).
const LEVELS = ['off', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].map((id) => ({ id, label: id }));
const ROW = {
  key: 'agent:main:dashboard:916b67ba',
  thinkingLevel: 'medium',
  thinkingLevels: LEVELS,
  thinkingOptions: LEVELS.map((l) => l.id),
  thinkingDefault: 'high',
  modelProvider: 'openai',
  model: 'gpt-6-sol',
  modelOverrideSource: null,
};
const DEFAULTS = {
  modelProvider: 'zai', model: 'glm-5.3',
  thinkingLevels: [{ id: 'low', label: 'low' }, { id: 'high', label: 'high' }],
  thinkingDefault: 'high',
};
const CATALOG = {
  entries: [
    { key: 'openai/gpt-6-sol', name: 'GPT-6 Sol', role: 'default' as const, available: true },
    { key: 'zai/glm-5.3', name: 'zai/glm-5.3', role: 'configured' as const, available: true },
    { key: 'gone/model', name: 'Gone', role: 'configured' as const, available: false },
  ],
};

describe('openClawSessionSettings (#463)', () => {
  it('projects the row\'s own levels, current value and default verbatim', () => {
    const [model, effort] = openClawSessionSettings(ROW, DEFAULTS, CATALOG);
    expect(effort).toEqual({ key: 'effort', current: 'medium', default: 'high', options: LEVELS.map(({ id }) => ({ id })) });
    expect(model).toEqual({
      key: 'model', current: 'openai/gpt-6-sol', default: 'openai/gpt-6-sol',
      options: [{ id: 'openai/gpt-6-sol', label: 'GPT-6 Sol' }, { id: 'zai/glm-5.3' }],
    });
  });

  it('marks a user model override, and keeps a binary provider label (on) next to its id', () => {
    const [model, effort] = openClawSessionSettings(
      { ...ROW, modelOverrideSource: 'user', thinkingLevel: 'low', thinkingLevels: [{ id: 'off', label: 'off' }, { id: 'low', label: 'on' }] },
      undefined, CATALOG);
    expect(model.overridden).toBe(true);
    expect(effort.options).toEqual([{ id: 'off' }, { id: 'low', label: 'on' }]);
    expect(sessionSettingOptionLabel(effort.options[1])).toBe('on');
  });

  it('falls back to the defaults block and the legacy option list only where the row is silent', () => {
    const settings = openClawSessionSettings({ model: 'glm-5.3', modelProvider: 'zai' }, DEFAULTS, undefined);
    // No catalog → no model setting: the deck cannot offer what the agent did not list.
    expect(settings.map((s) => s.key)).toEqual(['effort']);
    expect(settings[0]).toEqual({ key: 'effort', current: 'high', default: 'high', options: [{ id: 'low' }, { id: 'high' }] });
    expect(openClawSessionSettings({ thinkingOptions: ['on', 'off'] }, undefined, undefined)[0].options)
      .toEqual([{ id: 'on' }, { id: 'off' }]);
  });

  it('never invents a default or a level', () => {
    expect(openClawSessionSettings({}, undefined, undefined)).toEqual([]);
    const [effort] = openClawSessionSettings({ thinkingLevels: [{ id: 'ultra' }] }, undefined, undefined);
    expect(effort).toEqual({ key: 'effort', options: [{ id: 'ultra' }] });
  });
});
