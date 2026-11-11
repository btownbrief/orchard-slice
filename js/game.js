'use strict';
/* Orchard Slice: a fruit-slicing arcade game. Engine, input, rules, rendering, UI glue and test hooks. */
(() => {
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ save */
const SAVE_KEY = 'orchardSlice.v1';
let save = { best: { classic: 0, timed: 0, zen: 0 }, sfx: true, music: true, tut: 0, plays: 0, lastMode: 'classic', goals: [], ribbons: 0, blade: 'sun', daily: { date: '', best: 0, streak: 0, last: '', runs: 0 }, seenGold: 0 };
try {
  const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (s) { save = Object.assign(save, s); save.best = Object.assign({ classic: 0, timed: 0, zen: 0 }, s.best || {}); save.daily = Object.assign({ date: '', best: 0, streak: 0, last: '', runs: 0 }, s.daily || {}); }
} catch (e) {}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
AUD.setSfx(save.sfx); AUD.setMusic(save.music);

/* ------------------------------------------------------------------ rng (seedable for tests) */
let seedState = (Math.random() * 4294967296) >>> 0;
function rnd() { seedState = (seedState + 0x6D2B79F5) >>> 0; let t = seedState; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rr = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[(rnd() * a.length) | 0];
// Spawns use their own generators so a seeded run (the Daily Harvest) throws the same orchard no matter how you slice:
// SR = the main volleys, FR = frenzy fruit (only exists if you sliced the donut, so it must not shift SR).
function mkRng(seed) { let st = seed >>> 0; const f = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; f.seed = (v) => { st = v >>> 0; }; return f; }
const SR = mkRng(1), FR = mkRng(2);
const srr = (R, a, b) => a + (b - a) * R(), spick = (R, a) => a[(R() * a.length) | 0];
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const timedLike = (m) => m === 'timed' || m === 'daily';

/* ------------------------------------------------------------------ item definitions */
const DEF = {
  apple_red:   { kind: 'fruit', r: 30, pts: 1, juice: '#ff4d4d', juice2: '#ffc9bd' },
  apple_green: { kind: 'fruit', r: 30, pts: 1, juice: '#c4ec52', juice2: '#f3ffc0' },
  apple_gold:  { kind: 'fruit', r: 30, pts: 1, juice: '#ffd23f', juice2: '#fff1b0' },
  apple_blush: { kind: 'fruit', r: 30, pts: 1, juice: '#ff7ea4', juice2: '#ffd6e2' },
  pear:        { kind: 'fruit', r: 28, pts: 1, juice: '#e3ee7e', juice2: '#fbffd0' },
  pumpkin:     { kind: 'fruit', r: 40, pts: 3, juice: '#ffa430', juice2: '#ffe29a' },
  hive:        { kind: 'hive',  r: 32, pts: 0, juice: '#ffc233', juice2: '#fff0a8' },
  maple:       { kind: 'maple', r: 26, pts: 10, juice: '#ff7a2e', juice2: '#ffd27a' },
  donut:       { kind: 'donut', r: 30, pts: 0, juice: '#e0a050', juice2: '#fff0cc' },
  golden:      { kind: 'gold',  r: 34, pts: 1, juice: '#ffd23f', juice2: '#fff6c0' }
};
Object.keys(DEF).forEach(k => { const d = DEF[k]; d.cut = k + '_cut'; d.hitR = d.kind === 'hive' ? d.r * 0.74 : d.kind === 'fruit' ? d.r + 5 : d.kind === 'gold' ? d.r + 12 : d.r + 8; });
const APPLES = ['apple_red', 'apple_green', 'apple_gold', 'apple_blush'];
const COMBO_GAP = 0.42; // seconds between slices that still chain
const comboBonus = (n) => n < 3 ? 0 : Math.min(n, 8) * (Math.min(n, 8) - 2) + 6 * Math.max(0, n - 8); // 3->3, 4->8, 5->15, 6->24 ...
/* Blades: cosmetic trails bought with Orchard Goal ribbons (the reward track that makes goals worth chasing). */
const BLADES = [
  { id: 'sun', name: 'Golden Hour', need: 0, glow: '255,190,80', mid: '255,224,150', core: '255,255,255', head: '255,236,170' },
  { id: 'cider', name: 'Hot Cider', need: 3, glow: '255,120,40', mid: '255,176,96', core: '255,246,226', head: '255,180,100', fx: 'ember' },
  { id: 'lake', name: 'Lake Champlain', need: 7, glow: '50,160,255', mid: '140,216,255', core: '240,252,255', head: '150,220,255', fx: 'drop' },
  { id: 'maple', name: 'Sugar Maple', need: 12, glow: '255,70,40', mid: '255,140,60', core: '255,236,200', head: '255,130,70', fx: 'leaf' },
  { id: 'frost', name: 'First Frost', need: 18, glow: '160,214,255', mid: '214,238,255', core: '255,255,255', head: '220,245,255', fx: 'frost' },
  { id: 'sunset', name: 'Lake Sunset', need: 25, glow: '255,90,140', mid: '255,170,120', core: '255,244,236', head: '255,190,160', fx: 'ember' },
  { id: 'aurora', name: 'Northern Lights', need: 33, glow: '70,255,170', mid: '170,140,255', core: '240,255,250', head: '150,255,210', fx: 'aurora' },
  { id: 'mill', name: 'Cider Mill', need: 42, glow: '200,120,40', mid: '255,200,110', core: '255,250,230', head: '255,214,140', fx: 'leaf' },
  { id: 'harvest', name: 'Harvest Moon', need: 52, rainbow: true, glow: '255,190,80', mid: '255,224,150', core: '255,255,255', head: '255,236,200', fx: 'rainbow' }
];
const bladeById = (id) => BLADES.find(b => b.id === id) || BLADES[0];
const bladeUnlocked = (b) => (save.ribbons || 0) >= b.need;
function curBlade() { const b = bladeById(save.blade); return bladeUnlocked(b) ? b : BLADES[0]; }
function nextBlade() { return BLADES.find(b => !bladeUnlocked(b)) || null; }
const COMBO_WORDS = { 3: 'CRISP!', 4: 'JUICY!', 5: 'CIDER-LICIOUS!', 6: 'ORCHARD MASTER!', 7: 'HARVEST HERO!' };

/* ------------------------------------------------------------------ layout */
const cv = $('c'), ctx = cv.getContext('2d'), stage = $('stage');
let W = 390, H = 844, K = 1, DPR = 1, PK = 1, cssW = 0, cssH = 0, safeTop = 0, lastPortrait = true, layoutDone = false;
let fzGrad = null, safeL = 0, safeR = 0, bg = null, SP = null, spPK = 0, glowSp = {}, resizeTimer = 0, pendingLayout = false;

function readSafe() { try { const cs = getComputedStyle($('safeProbe')); safeTop = (parseFloat(cs.paddingTop) || 0) / K; safeL = parseFloat(cs.paddingLeft) || 0; safeR = parseFloat(cs.paddingRight) || 0; } catch (e) { safeTop = safeL = safeR = 0; } }
function makeGlow(rgb) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(' + rgb + ',1)'); gr.addColorStop(.35, 'rgba(' + rgb + ',.45)'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
}
function layout(force) {
  let soft = false;
  const vw = Math.max(200, window.innerWidth), vh = Math.max(200, window.innerHeight), portrait = vh >= vw;
  if (layoutDone && !force) {
    const dw = Math.abs(vw - cssW), dh = Math.abs(vh - cssH), orient = portrait !== lastPortrait;
    if (!orient && dw < 2 && dh < 2) return;
    // Mobile browser toolbars change the height by a few dozen px: never reflow mid-game for that.
    if (G.state === 'play' && !orient && dw < 2 && dh < 160) {
      if (!portrait) { pendingLayout = true; return; }
      soft = true; // portrait: the width (and so the scale) stays the same, only the bottom edge moves
    }
  }
  pendingLayout = false;
  const oldW = W, oldH = H, first = !layoutDone;
  cssW = vw; cssH = vh; lastPortrait = portrait;
  const S = 390;
  if (portrait) { W = S; H = S * vh / vw; } else { H = S; W = S * vw / vh; }
  K = vw / W;
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  while (vw * vh * DPR * DPR > 4.6e6 && DPR > 0.8) DPR -= 0.1;
  PK = K * DPR;
  stage.style.width = vw + 'px'; stage.style.height = vh + 'px';
  cv.width = Math.round(vw * DPR); cv.height = Math.round(vh * DPR); cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
  readSafe();
  bg = ART.makeBackground(W, H, PK); txtCache.clear(); fzGrad = null;
  if (!SP || Math.abs(PK / spPK - 1) > 0.03) { SP = ART.build(Math.min(PK, 5)); spPK = PK; }
  if (!first && !soft && (oldW !== W || oldH !== H)) remap(W / oldW, H / oldH);
  layoutDone = true;
  if (!first && !soft && G.state === 'play' && !G.ending) pauseGame(true);
}
function remap(fx, fy) {
  const f = (a) => { for (const o of a) { o.x *= fx; o.y *= fy; } };
  f(items); f(halves); f(parts); f(popups); f(splats); f(bees); f(motes);
  pend.length = 0; for (const gh of ghosts) { gh.x0 *= fx; gh.x1 *= fx; gh.y0 *= fy; gh.y1 *= fy; }
  for (const p of pointers.values()) p.pts.length = 0;
  dead.length = 0;
}

/* ------------------------------------------------------------------ game state */
const G = { state: 'title', mode: 'classic', t: 0, score: 0, misses: 0, timeLeft: 0, wave: 1, volleys: 0, fruit: 0, bestCombo: 0, frenzy: 0, fz: 0, next: 1, ending: false, endT: 0, endReason: '', scoreBump: 0, lastMaple: -99, lastDonut: -99, tutHits: 0, missPop: [0, 0, 0], shownTick: -1, banner: null, newBest: false };
let items = [], halves = [], parts = [], popups = [], splats = [], bees = [], motes = [], pend = [], ghosts = [];
const SLOW_DUR = 0.6;
let punch = 0, quality = 1, slowT = 0, RT = 0, lastBigFx = -9, lastMicro = -9, hitstop = 0, flash = { a: 0, r: 255, g: 240, b: 200 }, shake = 0, manualMode = false, fpsAvg = 60, redFlash = 0;
const pointers = new Map(), dead = []; // dead = fading trails of lifted fingers
let sliceLog = [];

for (let i = 0; i < 26; i++) motes.push({ x: Math.random() * 390, y: Math.random() * 844, vx: rr(-4, 4), vy: rr(-14, -4), s: rr(.4, 1.1), ph: rnd() * 7 });

/* ------------------------------------------------------------------ helpers */
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255); }
function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
function addShake(a) { shake = Math.min(14, Math.max(shake, a)); }
function addFlash(a, r, g, b) { flash.a = Math.max(flash.a, a); if (r != null) { flash.r = r; flash.g = g; flash.b = b; } }
function popup(x, y, text, color, size, life, kind) {
  if ((size || 22) <= 32 && popups.length > 14) return null; // a busy frenzy: keep the big words readable
  const hw = Math.min(W / 2 - 8, measure(text, size || 22) / 2 + 10);
  const pp = { x: clamp(x, hw + 6, W - hw - 6), y: Math.max(y, safeTop + 70), text, color: color || '#fff', size: size || 22, life: life || 0.9, age: 0, kind: kind || 'float' };
  popups.push(pp); return pp;
}
function banner(text, color, sub) { G.banner = { text, color: color || '#ffe27a', sub: sub || '', age: 0, life: 1.5 }; }
function waveCall(n) { G.waveCall = { text: 'WAVE ' + n, age: 0, life: 1.3 }; } // small and high, so it never covers fruit at their peak

/* ------------------------------------------------------------------ spawning */
function waveOf() {
  if (G.state === 'play' && inTutorial()) return 1;
  const t = G.t - (G.tutT || 0); // time spent in the first-ever lesson doesn't count
  if (G.mode === 'classic') return 1 + Math.floor((G.volleys - (G.tutV || 0)) / 5);
  if (timedLike(G.mode)) return 1 + Math.floor(t / 7);
  return 1 + Math.floor(t / 12);
}
function launch(type, o) {
  o = o || {};
  const R = o.R || (o.frenzy ? FR : SR);
  const d = DEF[type], r = d.r, g = H * 1.25 * (o.g || G.gMul || 1);
  const x0 = o.x0 != null ? o.x0 : srr(R, W * .14, W * .86);
  const apexY = o.apexY != null ? o.apexY : G.state === 'title' ? srr(R, H * .52, H * .6) : type === 'golden' ? srr(R, Math.max(H * .26, safeTop + 150), H * .38) : srr(R, Math.max(H * .2, safeTop + 120), H * .5);
  const rise = (H + r + 6) - apexY, vy = -Math.sqrt(2 * g * rise), tUp = -vy / g;
  const ax = o.apexX != null ? o.apexX : type === 'golden' ? srr(R, W * .3, W * .7) : clamp(x0 + (W * .5 - x0) * srr(R, .1, .85) + srr(R, -W * .13, W * .13), W * .1, W * .9);
  const it = { type, kind: d.kind, r, hitR: d.hitR, x: x0, y: H + r + 6, vx: (ax - x0) / tUp, vy, g, rot: R() * TAU,
    vr: (d.kind === 'hive' ? srr(R, -1.4, 1.4) : type === 'pumpkin' ? srr(R, -2, 2) : type === 'maple' ? srr(R, -5, 5) : d.kind === 'gold' ? srr(R, -1.5, 1.5) : srr(R, -4.5, 4.5)),
    age: 0, dead: false, frenzy: !!o.frenzy, tUp, ax, apexY, seedBee: R() * 7, hits: 0, hang: 0, hangT: 0, shk: 0, vid: o.vid || 0 };
  items.push(it);
  if (G.state !== 'title') AUD.sfx.launch();
  return it;
}
function later(t, type, o) { if (t <= 0.001) return launch(type, o); pend.push({ t, type, o }); }

