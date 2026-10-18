/* Layla Pro — "One day".
 *
 * Scrolling the page is living through one day. A single number `d` says
 * where in it you are: -1 is the hour before Fajr (the hero), 0..5 are the
 * six chapters (Fajr, Dhuhr, Asr, Maghrib, Isha, the last third of the
 * night), and 6 is the rest of the page. The sky's colours, the sun on the
 * horizon, the stars, the object standing in for each hour and finally the whole Earth with
 * its Tahajjud lights are all read from `d`.
 */
import * as THREE from 'three';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ASSETS = '../assets/';
const cfg = window.LAYLA || {};

/* ───────────────────────────────── where in the day are we ── */

const chapters = $$('.ch');
const dayline = $('#dayline');
function dayPos() {
  const vh = innerHeight, mid = vh * .5;
  const first = chapters[0].getBoundingClientRect().top;
  if (mid < first) return -1 + clamp(scrollY / Math.max(1, scrollY + first - mid));
  for (let i = 0; i < chapters.length; i++) {
    const r = chapters[i].getBoundingClientRect();
    if (mid < r.bottom) return i + clamp((mid - r.top) / r.height);
  }
  return 6 + clamp((mid - dayline.getBoundingClientRect().bottom) / vh);
}

// The sky at the middle of each chapter.
const SKY = [
  { d: -1,  top: '#070b1f', bot: '#2a2852', sun: -32, night: 1 },
  { d: .5,  top: '#1b2452', bot: '#e3907c', sun: -4,  night: .55 },
  { d: 1.5, top: '#4a8bd0', bot: '#d6ebf7', sun: 72,  night: 0 },
  { d: 2.5, top: '#6a98c4', bot: '#f4d39c', sun: 30,  night: 0 },
  { d: 3.5, top: '#2c1c4b', bot: '#ff8b5e', sun: -1,  night: .3 },
  { d: 4.5, top: '#0b1030', bot: '#22305f', sun: -18, night: .9 },
  { d: 5.5, top: '#03050d', bot: '#0a1430', sun: -40, night: 1 },
  { d: 7,   top: '#05070f', bot: '#0d1430', sun: -40, night: 1 },
];
const cA = new THREE.Color(), cB = new THREE.Color();
function skyAt(d) {
  let i = 0; while (i < SKY.length - 2 && d > SKY[i + 1].d) i++;
  const a = SKY[i], b = SKY[i + 1], t = smooth(clamp((d - a.d) / (b.d - a.d)));
  return {
    top: '#' + cA.set(a.top).lerp(cB.set(b.top), t).getHexString(),
    bot: '#' + cA.set(a.bot).lerp(cB.set(b.bot), t).getHexString(),
    sun: lerp(a.sun, b.sun, t), night: lerp(a.night, b.night, t),
  };
}

const sky = $('.sky');
const navDots = $$('.day a');
let lastChapter = -2, lastTone = '';
function pageState(d) {
  const s = skyAt(d);
  sky.style.setProperty('--sky-top', s.top);
  sky.style.setProperty('--sky-bot', s.bot);
  const tone = d > 1.05 && d < 2.95 ? 'light' : 'dark';
  if (tone !== lastTone) { document.body.dataset.tone = tone; lastTone = tone; document.querySelector('meta[name="theme-color"]').content = s.top; }
  const ch = d < 0 ? -1 : Math.min(5, Math.floor(d));
  if (ch !== lastChapter) {
    lastChapter = ch;
    chapters.forEach((c, i) => c.classList.toggle('is-here', i === ch));
    navDots.forEach((a, i) => { a.classList.toggle('is-now', i === ch); a.classList.toggle('is-done', ch > i); });
  }
  return s;
}

/* ─────────────────────────────────────── the waitlist form ── */

