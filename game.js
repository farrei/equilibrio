(() => {
'use strict';
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, R = 0, ZR = 0, CR = 0, DR = 0;
const BEST_KEY = 'equilibrio.best.v1', PASS_KEY = 'equilibrio.bestPass.v1', MUTE_KEY = 'equilibrio.mute';
const PASS_EVERY = 12, GRACE = 3;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  R = Math.min(W, H) * 0.44;       // bandeja
  ZR = R * 0.34;                   // zona alvo
  CR = ZR * 0.33;                  // centro (bônus)
  DR = Math.max(14, R * 0.085);    // raio da gota
}
addEventListener('resize', resize); resize();

// ---------- áudio ----------
let ac = null, muted = localStorage.getItem(MUTE_KEY) === '1';
const muteBtn = $('mute');
const paintMute = () => muteBtn.textContent = muted ? '🔇' : '🔊';
paintMute();
muteBtn.addEventListener('click', e => { e.stopPropagation(); muted = !muted; localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); paintMute(); });
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
  if (ac && ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, d, type = 'sine', v = .15, slide = 0) {
  if (muted || !audio()) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
}
function noise(d, v = .12, freq = 700) {
  if (muted || !audio()) return;
  const t = ac.currentTime, n = Math.floor(ac.sampleRate * d), b = ac.createBuffer(1, n, ac.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * .3); g.gain.linearRampToValueAtTime(0, t + d);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const sfx = {
  start: () => { tone(520, .12, 'sine', .12); setTimeout(() => tone(780, .18, 'sine', .12), 90); },
  wind: () => noise(.9, .1, 500 + Math.random() * 400),
  center: () => tone(1180, .09, 'triangle', .05),
  pass: () => { tone(660, .1, 'square', .06); setTimeout(() => tone(880, .14, 'square', .06), 110); },
  splash: () => { noise(.35, .2, 1400); tone(420, .5, 'sine', .14, .25); },
};
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };

// ---------- entrada ----------
const tilt = { x: 0, y: 0, has: false };
const keys = {};
let drag = null;
function onOrient(e) {
  if (e.gamma == null) return;
  tilt.has = true;
  let gx = e.gamma, gy = e.beta;           // retrato
  const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  if (ang === 90) { gx = e.beta; gy = -e.gamma; } else if (ang === -90 || ang === 270) { gx = -e.beta; gy = e.gamma; }
  tilt.x = Math.max(-35, Math.min(35, gx)) / 35;
  tilt.y = Math.max(-35, Math.min(35, gy - 20)) / 35;  // ~20° de inclinação natural da mão
}
async function enableSensors() {
  try {
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission();
      if (r !== 'granted') return;
    }
    addEventListener('deviceorientation', onOrient);
  } catch (_) {}
}
addEventListener('keydown', e => { keys[e.key] = true; if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault(); });
addEventListener('keyup', e => { keys[e.key] = false; });
cv.addEventListener('pointerdown', e => { drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; });
addEventListener('pointermove', e => { if (drag) { drag.x = e.clientX; drag.y = e.clientY; } });
addEventListener('pointerup', () => drag = null); addEventListener('pointercancel', () => drag = null);
['gesturestart', 'dblclick', 'contextmenu'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
try { screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => {}); } catch (_) {}

function inputVec() {
  let x = 0, y = 0;
  if (keys.ArrowLeft || keys.a) x -= 1; if (keys.ArrowRight || keys.d) x += 1;
  if (keys.ArrowUp || keys.w) y -= 1; if (keys.ArrowDown || keys.s) y += 1;
  if (drag) { x += (drag.x - drag.x0) / 90; y += (drag.y - drag.y0) / 90; }
  if (tilt.has) { x += tilt.x; y += tilt.y; }
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  return { x, y };
}