function pickType() {
  const w = G.wave, roll = SR();
  if (G.state === 'title') return roll < 0.1 ? 'maple' : spick(SR, APPLES.concat(['pear', 'apple_red']));
  if (G.mode !== 'zen' && w >= 3 && roll < Math.min(0.08 + 0.012 * (w - 3), 0.19)) return 'hive';
  if (w >= 2 && G.t - G.lastMaple > 8 && SR() < 0.07) { G.lastMaple = G.t; return 'maple'; }
  if (w >= 3 && G.t - G.lastDonut > 14 && SR() < (G.mode === 'classic' ? 0.06 : 0.11)) { G.lastDonut = G.t; return 'donut'; }
  if (w >= 2 && G.t - G.lastGold > (G.mode === 'classic' ? 26 : 18) && SR() < 0.08) { G.lastGold = G.t; return 'golden'; }
  const f = SR();
  if (w >= 3 && f < 0.09) return 'pumpkin';
  if (w >= 2 && f < 0.3) return 'pear';
  return spick(SR, APPLES);
}
function spawnVolley() {
  const nw = waveOf();
  if (nw > G.wave) { G.wave = nw; if (G.state === 'play') { waveCall(nw); AUD.sfx.wave(); } }
  G.gMul = 1 + Math.min(0.32, (G.wave - 1) * 0.035);
  G.volleys++;
  // scripted opening the first time anyone plays: 1 apple, then 2, then 3 in a row, with a ghost
  // hand swiping through all of them, so the first game teaches the combo by doing it
  if (G.state === 'play' && inTutorial()) {
    G.tutV = G.volleys;
    const n = G.tutHits < 1 ? 1 : G.tutHits < 3 ? 2 : 3, ay = H * .4, sl = n > 1 ? -0.18 : 0;
    let first = null;
    for (let i = 0; i < n; i++) {
      const ax = W * .5 + (i - (n - 1) / 2) * W * .22;
      const it = launch(pick(APPLES), { R: rnd, x0: W * .5 + (i - (n - 1) / 2) * W * .08, apexX: ax, apexY: ay + (ax - W * .5) * sl, g: .78 });
      it.tut = true; first = first || it;
    }
    const half = n === 1 ? 78 : (n - 1) / 2 * W * .22 + 60;
    ghosts.push({ t0: G.t + first.tUp - 0.45, dur: 0.75 + n * 0.15, x0: W * .5 - half, y0: ay + (n === 1 ? 52 : half * -sl + 10), x1: W * .5 + half, y1: ay - (n === 1 ? 52 : half * -sl + 10) });
    G.next = 2.3 + n * 0.25; return;
  }
  const base = [2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 6][Math.min(G.wave, 12) - 1];
  let n = base + (SR() < .3 ? 1 : 0) - (SR() < .2 ? 1 : 0) + (G.mode === 'zen' ? 1 : 0);
  if (G.state === 'title') n = 1 + (SR() < .4 ? 1 : 0);
  n = Math.max(G.state === 'title' ? 1 : 2, n);
  // early waves often throw a fanned line: an easy, readable combo for new players
  const fan = n >= 3 && SR() < (G.wave <= 2 ? 0.6 : 0.35), fx0 = srr(SR, W * .2, W * .8);
  let hives = 0, gold = 0;
  // Clean Pick: slice every fruit of a throw (none dropped) for a bonus
  const vol = G.state === 'play' ? { n: 0, cut: 0, lost: false } : null, vid = vol ? ++G.vid : 0;
  if (vol) G.vols[vid] = vol;
  for (let i = 0; i < n; i++) {
    let type = pickType();
    if (type === 'hive') { if (hives >= 2 || n < 2) type = spick(SR, APPLES); else hives++; }
    if (type === 'golden') { if (gold) type = spick(SR, APPLES); else gold++; }
    const o = {};
    if (vol && DEF[type].kind === 'fruit') { o.vid = vid; vol.n++; G.thrown++; }
    if (fan && type !== 'golden') { o.x0 = fx0 + srr(SR, -10, 10); o.apexX = clamp(fx0 + (i - (n - 1) / 2) * W * .17, W * .1, W * .9); }
    later(i * (fan ? 0.07 : srr(SR, 0.11, 0.2)), type, o);
  }
  const gap = Math.max(0.8, 1.3 - 0.06 * (G.wave - 1)) * srr(SR, .88, 1.12);
  G.next = (G.state === 'title' ? srr(SR, 1.4, 2.2) : gap + n * 0.13 + (gold ? 1.2 : 0)); // a golden apple gets a little room
}
function frenzyBurst() {
  for (let i = 0; i < 8; i++) later(i * 0.05, spick(FR, APPLES.concat(['pear', 'apple_gold'])), { frenzy: true, x0: W * .5 + srr(FR, -14, 14), apexX: clamp(W * .5 + (i - 3.5) * W * .12, W * .08, W * .92), apexY: srr(FR, H * .22, H * .5) });
}
function runSpawner(dt) {
  if (G.frenzy > 0) {
    G.frenzy -= dt; G.fz -= dt;
    if (G.fz <= 0 && G.frenzy > 0.5) { G.fz = 0.17; later(0, spick(FR, APPLES.concat(['pear', 'apple_gold', 'pumpkin'])), { frenzy: true }); }
    if (G.frenzy <= 0) { G.frenzy = 0; G.next = 1.9; G.fzTally = 1.1; }
    return;
  }
  // once the last frenzy fruit have landed, show what the frenzy was worth
  if (G.fzTally > 0) { G.fzTally -= dt; if (G.fzTally <= 0 && G.state === 'play' && !G.ending && G.fzCount > 0) { banner('FRENZY HARVEST', '#ffd24a', G.fzCount + ' fruit  +' + G.fzPts + ' points'); G.banner.high = true; AUD.sfx.wave(); G.fzBest = Math.max(G.fzBest, G.fzCount); checkGoals(); } }
  G.next -= dt; if (G.next <= 0) spawnVolley();
}

/* ------------------------------------------------------------------ slicing */
function segCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  const px = ax + dx * t - cx, py = ay + dy * t - cy;
  return px * px + py * py <= r * r ? t : -1;
}
const TUT_N = 6; // 1 + 2 + 3 tutorial apples
function inTutorial() { return !save.tut && G.tutHits < TUT_N; }
function canSlice() { return (G.state === 'play' && !G.ending) || G.state === 'title'; }
function strokeAngle(p, bx, by) {
  for (let i = p.pts.length - 1; i >= 0; i--) { const q = p.pts[i], dx = bx - q.x, dy = by - q.y; if (dx * dx + dy * dy >= 196) return Math.atan2(dy, dx); }
  return null;
}
function slashSegment(p, ax, ay, bx, by, tap) {
  if (!canSlice()) return;
  let hits = null, inGold = null;
  for (const it of items) {
    if (it.dead) continue;
    const t = segCircle(ax, ay, bx, by, it.x, it.y, it.hitR);
    if (it.kind === 'gold') { // the golden apple takes many hits: one each time the blade (re)enters it
      if (t >= 0) { inGold = it; if (p.inGold !== it || tap) hitGold(it, p, Math.atan2(by - ay, bx - ax)); }
      continue;
    }
    if (t >= 0) (hits || (hits = [])).push({ it, t });
  }
  p.inGold = inGold;
  if (!hits) return;
  hits.sort((a, b) => a.t - b.t);
  let ang = tap ? null : strokeAngle(p, bx, by);
  if (ang == null) { const dx = bx - ax, dy = by - ay; ang = (dx * dx + dy * dy) > 4 ? Math.atan2(dy, dx) : -0.6 + rr(-.5, .5); }
  for (const h of hits) { if (G.ending) break; sliceItem(h.it, p, ang); }
}

function sliceItem(it, p, ang) {
  it.dead = true;
  const d = DEF[it.type], live = G.state === 'play';
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  sliceFx(it, d, ang, nx, ny);
  if (it.kind === 'hive') { hitHive(it, p); return; }
  // combo chain within one stroke
  const cb = p.combo;
  if (G.t - cb.last > COMBO_GAP) cb.n = 0;
  cb.n++; cb.last = G.t;
  const n = cb.n;
  sliceLog.push({ type: it.type, n, t: +G.t.toFixed(2) });
  AUD.sfx.slice(n - 1, n >= 3, it.type === 'pumpkin');
  vib(n >= 3 ? 18 : 8);
  // crunch: a tiny freeze on every slice (throttled so a fast multi-slice stroke doesn't stutter)
  if (n < 3 && RT - lastMicro > 0.09) { hitstop = Math.max(hitstop, it.type === 'pumpkin' ? 0.05 : 0.03); lastMicro = RT; }
  if (live) {
    if (it.kind === 'fruit') {
      const fz = G.frenzy > 0 || it.frenzy, pts = d.pts * (fz ? 2 : 1) * G.mult;
      G.score += pts; G.fruit++; G.fr++; if (it.type === 'pumpkin') G.pk++; bump();
      if (fz) { G.fzCount++; G.fzPts += pts; G.fzBest = Math.max(G.fzBest, G.fzCount); }
      if (!fz && (n < 3 || G.mult > 1 && n < 5)) (p.small || (p.small = [])).push(popup(it.x, it.y - it.r * .6, '+' + pts, fz ? '#ffd24a' : d.pts > 1 ? '#ffb347' : '#fff6d8', fz || d.pts > 1 ? 30 : 22, .75));
      if (!save.tut) { G.tutHits++; if (G.tutHits >= TUT_N) { save.tut = 1; writeSave(); } }
      const v = it.vid && G.vols[it.vid]; if (v) G.picked++;
      if (v && ++v.cut === v.n && !v.lost && v.n >= 3) cleanPick(v, it);
    } else if (it.kind === 'maple') {
      G.score += d.pts; bump(); G.fruit++; G.mp++;
      popup(it.x, it.y - 10, '+10 MAPLE!', '#ff9a3c', 30, 1.1);
      AUD.sfx.maple(); addFlash(.18, 255, 190, 90);
      for (let i = 0; i < 12; i++) parts.push(leafBit(it.x, it.y));
    } else if (it.kind === 'donut') {
      G.fruit++; startFrenzy(it);
    }
    if (n >= 3) {
      const b = comboBonus(n) - comboBonus(n - 1);
      G.score += b; bump(); G.bestCombo = Math.max(G.bestCombo, n);
      AUD.sfx.combo(n);
      comboPopup(p, it, n);
      if (n === 3 || n === 5 || n === 7 || RT - lastBigFx > 0.5) {
        lastBigFx = RT;
        hitstop = Math.max(hitstop, n >= 5 ? 0.05 : Math.min(0.08, 0.035 + n * 0.012));
        addFlash(Math.min(.34, .1 + n * .04), 255, 238, 190);
        addShake(Math.min(7, 2 + n));
      }
      // big combos: a beat of slow motion and a starburst so 5+ feels different from 3
      if (n === 5 || n === 7 || (n > 7 && n % 2 === 1)) {
        if (slowT <= 0) AUD.sfx.slowmo();
        punch = Math.max(punch, n >= 7 ? 1 : .7);
        slowT = SLOW_DUR;
        const cnt = 10 + Math.min(n, 10);
        for (let i = 0; i < cnt; i++) { const a = i / cnt * TAU + rr(-.1, .1), s2 = rr(260, 420); parts.push({ k: 'spark', x: it.x, y: it.y, vx: Math.cos(a) * s2, vy: Math.sin(a) * s2, age: 0, life: rr(.35, .55), size: rr(12, 20), col: '255,232,160', g: 0, drag: 1 }); }
        parts.push({ k: 'ring', x: it.x, y: it.y, vx: 0, vy: 0, age: 0, life: .5, size: n >= 7 ? Math.max(W, H) * 1.1 : 260, col: n >= 7 ? '255,200,90' : '255,240,200' });
        vib([15, 20, 25]);
      }
    } else G.bestCombo = Math.max(G.bestCombo, n);
    checkGoals();
  }
}
function bump() { G.scoreBump = 1; }
// Hot streak: clean picks in a row make every fruit worth more (x2 from 3 in a row, x3 from 6); any dropped fruit ends it
function streakMult() { return G.streak >= 6 ? 3 : G.streak >= 3 ? 2 : 1; }
function breakStreak(it) {
  if (G.state !== 'play' || G.ending || inTutorial()) return;
  if (G.streak >= 3) { popup(clamp(it.x, 60, W - 60), H - 120, 'STREAK LOST', '#ff9a7a', 22, 1); AUD.sfx.miss(); }
  G.streak = 0; G.mult = 1;
}
function cleanPick(v, it) {
  const b = v.n; G.score += b; G.clean++; bump();
  G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak);
  const m = streakMult(); if (m > G.mult) { G.mult = m; G.multPop = 1; banner('HOT STREAK x' + m, m >= 3 ? '#ff9ad0' : '#ffb347', 'every fruit is worth ' + m + ' points'); G.banner.high = true; AUD.sfx.donut(); }
  popup(it.x, it.y - it.r - 34, 'CLEAN PICK +' + b, '#b8f27a', 24, 1.0);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; parts.push({ k: 'spark', x: it.x, y: it.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, age: 0, life: .4, size: 12, col: '190,255,140', g: 0, drag: 1 }); }
  AUD.sfx.clean(b); checkGoals();
}
function comboPopup(p, it, n) {
  if (p.small) { for (const sp of p.small) if (sp) sp.age = Math.max(sp.age, sp.life - .08); p.small = null; } // the combo word takes over from this stroke's +1s
  const word = COMBO_WORDS[Math.min(n, 7)];
  let cp = p.cp;
  const tot = comboBonus(n);
  if (cp && cp.age < cp.life - 0.15 && popups.indexOf(cp) >= 0) { cp.n = n; cp.word = word; cp.tot = tot; cp.pop = 0; cp.age = 0; cp.x = clamp(it.x, 110, W - 110); cp.y = Math.max(it.y - 95, safeTop + 120); }
  else {
    cp = { kind: 'combo', n, word, tot, x: clamp(it.x, 110, W - 110), y: Math.max(it.y - 95, safeTop + 120), age: 0, life: 1.15, pop: 0, text: '' };
    for (const o of popups) if (o.kind === 'combo' && o !== cp && Math.abs(o.y - cp.y) < 80 && o.age < o.life * .8) cp.y = o.y + (o.y > H * .55 ? -88 : 88); // two fingers: stack, don't overlap
    if (G.banner && G.banner.age < G.banner.life * .8 && Math.abs(cp.y - H * .3) < 95) cp.y = H * .3 + 105; // and stay clear of a banner
    popups.push(cp); p.cp = cp;
  }
}
function startFrenzy(it) {
  G.frenzy = 5.2; G.fz = 0.25; G.fzCount = 0; G.fzPts = 0; G.fzTally = 0;
  banner('FRENZY!', '#ffd24a', 'every fruit counts double!'); punch = 1;
  AUD.sfx.donut(); addFlash(.35, 255, 210, 110); addShake(5); vib([20, 30, 20]);
  parts.push({ k: 'ring', x: it.x, y: it.y, vx: 0, vy: 0, age: 0, life: .6, size: 220, col: '255,210,110' });
  frenzyBurst();
}
function hitHive(it, p) {
  AUD.sfx.hive(); vib([40, 30, 60]); addShake(11); redFlash = .55; addFlash(.3, 255, 90, 60);
  for (let i = 0; i < 12; i++) bees.push({ x: it.x + rr(-8, 8), y: it.y + rr(-8, 8), a: rnd() * TAU, sp: rr(150, 270), life: rr(2.4, 3.6), age: 0, wob: rnd() * 9, flap: rnd() * 9 });
  p.combo.n = 0;
  if (G.state !== 'play') return;
  if (G.mode === 'classic') {
    banner('BUZZED!', '#ff7a5a'); beginEnding('hive', 1.45);
  } else {
    const lost = Math.min(G.score, Math.max(10, Math.round(G.score * 0.1)));
    G.score = Math.max(0, G.score - lost); G.timeLeft = Math.max(0, G.timeLeft - 5); G.timeHit = 1; bump();
    popup(it.x, it.y - 20, '-' + lost, '#ff6a5a', 40, 1.2); popup(it.x, it.y + 24, '-5 s', '#ff6a5a', 32, 1.2);
    banner('BUZZED!', '#ff7a5a', 'lost ' + lost + ' points and 5 seconds');
  }
}
function hitGold(it, p, ang) {
  if (G.state === 'play' && G.ending) return;
  if (it.age - (it.lastHit || -1) < 0.045) return;
  it.lastHit = it.age; it.hits++; it.shk = 1;
  const live = G.state === 'play', n = it.hits;
  if (it.hang > 0) it.hang = Math.max(it.hang, 0.75); // keep it up while you keep slashing (total time is capped)
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let i = 0; i < 7; i++) { const side = i & 1 ? 1 : -1, sp = rr(120, 320); parts.push({ k: 'drop', x: it.x + dx * rr(-12, 12), y: it.y + dy * rr(-12, 12), vx: -dy * side * sp + dx * rr(-60, 120), vy: dx * side * sp - rr(40, 200), age: 0, life: rr(.4, .8), size: rr(2.5, 5), col: i % 3 ? '#ffd23f' : '#fff6c0', g: 900 }); }
  for (let i = 0; i < 3; i++) parts.push({ k: 'spark', x: it.x + rr(-20, 20), y: it.y + rr(-20, 20), vx: rr(-90, 90), vy: rr(-120, 20), age: 0, life: rr(.25, .45), size: rr(10, 18), col: '255,236,150', g: 0 });
  parts.push({ k: 'cut', x: it.x, y: it.y, vx: 0, vy: 0, age: 0, life: .12, size: it.r * 2.6, ang });
  AUD.sfx.goldHit(n - 1); vib(6);
  if (RT - lastMicro > 0.07) { hitstop = Math.max(hitstop, 0.022); lastMicro = RT; }
  addShake(1.5 + Math.min(n, 10) * .25);
  if (live) {
    const pts = G.frenzy > 0 ? 2 : 1;
    G.score += pts; bump(); G.goldHits = (G.goldHits || 0) + 1; G.goldMax = Math.max(G.goldMax || 0, n);
    checkGoals();
  }
  if (n >= 12) burstGold(it, ang);
}
function burstGold(it, ang) {
  if (it.dead) return;
  it.dead = true;
  const d = DEF.golden, n = it.hits, live = G.state === 'play';
  if (ang == null) ang = rr(-.6, .6);
  sliceFx(it, d, ang, -Math.sin(ang), Math.cos(ang));
  const cnt = 18 + Math.min(n, 12);
  for (let i = 0; i < cnt; i++) { const a = i / cnt * TAU + rr(-.1, .1), s2 = rr(240, 460); parts.push({ k: 'spark', x: it.x, y: it.y, vx: Math.cos(a) * s2, vy: Math.sin(a) * s2, age: 0, life: rr(.35, .6), size: rr(12, 22), col: '255,220,110', g: 0, drag: 1 }); }
  parts.push({ k: 'ring', x: it.x, y: it.y, vx: 0, vy: 0, age: 0, life: .5, size: 320, col: '255,214,100' });
  AUD.sfx.goldBurst(n); vib([20, 25, 35]); punch = Math.max(punch, .8); addFlash(.3, 255, 226, 140); addShake(6);
  hitstop = Math.max(hitstop, 0.06); lastMicro = RT;
  if (live) {
    const bonus = n >= 12 ? 25 : n >= 8 ? 12 : n >= 5 ? 6 : 2;
    G.score += bonus; bump(); G.fruit++; G.fr++;
    banner(n >= 12 ? 'GOLDEN RUSH!' : 'GOLDEN APPLE', '#ffe27a', n + ' hits  +' + (n * (G.frenzy > 0 ? 2 : 1) + bonus) + ' points');
    checkGoals();
  }
}
function bladeFx(bl, x, y) {
  const f = bl.fx;
  if (f === 'leaf') { const b = leafBit(x, y); b.size *= .45; b.vx *= .25; b.vy = rr(-40, 40); b.life *= .7; parts.push(b); return; }
  const col = f === 'ember' ? (rnd() < .5 ? '255,150,60' : '255,210,120') : f === 'drop' ? '150,220,255' : f === 'frost' ? '235,248,255' : f === 'aurora' ? (rnd() < .5 ? '90,255,170' : '180,140,255') : hsvRgb((RT * 240) % 360);
  parts.push({ k: 'spark', x: x + rr(-6, 6), y: y + rr(-6, 6), vx: rr(-40, 40), vy: f === 'ember' ? rr(-90, -20) : f === 'drop' ? rr(40, 140) : rr(-30, 30), age: 0, life: rr(.25, .5), size: rr(6, 11), col, g: f === 'drop' ? 500 : 0 });
}
function hsvRgb(h) { const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - .55 * Math.max(0, Math.min(k, 4 - k, 1)))); }; return f(5) + ',' + f(3) + ',' + f(1); }
function leafBit(x, y) {
  const a = rnd() * TAU, s = rr(80, 340);
  return { k: 'leaf', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, age: 0, life: rr(.7, 1.3), size: rr(.35, .6), rot: rnd() * TAU, vr: rr(-8, 8), g: 520 };
}
function sliceFx(it, d, ang, nx, ny) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  // two halves: they burst apart fast along the cut normal, then air drag settles them (sep decays)
  for (const side of [1, -1]) {
    const sp = rr(50, 100);
    halves.push({ key: d.cut, whole: it.type, x: it.x + nx * side * 3, y: it.y + ny * side * 3, vx: it.vx * .55 + nx * side * sp, vy: it.vy * .55 + ny * side * sp - 40,
      g: it.g, a: ang, rot0: it.rot - ang, vr: side * rr(2, 5.5) + it.vr * .3, side, r: it.r, age: 0, kind: it.kind, ew: it.r * (it.type === 'pear' ? .5 : it.kind === 'fruit' || it.kind === 'gold' ? .84 : 0), nx: nx * side, ny: ny * side, sep: rr(380, 450) });
  }
  // bright cut line across the fruit
  parts.push({ k: 'cut', x: it.x, y: it.y, vx: 0, vy: 0, age: 0, life: .17, size: it.r * 2.9, ang });
  // juice: drops sprayed out both sides of the cut, plus a soft mist puff in the juice colour
  const col = d.juice, nd = Math.round((it.kind === 'fruit' || it.kind === 'gold' ? 24 : it.kind === 'hive' ? 14 : 12) * quality), big = it.r >= 36 ? 1.25 : 1;
  for (let i = 0; i < nd; i++) {
    const side = i & 1 ? 1 : -1, sp = rr(90, 380), al = rr(-.5, .5);
    parts.push({ k: 'drop', x: it.x + dx * rr(-it.r, it.r) * .7, y: it.y + dy * rr(-it.r, it.r) * .7, vx: nx * side * sp + dx * rr(-80, 200) + it.vx * .4, vy: ny * side * sp + dy * rr(-80, 200) - rr(0, 160) + it.vy * .3 + al * 20,
      age: 0, life: rr(.5, 1.05), size: rr(2.6, 7) * big, col: i % 6 === 0 ? d.juice2 : col, g: 900 });
  }
  parts.push({ k: 'mist', x: it.x, y: it.y, vx: it.vx * .3, vy: it.vy * .3, age: 0, life: .32, size: it.r * 2.4, col: hexRgb(col) });
  // seeds and chunks
  if (it.kind === 'fruit') {
    const ns = Math.round((it.type === 'pumpkin' ? 7 : 4) * (G.frenzy > 0 ? .4 : 1)), scol = it.type === 'pumpkin' ? '#fff1cf' : '#3a1d0c';
    for (let i = 0; i < ns; i++) { const a = rnd() * TAU, s = rr(120, 300); parts.push({ k: 'seed', x: it.x, y: it.y, vx: Math.cos(a) * s + it.vx * .3, vy: Math.sin(a) * s - 120, age: 0, life: rr(.6, 1.0), size: it.type === 'pumpkin' ? 4.2 : 3, rot: rnd() * TAU, vr: rr(-14, 14), col: scol, g: 1000 }); }
    if (it.type === 'pumpkin') addShake(2.5);
  }
  parts.push({ k: 'ring', x: it.x, y: it.y, vx: 0, vy: 0, age: 0, life: .18, size: it.r * 2.2, col: '255,236,190', a: .35 });
  // glints along the cut
  for (let i = 0; i < 5; i++) parts.push({ k: 'spark', x: it.x + dx * rr(-it.r, it.r), y: it.y + dy * rr(-it.r, it.r), vx: rr(-60, 60), vy: rr(-80, 20), age: 0, life: rr(.2, .4), size: rr(8, 15), col: '255,244,200', g: 0 });
  // splat that fades
  const sr = it.r * rr(1.0, 1.35) * (it.kind === 'fruit' ? 1 : .8), blobs = [], drips = [];
  for (let i = 0; i < 7; i++) { const a = rnd() * TAU; blobs.push({ x: Math.cos(a) * sr * rr(.5, 1.1), y: Math.sin(a) * sr * rr(.5, 1.1) * .9, r: sr * rr(.14, .34) }); }
  const nd2 = rnd() < .5 ? 1 : 2; for (let i = 0; i < nd2; i++) drips.push({ x: rr(-.45, .45) * sr, len: rr(.5, 1.1) * sr, w: sr * rr(.06, .09) });
  const dots = []; for (let i = 0; i < 6; i++) { const a = rnd() * TAU, dd = sr * rr(1.05, 1.4); dots.push({ x: Math.cos(a) * dd, y: Math.sin(a) * dd * .9, r: sr * rr(.04, .09) }); }
  // stains are a 'juice on the glass' effect that suits the cartoon scene; over the painted orchard they read as blobs hanging in the sky
  if (!(ART.loadInfo.bg && H > W)) { const spl = { x: it.x, y: it.y, r: sr, col, col2: d.juice2, blobs, drips, dots, age: 0, life: 1.8 }; makeSplat(spl); splats.push(spl); }
  if (splats.length > 18) splats.shift();
}

