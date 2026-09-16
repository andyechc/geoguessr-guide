import { getLang, setLang, t, applyI18n } from './i18n.js';
import countries from '../data/countries.json';
import plates from '../data/plates.json';
import bollards from '../data/bollards.json';
import phones from '../data/phones.json';
import scripts from '../data/scripts.json';
import { renderPlate, plateColorFamily } from './plates.js';
import poles from '../data/poles.json';

// Bollard 3D: placeholder + carga perezosa del módulo three.js
function bolImg(b) {
  return `<button class="bol3d" data-bol="${b.id}" title="Ver en 3D · View in 3D">
    <img data-bol3d="${b.id}" alt="Bollard ${b.countries.join(' ')}" />
    <span class="bol3d-badge">360°</span>
  </button>`;
}
function ensureBol3D() {
  import('./bollard-3d.js').then((m) => m.bindBollard3D(app)).catch(() => {});
}
function poleMaterialColor(m) {
  return m === 'wood' ? '#8A6B4A' : m === 'concrete' ? '#C9CED8' : '#7D8AA0';
}
function polImg(p) {
  return `<button class="bol3d pol3d" data-pol="${p.id}" title="Ver en 3D · View in 3D">
    <img data-pol3d="${p.id}" alt="Poste ${p.countries.join(' ')}" />
    <span class="bol3d-badge">360°</span>
  </button>`;
}

const app = document.getElementById('app');
const secsEl = document.getElementById('sections');
const searchEl = document.getElementById('search');
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lb-img');
const lbCap = document.getElementById('lb-cap');
const toast = document.getElementById('toast');

const SECTIONS = [
  { id: 'home', icon: '<i class="fa-solid fa-house"></i>', label: () => t('secHome') },
  { id: 'plates', icon: '<i class="fa-solid fa-id-card"></i>', label: () => t('secPlates') },
  { id: 'bollards', icon: '<i class="fa-solid fa-road-barrier"></i>', label: () => t('secBollards') },
  { id: 'poles', icon: '<i class="fa-solid fa-broadcast-tower"></i>', label: () => t('secPoles') },
  { id: 'countries', icon: '<i class="fa-solid fa-earth-americas"></i>', label: () => t('secCountries') },
  { id: 'scripts', icon: '<i class="fa-solid fa-language"></i>', label: () => t('secScripts') }
];

// filtros + tabs + práctica (estado en memoria)
const F = {
  plateCont: 'all', plateColor: 'all', plateQ: '', plateDuel: 'all', plateTab: 'archive', plateBlur: true,
  bolCont: 'all', bolQ: '', bolDuel: 'all', bolTab: 'archive',
  polCont: 'all', polQ: '', polMat: 'all', polTab: 'archive',
  scriptQ: '', scriptTab: 'archive',
  ctryQ: '', ctryCont: 'all', ctryDrive: 'all', ctrySort: 'name-asc'
};
const IDA = { plates: {}, bollards: {}, poles: {} };

const DUELS = {
  plates: [
    { isos: ['NL', 'LU'], es: 'Amarilla doble (EU)', en: 'Double yellow (EU)' },
    { isos: ['IT', 'AL'], es: 'Doble banda azul', en: 'Dual blue band' },
    { isos: ['TH', 'LA'], es: 'Amarilla asiática', en: 'Asian yellow' },
    { isos: ['GB', 'IN', 'ZA', 'KE'], es: 'Blanca + amarilla', en: 'White + yellow' },
    { isos: ['GB', 'HK'], es: 'Blanca + amarilla, conduce izquierda', en: 'White + yellow, left-hand drive' },
    { isos: ['SG', 'MY'], es: 'Negras estándar', en: 'Standard black' }
  ],
  bollards: [
    { isos: ['AU', 'NZ', 'TR'], es: 'Franja roja', en: 'Red band' },
    { isos: ['JP', 'TW'], es: 'Poste metálico (Asia)', en: 'Metal post (Asia)' },
    { isos: ['US', 'CA', 'MX'], es: 'Norteamérica', en: 'North America' },
    { isos: ['DK', 'DE', 'FR', 'ES', 'NL', 'GB', 'IS', 'SE', 'NO', 'FI'], es: 'Europa', en: 'Europe' }
  ]
};


const CONTINENTS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'];

// ---------- helpers ----------
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); toast.hidden = true; }, 1800);
}
function copyCode(code) {
  const done = () => showToast(`<i class="fa-solid fa-check"></i> ${code}`);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(done).catch(done);
  else done();
}
function flagURL(iso, w = 80) { return `./img/flags/${iso.toLowerCase()}-${w}.png`; }
function isoFromFlag(img) {
  const m = (img.getAttribute('src') || '').match(/\/([a-z]{2})-\d+\.png/i);
  return m ? m[1].toUpperCase() : null;
}
// ---------- modal comparativa idiomas ----------
const cmp = document.getElementById('cmp');
const cmpHead = document.getElementById('cmp-head');
const cmpList = document.getElementById('cmp-list');
function closeCmp() { cmp.hidden = true; }
function openCmp(id) {
  const s = scripts.find(x => x.id === id);
  if (!s || !s.compare) return;
  const L = getLang();
  cmpHead.innerHTML = `<h3 style="margin:0 40px 4px 0">${s[L].name}</h3><div class="quiz-sample sm" dir="auto" style="margin:0 0 6px">${s.sample}</div>`;
  cmpList.innerHTML = `<div class="cmp-grid">` + s.compare.map(r =>
    `<article class="cmp-card">
      <div class="cmp-chars" dir="auto">${r.chars}</div>
      <p>${r[L]}</p>
      <div class="cmp-countries">${r.countries.map(c => countryBadge(c)).join('')}</div>
    </article>`).join('') + `</div>`;
  cmp.hidden = false;
}
document.getElementById('cmp-close').onclick = closeCmp;
cmp.addEventListener('click', (e) => { if (e.target === cmp) closeCmp(); });
function openBolCmp(id) {
  const b = bollards.find(x => x.id === id);
  if (!b || !b.compare) return;
  const L = getLang();
  cmpHead.innerHTML = `<h3 style="margin:0 40px 4px 0">${t('cmpBolTitle')}</h3><p class="muted" style="margin:0 0 6px">${t('cmpBolScope')}</p><div style="margin-bottom:8px">${b.countries.map(c => countryBadge(c)).join('')}</div><p class="muted" style="margin:0 0 6px">${b[L]}</p>`;
  cmpList.innerHTML = `<div class="cmp-grid">` + b.compare.map(r =>
    `<article class="cmp-card">
      <div class="cmp-chars" dir="auto">${r.chars}</div>
      <p><span class="tag tag-other">${t('cmpOther')}</span> ${r[L]}</p>
      <div class="cmp-countries">${r.countries.map(c => countryBadge(c)).join('')}</div>
    </article>`).join('') + `</div>`;
  cmp.hidden = false;
}