// ---------- estado ----------
const S = {
  phase: 'menu', mode: 'solo', t: 0, score: 0, best: +localStorage.getItem(BEST_KEY) || 0,
  bestPass: +localStorage.getItem(PASS_KEY) || 0,
  p: { x: 0, y: 0, vx: 0, vy: 0 }, wob: 0, inZone: false, center: false,
  gust: null, nextGust: 3, shake: 0, shakeT: 0, nextShake: 9,
  passes: 0, nextPass: PASS_EVERY, grace: 0, ripples: [], streaks: [], drops: [], fallT: 0,
};
window.__eq = S; // para testes

function reset() {
  Object.assign(S, { t: 0, score: 0, p: { x: 0, y: 0, vx: 0, vy: 0 }, wob: 0, gust: null, nextGust: 2.5, shake: 0, shakeT: 0, nextShake: 9,
    passes: 0, nextPass: PASS_EVERY, grace: 0, ripples: [], streaks: [], drops: [], fallT: 0, centerT: 0 });
}
function show(id, on) { $(id).classList.toggle('hidden', !on); }
function startGame() {
  audio(); reset(); S.phase = 'play';
  show('menu', false); show('over', false); show('hud', true); show('pass', false);
  $('hudRLbl').textContent = S.mode === 'pass' ? 'Passes' : 'Recorde';
  sfx.start(); buzz(30);
}
function gameOver() {
  S.phase = 'fall'; S.fallT = 0; sfx.splash(); buzz([60, 40, 120]);
  const a = Math.atan2(S.p.y, S.p.x);
  for (let i = 0; i < 22; i++) {
    const s = 80 + Math.random() * 260, aa = a + (Math.random() - .5) * 2.2;
    S.drops.push({ x: S.p.x, y: S.p.y, vx: Math.cos(aa) * s, vy: Math.sin(aa) * s, r: 2 + Math.random() * DR * .35, life: 1 });
  }
}
function finish() {
  S.phase = 'over'; show('hud', false); show('pass', false);
  const sc = Math.floor(S.score);
  let nb = false;
  if (S.mode === 'solo' && sc > S.best) { S.best = sc; localStorage.setItem(BEST_KEY, sc); nb = true; }
  if (S.mode === 'pass' && S.passes > S.bestPass) { S.bestPass = S.passes; localStorage.setItem(PASS_KEY, S.passes); nb = true; }
  $('finalScore').textContent = S.mode === 'pass' ? S.passes : sc;
  $('finalInfo').textContent = S.mode === 'pass'
    ? `${S.passes === 1 ? '1 passe' : S.passes + ' passes'} • ${sc} pontos • recorde: ${S.bestPass} passes`
    : `${S.t.toFixed(1)} s equilibrando • recorde: ${S.best}`;
  show('newBest', nb); show('over', true);
}