/* ------------------------------------------------------------------ orchard goals (replay hook)
   Three goals at a time. Finishing one earns a ribbon; finished goals are swapped for new ones at the
   start of the next game, and targets get tougher every 3 ribbons. */
const GOALS = {
  combo:   { t: [3, 4, 5, 6, 7],          txt: n => 'Get a ' + n + 'x combo',                 chk: n => G.bestCombo >= n },
  classic: { t: [40, 80, 150, 250, 400],  txt: n => 'Score ' + n + ' in Classic',              chk: n => G.mode === 'classic' && G.score >= n },
  timed:   { t: [40, 90, 160, 250, 350],  txt: n => 'Score ' + n + ' in Timed',                chk: n => timedLike(G.mode) && G.score >= n },
  clean:   { t: [3, 5, 8, 11, 15],        txt: n => 'Get ' + n + ' clean picks in one game',   chk: n => (G.clean || 0) >= n },
  golden:  { t: [4, 6, 8, 10, 12],        txt: n => 'Hit a golden apple ' + n + ' times',      chk: n => (G.goldMax || 0) >= n },
  accuracy: { t: [75, 82, 88, 92, 96],     txt: n => 'Pick ' + n + '% of the fruit in a game', chk: n => G.ending && G.thrown >= 20 && G.picked / G.thrown * 100 >= n },
  streak:  { t: [3, 4, 6, 8, 10],         txt: n => 'Reach a hot streak of ' + n,              chk: n => (G.bestStreak || 0) >= n },
  daily:   { t: [1, 1, 1, 1, 1],          txt: () => 'Play today\'s Daily Harvest',             chk: () => G.mode === 'daily' && G.ending },
  zen:     { t: [60, 120, 200, 300, 420], txt: n => 'Score ' + n + ' in Zen',                  chk: n => G.mode === 'zen' && G.score >= n },
  fruit:   { t: [30, 60, 100, 150, 220],  txt: n => 'Slice ' + n + ' fruit in one game',       chk: n => G.fr >= n },
  pumpkin: { t: [2, 3, 5, 7, 10],         txt: n => 'Slice ' + n + ' pumpkins in one game',    chk: n => G.pk >= n },
  maple:   { t: [1, 2, 3, 4, 5],          txt: n => n === 1 ? 'Catch a maple leaf' : 'Catch ' + n + ' maple leaves in one game', chk: n => G.mp >= n },
  frenzy:  { t: [8, 12, 16, 20, 26],      txt: n => 'Slice ' + n + ' fruit in one frenzy',     chk: n => G.fzBest >= n },
  total:   { t: [100, 250, 500, 900, 1500], txt: n => 'Slice ' + n + ' fruit in total',        chk: (n, g) => g.p + G.fr >= n, prog: (g, live) => (g.p + (live ? G.fr : 0)) + '/' + g.n }
};
function goalTier() { return Math.min(4, Math.floor((save.ribbons || 0) / 3)); }
function dealGoal() {
  const SC = ['classic', 'timed', 'zen'], used = save.goals.map(g => g.k), hasSc = used.some(k => SC.indexOf(k) >= 0);
  const keys = Object.keys(GOALS).filter(k => used.indexOf(k) < 0 && !(hasSc && SC.indexOf(k) >= 0)); // at most one score goal at a time
  const k = keys[(Math.random() * keys.length) | 0];
  return { k, n: GOALS[k].t[goalTier()], p: 0, done: false };
}
function ensureGoals() {
  if (!Array.isArray(save.goals)) save.goals = [];
  save.ribbons = Math.max(0, +save.ribbons || 0);
  save.goals = save.goals.filter(g => g && GOALS[g.k] && !g.done && typeof g.n === 'number');
  for (const g of save.goals) g.p = +g.p || 0;
  while (save.goals.length < 3) save.goals.push(dealGoal());
}
function foldTotals() { // add this round's fruit to "slice N in total" goals, once per round
  if (G.folded || (G.state !== 'play' && G.state !== 'pause')) return;
  G.folded = true; for (const g of save.goals) if (g.k === 'total' && !g.done) g.p += G.fr;
  writeSave();
}
function goalText(g) { return GOALS[g.k].txt(g.n); }
function checkGoals() {
  if (G.state !== 'play') return;
  for (const g of save.goals) {
    if (g.done || !GOALS[g.k].chk(g.n, g)) continue;
    g.done = true; save.ribbons = (save.ribbons || 0) + 1; G.goalsHit.push(g); writeSave();
    goalQ.push({ text: goalText(g), age: 0, life: 2.4 }); AUD.sfx.goal(); vib([10, 30, 10]);
    bladeCheck(true);
  }
}
let goalQ = [];
// a ribbon that crosses a blade's price unlocks it and equips it right away (instant payoff)
function bladeCheck(toast) {
  const b = BLADES.filter(x => x.need > 0 && x.need <= (save.ribbons || 0) && !(save.bladesSeen || []).includes(x.id));
  if (!b.length) return null;
  save.bladesSeen = (save.bladesSeen || []).concat(b.map(x => x.id));
  const top = b[b.length - 1]; save.blade = top.id; writeSave();
  if (toast) goalQ.push({ text: top.name + ' blade unlocked!', age: 0, life: 2.6, blade: top });
  G.newBlade = top; return top;
}
function drawGoalToast() {
  const q = goalQ[0]; if (!q || (G.frenzy > 0 && G.state === 'play') || q.age === 0) return;
  const u = q.age / q.life, inn = easeOutBack(clamp(q.age / .35, 0, 1)), a = u < .8 ? 1 : 1 - (u - .8) / .2;
  const low = G.banner && H < 600; // short/landscape screens: keep clear of the banner at H*.3
  const y = low ? H - 70 + (1 - inn) * 40 : safeTop + (G.frenzy > 0 ? 146 : 128) - (1 - inn) * 40;
  ctx.save(); ctx.globalAlpha = a;
  const w = Math.min(W - 24, measure(q.text, 17) + 96), x = W / 2 - w / 2;
  ctx.fillStyle = 'rgba(36,18,60,.92)'; ctx.beginPath(); ctx.roundRect(x, y - 22, w, 44, 22); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffd24a'; ctx.stroke();
  // little ribbon rosette
  const rx = x + 26;
  ctx.fillStyle = '#e0453a'; ctx.beginPath(); ctx.moveTo(rx - 7, y); ctx.lineTo(rx - 11, y + 16); ctx.lineTo(rx - 4, y + 12); ctx.lineTo(rx, y + 2); ctx.lineTo(rx + 4, y + 12); ctx.lineTo(rx + 11, y + 16); ctx.lineTo(rx + 7, y); ctx.fill();
  ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(rx, y - 3, 11 * (1 + .15 * Math.sin(q.age * 12) * (1 - u)), 0, TAU); ctx.fill();
  ctx.fillStyle = '#e0453a'; ctx.beginPath(); ctx.arc(rx, y - 3, 5.5, 0, TAU); ctx.fill();
  txt(q.blade ? 'NEW BLADE!' : 'GOAL!', x + 44, y - 8, 15, '#ffd24a', 'left', 3.5);
  txt(q.text, x + 44, y + 9, 15, '#fff6d8', 'left', 3.5);
  ctx.restore();
}
function bladeCss(b) { return b.rainbow ? '#ffd27a' : 'rgb(' + b.mid + ')'; }
function bladeSwatch(b) { return b.rainbow ? 'linear-gradient(90deg,#ff6a6a,#ffd84a,#7cf06a,#5ac8ff,#b07aff)' : 'linear-gradient(90deg,rgba(' + b.glow + ',.25),rgb(' + b.mid + ') 35%,rgb(' + b.core + ') 60%,rgba(' + b.glow + ',.6))'; }
function goalsHTML(live) {
  const rib = '<svg viewBox="0 0 20 24" aria-hidden="true"><path d="M5 12 2 23l5-3 3 4 3-4 5 3-3-11z" fill="#e0453a"/><circle cx="10" cy="9" r="8" fill="#ffd24a"/><circle cx="10" cy="9" r="4" fill="#e0453a"/></svg>';
  const swapNote = !live && save.plays > 0 && save.swapDay === dayKey() ? '<small class="gsn">swap used &middot; new one tomorrow</small>' : '';
  let h = '<div class="gh"><span>ORCHARD GOALS' + swapNote + '</span><span class="rib">' + rib + '<b>' + (save.ribbons || 0) + '</b></span></div>';
  for (const g of save.goals) {
    const fresh = live && G.goalsHit.indexOf(g) >= 0, pr = GOALS[g.k].prog && !g.done ? '<small>' + GOALS[g.k].prog(g, false) + '</small>' : '';
    const swap = !live && !g.done && save.plays > 0 && save.swapDay !== dayKey() ? '<button class="gsw" data-swap="' + save.goals.indexOf(g) + '" aria-label="Swap this goal">&#8635;</button>' : '';
    h += '<div class="gl' + (g.done ? ' done' : '') + (fresh ? ' fresh' : '') + '"><i></i><span>' + goalText(g) + '</span>' + (fresh ? '<em>+1 ribbon</em>' : pr) + swap + '</div>';
  }
  const nb = nextBlade(), rb = save.ribbons || 0;
  if (nb) { const prev = BLADES.filter(b => b.need <= rb).pop().need, f = clamp((rb - prev) / (nb.need - prev), 0, 1);
    h += '<div class="gn"><span>Next blade: <b style="color:' + bladeCss(nb) + '">' + nb.name + '</b></span><span class="bar"><i style="width:' + (f * 100).toFixed(0) + '%"></i></span><small>' + rb + '/' + nb.need + '</small></div>'; }
  else h += '<div class="gn"><span>Every blade unlocked. Orchard legend!</span></div>';
  return h;
}