// ---------- modal mapa país ----------
const cmap = document.getElementById('cmap');
const cmapHead = document.getElementById('cmap-head');
const cmapMeta = document.getElementById('cmap-meta');
const cmapFrame = document.getElementById('cmap-frame');
const cmapImg = document.getElementById('cmap-img');
const cmapPin = document.getElementById('cmap-pin');
function closeCmap() {
  cmap.hidden = true;
}
// Zoom offline: el PNG es equirectangular (-180..180, 90..-90), se centra por CSS
const MAP_HOME_K = 720; // 50° de longitud visibles al abrir
const MAP_MIN_K = 200, MAP_MAX_K = 2880;
let cmapK = MAP_HOME_K, cmapFx = 0.5, cmapFy = 0.5, cmapOx = 0, cmapOy = 0;
function cmapApply() {
  const r = cmapFrame.getBoundingClientRect();
  const AR = r.width / Math.max(1, r.height);
  cmapImg.style.transition = 'left .45s cubic-bezier(.22,1,.36,1), top .45s cubic-bezier(.22,1,.36,1), width .45s cubic-bezier(.22,1,.36,1)';
  cmapImg.style.width = cmapK + '%';
  cmapImg.style.left = (50 - cmapFx * cmapK + cmapOx) + '%';
  cmapImg.style.top = (50 - cmapFy * cmapK * AR / 2 + cmapOy) + '%';
  cmapPin.style.left = `calc(50% + ${cmapOx}%)`;
  cmapPin.style.top = `calc(50% + ${cmapOy}%)`;
}
function cmapZoom(factor) {
  cmapK = Math.min(MAP_MAX_K, Math.max(MAP_MIN_K, cmapK * factor));
  cmapApply();
}
function openCountryMap(iso) {
  const c = countryEntry(iso);
  if (!c || c.lat === undefined || c.lng === undefined) return;
  cmapHead.innerHTML = countryBadge(c.iso, true);
  const note = phoneNote(c.iso);
  cmapMeta.innerHTML = `<b>${c.phone}</b> · ${c.drive === 'left' ? '◀ ' + t('dLeft') : '▶ ' + t('dRight')} · ${c.continent}${note ? ' · ' + note : ''}`;
  cmapPin.innerHTML = `<b>${c.iso}</b>`;
  document.getElementById('cmap-zin').title = t('zoomIn');
  document.getElementById('cmap-zout').title = t('zoomOut');
  cmap.hidden = false;
  cmapFx = (c.lng + 180) / 360;
  cmapFy = (90 - c.lat) / 180;
  cmapK = MAP_HOME_K;
  cmapOx = 0; cmapOy = 0;
  cmapPin.style.left = '50%';
  cmapPin.style.top = '50%';
  cmapImg.style.transition = 'none';
  cmapImg.style.width = '100%';
  cmapImg.style.left = '0%';
  cmapImg.style.top = '0%';
  requestAnimationFrame(() => requestAnimationFrame(cmapApply));
}
document.getElementById('cmap-zin').onclick = (e) => { e.stopPropagation(); cmapZoom(1.6); };
document.getElementById('cmap-zout').onclick = (e) => { e.stopPropagation(); cmapZoom(1 / 1.6); };
cmapFrame.addEventListener('wheel', (e) => { e.preventDefault(); cmapZoom(e.deltaY < 0 ? 1.25 : 1 / 1.25); }, { passive: false });
// Pan por arrastre (ratón + táctil)
let cmapDrag = null;
cmapFrame.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.cmap-zoom')) return;
  cmapDrag = { x: e.clientX, y: e.clientY };
  cmapFrame.setPointerCapture(e.pointerId);
  cmapFrame.classList.add('dragging');
  cmapImg.style.transition = 'none';
});
cmapFrame.addEventListener('pointermove', (e) => {
  if (!cmapDrag) return;
  const r = cmapFrame.getBoundingClientRect();
  cmapOx += ((e.clientX - cmapDrag.x) / Math.max(1, r.width)) * 100;
  cmapOy += ((e.clientY - cmapDrag.y) / Math.max(1, r.height)) * 100;
  cmapDrag = { x: e.clientX, y: e.clientY };
  const AR = r.width / Math.max(1, r.height);
  cmapImg.style.left = (50 - cmapFx * cmapK + cmapOx) + '%';
  cmapImg.style.top = (50 - cmapFy * cmapK * AR / 2 + cmapOy) + '%';
  cmapPin.style.left = `calc(50% + ${cmapOx}%)`;
  cmapPin.style.top = `calc(50% + ${cmapOy}%)`;
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  cmapFrame.addEventListener(ev, () => { cmapDrag = null; cmapFrame.classList.remove('dragging'); });
}
document.getElementById('cmap-close').onclick = closeCmap;
cmap.addEventListener('click', (e) => { if (e.target === cmap) closeCmap(); });
document.addEventListener('click', (e) => {
  const img = e.target.closest ? e.target.closest('img.flag') : null;
  if (!img || img.closest('#lightbox')) return;
  const iso = isoFromFlag(img);
  if (iso) openCountryMap(iso);
});
function openLB(src, cap) { lbImg.src = src; lbImg.alt = cap; lbCap.textContent = cap; lb.hidden = false; }
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hi(text, q) {
  if (!q) return text;
  try { return text.replace(new RegExp(`(${esc(q)})`, 'ig'), '<mark>$1</mark>'); }
  catch { return text; }
}
function countryName(iso) {
  const c = countries.find(x => x.iso === iso);
  if (!c) return iso;
  return getLang() === 'es' ? c.es : c.en;
}
function countryEntry(iso) {
  return countries.find(x => x.iso === iso) || null;
}
// Estándar visual único: bandera + siglas + nombre entero, siempre juntos
function countryBadge(iso, big = false, nameHTML = null) {
  const c = countryEntry(iso);
  const code = c ? c.iso : iso;
  const name = nameHTML !== null ? nameHTML : (c ? (getLang() === 'es' ? c.es : c.en) : iso);
  return `<span class="cbadge${big ? ' big' : ''}"><img class="flag xs" src="${flagURL(code)}" alt="" loading="lazy" onerror="this.style.display='none'" /><b>${code}</b><span>${name}</span></span>`;
}
function hasPlate(iso) { return plates.some(p => p.iso === iso); }
function hasBol(iso) { return bollards.some(b => b.countries.includes(iso)); }
function hasPole(iso) { return poles.some(p => p.countries.includes(iso)); }
function hasScript(iso) { return scripts.some(s => s.countries.includes(iso)); }
function phoneNote(iso) {
  const p = phones.find(x => x.iso === iso);
  return p ? p[getLang()] : '';
}
function driveChip(iso) {
  const c = countryEntry(iso);
  if (!c) return '';
  const left = c.drive === 'left';
  const label = left ? t('dLeft') : t('dRight');
  return `<span class="tag drive" title="${label}"><i class="fa-solid ${left ? 'fa-arrow-left' : 'fa-arrow-right'}"></i><span class="vh">${label}</span></span>`;
}
function stagger(i) { return `style="animation-delay:${Math.min(i * 35, 420)}ms"`; }
function bindLB(scope) {
  scope.querySelectorAll('img[data-src]').forEach(im => {
    im.onclick = () => openLB(im.dataset.src, im.dataset.cap || '');
  });
}
function contOptions(sel) {
  return ['all', ...CONTINENTS]
    .map(c => `<option value="${c}" ${sel === c ? 'selected' : ''}>${c === 'all' ? '<i class="fa-solid fa-globe"></i> All' : c}</option>`).join('');
}
function photosStrip(items) {
  if (!items.length) return '';
  return `<h3><i class="fa-solid fa-camera"></i> ${t('photosTitle')}</h3>
    <div class="photostrip">${items.map(p => `
      <figure class="anim"><img loading="lazy" src="./${p.src}" alt="${p.cap}" data-src="./${p.src}" data-cap="${p.cap} — © ${p.author}" />
      <figcaption>${p.cap}<br /><small>© ${p.author} · ${p.license}</small></figcaption></figure>`).join('')}</div>`;
}

// ---------- nav ----------
function renderSections(active) {
  const L = getLang();
  secsEl.innerHTML = SECTIONS.map(s =>
    `<a href="#/${L}${s.id === 'home' ? '' : '/' + s.id}" class="sec-link ${active === s.id ? 'active' : ''}">${s.icon} ${s.label()}</a>`
  ).join('');
}

// ---------- home ----------
function renderHome() {
  const L = getLang();
  const cards = [
    { href: 'plates', icon: '<i class="fa-solid fa-id-card"></i>', n: plates.length, title: t('secPlates'), desc: t('toolPlatesDesc') },
    { href: 'bollards', icon: '<i class="fa-solid fa-road-barrier"></i>', n: bollards.length, title: t('secBollards'), desc: t('toolBollardsDesc') },
    { href: 'poles', icon: '<i class="fa-solid fa-broadcast-tower"></i>', n: poles.length, title: t('secPoles'), desc: t('toolPolesDesc') },
    { href: 'scripts', icon: '<i class="fa-solid fa-language"></i>', n: scripts.length, title: t('secScripts'), desc: t('toolScriptsDesc') },
    { href: 'countries', icon: '<i class="fa-solid fa-earth-americas"></i>', n: countries.filter(c => c.geo).length, title: t('secCountries'), desc: t('toolCountriesDesc') }
  ];
  app.innerHTML = `
  <header class="hero hero-gg anim">
    <canvas id="hero-canvas" aria-hidden="true"></canvas>
    <div class="hero-scrim"></div>
    <div class="hero-copy">
      <h1 class="display">${L === 'es' ? 'Lee la calle.<br/>Clava el <em>país</em>.' : 'Read the street.<br/>Nail the <em>country</em>.'}</h1>
      <p class="lede">${t('homeSub')}</p>
    </div>
  </header>
  <div class="tools">${cards.map((c, i) => `
    <a class="tool-card anim" href="#/${L}/${c.href}" ${stagger(i * 2)}>
      <span class="tool-top"><span class="tool-icon">${c.icon}</span><span class="exp-num">${c.n}</span></span>
      <h3>${c.title}</h3><p>${c.desc}</p><span class="tool-go">${t('toolGo')}</span>
    </a>`).join('')}</div>
`;
  if (window.__heroCleanup) { window.__heroCleanup(); window.__heroCleanup = null; }
  const heroToken = (window.__heroToken = (window.__heroToken || 0) + 1);
  if (document.getElementById('hero-canvas')) {
    import('./hero-globe.js').then((m) => {
      if (window.__heroToken !== heroToken || !document.getElementById('hero-canvas')) return;
      window.__heroCleanup = m.initHeroGlobe(document.getElementById('hero-canvas'));
    }).catch(() => {});
  }
}

// ---------- identificador (memoria activa) ----------
function bolBase(b) {
  const c = (b.base || '').toLowerCase();
  if (['#f8fafc', '#e2e8f0', '#ffffff'].includes(c)) return 'white';
  if (c === '#111827') return 'black';
  return 'color';
}
function bolRed(b) {
  if ((b.top || '').toLowerCase() === '#dc2626') return true;
  return (b.bands || []).some(s => (s.c || '').toLowerCase() === '#dc2626');
}
const ID_CONFIG = {
  plates: {
    steps: [
      {
        key: 'color',
        es: '¿De qué color es la matrícula?', en: 'What color is the plate?',
        sub: { es: 'Mira el difuminado, no el texto', en: 'Read the blur, not the text' },
        options: [
          { v: 'yellow', sw: '#FACC15', es: 'Amarilla (delante o detrás)', en: 'Yellow (front or rear)' },
          { v: 'white', sw: '#FFFFFF', es: 'Blanca delante y detrás', en: 'White front and rear' },
          { v: 'red', sw: '#B91C1C', es: 'Roja', en: 'Red' },
          { v: 'black', sw: '#151515', es: 'Negra (texto blanco)', en: 'Black (white text)' }
        ]
      },
      {
        key: 'band',
        es: '¿Qué franja lleva?', en: 'What band does it carry?',
        sub: { es: 'El detalle que separa Europa', en: 'The detail that splits Europe' },
        options: [
          { v: 'eu', sw: '#1D4ED8', es: 'Azul a la izquierda (UE)', en: 'Blue on the left (EU)' },
          { v: 'dual', sw: '#1D4ED8', es: 'Azul en ambos lados', en: 'Blue on both sides' },
          { v: 'mercosur', sw: '#1D4ED8', es: 'Azul arriba (Mercosur)', en: 'Blue on top (Mercosur)' },
          { v: 'other', sw: '#9AA6C7', es: 'Sin banda / otra', en: 'No band / other' }
        ]
      },
      {
        key: 'continent',
        es: '¿En qué continente estás?', en: 'Which continent are you on?',
        sub: { es: 'Cruza con vegetación e idioma', en: 'Cross-check with vegetation and language' },
        options: CONTINENTS.map(c => ({ v: c, sw: null, es: c, en: c }))
      }
    ],
    match: (p, a) => {
      if (a.color && plateColorFamily(p) !== a.color) return false;
      if (a.band && (a.band === 'other' ? !['none', 'tr'].includes(p.band) : p.band !== a.band)) return false;
      if (a.continent && p.continent !== a.continent) return false;
      return true;
    }
  },
  bollards: {
    steps: [
      {
        key: 'base',
        es: '¿De qué color es el poste?', en: 'What color is the post?',
        sub: { es: 'El cuerpo, sin contar reflectantes', en: 'The body, ignoring reflectors' },
        options: [
          { v: 'white', sw: '#F8FAFC', es: 'Blanco / gris claro', en: 'White / light gray' },
          { v: 'black', sw: '#111827', es: 'Negro', en: 'Black' },
          { v: 'color', sw: '#16A34A', es: 'De color (verde, naranja, piedra…)', en: 'Colored (green, orange, stone…)' }
        ]
      },
      {
        key: 'red',
        es: '¿Lleva rojo?', en: 'Does it carry red?',
        sub: { es: 'Franja, tope o reflector rojo', en: 'Red band, top or reflector' },
        options: [
          { v: 'yes', sw: '#DC2626', es: 'Sí, hay rojo', en: 'Yes, there is red' },
          { v: 'no', sw: '#FFFFFF', es: 'No hay rojo', en: 'No red' }
        ]
      },
      {
        key: 'continent',
        es: '¿En qué continente estás?', en: 'Which continent are you on?',
        sub: { es: 'Cruza con idioma y paisaje', en: 'Cross-check with language and landscape' },
        options: CONTINENTS.map(c => ({ v: c, sw: null, es: c, en: c }))
      }
    ],
    match: (b, a) => {
      if (a.base && bolBase(b) !== a.base) return false;
      if (a.red && (bolRed(b) ? 'yes' : 'no') !== a.red) return false;
      if (a.continent && b.continent !== a.continent) return false;
      return true;
    }
  },
  poles: {
    steps: [
      {
        key: 'material',
        es: '¿De qué material es el poste?', en: 'What is the pole made of?',
        sub: { es: 'Madera, hormigón o metal a simple vista', en: 'Wood, concrete or metal at a glance' },
        options: [
          { v: 'wood', sw: '#8A6B4A', es: 'Madera', en: 'Wood' },
          { v: 'concrete', sw: '#C9CED8', es: 'Hormigón', en: 'Concrete' },
          { v: 'metal', sw: '#7D8AA0', es: 'Metal (celosía)', en: 'Metal (lattice)' }
        ]
      },
      {
        key: 'arms',
        es: '¿Lleva cruceta?', en: 'Does it carry a crossarm?',
        sub: { es: 'El travesaño horizontal de arriba', en: 'The horizontal bar at the top' },
        options: [
          { v: 'yes', sw: '#8A6B4A', es: 'Sí, con cruceta', en: 'Yes, with crossarm' },
          { v: 'no', sw: '#1c1840', es: 'Sin cruceta', en: 'No crossarm' }
        ]
      },
      {
        key: 'continent',
        es: '¿En qué continente estás?', en: 'Which continent are you on?',
        sub: { es: 'Cruza con idioma y matrícula', en: 'Cross-check with language and plates' },
        options: CONTINENTS.map(c => ({ v: c, sw: null, es: c, en: c }))
      }
    ],
    match: (p, a) => {
      if (a.material && p.material !== a.material) return false;
      if (a.arms && (p.arms ? 'yes' : 'no') !== a.arms) return false;
      if (a.continent && p.continent !== a.continent) return false;
      return true;
    }
  }
};
function practiceHTML(type) {
  const L = getLang();
  const cfg = ID_CONFIG[type];
  const answers = IDA[type];
  const pool = { plates, bollards, poles }[type] || [];
  const cands = pool.filter(x => cfg.match(x, answers));
  const answered = cfg.steps.filter(s => answers[s.key] !== undefined);
  const next = cfg.steps.find(s => answers[s.key] === undefined);
  const dots = `<div class="id-progress">${cfg.steps.map(s =>
    `<div class="id-dot ${answers[s.key] !== undefined ? 'done' : (s === next ? 'now' : '')}"></div>`).join('')}</div>`;
  const chips = answered.length ? `<div class="id-answers">${answered.map(s => {
    const opt = s.options.find(o => o.v === answers[s.key]);
    return `<button class="ans-chip" data-k="${s.key}">${s[L]}: <b>${opt ? opt[L] : ''}</b> <i class="fa-solid fa-xmark"></i></button>`;
  }).join('')}</div>` : '';
  let body = '';
  if (next) {
    const idx = cfg.steps.indexOf(next);
    body = `<p class="muted">${t('idStepOf')} ${idx + 1} / ${cfg.steps.length}</p>
      <h2 class="id-q anim">${next[L]}</h2><p class="muted">${next.sub[L]}</p>
      <div class="idopts">${next.options.map((o, i) => `
        <button class="opt anim" data-k="${next.key}" data-v="${o.v}" style="animation-delay:${Math.min(i * 60, 300)}ms">
          ${o.sw ? `<span class="swatch" style="background:${o.sw}"></span>` : ''}<span>${o[L]}</span>
        </button>`).join('')}</div>`;
  }
  const cards = cands.length && cands.length <= 12 ? `<div class="grid">${
    type === 'plates'
      ? cands.map((p, i) => `<article class="card anim" ${stagger(i)}><div class="svgwrap platewrap">${renderPlate(p)}</div><div class="pad"><div class="meta"><span class="tag ct"><b>${p.iso}</b> · ${countryName(p.iso)}</span></div><p>${p[L]}</p></div></article>`).join('')
      : type === 'bollards'
      ? cands.map((b, i) => `<article class="card bol-card anim" ${stagger(i)}>${bolImg(b)}<div class="pad"><div class="meta"><span class="tag ct"><b>${b.countries.join(' · ')}</b></span></div><p>${b[L]}</p></div></article>`).join('')
      : cands.map((p, i) => `<article class="card bol-card anim" ${stagger(i)}>${polImg(p)}<div class="pad"><div class="meta"><span class="tag ct"><b>${p.countries.join(' · ')}</b></span></div><p>${p[L]}</p></div></article>`).join('')
  }</div>` : '';
  return `${dots}${chips}${body}
    <div class="id-count"><i class="fa-solid fa-bullseye"></i> ${cands.length} ${t('candidates')}</div>${cards}
    <div class="id-actions"><button class="btn" data-reset><i class="fa-solid fa-rotate-left"></i> ${t('resetId')}</button></div>`;
}
function bindPractice(type) {
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    IDA[type][b.dataset.k] = b.dataset.v;
    rerenderSection();
  });
  app.querySelectorAll('.ans-chip').forEach(b => b.onclick = () => {
    delete IDA[type][b.dataset.k];
    rerenderSection();
  });
  const r = app.querySelector('[data-reset]');
  if (r) r.onclick = () => { IDA[type] = {}; rerenderSection(); };
  if (type === 'bollards' || type === 'poles') ensureBol3D();
}

