/* Layla Pro — the 3D site.
 *
 * One three.js scene sits fixed behind the page. Scrolling moves a single
 * number, `f`, from 0 (the hero) through 1..6 (the five movements of the
 * story) to 7 (the rest of the page), and everything on the stage is a
 * function of it: the camera, where each object stands, how visible it is,
 * and the small animation inside each movement — the sun travelling its
 * arc, the apps being held, the year assembling, the lights of the night,
 * the mushaf opening with its words lighting one by one.
 */
import * as THREE from 'three';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ASSETS = '../assets/';

document.body.classList.add('is-loading');

/* ─────────────────────────────── small page behaviours ── */

// Words of each [data-split] heading rise in one after another.
$$('[data-split]').forEach((el) => {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span'); w.className = 'w';
          const s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
          w.append(s); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
});

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
}, { rootMargin: '0px 0px -12% 0px' });
$$('[data-reveal], [data-split]').forEach((el) => io.observe(el));

// The clock in the nav: local time, named by the visitor's own city.
(function clock() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const place = tz.split('/').pop().replace(/_/g, ' ');
  if (place) $('#clock-place').textContent = place.length > 14 ? 'Local' : place;
  const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const tick = () => { $('#clock').textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 1000);
})();

// Menu (narrow screens).
(function menu() {
  const btn = $('.nav__menu'), m = $('#menu');
  const set = (open) => { m.hidden = !open; btn.setAttribute('aria-expanded', open); btn.textContent = open ? 'Close' : 'Menu'; };
  btn.addEventListener('click', () => set(m.hidden));
  $$('a', m).forEach((a) => a.addEventListener('click', () => set(false)));
})();

// Filters on the "Inside" grid.
$$('.filters button').forEach((b) => b.addEventListener('click', () => {
  $$('.filters button').forEach((x) => x.classList.toggle('is-active', x === b));
  const f = b.dataset.filter;
  $$('.grid .card').forEach((c) => c.classList.toggle('is-hidden', f !== 'all' && c.dataset.cat !== f));
}));

// Cursor: a ring that follows, and grows with a word over things you can act on.
(function cursor() {
  const c = $('.cursor'); if (!c || matchMedia('(pointer: coarse)').matches) return;
  const label = $('.cursor__label', c);
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('a, button, .card__media, label');
    c.classList.toggle('is-hover', !!t);
    label.textContent = !t ? '' : t.matches('.card__media') ? 'View'
      : t.matches('[data-store="soon"], [data-play="soon"]') ? 'Join' : '';
  });
  (function loop() { cx += (x - cx) * .2; cy += (y - cy) * .2; c.style.transform = `translate(${cx}px, ${cy}px)`; requestAnimationFrame(loop); })();
})();

// Nav: background once scrolled, hides on the way down, active section lit.
const nav = $('#nav');
let lastY = 0;
const navLinks = $$('[data-nav]');
const sections = ['story', 'inside', 'maker', 'get'].map((id) => document.getElementById(id));
function updateNav(y) {
  nav.classList.toggle('is-scrolled', y > 40);
  nav.classList.toggle('is-hidden', y > lastY && y > innerHeight * 1.2 && !$('#menu:not([hidden])'));
  lastY = y;
  let active = null;
  sections.forEach((s) => { const r = s.getBoundingClientRect(); if (r.top < innerHeight * .45 && r.bottom > innerHeight * .45) active = s.id; });
  navLinks.forEach((a) => a.classList.toggle('is-active', a.dataset.nav === active));
}

/* ─────────────────────────────────────── smooth scroll ── */

let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.15, smoothWheel: true });
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 || e.defaultPrevented) return;
    const t = document.querySelector(id); if (!t) return;
    e.preventDefault(); lenis.scrollTo(t, { offset: id === '#top' ? 0 : -10 });
  }));
}
const scrollTo = (y) => (lenis ? lenis.scrollTo(y) : window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }));

/* ───────────────────────────────────── scroll → number ── */

const story = $('#story');
const steps = $$('.step');
const railBtns = $$('.rail button');
let storyTop = 0, storyLen = 1;
function measure() {
  const r = story.getBoundingClientRect();
  storyTop = r.top + scrollY;
  storyLen = Math.max(1, story.offsetHeight - innerHeight);
}
measure();
addEventListener('resize', measure);
railBtns.forEach((b) => b.addEventListener('click', () => {
  const i = +b.dataset.goto;
  scrollTo(storyTop + storyLen * ((i + 0.5) / 5));
}));

/** 0 at the top of the page, 1..6 across the story, 7 just after it. */
function phase() {
  measure(); // the hero's height settles as fonts arrive, so measure every time
  const y = scrollY;
  if (y < storyTop) return clamp(y / Math.max(1, storyTop));
  const s = (y - storyTop) / storyLen;
  if (s <= 1) return 1 + s * 5;
  return 6 + clamp((y - storyTop - storyLen) / innerHeight);
}

let activeStep = 0;
function setStep(i) {
  if (i === activeStep) return;
  activeStep = i;
  steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
  railBtns.forEach((b, k) => b.classList.toggle('is-active', k === i));
}

/* ─────────────────────────────────────────── the scene ── */

const canvas = $('#scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('.stage').classList.add('no-gl');
}

