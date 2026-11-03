// Scena 3D: città blu procedurale, telecamera guidata dallo scroll,
// anello luminoso in fondo alla piazza: le competenze (in HTML) ci si radunano intorno.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Generatore casuale con seme fisso: la città è sempre la stessa.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Pianta della scena
const AVE = 11;            // metà larghezza del viale centrale
const CITY_Z0 = 44;        // inizio città
const CITY_Z1 = -185;      // fine città, poi la piazza dell'anello
const RING_C = new THREE.Vector3(0, 20, -250);
const RING_R = 15;

// Fotogrammi chiave della telecamera, uno per sezione della pagina.
// p = posizione, l = punto guardato, f = densità della nebbia
const KEYS = [
  { p: [0, 64, 80],      l: [0, 8, -95],       f: 0.0092 }, // intro
  { p: [0, 30, 66],      l: [0, 14, -40],      f: 0.0098 }, // chi sono
  { p: [-2, 7, 24],      l: [-16, 13, -28],    f: 0.0105 }, // 2008
  { p: [3, 13, -40],     l: [16, 17, -96],     f: 0.0105 }, // 2014
  { p: [-4, 27, -108],   l: [-8, 20, -168],    f: 0.0098 }, // 2019
  { p: [0, 21, -172],    l: [0, 20, -250],     f: 0.0088 }, // 2025
  { p: [24, 31, -206],   l: null,              f: 0.0086 }, // competenze (calcolato)
  { p: [0, 80, -150],    l: [0, 6, -262],      f: 0.0066 }, // certificazioni
  { p: [0, 21, -203],    l: [0, 18.5, -250],   f: 0.006 },  // contatti
];

// ---------- Milano: Stazione Centrale e grattacieli in fondo alla piazza ----------
// Pezzi a blocchi, disegnati con lo stesso shader delle torri.
// Ogni pezzo: centro edificio (cx, cz), rotazione ry, scostamento locale (lx, lz),
// quota di partenza, dimensioni, seme (> 0.88 accende un flusso di dati).
const MILANO = [];
const FOOTPRINTS = [];  // [x, z, raggio]: qui la città generica non costruisce
function piece(cx, cz, ry, lx, lz, lift, w, h, d, seed = 0.5, twist = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  MILANO.push({ x: cx + lx * c + lz * s, z: cz - lx * s + lz * c, lift, w, h, d, ry: ry + twist, seed });
}

// Stazione Centrale: corpo lungo, avancorpo centrale, padiglioni d'angolo
const STATION_Z = -300;
piece(0, STATION_Z, 0, 0, -2, 0, 118, 17, 18, 0.3);
piece(0, STATION_Z, 0, 0, 1, 0, 46, 30, 22, 0.22);
piece(0, STATION_Z, 0, -62, 0, 0, 12, 23, 22, 0.3);
piece(0, STATION_Z, 0, 62, 0, 0, 12, 23, 22, 0.3);

// Pirellone, sul lato della piazza: pianta a losanga e tetto sospeso
{
  const [x, z, r] = [-54, -262, 0.25];
  piece(x, z, r, 0, 0, 0, 11, 46, 4.2, 0.41);
  for (const sgn of [-1, 1]) {
    piece(x, z, r, sgn * 6.7, 0, 0, 2.4, 46, 3.2, 0.41);
    piece(x, z, r, sgn * 8.6, 0, 0, 1.4, 46, 2.0, 0.41);
  }
  piece(x, z, r, 0, 0, 47.2, 18, 0.6, 5, 0.3);
  FOOTPRINTS.push([x, z, 14]);
}

// Porta Nuova: torre UniCredit con la guglia e le due torri basse
{
  const [x, z, r] = [-92, -322, 0.6];
  piece(x, z, r, 0, 0, 0, 9, 52, 9, 0.93);
  piece(x, z, r, 0, 0, 52, 7.4, 5, 7.4, 0.93);
  piece(x, z, r, 0, 0, 57, 5.4, 4, 5.4, 0.93);
  piece(x, z, r, 0, 0, 61, 3.4, 3, 3.4, 0.93);
  piece(x, z, r, 0, 0, 64, 0.5, 26, 0.5, 0.2);
  piece(x, z, r, 12, 7, 0, 8, 40, 8, 0.6);
  piece(x, z, r, 12, 7, 40, 6, 4, 6, 0.6);
  piece(x, z, r, -11, 9, 0, 8, 30, 8, 0.55);
  FOOTPRINTS.push([x, z, 22]);
}

