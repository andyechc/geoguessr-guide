// Bollards y postes en 3D (three.js) estilo GeoGuessr.
// - Thumbs: un solo renderer offscreen renderiza cada modelo a PNG (lazy).
// - Visor: modal interactivo con arrastre para rotar + zoom.
// Sin OrbitControls: rotación manual con inercia, más ligero.
import * as THREE from 'three';
import bollards from '../data/bollards.json';
import poles from '../data/poles.json';

const byId = new Map(bollards.map((b) => [b.id, b]));
const byPoleId = new Map(poles.map((p) => [p.id, p]));
const thumbCache = new Map();

// Encuadre con aire (los postes son más altos: cámara más lejos)

function mat(color, rough = 0.55) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0.08 });
}

function stageLights(scene) {
  scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x211a4c, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7ea4ff, 0.7);
  rim.position.set(-3, 2, -2.5);
  scene.add(rim);
}

function groundMesh() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 40), mat('#0c0a24', 0.9));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -1.01;
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 40),
    new THREE.MeshBasicMaterial({ color: 0x4285f4, transparent: true, opacity: 0.14, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -1.02;
  g.add(disc, halo);
  return g;
}

// El SVG original: poste x32..88 (w56), y20..220 (h200) sobre viewBox 120x240.
// Mapeo: y_svg 20 -> +1, y_svg 220 -> -1.
export function buildBollard(b) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.0, 0.5), mat(b.base));
  g.add(post);
  for (const s of b.bands || []) {
    const h = s.h / 100;
    const yc = 1 - (s.y + s.h / 2) / 100;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.525, h, 0.525), mat(s.c, 0.45));
    band.position.y = yc;
    g.add(band);
  }
  if (b.top) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.54), mat(b.top, 0.45));
    cap.position.y = 0.91;
    g.add(cap);
  } else {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.52), mat('#1c1840', 0.7));
    cap.position.y = 0.98;
    g.add(cap);
  }
  return g;
}

// ---------- postes ----------
export function buildPole(p) {
  const g = new THREE.Group();
  const base = new THREE.Color(p.base || '#c9ced8');
  if (p.shape === 'lattice') {
    const m = mat(base, 0.5);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.4, 0.09), m);
      leg.position.set(s * 0.22, 0.1, 0);
      leg.rotation.z = -s * 0.09;
      g.add(leg);
    }
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5 - i * 0.04, 0.05, 0.05), m);
      bar.position.y = -0.6 + i * 0.5;
      g.add(bar);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.07), m);
    top.position.y = 1.22;
    g.add(top);
    return g;
  }
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.3, 0.4), mat(base, 0.7));
  post.position.y = 0.1;
  g.add(post);
  if (p.shape === 'holey') {
    const holeM = mat('#141130', 0.9);
    for (let i = 0; i < 3; i++) {
      const hole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.02), holeM);
      hole.position.set(0, 0.5 + i * 0.4, 0.2);
      g.add(hole);
    }
  }
  if (p.shape === 'ladder') {
    const rungM = mat('#3a3f55', 0.5);
    for (let i = 0; i < 5; i++) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.035), rungM);
      rung.position.set(0, -0.3 + i * 0.35, 0.22);
      g.add(rung);
    }
  }
  if (p.arms) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.08), mat(base, 0.7));
    arm.position.y = 1.05;
    g.add(arm);
    const insM = mat('#1c1840', 0.5);
    for (const x of [-0.38, 0, 0.38]) {
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), insM);
      ins.position.set(x, 1.13, 0);
      g.add(ins);
    }
  }
  return g;
}

function poleCaption(p, lang) {
  return `<b>${p.countries.join(' · ')}</b> — ${p[lang] || ''}`;
}

function bolCaption(b, lang) {
  return `<b>${b.countries.join(' · ')}</b> — ${b[lang] || ''}`;
}

const REG = {
  bol: { byId, build: buildBollard, cap: bolCaption, imgAttr: 'data-bol3d', btnClass: 'bol3d', thumbCam: [1.8, 0.7, 4.2], viewCam: [1.8, 0.7, 4.2] },
  pol: { byId: byPoleId, build: buildPole, cap: poleCaption, imgAttr: 'data-pol3d', btnClass: 'pol3d', thumbCam: [2.2, 0.9, 5.6], viewCam: [2.2, 0.9, 5.6] },
};

function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
  });
}

// ---------- thumbs (un solo contexto WebGL) ----------
let thumbRenderer = null;
function getThumbRenderer() {
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    thumbRenderer.setPixelRatio(2);
    thumbRenderer.setSize(240, 300, false);
  }
  return thumbRenderer;
}