const loaderDeg = $('#loader-deg'), loaderBar = $('#loader-bar');
let loadShown = 0, loadTarget = 0, loadDone = false;
const loadStart = performance.now();
function finishLoading() {
  loadDone = true;
}
(function loaderLoop() {
  // The sun sinks from the horizon to −18°, the moment of Fajr.
  const minTime = clamp((performance.now() - loadStart) / 1700);
  const goal = Math.min(loadTarget, minTime);
  loadShown += (goal - loadShown) * .12;
  loaderDeg.textContent = (-18 * loadShown).toFixed(1).replace('-0.0', '0.0');
  loaderBar.style.transform = `scaleX(${loadShown})`;
  if (loadDone && loadShown > .995) {
    loaderDeg.textContent = '−18.0';
    $('#loader').classList.add('is-done');
    document.body.classList.remove('is-loading');
    document.documentElement.classList.add('is-ready');
    document.body.classList.add('is-ready');
    return;
  }
  requestAnimationFrame(loaderLoop);
})();

if (!renderer) { loadTarget = 1; finishLoading(); }
else buildScene();

function buildScene() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0a0806, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0806, 6, 14);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, done, total) => { loadTarget = done / total; };
  manager.onLoad = () => { loadTarget = 1; finishLoading(); };
  const tl = new THREE.TextureLoader(manager);
  const tex = (name) => { const t = tl.load(ASSETS + name); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  /* light, for the phone and the book */
  scene.add(new THREE.AmbientLight(0xfff1e0, 0.35));
  const key = new THREE.DirectionalLight(0xffe6c4, 2.2); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9db8ff, 1.2); rim.position.set(4, -1, -3); scene.add(rim);

  /* ── the Earth at night ── */
  const globe = new THREE.Group(); scene.add(globe);
  const earth = new THREE.Group(); globe.add(earth);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: tex('earth-day.webp') },
      nightMap: { value: tex('earth-night.webp') },
      sunDir: { value: new THREE.Vector3(1, 0.2, 0.3).normalize() },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position,1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D dayMap, nightMap; uniform vec3 sunDir; uniform float uOpacity;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){
        float d = dot(normalize(vN), sunDir);
        float day = smoothstep(-0.08, 0.32, d);
        vec3 dayC = texture2D(dayMap, vUv).rgb * vec3(0.78, 0.74, 0.70) * 0.55;
        vec3 nightC = texture2D(nightMap, vUv).rgb;
        nightC = pow(nightC, vec3(1.25)) * vec3(1.35, 1.12, 0.82) * 1.5;
        vec3 c = mix(nightC, dayC, day);
        float fres = pow(1.0 - max(dot(normalize(vN), vView), 0.0), 3.0);
        c += vec3(0.55, 0.62, 0.78) * fres * 0.16;
        gl_FragColor = vec4(c, uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
  });
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), earthMat);
  earth.add(earthMesh);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.14, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 1 } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 wp = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: `uniform float uOpacity; varying vec3 vN; varying vec3 vV;
        void main(){ float i = clamp(pow(0.6 - dot(vN, vV), 4.0), 0., 1.); gl_FragColor = vec4(vec3(0.55,0.64,0.86) * i * .75, i * .7 * uOpacity); }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  globe.add(atmo);

  // Lights of the people praying Tahajjud — rough areas, never points.
  const PLACES = [
    [21.4, 39.8], [24.5, 39.6], [31.8, 35.2], [30.0, 31.2], [33.5, 36.3], [33.3, 44.4], [35.7, 51.4], [41.0, 29.0], [39.9, 32.9],
    [24.7, 46.7], [25.3, 51.5], [25.2, 55.3], [23.6, 58.4], [15.4, 44.2], [12.8, 45.0], [2.0, 45.3], [9.0, 38.7], [15.6, 32.5],
    [36.8, 10.2], [36.7, 3.1], [33.6, -7.6], [34.0, -6.8], [14.7, -17.4], [12.6, -8.0], [13.5, 2.1], [9.1, 7.4], [12.0, 8.5],
    [6.5, 3.4], [-6.8, 39.3], [-4.0, 39.7], [24.9, 67.0], [31.5, 74.3], [33.7, 73.0], [28.6, 77.2], [19.1, 72.9], [17.4, 78.5],
    [23.8, 90.4], [22.3, 91.8], [34.5, 69.2], [41.3, 69.3], [43.2, 76.9], [3.1, 101.7], [1.5, 103.8], [5.4, 100.3], [-6.2, 106.8],
    [-7.3, 112.7], [-6.9, 107.6], [-5.1, 119.4], [3.6, 98.7], [-0.9, 100.4], [14.6, 121.0], [7.1, 125.6], [39.9, 116.4], [43.8, 87.6],
    [51.5, -0.1], [52.5, -1.9], [53.5, -2.2], [48.9, 2.4], [52.5, 13.4], [50.9, 6.9], [52.4, 4.9], [59.3, 18.1], [40.7, -74.0],
    [41.9, -87.6], [42.3, -83.0], [43.7, -79.4], [45.5, -73.6], [34.0, -118.2], [29.8, -95.4], [-33.9, 151.2], [-37.8, 145.0],
    [-26.2, 28.0], [-33.9, 18.4], [55.8, 37.6], [55.8, 49.1], [40.4, 49.9], [37.9, 58.4], [38.6, 68.8], [29.4, 47.9], [26.2, 50.6],
  ];
  const N_LIGHTS = 420;
  const lp = new Float32Array(N_LIGHTS * 3), lr = new Float32Array(N_LIGHTS), ls = new Float32Array(N_LIGHTS);
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < N_LIGHTS; i++) {
    const [la, lo] = PLACES[i % PLACES.length];
    const lat = THREE.MathUtils.degToRad(la + (rnd() - .5) * 5), lon = THREE.MathUtils.degToRad(lo + (rnd() - .5) * 6);
    const r = 1.006;
    // Same mapping as SphereGeometry's UVs, so the lights sit on the right land.
    lp[i * 3] = r * Math.cos(lat) * Math.cos(lon);
    lp[i * 3 + 1] = r * Math.sin(lat);
    lp[i * 3 + 2] = -r * Math.cos(lat) * Math.sin(lon);
    lr[i] = rnd(); ls[i] = .6 + rnd() * .9;
  }
  const lightGeo = new THREE.BufferGeometry();
  lightGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lightGeo.setAttribute('aRand', new THREE.BufferAttribute(lr, 1));
  lightGeo.setAttribute('aSize', new THREE.BufferAttribute(ls, 1));
  const lightMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBloom: { value: .25 }, uOpacity: { value: 1 }, uScale: { value: 1 } },
    vertexShader: `
      attribute float aRand; attribute float aSize; uniform float uTime, uBloom, uScale;
      varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.);
        vec3 nrm = normalize(mat3(modelViewMatrix) * position);
        float facing = smoothstep(-0.05, 0.25, dot(nrm, normalize(-mv.xyz)));
        float on = smoothstep(aRand - .08, aRand, uBloom);
        float pulse = .65 + .35 * sin(uTime * (1.2 + aRand * 1.6) + aRand * 40.);
        vA = on * facing * pulse;
        gl_PointSize = aSize * uScale * (12. + 22. * on) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uOpacity; varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d); a = a*a;
        gl_FragColor = vec4(mix(vec3(.43,.71,1.), vec3(.86,.94,1.), a*a), a * vA * uOpacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const lights = new THREE.Points(lightGeo, lightMat);
  earth.add(lights);

  /* ── the sun's path and the five prayers on it ── */
  const arc = new THREE.Group(); globe.add(arc);
  arc.rotation.set(-0.42, 0, 0.18);
  const R = 1.62;
  const arcPts = [];
  for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; arcPts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); }
  const ringMat = new THREE.LineBasicMaterial({ color: 0xf4eee4, transparent: true, opacity: .22 });
  arc.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(arcPts), ringMat));
  // ticks every 15° — a dial
  const tickPts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, r1 = R - 0.025, r2 = R + (i % 6 === 0 ? .07 : .035);
    tickPts.push(new THREE.Vector3(Math.cos(a) * r1, 0, Math.sin(a) * r1), new THREE.Vector3(Math.cos(a) * r2, 0, Math.sin(a) * r2));
  }
  const tickMat = new THREE.LineBasicMaterial({ color: 0xf4eee4, transparent: true, opacity: .3 });
  arc.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts), tickMat));
  // The day's path, Fajr to Isha, brighter than the rest of the ring.
  const A0 = Math.PI * 1.05, A1 = -Math.PI * 0.05; // sweep over the front of the globe
  const dayPts = [];
  for (let i = 0; i <= 128; i++) { const a = lerp(A0, A1, i / 128); dayPts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); }
  const dayGeo = new THREE.BufferGeometry().setFromPoints(dayPts);
  const dayMat = new THREE.LineBasicMaterial({ color: 0xf0d9a8, transparent: true, opacity: .9 });
  const dayLine = new THREE.Line(dayGeo, dayMat); arc.add(dayLine);

  const PRAYERS = [
    { name: 'Fajr', time: '5:52', t: 0 }, { name: 'Sunrise', time: '7:04', t: .12 }, { name: 'Dhuhr', time: '13:09', t: .45 },
    { name: 'Asr', time: '16:23', t: .66 }, { name: 'Maghrib', time: '19:12', t: .86 }, { name: 'Isha', time: '20:22', t: 1 },
  ];
  const markerGeo = new THREE.SphereGeometry(.022, 16, 12);
  const markers = PRAYERS.map((p) => {
    const a = lerp(A0, A1, p.t);
    const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xf4eee4, transparent: true }));
    m.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); arc.add(m); return m;
  });

  const sunTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,248,232,1)'); gr.addColorStop(.18, 'rgba(255,226,170,.95)'); gr.addColorStop(.42, 'rgba(240,190,110,.32)'); gr.addColorStop(1, 'rgba(240,190,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sun.scale.setScalar(.34); arc.add(sun);

  /* ── the phone ── */
  const phone = new THREE.Group(); scene.add(phone);
  const PW = .66, PH = 1.38, PR = .1;
  const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const bodyGeo = new THREE.ExtrudeGeometry(rr(PW, PH, PR), { depth: .05, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 4, curveSegments: 16 });
  bodyGeo.translate(0, 0, -.055);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a231c, metalness: .85, roughness: .32, transparent: true });
  phone.add(new THREE.Mesh(bodyGeo, bodyMat));
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { mapA: { value: null }, mapB: { value: null }, uMix: { value: 0 }, uOpacity: { value: 1 }, uAspect: { value: PW / PH } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D mapA, mapB; uniform float uMix, uOpacity, uAspect; varying vec2 vUv;
      float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
      void main(){
        vec2 p = (vUv-.5) * vec2(uAspect,1.);
        float d = rbox(p, vec2(uAspect*.5,.5), .062);
        float m = 1. - smoothstep(0., .004, d);
        vec3 c = mix(texture2D(mapA, vUv).rgb, texture2D(mapB, vUv).rgb, uMix);
        gl_FragColor = vec4(c, m * uOpacity);
        #include <colorspace_fragment>
      }`,
    transparent: true,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(PW - .03, PH - .03), screenMat);
  screen.position.z = .009; phone.add(screen);

  const screens = { home: tex('screens/home.webp'), mushaf: tex('screens/mushaf.webp') };
  // The prayer screen that covers a held app, drawn once the fonts are in.
  const shieldCanvas = document.createElement('canvas'); shieldCanvas.width = 588; shieldCanvas.height = 1280;
  const shieldTex = new THREE.CanvasTexture(shieldCanvas); shieldTex.colorSpace = THREE.SRGBColorSpace;
  function drawShield() {
    const g = shieldCanvas.getContext('2d'), W = 588, H = 1280;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1c36'); bg.addColorStop(1, '#050b18');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(246,241,231,${.15 + Math.random() * .35})`; g.fillRect(Math.random() * W, Math.random() * H * .6, 1.6, 1.6); }
    g.textAlign = 'center'; g.fillStyle = '#f6f1e7';
    g.font = '600 26px Inter, sans-serif'; g.fillStyle = 'rgba(246,241,231,.55)'; g.fillText('PRAYER FOCUS', W / 2, 360);
    g.font = '700 104px "Playfair Display", serif'; g.fillStyle = '#f6f1e7'; g.fillText('Dhuhr', W / 2, 490);
    g.font = '400 30px Inter, sans-serif'; g.fillStyle = 'rgba(246,241,231,.72)';
    g.fillText('This app is paused', W / 2, 580); g.fillText('until you have prayed.', W / 2, 624);
    g.font = '500 32px Inter, sans-serif'; g.fillStyle = '#d9b26a'; g.fillText('26 minutes left', W / 2, 720);
    g.fillStyle = '#d9b26a'; g.beginPath(); g.roundRect(70, 800, W - 140, 104, 52); g.fill();
    g.fillStyle = '#060d1b'; g.font = '600 34px Inter, sans-serif'; g.fillText('I am praying now', W / 2, 864);
    g.fillStyle = 'rgba(246,241,231,.62)'; g.font = '400 30px Inter, sans-serif';
    g.fillText('I missed this prayer', W / 2, 990); g.fillText('Close', W / 2, 1060);
    shieldTex.needsUpdate = true;
  }
  screenMat.uniforms.mapA.value = screens.home; screenMat.uniforms.mapB.value = shieldTex;

  // The apps that usually take the minutes you meant to pray in.
  const APP_COLORS = [[0xe1306c, 0xf77737], [0xff0050, 0x00f2ea], [0xff0000, 0xcc0000], [0x1d9bf0, 0x0d6fb8], [0x25d366, 0x128c7e],
    [0x5865f2, 0x404eed], [0xfffc00, 0xe8d800], [0x111111, 0x444444], [0xe50914, 0x831010]];
  const appGeo = new THREE.ExtrudeGeometry(rr(.15, .15, .038), { depth: .018, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 3, curveSegments: 10 });
  const apps = APP_COLORS.map(([a, b], i) => {
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(a).lerp(new THREE.Color(b), .35), metalness: .2, roughness: .45, transparent: true });
    const m = new THREE.Mesh(appGeo, mat); m.userData = { base: mat.color.clone(), phase: (i / APP_COLORS.length) * Math.PI * 2, tilt: (rnd() - .5) * .8 };
    phone.add(m); return m;
  });
  const grey = new THREE.Color(0x3a332c);

  /* ── a year of prayer, in 365 dots ── */
  const N_DAYS = 365;
  const dotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.0145, 12, 10), new THREE.MeshStandardMaterial({ roughness: .4, metalness: .1, transparent: true }), N_DAYS);
  scene.add(dotMesh);
  const dotFrom = [], dotTo = [];
  const C_ALL = new THREE.Color(0x2e9e80), C_OPEN = new THREE.Color(0xe0a23c), C_MISS = new THREE.Color(0xcf5c6b), C_NOT = new THREE.Color(0x2b2520);
  const today = 272; // example data runs January to September
  for (let d = 0; d < N_DAYS; d++) {
    const week = Math.floor(d / 7), day = d % 7, cols = 53;
    const x = (week - cols / 2) * .036, y = (3 - day) * .036;
    const bend = Math.cos((week / cols - .5) * 1.1) * .3; // the grid curves, like a page of a ledger
    dotTo.push(new THREE.Vector3(x, y, bend - .3));
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr2 = .9 + rnd() * .9;
    dotFrom.push(new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(th) * rr2, u * rr2, Math.sqrt(1 - u * u) * Math.sin(th) * rr2));
    const r = rnd();
    const c = d > today ? C_NOT : d === today ? C_OPEN : d > today - 37 ? C_ALL : r < .8 ? C_ALL : r < .9 ? C_OPEN : C_MISS;
    dotMesh.setColorAt(d, c);
  }
  dotMesh.instanceColor.needsUpdate = true;
  const sampleDay = { all: 120, open: today, miss: (() => { for (let d = 200; d > 0; d--) { const c = new THREE.Color(); dotMesh.getColorAt(d, c); if (c.equals(C_MISS)) return d; } return 50; })() };
  const dotM4 = new THREE.Matrix4(), dotQ = new THREE.Quaternion(), dotS = new THREE.Vector3(), dotP = new THREE.Vector3();

  /* ── the mushaf ── */
  const book = new THREE.Group(); scene.add(book);
  const BW = .62, BH = .9;
  const pageCanvas = document.createElement('canvas'); pageCanvas.width = 620; pageCanvas.height = 900;
  const pageTex = new THREE.CanvasTexture(pageCanvas); pageTex.colorSpace = THREE.SRGBColorSpace; pageTex.anisotropy = 8;
  const leftCanvas = document.createElement('canvas'); leftCanvas.width = 620; leftCanvas.height = 900;
  const leftTex = new THREE.CanvasTexture(leftCanvas); leftTex.colorSpace = THREE.SRGBColorSpace; leftTex.anisotropy = 8;
  // Al-Fatihah, word by word, so one word at a time can be lit as it is recited.
  const FATIHA = [
    'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ',
    'ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    'مَٰلِكِ يَوْمِ ٱلدِّينِ',
    'إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ',
    'ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ',
    'صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ',
  ];
  const DIGITS = '٠١٢٣٤٥٦٧٨٩';
  const words = []; FATIHA.forEach((a, i) => a.split(' ').forEach((w, k, arr) => words.push({ w, ayah: i, last: k === arr.length - 1 })));
  function frame(g, W, H) {
    g.fillStyle = '#efe5cf'; g.fillRect(0, 0, W, H);
    const grd = g.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .75); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(90,60,20,.18)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#a8833f'; g.lineWidth = 3; g.strokeRect(34, 34, W - 68, H - 68);
    g.lineWidth = 1; g.strokeRect(44, 44, W - 88, H - 88);
  }
  function drawLeft() {
    const g = leftCanvas.getContext('2d'), W = 620, H = 900; frame(g, W, H);
    g.textAlign = 'center'; g.direction = 'rtl'; g.fillStyle = '#2b2117';
    g.strokeStyle = '#a8833f'; g.lineWidth = 2; g.beginPath(); g.roundRect(110, 120, W - 220, 92, 46); g.stroke();
    g.font = '700 46px Amiri, serif'; g.fillText('سُورَةُ ٱلْفَاتِحَةِ', W / 2, 180);
    g.font = '400 30px Amiri, serif'; g.fillStyle = '#6b5434';
    g.fillText('مَكِّيَّة · ٧ آيَات', W / 2, 270);
    g.direction = 'ltr'; g.font = 'italic 400 34px "Playfair Display", serif'; g.fillStyle = '#3a2e20';
    g.fillText('The Opening', W / 2, 470);
    g.font = '400 20px "IBM Plex Mono", monospace'; g.fillStyle = '#7a6444';
    g.fillText('PAGE 1 OF 604', W / 2, 520);
    g.strokeStyle = '#a8833f'; g.beginPath(); g.moveTo(W / 2 - 60, 600); g.lineTo(W / 2 + 60, 600); g.stroke();
    g.font = '400 19px Inter, sans-serif'; g.fillStyle = '#7a6444';
    g.fillText('The word lights as it is recited.', W / 2, 650);
    leftTex.needsUpdate = true;
  }
  function drawPage(lit) {
    const g = pageCanvas.getContext('2d'), W = 620, H = 900; frame(g, W, H);
    g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    const size = 34; g.font = `400 ${size}px Amiri, serif`;
    const left = 78, right = W - 78, lineH = 74; let x = right, y = 150;
    const space = g.measureText(' ').width;
    words.forEach((o, i) => {
      const w = g.measureText(o.w).width;
      const mark = o.last ? DIGITS[o.ayah + 1] : '';
      const markW = mark ? size * 1.15 : 0;
      if (x - w - markW < left) { x = right; y += lineH; }
      if (i === lit) { g.fillStyle = 'rgba(217,178,106,.32)'; g.beginPath(); g.roundRect(x - w - 8, y - size * 1.05, w + 16, size * 1.5, 10); g.fill(); g.fillStyle = '#8a6420'; }
      else g.fillStyle = '#231a12';
      g.fillText(o.w, x, y); x -= w + space;
      if (mark) {
        const cx = x - markW / 2 + space / 2, cy = y - size * .32;
        g.strokeStyle = '#a8833f'; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, size * .5, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#6b5434'; g.font = `400 ${size * .62}px Amiri, serif`; g.textAlign = 'center';
        g.fillText(mark, cx, cy + size * .22); g.textAlign = 'right'; g.font = `400 ${size}px Amiri, serif`;
        x -= markW + space;
      }
    });
    pageTex.needsUpdate = true;
  }
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc2, roughness: .9, transparent: true });
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x2a1b12, roughness: .6, metalness: .15, transparent: true });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xb8904a, roughness: .35, metalness: .9, transparent: true });
  const hinge = (geo) => { geo.translate(BW / 2, 0, 0); return geo; };
  const N_PAGES = 28;
  const pages = [];
  const coverL = new THREE.Mesh(hinge(new THREE.BoxGeometry(BW + .03, BH + .04, .02)), coverMat);
  const coverR = new THREE.Mesh(hinge(new THREE.BoxGeometry(BW + .03, BH + .04, .02)), coverMat);
  book.add(coverL, coverR);
  const trimL = new THREE.Mesh(hinge(new THREE.BoxGeometry(BW + .035, BH + .045, .004)), goldMat); trimL.position.z = -.012; coverL.add(trimL);
  for (let i = 0; i < N_PAGES; i++) {
    const p = new THREE.Mesh(hinge(new THREE.BoxGeometry(BW, BH, .0035)), paperMat);
    book.add(p); pages.push(p);
  }
  const leftGeo = new THREE.PlaneGeometry(BW * .985, BH * .985); leftGeo.translate(-BW / 2, 0, 0); // hinged on its right edge
  const pageL = new THREE.Mesh(leftGeo, new THREE.MeshStandardMaterial({ map: leftTex, roughness: .95, transparent: true }));
  const pageR = new THREE.Mesh(hinge(new THREE.PlaneGeometry(BW * .985, BH * .985)), new THREE.MeshStandardMaterial({ map: pageTex, roughness: .95, transparent: true }));
  book.add(pageL, pageR);

  /* ── annotations ── */
  const anno = $('#anno'), annoSvg = $('.anno__svg', anno), stepsEl = $('.story__steps');
  const labels = [];
  function addLabel(group, anchor, mono, title, small, side = 1, lift = -1) {
    const el = document.createElement('div'); el.className = 'anno__label';
    el.innerHTML = `<span class="mono">${mono}</span><b>${title}</b>${small ? `<small>${small}</small>` : ''}`;
    anno.append(el);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); annoSvg.append(path);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', 2.5); annoSvg.append(dot);
    const l = { group, anchor, el, path, dot, side, lift, on: false }; labels.push(l); return l;
  }
  PRAYERS.forEach((p, i) => addLabel(0, markers[i], `0${i + 1}`, p.name, `${p.time} · example`, i < 3 ? -1 : 1, i % 2 ? 1 : -1));
  const anchorAt = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  addLabel(1, anchorAt(phone, 0, .32, .01), 'A', 'The prayer screen', 'Covers a held app within a second', 1, -1);
  addLabel(1, anchorAt(phone, .1, -.32, .01), 'B', 'Then it lets go', 'Prayed or not, nothing stays locked', 1, 1);
  const dotAnchors = { all: new THREE.Object3D(), open: new THREE.Object3D(), miss: new THREE.Object3D() };
  Object.values(dotAnchors).forEach((o) => scene.add(o));
  addLabel(2, dotAnchors.all, 'G', 'All five', 'Confirmed, and counted', -1, -1);
  addLabel(2, dotAnchors.miss, 'R', 'Missed one', 'Recorded honestly', -1, 1);
  addLabel(2, dotAnchors.open, 'A', 'Today', 'Still open', 1, -1);

  /* ── keyframes: where everything stands at each point of the story ── */
  // f: 0 hero · 1.5 the day · 2.5 focus · 3.5 the year · 4.5 Tahajjud · 5.5 the Qur'an · 7 the rest of the page
  const K = [
    { f: 0,   cam: [0, .25, 4.9], look: [.2, 0, 0], globe: [1.35, -.05, 0, .92],     gA: 1,  ring: .55, phone: [1.3, -2.4, .3, 0], pA: 0, dots: 0, book: [1, -2.6, .4], bA: 0, spin: .06, bloom: .3 },
    { f: 1.5, cam: [0, .95, 4.3], look: [.55, 0, 0], globe: [.75, -.05, 0, .92], gA: 1,  ring: 1,   phone: [1.3, -2.4, .3, 0], pA: 0, dots: 0, book: [1, -2.6, .4], bA: 0, spin: .04, bloom: .2 },
    { f: 2.5, cam: [0, .3, 4.2],  look: [.55, 0, 0], globe: [2.2, .2, -2.6, .8], gA: .55, ring: .25, phone: [.8, 0, .55, -.38], pA: 1, dots: 0, book: [1, -2.6, .4], bA: 0, spin: .04, bloom: .2 },
    { f: 3.5, cam: [0, .35, 4.0], look: [.6, 0, 0], globe: [2.4, .3, -3.2, .75], gA: .35, ring: 0,  phone: [2.4, -.3, -1.2, -.7], pA: 0, dots: 1, book: [1, -2.6, .4], bA: 0, spin: .04, bloom: .2 },
    { f: 4.5, cam: [0, .2, 4.1],  look: [.55, .05, 0], globe: [1.05, 0, 0, 1.08], gA: 1, ring: 0,  phone: [2.4, -.3, -1.2, -.7], pA: 0, dots: 0, book: [1, -2.6, .4], bA: 0, spin: .015, bloom: 1 },
    { f: 5.5, cam: [0, .55, 3.9], look: [.6, 0, 0], globe: [2.1, .25, -3, .7],  gA: .45, ring: 0,  phone: [2.4, -.3, -1.2, -.7], pA: 0, dots: 0, book: [.62, -.02, .9], bA: 1, spin: .03, bloom: .6 },
    { f: 7,   cam: [0, .3, 5.2],  look: [0, 0, 0],   globe: [0, 0, -1.5, 1.2],  gA: .32, ring: .2, phone: [2.4, -.3, -1.2, -.7], pA: 0, dots: 0, book: [.62, -2.6, .9], bA: 0, spin: .05, bloom: .55 },
  ];
  function at(f) {
    let i = 0; while (i < K.length - 2 && f > K[i + 1].f) i++;
    const a = K[i], b = K[i + 1], t = smooth(clamp((f - a.f) / (b.f - a.f)));
    const mix = (x, y) => Array.isArray(x) ? x.map((v, k) => lerp(v, y[k], t)) : lerp(x, y, t);
    const o = {}; for (const k in a) if (k !== 'f') o[k] = mix(a[k], b[k]); return o;
  }

  /* ── frame ── */
  const opacityOf = new Map();
  function setAlpha(obj, a) {
    obj.visible = a > .005;
    obj.traverse((m) => {
      if (!m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if (!opacityOf.has(mat)) opacityOf.set(mat, mat.uniforms?.uOpacity ? 1 : mat.opacity);
        const base = opacityOf.get(mat);
        if (mat.uniforms?.uOpacity) mat.uniforms.uOpacity.value = base * a; else mat.opacity = base * a;
      });
    });
  }

  let narrow = false;
  function resize() {
    const w = innerWidth, h = innerHeight;
    narrow = w < 860;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    lightMat.uniforms.uScale.value = renderer.getPixelRatio() * (h / 900) * 1.4;
  }
  resize(); addEventListener('resize', resize);

  let mx = 0, my = 0, pmx = 0, pmy = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });

  const v = new THREE.Vector3(), nightDir = new THREE.Vector3();
  const clock = new THREE.Clock();
  let fSmooth = phase(), lit = -1, litT = 0, earthSpin = 0;
  const readLabel = $('#readout-label'), readBar = $('#readout-bar'), readVal = $('#readout-val');
  const READ = [['Sun’s path', 180, '°'], ['Window', 30, 'm'], ['Days', 365, ''], ['Lights tonight', N_LIGHTS, ''], ['Page', 604, '']];

  document.fonts.ready.then(() => { drawShield(); drawLeft(); drawPage(0); });

  function frameLoop() {
    const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
    if (lenis) lenis.raf(performance.now());
    const fRaw = phase();
    fSmooth += (fRaw - fSmooth) * (reduce ? 1 : Math.min(1, dt * 7));
    const f = fSmooth;
    updateNav(scrollY);

    const step = clamp(Math.floor(fRaw - 1), 0, 4);
    if (fRaw >= 1 && fRaw < 6) setStep(step);
    const local = clamp(f - 1 - step);
    const s = at(f);

    // layout: on narrow screens the copy sits at the bottom, so the stage centres and lifts
    const xs = narrow ? .12 : 1, yl = narrow ? (f > 1 && f < 6 ? .95 : .3) : 0, zb = narrow ? 1.55 : 1;
    pmx += (mx - pmx) * .04; pmy += (my - pmy) * .04;
    camera.position.set(s.cam[0] + pmx * .35, s.cam[1] - pmy * .25 - yl * .2, s.cam[2] * zb);
    camera.lookAt(s.look[0] * xs, s.look[1] + yl * .1, s.look[2]);

    // globe
    globe.position.set(s.globe[0] * xs, s.globe[1] + yl, s.globe[2]); globe.scale.setScalar(s.globe[3]);
    earthSpin += dt * s.spin * (reduce ? 0 : 1);
    const tahajjudTurn = smooth(clamp((f - 3.6) / 1.2)) * (1 - smooth(clamp((f - 5.2) / .8)));
    // Longitude L faces the camera when rotation.y = -PI/2 - L. Hero and the
    // night both look at the band from Africa to South East Asia.
    const drift = Math.sin(earthSpin * .5) * .55;
    earth.rotation.y = lerp(-2.45 + drift, -2.6, tahajjudTurn);
    earth.rotation.x = .18;
    setAlpha(earth, s.gA); atmo.material.uniforms.uOpacity.value = s.gA;
    lightMat.uniforms.uTime.value = time;
    lightMat.uniforms.uBloom.value = s.bloom * (step === 3 ? (.25 + .75 * smooth(local)) : 1);

    // the sun on its path: in the day movement it travels Fajr → Isha
    // Outside the day movement the sun is behind the Earth: it is night.
    const dayW = smooth(clamp((f - .8) / .45)) * (1 - smooth(clamp((f - 2.05) / .45)));
    const sunT = f < 1.05 ? 0 : f < 2.2 ? smooth(clamp((f - 1.05) / 1.05)) : 1;
    const sa = lerp(A0, A1, sunT);
    sun.position.set(Math.cos(sa) * R, 0, Math.sin(sa) * R);
    arc.updateMatrixWorld(); globe.updateMatrixWorld(); sun.getWorldPosition(v);
    v.sub(globe.position).normalize();
    nightDir.set(-.55, .2, -.8).normalize();
    v.lerp(nightDir, 1 - dayW).normalize();
    // the shader compares this with world-space normals
    earthMat.uniforms.sunDir.value.copy(v);
    ringMat.opacity = .22 * s.ring; tickMat.opacity = .3 * s.ring; dayMat.opacity = .9 * s.ring;
    sun.material.opacity = dayW; sun.visible = dayW > .01;
    markers.forEach((m, i) => { m.material.opacity = s.ring; m.scale.setScalar(Math.abs(PRAYERS[i].t - sunT) < .06 ? 1.8 : 1); });
    arc.visible = s.ring > .01;

    // phone, apps and the prayer screen
    phone.position.set(s.phone[0] * xs + (narrow ? .02 : 0), s.phone[1] + yl, s.phone[2]);
    phone.rotation.set(-.08 + pmy * .1, s.phone[3] + Math.sin(time * .6) * .04 + pmx * .2, .02);
    setAlpha(phone, s.pA);
    const hold = step === 1 ? smooth(clamp((local - .3) / .22)) : f > 3 ? 1 : 0;
    screenMat.uniforms.uMix.value = hold;
    apps.forEach((m, i) => {
      const a = m.userData.phase + time * .35 * (1 - hold * .85);
      const r = lerp(.62, .5, hold), z = lerp(.06, -.18, hold);
      m.position.set(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.25, z + Math.sin(a * 2) * .05);
      m.rotation.set(m.userData.tilt * .4, Math.cos(a) * .4 + m.userData.tilt, a * .1);
      m.material.color.copy(m.userData.base).lerp(grey, hold * .85);
      m.scale.setScalar(lerp(1, .82, hold));
    });

    // the year: dots fly in from around the globe and settle into a ledger of weeks
    // the year only arrives once its movement has begun, and leaves before the night
    const dA = s.dots * smooth(clamp((f - 3.05) / .35)) * (1 - smooth(clamp((f - 4.05) / .3)));
    dotMesh.visible = dA > .01; dotMesh.material.opacity = dA;
    if (dotMesh.visible) {
      const settle = step === 2 ? smooth(clamp(local / .7)) : dA;
      const dx = .78 * xs, dy = yl * .9, dz = .55;
      for (let d = 0; d < N_DAYS; d++) {
        const k = clamp(settle * 1.25 - (d / N_DAYS) * .25);
        const e = smooth(k);
        dotP.lerpVectors(dotFrom[d], dotTo[d], e);
        dotP.x += dx; dotP.y += dy + Math.sin(time * .8 + d * .3) * .004 * e; dotP.z += dz;
        dotS.setScalar(d === today ? 1.5 + Math.sin(time * 3) * .2 : 1);
        dotM4.compose(dotP, dotQ, dotS); dotMesh.setMatrixAt(d, dotM4);
        if (d === sampleDay.all) dotAnchors.all.position.copy(dotP);
        if (d === sampleDay.miss) dotAnchors.miss.position.copy(dotP);
        if (d === sampleDay.open) dotAnchors.open.position.copy(dotP);
      }
      dotMesh.instanceMatrix.needsUpdate = true;
    }

    // the mushaf opens, then the recitation lights one word at a time
    book.position.set(s.book[0] * xs, s.book[1] + yl * .8, s.book[2]);
    book.rotation.set(-.5 + pmy * .08, -.2 + pmx * .15, 0);
    setAlpha(book, s.bA);
    const open = step === 4 ? smooth(clamp(local / .55)) : f > 6 ? 1 : 0;
    // Pages turn about the spine (local y axis). Angle 0 lies to the right,
    // facing you; PI lies to the left. Open, the two halves make a shallow V.
    const leftAngle = lerp(.015, Math.PI - .16, open), rightAngle = lerp(0, .16, open);
    coverR.rotation.y = rightAngle; coverR.position.z = -.03;
    coverL.rotation.y = leftAngle; coverL.position.z = lerp(.03, -.03, open);
    pages.forEach((p, i) => {
      const half = i < N_PAGES / 2, k = (half ? i : i - N_PAGES / 2) / (N_PAGES / 2);
      p.rotation.y = half ? leftAngle - (1 - k) * .05 * open : rightAngle + k * .05 * open;
      p.position.z = half ? lerp(.026 - k * .022, -.024 + k * .02, open) : -.026 + k * .022;
    });
    pageR.rotation.y = rightAngle + .051 * open; pageR.position.z = .003;
    pageL.rotation.y = leftAngle - Math.PI - .051 * open; pageL.position.z = .003;
    pageL.visible = pageR.visible = open > .25 && s.bA > .01;
    if (s.bA > .5 && !reduce) {
      litT += dt;
      if (litT > .62) { litT = 0; lit = (lit + 1) % words.length; drawPage(lit); }
    }

    // readout
    const [rl, rmax, unit] = READ[step];
    if (readLabel.textContent !== rl) readLabel.textContent = rl;
    const val = step === 1 ? Math.round(30 * (1 - local)) : Math.round(rmax * local);
    readVal.textContent = String(val).padStart(step === 1 ? 2 : 3, '0') + unit;
    readBar.style.transform = `scaleX(${local})`;

    // the stage dims once the story is over, so the page reads cleanly over it
    canvas.style.opacity = f > 6 ? lerp(1, .38, clamp(f - 6)) : 1;

    // annotations
    const wantGroup = fRaw > 1.15 && fRaw < 5.9 && !narrow ? step : -1;
    const W = innerWidth, H = innerHeight, copyRight = stepsEl.getBoundingClientRect().right;
    labels.forEach((l, idx) => {
      const show = l.group === wantGroup && (l.group !== 0 || local > .08) && (l.group !== 1 || local > .3) && (l.group !== 2 || local > .62);
      let x = 0, y = 0;
      if (show) { l.anchor.getWorldPosition(v); v.project(camera); x = (v.x * .5 + .5) * W; y = (-v.y * .5 + .5) * H; }
      // a point that sits behind the copy keeps its label to itself
      const clear = show && x > copyRight + 24 && y > 70 && y < H - 70;
      if (clear !== l.on) { l.on = clear; l.el.classList.toggle('is-on', clear); }
      if (!clear) { l.path.setAttribute('d', ''); l.dot.setAttribute('cx', -99); return; }
      const tw = l.el.offsetWidth, reach = l.group === 0 ? 70 + (idx % 2) * 26 : 120;
      // never over the copy: a label that would land on the text column goes right instead
      const side = l.side < 0 && x - reach - 8 - tw < copyRight + 16 ? 1 : l.side;
      const lx = x + side * reach, ly = y + l.lift * (l.group === 0 ? 36 : 54);
      const tx = side > 0 ? lx + 8 : lx - 8 - tw;
      l.el.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ly - 18)}px)`;
      l.path.setAttribute('d', `M${x},${y} L${lx},${ly} L${lx + side * 6},${ly}`);
      l.dot.setAttribute('cx', x); l.dot.setAttribute('cy', y);
    });

    renderer.render(scene, camera);
    requestAnimationFrame(frameLoop);
  }
  requestAnimationFrame(frameLoop);
}

if (!renderer) {
  // No WebGL: the page still scrolls and steps still change.
  (function loop() {
    if (lenis) lenis.raf(performance.now());
    const f = phase(); updateNav(scrollY);
    if (f >= 1 && f < 6) setStep(clamp(Math.floor(f - 1), 0, 4));
    requestAnimationFrame(loop);
  })();
}
