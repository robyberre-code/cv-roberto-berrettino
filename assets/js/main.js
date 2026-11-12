// Interfaccia: avanzamento con lo scroll, indicatore laterale, competenze che si
// staccano dalle schede, effetto "decodifica" sui titoli. La scena 3D si carica a parte:
// se WebGL o la rete non sono disponibili, il sito resta leggibile.

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;

const sections = [...document.querySelectorAll('[data-key]')];

// Testi generati qui: seguono la lingua della pagina (<html lang>)
const TEXTS = {
  it: { goTo: 'Vai a', toCard: 'vai alla scheda', collected: 'raccolte', noScene: 'Scena 3D non disponibile:' },
  en: { goTo: 'Go to', toCard: 'go to the section', collected: 'collected', noScene: '3D scene not available:' },
};
const T = TEXTS[root.lang] || TEXTS.it;

const loader = document.getElementById('loader');
const loaderPct = document.getElementById('loaderPct');
const rail = document.getElementById('rail');

let scene = null;
let anchors = [];
let sceneReady = false;
let loaderDone = false;
let frameLoop = false;  // la scena gira: scroll e mirino si aggiornano nel suo ciclo

// ---------- Loader ----------
const loadStart = performance.now();
function tickLoader() {
  if (loaderDone) return;
  const pct = Math.min(100, Math.round(((performance.now() - loadStart) / 1100) * 100));
  loaderPct.textContent = sceneReady ? Math.max(pct, 100) : Math.min(pct, 96);
  if (sceneReady && pct >= 100) return finishLoader();
  requestAnimationFrame(tickLoader);
}
function finishLoader() {
  if (loaderDone) return;
  loaderDone = true;
  loaderPct.textContent = '100';
  loader.classList.add('is-done');
  const heroTitle = document.querySelector('.hero [data-scramble]');
  if (heroTitle) scramble(heroTitle);
}
requestAnimationFrame(tickLoader);
// non restare mai bloccati sul loader: sul telefono la rete è spesso lenta, si aspetta meno
setTimeout(() => { sceneReady = true; }, mobile ? 3000 : 5000);

// ---------- Scena ----------
(async () => {
  try {
    const { createScene } = await import('./scene.js');
    scene = createScene(document.getElementById('scene'), {
      mobile,
      reducedMotion: reduced,
      onFirstFrame: () => { sceneReady = true; },
      // un solo ciclo: mirino e chip si disegnano con la telecamera dello stesso fotogramma
      onFrame: (now) => { frameLoop = true; update(); orbitFrame(now); },
    });
    update();
    scene.snap();
  } catch (err) {
    console.warn(T.noScene, err);
    root.classList.add('no-webgl');
    sceneReady = true;
  }
})();