/* ------------------------------------------------------------------ game flow */
function beginEnding(reason, t) { G.ending = true; G.endReason = reason; G.endT = t; }
function onMiss(it) {
  if (inTutorial() || it.tut) return; // first-ever game: no strikes while learning (incl. leftover tutorial apples)
  if (G.state !== 'play' || G.ending || G.mode !== 'classic' || it.frenzy || G.frenzy > 0) return;
  G.misses++; G.missPop[Math.min(2, G.misses - 1)] = 1;
  AUD.sfx.miss(); addShake(3); vib(30);
  let my = H - 70; for (const o of popups) if (o.text === 'MISS' && o.age < .5 && Math.abs(o.x - clamp(it.x, 50, W - 50)) < 70) my = Math.min(my, o.y - 34);
  popup(clamp(it.x, 50, W - 50), my, 'MISS', '#ff6a5a', 30, .9);
  parts.push({ k: 'ring', x: clamp(it.x, 20, W - 20), y: H - 20, vx: 0, vy: 0, age: 0, life: .4, size: 90, col: '255,90,70' });
  if (G.misses >= 3) { banner('3 MISSES', '#ff7a5a'); beginEnding('miss', .95); }
}
let seedNext = null;
function resetRound(mode) {
  items = []; halves = []; parts = []; popups = []; splats = []; bees = []; pend = []; ghosts = [];
  pointers.clear(); dead.length = 0; hitstop = 0; slowT = 0; sliceLog = [];
  Object.assign(G, { mode, t: 0, score: 0, misses: 0, wave: 1, volleys: 0, fruit: 0, bestCombo: 0, frenzy: 0, fz: 0, next: 0.5, ending: false, endT: 0, endReason: '', scoreBump: 0, lastMaple: -99, lastDonut: -99, tutHits: 0, missPop: [0, 0, 0], shownTick: -1, banner: null, newBest: false, gMul: 1, timeHit: 0,
    fr: 0, folded: false, vid: 0, vols: {}, clean: 0, streak: 0, bestStreak: 0, thrown: 0, picked: 0, mult: 1, multPop: 0, tutT: 0, tutV: 0, waveCall: null, pk: 0, mp: 0, fzCount: 0, fzPts: 0, fzTally: 0, fzBest: 0, goalToast: null, goalsHit: [],
    lastGold: -8, goldHits: 0, goldMax: 0,
    timeLeft: timedLike(mode) ? 60 : mode === 'zen' ? 90 : 0 });
  // seed the spawners: the Daily Harvest is the same orchard for everyone today
  if (mode === 'daily') { const k = hashStr('orchard-' + dayKey()); SR.seed(k); FR.seed(k ^ 0x9e3779b9); }
  else if (seedNext != null) { SR.seed(seedNext); FR.seed(seedNext ^ 0x9e3779b9); seedNext = null; }
  else { SR.seed((Math.random() * 4294967296) >>> 0); FR.seed((Math.random() * 4294967296) >>> 0); }
}
function startGame(mode, force) {
  AUD.unlock();
  if (G.state === 'play' && !force) return; // double tap during the fade
  AUD.sfx.click();
  foldTotals(); ensureGoals(); goalQ.length = 0;
  bladesOpen = false; resetRound(mode); G.rib0 = save.ribbons || 0; G.newBlade = null;
  G.best0 = mode === 'daily' ? (save.daily.date === dayKey() ? save.daily.best : 0) : (save.best[mode] || 0); G.passedBest = false;
  G.state = 'play'; save.lastMode = mode; save.plays++; writeSave();
  AUD.theme(mode);
  if (mode === 'daily') { banner('DAILY HARVEST', '#ffe27a', dayLabel()); AUD.sfx.daily(); }
  setScreen(null); $('pauseBtn').classList.add('show');
}
function toTitle() {
  foldTotals(); ensureGoals(); goalQ.length = 0;
  resetRound('classic'); G.state = 'title'; G.next = 0.3; AUD.theme('title');
  $('pauseBtn').classList.remove('show'); setScreen('title'); refreshBest();
  if (pendingLayout) layout(true);
}
function pauseGame(silent) {
  if (G.state !== 'play') return;
  G.state = 'pause'; pointers.clear(); dead.length = 0;
  $('pauseBtn').classList.remove('show'); setScreen('pause'); AUD.duck(true);
}
function resumeGame() {
  if (G.state !== 'pause') return;
  if (pendingLayout) layout(true); // relayout first, while still paused (layout() pauses a game that is playing)
  G.state = 'play'; setScreen(null); $('pauseBtn').classList.add('show'); AUD.duck(false);
}
function dayLabel() { try { return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); } catch (e) { return dayKey(); } }
const BEST_QUIPS = ['Best harvest yet!', 'The orchard has never looked better.', 'Cider for everyone!', 'That one goes on the barn wall.'];
const BEE_QUIPS = ['Mind the hives next time.', 'The bees send their regards.', 'Honey, that hurt.', 'Buzz off, hive!'];
const MISS_QUIPS = ['The windfalls win this round.', 'Better luck next harvest.', 'Even the best pickers drop a few.', 'The deer will be thrilled.'];
const QUIPS = ['Not bad for a flatlander!', 'Cider\'s on the house.', 'The orchard thanks you.', 'Crisp work out there.', 'Apple-solutely not bad.', 'That\'s a lot of pie.'];
function showOver() {
  if (G.state !== 'play') return;
  checkGoals();
  foldTotals();
  G.state = 'over'; G.ending = false; goalQ.length = 0;
  $('pauseBtn').classList.remove('show');
  const daily = G.mode === 'daily', today = dayKey(), D = save.daily;
  let dailyNews = '';
  if (daily && D.date !== today) { // first Daily Harvest of the day: streak and a ribbon
    const yest = dayKey(new Date(Date.now() - 864e5));
    D.streak = D.date === yest ? D.streak + 1 : 1; D.date = today; D.best = 0; D.runs = 0;
    const rib = D.streak % 3 === 0 ? 2 : 1; // every third day in a row pays double
    save.ribbons = (save.ribbons || 0) + rib;
    dailyNews = '<div class="news">+' + rib + ' daily ribbon' + (rib > 1 ? 's' : '') + ' &middot; ' + D.streak + '-day streak' + (D.streak > 1 ? '!' : '') + '</div>';
  }
  if (daily) D.runs++;
  const prev = daily ? D.best || 0 : save.best[G.mode] || 0, isBest = G.score > prev && G.score > 0;
  G.newBest = isBest; if (isBest) { if (daily) D.best = G.score; else save.best[G.mode] = G.score; }
  const nb = bladeCheck(false) || G.newBlade;
  if (nb) dailyNews += '<div class="news">New blade: <b style="color:' + bladeCss(nb) + '">' + nb.name + '</b> (equipped)</div>';
  writeSave();
  const R = { hive: ['BUZZED!', 'You woke the bees.'], miss: ['THREE STRIKES', 'Too many got away.'], time: ['TIME!', 'The basket is full.'], zen: ['NICE AND EASY', 'A calm harvest.'] };
  const r = G.mode === 'zen' ? R.zen : daily && G.endReason === 'time' ? ['HARVEST IN!', 'Same orchard for everyone today.'] : (R[G.endReason] || ['GAME OVER', '']);
  const Q = isBest ? BEST_QUIPS : G.endReason === 'hive' ? BEE_QUIPS : G.endReason === 'miss' ? MISS_QUIPS : QUIPS;
  $('ovTitle').textContent = r[0]; $('ovWhy').textContent = r[1] + ' ' + pick(Q);
  $('ovCombo').textContent = G.bestCombo || 0; $('ovFruit').textContent = G.fr;
  $('ovHi').textContent = daily ? D.best : save.best[G.mode]; $('ovHiLbl').textContent = daily ? 'Today' : 'Best';
  const gap = prev - G.score + 1;
  $('ovBest').innerHTML = (isBest ? '<div class="newbest">' + (daily ? 'TODAY\'S BEST!' : 'NEW BEST!') + '</div>' : G.score === prev && prev > 0 ? '<div class="close">Tied your best! One more to beat it.</div>' : prev === 0 ? '<div class="close">Slice a fruit to set your first best!</div>' : '<div class="close">' + gap + ' more to beat ' + (daily ? 'today\'s best' : 'your best') + '</div>') + dailyNews;
  const acc = G.thrown >= 8 ? Math.min(1, G.picked / G.thrown) : null, grade = acc == null ? '' : acc >= .97 ? 'S' : acc >= .9 ? 'A' : acc >= .8 ? 'B' : acc >= .65 ? 'C' : 'D';
  G.acc = acc;
  $('ovGrade').innerHTML = grade ? '<b class="g' + grade + '">' + grade + '</b><span>' + Math.round(acc * 100) + '% picked</span>' : '';
  const more = []; if (G.bestStreak >= 3) more.push('hot streak ' + G.bestStreak); if (G.clean) more.push(G.clean + ' clean pick' + (G.clean > 1 ? 's' : '')); if (G.goldMax) more.push('golden apple x' + G.goldMax); if (G.fzBest) more.push(G.fzBest + ' fruit in a frenzy');
  $('ovMore').textContent = more.join('  \u00b7  ');
  $('ovGoals').innerHTML = goalsHTML(true);
  $('bShare').style.display = daily ? '' : 'none';
  G.shareText = 'Orchard Slice Daily Harvest, ' + dayLabel() + ': ' + G.score + ' points, ' + G.fruit + ' fruit, best combo ' + (G.bestCombo || 0) + 'x' + (D.streak > 1 ? ', ' + D.streak + '-day streak' : '') + '. Same orchard for everyone today. Can you beat it?' + (/^https?:/.test(location.href) ? ' ' + location.href.split(/[?#]/)[0] : '');
  const sEl = $('ovScore'); sEl.textContent = '0';
  const target = G.score, t0 = performance.now();
  (function cnt() { const u = clamp((performance.now() - t0) / 700, 0, 1); sEl.textContent = Math.round(target * easeOutCubic(u)); if (u < 1 && G.state === 'over') setTimeout(cnt, 16); else sEl.textContent = target; })();
  $('bAgain').disabled = true; $('bMenu').disabled = true;
  setTimeout(() => { $('bAgain').disabled = false; $('bMenu').disabled = false; }, 650);
  setScreen('over');
  if (isBest) { AUD.sfx.best(); vib([30, 40, 30, 40, 60]); } else if (G.endReason === 'time') AUD.sfx.timeup(); else AUD.sfx.over();
  if (manualMode) sEl.textContent = target;
}

/* ------------------------------------------------------------------ update (simulation) */
function update(dt) {
  G.t += dt;
  const playing = G.state === 'play', title = G.state === 'title';
  if (playing || title) {
    if (!(playing && G.ending)) runSpawner(dt);
    for (let i = pend.length - 1; i >= 0; i--) { const p = pend[i]; p.t -= dt; if (p.t <= 0) { pend.splice(i, 1); launch(p.type, p.o); } }
  }
  for (const it of items) {
    if (it.kind === 'gold' && !it.dead) {
      // the golden apple stops at the top of its arc and hangs there to be slashed
      if (!it.hung && it.vy >= -30) {
        it.hung = true; it.hang = 1.4; it.g0 = it.g; it.g = 0; it.vy = 0; it.vx *= .15; it.vr *= .4;
        if (playing && !save.seenGold) { save.seenGold = 1; writeSave(); popup(it.x, it.y - it.r - 70, 'SLASH IT AGAIN AND AGAIN!', '#ffe27a', 22, 1.8); }
      }
      if (it.hang > 0) {
        it.hang -= dt; it.hangT += dt; it.vy = Math.cos(it.age * 3.2) * 9;
        if (it.hangT > (it.hits ? 2.7 : 1.4)) it.hang = 0;
        if (it.hang <= 0) { if (it.hits > 0) burstGold(it); else { it.g = it.g0; it.vy = 20; } }
      }
      it.shk = Math.max(0, it.shk - dt * 7);
    }
    it.age += dt; it.vy += it.g * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
    if (!it.dead && it.vy > 0 && it.y - it.r > H) { it.dead = true; if (it.kind === 'fruit') onMiss(it); if (it.vid && G.vols[it.vid]) { G.vols[it.vid].lost = true; breakStreak(it); } }
    else if (!it.dead && (it.x < -120 || it.x > W + 120)) { it.dead = true; if (it.vid && G.vols[it.vid]) { G.vols[it.vid].lost = true; breakStreak(it); } }
  }
  items = items.filter(i => !i.dead);
  for (const h of halves) { h.age += dt; h.vy += h.g * dt; h.x += (h.vx + h.nx * h.sep) * dt; h.y += (h.vy + h.ny * h.sep) * dt; h.sep *= Math.exp(-7 * dt); h.a += h.vr * dt; }
  halves = halves.filter(h => h.y - h.r < H + 40);
  for (const b of bees) {
    b.age += dt; b.a += Math.sin(G.t * 9 + b.wob) * 5 * dt; b.flap += dt * 60;
    b.x += Math.cos(b.a) * b.sp * dt; b.y += Math.sin(b.a) * b.sp * dt; b.sp = lerp(b.sp, 110, dt * 0.8);
    if (b.x < 10 || b.x > W - 10) { b.a = Math.PI - b.a; b.x = clamp(b.x, 10, W - 10); }
    if (b.y < safeTop + 60 || b.y > H - 10) { b.a = -b.a; b.y = clamp(b.y, safeTop + 60, H - 10); }
  }
  bees = bees.filter(b => b.age < b.life);
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; if (p.vr) p.rot += p.vr * dt; if (p.drag) { const f = Math.exp(-5 * dt); p.vx *= f; p.vy *= f; } }
  parts = parts.filter(p => p.age < p.life);
  const pcap = Math.round(420 * quality); if (parts.length > pcap) parts.splice(0, parts.length - pcap);
  for (const p of popups) p.age += dt;
  popups = popups.filter(p => p.age < p.life);
  for (const s of splats) s.age += dt;
  splats = splats.filter(s => s.age < s.life);
  for (const m of motes) { m.x += m.vx * dt; m.y += m.vy * dt; m.ph += dt; if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; } if (m.x < -10) m.x = W + 10; if (m.x > W + 10) m.x = -10; }
  G.scoreBump = Math.max(0, G.scoreBump - dt * 3.2); G.multPop = Math.max(0, (G.multPop || 0) - dt * 2.5);
  for (let i = 0; i < 3; i++) G.missPop[i] = Math.max(0, G.missPop[i] - dt * 1.6);
  G.timeHit = Math.max(0, (G.timeHit || 0) - dt * 2);
  if (G.banner) { G.banner.age += dt; if (G.banner.age > G.banner.life) G.banner = null; }
  if (G.waveCall) { G.waveCall.age += dt; if (G.waveCall.age > G.waveCall.life) G.waveCall = null; }
  if (playing && inTutorial()) G.tutT = (G.tutT || 0) + dt;
  if (playing && !G.passedBest && G.best0 > 0 && G.score > G.best0 && !G.ending) { // you just beat your best: say so now, not only on the card
    G.passedBest = true; banner(G.mode === 'daily' ? "TODAY'S BEST!" : 'NEW BEST!', '#ffe27a', 'keep going!'); G.banner.high = true; AUD.sfx.goal(); vib([20, 30, 20]);
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; parts.push({ k: 'spark', x: 60, y: safeTop + 44, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, age: 0, life: .5, size: 14, col: '255,226,120', g: 0, drag: 1 }); }
  }
  if (playing) {
    if (!G.ending && G.mode !== 'classic') {
      if (!inTutorial()) G.timeLeft -= dt; // the first-ever 1-2-3 apple lesson doesn't use up the clock
      const sec = Math.ceil(G.timeLeft);
      if (sec <= 5 && sec > 0 && sec !== G.shownTick) { G.shownTick = sec; AUD.sfx.warn(); }
      if (G.timeLeft <= 0) { G.timeLeft = 0; banner('TIME!', '#ffe27a'); beginEnding('time', 1.0); }
    }
    if (G.ending) { G.endT -= dt; if (G.endT <= 0) showOver(); }
  }
  // finish combos whose stroke went quiet
  for (const p of pointers.values()) if (p.combo.n && G.t - p.combo.last > COMBO_GAP) p.combo.n = 0;
}