export function thumbURL(kind, b) {
  const key = `${kind}:${b.id}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const renderer = getThumbRenderer();
  const scene = new THREE.Scene();
  stageLights(scene);
  scene.add(groundMesh());
  const model = REG[kind].build(b);
  model.rotation.y = -0.5;
  scene.add(model);
  const cam = new THREE.PerspectiveCamera(30, 240 / 300, 0.1, 50);
  cam.position.set(...REG[kind].thumbCam);
  cam.lookAt(0, 0.05, 0);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  disposeGroup(model);
  thumbCache.set(key, url);
  return url;
}

// ---------- binding perezoso ----------
let thumbIO = null;
export function bindBollard3D(scope) {
  const sel = Object.values(REG).map((r) => `img[${r.imgAttr}]:not([src])`).join(',');
  const imgs = [...scope.querySelectorAll(sel)];
  if (imgs.length && !thumbIO) {
    thumbIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const img = e.target;
        thumbIO.unobserve(img);
        try {
          const kind = img.hasAttribute('data-pol3d') ? 'pol' : 'bol';
          const b = REG[kind].byId.get(img.getAttribute(REG[kind].imgAttr));
          if (b) {
            img.src = thumbURL(kind, b);
            img.onload = () => img.classList.add('ld');
          }
        } catch { /* sin WebGL: se queda el shimmer */ }
      }
    }, { rootMargin: '200px' });
  }
  imgs.forEach((img) => thumbIO && thumbIO.observe(img));
  if (!scope.dataset.bol3dBound) {
    scope.dataset.bol3dBound = '1';
    scope.addEventListener('click', (e) => {
      const btn = e.target.closest ? e.target.closest('.bol3d,.pol3d') : null;
      if (!btn || !scope.contains(btn)) return;
      openViewer(btn.classList.contains('pol3d') ? 'pol' : 'bol', btn.dataset.bol || btn.dataset.pol);
    });
  }
}

// ---------- visor modal ----------
let view = null;
function ensureViewer() {
  if (view) return view;
  const overlay = document.getElementById('bol3d');
  const canvas = document.getElementById('bol3d-canvas');
  const cap = document.getElementById('bol3d-cap');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  stageLights(scene);
  scene.add(groundMesh());
  const spin = new THREE.Group();
  scene.add(spin);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  cam.position.set(...REG.bol.viewCam);
  cam.lookAt(0, -0.05, 0);
  view = {
    overlay, canvas, cap, renderer, scene, spin, cam,
    rotX: 0.05, rotY: -0.5, velY: 0, dist: 3.5, raf: 0, open: false, model: null,
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  const setSize = () => {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 360;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };

  let dragging = false;
  let lx = 0;
  let ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    view.rotY += dx * 0.009;
    view.rotX = Math.max(-0.25, Math.min(0.55, view.rotX + dy * 0.005));
    view.velY = dx * 0.009;
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const d = cam.position.clone().normalize().multiplyScalar(
      Math.max(2.6, Math.min(6.5, cam.position.length() * (e.deltaY > 0 ? 1.1 : 0.9))),
    );
    cam.position.copy(d);
  }, { passive: false });

  const close = () => closeViewer();
  document.getElementById('bol3d-close').onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  view.setSize = setSize;
  view.isDragging = () => dragging;
  return view;
}

function loop() {
  const v = view;
  if (!v.open) return;
  if (!v.isDragging()) {
    v.rotY += v.velY;
    v.velY *= 0.94;
    if (!v.reduce) v.rotY += 0.008;
  }
  v.spin.rotation.y = v.rotY;
  v.spin.rotation.x = v.rotX;
  v.renderer.render(v.scene, v.cam);
  v.raf = requestAnimationFrame(loop);
}

export function openViewer(kind, id) {
  const b = REG[kind].byId.get(id);
  if (!b) return;
  const v = ensureViewer();
  if (v.model) { v.spin.remove(v.model); disposeGroup(v.model); }
  v.model = REG[kind].build(b);
  v.spin.add(v.model);
  v.rotX = 0.05; v.rotY = -0.5; v.velY = 0;
  v.cam.position.set(...REG[kind].viewCam);
  v.cam.lookAt(0, -0.05, 0);
  const lang = localStorage.getItem('gg-lang') === 'en' ? 'en' : 'es';
  v.cap.innerHTML = REG[kind].cap(b, lang);
  v.overlay.hidden = false;
  v.open = true;
  v.setSize();
  document.addEventListener('keydown', escClose);
  cancelAnimationFrame(v.raf);
  loop();
}

function escClose(e) {
  if (e.key === 'Escape') closeViewer();
}

export function closeViewer() {
  if (!view || !view.open) return;
  view.open = false;
  cancelAnimationFrame(view.raf);
  view.overlay.hidden = true;
  document.removeEventListener('keydown', escClose);
}
