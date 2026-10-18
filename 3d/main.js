/* Layla Pro — "One day".
 *
 * Scrolling the page is living through one day. A single number `d` says
 * where in it you are: -1 is the hour before Fajr (the hero), 0..5 are the
 * six chapters (Fajr, Dhuhr, Asr, Maghrib, Isha, the last third of the
 * night), and 6 is the rest of the page. The sky's colours, the sun on the
 * horizon, the stars, the phone's screen and finally the whole Earth with
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

  /* ── the phone, showing the part of the app that belongs to this hour ── */
  const phone = new THREE.Group(); scene.add(phone);
  const PW = .66, PH = 1.38;
  const rr = (w, h, r) => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const body = new THREE.ExtrudeGeometry(rr(PW, PH, .1), { depth: .045, bevelEnabled: true, bevelThickness: .014, bevelSize: .014, bevelSegments: 5, curveSegments: 18 });
  body.translate(0, 0, -.052);
  phone.add(new THREE.Mesh(body, new THREE.MeshStandardMaterial({ color: 0xd9d3c7, metalness: .9, roughness: .28 })));
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { a: { value: null }, b: { value: null }, mixAB: { value: 0 }, asp: { value: PW / PH } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D a, b; uniform float mixAB, asp; varying vec2 vUv;
      float rb(vec2 p, vec2 s, float r){ vec2 q = abs(p)-s+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
      void main(){ vec2 p = (vUv-.5)*vec2(asp,1.); float m = 1.-smoothstep(0.,.004, rb(p, vec2(asp*.5,.5), .064));
        vec3 c = mix(texture2D(a, vUv).rgb, texture2D(b, vUv).rgb, mixAB);
        float glass = smoothstep(.0,.9, vUv.y - vUv.x*.6) * .06;
        gl_FragColor = vec4(c + glass, m);
        #include <colorspace_fragment>
      }`,
    transparent: true,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(PW - .028, PH - .028), screenMat); screen.position.z = .01; phone.add(screen);

  const shieldCanvas = document.createElement('canvas'); shieldCanvas.width = 588; shieldCanvas.height = 1280;
  const shield = new THREE.CanvasTexture(shieldCanvas); shield.colorSpace = THREE.SRGBColorSpace;
  function drawShield() {
    const g = shieldCanvas.getContext('2d'), W = 588, H = 1280;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1c36'); bg.addColorStop(1, '#050b18'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(246,241,231,.55)'; g.font = '600 26px Satoshi, sans-serif'; g.fillText('PRAYER FOCUS', W / 2, 360);
    g.fillStyle = '#f6f1e7'; g.font = '600 110px "Clash Display", sans-serif'; g.fillText('Dhuhr', W / 2, 490);
    g.fillStyle = 'rgba(246,241,231,.74)'; g.font = '400 31px Satoshi, sans-serif'; g.fillText('This app is paused', W / 2, 580); g.fillText('until you have prayed.', W / 2, 624);
    g.fillStyle = '#d9b26a'; g.font = '500 32px Satoshi, sans-serif'; g.fillText('26 minutes left', W / 2, 720);
    g.beginPath(); g.roundRect(70, 800, W - 140, 104, 52); g.fill();
    g.fillStyle = '#060d1b'; g.font = '700 34px Satoshi, sans-serif'; g.fillText('I am praying now', W / 2, 864);
    g.fillStyle = 'rgba(246,241,231,.62)'; g.font = '400 30px Satoshi, sans-serif'; g.fillText('I missed this prayer', W / 2, 990); g.fillText('Close', W / 2, 1060);
    shield.needsUpdate = true;
  }
  document.fonts.ready.then(drawShield);
  const SCREENS = [tex('screens/home.webp'), shield, tex('screens/mushaf.webp'), tex('screens/friends.webp'), tex('screens/profile.webp'), tex('screens/tahajjud.webp')];
  screenMat.uniforms.a.value = SCREENS[0]; screenMat.uniforms.b.value = SCREENS[1];

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

    // The phone rises with Fajr, changes its screen at each prayer, and steps back for the night.
    const show = smooth(clamp((d + .45) / .5)) * (1 - smooth(clamp((d - 5.05) / .45)));
    const base = narrow ? [0, 1.05, 1.6, .68] : [1.45, .4, 1.9, 1];
    phone.position.set(base[0] + pmx * .1, base[1] - (1 - show) * 3.2 + Math.sin(time * .8) * .03, base[2]);
    phone.scale.setScalar(base[3]);
    const ci = clamp(Math.floor(d), 0, 5);
    phone.rotation.set(-.06 - pmy * .12, (ci % 2 ? .22 : -.22) * (narrow ? .5 : 1) + pmx * .3, (ci % 2 ? -.03 : .03));
    phone.visible = show > .01;
    // crossfade from this chapter's screen into the next across the boundary
    const local = d - Math.floor(d);
    const a = clamp(Math.floor(d), 0, 5), b = clamp(a + 1, 0, 5);
    screenMat.uniforms.a.value = SCREENS[a]; screenMat.uniforms.b.value = SCREENS[b];
    screenMat.uniforms.mixAB.value = a === b ? 0 : smooth(clamp((local - .82) / .18));

    // once the day is over the scene steps back so the page reads cleanly
    canvas.style.opacity = String(1 - .72 * smooth(clamp(d - 6)));
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