// ---------- loop ----------
function diff() { return Math.min(1, S.t / 90); }
function update(dt) {
  if (S.phase === 'fall') {
    S.fallT += dt;
    for (const d of S.drops) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= .94; d.vy *= .94; d.life -= dt * 1.1; }
    if (S.fallT > 1.1) finish();
    return;
  }
  if (S.phase !== 'play') { S.t += dt; return; }
  S.t += dt;
  const D = diff(), p = S.p, inp = inputVec();
  const graceOn = S.grace > 0;
  const acc = R * 2.6;
  let ax = inp.x * acc, ay = inp.y * acc;

  // vento
  S.nextGust -= dt;
  if (!S.gust && S.nextGust <= 0 && !graceOn) {
    const ang = Math.random() * Math.PI * 2;
    S.gust = { ang, t: 0, dur: 1.1 + Math.random() * (0.8 + D), str: R * (0.9 + D * 1.9) };
    S.nextGust = 4.2 - D * 2.6 + Math.random() * 2;
    sfx.wind(); buzz([25, 30, 25]);
  }
  if (S.gust) {
    const g = S.gust; g.t += dt;
    const k = Math.sin(Math.min(1, g.t / g.dur) * Math.PI);
    ax += Math.cos(g.ang) * g.str * k; ay += Math.sin(g.ang) * g.str * k;
    if (Math.random() < 0.6) S.streaks.push(mkStreak(g.ang));
    if (g.t >= g.dur) S.gust = null;
  }
  // tremor
  S.nextShake -= dt;
  if (S.nextShake <= 0 && D > 0.08 && !graceOn) { S.shakeT = 0.45 + D * 0.4; S.shake = 4 + D * 9; S.nextShake = 7 - D * 4 + Math.random() * 3; buzz(90); noise(.3, .08, 180); }
  if (S.shakeT > 0) { S.shakeT -= dt; ax += (Math.random() - .5) * R * 7 * D; ay += (Math.random() - .5) * R * 7 * D; }

  // física: inércia + atrito
  const fr = graceOn ? 4.5 : 1.6;
  p.vx += ax * dt; p.vy += ay * dt;
  p.vx *= Math.exp(-fr * dt); p.vy *= Math.exp(-fr * dt);
  p.x += p.vx * dt; p.y += p.vy * dt;
  S.wob += (Math.hypot(p.vx, p.vy) / R - S.wob) * Math.min(1, dt * 6);

  const dist = Math.hypot(p.x, p.y);
  // Passa a Bandeja
  if (S.mode === 'pass') {
    if (graceOn) {
      S.grace -= dt;
      $('passN').textContent = Math.max(1, Math.ceil(S.grace));
      if (dist > R - DR) { const k = (R - DR) / dist; p.x *= k; p.y *= k; p.vx *= -.3; p.vy *= -.3; }
      if (S.grace <= 0) { show('pass', false); S.nextPass = PASS_EVERY; }
    } else {
      S.nextPass -= dt;
      if (S.nextPass <= 0) { S.passes++; S.grace = GRACE; show('pass', true); sfx.pass(); buzz([40, 60, 40]); }
    }
  }
  if (!graceOn && dist > R) { gameOver(); return; }

  S.inZone = dist < ZR; const wasC = S.center; S.center = dist < CR;
  if (S.center && !wasC) sfx.center();
  if (S.inZone && !graceOn) S.score += dt * (S.center ? 2 : 1);
  if (S.inZone && Math.random() < dt * 1.6) S.ripples.push({ x: p.x, y: p.y, r: DR, a: .35 });
}
function mkStreak(ang) {
  const L = Math.max(W, H);
  const px = -Math.sin(ang), py = Math.cos(ang), off = (Math.random() - .5) * L * 1.2;
  return { x: -Math.cos(ang) * L * .7 + px * off, y: -Math.sin(ang) * L * .7 + py * off, ang, len: 40 + Math.random() * 90, sp: 900 + Math.random() * 700, life: 1 };
}