/* ------------------------------------------------------------------ input */
function toWorld(e) { return [e.clientX / K, e.clientY / K]; }
function newPtr() { return { pts: [], lx: 0, ly: 0, has: false, combo: { n: 0, last: -9 }, cp: null, down: true, acc: 0, lastWh: -9, fxT: 0, inGold: null }; }
function pDown(id, x, y) {
  AUD.unlock();
  let p = pointers.get(id);
  if (p) { dead.push(p); }
  p = newPtr(); pointers.set(id, p);
  p.pts.push({ x, y, t: RT }); p.lx = x; p.ly = y; p.has = true;
  slashSegment(p, x, y, x, y, true);
}
function pMove(id, x, y) {
  const p = pointers.get(id); if (!p) return;
  if (p.has && p.lx === x && p.ly === y) return;
  if (p.has) { slashSegment(p, p.lx, p.ly, x, y, false); p.acc += Math.hypot(x - p.lx, y - p.ly); }
  p.pts.push({ x, y, t: RT }); p.lx = x; p.ly = y; p.has = true;
}
function pUp(id) { const p = pointers.get(id); if (!p) return; p.down = false; dead.push(p); pointers.delete(id); }

cv.addEventListener('pointerdown', (e) => {
  if (G.state !== 'play' && G.state !== 'title') return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  const [x, y] = toWorld(e); pDown(e.pointerId, x, y); e.preventDefault();
});
cv.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
  if (list && list.length) for (const c of list) { const [x, y] = toWorld(c); pMove(e.pointerId, x, y); }
  else { const [x, y] = toWorld(e); pMove(e.pointerId, x, y); }
  e.preventDefault();
});
const endPtr = (e) => { if (pointers.has(e.pointerId)) { const [x, y] = toWorld(e); if (e.type === 'pointerup') pMove(e.pointerId, x, y); pUp(e.pointerId); } };
cv.addEventListener('pointerup', (e) => { AUD.unlock(); endPtr(e); }); cv.addEventListener('pointercancel', endPtr); cv.addEventListener('lostpointercapture', endPtr);
['contextmenu', 'gesturestart', 'dblclick', 'selectstart'].forEach(ev => document.addEventListener(ev, (e) => e.preventDefault()));
document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('touchstart', (e) => { if (e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });

/* ------------------------------------------------------------------ drawing */
/* World transform (zoom punch + shake) kept as numbers so sprites can be drawn with one setTransform each
   instead of save/translate/rotate/restore. */
let WS = 1, WOX = 0, WOY = 0;
function worldT() { ctx.setTransform(WS, 0, 0, WS, WOX, WOY); }
function sprite(key, x, y, rot, sx, sy) { // scale in screen axes, then rotate (squash/stretch stays vertical)
  const s = SP[key]; if (!s) return;
  if (sx == null) sx = sy = 1;
  const c = Math.cos(rot || 0), n = Math.sin(rot || 0);
  ctx.setTransform(WS * sx * c, WS * sy * n, -WS * sx * n, WS * sy * c, WOX + WS * x, WOY + WS * y);
  ctx.drawImage(s.cv, -s.half, -s.half, 2 * s.half, 2 * s.half); worldT();
}
function blitRS(img, x, y, rot, sx, sy, w, h) { // rotate, then scale along the rotated axes (stretch along velocity)
  const c = Math.cos(rot), n = Math.sin(rot);
  ctx.setTransform(WS * c * sx, WS * n * sx, -WS * n * sy, WS * c * sy, WOX + WS * x, WOY + WS * y);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
}
// shaded juice drops and seeds, one small canvas per colour
const dropSp = {}, seedSp = {};
function dropSprite(col) {
  let c = dropSp[col]; if (c) return c;
  c = dropSp[col] = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
  // a teardrop pointing back along its flight (sprites are drawn rotated to the velocity), deep colour, small wet glint
  g.fillStyle = col; g.beginPath(); g.moveTo(1, 16); g.quadraticCurveTo(14, 7, 22, 7); g.arc(22, 16, 9, -Math.PI / 2, Math.PI / 2); g.quadraticCurveTo(14, 25, 1, 16); g.fill();
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(70,0,20,.28)'; g.beginPath(); g.arc(24, 21, 9, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(23, 12, 3.2, 1.8, -.3, 0, TAU); g.fill();
  return c;
}
function seedSprite(col) {
  let c = seedSp[col]; if (c) return c;
  c = seedSp[col] = document.createElement('canvas'); c.width = 32; c.height = 20; const g = c.getContext('2d');
  g.fillStyle = col; g.beginPath(); g.moveTo(2, 10); g.quadraticCurveTo(10, 0, 30, 10); g.quadraticCurveTo(10, 20, 2, 10); g.fill();
  g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(14, 7, 7, 2, -.1, 0, TAU); g.fill();
  return c;
}
function glow(name, rgb, x, y, r, a) {
  const g = glowSp[name] || (glowSp[name] = makeGlow(rgb));
  ctx.globalAlpha = a; ctx.drawImage(g, x - r, y - r, 2 * r, 2 * r); ctx.globalAlpha = 1;
}
const FONT = '"Lilita One","Arial Rounded MT Bold","Trebuchet MS",system-ui,sans-serif';
/* Text is the most expensive thing to draw every frame (stroked web-font glyphs), so each distinct label is
   rendered once into a small canvas and then blitted. The cache is cleared when the web font finishes loading. */
const txtCache = new Map();
function txtSprite(s, size, fill, lw, stroke) {
  size = Math.round(size * 4) / 4;
  const key = s + '|' + size + '|' + fill + '|' + lw + '|' + stroke;
  let e = txtCache.get(key);
  if (e) { txtCache.delete(key); txtCache.set(key, e); return e; } // keep recently used at the end
  const px = Math.min(3.2, PK * 1.25), font = size + 'px ' + FONT, mc = txtSprite.mc || (txtSprite.mc = document.createElement('canvas').getContext('2d'));
  mc.font = font; const tw = mc.measureText(s).width, pad = lw + 4, w = tw + pad * 2, h = size * 1.35 + pad * 2;
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w * px)); c.height = Math.max(1, Math.ceil(h * px));
  const g = c.getContext('2d'); g.scale(px, px); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  if (lw > 0) { g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(s, w / 2, h / 2); }
  g.fillStyle = fill; g.fillText(s, w / 2, h / 2);
  e = { c, w, h, tw };
  txtCache.set(key, e);
  if (txtCache.size > 90) txtCache.delete(txtCache.keys().next().value);
  return e;
}
function txt(s, x, y, size, fill, align, lw, stroke) {
  lw = lw == null ? Math.max(3, size * .2) : lw;
  const e = txtSprite(String(s), size, fill, lw, stroke || 'rgba(36,14,40,.85)');
  const x0 = align === 'left' ? x - (e.w - e.tw) / 2 : align === 'right' ? x - e.w + (e.w - e.tw) / 2 : x - e.w / 2;
  ctx.drawImage(e.c, x0, y - e.h / 2, e.w, e.h);
}
const mwCache = new Map();
function measure(s, size) { const k = size + '|' + s; let w = mwCache.get(k); if (w == null) { const mc = txtSprite.mc || (txtSprite.mc = document.createElement('canvas').getContext('2d')); mc.font = size + 'px ' + FONT; w = mc.measureText(s).width; if (mwCache.size > 200) mwCache.clear(); mwCache.set(k, w); } return w; }
try { if (document.fonts) document.fonts.addEventListener('loadingdone', () => { txtCache.clear(); mwCache.clear(); }); } catch (e) {}
function drawBee(b) {
  const s = 1.25;
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
  const fl = .35 + .65 * Math.abs(Math.sin(b.flap));
  ctx.fillStyle = 'rgba(235,248,255,.8)';
  ctx.beginPath(); ctx.ellipse(-1 * s, -4.5 * s, 4.5 * s, 3 * s * fl, -.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-1 * s, 4.5 * s, 4.5 * s, 3 * s * fl, .5, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f7c52b'; ctx.beginPath(); ctx.ellipse(0, 0, 6.5 * s, 4 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1608'; ctx.fillRect(-3 * s, -3.8 * s, 1.8 * s, 7.6 * s); ctx.fillRect(0.2 * s, -3.8 * s, 1.8 * s, 7.6 * s);
  ctx.beginPath(); ctx.arc(6 * s, 0, 2.4 * s, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-6 * s, 0); ctx.lineTo(-8.5 * s, 0); ctx.strokeStyle = '#2a1608'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.restore();
}
function drawItem(it) {
  const spd = Math.abs(it.vy) / (H * 1.1), st = 1 + clamp(spd, 0, 1) * .06, pop = it.age < .16 ? 1 + .14 * Math.sin(it.age / .16 * Math.PI) : 1;
  const x = it.x, y = it.y;
  glow('shade', '24,8,40', x, y, it.r * 1.8, .48);
  if (it.kind === 'hive') {
    glow('shade', '24,8,40', x, y, it.r * 1.7, .55);
    glow('red', '255,70,50', x, y, it.r * 2.1, .48 + .16 * Math.sin(G.t * 7));
    sprite(it.type, x, y, Math.sin(G.t * 3.2 + it.seedBee) * .22, pop / st, pop * st);
    for (let i = 0; i < 3; i++) { const a = G.t * 4.5 + i * 2.1 + it.seedBee, bx = x + Math.cos(a) * it.r * 1.25, by = y + Math.sin(a * 1.3) * it.r * .75 - it.r * .1; drawBee({ x: bx, y: by, a: a + Math.PI / 2, flap: G.t * 60 + i }); }
    return;
  }
  if (it.kind === 'gold') {
    const sh = it.shk * 5, ox = sh ? rr(-sh, sh) : 0, oy = sh ? rr(-sh, sh) : 0, sq = 1 + it.shk * .12;
    glow('gold', '255,190,70', x, y, it.r * (2.6 + it.shk * .6), .7 + .2 * Math.sin(G.t * 9));
    if (it.hits > 0 && it.hang > 0) { // countdown ring while it hangs
      const f = clamp(1 - it.hangT / 2.7, 0, 1);
      ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(40,16,40,.55)'; ctx.beginPath(); ctx.arc(x, y, it.r + 16, 0, TAU); ctx.stroke();
      glow('gold', '255,190,70', x + Math.cos(-Math.PI / 2 + TAU * f) * (it.r + 16), y + Math.sin(-Math.PI / 2 + TAU * f) * (it.r + 16), 18, .9);
      ctx.lineWidth = 5; ctx.strokeStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(x, y, it.r + 16, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.stroke();
    }
    sprite('golden', x + ox, y + oy, it.rot, pop * sq, pop / sq);
    if (it.hits > 1) txt('x' + it.hits, x, y - it.r - 30, 24 + Math.min(it.hits, 12), '#ffe27a', 'center', 5, 'rgba(110,30,10,.95)');
    return;
  }
  if (it.frenzy) glow('gold', '255,190,70', x, y, it.r * 2, .42);
  if (it.kind === 'maple') glow('gold', '255,190,70', x, y, it.r * 2.3, .55 + .2 * Math.sin(G.t * 8));
  else if (it.kind === 'donut') glow('gold', '255,190,70', x, y, it.r * 2.5, .65 + .2 * Math.sin(G.t * 8));
  sprite(it.type, x, y, it.rot, pop / st, pop * st);
}
function drawHalf(h) {
  const s = SP[h.key]; if (!s) return;
  const wh = SP[h.whole], pad = Math.max(h.r * 1.6, (wh ? wh.half : s.half) * 1.45), sc = h.age < .14 ? 1.1 - .1 * (h.age / .14) : 1;
  ctx.save(); ctx.translate(h.x, h.y); ctx.scale(sc, sc); ctx.rotate(h.a);
  ctx.beginPath(); if (h.side > 0) ctx.rect(-pad, 0, 2 * pad, pad); else ctx.rect(-pad, -pad, 2 * pad, pad); ctx.clip();
  // wet, bright cut face along the cut line
  ctx.rotate(h.rot0);
  // the whole fruit underneath (its stem and leaf stay on the top half), the cut face over it: same fit, so they line up
  if (wh) ctx.drawImage(wh.cv, -wh.half, -wh.half, 2 * wh.half, 2 * wh.half);
  ctx.drawImage(s.cv, -s.half, -s.half, 2 * s.half, 2 * s.half);
  if (h.age < .06) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - h.age / .06) * .32; ctx.drawImage(s.cv, -s.half, -s.half, 2 * s.half, 2 * s.half); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  ctx.rotate(-h.rot0);
  if (h.ew) { ctx.fillStyle = 'rgba(255,255,240,.45)'; ctx.fillRect(-h.ew, h.side > 0 ? 0 : -2.4, 2 * h.ew, 2.4); }
  ctx.restore();
}
function drawSplat(s) {
  const u = s.age / s.life, grow = easeOutBack(clamp(s.age / .14, 0, 1)), fade = u < .45 ? 1 : 1 - easeOutCubic((u - .45) / .55);
  const k = grow * (.9 + .15 * u), dripT = easeOutCubic(clamp((s.age - .1) / .9, 0, 1)), c = s.cv;
  const hh = s.top + s.body + s.drip * dripT; // reveal the drips as they run down
  ctx.globalAlpha = .42 * fade;
  ctx.setTransform(WS * k, 0, 0, WS * k, WOX + WS * s.x, WOY + WS * s.y);
  ctx.drawImage(c, 0, 0, c.width, Math.max(1, hh * s.ps), -s.half, -s.top, 2 * s.half, hh);
  worldT(); ctx.globalAlpha = 1;
}
// A juice stain is painted once into its own canvas (soft-edged pool, satellite drops, drips) and blitted every frame.
function makeSplat(sp) {
  const sr = sp.r, ps = Math.min(2.2, PK), half = sr * 1.5, top = sr * 1.45, body = sr * 1.45, drip = sr * 1.6;
  const c = document.createElement('canvas'); c.width = Math.ceil(2 * half * ps); c.height = Math.ceil((top + body + drip) * ps);
  const g = c.getContext('2d'); g.scale(ps, ps); g.translate(half, top);
  const gr = g.createRadialGradient(-sr * .15, -sr * .2, sr * .05, 0, 0, sr * 1.1);
  gr.addColorStop(0, sp.col); gr.addColorStop(1, sp.col);
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, sr * .62, 0, TAU); g.fill();
  for (const b of sp.blobs) { g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); }
  for (const d of sp.drips) { g.beginPath(); g.moveTo(d.x - d.w * 1.4, sr * .3); g.quadraticCurveTo(d.x - d.w * .4, d.len * .6, d.x - d.w * .5, d.len); g.arc(d.x, d.len, d.w * .55, Math.PI, 0, true); g.quadraticCurveTo(d.x + d.w * .4, d.len * .6, d.x + d.w * 1.4, sr * .3); g.closePath(); g.fill(); }
  for (const d of sp.dots) { g.beginPath(); g.arc(d.x, d.y, d.r, 0, TAU); g.fill(); }
  // darker rim where the juice pools, and a wet highlight
  g.globalCompositeOperation = 'source-atop'; g.strokeStyle = 'rgba(70,0,20,.35)'; g.lineWidth = sr * .1; g.beginPath(); g.arc(0, 0, sr * .8, 0, TAU); g.stroke();
  g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-sr * .22, -sr * .24, sr * .2, sr * .09, -.5, 0, TAU); g.fill();
  Object.assign(sp, { cv: c, ps, half, top, body, drip });
}
function drawParts() {
  for (const p of parts) {
    const u = p.age / p.life;
    if (p.k === 'drop') {
      ctx.globalAlpha = u < .6 ? 1 : 1 - (u - .6) / .4;
      const sp = Math.hypot(p.vx, p.vy), st = clamp(sp / 600, 0, .7), a = Math.atan2(p.vy, p.vx), d = 2.2 * p.size;
      blitRS(dropSprite(p.col), p.x, p.y, a, 1 + st, 1 - st * .3, d, d); worldT();
    } else if (p.k === 'ring') {
      ctx.globalAlpha = (1 - u) * .85 * (p.a || 1); ctx.strokeStyle = 'rgba(' + p.col + ',1)'; ctx.lineWidth = 5 * (1 - u) + 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * .5 * easeOutCubic(u), 0, TAU); ctx.stroke();
    } else if (p.k === 'spark') {
      glow(p.col ? 's' + p.col : 'white', p.col || '255,246,220', p.x, p.y, p.size * (1 - u * .5), 1 - u);
    } else if (p.k === 'cut') {
      const e = easeOutCubic(clamp(u * 1.8, 0, 1)), L = p.size * (.55 + .45 * e), w = 5 * (1 - u) + .5;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - u) * .7; ctx.fillStyle = 'rgba(255,220,140,1)'; ctx.beginPath(); ctx.ellipse(0, 0, L / 2, w * 2.4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1 - u; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, L / 2, w * .7, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (p.k === 'mist') {
      glow('j' + p.col, p.col, p.x, p.y, p.size * (.5 + .45 * easeOutCubic(u)), .28 * (1 - u));
    } else if (p.k === 'seed') {
      ctx.globalAlpha = u < .7 ? 1 : 1 - (u - .7) / .3;
      blitRS(seedSprite(p.col), p.x, p.y, p.rot, 1, 1, p.size * 2.4, p.size * 1.5); worldT();
    } else if (p.k === 'leaf') {
      ctx.globalAlpha = u < .7 ? 1 : 1 - (u - .7) / .3; sprite('maple', p.x, p.y, p.rot, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
}
/* ---- blade trails: tapered ribbons built from a Catmull-Rom curve through the pointer samples */
const TL = 0.19; // seconds a blade sample lives
function smoothPts(pts) {
  const n = pts.length; if (n < 2) return pts.slice();
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const segs = Math.min(6, Math.max(1, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 14)));
    for (let k = 0; k < segs; k++) {
      const t = k / segs, t2 = t * t, t3 = t2 * t;
      out.push({ x: .5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: .5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3), t: lerp(p1.t, p2.t, t) });
    }
  }
  out.push(pts[n - 1]); return out;
}
function ribbon(sp, wmax, now) {
  const n = sp.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const age = clamp((now - sp[i].t) / TL, 0, 1), head = i > n - 3 ? .75 + .25 * (n - 1 - i) / 2 : 1;
    const w = wmax * Math.pow(1 - age, 1.15) * head;
    L.push([sp[i].x - dy * w, sp[i].y + dx * w]); R.push([sp[i].x + dy * w, sp[i].y - dx * w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath();
}
function drawTrail(p, combo) {
  const pts = p.pts;
  while (pts.length && RT - pts[0].t > TL) pts.shift();
  if (!pts.length) return;
  const bl = curBlade(), hot = combo >= 5 ? 2 : combo >= 3 ? 1 : 0;
  const glowC = bl.rainbow ? hsvRgb((RT * 240) % 360) : bl.glow, midC = bl.rainbow ? hsvRgb((RT * 240 + 60) % 360) : bl.mid;
  if (pts.length === 1) { glow('h' + bl.head, bl.head, pts[0].x, pts[0].y, 22, .6 * (1 - (RT - pts[0].t) / TL)); return; }
  const sp = smoothPts(pts);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // combos make the blade wider and hotter
  ribbon(sp, 12 + hot * 3, RT); ctx.fillStyle = 'rgba(' + glowC + ',' + (.2 + hot * .08) + ')'; ctx.fill();
  ribbon(sp, 7 + hot, RT); ctx.fillStyle = 'rgba(' + midC + ',' + (.48 + hot * .1) + ')'; ctx.fill();
  ctx.restore();
  ribbon(sp, 3.6, RT); ctx.fillStyle = 'rgba(' + bl.core + ',.96)'; ctx.fill();
  const hd = sp[sp.length - 1];
  glow('h' + bl.head, bl.head, hd.x, hd.y, 17 + hot * 4, .85);
}
function drawHand(x, y) { // a white pointing hand, fingertip at (x, y)
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.35); ctx.scale(1.3, 1.3);
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-6, -2, 12, 34, 6); // index finger
  ctx.roundRect(-16, 22, 34, 34, 11); // palm
  ctx.roundRect(4, 20, 9, 18, 4.5); ctx.roundRect(11, 22, 9, 16, 4.5); // curled fingers
  ctx.roundRect(-22, 26, 10, 20, 5); // thumb
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(60,20,50,.75)'; ctx.stroke();
  ctx.restore();
}
function drawGhosts() {
  for (const g of ghosts) {
    const u = (G.t - g.t0) / g.dur; if (u < -0.15 || u > 1.5) continue;
    const e = clamp(u, 0, 1), ee = e * e * (3 - 2 * e);
    const pos = (q) => { const t = clamp(q, 0, 1), tt = t * t * (3 - 2 * t); return [lerp(g.x0, g.x1, tt), lerp(g.y0, g.y1, tt) - Math.sin(tt * Math.PI) * 14]; };
    const a = u < 0 ? 1 + u / .15 : u > 1 ? Math.max(0, 1 - (u - 1) / .5) : 1;
    ctx.save(); ctx.globalAlpha = a * .9;
    const pts = []; for (let k = 0; k <= 8; k++) { const q = pos(e - k * .028); pts.push({ x: q[0], y: q[1], t: RT - k * (TL / 9) }); }
    pts.reverse(); if (e > 0.02) { const sp = smoothPts(pts); ctx.globalCompositeOperation = 'lighter'; ribbon(sp, 9, RT); ctx.fillStyle = 'rgba(255,224,150,.4)'; ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ribbon(sp, 3, RT); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill(); }
    const f = pos(e);
    drawHand(f[0], f[1]);
    ctx.restore();
  }
}
// frenzy: slow golden god-rays turning behind the fruit (one cached texture, drawn rotated)
let rayTex = null;
function drawFrenzyRays() {
  if (!rayTex) {
    rayTex = document.createElement('canvas'); rayTex.width = rayTex.height = 512; const g = rayTex.getContext('2d'); g.translate(256, 256);
    g.filter = 'blur(6px)';
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, w = .07; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 250, a - w, a + w); g.closePath();
      const gr = g.createRadialGradient(0, 0, 10, 0, 0, 250); gr.addColorStop(0, 'rgba(255,226,140,.85)'); gr.addColorStop(.6, 'rgba(255,196,80,.3)'); gr.addColorStop(1, 'rgba(255,180,60,0)'); g.fillStyle = gr; g.fill(); }
    g.filter = 'none';
  }
  const f = clamp(G.frenzy / .4, 0, 1) * clamp((5.2 - G.frenzy) / .3, 0, 1), R = Math.max(W, H) * 1.05, c = Math.cos(G.t * .35), n = Math.sin(G.t * .35);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .11 * f;
  ctx.setTransform(WS * c, WS * n, -WS * n, WS * c, WOX + WS * W * .5, WOY + WS * H * .42);
  ctx.drawImage(rayTex, -R, -R, 2 * R, 2 * R);
  worldT(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
// a live combo counter that rides the blade while a chain is building
function drawLiveCombos() {
  for (const p of pointers.values()) {
    const cb = p.combo; if (cb.n < 2 || G.t - cb.last > COMBO_GAP || !p.has) continue;
    if (cb.shown !== cb.n) { cb.shown = cb.n; cb.popAt = RT; }
    const e = clamp((RT - cb.popAt) / .18, 0, 1), sc = 1 + .5 * (1 - easeOutBack(e)), sz = 20 + Math.min(cb.n, 10) * 2.5;
    const hw = (measure(cb.n + 'x', sz) / 2 + 6) * 1.5, x = clamp(p.lx + 34, hw + 4, W - hw - 4), y = clamp(p.ly - 44, safeTop + 90, H - 30); // fits even at its pop scale
    ctx.setTransform(WS * sc, 0, 0, WS * sc, WOX + WS * x, WOY + WS * y);
    txt(cb.n + 'x', 0, 0, sz, cb.n >= 5 ? '#ff9ad0' : cb.n >= 3 ? '#ffe27a' : '#fff6d8', 'center', 5, 'rgba(110,30,10,.95)');
    worldT();
  }
}
function drawPopups() {
  for (const p of popups) {
    const u = p.age / p.life;
    if (p.kind === 'combo') {
      p.pop = Math.min(1, p.pop + 0.09);
      const sc = .55 + .45 * easeOutBack(p.pop), a = u < .75 ? 1 : 1 - (u - .75) / .25;
      let big = 32 + Math.min(p.n, 8) * 3;
      let tw = measure(p.word, big) + big * .4; if (tw > W - 28) { big *= (W - 28) / tw; tw = W - 28; }
      const hw = Math.max(tw, 230) / 2 * sc, cx = clamp(p.x, hw + 10, W - hw - 10); // keep the whole word on screen
      ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, p.y - u * 24); ctx.scale(sc, sc); ctx.rotate(-.04);
      txt(p.word, 0, 0, big, '#ffe27a', 'center', big * .2, 'rgba(110,30,10,.95)');
      txt(p.n + 'x COMBO  +' + p.tot, 0, big * .78, 22, '#fff6d8', 'center', 5);
      ctx.restore();
    } else {
      const a = u < .6 ? 1 : 1 - (u - .6) / .4, sc = .6 + .4 * easeOutBack(clamp(p.age / .2, 0, 1));
      ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y - easeOutCubic(u) * 46); ctx.scale(sc, sc);
      txt(p.text, 0, 0, p.size, p.color, 'center'); ctx.restore();
    }
  }
}
function drawHUD() {
  if (G.state === 'title') return;
  const top = safeTop + 10, m = G.mode, lx = safeL / K;
  // score
  const sc = 1 + .28 * G.scoreBump * G.scoreBump;
  ctx.save(); ctx.translate(16 + lx, top + 34); ctx.scale(sc, sc);
  txt(String(G.score), 0, 0, 46, '#fff6d8', 'left', 7); ctx.restore();
  if (G.passedBest) txt(m === 'daily' ? "TODAY'S BEST!" : 'NEW BEST!', 17 + lx, top + 67, 17, '#ffe27a', 'left', 4.5);
  else txt(m === 'daily' ? 'TODAY ' + (save.daily.date === dayKey() ? save.daily.best : 0) : 'BEST ' + (save.best[m] || 0), 17 + lx, top + 67, 17, '#f7c98a', 'left', 4.5);
  if (m === 'classic') {
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 40 + 6, y = top + 24, lost = i < G.misses, pop = G.missPop[i];
      ctx.save(); ctx.translate(x, y); const s = 1 + .5 * pop; ctx.scale(s, s);
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.fillStyle = lost ? 'rgba(90,10,20,.7)' : 'rgba(20,8,40,.5)'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = lost ? '#ff5a4a' : 'rgba(255,214,120,.55)'; ctx.stroke();
      const sp = SP['apple_icon']; if (sp) { ctx.globalAlpha = lost ? .28 : 1; ctx.drawImage(sp.cv, -17, -17, 34, 34); ctx.globalAlpha = 1; }
      if (lost) { ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, 10); ctx.moveTo(10, -10); ctx.lineTo(-10, 10); ctx.stroke(); }
      ctx.restore();
    }
    txt('WAVE ' + G.wave, W / 2 + 6, top + 58, 14, '#f7c98a', 'center', 4);
  } else {
    const tl = Math.ceil(G.timeLeft), low = G.timeLeft <= 10, mm = Math.floor(tl / 60), ss = tl % 60;
    const lab = mm + ':' + (ss < 10 ? '0' : '') + ss, pulse = low ? 1 + .06 * Math.sin(G.t * 10) : 1;
    ctx.save(); ctx.translate(W / 2 + 6, top + 26); ctx.scale(pulse * (1 + .25 * G.timeHit), pulse * (1 + .25 * G.timeHit));
    txt(lab, 0, 0, 42, low ? '#ff7a6a' : G.timeHit > 0 ? '#ff7a6a' : '#fff6d8', 'center', 7); ctx.restore();
    const bw = 104, frac = clamp(G.timeLeft / (timedLike(m) ? 60 : 90), 0, 1), bx = W / 2 + 6 - bw / 2, by = top + 54;
    ctx.fillStyle = 'rgba(20,8,40,.6)'; ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, bw + 4, 12, 6); ctx.fill();
    ctx.fillStyle = low ? '#ff6a5a' : '#ffc94a'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(8, bw * frac), 8, 4); ctx.fill();
  }
  if (G.mult > 1) {
    const y = top + (G.frenzy > 0 ? 122 : 92), s2 = 1 + .35 * G.multPop * G.multPop, hot = G.mult >= 3;
    ctx.save(); ctx.translate(16 + lx + 36, y); ctx.scale(s2, s2);
    ctx.fillStyle = hot ? 'rgba(120,20,70,.85)' : 'rgba(110,40,10,.85)'; ctx.beginPath(); ctx.roundRect(-36, -13, 72, 26, 13); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = hot ? '#ff9ad0' : '#ffb347'; ctx.stroke();
    txt('HOT x' + G.mult, 0, 1, 17, hot ? '#ffd0ea' : '#ffe0a8', 'center', 3.5); ctx.restore();
  }
  if (G.frenzy > 0) {
    const y = top + 88, w = 120, f = clamp(G.frenzy / 5.2, 0, 1), px = W / 2 + 6;
    ctx.fillStyle = 'rgba(20,8,40,.75)'; ctx.beginPath(); ctx.roundRect(px - w / 2, y - 14, w, 28, 14); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,226,140,.9)'; ctx.stroke();
    const fg = ctx.createLinearGradient(0, y - 11, 0, y + 11); fg.addColorStop(0, '#ffd75c'); fg.addColorStop(1, '#ff8a1e');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(px - w / 2 + 3, y - 11, Math.max(10, (w - 6) * f), 22, 11); ctx.fill();
    txt('FRENZY x2', px, y + 1, 18, '#ffffff', 'center', 4.5, 'rgba(70,24,0,.95)');
  }
}
function drawBanner() {
  const wc = G.waveCall;
  if (wc) {
    const u = wc.age / wc.life, a = u < .75 ? 1 : 1 - (u - .75) / .25, sc = easeOutBack(clamp(wc.age / .25, 0, 1)), y = safeTop + (G.mode === 'classic' ? 100 : 92) + (G.frenzy > 0 ? 30 : 0);
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2 + 6, y); ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(36,18,60,.85)'; ctx.beginPath(); ctx.roundRect(-58, -15, 116, 30, 15); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,120,.8)'; ctx.stroke();
    txt(wc.text, 0, 1, 20, '#ffe27a', 'center', 4); ctx.restore();
  }
  const b = G.banner; if (!b) return;
  const u = b.age / b.life, sc = easeOutBack(clamp(b.age / .3, 0, 1)), a = u < .7 ? 1 : 1 - (u - .7) / .3;
  const by = b.high ? safeTop + 150 : H * .3, fmax = b.high ? 40 : 62;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, by); ctx.scale(sc, sc); ctx.rotate(-.05);
  const fs = Math.min(fmax, 62 * (W - 40) / (measure(b.text, 62) + 24));
  txt(b.text, 0, 0, fs, b.color, 'center', fs * .19, 'rgba(60,16,30,.92)');
  if (b.sub) txt(b.sub, 0, b.high ? 34 : 44, b.high ? 18 : 20, '#fff6d8', 'center', 5);
  ctx.restore();
}
function drawHints() {
  if (G.state !== 'play' || !inTutorial() || G.ending) return;
  const a = .6 + .4 * Math.sin(G.t * 4);
  const msg = G.tutHits < 1 ? ('ontouchstart' in window ? 'Swipe' : 'Click and drag') + ' across the fruit!' : 'Get them all in ONE swipe!';
  ctx.save(); ctx.globalAlpha = a; txt(msg, W / 2, H * .74, 26, '#fff', 'center', 6); ctx.restore();
}

