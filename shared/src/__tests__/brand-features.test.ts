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
        openclaw: [[80, 81, [0, 0, 0]], [90, 76, [255, 255, 255]]],
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
