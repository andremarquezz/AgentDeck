// Unchanged canonical SVGs + typed semantic SSOT -> Blender material selectors.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { BRAND_FEATURES, creatureFeatureLayers } from '../shared/dist/brand-features.js';
export const OUTPUT = 'design/creatures/brand-features.generated.json';
const root = fileURLToPath(new URL('../', import.meta.url));
export function sourcePaths(svg) {
  return [...svg.replace(/<defs\b[\s\S]*?<\/defs>/g, '').matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => match[1]);
}
export function emitBrandFeatures(read = relative => readFileSync(resolve(root, relative), 'utf8')) {
  for (const [agent, value] of Object.entries(BRAND_FEATURES.agents)) {
    const svg = read(value.sourcePath);
    if (createHash('sha256').update(svg).digest('hex') !== value.sourceHash) throw new Error(`${agent} canonical SVG changed: review feature contours first`);
    creatureFeatureLayers(agent, sourcePaths(svg));
  }
  return JSON.stringify(BRAND_FEATURES, null, 2) + '\n';
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = resolve(root, OUTPUT), text = emitBrandFeatures();
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8') !== text) throw new Error('Creature feature JSON drift; run generate-brand-features');
  } else { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, text); }
}