function render() {
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  if (!SKIP.bg) ctx.drawImage(bg, 0, 0, W, H);
  // drifting pollen and dust in the golden light
  ctx.globalCompositeOperation = 'lighter';
  if (!SKIP.motes) for (const m of motes) { const a = (.25 + .2 * Math.sin(m.ph * 1.7)) * m.s; glow('mote', '255,226,150', m.x, m.y, 5 * m.s + 2, a); }
  ctx.globalCompositeOperation = 'source-over';
  const kx = cv.width / W, z = 1 + punch * punch * .055;
  const shx = shake > .05 ? (Math.random() - .5) * shake * 2 : 0, shy = shake > .05 ? (Math.random() - .5) * shake * 2 : 0;
  WS = kx * z; WOX = kx * (W / 2 * (1 - z) + shx); WOY = kx * (H * .45 * (1 - z) + shy); worldT();
  if (G.frenzy > 0 && !SKIP.fz) drawFrenzyRays();
  if (!SKIP.splats) for (const s of splats) drawSplat(s);
  if (!SKIP.halves) for (const h of halves) drawHalf(h);
  if (!SKIP.items) for (const it of items) drawItem(it);
  if (!SKIP.bees) for (const b of bees) drawBee(b);
  if (!SKIP.parts) drawParts();
  drawGhosts();
  // blades
  for (const p of pointers.values()) drawTrail(p, p.combo.n);
  for (let i = dead.length - 1; i >= 0; i--) { drawTrail(dead[i], 0); if (!dead[i].pts.length) dead.splice(i, 1); }
  if (!SKIP.popups) { drawPopups(); drawLiveCombos(); }
  ctx.setTransform(kx, 0, 0, cv.height / H, 0, 0);
  // frenzy glow around the screen edge
  if (G.frenzy > 0 && !SKIP.fz) {
    const a = .5 + .25 * Math.sin(G.t * 9);
    if (!fzGrad) { fzGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .4, W / 2, H / 2, Math.max(W, H) * .75); fzGrad.addColorStop(0, 'rgba(255,190,60,0)'); fzGrad.addColorStop(1, 'rgba(255,170,40,1)'); }
    ctx.globalAlpha = .45 * a; ctx.fillStyle = fzGrad; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  if (redFlash > 0) { ctx.fillStyle = 'rgba(255,40,30,' + (redFlash * .45) + ')'; ctx.fillRect(0, 0, W, H); }
  if (flash.a > .01) { ctx.fillStyle = 'rgba(' + flash.r + ',' + flash.g + ',' + flash.b + ',' + flash.a + ')'; ctx.fillRect(0, 0, W, H); }
  if (!SKIP.hud) { drawHUD(); drawBanner(); drawHints(); drawGoalToast(); }
  if (dbg) { ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#0f0'; ctx.fillText(fpsAvg.toFixed(0) + 'fps i' + items.length + ' h' + halves.length + ' p' + parts.length, 8, H - 8); }
}

/* ------------------------------------------------------------------ main loop */
const dbg = /[?&]debug/.test(location.search), SKIP = {}; // SKIP: perf test hook (__T.skip)
function tick(rdt, doRender) {
  RT += rdt;
  let sd = rdt;
  if (hitstop > 0) { hitstop -= rdt; sd = 0; }
  else if (slowT > 0) { const k = clamp(slowT / SLOW_DUR, 0, 1); sd *= 1 - .68 * k * k; slowT -= rdt; }
  if (G.state === 'play' || G.state === 'title' || G.state === 'over') {
    let rem = Math.min(sd, 0.1);
    while (rem > 1e-6) { const s = Math.min(rem, 1 / 60); update(s); rem -= s; }
  }
  // blade: whoosh on fast strokes, and the equipped blade's sparkles
  if (G.state === 'play' || G.state === 'title') {
    const bl = curBlade();
    for (const p of pointers.values()) {
      const spd = p.acc / Math.max(rdt, 1 / 120); p.acc = 0;
      if (spd > 1100 && RT - p.lastWh > 0.2) { p.lastWh = RT; AUD.sfx.whoosh(spd); }
      if (bl.fx && spd > 450 && p.has) { p.fxT -= rdt; if (p.fxT <= 0) { p.fxT = 0.035 / quality; bladeFx(bl, p.lx, p.ly); } }
    }
  }
  AUD.intensity(G.state === 'play' && !G.ending ? (G.frenzy > 0 ? 2 : 1) : 0);
  const wordsUp = popups.some(o => o.kind === 'combo' && o.age < .8) || (G.banner && !G.banner.high && G.banner.age < 1.1);
  if (goalQ[0] && G.state !== 'pause' && !(G.frenzy > 0 && G.state === 'play') && !(wordsUp && goalQ[0].age === 0)) { goalQ[0].age += rdt; if (goalQ[0].age > goalQ[0].life) goalQ.shift(); }
  punch = Math.max(0, punch - rdt * 3.2); flash.a = Math.max(0, flash.a - rdt * 2.6); shake = Math.max(0, shake - rdt * 28); redFlash = Math.max(0, redFlash - rdt * 1.6);
  if (doRender !== false) render();
}
let lastTs = 0, qLow = 0, qHigh = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000)); lastTs = ts;
  fpsAvg = lerp(fpsAvg, 1 / rdt, .05);
  // adaptive quality: if a phone can't hold the frame rate in a busy moment, spawn fewer particles
  if (!manualMode && G.state === 'play') {
    if (fpsAvg < 47) { qLow += rdt; qHigh = 0; if (qLow > 0.8) { quality = Math.max(.45, quality - .15); qLow = 0; } }
    else if (fpsAvg > 56) { qHigh += rdt; qLow = 0; if (qHigh > 4) { quality = Math.min(1, quality + .1); qHigh = 0; } }
  }
  if (manualMode) { render(); return; }
  tick(rdt);
}

