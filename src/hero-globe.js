// Hero 3D estilo GeoGuessr: Tierra por puntos + pin movible con click + Luna.
// three.js, sin texturas. Limpia todo al desmontar.
import * as THREE from 'three';
import { EARTH_W, EARTH_H, EARTH_MASK } from './earth-mask.js';

const PIN_RED = 0xe0344a; // rojo pin GeoGuessr (#CF142B aclarado para fondo oscuro)
const MAP_BLUE = 0x7ea4ff; // azul mapa (#4285F4 aclarado)
const PLAY_GREEN = 0x6abf4b; // verde play GeoGuessr
const VALHALLA = 0x211a4c;

function latLngToVec3(lat, lng, r) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

export function initHeroGlobe(canvas) {
  if (!canvas) return () => {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
  camera.position.set(0, 0.25, 3.2);

  const globe = new THREE.Group();
  const world = new THREE.Group(); // desplaza el conjunto a la derecha en pantallas anchas
  world.add(globe);
  scene.add(world);

  // --- Tierra por puntos desde máscara embarcada (síncrono, sin fetch).
  // Si la máscara falla, fallback a esfera fibonacci.
  const R = 1;
  let landPoints = null;

  function setDots(positions, colors, size) {
    if (landPoints) {
      globe.remove(landPoints);
      landPoints.geometry.dispose();
      landPoints.material.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (colors) g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.PointsMaterial({
      size, transparent: true, opacity: 0.9,
      sizeAttenuation: true, depthWrite: false,
      vertexColors: !!colors, color: colors ? 0xffffff : MAP_BLUE,
    });
    landPoints = new THREE.Points(g, m);
    globe.add(landPoints);
  }

  function buildFallback() {
    const N = 1500;
    const pos = new Float32Array(N * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      v.set(Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    setDots(pos, null, 0.016);
  }

  function eqToVec3(lat, lng, r, out) {
    const phi = ((90 - lat) * Math.PI) / 180;
    const theta = ((lng + 180) * Math.PI) / 180;
    return out.set(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta),
    );
  }

  function buildEarth() {
    const raw = atob(EARTH_MASK);
    const land = [];
    for (let y = 0; y < EARTH_H; y++) {
      for (let x = 0; x < EARTH_W; x++) {
        const i = y * EARTH_W + x;
        if ((raw.charCodeAt(i >> 3) >> (i & 7)) & 1) land.push([x, y]);
      }
    }
    if (land.length < 200) return false; // máscara ilegible: queda el fallback
    const N = 2600;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const green = new THREE.Color(0x6abf4b);
    const sand = new THREE.Color(0xd9b45c);
    const ice = new THREE.Color(0xe8ecf5);
    const tmp = new THREE.Color();
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const [px, py] = land[(Math.random() * land.length) | 0];
      const lng = (px / EARTH_W) * 360 - 180;
      const lat = 90 - (py / EARTH_H) * 180;
      eqToVec3(lat, lng, R * (1 + Math.random() * 0.004), v);
      pos.set([v.x, v.y, v.z], i * 3);
      const r = Math.random();
      if (Math.abs(lat) > 62) tmp.copy(ice);
      else if (r < 0.62) tmp.copy(green).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
      else tmp.copy(sand).offsetHSL(0, 0, (Math.random() - 0.5) * 0.1);
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    setDots(pos, col, 0.02);
  }

  buildFallback();
  try {
    if (buildEarth() === false) throw new Error('mask');
  } catch { /* fallback */ }

  // --- Luna orbitando ---
  const moonPivot = new THREE.Group();
  moonPivot.rotation.z = 0.22;
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xd7dce6 }),
  );
  moon.position.set(1.85, 0, 0);
  const moonHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xaab4ff, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  moonHalo.position.copy(moon.position);
  moonPivot.add(moon, moonHalo);
  world.add(moonPivot);

  // --- malla tenue + núcleo ---
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(R * 0.995, 3),
    new THREE.MeshBasicMaterial({ color: VALHALLA, wireframe: true, transparent: true, opacity: 0.35 }),
  );
  globe.add(wire);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.985, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x141130, transparent: true, opacity: 0.92 }),
  );
  globe.add(core);

  // --- marcador GeoGuessr (click en el planeta para moverlo) ---
  const UP = new THREE.Vector3(0, 1, 0);
  const marker = new THREE.Group();
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 24, 24),
    new THREE.MeshBasicMaterial({ color: PIN_RED }),
  );
  head.position.y = 0.2;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.055, 0.14, 24),
    new THREE.MeshBasicMaterial({ color: PIN_RED }),
  );
  tip.rotation.x = Math.PI; // punta hacia el globo
  tip.position.y = 0.07;
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  dot.position.set(0, 0.215, 0.055);
  marker.add(head, tip, dot);

  // ondas en la base, hijas del marcador para que viajen con él
  const rings = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.09, 0.105, 48),
      new THREE.MeshBasicMaterial({
        color: i === 0 ? PIN_RED : PLAY_GREEN,
        transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    m.userData.phase = i / 2;
    marker.add(m);
    rings.push(m);
  }
  globe.add(marker);

  let markerPulse = 0;
  function placeMarker(normal) {
    marker.position.copy(normal.clone().multiplyScalar(R));
    marker.quaternion.setFromUnitVectors(UP, normal.clone().normalize());
    markerPulse = 1;
  }
  placeMarker(latLngToVec3(48.85, 2.35, R).normalize());
  markerPulse = 0;
  // Encuadre inicial: Europa/África de frente (el pin visible)
  globe.rotation.y = -Math.atan2(marker.position.x, marker.position.z);

  // pop sintetizado (sin assets)
  let actx = null;
  function pop() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      actx = actx || new AC();
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime;
      const mk = (type, f0, f1, peak, dur) => {
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t0);
        o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.08);
        o.connect(g).connect(actx.destination);
        o.start(t0); o.stop(t0 + dur + 0.1);
      };
      mk('sine', 520, 170, 0.22, 0.12);
      mk('triangle', 1400, 880, 0.07, 0.08);
    } catch { /* sin audio */ }
  }

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(core, false)[0];
    return hit ? globe.worldToLocal(hit.point.clone()).normalize() : null;
  }
  let downAt = null;
  function onDown(e) { downAt = [e.clientX, e.clientY]; }
  function onUp(e) {
    if (!downAt) return;
    const dx = e.clientX - downAt[0];
    const dy = e.clientY - downAt[1];
    downAt = null;
    if (dx * dx + dy * dy > 36) return; // era arrastre, no click
    const n = pick(e);
    if (!n) return;
    placeMarker(n);
    if (reduceMotion) markerPulse = 0;
    else pop();
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  // --- partículas ---
  const PN = 350;
  const ppos = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) {
    const r = 1.7 + Math.random() * 1.3;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    ppos.set([
      r * Math.sin(ph) * Math.cos(th),
      r * Math.cos(ph) * 0.8,
      r * Math.sin(ph) * Math.sin(th),
    ], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: 0xaab4ff, size: 0.014, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  world.add(particles);

  // --- tamaño ---
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // En apaisado el globo se va a la derecha y el texto queda a la izquierda
    const aspect = w / h;
    world.position.x = aspect > 1.05 ? Math.min(1.15, (aspect - 1) * 0.62) : 0;
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // --- parallax ---
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  function onPointer(e) {
    const r = canvas.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
  }
  const host = canvas.closest('.hero-gg') || canvas;
  host.addEventListener('pointermove', onPointer);

  let raf = 0;
  let running = true;
  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    if (visible && !raf && !reduceMotion && running) raf = requestAnimationFrame(tick);
    if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  io.observe(canvas);

  const clock = new THREE.Clock();
  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    globe.rotation.y += dt * 0.14;
    moonPivot.rotation.y -= dt * 0.22;
    particles.rotation.y -= dt * 0.02;

    // pin flotando + pulso al colocar
    const bob = Math.sin(t * 1.6) * 0.02;
    head.position.y = 0.2 + bob;
    dot.position.y = 0.215 + bob;
    markerPulse = Math.max(0, markerPulse - dt * 2.5);
    marker.scale.setScalar(1 + markerPulse * 0.35);

    // ondas
    for (const m of rings) {
      const p = (t * 0.45 + m.userData.phase) % 1;
      const s = 0.4 + p * 2.2;
      m.scale.setScalar(s);
      m.material.opacity = 0.8 * (1 - p);
    }

    // parallax suave
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    camera.position.x = pointer.x + world.position.x * 0.35;
    camera.position.y = 0.25 - pointer.y;
    camera.lookAt(world.position.x * 0.55, 0, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  function onVis() {
    if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
    else if (!document.hidden && !raf && !reduceMotion && running && visible) raf = requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', onVis);

  if (reduceMotion) {
    renderer.render(scene, camera);
  } else {
    raf = requestAnimationFrame(tick);
  }

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    host.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    renderer.dispose();
  };
}