// CityLife: il Dritto, lo Storto, il Curvo
{
  const [x, z, r] = [74, -318, -0.3];
  piece(x, z, r, 0, 0, 0, 12, 64, 5, 0.47);
  piece(x, z, r, -6.6, 0, 0, 1, 64, 5.6, 0.2);
  piece(x, z, r, 6.6, 0, 0, 1, 64, 5.6, 0.2);
  FOOTPRINTS.push([x, z, 12]);
}
{
  const [x, z] = [95, -340];
  for (let i = 0; i < 15; i++) {
    const k = 1 - i * 0.008;
    piece(x, z, 0, 0, 0, i * 3.8, 9 * k, 3.8, 9 * k, 0.52, i * 0.05);
  }
  FOOTPRINTS.push([x, z, 12]);
}
{
  const [x, z, r] = [114, -322, -0.5];
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    piece(x, z, r, -t * t * 7, 0, i * 4, 11 - t * 3, 4, 5, 0.44);
  }
  FOOTPRINTS.push([x, z, 14]);
}

function isFree(x, z) {
  if (Math.abs(x) < 72 && z < -284 && z > -372) return false; // stazione e binari
  return FOOTPRINTS.every(([fx, fz, r]) => Math.hypot(x - fx, z - fz) > r);
}

// Blu elettrico (il nome resta RED per non toccare gli shader)
const RED = new THREE.Color().setRGB(0.08, 0.42, 1.0);
const FOG = new THREE.Color(0x020610);