/* ------------------------------------------------------------------ DOM glue */
const screens = { title: $('title'), pause: $('pause'), over: $('over'), blades: $('blades') };
let curScreen = null;
function setScreen(name) {
  curScreen = name;
  for (const k in screens) {
    const el = screens[k];
    if (k === name) { el.classList.add('show'); requestAnimationFrame(() => requestAnimationFrame(() => { if (curScreen === k) el.classList.add('in'); })); }
    else { el.classList.remove('in'); if (manualMode) el.classList.remove('show'); else setTimeout(() => { if (curScreen !== k) el.classList.remove('show'); }, 300); }
  }
}
function refreshBest() {
  $('b-classic').textContent = save.best.classic; $('b-timed').textContent = save.best.timed; $('b-zen').textContent = save.best.zen;
  document.querySelectorAll('[data-tog]').forEach(b => b.classList.toggle('off', !(b.dataset.tog === 'sfx' ? save.sfx : save.music)));
  $('hint').textContent = ('ontouchstart' in window) ? 'Swipe the fruit!' : 'Click and drag across the fruit!'; $('hint').style.visibility = save.plays > 0 ? 'hidden' : '';
  $('tGoals').innerHTML = goalsHTML(false);
  const D = save.daily, played = D.date === dayKey(), db = $('d-best');
  db.innerHTML = played ? 'TODAY<b>' + D.best + '</b>' + (D.streak > 1 ? '<small>' + D.streak + '-day streak</small>' : '') : (D.streak > 0 && D.date === dayKey(new Date(Date.now() - 864e5)) ? '<small>keep your</small><b>' + D.streak + '</b><small>day streak</small>' : 'NEW<b>&#9733;</b>');
  const streakOn = D.date === dayKey(new Date(Date.now() - 864e5)), nextDay = streakOn ? D.streak + 1 : 1;
  $('d-sub').innerHTML = played ? 'Played today. Beat your score!' : nextDay % 3 === 0 ? 'Day ' + nextDay + ' streak: <b>double ribbons!</b>' : 'Same orchard for everyone &middot; +1 ribbon';
  document.querySelector('.mode.daily').classList.toggle('done', played);
  const bl = curBlade(), dot = $('bladeDot'); dot.classList.toggle('on', bl.id !== 'sun'); dot.style.background = bladeSwatch(bl);
}
function renderBlades() {
  const cur = curBlade();
  $('bladeList').innerHTML = BLADES.map(b => { const un = bladeUnlocked(b);
    return '<button class="bl' + (b.id === cur.id ? ' on' : '') + (un ? '' : ' lock') + '" data-blade="' + b.id + '"' + (un ? '' : ' aria-disabled="true"') + '><span class="sw" style="background:' + bladeSwatch(b) + '"></span><span class="nm">' + b.name + '</span><span class="st">' + (b.id === cur.id ? 'EQUIPPED' : un ? 'TAP TO USE' : '&#128274; ' + b.need) + '</span></button>'; }).join('');
  document.querySelectorAll('#bladeList .bl').forEach(el => el.addEventListener('click', () => {
    const b = bladeById(el.dataset.blade); AUD.unlock();
    prevBlade = b; AUD.sfx.whoosh(1800);
    if (!bladeUnlocked(b)) { const st = el.querySelector('.st'); st.textContent = (b.need - (save.ribbons || 0)) + ' to go'; el.classList.add('peek'); setTimeout(() => el.classList.remove('peek'), 1100); return; }
    save.blade = b.id; writeSave(); AUD.sfx.click(); renderBlades(); refreshBest();
  }));
}
let bladesOpen = false, prevBlade = null; // the blade picker sits over the title screen (G.state stays 'title')
// animated preview of a blade's trail at the top of the picker
function bladePreview(ts) {
  if (!bladesOpen) return; requestAnimationFrame(bladePreview);
  const c = $('bladePrev'), dpr = Math.min(2, window.devicePixelRatio || 1), cw = c.clientWidth, ch = c.clientHeight;
  if (!cw) return;
  if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
  const g = c.getContext('2d'), b = prevBlade || curBlade(), t = ts / 1000, ph = (t * .9) % 1.6;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
  g.font = '800 13px Nunito, system-ui, sans-serif'; g.textAlign = 'left'; g.fillStyle = 'rgba(255,243,214,.8)';
  if (ph > 1) { g.fillText(b.name + (bladeUnlocked(b) ? '' : '  (locked)'), 12, 18); return; } // a short pause between swipes
  const N = 26, pts = [];
  for (let i = 0; i < N; i++) { const u = clamp(ph * 1.6 - (N - 1 - i) * .022, 0, 1), x = 14 + u * (cw - 28), y = ch * .62 - Math.sin(u * Math.PI) * ch * .38 + (u - .5) * ch * .2; pts.push([x, y, i / (N - 1)]); }
  const col = (k) => b.rainbow ? hsvRgb((t * 240 + k * 60) % 360) : k ? b.mid : b.glow;
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  [[16, col(0), .25], [9, col(1), .55], [3.5, b.core, .95]].forEach(L => {
    for (let i = 1; i < N; i++) { const w = L[0] * Math.pow(pts[i][2], 1.2); if (w < .3) continue; g.strokeStyle = 'rgba(' + L[1] + ',' + L[2] + ')'; g.lineWidth = w; g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke(); }
  });
  const hd = pts[N - 1], gr = g.createRadialGradient(hd[0], hd[1], 0, hd[0], hd[1], 16); gr.addColorStop(0, 'rgba(' + b.head + ',.9)'); gr.addColorStop(1, 'rgba(' + b.head + ',0)'); g.fillStyle = gr; g.fillRect(hd[0] - 16, hd[1] - 16, 32, 32);
  g.globalCompositeOperation = 'source-over';
  g.font = '800 13px Nunito, system-ui, sans-serif'; g.textAlign = 'left'; g.fillStyle = 'rgba(255,243,214,.8)'; g.fillText(b.name + (bladeUnlocked(b) ? '' : '  (locked)'), 12, 18);
}
// one free goal swap a day, so a goal you don't like never blocks the next blade
document.getElementById('tGoals').addEventListener('click', (e) => {
  const b = e.target.closest('[data-swap]'); if (!b || G.state !== 'title' || save.swapDay === dayKey()) return;
  const i = +b.dataset.swap; if (!save.goals[i] || save.goals[i].done) return;
  AUD.unlock(); AUD.sfx.click();
  const old = save.goals[i]; save.goals.splice(i, 1); const ng = dealGoal(); save.goals.splice(i, 0, ng);
  if (ng.k === old.k && ng.n === old.n) { save.goals[i] = dealGoal(); }
  save.swapDay = dayKey(); writeSave(); refreshBest();
});
function openBlades() { if (G.state !== 'title' || bladesOpen) return; AUD.unlock(); AUD.sfx.click(); prevBlade = null; renderBlades(); bladesOpen = true; setScreen('blades'); requestAnimationFrame(bladePreview); }
function closeBlades() { if (!bladesOpen) return; bladesOpen = false; AUD.sfx.click(); if (G.state === 'title') setScreen('title'); refreshBest(); }
document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => startGame(b.dataset.mode)));
document.querySelectorAll('[data-tog]').forEach(b => b.addEventListener('click', () => {
  AUD.unlock();
  if (b.dataset.tog === 'sfx') { save.sfx = !save.sfx; AUD.setSfx(save.sfx); } else { save.music = !save.music; AUD.setMusic(save.music); }
  writeSave(); refreshBest(); if (save.sfx) AUD.sfx.click();
}));
$('bBlades').addEventListener('click', openBlades); $('bBladesDone').addEventListener('click', closeBlades);
// A swipe that happens to start on the pause button becomes a blade once it moves (a tap still pauses).
let pbSwipe = null;
$('pauseBtn').addEventListener('pointerdown', (e) => { if (G.state === 'play') { const [x, y] = toWorld(e); pbSwipe = { id: e.pointerId, x, y, live: false }; } });
window.addEventListener('pointermove', (e) => {
  const sw = pbSwipe; if (!sw || sw.id !== e.pointerId) return;
  const [x, y] = toWorld(e);
  if (!sw.live && Math.hypot(x - sw.x, y - sw.y) > 14 && G.state === 'play') { sw.live = true; pDown(e.pointerId, sw.x, sw.y); }
  if (sw.live) pMove(e.pointerId, x, y);
});
const pbEnd = (e) => { const sw = pbSwipe; if (!sw || sw.id !== e.pointerId) return; if (sw.live) { pUp(e.pointerId); sw.swallowClick = true; setTimeout(() => { pbSwipe = null; }, 0); } else pbSwipe = null; };
window.addEventListener('pointerup', pbEnd); window.addEventListener('pointercancel', pbEnd);
$('pauseBtn').addEventListener('click', () => { if (pbSwipe && pbSwipe.swallowClick) { pbSwipe = null; return; } AUD.unlock(); AUD.sfx.click(); pauseGame(); });
$('bResume').addEventListener('click', () => { AUD.unlock(); AUD.sfx.click(); resumeGame(); });
$('bRestart').addEventListener('click', () => { startGame(G.mode); });
$('bQuit').addEventListener('click', () => { AUD.sfx.click(); AUD.duck(false); toTitle(); });
$('bAgain').addEventListener('click', () => startGame(G.mode)); // startGame unlocks audio
$('bShare').addEventListener('click', async () => {
  AUD.sfx.click(); const t = G.shareText || '', b = $('bShare');
  try { if (navigator.share) { await navigator.share({ text: t }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(t); b.textContent = 'Copied!'; } catch (e) { b.textContent = 'Copy failed'; }
  setTimeout(() => { b.textContent = 'Share'; }, 1600);
});
$('bMenu').addEventListener('click', () => { AUD.sfx.click(); toTitle(); });
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key;
  if ((k === 'Enter' || k === ' ') && e.target && e.target.tagName === 'BUTTON') return;
  if (k === 'm' || k === 'M') { save.sfx = !save.sfx; save.music = save.sfx; AUD.setSfx(save.sfx); AUD.setMusic(save.music); writeSave(); refreshBest(); return; }
  if (bladesOpen) { if (k === 'Escape' || k === 'Enter' || k === ' ' || k === 'b' || k === 'B') { closeBlades(); e.preventDefault(); } return; }
  if (G.state === 'title') { if (k === '1' || k === 'Enter' || k === ' ') { startGame('classic'); e.preventDefault(); } else if (k === '2') startGame('timed'); else if (k === '3') startGame('zen'); else if (k === '4') startGame('daily'); else if (k === 'b' || k === 'B') openBlades(); }
  else if (G.state === 'play') { if (k === 'p' || k === 'P' || k === 'Escape') pauseGame(); }
  else if (G.state === 'pause') { if (k === 'p' || k === 'P' || k === 'Escape' || k === 'Enter' || k === ' ') { resumeGame(); e.preventDefault(); } else if (k === 'r' || k === 'R') startGame(G.mode); }
  else if (G.state === 'over') { if (!$('bAgain').disabled && (k === 'Enter' || k === ' ' || k === 'r' || k === 'R')) { startGame(G.mode); e.preventDefault(); } else if (!$('bMenu').disabled && k === 'Escape') toTitle(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseGame(); AUD.suspend(); } else { AUD.resume(); lastTs = performance.now(); }
});
window.addEventListener('blur', () => { pauseGame(); });
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => layout(false), 120); });
window.addEventListener('orientationchange', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => layout(false), 250); });

