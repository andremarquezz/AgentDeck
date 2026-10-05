/**
 * Deck-switchable session settings, described in the agent's own words (#463).
 *
 * The deck never invents a level, a list or a default: everything here is a
 * projection of what the agent itself reported at request time. Mirrored in
 * Swift by `OpenClawSessionSettings` (apple/AgentDeck/Daemon/Gateway).
 */
import type { ModelCatalogEntry, SessionSetting, SessionSettingOption } from './protocol.js';

/** The subset of an OpenClaw Gateway `sessions.list` row (or its `defaults`)
 *  that describes model and thinking. Field names are the Gateway's. */
export interface OpenClawSettingsRow {
  model?: unknown;
  modelProvider?: unknown;
  modelOverrideSource?: unknown;
  thinkingLevel?: unknown;
  thinkingLevels?: unknown;
  thinkingOptions?: unknown;
  thinkingDefault?: unknown;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** `thinkingLevels` ({id,label}) first; the legacy `thinkingOptions` id list
 *  otherwise — the same precedence OpenClaw's own web picker uses. */
function thinkingOptions(row: OpenClawSettingsRow): SessionSettingOption[] | undefined {
  if (Array.isArray(row.thinkingLevels)) {
    const out: SessionSettingOption[] = [];
    for (const level of row.thinkingLevels) {
      const id = text((level as { id?: unknown })?.id);
      if (!id) continue;
      const label = text((level as { label?: unknown })?.label);
      out.push(label && label !== id ? { id, label } : { id });
    }
    if (out.length > 0) return out;
  }
  if (Array.isArray(row.thinkingOptions)) {
    const out = row.thinkingOptions.map(text).filter((id): id is string => !!id).map((id) => ({ id }));
    if (out.length > 0) return out;
  }
  return undefined;
}

function modelKey(row: OpenClawSettingsRow): string | undefined {
  const model = text(row.model);
  if (!model) return undefined;
  const provider = text(row.modelProvider);
  return provider && !model.includes('/') ? `${provider}/${model}` : model;
}

/**
 * Settings for one OpenClaw session row. `defaults` is the `sessions.list`
 * `defaults` block, used only where the row itself is silent. The model list
 * is the Gateway `models.list` catalog; with no catalog there is no model
 * setting (the deck cannot offer what the agent did not list).
 */
export function openClawSessionSettings(
  row: OpenClawSettingsRow,
  defaults: OpenClawSettingsRow | undefined,
  catalog: { entries: ModelCatalogEntry[] } | null | undefined,
): SessionSetting[] {
  const settings: SessionSetting[] = [];

  const models = (catalog?.entries ?? []).filter((e) => e.available !== false && text(e.key));
  if (models.length > 0) {
    const current = modelKey(row);
    // The catalog's own `role: 'default'` entry, else the list defaults block.
    const defaultModel = models.find((e) => e.role === 'default')?.key ?? (defaults ? modelKey(defaults) : undefined);
    settings.push({
      key: 'model',
      ...(current ? { current } : {}),
      ...(defaultModel ? { default: defaultModel } : {}),
      // `modelOverrideSource` is null/absent for an inherited model.
      ...(row.modelOverrideSource != null ? { overridden: true } : {}),
      options: models.map((e) => (e.name && e.name !== e.key ? { id: e.key, label: e.name } : { id: e.key })),
    });
  }

  const levels = thinkingOptions(row) ?? (defaults ? thinkingOptions(defaults) : undefined);
  if (levels) {
    const thinkingDefault = text(row.thinkingDefault) ?? (defaults ? text(defaults.thinkingDefault) : undefined);
    const current = text(row.thinkingLevel) ?? thinkingDefault;
    settings.push({
      key: 'effort',
      ...(current ? { current } : {}),
      ...(thinkingDefault ? { default: thinkingDefault } : {}),
      options: levels,
    });
  }

  return settings;
}

/** Display text for an option: the agent's label, else its id. */
export function sessionSettingOptionLabel(option: SessionSettingOption): string {
  return option.label ?? option.id;
}
