// Canonical semantic contours -> static cropped A8 layers. No invented pixel
// anatomy: tiny masks retain fractional source coverage at the target size.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BRAND_FEATURES, creatureFeatureLayers } from '../shared/dist/brand-features.js';
import { sourcePaths, emitBrandFeatures } from './generate-brand-features.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function rasterizeFeatureLayers(agent, size) {
  if (!(agent in BRAND_FEATURES.agents)) return [];
  emitBrandFeatures(); // refuse changed canonical bytes before generating masks
  const paths = sourcePaths(readFileSync(root + BRAND_FEATURES.agents[agent].sourcePath, 'utf8'));
  const groups = new Map();
  for (const feature of creatureFeatureLayers(agent, paths)) {
    if (feature.mode !== 'fill') continue;
    const key = feature.rgb.join(',') + '/' + feature.monochrome;
    const group = groups.get(key) ?? { rgb: feature.rgb, monochrome: feature.monochrome, paths: [] };
    group.paths.push(...feature.paths); groups.set(key, group);
  }
  const result = [];
  for (const group of groups.values()) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="white" d="${group.paths.join(' ')}"/></svg>`;
    const { data, info } = await sharp(Buffer.from(svg), { density: 384 }).resize(size, size, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0=size, y0=size, x1=-1, y1=-1;
    const alpha = Array.from({ length: size * size }, (_, i) => data[i * info.channels + info.channels - 1]);
    for (let y=0;y<size;y++) for(let x=0;x<size;x++) if(alpha[y*size+x]) {x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    if(x1<0) continue;
    const width=x1-x0+1, height=y1-y0+1;
    result.push({ x:x0, y:y0, width, height, rgb:group.rgb, monochrome:group.monochrome,
      alpha: Array.from({length:width*height}, (_,i)=>alpha[(y0+Math.floor(i/width))*size+x0+i%width]) });
  }
  return result;
}
export const CPP_FEATURE_STRUCT = `// Offsets are in this namespace's master-mask coordinates. Immutable flash\n// coverage is composited after the body; black RGB is an opaque paint operation.\nstruct FeatureLayer {\n    uint8_t x, y, width, height;\n    const uint8_t* alpha;\n    uint8_t red, green, blue;\n    bool monochromeInk;\n};`;
export function cppFeatureLayers(name, layers) {
  const arrays = layers.map((layer,i)=>`static const uint8_t ${name}_FEATURE_${i}_A8[${layer.alpha.length}] = {\n    ${layer.alpha.join(', ')}\n};`).join('\n');
  const entries = layers.map((layer,i)=>`    {${layer.x}, ${layer.y}, ${layer.width}, ${layer.height}, ${name}_FEATURE_${i}_A8, ${layer.rgb.join(', ')}, ${layer.monochrome === 'ink'}},`).join('\n');
  return `${arrays}\nconstexpr int ${name}_FEATURE_COUNT = ${layers.length};\nstatic const FeatureLayer ${name}_FEATURES[${Math.max(1,layers.length)}] = {\n${entries || '    {0, 0, 0, 0, nullptr, 0, 0, 0, false},'}\n};`;
}