/* ------------------------------------------------------------------ test hooks */
let swipeSeq = 0;
function stepSim(sec) { let rem = sec; while (rem > 1e-6) { const s = Math.min(rem, 1 / 60); tick(s, false); rem -= s; } render(); }
function snap() {
  return {
    screen: G.state, mode: G.mode, score: G.score, misses: G.misses, timeLeft: +G.timeLeft.toFixed(2), wave: G.wave, t: +G.t.toFixed(2), fruit: G.fruit, bestCombo: G.bestCombo,
    frenzy: +G.frenzy.toFixed(2), ending: G.ending, endReason: G.endReason, newBest: G.newBest, best: Object.assign({}, save.best), hitstop: +hitstop.toFixed(3),
    items: items.filter(i => !i.dead).map(i => ({ type: i.type, kind: i.kind, x: +i.x.toFixed(1), y: +i.y.toFixed(1), vx: +i.vx.toFixed(1), vy: +i.vy.toFixed(1), r: i.r, hitR: i.hitR })),
    halves: halves.length, bees: bees.length, parts: parts.length, splats: splats.length, popups: popups.length, pointers: pointers.size, world: { W, H, K, DPR }, fps: +fpsAvg.toFixed(1), tutorial: !save.tut, sliceLog: sliceLog.slice(), quality, blade: curBlade().id, ribbons: save.ribbons, goldMax: G.goldMax || 0, music: AUD.musicInfo, art: ART.loadInfo
  };
}
window.__T = {
  start(mode, o) { o = o || {}; if (o.seed != null) { seedState = o.seed >>> 0; seedNext = o.seed >>> 0; } if (o.notut !== false) save.tut = 1; if (o.manual) manualMode = true; startGame(mode || 'classic', true); if (o.noSpawn) G.next = 1e9; return snap(); },
  step(ms) { stepSim((ms || 16) / 1000); return snap(); },
  state: snap,
  manual(v) { manualMode = !!v; return manualMode; },
  seed(n) { seedState = n >>> 0; },
  spawn(type, x, y, vx, vy, o) { o = o || {}; const d = DEF[type], it = { type, kind: d.kind, r: d.r, hitR: d.hitR, x, y, vx: vx || 0, vy: vy || 0, g: o.g != null ? o.g : H * 1.25, rot: o.rot || 0, vr: o.vr || 0, age: 1, dead: false, frenzy: !!o.frenzy, tUp: 1, ax: x, apexY: y, seedBee: 0, hits: 0, hang: o.hung ? 1.4 : 0, hangT: 0, shk: 0, hung: !!o.hung, g0: H * 1.25, vid: o.vid || 0 }; items.push(it); return it; },
  clear() { items = []; pend = []; halves = []; parts = []; popups = []; splats = []; bees = []; },
  noSpawn(v) { G.next = v === false ? 0.2 : 1e9; },
  swipe(path, o) {
    o = o || {}; const id = o.id != null ? o.id : 1000 + (swipeSeq++), dur = (o.ms || 220) / 1000, n = path.length, before = { s: G.score, f: G.fruit };
    const result = () => ({ score: G.score - before.s, fruit: G.fruit - before.f, bestCombo: G.bestCombo, log: sliceLog.slice() });
    if (manualMode || o.sync) {
      for (let i = 0; i < n; i++) { if (i === 0) pDown(id, path[i][0], path[i][1]); else pMove(id, path[i][0], path[i][1]); if (i < n - 1) stepSim(dur / (n - 1)); }
      pUp(id); return result();
    }
    return new Promise((res) => {
      let i = 0; const gap = dur / Math.max(1, n - 1) * 1000;
      (function next() { if (i === 0) pDown(id, path[0][0], path[0][1]); else pMove(id, path[i][0], path[i][1]); i++; if (i < n) setTimeout(next, gap); else { pUp(id); res(result()); } })();
    });
  },
  // begin / move / end a finger by hand (multi-touch tests)
  down: (id, x, y) => pDown(id, x, y), move: (id, x, y) => pMove(id, x, y), up: (id) => pUp(id),
  pause() { pauseGame(); return G.state; }, resume() { resumeGame(); return G.state; }, title() { toTitle(); return G.state; },
  hit(mode) { return window.__T.start(mode || 'classic'); },
  stress(n) { for (let i = 0; i < n; i++) launch(pick(APPLES.concat(['pear', 'pumpkin', 'hive', 'maple'])), { g: .5 }); for (let i = 0; i < n * 3; i++) parts.push({ k: 'drop', x: rr(0, W), y: rr(0, H), vx: rr(-100, 100), vy: rr(-100, 100), age: 0, life: 3, size: 4, col: '#f44', g: 100 }); return snap(); },
  world() { return { W, H, K, DPR, PK, safeTop }; },
  fps() { return fpsAvg; },
  skip(o) { for (const k in SKIP) delete SKIP[k]; Object.assign(SKIP, o || {}); return SKIP; },
  layout(force) { layout(!!force); return window.__T.world(); },
  frenzy() { startFrenzy({ x: W / 2, y: H / 2 }); },
  save() { return JSON.parse(JSON.stringify(save)); },
  resetSave() { save = { best: { classic: 0, timed: 0, zen: 0 }, sfx: true, music: true, tut: 0, plays: 0, lastMode: 'classic', goals: [], ribbons: 0, blade: 'sun', daily: { date: '', best: 0, streak: 0, last: '', runs: 0 }, seenGold: 0 }; ensureGoals(); writeSave(); refreshBest(); },
  setScore(n) { G.score = n; },
  over() { G.endReason = G.endReason || 'time'; showOver(); return G.state; },
  popup(text) { popup(W / 2, H / 2, text, '#fff', 30); },
  selfTest() { // slice-reliability checks: returns [{name, pass, got}] and leaves the game on the title screen
    const out = [], was = manualMode, keep = JSON.stringify({ g: save.goals, r: save.ribbons, b: save.best, t: save.tut, p: save.plays, bl: save.blade, bs: save.bladesSeen || [], sg: save.seenGold }); manualMode = true;
    const fresh = () => { window.__T.start('zen', { seed: 1, noSpawn: true, manual: true }); window.__T.clear(); };
    const chk = (name, got, want) => out.push({ name, pass: got === want, got, want });
    fresh(); window.__T.spawn('apple_red', 195, 400, 0, 0, { g: 0 });
    chk('slow swipe (1.2 s, 4 samples)', window.__T.swipe([[120, 440], [160, 420], [200, 400], [260, 370]], { ms: 1200 }).fruit, 1);
    fresh(); window.__T.spawn('apple_red', 195, 300, 0, 0, { g: 0 });
    chk('huge jump (one 390px segment in 16 ms)', window.__T.swipe([[0, 300], [390, 300]], { ms: 16 }).fruit, 1);
    fresh(); window.__T.spawn('apple_red', 195, 300, 0, 0, { g: 0 });
    chk('pass 45px away misses', window.__T.swipe([[0, 345], [390, 345]], { ms: 100 }).fruit, 0);
    fresh(); window.__T.spawn('apple_red', 195, 300, 0, 0, { g: 0 });
    chk('pass 32px away hits (generous)', window.__T.swipe([[0, 332], [390, 332]], { ms: 100 }).fruit, 1);
    fresh(); ['apple_green', 'pear', 'apple_gold', 'apple_blush'].forEach((t, i) => window.__T.spawn(t, 80 + i * 75, 400, 0, 0, { g: 0 }));
    const c = window.__T.swipe([[20, 400], [370, 400]], { ms: 40 }); chk('fast combo of 4 counts 4', c.bestCombo, 4); chk('fast combo score (4 fruit + bonus 8)', c.score, 12);
    fresh(); window.__T.spawn('apple_red', 100, 300, 0, 0, { g: 0 }); window.__T.spawn('pear', 290, 500, 0, 0, { g: 0 });
    window.__T.down(1, 60, 320); window.__T.down(2, 330, 480); window.__T.move(1, 100, 300); window.__T.move(2, 290, 500);
    chk('two fingers slice one each', window.__T.state().fruit, 2); window.__T.up(1); window.__T.up(2);
    fresh(); window.__T.spawn('apple_red', 195, 400, 0, 0, { g: 0 });
    window.__T.down(7, 100, 400); window.__T.step(600); window.__T.move(7, 300, 400);
    chk('finger held still 0.6 s, then swipes', window.__T.state().fruit, 1); window.__T.up(7);
    fresh(); window.__T.spawn('hive', 195, 400, 0, 0, { g: 0 }); const sc0 = window.__T.state().score;
    window.__T.swipe([[150, 400], [250, 400]], { ms: 30 }); chk('hive in zen still slices (no penalty there)', window.__T.state().screen, 'play');
    // goals: a 3x-combo goal completes mid-game and earns a ribbon
    fresh(); const rib0 = save.ribbons || 0; window.__T.setGoals([{ k: 'combo', n: 3 }, { k: 'pumpkin', n: 99 }, { k: 'maple', n: 99 }]);
    ['apple_green', 'pear', 'apple_gold'].forEach((t, i) => window.__T.spawn(t, 100 + i * 90, 400, 0, 0, { g: 0 }));
    window.__T.swipe([[40, 400], [350, 400]], { ms: 40 }); chk('combo goal completes, +1 ribbon', save.goals[0].done && save.ribbons === rib0 + 1, true);
    fresh(); chk('finished goal is replaced at next start', save.goals.length === 3 && save.goals.every(g => !g.done), true);
    // frenzy doubles fruit points
    fresh(); window.__T.frenzy(); window.__T.clear(); window.__T.spawn('apple_red', 195, 400, 0, 0, { g: 0 });
    chk('frenzy fruit worth 2', window.__T.swipe([[120, 420], [270, 380]], { ms: 60 }).score, 2);
    // golden apple: every re-entry of the blade is a hit
    fresh(); window.__T.spawn('golden', 195, 420, 0, 0, { g: 0, hung: true });
    for (let i = 0; i < 5; i++) { window.__T.swipe([[120, 380 + (i % 2) * 80], [270, 460 - (i % 2) * 80]], { ms: 50 }); window.__T.step(60); }
    chk('golden apple counts 5 hits from 5 swipes', G.goldMax, 5);
    fresh(); window.__T.spawn('golden', 195, 420, 0, 0, { g: 0, hung: true }); window.__T.step(100); window.__T.step(3000);
    chk('untouched golden apple falls, no miss', items.length === 0 && G.misses === 0, true);
    // a ribbon that reaches a blade's price unlocks and equips it
    fresh(); save.ribbons = 2; save.bladesSeen = []; window.__T.setGoals([{ k: 'combo', n: 3 }, { k: 'pumpkin', n: 99 }, { k: 'maple', n: 99 }]);
    ['apple_green', 'pear', 'apple_gold'].forEach((t, i) => window.__T.spawn(t, 100 + i * 90, 400, 0, 0, { g: 0 }));
    window.__T.swipe([[40, 400], [350, 400]], { ms: 40 }); chk('3rd ribbon unlocks + equips Hot Cider', save.ribbons === 3 && curBlade().id === 'cider', true);
    // clean pick: every fruit of a 3-fruit throw sliced -> +3 bonus on top of the combo
    fresh(); G.vols[99] = { n: 3, cut: 0, lost: false };
    ['apple_green', 'pear', 'apple_gold'].forEach((t, i) => window.__T.spawn(t, 100 + i * 90, 400, 0, 0, { g: 0, vid: 99 }));
    const cpk = window.__T.swipe([[40, 400], [350, 400]], { ms: 40 }); chk('clean pick of 3 = 3 fruit + combo 3 + clean 3', cpk.score === 9 && G.clean === 1, true);
    // three clean picks in a row -> hot streak x2: the next lone apple is worth 2
    fresh(); for (let k = 0; k < 3; k++) { G.vols[200 + k] = { n: 3, cut: 0, lost: false }; ['apple_green', 'pear', 'apple_gold'].forEach((t, i) => window.__T.spawn(t, 100 + i * 90, 300 + k * 120, 0, 0, { g: 0, vid: 200 + k })); window.__T.swipe([[40, 300 + k * 120], [350, 300 + k * 120]], { ms: 40 }); window.__T.step(500); }
    window.__T.spawn('apple_red', 195, 700, 0, 0, { g: 0 }); chk('hot streak x2 after 3 clean picks', G.mult === 2 && window.__T.swipe([[150, 690], [240, 710]], { ms: 40 }).score === 2, true);
    // the Daily Harvest throws the same orchard every time today
    const firstThrows = () => { window.__T.start('daily', { manual: true }); window.__T.step(4000); return items.map(i => i.type + Math.round(i.x)).join(','); };
    const d1 = firstThrows(), d2 = firstThrows(); chk('daily harvest is identical twice', d1 === d2 && d1.length > 0, true);
    const k = JSON.parse(keep); save.goals = k.g; save.ribbons = k.r; save.best = k.b; save.tut = k.t; save.plays = k.p; save.blade = k.bl; save.bladesSeen = k.bs; save.seenGold = k.sg; writeSave(); // leave the player's save as it was
    manualMode = was; window.__T.title(); return out;
  },
  goals() { return { goals: JSON.parse(JSON.stringify(save.goals)), ribbons: save.ribbons }; },
  setGoals(list) { save.goals = list.map(g => Object.assign({ p: 0, done: false }, g)); writeSave(); refreshBest(); return save.goals; },
  comboFx(n) { const p = newPtr(); comboPopup(p, { x: W / 2, y: H / 2 }, n); }
};

/* ------------------------------------------------------------------ boot */
ensureGoals(); writeSave();
layout(true);
// painted art: code-drawn sprites show at once; the paintings swap in together when they have all loaded
ART.load(() => { SP = ART.build(Math.min(PK, 5)); spPK = PK; bg = ART.makeBackground(W, H, PK); });
refreshBest();
toTitle();
try { if (document.fonts && document.fonts.load) { document.fonts.load('40px "Lilita One"'); } } catch (e) {}
requestAnimationFrame((ts) => { lastTs = ts; frame(ts); });
})();