(function joinForm() {
  const form = $('#joinform'), msg = $('#joinmsg');
  const say = (t, bad) => { msg.textContent = t; msg.classList.toggle('bad', !!bad); };
  // Buttons that name a platform choose it in the form, or go to the store once it is live.
  $$('[data-platform]').forEach((b) => {
    const url = b.dataset.platform === 'ios' ? cfg.STORE_URL : cfg.PLAY_URL;
    if (url) { b.href = url; b.rel = 'noopener'; b.textContent = b.dataset.platform === 'ios' ? 'Download on the App Store' : 'Get it on Google Play'; return; }
    b.addEventListener('click', () => { const r = form.querySelector(`input[value="${b.dataset.platform}"]`); if (r) r.checked = true; });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { say('That email does not look right. Check it and try again.', true); form.email.focus(); return; }
    const btn = form.querySelector('button'); btn.disabled = true; say('Adding you…');
    try {
      const res = await fetch(cfg.WAITLIST_URL.replace(/\/+$/, '') + '/join', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, platform: form.platform.value, company: form.company.value }),
      });
      if (res.ok) {
        const store = form.platform.value === 'ios' ? 'the App Store' : 'Google Play';
        form.classList.add('is-done');
        say(`You are on the list. I will email ${email} the day Layla Pro is on ${store}.`);
        form.email.value = '';
      } else say(res.status === 400 ? 'That email does not look right. Check it and try again.' : 'Something went wrong on my side. Please try again in a minute.', true);
    } catch { say('Could not reach the waitlist. Check your connection and try again.', true); }
    btn.disabled = false;
  });
})();

/* ─────────────────────────────────────────────── the scene ── */

const canvas = $('#scene');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { /* the sky gradient alone still tells the day */ }

if (!renderer) {
  const loop = () => { pageState(dayPos()); requestAnimationFrame(loop); }; loop();
} else build();

