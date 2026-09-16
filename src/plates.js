// Renderiza una matrícula (delantera + trasera) como SVG a partir de data/plates.json
function textColor(p) {
  if (p.ink) return p.ink;
  if (p.iso === 'BT') return '#ffffff';
  if (p.iso === 'BE') return '#dc2626';
  return '#111827';
}

function bands(p, y) {
  const code = p.code || (p.iso === 'GB' ? 'UK' : p.iso);
  if (p.band === 'eu' || p.band === 'tr' || p.iso === 'IL') {
    return `<rect x="6" y="${y + 4}" width="24" height="44" rx="4" fill="#1d4ed8"/><text x="18" y="${y + 31}" fill="#fff" font-size="10" font-weight="800" text-anchor="middle" font-family="system-ui">${code}</text>`;
  }
  if (p.band === 'dual') {
    return `<rect x="6" y="${y + 4}" width="16" height="44" rx="4" fill="#1d4ed8"/><rect x="238" y="${y + 4}" width="16" height="44" rx="4" fill="#1d4ed8"/>`;
  }
  if (p.band === 'mercosur') {
    return `<rect x="6" y="${y + 4}" width="248" height="10" rx="3" fill="#1d4ed8"/>`;
  }
  return '';
}

function plate(p, y, fill) {
  const tc = textColor(p);
  const fs = p.format.length > 10 ? 16 : 20;
  return `<g>
    <rect x="2" y="${y}" width="256" height="52" rx="8" fill="${fill}" stroke="#0f172a" stroke-width="2"/>
    ${bands(p, y)}
    <text class="plate-t" x="136" y="${y + 35}" fill="${tc}" font-size="${fs}" font-weight="800" text-anchor="middle" font-family="ui-monospace,Menlo,monospace">${p.format}</text>
  </g>`;
}

export function renderPlate(p) {
  const same = p.front.toLowerCase() === p.rear.toLowerCase();
  const h = same ? 62 : 122;
  // Las cortas se ven cortas y las largas a ancho completo
  const n = p.format.length;
  const w = n <= 7 ? 55 + (n - 4) * 5 : n <= 9 ? 75 + (n - 7) * 8 : 100;
  return `<svg viewBox="0 0 260 ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="plate ${p.iso}" style="width:${w}%;height:auto;display:block;margin:0 auto">
    ${plate(p, 4, p.front)}
    ${same ? '' : plate(p, 62, p.rear)}
  </svg>`;
}

export function plateColorFamily(p) {
  const cols = `${p.front} ${p.rear}`.toLowerCase();
  if (cols.includes('#151515')) return 'black';
  if (cols.includes('#b91c1c')) return 'red';
  if (cols.includes('#facc15') || cols.includes('#fef9c3') || cols.includes('#fb923c') || cols.includes('#fbbf24')) return 'yellow';
  return 'white';
}