function draw(dt) {
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 + H * 0.02;
  let sx = 0, sy = 0;
  if (S.shakeT > 0) { sx = (Math.random() - .5) * S.shake; sy = (Math.random() - .5) * S.shake; }
  ctx.save(); ctx.translate(cx + sx, cy + sy);

  // bandeja
  const tg = ctx.createRadialGradient(0, 0, R * .2, 0, 0, R);
  tg.addColorStop(0, 'rgba(120,190,255,.10)'); tg.addColorStop(1, 'rgba(120,190,255,.02)');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(180,220,255,.18)'; ctx.stroke();
  // borda de perigo
  const dd = Math.hypot(S.p.x, S.p.y) / R;
  if (S.phase === 'play' && dd > .7) { ctx.strokeStyle = `rgba(255,110,120,${(dd - .7) * 2})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke(); }
  // zona
  ctx.beginPath(); ctx.arc(0, 0, ZR, 0, Math.PI * 2);
  ctx.fillStyle = S.inZone && S.phase === 'play' ? 'rgba(110,220,255,.12)' : 'rgba(255,255,255,.04)'; ctx.fill();
  ctx.setLineDash([6, 8]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(190,230,255,.45)'; ctx.stroke(); ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(0, 0, CR, 0, Math.PI * 2);
  ctx.strokeStyle = S.center && S.phase === 'play' ? 'rgba(255,215,106,.9)' : 'rgba(255,215,106,.3)'; ctx.stroke();

  // ondulações
  for (const r of S.ripples) { r.r += dt * 60; r.a -= dt * .45; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.strokeStyle = `rgba(170,225,255,${Math.max(0, r.a)})`; ctx.lineWidth = 1.2; ctx.stroke(); }
  S.ripples = S.ripples.filter(r => r.a > 0);

  // gota
  if (S.phase !== 'fall') drawDrop(S.p.x, S.p.y, DR, S.phase === 'menu' ? Math.sin(S.t * 2) * .06 : S.wob, Math.atan2(S.p.vy, S.p.vx));
  else {
    const k = Math.max(0, 1 - S.fallT * 1.6);
    if (k > 0) drawDrop(S.p.x, S.p.y, DR * (1 + (1 - k) * .8), .6 * k, S.fallT * 20, k);
    for (const d of S.drops) if (d.life > 0) { ctx.globalAlpha = d.life; ctx.fillStyle = '#8fd8ff'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // vento
  ctx.lineCap = 'round';
  for (const s of S.streaks) {
    s.x += Math.cos(s.ang) * s.sp * dt; s.y += Math.sin(s.ang) * s.sp * dt; s.life -= dt * .9;
    ctx.strokeStyle = `rgba(210,235,255,${Math.max(0, s.life) * .35})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx + s.x, cy + s.y); ctx.lineTo(cx + s.x - Math.cos(s.ang) * s.len, cy + s.y - Math.sin(s.ang) * s.len); ctx.stroke();
  }
  S.streaks = S.streaks.filter(s => s.life > 0);
}
function drawDrop(x, y, r, wob, ang, alpha = 1) {
  const st = 1 + Math.min(.22, wob * .6);
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y);
  // sombra
  ctx.fillStyle = 'rgba(0,10,40,.35)'; ctx.beginPath(); ctx.ellipse(r * .25, r * .4, r * st, r / st, ang, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(ang); ctx.scale(st, 1 / st);
  const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .05, 0, 0, r * 1.05);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.18, '#c4f0ff'); g.addColorStop(.55, '#4fb4ff'); g.addColorStop(1, '#1550c4');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-r * .35, -r * .42, r * .22, r * .12, -.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function hud() {
  $('score').textContent = Math.floor(S.score);
  $('hudR').textContent = S.mode === 'pass' ? S.passes : Math.max(S.best, Math.floor(S.score));
  const m = $('mult'); m.textContent = S.center ? '×2 centro' : '×1'; m.classList.toggle('on', S.center && S.phase === 'play');
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  update(dt); draw(dt); if (S.phase === 'play') hud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- UI ----------
document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.mode').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); S.mode = b.dataset.mode; tone(700, .06, 'triangle', .05);
}));
function paintBest() { $('bestMenu').textContent = S.best + (S.bestPass ? ` • ${S.bestPass} passes` : ''); }
paintBest();
$('hint').textContent = ('ontouchstart' in window) ? 'Segure o celular como uma bandeja e incline. Sem sensor? Arraste o dedo na tela.' : 'No computador: use as setas (ou arraste com o mouse).';
$('start').addEventListener('click', async () => { await enableSensors(); startGame(); });
$('again').addEventListener('click', startGame);
$('toMenu').addEventListener('click', () => { S.phase = 'menu'; reset(); paintBest(); show('over', false); show('menu', true); });
addEventListener('keydown', e => { if (e.key === 'Enter' && S.phase !== 'play' && S.phase !== 'fall') startGame(); });

if ('serviceWorker' in navigator && location.protocol !== 'file:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
