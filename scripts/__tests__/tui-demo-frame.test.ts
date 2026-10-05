import { describe, expect, it } from 'vitest';
import { ansiScreenToFrame } from '../ansi-demo-frame.mjs';
import { canonicalTerminalSprite, initTerrarium, setOpenCode, renderTerrariumFrame } from '../../bridge/src/tui/terrarium.js';

describe('public TUI canonical color frames', () => {
  it('consumes RGB payloads atomically and preserves both half colors and background restoration', () => {
    const frame = ansiScreenToFrame('\x1b[38;2;5;8;16m\x1b[48;2;0;229;204m▀\x1b[48;2;10;22;40m \x1b[49m▄', 3, 1);
    expect(frame.lines).toEqual(['▀ ▄']);
    expect(frame.spans[0]).toEqual([
      { x: 0, text: '▀', color: '#050810', background: '#00e5cc', dim: false },
      { x: 1, text: ' ', color: '#050810', background: '#0a1628', dim: false },
      { x: 2, text: '▄', color: '#050810', background: null, dim: false },
    ]);
  });
  it('keeps intensity/reset separate from RGB channel values', () => {
    const frame = ansiScreenToFrame('\x1b[2m\x1b[38;2;0;2;22mA\x1b[22mB\x1b[0mC', 3, 1);
    expect(frame.spans[0].map(s => [s.text, s.color, s.dim])).toEqual([
      ['A', '#000216', true], ['B', '#000216', false], ['C', null, false],
    ]);
  });
  it('preserves actual OpenCode colored-cell output without filling its canonical hole', () => {
    const ctx = initTerrarium(); ctx.bubbles = []; ctx.schools = [];
    setOpenCode(ctx, [{ id: 'synthetic', state: 'idle', agentType: 'opencode', name: 'OpenCode' }]);
    const lines = renderTerrariumFrame(ctx, 180, 40, 0);
    const frame = ansiScreenToFrame(lines.join('\n'), 180, 40);
    expect(frame.spans.flat().some(s => /[▀▄]/.test(s.text) && s.background)).toBe(true);
    expect(canonicalTerminalSprite('openCode', 'xlarge', '').cells[3][2].top).toBeNull();
    expect(frame.lines.some(line => line.includes('OpenCode'))).toBe(true);
  });
});