function build() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 200);
  const tl = new THREE.TextureLoader();
  const tex = (n) => { const t = tl.load(ASSETS + n); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.8); scene.add(sunLight);

  /* ── stars, and the moon ── */
  const N_STARS = 1400, sp = new Float32Array(N_STARS * 3), ss = new Float32Array(N_STARS);
  const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < N_STARS; i++) {
    const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * .95), r = 60;
    sp[i * 3] = Math.sin(ph) * Math.cos(th) * r; sp[i * 3 + 1] = Math.cos(ph) * r - 6; sp[i * 3 + 2] = -Math.abs(Math.sin(ph) * Math.sin(th) * r) - 10;
    ss[i] = rnd();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aR', new THREE.BufferAttribute(ss, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uNight: { value: 1 }, uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float aR; uniform float uTime, uPx; varying float vA;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vA = .35 + .65*aR*(.75 + .25*sin(uTime*(.6+aR*2.)+aR*50.));
        gl_PointSize = (1. + aR*2.2) * uPx; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uNight; varying float vA;
      void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.0,d); gl_FragColor = vec4(1.,.97,.92, a*vA*uNight); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(starGeo, starMat));

  const glow = (inner, outer) => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, inner); gr.addColorStop(.16, inner); gr.addColorStop(.3, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,250,236,1)', 'rgba(255,190,120,.35)'), transparent: true, depthWrite: false }));
  sun.scale.setScalar(3.2); scene.add(sun);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(246,242,232,1)', 'rgba(170,190,255,.18)'), transparent: true, depthWrite: false }));
  moon.scale.setScalar(1.4); scene.add(moon);

  /* ── the Earth: first a horizon under your feet, at the end a globe ── */
  const earth = new THREE.Group(); scene.add(earth);
  const spin = new THREE.Group(); earth.add(spin);
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: tex('earth-day.webp') }, nightMap: { value: tex('earth-night.webp') },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, uRim: { value: new THREE.Color('#e3907c') },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 wp = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform sampler2D dayMap, nightMap; uniform vec3 sunDir, uRim; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 n = normalize(vN); float l = dot(n, sunDir);
        float day = smoothstep(-.12, .3, l);
        vec3 dc = texture2D(dayMap, vUv).rgb * (.25 + .9*max(l,0.));
        vec3 nc = pow(texture2D(nightMap, vUv).rgb, vec3(1.3)) * vec3(1.4,1.15,.85) * 1.6;
        vec3 c = mix(nc, dc, day);
        float rim = pow(1. - max(dot(n, vV), 0.), 2.6);
        c = mix(c, uRim, rim * .85);
        gl_FragColor = vec4(c, 1.);
        #include <colorspace_fragment>
      }`,
  });
  spin.add(new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), earthMat));
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uRim: earthMat.uniforms.uRim, uA: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix*vec4(position,1.); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-wp.xyz); gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uRim; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float i = clamp(pow(.62 - dot(vN,vV), 3.5), 0., 1.); gl_FragColor = vec4(uRim*i*1.2, i*uA); }`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  earth.add(atmo);

  // Tahajjud lights: rough five-kilometre areas, never points, on the night side.
  const PLACES = [[21.4,39.8],[24.5,39.6],[31.8,35.2],[30,31.2],[33.5,36.3],[33.3,44.4],[35.7,51.4],[41,29],[39.9,32.9],[24.7,46.7],[25.3,51.5],[25.2,55.3],[23.6,58.4],[15.4,44.2],[2,45.3],[9,38.7],[15.6,32.5],[36.8,10.2],[36.7,3.1],[33.6,-7.6],[14.7,-17.4],[12.6,-8],[13.5,2.1],[9.1,7.4],[12,8.5],[6.5,3.4],[-6.8,39.3],[24.9,67],[31.5,74.3],[33.7,73],[28.6,77.2],[19.1,72.9],[17.4,78.5],[23.8,90.4],[22.3,91.8],[34.5,69.2],[41.3,69.3],[43.2,76.9],[3.1,101.7],[1.5,103.8],[5.4,100.3],[-6.2,106.8],[-7.3,112.7],[-6.9,107.6],[-5.1,119.4],[3.6,98.7],[-0.9,100.4],[7.1,125.6],[51.5,-0.1],[52.5,-1.9],[48.9,2.4],[52.5,13.4],[50.9,6.9],[40.7,-74],[41.9,-87.6],[43.7,-79.4],[-33.9,151.2],[-26.2,28],[-33.9,18.4],[55.8,37.6],[55.8,49.1],[40.4,49.9],[38.6,68.8],[29.4,47.9]];
  const NL = 380, lp = new Float32Array(NL * 3), lr = new Float32Array(NL);
  for (let i = 0; i < NL; i++) {
    const [la, lo] = PLACES[i % PLACES.length];
    const lat = THREE.MathUtils.degToRad(la + (rnd() - .5) * 5), lon = THREE.MathUtils.degToRad(lo + (rnd() - .5) * 6);
    lp[i * 3] = 1.008 * Math.cos(lat) * Math.cos(lon); lp[i * 3 + 1] = 1.008 * Math.sin(lat); lp[i * 3 + 2] = -1.008 * Math.cos(lat) * Math.sin(lon);
    lr[i] = rnd();
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aR', new THREE.BufferAttribute(lr, 1));
  const lightMat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float aR; uniform float uOn, uTime, uPx; varying float vA;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vec3 n = normalize(mat3(modelViewMatrix)*position);
        float face = smoothstep(0., .3, dot(n, normalize(-mv.xyz))); float on = smoothstep(aR-.1, aR, uOn);
        vA = 1.4*face*on*(.65+.35*sin(uTime*(1.+aR*1.5)+aR*30.)); gl_PointSize = (8.+9.*aR)*uPx; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = pow(smoothstep(.5,0.,d),2.); gl_FragColor = vec4(mix(vec3(.45,.72,1.), vec3(.9,.96,1.), a*a), a*vA); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  spin.add(new THREE.Points(lg, lightMat));

  /* ── the things on stage: one for each hour of the day ── */
  // They all stand in one place: to the right of the copy on a laptop, in
  // the top half of the screen on a phone, above the text card.
  const props = new THREE.Group(); scene.add(props);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x223355, .6));
  const keyLight = new THREE.DirectionalLight(0xfff2e2, 1.7); keyLight.position.set(-1, 2.5, 6); scene.add(keyLight); // lights the stage from the viewer's side

  // text drawn on a canvas, as a sprite or a plane
  function label(lines, { w = 512, h = 160, align = 'center' } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const draw = () => {
      const g = c.getContext('2d'); g.clearRect(0, 0, w, h); g.textAlign = align; g.textBaseline = 'middle';
      lines.forEach(([text, font, color, y]) => { g.font = font; g.fillStyle = color; g.fillText(text, align === 'center' ? w / 2 : 8, y); });
      t.needsUpdate = true;
    };
    draw(); document.fonts.ready.then(draw);
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    m.scale.set(w / h * .24, .24, 1); m.userData.draw = draw; return m;
  }
  const ivory = 0xf7f3ec, gold = 0xf0c98a;

  /* Fajr — the day as a dial, the sun moving through the five prayers */
  const dial = new THREE.Group(); props.add(dial);
  const DR = .82;
  const ringPts = []; for (let i = 0; i <= 200; i++) { const a = i / 200 * Math.PI * 2; ringPts.push(new THREE.Vector3(Math.cos(a) * DR, Math.sin(a) * DR, 0)); }
  dial.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: ivory, transparent: true, opacity: .25 })));
  const tickPts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r2 = DR + (i % 4 ? .025 : .06); tickPts.push(new THREE.Vector3(Math.cos(a) * DR, Math.sin(a) * DR, 0), new THREE.Vector3(Math.cos(a) * r2, Math.sin(a) * r2, 0)); }
  dial.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPts), new THREE.LineBasicMaterial({ color: ivory, transparent: true, opacity: .35 })));
  const A0 = Math.PI * 1.08, A1 = -Math.PI * .08; // Fajr on the left, Isha on the right, over the top
  const dayArc = []; for (let i = 0; i <= 120; i++) { const a = lerp(A0, A1, i / 120); dayArc.push(new THREE.Vector3(Math.cos(a) * DR, Math.sin(a) * DR, 0)); }
  dial.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(dayArc), new THREE.LineBasicMaterial({ color: gold, transparent: true })));
  const TIMES = [['Fajr', '05:52', 0], ['Sunrise', '07:04', .13], ['Dhuhr', '13:09', .46], ['Asr', '16:23', .67], ['Maghrib', '19:12', .87], ['Isha', '20:22', 1]];
  const dialMarks = TIMES.map(([n, t, k]) => {
    const a = lerp(A0, A1, k), m = new THREE.Mesh(new THREE.SphereGeometry(.03, 20, 14), new THREE.MeshStandardMaterial({ color: ivory, emissive: 0x222222, transparent: true }));
    m.position.set(Math.cos(a) * DR, Math.sin(a) * DR, 0); dial.add(m);
    const l = label([[n, '600 46px "Clash Display", sans-serif', '#f7f3ec', 62], [t, '500 34px Satoshi, sans-serif', 'rgba(247,243,236,.7)', 112]], { w: 320, h: 160 });
    l.scale.set(.58, .29, 1); l.position.set(Math.cos(a) * (DR + .32), Math.sin(a) * (DR + .24), 0); dial.add(l);
    return { m, k };
  });
  const dialSun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,250,236,1)', 'rgba(255,190,120,.45)'), transparent: true, depthWrite: false }));
  dialSun.scale.setScalar(.42); dial.add(dialSun);
  const dialCentre = label([['Next', '500 34px Satoshi, sans-serif', 'rgba(247,243,236,.6)', 40], ['Dhuhr', '600 72px "Clash Display", sans-serif', '#f7f3ec', 100], ['in 1:42:07', '500 34px Satoshi, sans-serif', '#ffb48a', 156]], { w: 400, h: 190 });
  dialCentre.scale.set(.78, .37, 1); dial.add(dialCentre);

  /* Dhuhr — the apps you chose, held behind a ring for thirty minutes */
  const focus = new THREE.Group(); props.add(focus);
  const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const appGeo = new THREE.ExtrudeGeometry(rr(.2, .2, .052), { depth: .03, bevelEnabled: true, bevelThickness: .01, bevelSize: .01, bevelSegments: 3, curveSegments: 10 });
  appGeo.center();
  const APPS = [0xe1306c, 0xff2d55, 0xff0000, 0x1d9bf0, 0x25d366, 0x5865f2, 0xfffc00, 0x222222, 0xe50914, 0xff6f00];
  const greyC = new THREE.Color(0x8d93a6);
  const apps = APPS.map((c, i) => { const mat = new THREE.MeshStandardMaterial({ color: c, roughness: .35, metalness: .15, transparent: true });
    const m = new THREE.Mesh(appGeo, mat); m.userData = { base: new THREE.Color(c), ph: i / APPS.length * Math.PI * 2, tilt: rnd() - .5 }; focus.add(m); return m; });
  const shieldRing = new THREE.Mesh(new THREE.TorusGeometry(.42, .012, 16, 120), new THREE.MeshBasicMaterial({ color: gold, transparent: true }));
  focus.add(shieldRing);
  const shieldDisc = new THREE.Mesh(new THREE.CircleGeometry(.41, 64), new THREE.MeshBasicMaterial({ color: 0x0d1630, transparent: true, opacity: .82 }));
  shieldDisc.position.z = -.005; focus.add(shieldDisc);
  const shieldText = label([['Dhuhr', '600 80px "Clash Display", sans-serif', '#f7f3ec', 70], ['apps held', '500 34px Satoshi, sans-serif', 'rgba(247,243,236,.7)', 130], ['26 minutes left', '600 36px Satoshi, sans-serif', '#ffb48a', 180]], { w: 420, h: 220 });
  shieldText.scale.set(.74, .388, 1); shieldText.position.z = .03; focus.add(shieldText);
  // the words sit on the disc, never inside it: drawn last and without a depth test
  shieldText.material.depthTest = false; shieldText.renderOrder = 10;

  /* Asr — the mushaf, opening, the recited word lit in gold */
  const book = new THREE.Group(); props.add(book);
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
  function pageFrame(g, W, H) {
    g.fillStyle = '#efe5cf'; g.fillRect(0, 0, W, H);
    const grd = g.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .75); grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(90,60,20,.18)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#a8833f'; g.lineWidth = 3; g.strokeRect(34, 34, W - 68, H - 68);
    g.lineWidth = 1; g.strokeRect(44, 44, W - 88, H - 88);
  }
  function drawLeft() {
    const g = leftCanvas.getContext('2d'), W = 620, H = 900; pageFrame(g, W, H);
    g.textAlign = 'center'; g.direction = 'rtl'; g.fillStyle = '#2b2117';
    g.strokeStyle = '#a8833f'; g.lineWidth = 2; g.beginPath(); g.roundRect(110, 120, W - 220, 92, 46); g.stroke();
    g.font = '700 46px Amiri, serif'; g.fillText('سُورَةُ ٱلْفَاتِحَةِ', W / 2, 180);
    g.font = '400 30px Amiri, serif'; g.fillStyle = '#6b5434';
    g.fillText('مَكِّيَّة · ٧ آيَات', W / 2, 270);
    g.direction = 'ltr'; g.font = '500 36px "Clash Display", sans-serif'; g.fillStyle = '#3a2e20';
    g.fillText('The Opening', W / 2, 470);
    g.font = '500 20px Satoshi, sans-serif'; g.fillStyle = '#7a6444';
    g.fillText('PAGE 1 OF 604', W / 2, 520);
    g.strokeStyle = '#a8833f'; g.beginPath(); g.moveTo(W / 2 - 60, 600); g.lineTo(W / 2 + 60, 600); g.stroke();
    g.font = '400 21px Satoshi, sans-serif'; g.fillStyle = '#7a6444';
    g.fillText('The word lights as it is recited.', W / 2, 650);
    leftTex.needsUpdate = true;
  }
  function drawPage(lit) {
    const g = pageCanvas.getContext('2d'), W = 620, H = 900; pageFrame(g, W, H);
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
  // A solid book: two page blocks in leather, opaque, so nothing shows through.
  // Each half is built lying open, flat, facing you; the spine is the y axis.
  const T = .05, CO = .012; // page-block thickness, cover overhang
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xe6d9bd, roughness: .92 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xd8c8a4, roughness: .95 });
  const coverMat = new THREE.MeshStandardMaterial({ color: 0x3b2516, roughness: .55, metalness: .1 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc19a52, roughness: .3, metalness: .85 });
  function half(dir, map) {
    const g = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, T), [edgeMat, edgeMat, edgeMat, edgeMat, paperMat, paperMat]);
    block.position.set(dir * BW / 2, 0, -T / 2); g.add(block);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(BW + CO, BH + CO * 2, .014), coverMat);
    cover.position.set(dir * (BW + CO) / 2, 0, -T - .007); g.add(cover);
    const rule = new THREE.Mesh(new THREE.BoxGeometry(BW + CO + .002, .006, .016), goldMat); // gilt line on the cover edge
    rule.position.set(dir * (BW + CO) / 2, -(BH / 2 + CO - .003), -T - .007); g.add(rule);
    const page = new THREE.Mesh(new THREE.PlaneGeometry(BW * .99, BH * .99), new THREE.MeshStandardMaterial({ map, roughness: .9 }));
    page.position.set(dir * BW / 2, 0, .0012); g.add(page);
    return g;
  }
  const rightHalf = half(1, pageTex), leftHalf = half(-1, leftTex);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, BH + CO * 2, 16, 1, true, Math.PI / 2, Math.PI), coverMat);
  spine.position.z = -T - .01;
  book.add(rightHalf, leftHalf, spine);

  /* Maghrib — friends, five dots each, filling as their day is prayed */
  const friends = new THREE.Group(); props.add(friends);
  const FRIENDS = [['You', 5], ['Amira', 4], ['Yusuf', 5], ['Hana', 3]];
  const dotGeo = new THREE.SphereGeometry(.05, 24, 16);
  const friendDots = [];
  FRIENDS.forEach(([name, done], r) => {
    const y = .42 - r * .28;
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(1.5, .22, .11), { depth: .015, bevelEnabled: false, curveSegments: 12 }), new THREE.MeshStandardMaterial({ color: 0x1a2340, roughness: .6, transparent: true, opacity: .85 }));
    plate.position.set(0, y, -.03); friends.add(plate);
    const l = label([[name, '600 40px "Clash Display", sans-serif', '#f7f3ec', 50]], { w: 300, h: 100, align: 'left' }); l.scale.set(.48, .16, 1); l.position.set(-.38, y, .01); friends.add(l);
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(dotGeo, new THREE.MeshStandardMaterial({ color: 0x3a4466, roughness: .3, metalness: .2, transparent: true, emissive: 0x000000 }));
      m.position.set(.06 + k * .14, y, .02); friends.add(m); friendDots.push({ m, order: k + r * .15, on: k < done });
    }
  });
  const fFill = new THREE.Color(0x2e9e80), fEmpty = new THREE.Color(0x3a4466);

  /* Isha — the year: 365 dots, and the counts that matter */
  const year = new THREE.Group(); props.add(year);
  const yearMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.016, 10, 8), new THREE.MeshStandardMaterial({ roughness: .4, transparent: true }), 365);
  year.add(yearMesh);
  const C_ALL = new THREE.Color(0x2e9e80), C_OPEN = new THREE.Color(0xe0a23c), C_MISS = new THREE.Color(0xcf5c6b), C_NOT = new THREE.Color(0x2c3350);
  const TODAY = 290, yFrom = [], yTo = [];
  for (let dd = 0; dd < 365; dd++) {
    const wk = Math.floor(dd / 7), wd = dd % 7;
    yTo.push(new THREE.Vector3((wk - 26) * .042, (3 - wd) * .042, 0));
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, rr2 = .7 + rnd() * .6;
    yFrom.push(new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(th) * rr2, u * rr2, Math.sqrt(1 - u * u) * Math.sin(th) * rr2 * .4));
    const r = rnd();
    yearMesh.setColorAt(dd, dd > TODAY ? C_NOT : dd === TODAY ? C_OPEN : dd > TODAY - 37 ? C_ALL : r < .82 ? C_ALL : r < .91 ? C_OPEN : C_MISS);
  }
  yearMesh.instanceColor.needsUpdate = true;
  const yM = new THREE.Matrix4(), yQ = new THREE.Quaternion(), yS = new THREE.Vector3(1, 1, 1), yP = new THREE.Vector3();
  const counts = [['37', 'days in a row'], ['1,240', 'prayers this year'], ['32', 'Tahajjud nights']].map(([n, t], i) => {
    const l = label([[n, '600 84px "Clash Display", sans-serif', '#f7f3ec', 64], [t, '500 30px Satoshi, sans-serif', 'rgba(247,243,236,.7)', 132]], { w: 360, h: 170 });
    l.scale.set(.62, .293, 1); l.position.set((i - 1) * .72, .5, 0); year.add(l); return l;
  });
  // the key, each dot in its own colour
  const legend = label([], { w: 720, h: 80 });
  const drawLegend = () => {
    const c = legend.material.map.image, g = c.getContext('2d'); g.clearRect(0, 0, 720, 80); g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '500 26px Satoshi, sans-serif';
    let x = 60;
    [['#2e9e80', 'all five'], ['#e0a23c', 'still open'], ['#cf5c6b', 'missed one']].forEach(([col, t]) => {
      g.fillStyle = col; g.beginPath(); g.arc(x, 40, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(247,243,236,.78)'; g.fillText(t, x + 20, 41); x += 40 + g.measureText(t).width + 50;
    });
    legend.material.map.needsUpdate = true;
  };
  drawLegend(); document.fonts.ready.then(drawLegend);
  legend.scale.set(1.2, .133, 1); legend.position.set(0, -.34, 0); year.add(legend);

  const STAGE = [dial, focus, book, friends, year];
  const opacityOf = new Map();
  function setAlpha(obj, a) {
    obj.visible = a > .005;
    obj.traverse((m) => {
      if (!m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        if (!opacityOf.has(mat)) opacityOf.set(mat, mat.opacity);
        const v = opacityOf.get(mat) * a, t = v < .999;
        if (mat.transparent !== t && !(mat instanceof THREE.SpriteMaterial)) { mat.transparent = t || opacityOf.get(mat) < 1; mat.needsUpdate = true; }
        mat.opacity = v;
      });
    });
  }
  let lit = 0, litT = 0;
  document.fonts.ready.then(() => { drawLeft(); drawPage(0); });

  /* ── frame ── */
  let narrow = false;
  function resize() {
    narrow = innerWidth < 860;
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    starMat.uniforms.uPx.value = lightMat.uniforms.uPx.value = renderer.getPixelRatio() * (narrow ? .8 : 1);
  }
  resize(); addEventListener('resize', resize);
  let mx = 0, my = 0, pmx = 0, pmy = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });

  const clock = new THREE.Clock(), v = new THREE.Vector3();
  let dS = dayPos();
  const rim = new THREE.Color();
  function frame() {
    const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
    const dRaw = dayPos();
    dS += (dRaw - dS) * (reduce ? 1 : Math.min(1, dt * 6));
    const d = dS;
    const s = pageState(dRaw);
    pmx += (mx - pmx) * .05; pmy += (my - pmy) * .05;

    // How far the camera has pulled back from the horizon to see the whole Earth.
    const orbit = smooth(clamp((d - 5.05) / .8));
    camera.position.set(pmx * .4, .2 - pmy * .2, 7);
    camera.lookAt(0, .45, 0);

    // The horizon: a huge Earth whose curve sits low in the frame.
    const horizon = { pos: [0, narrow ? -10.6 : -10.2, -3], scale: 9.4, rx: 1.13, ry: 0 };
    const globe = { pos: [narrow ? 0 : 1.7, narrow ? 1.1 : .85, -1], scale: narrow ? 1 : 1.15, rx: -.25, ry: -3.0 };
    earth.position.set(lerp(horizon.pos[0], globe.pos[0], orbit), lerp(horizon.pos[1], globe.pos[1], orbit), lerp(horizon.pos[2], globe.pos[2], orbit));
    earth.scale.setScalar(lerp(horizon.scale, globe.scale, orbit));
    spin.rotation.set(lerp(horizon.rx, globe.rx, orbit), lerp(horizon.ry, globe.ry, orbit) + (reduce ? 0 : time * .01 * orbit), 0);
    rim.set(s.bot); earthMat.uniforms.uRim.value.copy(rim).lerp(new THREE.Color('#8fb3ff'), orbit * .7);

    // The sun walks the sky from east to west as the day goes on.
    const dayFrac = clamp((d + .2) / 3.8);
    const elev = s.sun;
    sun.position.set(lerp(-5.5, 5.5, dayFrac), -1.9 + elev * .06, -9);
    sun.material.opacity = clamp((elev + 8) / 10) * (1 - orbit);
    sun.scale.setScalar(lerp(4.4, 2.8, clamp(elev / 60)));
    sun.material.color.set(elev < 12 ? '#ffc79a' : '#fff6e6');
    moon.position.set(-3.4, 2.6, -10); moon.material.opacity = clamp(s.night * 1.4 - .4) * (1 - orbit * .5);
    starMat.uniforms.uNight.value = s.night; starMat.uniforms.uTime.value = time;
    // light on the Earth comes from the sun, or from behind it at night
    v.copy(sun.position).sub(earth.position).normalize();
    const nightDir = new THREE.Vector3(.2, -.6, -1).normalize();
    earthMat.uniforms.sunDir.value.copy(v).lerp(nightDir, clamp(1 - (elev + 6) / 14)).normalize();
    sunLight.position.copy(sun.position); sunLight.intensity = .6 + clamp(elev / 40) * 1.6;
    lightMat.uniforms.uOn.value = orbit * (1 - smooth(clamp((d - 6) * 1.5))); lightMat.uniforms.uTime.value = time;

    // The stage: each hour's object rises in with its chapter and leaves with it.
    const ci = clamp(Math.floor(d), 0, 5), local = clamp(d - Math.floor(d));
    props.position.set(narrow ? 0 : 1.62, narrow ? 1.18 : .42, narrow ? 1.6 : 1.3);
    props.scale.setScalar(narrow ? .6 : 1.08);
    props.rotation.set(-pmy * .15, pmx * .35, 0);
    STAGE.forEach((obj, i) => {
      // in once its chapter has begun, out before the next one arrives, so two never overlap
      const w = smooth(clamp((d - i + .08) / .22)) * (1 - smooth(clamp((d - i - .86) / .14)));
      setAlpha(obj, w);
      obj.position.y = (1 - w) * -.35;
      obj.scale.setScalar(.88 + .12 * w);
    });
    const t = time * (reduce ? 0 : 1);
    if (dial.visible) {
      const k = ci === 0 ? clamp(local * 1.15) : 1;
      const a = lerp(A0, A1, k);
      dialSun.position.set(Math.cos(a) * DR, Math.sin(a) * DR, .01);
      dialMarks.forEach(({ m, k: mk }) => m.scale.setScalar(Math.abs(mk - k) < .05 ? 1.8 : 1));
      dial.rotation.set(-.15, -.25, 0);
    }
    if (focus.visible) {
      const hold = ci === 1 ? smooth(clamp((local - .2) / .35)) : ci > 1 ? 1 : 0;
      apps.forEach((m) => {
        const a = m.userData.ph + t * .5 * (1 - hold * .9);
        const r = lerp(.62, .78, hold);
        m.position.set(Math.cos(a) * r, Math.sin(a) * r * .8, lerp(.05, -.25, hold) + Math.sin(a * 2) * .06);
        m.rotation.set(m.userData.tilt * .5, Math.cos(a) * .5, a * .2);
        m.material.color.copy(m.userData.base).lerp(greyC, hold * .9);
      });
      shieldRing.scale.setScalar(.6 + .4 * hold); shieldRing.material.opacity = hold;
      shieldDisc.scale.setScalar(.6 + .4 * hold); shieldDisc.material.opacity = .82 * hold;
      shieldText.material.opacity = hold; shieldText.visible = hold > .02;
      focus.rotation.set(0, -.2, 0);
    }
    if (book.visible) {
      const open = ci === 2 ? smooth(clamp(local / .4)) : ci > 2 ? 1 : 0;
      rightHalf.rotation.y = .16 * open;
      leftHalf.rotation.y = lerp(-Math.PI + .02, -.16, open);
      book.rotation.set(-.42, -.1, 0); book.scale.multiplyScalar(1.05);
      if (open > .6 && !reduce) { litT += dt; if (litT > .6) { litT = 0; lit = (lit + 1) % words.length; drawPage(lit); } }
    }
    if (friends.visible) {
      const fill = ci === 3 ? clamp(local * 1.6) : ci > 3 ? 1 : 0;
      friendDots.forEach(({ m, order, on }) => {
        const lit2 = on && fill * 5.6 > order;
        m.material.color.copy(lit2 ? fFill : fEmpty); m.material.emissive.set(lit2 ? 0x0d3a2e : 0x000000);
        m.scale.setScalar(lit2 ? 1.12 : .9);
      });
      friends.rotation.set(-.1, -.28, 0);
    }
    if (year.visible) {
      const settle = ci === 4 ? smooth(clamp(local / .5)) : ci > 4 ? 1 : 0;
      for (let dd = 0; dd < 365; dd++) {
        const e = smooth(clamp(settle * 1.3 - dd / 365 * .3));
        yP.lerpVectors(yFrom[dd], yTo[dd], e);
        yS.setScalar(dd === TODAY ? 1.5 + Math.sin(t * 3) * .25 : 1);
        yM.compose(yP, yQ, yS); yearMesh.setMatrixAt(dd, yM);
      }
      yearMesh.instanceMatrix.needsUpdate = true;
      counts.forEach((l) => { l.material.opacity = settle; });
      legend.material.opacity = settle;
      year.rotation.set(-.08, -.22, 0);
    }

    // once the day is over the scene steps back so the page reads cleanly
    canvas.style.opacity = String(1 - .72 * smooth(clamp(d - 6)));
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
