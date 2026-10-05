import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { BRAND_FEATURES, creatureFeatureLayers, featureRgbHex } from '../brand-features.js';
import { emitBrandFeatures, OUTPUT, sourcePaths } from '../../../scripts/generate-brand-features.mjs';
const root = fileURLToPath(new URL('../../..', import.meta.url));

describe('source-grounded creature feature semantics', () => {
  it('pins all canonical SVG bytes and generated Blender material selectors', () => {
    expect(readFileSync(root + '/' + OUTPUT, 'utf8')).toBe(emitBrandFeatures());
  });
  for (const [agent, definition] of Object.entries(BRAND_FEATURES.agents)) {
    it(`${agent} fills are independent of background and OpenCode is a true hole`, async () => {
      const paths = sourcePaths(readFileSync(root + '/' + definition.sourcePath, 'utf8'));
      const features = creatureFeatureLayers(agent as keyof typeof BRAND_FEATURES.agents, paths);
      const render = async (background: string) => {
        const layers = features.filter(f => f.mode === 'fill').map(f =>
          `<path fill="${featureRgbHex(f.rgb!)}" d="${f.paths.join(' ')}"/>`).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="240" height="240"><rect width="24" height="24" fill="${background}"/><g fill="${featureRgbHex([176, 128, 96])}" fill-rule="evenodd">${paths.slice(agent === 'openclaw' ? 2 : 0).map(p => `<path d="${p}"/>`).join('')}</g>${layers}</svg>`;
        return sharp(Buffer.from(svg)).raw().toBuffer();
      };
      const a = await render(featureRgbHex([40, 73, 105])), b = await render(featureRgbHex([212, 231, 171]));
      const pixel = (buffer: Buffer, x: number, y: number) => [...buffer.subarray((y * 240 + x) * 4, (y * 240 + x) * 4 + 3)];
      const samples: Record<string, [number, number, number[]][]> = {
        claudecode: [[65, 94, [0, 0, 0]], [173, 94, [0, 0, 0]]],
        codex: [[79, 110, [255, 255, 255]], [150, 153, [255, 255, 255]]],
        openclaw: [[80, 81, [5, 8, 16]], [90, 76, [0, 229, 204]]],
        opencode: [[120, 120, []]],
      };
      for (const [x, y, rgb] of samples[agent]) {
        if (agent === 'opencode') {
          expect(pixel(a, x, y)).toEqual([40, 73, 105]);
          expect(pixel(b, x, y)).toEqual([212, 231, 171]);
        }
        else { expect(pixel(a, x, y)).toEqual(rgb); expect(pixel(b, x, y)).toEqual(rgb); }
      }
      if (agent === 'opencode') {
        const areas = paths[0].match(/[Mm][^Mm]*/g)!;
        expect(areas[0]).toContain('H8v12h8');
        expect(areas[1]).toContain('H4V2h16v20');
      }
    });
  }
});

it('compact feature masks stay cropped, bounded and source-grounded across 64/24/9/8 pixel surfaces', async () => {
  const { rasterizeFeatureLayers, cppFeatureLayers } = await import('../../../scripts/creature-feature-masks.mjs');
  let flashBytes = 0;
  for (const size of [64, 24, 9, 8]) for (const agent of Object.keys(BRAND_FEATURES.agents)) {
    const layers = await rasterizeFeatureLayers(agent, size);
    if (agent === 'opencode') { expect(layers).toEqual([]); continue; }
    for (const layer of layers) {
      expect(layer.x).toBeGreaterThanOrEqual(0); expect(layer.y).toBeGreaterThanOrEqual(0);
      expect(layer.x + layer.width).toBeLessThanOrEqual(size); expect(layer.y + layer.height).toBeLessThanOrEqual(size);
      expect(layer.alpha).toHaveLength(layer.width * layer.height);
      expect(layer.alpha.some((value: number) => value > 0)).toBe(true);
      expect(layer.monochrome).toBe(layer.monochromeCreature === 'paper' && agent === 'openclaw' ? 'ink' : 'paper');
      if (size === 64) flashBytes += layer.alpha.length;
    }
    if (size === 64) {
      const names: Record<string, string> = { claudecode: 'OCTOPUS', codex: 'CODEX', openclaw: 'OPENCLAW_MARK' };
      expect(readFileSync(root + '/esp32/src/ui/terrarium/creature_glyphs_generated.h', 'utf8')).toContain(cppFeatureLayers(names[agent], layers));
    }
    if (size === 8) {
      const names: Record<string, string> = { claudecode: 'CLAUDE_CODE', codex: 'CODEX', openclaw: 'OPEN_CLAW' };
      expect(readFileSync(root + '/esp32/src/ui/matrix/official_dot_glyphs_generated.h', 'utf8')).toContain(cppFeatureLayers(names[agent], layers));
    }
  }
  // Cropped feature alpha alone stays far below one extra full 64px mask.
  expect(flashBytes).toBeLessThan(64 * 64);
});

it('OpenClaw feature colors come from the pinned original color reference, not inferred white', async () => {
  const { createHash } = await import('node:crypto');
  const definition = BRAND_FEATURES.agents.openclaw;
  const reference = readFileSync(root + '/' + definition.colorReference.sourcePath, 'utf8');
  expect(createHash('sha256').update(reference).digest('hex')).toBe(definition.colorReference.sourceHash);
  const source = [...reference.replace(/<defs\b[\s\S]*?<\/defs>/g, '').matchAll(/<path\b[^>]*>/g)];
  for (const role of ['eyes', 'eye-highlight'] as const) {
    const element = source[definition.colorReference.rolePathIndices[role]][0];
    const color = element.match(/fill="(#[A-Fa-f0-9]{6})"/)![1];
    const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    for (const feature of definition.features.filter(f => f.role === role)) expect(feature.rgb).toEqual(rgb);
  }
  expect(definition.features[0].monochromeCreature).toBe('ink');
  expect(definition.features[1].monochromeCreature).toBe('paper');
});