const towerVert = /* glsl */`
  attribute vec3 aScale;
  attribute float aSeed;
  attribute float aLift;
  varying vec3 vP;
  varying vec3 vS;
  varying vec3 vN;
  varying vec3 vW;
  varying float vSeed;
  varying float vLift;
  void main() {
    vP = position;
    vS = aScale;
    vN = normal;
    vSeed = aSeed;
    vLift = aLift;
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const towerFrag = /* glsl */`
  uniform float uTime;
  uniform vec3 uRed;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vP;
  varying vec3 vS;
  varying vec3 vN;
  varying vec3 vW;
  varying float vSeed;
  varying float vLift;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    vec3 n = vN;
    float isTop = step(0.5, n.y);
    vec3 q = (vP + 0.5) * vS;
    bool sideX = abs(n.x) > 0.5;
    float hx = sideX ? q.z : q.x;
    float faceW = sideX ? vS.z : vS.x;
    float hy = q.y + vLift;  // quota reale: i pezzi impilati continuano le file di finestre

    vec3 col = vec3(0.006, 0.014, 0.034) * (0.75 + 0.25 * abs(n.x));

    if (isTop < 0.5 && abs(n.y) < 0.5) {
      // finestre: righe come quelle di una tabella
      vec2 g = vec2(hx * 1.3, hy * 0.85);
      vec2 cell = floor(g);
      vec2 f = fract(g);
      float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.34, f.y) * step(f.y, 0.72);
      float r = hash(cell + vec2(vSeed * 91.0, n.x * 7.0 + n.z * 13.0));
      float density = 0.1 + 0.42 * fract(vSeed * 7.13);
      float lit = step(1.0 - density, r);
      float flick = 0.8 + 0.2 * sin(uTime * (0.6 + r * 2.5) + r * 40.0);
      vec3 wc = mix(uRed, vec3(0.55, 0.9, 1.0), step(0.97, r));
      col += win * lit * wc * (0.22 + 1.1 * r * r) * flick;
      col += win * (1.0 - lit) * vec3(0.008, 0.02, 0.055);

      // flussi di dati verticali su alcune torri
      float stream = step(0.88, vSeed) * (1.0 - smoothstep(0.06, 0.14, abs(hx - faceW * 0.5)));
      float ph = fract(hy * 0.035 - uTime * 0.3 + vSeed * 10.0);
      float pulse = smoothstep(0.0, 0.08, ph) * (1.0 - smoothstep(0.08, 0.3, ph));
      col += uRed * stream * (0.25 + 2.4 * pulse);
    } else if (isTop > 0.5) {
      vec2 g = abs(fract(vec2(q.x, q.z) * 0.5) - 0.5);
      col += vec3(0.01, 0.035, 0.1) * step(0.45, max(g.x, g.y));
    }

    // spigoli luminosi
    vec3 d = (0.5 - abs(vP)) * vS + abs(n) * 1000.0;
    float e = min(d.x, min(d.y, d.z));
    col += uRed * (1.0 - smoothstep(0.02, 0.1, e)) * 0.5;

    // riflesso blu dal suolo
    col += uRed * 0.14 * exp(-hy * 0.5) * (1.0 - isTop);

    float dist = length(vW - cameraPosition);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    gl_FragColor = vec4(mix(col, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
  }
`;

const groundVert = /* glsl */`
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const groundFrag = /* glsl */`
  uniform vec3 uRed;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uAve;
  uniform float uZ1;
  uniform vec3 uRing;
  uniform float uRingA;
  varying vec3 vW;

  float lineAt(float v, float w) {
    float fw = fwidth(v);
    return 1.0 - smoothstep(w, w + fw * 1.5, abs(v));
  }

  void main() {
    vec2 p = vW.xz;
    vec3 col = vec3(0.002, 0.005, 0.014);

    vec2 gg = abs(fract(p / 5.0 - 0.5) - 0.5) * 5.0;
    vec2 fw = fwidth(p);
    vec2 gl = 1.0 - smoothstep(vec2(0.03), vec2(0.03) + fw * 1.5, gg);
    col += uRed * max(gl.x, gl.y) * 0.07;

    float ax = abs(p.x);
    float inCity = step(uZ1, p.y) * step(p.y, 60.0);
    col += uRed * lineAt(ax - (uAve - 0.8), 0.06) * 0.9 * inCity;
    float dash = step(0.55, fract(p.y * 0.08)) * lineAt(ax, 0.12);
    col += uRed * dash * 0.6 * inCity;
    col += uRed * 0.05 * exp(-ax * 0.12);

    float pr = length(p - uRing.xz);
    col += uRed * 0.1 * exp(-pr * 0.045) * (0.4 + uRingA);

    float dist = length(vW - cameraPosition);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    gl_FragColor = vec4(mix(col, uFogColor, clamp(fog, 0.0, 1.0)), 1.0);
  }
`;

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createScene(canvas, { mobile = false, reducedMotion = false, onFirstFrame } = {}) {
  const rand = mulberry32(20080501);

  // misure della tela, non della finestra: la tela è alta quanto il viewport grande,
  // così la barra degli indirizzi del telefono che compare e sparisce non la ridimensiona
  const viewW = () => canvas.clientWidth || window.innerWidth;
  const viewH = () => canvas.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.setSize(viewW(), viewH(), false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.background = FOG.clone();
  scene.fog = new THREE.FogExp2(FOG, KEYS[0].f);

  const camera = new THREE.PerspectiveCamera(55, viewW() / viewH(), 0.1, 800);

  const fogUniform = { value: KEYS[0].f };
  const timeUniform = { value: 0 };

  // ---------- Torri ----------
  const CELL = mobile ? 6 : 5;
  const XMAX = mobile ? 64 : 96;
  const towers = [];
  for (let z = CITY_Z0, zi = 0; z > CITY_Z1; z -= CELL, zi++) {
    if (zi % 6 === 5) continue;                          // strade trasversali
    for (const side of [-1, 1]) {
      for (let x = AVE + 3, xi = 0; x < XMAX; x += CELL, xi++) {
        if (xi % 5 === 4) continue;                      // strade laterali
        if (rand() < 0.12) continue;
        const w = CELL * (0.52 + rand() * 0.3);
        const d = CELL * (0.52 + rand() * 0.3);
        let h = 4 + Math.pow(rand(), 2.0) * 36;
        if (rand() < 0.06) h += 22 + rand() * 26;
        if (xi === 0) h = Math.max(h, 9 + rand() * 18);
        towers.push(side * (x + (rand() - 0.5)), z + (rand() - 0.5), w, d, h, rand());
      }
    }
  }
  // skyline dietro la piazza
  for (let z = -300; z > -372; z -= 8) {
    for (let x = -140; x <= 140; x += 7) {
      if (!isFree(x, z) || rand() < 0.2) continue;
      const h = 12 + Math.pow(rand(), 1.5) * 40;  // più bassa: emergono i grattacieli di Milano
      towers.push(x + (rand() - 0.5) * 2, z, 4 + rand() * 3, 4 + rand() * 3, h, rand());
    }
  }
  // ai lati della piazza
  for (let z = CITY_Z1 - 4; z > -296; z -= 7) {
    for (const side of [-1, 1]) {
      for (let x = 46; x < 110; x += 7) {
        if (!isFree(side * x, z) || (x < 76 && z > -258) || rand() < 0.25) continue;  // piazza aperta verso i grattacieli
        const h = 6 + Math.pow(rand(), 1.6) * 20;  // bassi: lasciano vedere i grattacieli
        towers.push(side * x, z, 4 + rand() * 2, 4 + rand() * 2, h, rand());
      }
    }
  }

  const tCount = towers.length / 6;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const towerGeo = boxGeo.clone();
  const aScale = new Float32Array(tCount * 3);
  const aSeed = new Float32Array(tCount);
  const towerMat = new THREE.ShaderMaterial({
    vertexShader: towerVert,
    fragmentShader: towerFrag,
    uniforms: {
      uTime: timeUniform,
      uRed: { value: RED },
      uFogColor: { value: FOG },
      uFogDensity: fogUniform,
    },
  });
  const towerMesh = new THREE.InstancedMesh(towerGeo, towerMat, tCount);
  const m4 = new THREE.Matrix4();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  const q4 = new THREE.Quaternion();
  const eul = new THREE.Euler();
  for (let i = 0; i < tCount; i++) {
    const [x, z, w, d, h, s] = towers.slice(i * 6, i * 6 + 6);
    m4.compose(v3.set(x, h / 2, z), q4.identity(), s3.set(w, h, d));
    towerMesh.setMatrixAt(i, m4);
    aScale.set([w, h, d], i * 3);
    aSeed[i] = s;
  }
  towerGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(aScale, 3));
  towerGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  towerGeo.setAttribute('aLift', new THREE.InstancedBufferAttribute(new Float32Array(tCount), 1));
  towerMesh.frustumCulled = false;
  scene.add(towerMesh);

  // ---------- Milano ----------
  const mCount = MILANO.length;
  const miGeo = boxGeo.clone();
  const miScale = new Float32Array(mCount * 3);
  const miSeed = new Float32Array(mCount);
  const miLift = new Float32Array(mCount);
  const miMesh = new THREE.InstancedMesh(miGeo, towerMat, mCount);
  MILANO.forEach((b, i) => {
    m4.compose(v3.set(b.x, b.lift + b.h / 2, b.z), q4.setFromEuler(eul.set(0, b.ry, 0)), s3.set(b.w, b.h, b.d));
    miMesh.setMatrixAt(i, m4);
    miScale.set([b.w, b.h, b.d], i * 3);
    miSeed[i] = b.seed;
    miLift[i] = b.lift;
  });
  miGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(miScale, 3));
  miGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(miSeed, 1));
  miGeo.setAttribute('aLift', new THREE.InstancedBufferAttribute(miLift, 1));
  miMesh.frustumCulled = false;
  scene.add(miMesh);

  const col = new THREE.Color();

  // ---------- Suolo ----------
  const ringAUniform = { value: 0 };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 800),
    new THREE.ShaderMaterial({
      vertexShader: groundVert,
      fragmentShader: groundFrag,
      extensions: { derivatives: true },
      uniforms: {
        uRed: { value: RED },
        uFogColor: { value: FOG },
        uFogDensity: fogUniform,
        uAve: { value: AVE },
        uZ1: { value: CITY_Z1 },
        uRing: { value: RING_C },
        uRingA: ringAUniform,
      },
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -160;
  scene.add(ground);

  // ---------- Pacchetti di dati che scorrono nel viale ----------
  const PN = mobile ? 40 : 80;
  const packets = [];
  for (let i = 0; i < PN; i++) {
    packets.push({
      x: (rand() - 0.5) * (AVE * 1.5),
      y: 1.2 + Math.pow(rand(), 1.6) * 34,
      z: CITY_Z1 + rand() * (CITY_Z0 - CITY_Z1),
      v: 8 + rand() * 22,
      len: 1.5 + rand() * 4,
      b: 0.8 + rand() * 2.4,
    });
  }
  const packetMesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshBasicMaterial({ fog: true }), PN);
  packetMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  packets.forEach((p, i) => packetMesh.setColorAt(i, rand() < 0.2 ? col.setRGB(p.b * 0.6, p.b * 1.15, p.b * 1.3) : col.setRGB(p.b * 0.1, p.b * 0.42, p.b)));
  scene.add(packetMesh);

  // ---------- Particelle ----------
  const dot = glowTexture();
  const PC = mobile ? 1100 : 2400;
  const pPos = new Float32Array(PC * 3);
  for (let i = 0; i < PC; i++) {
    pPos[i * 3] = (rand() - 0.5) * 240;
    pPos[i * 3 + 1] = rand() * 75;
    pPos[i * 3 + 2] = 60 - rand() * 400;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const points = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.45, map: dot, color: new THREE.Color().setRGB(0.25, 0.65, 1.4),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
  }));
  scene.add(points);

  // ---------- Anello AI ----------
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(RING_R + 3.2, 0.06, 6, 160),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.3, 1.2, 2.4), transparent: true, opacity: 0, fog: true })
  );
  halo.position.copy(RING_C);
  scene.add(halo);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(RING_R, 0.16, 8, 200),
    new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.25, 0.9, 2.2), transparent: true, opacity: 0, fog: true })
  );
  innerRing.position.copy(RING_C);
  scene.add(innerRing);

  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dot, color: new THREE.Color().setRGB(0.08, 0.35, 1.0), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.15, fog: false,
  }));
  coreGlow.position.copy(RING_C);
  coreGlow.scale.setScalar(80);
  scene.add(coreGlow);

  const horizon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dot, color: new THREE.Color().setRGB(0.03, 0.15, 0.6), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, fog: false,
  }));
  horizon.position.set(0, 0, -420);
  horizon.scale.set(700, 220, 1);
  scene.add(horizon);

  // ---------- Post-produzione ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(viewW(), viewH()), 0.6, 0.5, 0.32);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Percorso della telecamera ----------
  let posCurve, lookCurve;
  let distFactor = 1;
  function buildCurves() {
    const aspect = viewW() / viewH();
    const portrait = aspect < 1;
    distFactor = portrait ? 1.25 : 1;
    camera.fov = portrait ? clamp((2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(24)) / aspect)) * 180 / Math.PI, 55, 84) : 55;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const ps = [], ls = [];
    KEYS.forEach((k) => {
      const p = new THREE.Vector3(...k.p);
      let l;
      if (k.l) l = new THREE.Vector3(...k.l);
      else {
        // l'anello sta sulla destra, il pannello delle competenze a sinistra
        const fwd = RING_C.clone().sub(p).normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
        l = RING_C.clone().addScaledVector(right, portrait ? 0 : -22);
      }
      p.sub(l).multiplyScalar(distFactor).add(l);
      ps.push(p); ls.push(l);
    });
    posCurve = new THREE.CatmullRomCurve3(ps, false, 'centripetal');
    lookCurve = new THREE.CatmullRomCurve3(ls, false, 'centripetal');
  }
  buildCurves();

  const N = KEYS.length - 1;
  let target = 0;
  let cur = 0;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;  // al tocco il dito scorre la pagina, non guida la telecamera
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

  function fogAt(u) {
    const i = Math.min(N - 1, Math.floor(u));
    const t = u - i;
    return KEYS[i].f + (KEYS[i + 1].f - KEYS[i].f) * t;
  }

  function updateRing(a, t) {
    innerRing.material.opacity = 0.35 + 0.55 * a;
    halo.material.opacity = 0.15 + 0.75 * a;
    halo.rotation.z = -t * 0.05;
    coreGlow.material.opacity = 0.06 + 0.1 * a;
    ringAUniform.value = a;
  }

  function updatePackets(t, dt) {
    for (let i = 0; i < PN; i++) {
      const p = packets[i];
      p.z -= p.v * dt;
      if (p.z < CITY_Z1 - 20) p.z = CITY_Z0 + 10;
      m4.compose(v3.set(p.x, p.y, p.z), q4.identity(), s3.set(0.16, 0.16, p.len));
      packetMesh.setMatrixAt(i, m4);
    }
    packetMesh.instanceMatrix.needsUpdate = true;
  }

  function place(u, t) {
    const k = clamp(u, 0, N) / N;
    posCurve.getPoint(k, camPos);
    lookCurve.getPoint(k, camLook);
    if (!reducedMotion) {
      pointer.sx += (pointer.x - pointer.sx) * 0.04;
      pointer.sy += (pointer.y - pointer.sy) * 0.04;
      camPos.x += pointer.sx * 1.4 + Math.sin(t * 0.25) * 0.5;
      camPos.y += -pointer.sy * 0.8 + Math.sin(t * 0.33) * 0.3;
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const f = fogAt(clamp(u, 0, N));
    fogUniform.value = f;
    scene.fog.density = f;
  }

  const clock = new THREE.Clock();
  let first = true;
  let elapsed = 0;

  // Qualità adattiva: se dopo l'avvio i fotogrammi sono lenti (telefoni economici,
  // risparmio energetico) si scende prima di risoluzione, poi si toglie il bagliore.
  let useBloom = true;
  let sampled = -30;  // i primi fotogrammi compilano gli shader: non contano
  let slowTime = 0;
  function adapt(dt) {
    if (sampled === null || document.hidden) return;
    if (++sampled <= 0) return;
    slowTime += dt;
    if (sampled < 60) return;
    const avg = slowTime / sampled;
    sampled = 0;
    slowTime = 0;
    if (avg < 1 / 45) { sampled = null; return; }  // fluido: si smette di misurare
    if (renderer.getPixelRatio() > 1) {
      renderer.setPixelRatio(1);
      composer.setPixelRatio(1);
    } else {
      useBloom = false;
      sampled = null;
    }
  }

  function render() {
    if (useBloom) composer.render();
    else renderer.render(scene, camera);
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    adapt(dt);
    elapsed += dt;
    cur += (target - cur) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(target - cur) < 0.0005) cur = target;
    timeUniform.value = elapsed;

    const a = smooth(2, 8, cur);  // l'anello si accende man mano che arrivano le competenze
    updateRing(a, elapsed);
    updatePackets(elapsed, dt);
    place(cur, elapsed);

    render();
    if (first) { first = false; onFirstFrame && onFirstFrame(); }
    requestAnimationFrame(frame);
  }

  function staticFrame() {
    // movimento ridotto: un'unica inquadratura ferma, anello già acceso
    updateRing(1, 0);
    updatePackets(0, 0);
    place(5, 0);
    render();
    if (first) { first = false; onFirstFrame && onFirstFrame(); }
  }

  let lastW = viewW(), lastH = viewH();
  function resize() {
    const w = viewW(), h = viewH();
    if (w === lastW && h === lastH) return;  // ricreare i buffer costa: solo se la tela cambia davvero
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    buildCurves();
    if (reducedMotion) staticFrame();
  }
  window.addEventListener('resize', resize);

  if (reducedMotion) staticFrame();
  else requestAnimationFrame(frame);

  const projC = new THREE.Vector3();
  const projE = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  function toScreen(v) {
    return { x: (v.x + 1) / 2 * viewW(), y: (1 - v.y) / 2 * viewH() };
  }

  return {
    // centro e raggio (px) dell'anello sullo schermo; null se è dietro la telecamera
    ringScreen() {
      projC.copy(RING_C).project(camera);
      if (projC.z > 1) return null;
      camRight.setFromMatrixColumn(camera.matrixWorld, 0);
      projE.copy(RING_C).addScaledVector(camRight, RING_R).project(camera);
      const c = toScreen(projC), e = toScreen(projE);
      return { cx: c.x, cy: c.y, r: Math.hypot(e.x - c.x, e.y - c.y) };
    },
    // punto dell'anello sullo schermo all'angolo a (0 in alto, senso orario); null se dietro
    ringAt(a) {
      projE.set(RING_C.x + Math.sin(a) * RING_R, RING_C.y + Math.cos(a) * RING_R, RING_C.z).project(camera);
      return projE.z > 1 ? null : toScreen(projE);
    },
    setTarget(u) { target = clamp(u, 0, N); },
    snap() { cur = target; },
  };
}