// ---------- matrículas ----------
function plateList() {
  const q = F.plateQ.trim().toLowerCase();
  return plates.filter(p => {
    if (F.plateDuel !== 'all') {
      const d = DUELS.plates[Number(F.plateDuel)];
      if (!d.isos.includes(p.iso)) return false;
    }
    if (F.plateCont !== 'all' && p.continent !== F.plateCont) return false;
    if (F.plateColor !== 'all' && plateColorFamily(p) !== F.plateColor) return false;
    if (q && !`${p.iso} ${p.format} ${p.es} ${p.en} ${countryName(p.iso)}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderPlates() {
  const L = getLang();
  const tab = F.plateTab;
  const tabs = `<div class="id-tabs">
      <button class="id-tab ${tab === 'archive' ? 'on' : ''}" data-tab="archive"><i class="fa-solid fa-box-archive"></i> ${t('tabArchive')}</button>
      <button class="id-tab ${tab === 'practice' ? 'on' : ''}" data-tab="practice"><i class="fa-solid fa-brain"></i> ${t('tabPractice')}</button>
    </div>`;
  if (tab === 'practice') {
    app.innerHTML = `<h1 class="anim">${t('toolPlatesTitle')}</h1><p class="muted">${t('toolPlatesDesc')}</p>${tabs}${practiceHTML('plates')}`;
    app.querySelectorAll('.id-tab').forEach(b => b.onclick = () => { F.plateTab = b.dataset.tab; rerenderSection(); });
    bindPractice('plates');
    return;
  }
  const list = plateList();
  const duels = [`<button class="chip ${F.plateDuel === 'all' ? 'on' : ''}" data-duel="all">${t('allColors')}</button>`,
    ...DUELS.plates.map((d, i) => `<button class="chip duel ${F.plateDuel === String(i) ? 'on' : ''}" data-duel="${i}"><i class="fa-solid fa-bolt"></i> ${d[L]}</button>`)].join('');
  app.innerHTML = `<h1 class="anim">${t('platesTitle')}</h1><p class="muted">${t('platesSub')}</p>
    ${tabs}
    <div class="filters">
      <div class="chips" role="group"><span class="flabel"><i class="fa-solid fa-bolt"></i> ${t('duelTitle')}:</span>${duels}</div>
      <label>${t('fContinent')}: <select id="fp-cont">${contOptions(F.plateCont)}</select></label>
      <div class="chips" role="group">
        ${[['all', t('allColors')], ['yellow', '<span class="swdot" style="background:#FACC15"></span>' + t('cYellow')], ['white', '<span class="swdot" style="background:#FFFFFF"></span>' + t('cWhite')], ['red', '<span class="swdot" style="background:#B91C1C"></span>' + t('cRed')], ['black', '<span class="swdot" style="background:#151515;border:1px solid #555"></span>' + t('cBlack')]]
          .map(([v, l]) => `<button class="chip ${F.plateColor === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}
      </div>
      <input id="fp-q" type="search" placeholder="${L === 'es' ? 'Filtrar: NL, amarilla, banda…' : 'Filter: NL, yellow, band…'}" value="${F.plateQ.replace(/"/g, '&quot;')}" />
      <button class="chip ${F.plateBlur ? 'on' : ''}" id="fp-blur" title="${t('blurHint')}"><i class="fa-solid ${F.plateBlur ? 'fa-eye-slash' : 'fa-eye'}"></i> ${t('blurLabel')}</button>
    </div>
    <p class="muted">${list.length} ${t('results')}</p>
    <div class="grid">${list.map((p, i) => `
      <article class="card anim" ${stagger(i)}>
        <div class="svgwrap platewrap">${renderPlate(p)}</div>
        <div class="pad">
          <div class="meta">${countryBadge(p.iso)}<span class="tag">${p.continent}</span><span class="tag mono">${p.format}</span></div>
          <p>${p[L]}</p>
        </div>
      </article>`).join('') || `<p>${t('noResults')}</p>`}</div>
    ${photosStrip([
      { src: 'img/plates/uk-white-yellow.webp', cap: 'UK: blanca + amarilla', author: 'Kaihsu Tai', license: 'CC BY-SA 3.0' },
      { src: 'img/plates/nl-yellow.webp', cap: 'NL: amarilla + banda', author: 'Dinsdagskind', license: 'CC BY-SA 3.0' }
    ])}`;
  app.querySelectorAll('.id-tab').forEach(b => b.onclick = () => { F.plateTab = b.dataset.tab; rerenderSection(); });
  app.querySelectorAll('[data-duel]').forEach(b => b.onclick = () => { F.plateDuel = b.dataset.duel; rerenderSection(); });
  document.getElementById('fp-cont').onchange = (e) => { F.plateCont = e.target.value; rerenderSection(); };
  app.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { F.plateColor = b.dataset.v; rerenderSection(); });
  const q = document.getElementById('fp-q');
  q.oninput = (e) => { F.plateQ = e.target.value; renderPlates(); keepFocus('fp-q'); };
  document.getElementById('fp-blur').onclick = () => {
    F.plateBlur = !F.plateBlur;
    document.body.classList.toggle('noblur', !F.plateBlur);
    rerenderSection();
  };
  bindLB(app);
}
function keepFocus(id) {
  const n = document.getElementById(id);
  if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
}

// ---------- bollards ----------
function bolList() {
  const q = F.bolQ.trim().toLowerCase();
  return bollards.filter(b => {
    if (F.bolDuel !== 'all') {
      const d = DUELS.bollards[Number(F.bolDuel)];
      if (!b.countries.some(c => d.isos.includes(c))) return false;
    }
    if (F.bolCont !== 'all' && b.continent !== F.bolCont) return false;
    if (q && !`${b.countries.join(' ')} ${b.es} ${b.en} ${b.countries.map(countryName).join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderBollards() {
  const L = getLang();
  const tab = F.bolTab;
  const tabs = `<div class="id-tabs">
      <button class="id-tab ${tab === 'archive' ? 'on' : ''}" data-tab="archive"><i class="fa-solid fa-box-archive"></i> ${t('tabArchive')}</button>
      <button class="id-tab ${tab === 'practice' ? 'on' : ''}" data-tab="practice"><i class="fa-solid fa-brain"></i> ${t('tabPractice')}</button>
    </div>`;
  if (tab === 'practice') {
    app.innerHTML = `<h1 class="anim">${t('toolBollardsTitle')}</h1><p class="muted">${t('toolBollardsDesc')}</p>${tabs}${practiceHTML('bollards')}`;
    app.querySelectorAll('.id-tab').forEach(b => b.onclick = () => { F.bolTab = b.dataset.tab; rerenderSection(); });
    bindPractice('bollards');
    return;
  }
  const list = bolList();
  const duels = [`<button class="chip ${F.bolDuel === 'all' ? 'on' : ''}" data-duel="all">${t('allColors')}</button>`,
    ...DUELS.bollards.map((d, i) => `<button class="chip duel ${F.bolDuel === String(i) ? 'on' : ''}" data-duel="${i}"><i class="fa-solid fa-bolt"></i> ${d[L]}</button>`)].join('');
  app.innerHTML = `<h1 class="anim">${t('bollardsTitle')}</h1><p class="muted">${t('bollardsSub')}</p>
    ${tabs}
    <div class="filters">
      <div class="chips" role="group"><span class="flabel"><i class="fa-solid fa-bolt"></i> ${t('duelTitle')}:</span>${duels}</div>
      <label>${t('fContinent')}: <select id="fb-cont">${contOptions(F.bolCont)}</select></label>
      <input id="fb-q" type="search" placeholder="${L === 'es' ? 'Filtrar: DK, rojo, Alberta…' : 'Filter: DK, red, Alberta…'}" value="${F.bolQ.replace(/"/g, '&quot;')}" />
    </div>
    <p class="muted">${list.length} ${t('results')}</p>
    <div class="grid bol-grid">${list.map((b, i) => `
      <article class="card bol-card anim" ${stagger(i)}>
        ${bolImg(b)}
        <div class="pad">
          <div class="meta">${b.countries.map(c => countryBadge(c)).join('')}</div>
          <p>${b[L]}</p>
          ${b.compare ? `<button class="btn cmpbtn" data-bol="${b.id}"><i class="fa-solid fa-scale-balanced"></i> ${t('compareBtn')}</button>` : ''}
        </div>
      </article>`).join('') || `<p>${t('noResults')}</p>`}</div>
    ${photosStrip([
      { src: 'img/bollards/delineator-us.webp', cap: 'Delineador USA', author: 'Oregon DOT', license: 'CC BY 2.0' }
    ])}`;
  app.querySelectorAll('.id-tab').forEach(b => b.onclick = () => { F.bolTab = b.dataset.tab; rerenderSection(); });
  app.querySelectorAll('[data-duel]').forEach(b => b.onclick = () => { F.bolDuel = b.dataset.duel; rerenderSection(); });
  app.querySelectorAll('.cmpbtn[data-bol]').forEach(b => b.onclick = () => openBolCmp(b.dataset.bol));
  document.getElementById('fb-cont').onchange = (e) => { F.bolCont = e.target.value; rerenderSection(); };
  const q = document.getElementById('fb-q');
  q.oninput = (e) => { F.bolQ = e.target.value; renderBollards(); keepFocus('fb-q'); };
  ensureBol3D();
}

// ---------- postes ----------
function polList() {
  const q = F.polQ.trim().toLowerCase();
  return poles.filter(p => {
    if (F.polCont !== 'all' && p.continent !== F.polCont) return false;
    if (F.polMat !== 'all' && p.material !== F.polMat) return false;
    if (q && !`${p.countries.join(' ')} ${p.es} ${p.en} ${p.countries.map(countryName).join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderPoles() {
  const L = getLang();
  const tab = F.polTab;
  const tabs = `<div class="id-tabs">
      <button class="id-tab ${tab === 'archive' ? 'on' : ''}" data-tab="archive"><i class="fa-solid fa-box-archive"></i> ${t('tabArchive')}</button>
      <button class="id-tab ${tab === 'practice' ? 'on' : ''}" data-tab="practice"><i class="fa-solid fa-brain"></i> ${t('tabPractice')}</button>
    </div>`;
  if (tab === 'practice') {
    app.innerHTML = `<h1 class="anim">${t('toolPolesTitle')}</h1><p class="muted">${t('toolPolesDesc')}</p>${tabs}${practiceHTML('poles')}`;
    app.querySelectorAll('.id-tab').forEach(b => b.onclick = () => { F.polTab = b.dataset.tab; rerenderSection(); });
    bindPractice('poles');
    return;
  }
  const list = polList();
  const mats = [
    ['all', t('allColors')],
    ['wood', `<span class="swdot" style="background:${poleMaterialColor('wood')}"></span>${t('cWood')}`],
    ['concrete', `<span class="swdot" style="background:${poleMaterialColor('concrete')}"></span>${t('cConcrete')}`],
    ['metal', `<span class="swdot" style="background:${poleMaterialColor('metal')}"></span>${t('cMetal')}`]
  ].map(([v, l]) => `<button class="chip ${F.polMat === v ? 'on' : ''}" data-mat="${v}">${l}</button>`).join('');
  app.innerHTML = `<h1 class="anim">${t('polesTitle')}</h1><p class="muted">${t('polesSub')}</p>
    ${tabs}
    <div class="filters">
      <label>${t('fContinent')}: <select id="fp-cont">${contOptions(F.polCont)}</select></label>
      <div class="chips" role="group"><span class="flabel">${t('fMaterial')}:</span>${mats}</div>
      <input id="fp-q" type="search" placeholder="${L === 'es' ? 'Filtrar: madera, cruceta, JP…' : 'Filter: wood, crossarm, JP…'}" value="${F.polQ.replace(/"/g, '&quot;')}" />
    </div>
    <p class="muted">${list.length} ${t('results')}</p>
    <div class="grid">${list.map((p, i) => `
      <article class="card bol-card anim" ${stagger(i)}>
        ${polImg(p)}
        <div class="pad">
          <div class="meta">${p.countries.map(c => countryBadge(c)).join('')}</div>
          <p>${p[L]}</p>
        </div>
      </article>`).join('') || `<p>${t('noResults')}</p>`}</div>`;
  app.querySelectorAll('.id-tab').forEach(b => b.onclick = () => { F.polTab = b.dataset.tab; rerenderSection(); });
  app.querySelectorAll('[data-mat]').forEach(b => b.onclick = () => { F.polMat = b.dataset.mat; rerenderSection(); });
  document.getElementById('fp-cont').onchange = (e) => { F.polCont = e.target.value; rerenderSection(); };
  const q = document.getElementById('fp-q');
  q.oninput = (e) => { F.polQ = e.target.value; renderPoles(); keepFocus('fp-q'); };
  ensureBol3D();
}

// ---------- teléfonos (datos para Países) ----------
function countryPhoneNum(c) { return parseInt((c.phone || '').replace(/\D/g, ''), 10) || 0; }

// ---------- idiomas ----------
let SQ = null;
let STREAK = 0;
function newQuiz() {
  const pool = [...scripts];
  const entry = pool[Math.floor(Math.random() * pool.length)];
  const others = pool.filter(s => s.id !== entry.id).sort(() => Math.random() - 0.5).slice(0, 3);
  SQ = { entry, options: [...others, entry].sort(() => Math.random() - 0.5), picked: null };
}
function scriptList() {
  const q = F.scriptQ.trim().toLowerCase();
  return scripts.filter(s => {
    if (q && !`${s.id} ${s.sample} ${s.countries.join(' ')} ${s.es.name} ${s.es.look} ${s.en.name} ${s.en.look}`.toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderScripts() {
  const L = getLang();
  const tab = F.scriptTab;
  const tabs = `<div class="id-tabs">
      <button class="id-tab ${tab === 'archive' ? 'on' : ''}" data-tab="archive"><i class="fa-solid fa-box-archive"></i> ${t('tabArchive')}</button>
      <button class="id-tab ${tab === 'practice' ? 'on' : ''}" data-tab="practice"><i class="fa-solid fa-brain"></i> ${t('tabPractice')}</button>
    </div>`;
  if (tab === 'practice') {
    if (!SQ) newQuiz();
    const q = SQ;
    const opts = q.options.map(o => {
      const cls = q.picked === null ? '' : (o.id === q.entry.id ? 'ok' : (o.id === q.picked ? 'bad' : 'dim'));
      return `<button class="opt quiz-opt ${cls}" data-id="${o.id}" ${q.picked !== null ? 'disabled' : ''}><span>${o[L].name}</span></button>`;
    }).join('');
    const fb = q.picked === null ? '' : q.picked === q.entry.id
      ? `<div class="quiz-fb good"><i class="fa-solid fa-check"></i> ${t('goodJob')} — ${q.entry[L].look}</div>`
      : `<div class="quiz-fb bad"><i class="fa-solid fa-xmark"></i> ${t('tryAgain')}: <b>${q.entry[L].name}</b> — ${q.entry[L].look}</div>`;
    app.innerHTML = `<h1 class="anim">${t('qScript')}</h1>
      <p class="muted">${t('quizSub')}</p>${tabs}
      <div class="quiz-top"><span class="id-count"><i class="fa-solid fa-fire"></i> ${STREAK} ${t('streakLabel')}</span></div>
      <div class="quiz-sample anim" dir="auto">${q.entry.sample}</div>
      <div class="idopts">${opts}</div>${fb}
      <div class="id-actions">${q.picked !== null ? `<button class="btn btn-primary" id="quiz-next">${t('nextQ')} →</button>` : ''}
      <button class="btn" id="quiz-reset"><i class="fa-solid fa-rotate-left"></i> ${t('resetId')}</button></div>`;
    app.querySelectorAll('.quiz-opt').forEach(b => b.onclick = () => {
      q.picked = b.dataset.id;
      if (b.dataset.id === q.entry.id) STREAK++;
      else STREAK = 0;
      renderScripts();
    });
    const nx = document.getElementById('quiz-next');
    if (nx) nx.onclick = () => { newQuiz(); renderScripts(); };
    document.getElementById('quiz-reset').onclick = () => { STREAK = 0; newQuiz(); renderScripts(); };
    app.querySelectorAll('.id-tab').forEach(b => b.onclick = () => { F.scriptTab = b.dataset.tab; rerenderSection(); });
    return;
  }
  const list = scriptList();
  app.innerHTML = `<h1 class="anim">${t('scriptsTitle')}</h1><p class="muted">${t('scriptsSub')}</p>
    ${tabs}
    <div class="filters">
      <input id="fs-q" type="search" placeholder="${L === 'es' ? 'Filtrar: cirílico, thai, kana…' : 'Filter: cyrillic, thai, kana…'}" value="${F.scriptQ.replace(/"/g, '&quot;')}" />
    </div>
    <p class="muted">${list.length} ${t('results')}</p>
    <div class="grid">${list.map((s, i) => `
      <article class="card anim" ${stagger(i)}>
        <div class="quiz-sample sm" dir="auto">${s.sample}</div>
        <div class="pad">
          <h3>${s[L].name}</h3>
          <div class="meta">${s.countries.map(c => countryBadge(c)).join('')}</div>
          <p><span class="kv"><b>${t('look')}:</b></span> ${s[L].look}</p>
          <p><span class="kv"><b>${t('dontConfuse')}:</b></span> ${s[L].confuse}</p>
          ${s.compare ? `<button class="btn cmpbtn" data-id="${s.id}"><i class="fa-solid fa-scale-balanced"></i> ${t('compareBtn')}</button>` : ''}
        </div>
      </article>`).join('') || `<p>${t('noResults')}</p>`}</div>`;
  app.querySelectorAll('.id-tab').forEach(b => b.onclick = () => { F.scriptTab = b.dataset.tab; rerenderSection(); });
  app.querySelectorAll('.cmpbtn').forEach(b => b.onclick = () => openCmp(b.dataset.id));
  const qi = document.getElementById('fs-q');
  qi.oninput = (e) => { F.scriptQ = e.target.value; renderScripts(); keepFocus('fs-q'); };
}

// ---------- países ----------
function countryList() {
  const q = F.ctryQ.trim().toLowerCase();
  const loc = getLang() === 'es' ? 'es' : 'en';
  return countries
    .filter(c => c.geo)
    .filter(c => F.ctryCont === 'all' || c.continent === F.ctryCont)
    .filter(c => F.ctryDrive === 'all' || c.drive === F.ctryDrive)
    .filter(c => !q || `${c.iso} ${c.es} ${c.en} ${c.phone}`.toLowerCase().includes(q.replace('+', '')))
    .sort((a, b) => a[loc].localeCompare(b[loc], loc));
}
function contentLinks(iso) {
  const links = [];
  if (hasPlate(iso)) links.push(`<button class="clink" data-sec="plates" data-iso="${iso}" title="${t('secPlates')}"><i class="fa-solid fa-id-card"></i></button>`);
  if (hasBol(iso)) links.push(`<button class="clink" data-sec="bollards" data-iso="${iso}" title="${t('secBollards')}"><i class="fa-solid fa-road-barrier"></i></button>`);
  if (hasPole(iso)) links.push(`<button class="clink" data-sec="poles" data-iso="${iso}" title="${t('secPoles')}"><i class="fa-solid fa-broadcast-tower"></i></button>`);
  if (hasScript(iso)) links.push(`<button class="clink" data-sec="scripts" data-iso="${iso}" title="${t('secScripts')}"><i class="fa-solid fa-language"></i></button>`);
  return links.length ? `<div class="clinks"><span>${t('seeIn')}:</span>${links.join('')}</div>` : '';
}
function goFiltered(sec, iso) {
  if (sec === 'plates') { F.plateTab = 'archive'; F.plateQ = iso; F.plateDuel = 'all'; F.plateCont = 'all'; F.plateColor = 'all'; }
  if (sec === 'bollards') { F.bolTab = 'archive'; F.bolQ = iso; F.bolDuel = 'all'; F.bolCont = 'all'; }
  if (sec === 'poles') { F.polTab = 'archive'; F.polQ = iso; F.polCont = 'all'; F.polMat = 'all'; }
  if (sec === 'scripts') { F.scriptTab = 'archive'; F.scriptQ = iso; }
  location.hash = `#/${getLang()}/${sec}`;
}
function sortCountries(list) {
  const loc = getLang() === 'es' ? 'es' : 'en';
  const dir = F.ctrySort.dir === 'desc' ? -1 : 1;
  const val = (c) => {
    switch (F.ctrySort.key) {
      case 'iso': return c.iso;
      case 'phone': return countryPhoneNum(c);
      case 'drive': return c.drive;
      case 'domain': return c.domain || '';
      default: return c[loc];
    }
  };
  return [...list].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (typeof va === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), loc) * dir;
  });
}
function thLabel(key, label) {
  const on = F.ctrySort.key === key;
  const arrow = on ? (F.ctrySort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<th class="sortable${on ? ' on' : ''}" data-sort="${key}">${label}${arrow}</th>`;
}
function renderCountries() {
  const L = getLang();
  const list = sortCountries(countryList());
  app.innerHTML = `<h1 class="anim">${t('countriesTitle')}</h1><p class="muted">${t('countriesSub')}</p>
    <div class="filters">
      <input id="fc-q" type="search" placeholder="${t('ctryPh')}" value="${F.ctryQ.replace(/"/g, '&quot;')}" />
      <label>${t('fContinent')}: <select id="fc-cont">${contOptions(F.ctryCont)}</select></label>
      <div class="chips" role="group">
        ${[['all', t('allColors')], ['left', '◀ ' + t('dLeft')], ['right', t('dRight') + ' ▶']]
          .map(([v, l]) => `<button class="chip ${F.ctryDrive === v ? 'on' : ''}" data-drive="${v}">${l}</button>`).join('')}
      </div>
    </div>
    <p class="muted">${list.length} ${t('results')} · ${t('sortHint')}</p>
    <div class="tablewrap anim"><table class="phones sortable">
      <thead><tr>
        <th>${t('thFlag')}</th>${thLabel('iso', t('thCode2'))}${thLabel('name', t('thCountry'))}${thLabel('phone', t('thCode'))}${thLabel('domain', t('thDomain'))}${thLabel('drive', t('thDrive'))}<th>${t('thInfo')}</th>
      </tr></thead>
      <tbody>${list.map(c => {
        const note = phoneNote(c.iso) || (c[L === 'es' ? 'note_es' : 'note_en'] || '—');
        return `<tr>
          <td><img class="flag xs" src="${flagURL(c.iso)}" alt="${c.iso}" loading="lazy" onerror="this.style.display='none'" /></td>
          <td class="code sm">${c.iso}</td>
          <td><b>${c[nameKey()]}</b></td>
          <td><button class="copybtn sm" data-code="${c.phone}" title="${t('copyCode')}">${c.phone}</button></td>
          <td class="code sm domain">${c.domain || '—'}</td>
          <td>${driveChip(c.iso)}</td>
          <td class="note">${note}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  const qi = document.getElementById('fc-q');
  qi.oninput = (e) => { F.ctryQ = e.target.value; renderCountries(); keepFocus('fc-q'); };
  document.getElementById('fc-cont').onchange = (e) => { F.ctryCont = e.target.value; rerenderSection(); };
  app.querySelectorAll('[data-drive]').forEach(b => b.onclick = () => { F.ctryDrive = b.dataset.drive; rerenderSection(); });
  app.querySelectorAll('th.sortable').forEach(th => th.onclick = () => {
    const k = th.dataset.sort;
    if (F.ctrySort.key === k) F.ctrySort.dir = F.ctrySort.dir === 'asc' ? 'desc' : 'asc';
    else F.ctrySort = { key: k, dir: 'asc' };
    rerenderSection();
  });
  app.querySelectorAll('.copybtn').forEach(b => b.onclick = () => copyCode(b.dataset.code));
  app.querySelectorAll('.clink').forEach(b => b.onclick = () => goFiltered(b.dataset.sec, b.dataset.iso));
}
function nameKey() { return getLang() === 'es' ? 'es' : 'en'; }

// ---------- global search ----------
function renderSearch(raw) {
  const L = getLang();
  const q = raw.trim().toLowerCase();
  const pl = plates.filter(p => `${p.iso} ${p.format} ${p.es} ${p.en} ${countryName(p.iso)}`.toLowerCase().includes(q));
  const bo = bollards.filter(b => `${b.countries.join(' ')} ${b.es} ${b.en}`.toLowerCase().includes(q));
  const po = poles.filter(p => `${p.countries.join(' ')} ${p.es} ${p.en} ${p.countries.map(countryName).join(' ')}`.toLowerCase().includes(q));
  const co = countries.filter(c => c.geo && `${c.iso} ${c.es} ${c.en} ${c.phone}`.toLowerCase().includes(q.replace('+', '')));
  const total = pl.length + bo.length + po.length + sc.length + co.length;
  app.innerHTML = `<h1 class="anim">${t('searchTitle')}: “${raw.trim()}”</h1>
    <p class="muted">${total} ${t('results')}</p>
    ${pl.length ? `<h2><i class="fa-solid fa-id-card"></i> ${t('secPlates')} (${pl.length})</h2><div class="grid">${pl.slice(0, 6).map((p, i) => `
      <article class="card anim" ${stagger(i)}><div class="svgwrap platewrap">${renderPlate(p)}</div>
      <div class="pad"><div class="meta">${countryBadge(p.iso, false, hi(countryName(p.iso), q))}</div><p>${hi(p[L], q)}</p>
      <p><a href="#/${L}/plates">${t('secPlates')} →</a></p></div></article>`).join('')}</div>` : ''}
    ${bo.length ? `<h2><i class="fa-solid fa-road-barrier"></i> ${t('secBollards')} (${bo.length})</h2><div class="grid bol-grid">${bo.slice(0, 6).map((b, i) => `
      <article class="card bol-card anim" ${stagger(i)}>${bolImg(b)}
      <div class="pad"><div class="meta">${b.countries.map(c => countryBadge(c)).join('')}</div><p>${hi(b[L], q)}</p></div></article>`).join('')}</div>` : ''}
    ${po.length ? `<h2><i class="fa-solid fa-broadcast-tower"></i> ${t('secPoles')} (${po.length})</h2><div class="grid">${po.slice(0, 6).map((p, i) => `
      <article class="card bol-card anim" ${stagger(i)}>${polImg(p)}
      <div class="pad"><div class="meta">${p.countries.map(c => countryBadge(c)).join('')}</div><p>${hi(p[L], q)}</p>
      <p><a href="#/${L}/poles">${t('secPoles')} →</a></p></div></article>`).join('')}</div>` : ''}
    ${co.length ? `<h2><i class="fa-solid fa-earth-americas"></i> ${t('secCountries')} (${co.length})</h2><div class="tablewrap"><table class="phones"><tbody>
      ${co.slice(0, 10).map(c => `<tr><td>${countryBadge(c.iso, false, hi(getLang() === 'es' ? c.es : c.en, q))}</td><td class="code">${hi(c.phone, q)}</td><td>${driveChip(c.iso)}</td></tr>`).join('')}</tbody></table></div>
      <p><a href="#/${L}/countries">${t('secCountries')} →</a></p>` : ''}
    ${sc.length ? `<h2><i class="fa-solid fa-language"></i> ${t('secScripts')} (${sc.length})</h2><div class="grid">${sc.slice(0, 4).map((s, i) => `
      <article class="card anim" ${stagger(i)}>
        <div class="quiz-sample sm" dir="auto">${s.sample}</div>
        <div class="pad"><div class="meta"><span class="tag ct"><b>${hi(s[L].name, q)}</b></span></div><p>${hi(s[L].look, q)}</p>
        <p><a href="#/${L}/scripts">${t('secScripts')} →</a></p></div></article>`).join('')}</div>` : ''}
    ${!total ? `<p>${t('noResults')}</p>` : ''}`;
  app.querySelectorAll('.copybtn').forEach(b => b.onclick = () => copyCode(b.dataset.code));
  ensureBol3D();
}

// ---------- attribution ----------
async function renderAttribution() {
  let items = [];
  try {
    const r = await fetch('./attribution.json');
    if (r.ok) items = await r.json();
  } catch {}
  app.innerHTML = `<h1 class="anim">${t('attributionTitle')}</h1><p class="muted">${t('attributionSub')}</p>
    <div class="grid">${items.map(m => `<div class="card anim"><div class="pad"><h3>${m.id}</h3><p class="kv">© ${m.author} · ${m.license}</p><p><a href="${m.source_page}" target="_blank" rel="noopener">Fuente</a> → <code>${m.target}</code></p></div></div>`).join('')}</div>
    <h3>${t('thCountry')} · drive</h3>
    <div class="countries">${countries.filter(c => c.geo).map(c => `${countryBadge(c.iso)}${driveChip(c.iso)}`).join('')}</div>`;
}

// ---------- router ----------
function currentSection() {
  const parts = (location.hash || '').replace('#/', '').split('/');
  const p = parts[1] || '';
  if (['plates', 'bollards', 'poles', 'scripts', 'countries', 'attribution'].includes(p)) return p;
  return 'home';
}
function rerenderSection() {
  if (window.__heroCleanup && currentSection() !== 'home') { window.__heroCleanup(); window.__heroCleanup = null; }
  const s = currentSection();
  renderSections(s);
  if (s === 'plates') renderPlates();
  else if (s === 'bollards') renderBollards();
  else if (s === 'poles') renderPoles();
  else if (s === 'scripts') renderScripts();
  else if (s === 'countries') renderCountries();
  else renderHome();
  app.classList.remove('view-enter');
  void app.offsetWidth;
  app.classList.add('view-enter');
}
export function route() {
  applyI18n();
  const h = location.hash || `#/${getLang()}`;
  const parts = h.replace('#/', '').split('/');
  let L = parts[0];
  if (!['es', 'en'].includes(L)) L = getLang();
  if (L !== getLang()) setLang(L);
  const page = parts[1] || '';
  const q = searchEl.value || '';

  let section = 'home';
  if (['plates', 'bollards', 'poles', 'scripts', 'countries', 'attribution'].includes(page)) section = page;
  if (section !== 'home' && window.__heroCleanup) { window.__heroCleanup(); window.__heroCleanup = null; }
  renderSections(section);

  const searching = q.trim().length >= 2;
  if (searching) { renderSearch(q); }
  else if (section === 'plates') renderPlates();
  else if (section === 'bollards') renderBollards();
  else if (section === 'poles') renderPoles();
  else if (section === 'scripts') renderScripts();
  else if (section === 'countries') renderCountries();
  else if (section === 'attribution') renderAttribution();
  else renderHome();
  // transición de vista
  app.classList.remove('view-enter');
  void app.offsetWidth;
  app.classList.add('view-enter');
}
function reroute() {
  const s = currentSection();
  const L = getLang();
  location.hash = s === 'home' ? `#/${L}` : `#/${L}/${s}`;
  route();
}

// init
document.getElementById('btn-es').onclick = () => { setLang('es'); reroute(); };
document.getElementById('btn-en').onclick = () => { setLang('en'); reroute(); };
document.getElementById('lb-close').onclick = () => { lb.hidden = true; };
lb.onclick = (e) => { if (e.target === lb) lb.hidden = true; };
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!cmp.hidden) closeCmp();
    else if (!cmap.hidden) closeCmap();
    else if (!lb.hidden) lb.hidden = true;
    else if (document.activeElement === searchEl) { searchEl.value = ''; route(); }
  }
  if (e.key === '/' && document.activeElement !== searchEl) { e.preventDefault(); searchEl.focus(); }
});
searchEl.oninput = () => route();
window.addEventListener('hashchange', () => route());
setLang(getLang());
document.body.classList.toggle('noblur', !F.plateBlur);
if (!location.hash) location.hash = `#/${getLang()}`;
route();