// ---------- Posizioni di riferimento delle sezioni ----------
function measure() {
  const vh = window.innerHeight;
  const max = document.documentElement.scrollHeight - vh;
  anchors = sections.map((s, i) => {
    if (i === 0) return 0;
    const top = s.getBoundingClientRect().top + window.scrollY;
    return clamp(top + (s.offsetHeight - vh) / 2, 0, max);
  });
  for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function progress() {
  const y = window.scrollY;
  let i = 0;
  while (i < anchors.length - 2 && y >= anchors[i + 1]) i++;
  const raw = clamp((y - anchors[i]) / (anchors[i + 1] - anchors[i]), 0, 1);
  return { i, raw, u: i + raw * raw * (3 - 2 * raw) };
}

// ---------- Indicatore laterale ----------
const railButtons = sections.map((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', `${T.goTo}: ${s.dataset.label}`);
  b.innerHTML = `<span>${s.dataset.label}</span>`;
  b.addEventListener('click', () => goTo(i));
  rail.appendChild(b);
  return b;
});

function goTo(i) {
  window.scrollTo({ top: anchors[i], behavior: reduced ? 'auto' : 'smooth' });
}

// ---------- Barra in alto: voce della sezione corrente ----------
// Sugli schermi stretti è l'unico indicatore (quello laterale è nascosto) e scorre col dito.
const topnav = document.querySelector('.topnav');
const navPills = [...topnav.querySelectorAll('a')].map((a) => ({
  a,
  at: sections.findIndex((s) => s.id === a.getAttribute('href').slice(1)),
}));

function markNav(active) {
  let cur = null;
  navPills.forEach((p) => { if (p.at > 0 && p.at <= active) cur = p; });
  navPills.forEach((p) => {
    p.a.classList.toggle('is-current', p === cur);
    if (p === cur) p.a.setAttribute('aria-current', 'location');
    else p.a.removeAttribute('aria-current');
  });
  if (topnav.scrollWidth > topnav.clientWidth + 1) {
    const left = cur ? cur.a.offsetLeft - (topnav.clientWidth - cur.a.offsetWidth) / 2 : 0;
    topnav.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
  }
}

// ---------- Chip raccolti ----------
// Ogni scheda porta un chip (data-carry): nelle aziende la competenza acquisita in quel
// ruolo, nelle altre schede il nome della sezione. Superata
// la scheda, il chip si stacca e vola (a tempo, non a scroll: si vede tutto anche scorrendo
// veloce) su un arco fino al suo posto sulla linea dell'anello 3D, lasciando una scia.
// Un mirino disegnato segue l'anello anche quando è lontano o coperto dagli edifici: i posti
// liberi sono tacche, quelli raccolti punti luminosi. Alla fine i punti diventano un cerchio
// di link che riportano alle schede.
// Con movimento ridotto o senza WebGL resta un elenco nei contatti.
const orbit = document.getElementById('orbit');
const skillList = document.getElementById('skillList');
const linkedin = document.getElementById('linkedinLink');
const contactInner = linkedin.parentElement;
const narrow = window.matchMedia('(max-width: 720px)');
let linkShift = [0, 0];  // spostamento applicato al link per centrarlo nell'anello

// tela per mirino, scie, scintille e onde d'urto
const fx = document.createElement('canvas');
fx.className = 'orbit__fx';
fx.setAttribute('aria-hidden', 'true');
orbit.appendChild(fx);
const g = fx.getContext('2d');
// Misure della tela (alta quanto il viewport grande, come la scena): si rialloca solo se
// cambiano davvero, non quando compare o sparisce la barra degli indirizzi del telefono
let fxW = 0, fxH = 0;
function sizeFx() {
  const w = fx.clientWidth, h = fx.clientHeight;
  if (!w || !h || (w === fxW && h === fxH)) return;
  fxW = w; fxH = h;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  fx.width = Math.round(w * dpr);
  fx.height = Math.round(h * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeFx();
window.addEventListener('resize', sizeFx);

const carried = [...document.querySelectorAll('[data-carry]')].map((src, k, all) => {
  const sec = src.closest('[data-key]');
  const make = (cls) => {
    const a = document.createElement('a');
    a.className = cls;
    a.href = `#${sec.id}`;
    a.textContent = src.textContent;
    const text = src.textContent, where = sec.dataset.label;
    if (text === where) a.setAttribute('aria-label', `${T.goTo}: ${text}`);
    else { a.title = `${text} · ${where}`; a.setAttribute('aria-label', `${text}: ${T.toCard} ${where}`); }
    return a;
  };
  const angle = Math.PI + (k * 2 * Math.PI) / all.length;  // il primo in basso, poi in senso orario
  const chip = make('orbit__chip');
  chip.dataset.text = src.textContent;  // per l'effetto glitch
  orbit.appendChild(chip);
  skillList.appendChild(make('chip'));
  // state: 0 nella scheda, 1 in volo, 2 arrivata
  return { src, chip, k, key: +sec.dataset.key, angle, state: 0, t0: 0, sx: 0, sy: 0 };
});

const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const FLIGHT = 1400;       // ms
const TAKE = 0.3;          // la scheda parte quando u supera key + TAKE
const GIVE_BACK = 0.12;    // tornando indietro, sotto key + GIVE_BACK il chip rientra
const sparks = [];
const waves = [];
const cards = [...document.querySelectorAll('.panel, .sheet')];
let hudDim = 1;
let last = performance.now();

// arco: punto di controllo sollevato a metà strada
function arcPoint(c, ex, ey, p) {
  const mx = (c.sx + ex) / 2, my = (c.sy + ey) / 2;
  const lift = Math.min(240, Math.hypot(ex - c.sx, ey - c.sy) * 0.45);
  const cx = mx + (c.sx < ex ? lift * 0.35 : -lift * 0.35), cy = my - lift;
  const q = 1 - p;
  return [q * q * c.sx + 2 * q * p * cx + p * p * ex, q * q * c.sy + 2 * q * p * cy + p * p * ey];
}

// Mirino: l'anello com'è sullo schermo, ingrandito se è troppo piccolo per distinguere
// i posti e tenuto dentro lo schermo
function makeHud(ring, W, H) {
  const min = narrow.matches ? 40 : 58;
  const k = Math.max(1, min / Math.max(ring.r, 1));
  const R = ring.r * k;
  const cx = clamp(ring.cx, R + 16, W - R - 16);
  const cy = clamp(ring.cy, R + 84, H - R - 40);
  return {
    cx, cy, R,
    at(a) {
      const p = scene.ringAt(a);
      if (!p) return [cx + Math.sin(a) * R, cy - Math.cos(a) * R];
      return [cx + (p.x - ring.cx) * k, cy + (p.y - ring.cy) * k];
    },
  };
}

function drawHud(hud, alpha, count, now) {
  if (alpha <= 0.01) return;
  g.save();
  g.globalAlpha = alpha;
  const fill = count / carried.length;
  // linea dell'anello: si accende man mano che arrivano i chip
  g.beginPath();
  for (let i = 0; i <= 48; i++) {
    const [x, y] = hud.at((i / 48) * Math.PI * 2);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath();
  // alone: due tratti larghi e trasparenti sotto la linea (costa molto meno di una sfocatura)
  g.lineJoin = 'round';
  g.strokeStyle = `rgba(108, 194, 255, ${0.06 + 0.08 * fill})`;
  g.lineWidth = 9 + 6 * fill;
  g.stroke();
  g.strokeStyle = `rgba(108, 194, 255, ${0.1 + 0.12 * fill})`;
  g.lineWidth = 4.5 + 2 * fill;
  g.stroke();
  g.strokeStyle = `rgba(108, 194, 255, ${0.35 + 0.55 * fill})`;
  g.lineWidth = 1.5;
  g.stroke();
  // tacche esterne che ruotano
  g.setLineDash([2, 9]);
  g.lineDashOffset = -now / 60;
  g.strokeStyle = 'rgba(108, 194, 255, 0.4)';
  g.lineWidth = 1;
  g.beginPath(); g.arc(hud.cx, hud.cy, hud.R + 12, 0, Math.PI * 2); g.stroke();
  g.setLineDash([3, 3]);
  // posti ancora liberi
  g.strokeStyle = 'rgba(147, 167, 196, 0.85)';
  carried.forEach((c) => {
    if (c.state === 2) return;
    const [x, y] = hud.at(c.angle);
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.stroke();
  });
  g.setLineDash([]);
  // contatore sotto l'anello, su fondo scuro: spesso passa sopra il testo delle schede
  const label = `${count}/${carried.length} ${T.collected}`;
  g.font = '500 12px "IBM Plex Mono", ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lw = g.measureText(label).width + 16, ly = hud.cy + hud.R + 30;
  g.fillStyle = 'rgba(3, 8, 20, 0.92)';
  g.strokeStyle = 'rgba(108, 194, 255, 0.5)';
  g.beginPath();
  if (g.roundRect) g.roundRect(hud.cx - lw / 2, ly - 11, lw, 22, 11);
  else g.rect(hud.cx - lw / 2, ly - 11, lw, 22);
  g.fill(); g.stroke();
  g.fillStyle = 'rgba(242, 247, 255, 0.95)';
  g.fillText(label, hud.cx, ly + 1);
  g.restore();
}

function orbitFrame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const on = !!scene && !reduced && anchors.length > 1;
  root.classList.toggle('has-orbit', on);
  if (!on) return;
  if (!fxW) sizeFx();  // la tela si misura solo da visibile
  const W = window.innerWidth, H = window.innerHeight;
  g.clearRect(0, 0, fxW, fxH);

  const ring = scene.ringScreen();
  const { u } = progress();
  const lastKey = anchors.length - 1;
  const grow = ease((u - (lastKey - 0.6)) / 0.55);  // punti sull'anello → etichette del cerchio finale
  const far = grow < 0.5;
  const hud = ring && makeHud(ring, W, H);

  // cerchio finale attorno all'anello; sugli schermi bassi (telefono in orizzontale) è più
  // largo e schiacciato quanto serve per stare tra la barra in alto e il fondo
  let final = null;
  if (ring && grow > 0 && !narrow.matches) {
    final = { cx: ring.cx, cy: ring.cy, rx: Math.min(ring.r * 1.45, W / 2 - 120), ry: ring.r * 1.05 };
    if (H < 561) {
      const top = 76, bottom = H - 14;
      final.cy = clamp(ring.cy, top + 66, bottom - 66);
      final.rx = W / 2 - 130;
      final.ry = Math.min(final.ry, final.cy - top - 16, bottom - final.cy - 16);
    }
  }

  // a fine percorso il link LinkedIn si aggancia al centro del cerchio e lo segue
  // (la telecamera ondeggia col mouse); sul telefono in verticale resta sotto il cerchio
  let shift = [0, 0];
  if (final) {
    const b = linkedin.getBoundingClientRect();
    const bx = b.left + b.width / 2 - linkShift[0], by = b.top + b.height / 2 - linkShift[1];
    shift = [Math.round((final.cx - bx) * grow), Math.round((final.cy - by) * grow)];
  }
  if (shift[0] !== linkShift[0] || shift[1] !== linkShift[1]) {
    contactInner.style.transform = shift[0] || shift[1] ? `translate(${shift[0]}px, ${shift[1]}px)` : '';
    linkShift = shift;
  }

  // telefono in verticale: ai lati del link non c'è posto, il cerchio finale sta sopra il link
  let wreath = null;
  if (ring && grow > 0 && narrow.matches) {
    const top = 92, bottom = linkedin.getBoundingClientRect().top - 16;
    const ry = Math.max(40, Math.min(ring.r * 1.35, (bottom - top) / 2 - 18));
    wreath = { ry, cy: clamp(ring.cy, top + 18 + ry, bottom - 18 - ry) };
  }

  // sopra una scheda il mirino si attenua, per non coprire il testo; torna pieno sulla città
  let covered = false;
  if (hud && far) {
    const pad = hud.R * 0.6;
    covered = cards.some((el) => {
      const b = el.getBoundingClientRect();
      return hud.cx > b.left - pad && hud.cx < b.right + pad && hud.cy > b.top - pad && hud.cy < b.bottom + pad;
    });
  }
  hudDim += ((covered ? 0.25 : 1) - hudDim) * Math.min(1, dt * 6);
  orbit.classList.toggle('is-dim', covered);

  let stagger = 0;
  let count = 0;
  carried.forEach((c) => {
    // partenza e rientro
    if (c.state === 0 && u >= c.key + TAKE) {
      const b = c.src.getBoundingClientRect();
      c.sx = b.left + b.width / 2;
      c.sy = clamp(b.top + b.height / 2, -30, H + 30);  // scheda fuori schermo: entra dal bordo
      c.t0 = now + stagger;
      stagger += 160;
      c.state = 1;
    } else if (c.state !== 0 && u < c.key + GIVE_BACK) {
      c.state = 0;
    }
    c.src.classList.toggle('is-taken', c.state !== 0);
    c.chip.classList.toggle('is-on', c.state !== 0 && now >= c.t0);
    if (c.state === 0 || now < c.t0 || !ring) {
      if (!ring) c.chip.classList.remove('is-on');
      return;
    }

    // destinazione: il suo posto sulla linea dell'anello; alla fine l'etichetta nel cerchio grande
    let [ex, ey] = hud.at(c.angle);
    let ax = -50;  // ancoraggio orizzontale del chip, in % della sua larghezza
    if (grow > 0) {
      let fx2, fy2;
      if (wreath) {
        // un chip per riga, nell'ordine del sito dall'alto in basso, alternando i lati sul
        // profilo del cerchio; il chip si appoggia verso l'esterno e resta nello schermo
        const t = -1 + (2 * c.k) / (carried.length - 1);
        const s = Math.sqrt(Math.max(0, 1 - t * t)) * (c.k % 2 ? -1 : 1);
        fx2 = W / 2 + s * (W / 2 - 16);
        fy2 = wreath.cy + t * wreath.ry;
        ax -= 50 * s * grow;
      } else {
        fx2 = final.cx + Math.sin(c.angle) * final.rx;
        fy2 = final.cy - Math.cos(c.angle) * final.ry;
      }
      ex += (fx2 - ex) * grow;
      ey += (fy2 - ey) * grow;
    }

    let x = ex, y = ey, scale = 1;
    if (c.state === 1) {
      const p = clamp((now - c.t0) / FLIGHT, 0, 1);
      const e = easeInOut(p);
      [x, y] = arcPoint(c, ex, ey, e);
      scale = 1 + 0.3 * Math.sin(Math.PI * e) - (far ? 0.35 * e : 0);

      // linea di collegamento verso il posto, tratteggiata e in movimento
      g.save();
      g.setLineDash([4, 7]);
      g.lineDashOffset = -now / 30;
      g.strokeStyle = 'rgba(108, 194, 255, 0.35)';
      g.lineWidth = 1;
      g.beginPath();
      for (let s = e; s <= 1.0001; s += 0.04) {
        const [px, py] = arcPoint(c, ex, ey, Math.min(s, 1));
        s === e ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.stroke();
      g.restore();

      // scia luminosa dietro il chip: alone a tratto largo e trasparente, poi il nucleo
      const tail = Math.max(0, e - 0.28);
      g.save();
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const steps = 14;
      for (const [from, width, alpha] of [[0, 14, 0.07], [0.35, 20, 0.09]]) {
        g.beginPath();
        for (let i = Math.round(steps * from); i <= steps; i++) {
          const [hx, hy] = arcPoint(c, ex, ey, tail + ((e - tail) * i) / steps);
          i === Math.round(steps * from) ? g.moveTo(hx, hy) : g.lineTo(hx, hy);
        }
        g.strokeStyle = `rgba(108, 194, 255, ${alpha})`;
        g.lineWidth = width;
        g.stroke();
      }
      for (let i = 0; i < steps; i++) {
        const a0 = tail + ((e - tail) * i) / steps, a1 = tail + ((e - tail) * (i + 1)) / steps;
        const [x0, y0] = arcPoint(c, ex, ey, a0);
        const [x1, y1] = arcPoint(c, ex, ey, a1);
        const k = (i + 1) / steps;
        g.strokeStyle = `rgba(150, 215, 255, ${0.9 * k})`;
        g.lineWidth = 1 + 5 * k;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      }
      g.restore();

      // scintille
      if (Math.random() < 0.9) {
        sparks.push({ x, y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90 + 20, life: 0.7, max: 0.7 });
      }

      if (p >= 1) {
        c.state = 2;
        waves.push({ x: ex, y: ey, t: 0 });
      }
    }
    if (c.state === 2) count++;
    c.chip.classList.toggle('is-flying', c.state === 1);
    c.chip.classList.toggle('is-far', c.state === 2 && far);
    c.chip.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${ax.toFixed(1)}%, -50%) scale(${scale.toFixed(3)})`;
  });

  // mirino: compare lasciata l'intro, sparisce quando si forma il cerchio finale
  if (hud) drawHud(hud, ease((u - 0.4) / 0.5) * (1 - grow) * hudDim, count, now);

  // scintille e onde d'urto
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    s.x += s.vx * dt; s.y += s.vy * dt;
    const a = s.life / s.max;
    g.fillStyle = `rgba(160, 220, 255, ${a})`;
    g.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i];
    w.t += dt;
    if (w.t > 0.8) { waves.splice(i, 1); continue; }
    const k = w.t / 0.8;
    g.strokeStyle = `rgba(108, 194, 255, ${1 - k})`;
    g.lineWidth = 2 * (1 - k) + 0.5;
    g.beginPath(); g.arc(w.x, w.y, 6 + 44 * ease(k), 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    const i = sections.findIndex((s) => s.id === id);
    if (i < 0) return;
    e.preventDefault();
    goTo(i);
  });
});

// ---------- Aggiornamento con lo scroll ----------
let lastActive = -1;
function update() {
  if (!anchors.length) measure();
  const { u } = progress();
  if (scene) scene.setTarget(u);

  const active = Math.round(u);
  if (active !== lastActive) {
    railButtons.forEach((b, k) => {
      b.classList.toggle('is-active', k === active);
      if (k === active) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    markNav(active);
    lastActive = active;
  }
}

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking || frameLoop) return;  // con la scena attiva ci pensa il suo ciclo
  ticking = true;
  requestAnimationFrame(() => { ticking = false; update(); });
}, { passive: true });

window.addEventListener('resize', () => { measure(); update(); });
window.addEventListener('load', () => { measure(); update(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); update(); });
measure();
update();

// ---------- Titoli che si "decodificano" ----------
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#<>_';
function scramble(el) {
  if (reduced || el.dataset.done) return;
  el.dataset.done = '1';
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push({ node: walker.currentNode, text: walker.currentNode.nodeValue });
  const total = nodes.reduce((n, x) => n + x.text.length, 0);
  const start = performance.now();
  const dur = 700 + total * 18;
  function step(now) {
    const p = clamp((now - start) / dur, 0, 1);
    let offset = 0;
    nodes.forEach(({ node, text }) => {
      let out = '';
      for (let k = 0; k < text.length; k++) {
        const ch = text[k];
        const at = (offset + k) / total;
        out += ch === ' ' || p >= at * 0.75 + 0.25 ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      node.nodeValue = out;
      offset += text.length;
    });
    if (p < 1) requestAnimationFrame(step);
    else nodes.forEach(({ node, text }) => { node.nodeValue = text; });
  }
  requestAnimationFrame(step);
}

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting || e.target.closest('.hero')) return;
    scramble(e.target);
    io.unobserve(e.target);
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-scramble]').forEach((el) => io.observe(el));

