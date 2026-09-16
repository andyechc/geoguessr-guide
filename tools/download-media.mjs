// Descarga legal de multimedia según data/media-manifest.json
// - Wikimedia Commons: descarga directa + respeta licencia (revisar file page)
// - Mapillary: requiere MAPILLARY_TOKEN (https://www.mapillary.com/dashboard) y deja atribución CC-BY-SA
// Uso: MAPILLARY_TOKEN=xxx npm run media
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname, '..');
const manifestPath = resolve(root, 'data/media-manifest.json');
const outAttr = resolve(root, 'public/attribution.json');
const manifestOnly = process.argv.includes('--manifest-only');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
console.log(`[media] ${manifest.items.length} items en manifest`);

async function dl(url, target) {
  const abs = resolve(root, target);
  mkdirSync(dirname(abs), { recursive: true });
  if (existsSync(abs)) { console.log(`[media] skip (existe) ${target}`); return true; }
  console.log(`[media] GET ${url}`);
  const r = await fetch(url, { headers: { 'User-Agent': 'geoguessr-guide/0.1 (educational)' } });
  if (!r.ok) { console.warn(`[media] FAIL ${r.status} ${url}`); return false; }
  const buf = Buffer.from(await r.arrayBuffer());
  // Convierte a webp si sharp disponible y no es svg
  if (!target.endsWith('.svg')) {
    try {
      const { default: sharp } = await import('sharp');
      await sharp(buf).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 78 }).toFile(abs.replace(/\.\w+$/, '.webp'));
      console.log(`[media] OK ${target}`);
      return true;
    } catch (e) {
      console.warn('[media] sharp no disponible, guardo original: ' + e.message);
    }
  }
  writeFileSync(abs, buf);
  console.log(`[media] OK ${target} (original)`);
  return true;
}

async function mapillaryThumb(bbox, limit = 5) {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) { console.warn('[media] sin MAPILLARY_TOKEN, salto Mapillary'); return null; }
  const [minx, miny, maxx, maxy] = bbox.split(',').map(Number);
  const url = `https://graph.mapillary.com/images?bbox=${minx},${miny},${maxx},${maxy}&is_pano=true&limit=${limit}&fields=id,thumb_2048_url,computed_geometry,creator,license&access_token=${token}`;
  const r = await fetch(url);
  if (!r.ok) { console.warn('[media] Mapillary FAIL ' + r.status); return null; }
  const j = await r.json();
  return j?.data?.[0] || null;
}

const attr = [];
for (const it of manifest.items) {
  if (manifestOnly) { attr.push({ id: it.id, target: it.target, author: it.author, license: it.license, source_page: it.source_page, clue: it.clue }); continue; }
  if (it.mapillary) {
    const m = await mapillaryThumb(it.mapillary.bbox, it.mapillary.limit || 5);
    if (m?.thumb_2048_url) {
      const ok = await dl(m.thumb_2048_url, it.target);
      attr.push({ id: it.id, target: it.target, author: `Mapillary @${m.creator?.username || 'contributor'} (img ${m.id})`, license: 'CC-BY-SA 4.0', source_page: `https://www.mapillary.com/app/?pKey=${m.id}`, clue: it.clue, ok });
      continue;
    }
    attr.push({ id: it.id, target: it.target, author: it.author, license: it.license, source_page: it.source_page, clue: it.clue, ok: false, note: 'pendiente MAPILLARY_TOKEN' });
    continue;
  }
  let ok = false;
  for (const u of it.sources || []) { ok = await dl(u, it.target); if (ok) break; }
  attr.push({ id: it.id, target: it.target, author: it.author, license: it.license, source_page: it.source_page, clue: it.clue, ok });
}

writeFileSync(outAttr, JSON.stringify(attr, null, 2));
console.log(`[media] attribution.json con ${attr.length} entradas`);
