'use strict';
/* Orchard Slice art: every sprite is code-drawn into an offscreen canvas, via the ASSETS map.
   To swap in painted art later, set `png` on an entry (e.g. png:'assets/apple_red.png'); the PNG must be a square image
   covering 2*half logical units (half = ceil(r*1.35)), centered on the fruit. The code-drawn art stays as the fallback. */
if (!CanvasRenderingContext2D.prototype.roundRect) { // iOS < 16
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(Array.isArray(r) ? r[0] : (r || 0), w / 2, h / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}
const ART = (() => {
  const TAU = Math.PI * 2;
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  function lg(c, x0, y0, x1, y1, st) { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach(s => g.addColorStop(s[0], s[1])); return g; }
  function rg(c, x0, y0, r0, x1, y1, r1, st) { const g = c.createRadialGradient(x0, y0, r0, x1, y1, r1); st.forEach(s => g.addColorStop(s[0], s[1])); return g; }
  function ell(c, x, y, rx, ry, rot, fill) { c.save(); c.translate(x, y); c.rotate(rot || 0); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fillStyle = fill; c.fill(); c.restore(); }
  function lerpHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t), g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t), bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* ---------------- apples ---------------- */
  function applePath(c, R) {
    c.beginPath(); c.moveTo(0, -.74 * R);
    c.bezierCurveTo(.28 * R, -1.02 * R, 1.0 * R, -.98 * R, 1.0 * R, -.1 * R);
    c.bezierCurveTo(1.0 * R, .58 * R, .58 * R, 1.02 * R, .14 * R, .96 * R);
    c.quadraticCurveTo(0, .88 * R, -.14 * R, .96 * R);
    c.bezierCurveTo(-.58 * R, 1.02 * R, -1.0 * R, .58 * R, -1.0 * R, -.1 * R);
    c.bezierCurveTo(-1.0 * R, -.98 * R, -.28 * R, -1.02 * R, 0, -.74 * R); c.closePath();
  }
  function fillAll(c, R, style) { c.fillStyle = style; c.fillRect(-1.5 * R, -1.5 * R, 3 * R, 3 * R); }
  function stemLeaf(c, R, tilt) {
    c.lineCap = 'round';
    c.strokeStyle = '#3f2410'; c.lineWidth = .12 * R; c.beginPath(); c.moveTo(0, -.6 * R); c.quadraticCurveTo(.02 * R, -.95 * R, .15 * R, -1.18 * R); c.stroke();
    c.strokeStyle = '#8d5f33'; c.lineWidth = .05 * R; c.beginPath(); c.moveTo(-.01 * R, -.62 * R); c.quadraticCurveTo(.0, -.95 * R, .12 * R, -1.16 * R); c.stroke();
    c.save(); c.translate(.07 * R, -.98 * R); c.rotate(tilt == null ? -.35 : tilt);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(.2 * R, -.38 * R, .62 * R, -.4 * R, .84 * R, -.1 * R); c.bezierCurveTo(.6 * R, .17 * R, .24 * R, .2 * R, 0, 0); c.closePath();
    c.fillStyle = lg(c, 0, -.3 * R, .8 * R, .1 * R, [[0, '#9be05a'], [.6, '#4fa233'], [1, '#2c6e22']]); c.fill();
    c.lineWidth = .05 * R; c.strokeStyle = '#1f4a18'; c.lineJoin = 'round'; c.stroke();
    c.strokeStyle = 'rgba(220,255,170,.65)'; c.lineWidth = .03 * R; c.beginPath(); c.moveTo(.04 * R, 0); c.quadraticCurveTo(.4 * R, -.12 * R, .74 * R, -.1 * R); c.stroke();
    c.restore();
  }
  const APPLES = {
    red: { hi: '#ff7a68', base: '#d9302f', dark: '#8d1426', line: 'rgba(48,6,16,.85)', flesh: '#fff7e0', fleshEdge: '#f1dfae', ov(c, R) {
      c.lineCap = 'round';
      for (let i = -5; i <= 5; i++) { c.strokeStyle = 'rgba(80,0,24,' + (.12 + .1 * (i & 1 ? 1 : 0)) + ')'; c.lineWidth = R * (.07 + .03 * ((i + 5) % 3)); const x = i * .19 * R; c.beginPath(); c.moveTo(x * .55, -.8 * R); c.quadraticCurveTo(x * 1.3, 0, x * .85, .98 * R); c.stroke(); }
      c.strokeStyle = 'rgba(255,170,120,.25)'; c.lineWidth = R * .05; for (let i = -3; i <= 3; i++) { const x = i * .26 * R + .06 * R; c.beginPath(); c.moveTo(x * .6, -.7 * R); c.quadraticCurveTo(x * 1.2, .1 * R, x * .8, .9 * R); c.stroke(); }
    } },
    green: { hi: '#ecf79a', base: '#9ccf3f', dark: '#5a8c1c', line: 'rgba(24,52,8,.85)', flesh: '#f7fadb', fleshEdge: '#dfe8a8', ov(c, R) {
      const r = rng(5); c.fillStyle = 'rgba(255,255,220,.45)';
      for (let i = 0; i < 40; i++) { const a = r() * TAU, d = Math.sqrt(r()) * .95 * R; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d + .05 * R, R * (.015 + .02 * r()), 0, TAU); c.fill(); }
      c.fillStyle = rg(c, .55 * R, .35 * R, 0, .55 * R, .35 * R, .6 * R, [[0, 'rgba(255,200,90,.38)'], [1, 'rgba(255,200,90,0)']]); fillAll(c, R, c.fillStyle);
    } },
    gold: { hi: '#fff4a8', base: '#f3c533', dark: '#c27d12', line: 'rgba(80,38,4,.85)', flesh: '#fff6cf', fleshEdge: '#efd98f', ov(c, R) {
      c.fillStyle = rg(c, .5 * R, .1 * R, 0, .5 * R, .1 * R, .85 * R, [[0, 'rgba(235,84,40,.6)'], [1, 'rgba(235,84,40,0)']]); fillAll(c, R, c.fillStyle);
      const r = rng(11); c.fillStyle = 'rgba(120,70,20,.35)';
      for (let i = 0; i < 26; i++) { const a = r() * TAU, d = Math.sqrt(r()) * .9 * R; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, R * .018, 0, TAU); c.fill(); }
    } },
    blush: { hi: '#ffb2c4', base: '#e7567c', dark: '#a02148', line: 'rgba(60,6,30,.85)', flesh: '#fff3ea', fleshEdge: '#f1d6c4', ov(c, R) {
      c.fillStyle = rg(c, -.55 * R, .2 * R, 0, -.55 * R, .2 * R, .8 * R, [[0, 'rgba(250,230,120,.7)'], [1, 'rgba(250,230,120,0)']]); fillAll(c, R, c.fillStyle);
      c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = R * .05;
      for (let i = -4; i <= 4; i++) { const x = i * .21 * R; c.beginPath(); c.moveTo(x * .5, -.8 * R); c.quadraticCurveTo(x * 1.25, 0, x * .8, .95 * R); c.stroke(); }
    } },
    golden: { hi: '#fffbd0', base: '#ffcf33', dark: '#c27a0a', line: 'rgba(96,48,0,.9)', flesh: '#fff8d8', fleshEdge: '#f6d878', ov(c, R) {
      // polished gold: a bright band of reflected sky and a warm bounce light
      c.fillStyle = lg(c, -R, -.2 * R, R, .2 * R, [[0, 'rgba(255,255,255,0)'], [.42, 'rgba(255,255,240,.0)'], [.5, 'rgba(255,255,240,.55)'], [.58, 'rgba(255,255,240,0)'], [1, 'rgba(255,255,255,0)']]); fillAll(c, R, c.fillStyle);
      c.fillStyle = rg(c, .45 * R, .55 * R, 0, .45 * R, .55 * R, .7 * R, [[0, 'rgba(255,120,40,.45)'], [1, 'rgba(255,120,40,0)']]); fillAll(c, R, c.fillStyle);
    } }
  };
  function sparkle(c, x, y, s) { c.save(); c.translate(x, y); c.fillStyle = '#fffbe6'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i & 1 ? s * .22 : s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.restore(); }
  function drawApple(c, R, p) {
    applePath(c, R);
    c.fillStyle = rg(c, -.35 * R, -.4 * R, .05 * R, -.1 * R, -.05 * R, 1.35 * R, [[0, p.hi], [.3, p.base], [.9, p.dark], [1, p.dark]]); c.fill();
    c.save(); applePath(c, R); c.clip();
    p.ov(c, R);
    fillAll(c, R, rg(c, 0, -.72 * R, 0, 0, -.72 * R, .36 * R, [[0, 'rgba(0,0,0,.4)'], [1, 'rgba(0,0,0,0)']]));
    fillAll(c, R, lg(c, 0, .1 * R, 0, 1.05 * R, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(25,0,15,.38)']]));
    fillAll(c, R, lg(c, .15 * R, 0, 1.05 * R, 0, [[0, 'rgba(255,190,90,0)'], [1, 'rgba(255,190,90,.4)']]));
    c.restore();
    c.save(); c.translate(-.42 * R, -.42 * R); c.rotate(-.75); ell(c, 0, 0, .2 * R, .1 * R, 0, 'rgba(255,255,255,.6)'); c.restore();
    ell(c, -.2 * R, -.64 * R, .045 * R, .045 * R, 0, 'rgba(255,255,255,.8)');
    applePath(c, R); c.lineWidth = .075 * R; c.strokeStyle = p.line; c.lineJoin = 'round'; c.stroke();
    stemLeaf(c, R);
  }
  function drawAppleCut(c, R, p) {
    applePath(c, R); c.fillStyle = p.base; c.fill(); c.lineWidth = .075 * R; c.strokeStyle = p.line; c.lineJoin = 'round'; c.stroke();
    c.save(); c.translate(0, .015 * R); c.scale(.89, .89); applePath(c, R);
    c.fillStyle = rg(c, -.1 * R, -.15 * R, .05 * R, 0, 0, 1.05 * R, [[0, '#fffdf0'], [.55, p.flesh], [1, p.fleshEdge]]); c.fill();
    c.lineWidth = .05 * R; c.strokeStyle = 'rgba(190,150,70,.4)'; c.stroke(); c.restore();
    // stem channel
    c.strokeStyle = 'rgba(120,84,44,.55)'; c.lineWidth = .045 * R; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -.72 * R); c.lineTo(0, -.44 * R); c.stroke();
    // core
    c.beginPath(); c.moveTo(0, -.46 * R); c.bezierCurveTo(.24 * R, -.4 * R, .27 * R, -.05 * R, .17 * R, .1 * R); c.bezierCurveTo(.27 * R, .3 * R, .22 * R, .52 * R, 0, .58 * R);
    c.bezierCurveTo(-.22 * R, .52 * R, -.27 * R, .3 * R, -.17 * R, .1 * R); c.bezierCurveTo(-.27 * R, -.05 * R, -.24 * R, -.4 * R, 0, -.46 * R); c.closePath();
    c.fillStyle = lg(c, -.2 * R, 0, .2 * R, 0, [[0, '#ecdfa4'], [.5, '#f6eebf'], [1, '#e2d08c']]); c.fill(); c.lineWidth = .035 * R; c.strokeStyle = '#b39651'; c.stroke();
    // seed chambers: a soft five-point star in the core, with brown teardrop seeds tipped toward the stem
    c.save(); c.translate(0, .06 * R); c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i & 1 ? .07 : .2) * R; c.lineTo(Math.cos(a) * r * .9, Math.sin(a) * r * 1.25); }
    c.closePath(); c.fillStyle = 'rgba(214,190,110,.55)'; c.fill(); c.restore();
    [[-.075, -.02, -.45, 1], [.08, .13, .5, .9]].forEach(sd => {
      c.save(); c.translate(sd[0] * R, sd[1] * R); c.rotate(sd[2]); c.scale(sd[3], sd[3]);
      c.beginPath(); c.moveTo(0, -.12 * R); c.quadraticCurveTo(.07 * R, .02 * R, 0, .08 * R); c.quadraticCurveTo(-.07 * R, .02 * R, 0, -.12 * R);
      c.fillStyle = lg(c, -.06 * R, 0, .06 * R, 0, [[0, '#7a4418'], [.6, '#5a2e10'], [1, '#3a1c08']]); c.fill(); c.restore();
    });
    // juicy sheen
    c.save(); c.translate(-.5 * R, -.32 * R); c.rotate(-.9); ell(c, 0, 0, .17 * R, .06 * R, 0, 'rgba(255,255,255,.6)'); c.restore();
    c.fillStyle = 'rgba(255,255,255,.55)'; [[.45, .2, .03], [.52, -.22, .025], [-.4, .5, .025], [.3, .55, .02]].forEach(d => { c.beginPath(); c.arc(d[0] * R, d[1] * R, d[2] * R, 0, TAU); c.fill(); });
  }

  /* ---------------- pear ---------------- */
  function pearPath(c, R) {
    c.beginPath(); c.moveTo(0, -1.06 * R);
    c.bezierCurveTo(.3 * R, -1.06 * R, .42 * R, -.6 * R, .5 * R, -.3 * R);
    c.bezierCurveTo(.58 * R, -.05 * R, 1.0 * R, .1 * R, 1.0 * R, .58 * R);
    c.bezierCurveTo(1.0 * R, 1.0 * R, .55 * R, 1.08 * R, 0, 1.08 * R);
    c.bezierCurveTo(-.55 * R, 1.08 * R, -1.0 * R, 1.0 * R, -1.0 * R, .58 * R);
    c.bezierCurveTo(-1.0 * R, .1 * R, -.58 * R, -.05 * R, -.5 * R, -.3 * R);
    c.bezierCurveTo(-.42 * R, -.6 * R, -.3 * R, -1.06 * R, 0, -1.06 * R); c.closePath();
  }
  function drawPear(c, R) {
    pearPath(c, R);
    c.fillStyle = rg(c, -.35 * R, -.1 * R, .05 * R, -.05 * R, .3 * R, 1.35 * R, [[0, '#f6f7a0'], [.3, '#cdda55'], [.85, '#8ea62a'], [1, '#6f8820']]); c.fill();
    c.save(); pearPath(c, R); c.clip();
    const r = rng(23); c.fillStyle = 'rgba(120,80,30,.4)';
    for (let i = 0; i < 38; i++) { const a = r() * TAU, d = Math.sqrt(r()) * .95 * R; c.beginPath(); c.arc(Math.cos(a) * d * .85, Math.sin(a) * d * 1.05, R * (.014 + .018 * r()), 0, TAU); c.fill(); }
    fillAll(c, R, rg(c, .55 * R, .5 * R, 0, .55 * R, .5 * R, .7 * R, [[0, 'rgba(240,130,60,.45)'], [1, 'rgba(240,130,60,0)']]));
    fillAll(c, R, lg(c, 0, .2 * R, 0, 1.1 * R, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,30,0,.35)']]));
    fillAll(c, R, lg(c, .2 * R, 0, 1.0 * R, 0, [[0, 'rgba(255,190,90,0)'], [1, 'rgba(255,190,90,.38)']]));
    c.restore();
    c.save(); c.translate(-.4 * R, .3 * R); c.rotate(-1.0); ell(c, 0, 0, .22 * R, .09 * R, 0, 'rgba(255,255,255,.5)'); c.restore();
    ell(c, -.3 * R, -.25 * R, .035 * R, .05 * R, 0, 'rgba(255,255,255,.55)');
    pearPath(c, R); c.lineWidth = .075 * R; c.strokeStyle = 'rgba(40,52,6,.85)'; c.lineJoin = 'round'; c.stroke();
    c.lineCap = 'round'; c.strokeStyle = '#3f2410'; c.lineWidth = .12 * R; c.beginPath(); c.moveTo(0, -1.0 * R); c.quadraticCurveTo(.04 * R, -1.2 * R, .2 * R, -1.3 * R); c.stroke();
    c.strokeStyle = '#8d5f33'; c.lineWidth = .045 * R; c.beginPath(); c.moveTo(-.01 * R, -1.0 * R); c.quadraticCurveTo(.03 * R, -1.18 * R, .17 * R, -1.28 * R); c.stroke();
    c.save(); c.translate(.06 * R, -1.04 * R); c.rotate(-.5);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(.2 * R, -.36 * R, .6 * R, -.36 * R, .78 * R, -.08 * R); c.bezierCurveTo(.58 * R, .16 * R, .22 * R, .18 * R, 0, 0); c.closePath();
    c.fillStyle = lg(c, 0, -.3 * R, .8 * R, .1 * R, [[0, '#9be05a'], [.6, '#4fa233'], [1, '#2c6e22']]); c.fill(); c.lineWidth = .05 * R; c.strokeStyle = '#1f4a18'; c.stroke(); c.restore();
  }
  function drawPearCut(c, R) {
    pearPath(c, R); c.fillStyle = '#b9cb45'; c.fill(); c.lineWidth = .075 * R; c.strokeStyle = 'rgba(40,52,6,.85)'; c.lineJoin = 'round'; c.stroke();
    c.save(); c.scale(.88, .9); c.translate(0, .02 * R); pearPath(c, R);
    c.fillStyle = rg(c, -.1 * R, -.05 * R, .05 * R, 0, .1 * R, 1.1 * R, [[0, '#fffdf0'], [.6, '#fbf4cf'], [1, '#e9dba0']]); c.fill(); c.lineWidth = .06 * R; c.strokeStyle = 'rgba(190,160,70,.4)'; c.stroke(); c.restore();
    // gritty texture dots
    const r = rng(41); c.fillStyle = 'rgba(205,185,110,.5)';
    for (let i = 0; i < 24; i++) { const a = r() * TAU, d = Math.sqrt(r()) * .75 * R; c.beginPath(); c.arc(Math.cos(a) * d * .8, Math.sin(a) * d + .1 * R, R * .015, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(120,84,44,.5)'; c.lineWidth = .04 * R; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -.98 * R); c.lineTo(0, -.2 * R); c.stroke();
    c.beginPath(); c.moveTo(0, -.22 * R); c.bezierCurveTo(.22 * R, -.1 * R, .26 * R, .25 * R, .13 * R, .45 * R); c.quadraticCurveTo(0, .55 * R, -.13 * R, .45 * R); c.bezierCurveTo(-.26 * R, .25 * R, -.22 * R, -.1 * R, 0, -.22 * R); c.closePath();
    c.fillStyle = '#efe4aa'; c.fill(); c.lineWidth = .035 * R; c.strokeStyle = '#b39651'; c.stroke();
    [[-.06, .04, -.4, .9], [.07, .2, .45, .8]].forEach(sd => {
      c.save(); c.translate(sd[0] * R, sd[1] * R); c.rotate(sd[2]); c.scale(sd[3], sd[3]);
      c.beginPath(); c.moveTo(0, -.11 * R); c.quadraticCurveTo(.065 * R, .02 * R, 0, .075 * R); c.quadraticCurveTo(-.065 * R, .02 * R, 0, -.11 * R);
      c.fillStyle = lg(c, -.06 * R, 0, .06 * R, 0, [[0, '#6e3c14'], [1, '#3a1c08']]); c.fill(); c.restore();
    });
    c.save(); c.translate(-.5 * R, .35 * R); c.rotate(-1); ell(c, 0, 0, .16 * R, .055 * R, 0, 'rgba(255,255,255,.65)'); c.restore();
  }

  /* ---------------- pumpkin ---------------- */
  function pumpkinBody(c, R, fill, stroke) {
    const order = [-2, 2, -1, 1, 0];
    order.forEach(i => {
      const a = Math.abs(i), rx = .5 * R - a * .02 * R, ry = .82 * R - a * .08 * R, x = i * .3 * R;
      c.save(); c.translate(x, .08 * R); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fillStyle = fill(i, rx, ry); c.fill();
      if (stroke) { c.lineWidth = .045 * R; c.strokeStyle = stroke; c.stroke(); }
      c.restore();
    });
  }
  function drawPumpkin(c, R) {
    pumpkinBody(c, R, (i, rx, ry) => lg(c, -rx, 0, rx, 0, [[0, '#b84a10'], [.28, '#f7923a'], [.5, '#ffb45e'], [.78, '#f0791f'], [1, '#a8400c']]), 'rgba(90,30,0,.7)');
    c.save(); c.beginPath(); c.ellipse(0, .08 * R, .98 * R, .8 * R, 0, 0, TAU); c.clip();
    fillAll(c, R, lg(c, 0, .2 * R, 0, .95 * R, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(60,10,0,.4)']]));
    fillAll(c, R, lg(c, .2 * R, 0, 1.0 * R, 0, [[0, 'rgba(255,190,90,0)'], [1, 'rgba(255,190,90,.35)']]));
    c.restore();
    c.save(); c.translate(-.42 * R, -.25 * R); c.rotate(-.9); ell(c, 0, 0, .22 * R, .08 * R, 0, 'rgba(255,255,255,.5)'); c.restore();
    // stem
    c.beginPath(); c.moveTo(-.12 * R, -.62 * R); c.bezierCurveTo(-.14 * R, -.85 * R, -.04 * R, -1.0 * R, .16 * R, -1.12 * R); c.lineTo(.3 * R, -1.0 * R); c.bezierCurveTo(.2 * R, -.9 * R, .16 * R, -.8 * R, .15 * R, -.6 * R); c.closePath();
    c.fillStyle = lg(c, -.1 * R, 0, .3 * R, 0, [[0, '#4d7a26'], [.6, '#7aa63a'], [1, '#3b5e1c']]); c.fill(); c.lineWidth = .05 * R; c.strokeStyle = '#2a4210'; c.lineJoin = 'round'; c.stroke();
    // curly tendril
    c.strokeStyle = '#5c9a2c'; c.lineWidth = .04 * R; c.lineCap = 'round'; c.beginPath(); c.moveTo(.14 * R, -.7 * R); c.bezierCurveTo(.6 * R, -.9 * R, .75 * R, -.6 * R, .55 * R, -.55 * R); c.bezierCurveTo(.42 * R, -.52 * R, .45 * R, -.66 * R, .54 * R, -.66 * R); c.stroke();
  }
  function drawPumpkinCut(c, R) {
    pumpkinBody(c, R, () => '#a8400c', 'rgba(90,30,0,.7)');
    c.save(); c.beginPath(); c.ellipse(0, .08 * R, .86 * R, .7 * R, 0, 0, TAU); c.clip();
    fillAll(c, R, rg(c, 0, 0, .05 * R, 0, .08 * R, 1.0 * R, [[0, '#ffd36a'], [.55, '#ffac33'], [1, '#e8801a']]));
    const r = rng(77);
    c.strokeStyle = 'rgba(255,235,160,.6)'; c.lineWidth = .028 * R; c.lineCap = 'round';
    for (let i = 0; i < 22; i++) { const a = r() * TAU, d1 = (.1 + r() * .2) * R, d2 = (.45 + r() * .4) * R; c.beginPath(); c.moveTo(Math.cos(a) * d1, Math.sin(a) * d1 + .08 * R); c.quadraticCurveTo(Math.cos(a + .5) * (d1 + d2) / 2, Math.sin(a + .5) * (d1 + d2) / 2 + .08 * R, Math.cos(a + .2) * d2, Math.sin(a + .2) * d2 + .08 * R); c.stroke(); }
    // seeds
    for (let i = 0; i < 13; i++) { const a = r() * TAU, d = Math.sqrt(r()) * .38 * R; c.save(); c.translate(Math.cos(a) * d, Math.sin(a) * d + .08 * R); c.rotate(r() * TAU);
      ell(c, 0, 0, .08 * R, .13 * R, 0, '#fff0c8'); c.lineWidth = .02 * R; c.strokeStyle = '#b8863a'; c.beginPath(); c.ellipse(0, 0, .08 * R, .13 * R, 0, 0, TAU); c.stroke(); c.restore(); }
    c.restore();
    c.save(); c.translate(-.45 * R, -.2 * R); c.rotate(-.9); ell(c, 0, 0, .2 * R, .06 * R, 0, 'rgba(255,255,255,.5)'); c.restore();
  }

  /* ---------------- beehive (straw skep) ---------------- */
  function drawHive(c, R) {
    // base board
    c.fillStyle = '#4a2c14'; c.beginPath(); c.roundRect(-1.0 * R, .76 * R, 2.0 * R, .2 * R, .06 * R); c.fill();
    c.strokeStyle = '#24130a'; c.lineWidth = .05 * R; c.stroke();
    const tiers = [[.95, .62], [.88, .38], [.76, .14], [.6, -.1], [.42, -.34], [.22, -.56]]; // half-width, top y (each tier is as tall as the gap)
    for (let i = 0; i < tiers.length; i++) {
      const hw = tiers[i][0] * R, y1 = tiers[i][1] * R, y0 = (i === 0 ? .78 : tiers[i - 1][1]) * R;
      c.beginPath(); c.roundRect(-hw, y1, 2 * hw, y0 - y1 + .02 * R, .17 * R);
      c.fillStyle = lg(c, -hw, 0, hw, 0, [[0, '#a8701a'], [.3, '#ecb73e'], [.55, '#ffd870'], [.85, '#e0a22c'], [1, '#a8701a']]); c.fill();
      c.lineWidth = .055 * R; c.strokeStyle = '#6a3f0e'; c.stroke();
      // straw texture
      c.save(); c.clip(); c.strokeStyle = 'rgba(110,64,10,.35)'; c.lineWidth = .025 * R;
      for (let x = -hw; x < hw; x += .13 * R) { c.beginPath(); c.moveTo(x, y1); c.lineTo(x + .06 * R, y0); c.stroke(); }
      c.restore();
    }
    ell(c, 0, -.62 * R, .1 * R, .1 * R, 0, '#8a5a1c'); c.lineWidth = .04 * R; c.strokeStyle = '#4a2c0a'; c.beginPath(); c.arc(0, -.62 * R, .1 * R, 0, TAU); c.stroke();
    // entrance
    c.beginPath(); c.moveTo(-.24 * R, .78 * R); c.lineTo(-.24 * R, .55 * R); c.quadraticCurveTo(0, .32 * R, .24 * R, .55 * R); c.lineTo(.24 * R, .78 * R); c.closePath();
    c.fillStyle = rg(c, 0, .65 * R, 0, 0, .65 * R, .3 * R, [[0, '#050200'], [1, '#2a1406']]); c.fill(); c.lineWidth = .04 * R; c.strokeStyle = '#3a2008'; c.stroke();
    // highlight
    c.save(); c.translate(-.5 * R, 0); c.rotate(-.2); ell(c, 0, 0, .06 * R, .32 * R, 0, 'rgba(255,255,255,.28)'); c.restore();
  }
  function drawHiveCut(c, R) {
    const tiers = [[.95, .62], [.88, .38], [.76, .14], [.6, -.1], [.42, -.34], [.22, -.56]];
    const sil = () => { c.beginPath(); tiers.forEach((t, i) => { const hw = t[0] * R, y1 = t[1] * R, y0 = (i === 0 ? .78 : tiers[i - 1][1]) * R; c.roundRect(-hw, y1, 2 * hw, y0 - y1 + .02 * R, .17 * R); }); };
    sil(); c.fillStyle = '#d99a2a'; c.fill(); c.lineWidth = .06 * R; c.strokeStyle = '#6a3f0e'; c.stroke();
    c.save(); sil(); c.clip(); c.translate(0, .1 * R); c.scale(.82, .84);
    sil(); c.fillStyle = rg(c, 0, 0, .1 * R, 0, 0, 1.1 * R, [[0, '#ffcf45'], [1, '#c8790c']]); c.fill();
    c.clip();
    // honeycomb
    c.strokeStyle = 'rgba(120,60,0,.7)'; c.lineWidth = .035 * R; const s = .2 * R;
    for (let row = -6; row <= 6; row++) for (let col = -6; col <= 6; col++) {
      const x = col * s * 1.73 + (row & 1 ? s * .87 : 0), y = row * s * 1.5;
      c.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + TAU / 12; c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } c.closePath();
      c.fillStyle = (row + col) % 3 === 0 ? 'rgba(255,230,120,.5)' : 'rgba(255,170,30,.25)'; c.fill(); c.stroke();
    }
    c.restore();
    // honey drips
    c.fillStyle = '#ffc233'; [[-.5, .5], [.1, .62], [.55, .45]].forEach(d => { c.beginPath(); c.roundRect(d[0] * R - .06 * R, d[1] * R - .1 * R, .12 * R, .3 * R, .06 * R); c.fill(); });
    c.save(); c.translate(-.4 * R, -.1 * R); c.rotate(-.5); ell(c, 0, 0, .15 * R, .05 * R, 0, 'rgba(255,255,255,.55)'); c.restore();
  }

  /* ---------------- maple leaf ---------------- */
  function maplePath(c, R) {
    // 5 pointed lobes with serrated edges, built in polar coordinates (0 = up)
    const lobes = [[0, 1.0, 34], [62, .92, 30], [-62, .92, 30], [128, .66, 26], [-128, .66, 26]];
    c.beginPath();
    for (let d = -180; d <= 180; d += 1.5) {
      let r = .3;
      for (const L of lobes) { let dd = Math.abs(((d - L[0] + 540) % 360) - 180); if (dd < L[2]) { const t = 1 - dd / L[2]; r = Math.max(r, .3 + (L[1] - .3) * Math.pow(t, .85)); } }
      r *= 1 + .07 * Math.sin(d * 0.52) * (r > .5 ? 1 : 0);
      if (Math.abs(d) > 168) r = Math.min(r, .34);
      const a = d * Math.PI / 180;
      const x = Math.sin(a) * r * R, y = -Math.cos(a) * r * R * .95 - .05 * R;
      d === -180 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.closePath();
  }
  function drawMaple(c, R, cut) {
    maplePath(c, R);
    c.fillStyle = cut ? lg(c, -R, -R, R, R, [[0, '#ffd27a'], [.5, '#ff9a3a'], [1, '#d64a1c']]) : rg(c, -.2 * R, -.35 * R, .05 * R, 0, 0, 1.1 * R, [[0, '#ffb347'], [.35, '#f0541e'], [1, '#a81818']]); c.fill();
    c.lineWidth = .07 * R; c.strokeStyle = 'rgba(90,10,6,.85)'; c.lineJoin = 'round'; c.stroke();
    c.strokeStyle = cut ? 'rgba(130,40,10,.7)' : 'rgba(255,220,140,.7)'; c.lineWidth = .05 * R; c.lineCap = 'round';
    const veins = [[0, 0, 0, -.88], [0, -.05, .55, -.5], [0, -.05, -.55, -.5], [0, .08, .4, .4], [0, .08, -.4, .4]];
    veins.forEach(v => { c.beginPath(); c.moveTo(v[0] * R, v[1] * R); c.lineTo(v[2] * R, v[3] * R); c.stroke(); });
    c.strokeStyle = '#5a2a10'; c.lineWidth = .1 * R; c.beginPath(); c.moveTo(0, .2 * R); c.quadraticCurveTo(0, .75 * R, .08 * R, 1.0 * R); c.stroke();
    c.save(); c.translate(-.28 * R, -.4 * R); c.rotate(-.6); ell(c, 0, 0, .14 * R, .05 * R, 0, 'rgba(255,255,255,.5)'); c.restore();
  }

  /* ---------------- cider donut ---------------- */
  function drawDonut(c, R, cut) {
    c.beginPath(); c.arc(0, 0, R, 0, TAU);
    c.fillStyle = cut ? rg(c, 0, 0, .2 * R, 0, 0, R, [[0, '#f3cf86'], [1, '#d99a48']]) : rg(c, -.3 * R, -.35 * R, .1 * R, 0, 0, 1.1 * R, [[0, '#e0a05a'], [.55, '#b8702c'], [1, '#7c4216']]); c.fill();
    c.lineWidth = .08 * R; c.strokeStyle = 'rgba(55,24,6,.85)'; c.stroke();
    c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip();
    // cinnamon sugar crust
    const r = rng(91);
    if (!cut) { c.strokeStyle = 'rgba(120,56,14,.35)'; c.lineWidth = R * .09; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 0, R * (.55 + k * .14), .3 + k, 2.2 + k); c.stroke(); } }
    for (let i = 0; i < 380; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R; c.fillStyle = r() < .7 ? 'rgba(255,244,214,' + (.55 + r() * .4) + ')' : 'rgba(150,70,20,.5)'; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, R * (.01 + .018 * r()), 0, TAU); c.fill(); }
    if (cut) { c.fillStyle = 'rgba(255,248,220,.5)'; for (let i = 0; i < 20; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * .9; c.beginPath(); c.ellipse(Math.cos(a) * d, Math.sin(a) * d, R * .05, R * .03, r() * 3, 0, TAU); c.fill(); } }
    c.restore();
    // hole
    c.save(); c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, 0, .36 * R, 0, TAU); c.fillStyle = '#000'; c.fill(); c.restore();
    c.beginPath(); c.arc(0, 0, .36 * R, 0, TAU); c.lineWidth = .06 * R; c.strokeStyle = 'rgba(55,24,6,.85)'; c.stroke();
    c.beginPath(); c.arc(0, 0, .31 * R, Math.PI * .1, Math.PI * .9); c.lineWidth = .05 * R; c.strokeStyle = 'rgba(255,220,150,.35)'; c.stroke();
    c.save(); c.translate(-.5 * R, -.52 * R); c.rotate(-.8); ell(c, 0, 0, .22 * R, .06 * R, 0, 'rgba(255,255,255,.55)'); c.restore();
  }

  /* ---------------- ASSETS ---------------- */
  const ASSETS = {};
  function add(key, r, draw) { ASSETS[key] = { r, png: null, draw }; }
  Object.keys(APPLES).forEach(k => { add('apple_' + k, 30, (c, R) => drawApple(c, R, APPLES[k])); add('apple_' + k + '_cut', 30, (c, R) => drawAppleCut(c, R, APPLES[k])); });
  add('pear', 28, drawPear); add('pear_cut', 28, drawPearCut);
  add('pumpkin', 40, drawPumpkin); add('pumpkin_cut', 40, drawPumpkinCut);
  add('hive', 32, drawHive); add('hive_cut', 32, drawHiveCut);
  add('maple', 26, (c, R) => drawMaple(c, R, false)); add('maple_cut', 26, (c, R) => drawMaple(c, R, true));
  add('donut', 30, (c, R) => drawDonut(c, R, false)); add('donut_cut', 30, (c, R) => drawDonut(c, R, true));
  add('golden', 34, (c, R) => { drawApple(c, R, APPLES.golden); sparkle(c, -.5 * R, -.35 * R, .26 * R); sparkle(c, .52 * R, .3 * R, .16 * R); });
  add('golden_cut', 34, (c, R) => drawAppleCut(c, R, APPLES.golden));

  // small extras
  function drawCore(c, R, bitten) { // used by the misses HUD
    c.beginPath(); c.moveTo(-.35 * R, -.9 * R); c.quadraticCurveTo(0, -.65 * R, .35 * R, -.9 * R); c.quadraticCurveTo(.2 * R, -.3 * R, .28 * R, 0); c.quadraticCurveTo(.2 * R, .3 * R, .35 * R, .9 * R);
    c.quadraticCurveTo(0, .65 * R, -.35 * R, .9 * R); c.quadraticCurveTo(-.2 * R, .3 * R, -.28 * R, 0); c.quadraticCurveTo(-.2 * R, -.3 * R, -.35 * R, -.9 * R); c.closePath();
    c.fillStyle = bitten; c.fill(); c.lineWidth = .1 * R; c.strokeStyle = 'rgba(40,20,10,.8)'; c.lineJoin = 'round'; c.stroke();
    c.fillStyle = '#2a140a'; ell(c, -.07 * R, -.25 * R, .05 * R, .09 * R, .3, '#2a140a'); ell(c, .07 * R, .25 * R, .05 * R, .09 * R, -.3, '#2a140a');
  }

  /* ---------------- painted art (drop-in PNGs) ----------------
     All PNGs are preloaded once; nothing switches until every image has settled (loaded or failed), so a fruit
     is never painted while its cut face is still code-drawn. Each painting's visible bounds are measured from its
     alpha, using the _cut image (no stem or leaf) for the body, so the painted body matches the hitbox radius and a
     fruit and its cut face share one transform (halves line up exactly). Code art is the fallback per key. */
  const PAINT = ['apple_red', 'apple_green', 'apple_gold', 'apple_blush', 'pear', 'pumpkin', 'hive', 'maple', 'donut'];
  PAINT.forEach(k => { ASSETS[k].png = 'assets/' + k + '.png'; ASSETS[k + '_cut'].png = 'assets/' + k + '_cut.png'; });
  const BODY = { hive: .95 }; // painted body width as a fraction of 2r
  const IMG = {}, FIT = {}, BGP = { src: 'assets/bg_portrait.jpg', img: null };
  let loadState = 'idle', onChange = null, loadT0 = 0, loadMs = 0;
  function bounds(im) {
    const w = im.naturalWidth, h = im.naturalHeight, c = mk(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }
  function fitPair(key, img, cutImg, r) {
    const bb = bounds(cutImg || img), bw = bounds(img); if (!bb || !bw) return null;
    const s = (2 * r * (BODY[key] || 1.02)) / (bb.x1 - bb.x0), cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
    const ext = Math.max(cx - bw.x0, bw.x1 - cx, cy - bw.y0, bw.y1 - cy) * s;
    return { s, cx, cy, half: Math.ceil(Math.max(r * 1.35, ext + 2)) };
  }
  function computeFits() {
    PAINT.forEach(k => {
      const f = IMG[k] && IMG[k + '_cut'] ? fitPair(k, IMG[k], IMG[k + '_cut'], ASSETS[k].r) : null;
      if (f) { FIT[k] = f; FIT[k + '_cut'] = f; }
    });
    // the golden apple is the painted gold apple, re-graded to polished gold, so it sits with the rest of the set
    if (FIT.apple_gold) { const f = FIT.apple_gold, k = ASSETS.golden.r / ASSETS.apple_gold.r; FIT.golden = FIT.golden_cut = { s: f.s * k, cx: f.cx, cy: f.cy, half: Math.ceil(f.half * k) }; }
  }
  function goldGrade(im, cut) {
    const w = im.naturalWidth, h = im.naturalHeight, c = mk(w, h), g = c.getContext('2d');
    // shift the body's hue to gold (keeping the painting's own shading), masked by the cut image's silhouette so
    // the stem and leaf keep their natural colours; then add a little shine
    const t = mk(w, h), tg = t.getContext('2d');
    tg.drawImage(im, 0, 0);
    tg.globalCompositeOperation = 'hue'; tg.fillStyle = cut ? '#ffd000' : '#ffc400'; tg.fillRect(0, 0, w, h);
    if (!cut) {
      tg.globalCompositeOperation = 'saturation'; tg.fillStyle = '#ffb000'; tg.fillRect(0, 0, w, h); // full-strength gold, not brass
      tg.globalCompositeOperation = 'overlay'; tg.fillStyle = 'rgba(255,170,0,.45)'; tg.fillRect(0, 0, w, h);
      tg.globalCompositeOperation = 'screen'; const sh = tg.createLinearGradient(0, h * .2, w, h * .8);
      sh.addColorStop(0, 'rgba(255,240,180,0)'); sh.addColorStop(.38, 'rgba(255,240,180,0)'); sh.addColorStop(.46, 'rgba(255,250,220,.75)'); sh.addColorStop(.54, 'rgba(255,240,180,0)'); sh.addColorStop(1, 'rgba(255,240,180,0)');
      tg.fillStyle = sh; tg.fillRect(0, 0, w, h); // a polished metal glint across the body
    } else { tg.globalCompositeOperation = 'screen'; tg.fillStyle = 'rgba(255,220,120,.12)'; tg.fillRect(0, 0, w, h); }
    tg.globalCompositeOperation = 'destination-in'; tg.drawImage(IMG.apple_gold_cut || im, 0, 0, w, h);
    g.drawImage(im, 0, 0); g.drawImage(t, 0, 0);
    if (!cut) { sparkle(g, w * .33, h * .45, w * .07); sparkle(g, w * .66, h * .72, w * .045); }
    return c;
  }
  function load(cb) {
    onChange = cb; if (loadState !== 'idle') return; loadState = 'loading'; loadT0 = performance.now();
    const list = []; PAINT.forEach(k => { list.push(k, k + '_cut'); });
    let left = list.length + 1;
    const settle = () => { if (--left) return; computeFits(); loadState = 'ready'; loadMs = performance.now() - loadT0; if (onChange) onChange(); };
    // at most 4 downloads at a time (background first); each image gets two retries, then its code art stays
    const jobs = [{ src: BGP.src, done: (im) => { BGP.img = im; } }].concat(list.map(k => ({ src: ASSETS[k].png, done: (im) => { IMG[k] = im; } })));
    let next = 0;
    const run = () => {
      const j = jobs[next++]; if (!j) return;
      let tries = 0; const im = new Image(); im.decoding = 'async';
      const fin = () => { settle(); run(); };
      im.onload = () => { j.done(im); fin(); };
      im.onerror = () => { if (tries++ < 2) setTimeout(() => { im.src = j.src + '?r=' + tries; }, 400); else fin(); };
      im.src = j.src;
    };
    for (let i = 0; i < 4; i++) run();
  }
  function paintedSource(key) {
    if (key === 'golden' || key === 'golden_cut') { const base = IMG[key === 'golden' ? 'apple_gold' : 'apple_gold_cut']; return base && FIT[key] ? (IMG[key] || (IMG[key] = goldGrade(base, key === 'golden_cut'))) : null; }
    return FIT[key] && IMG[key] ? IMG[key] : null;
  }
  function build(pk) {
    const out = {};
    for (const key in ASSETS) {
      const a = ASSETS[key], src = paintedSource(key), f = src && FIT[key], half = f ? f.half : Math.ceil(a.r * 1.35), size = Math.round(2 * half * pk), cv = mk(size, size), c = cv.getContext('2d');
      c.scale(size / (2 * half), size / (2 * half)); c.translate(half, half);
      if (f) { c.imageSmoothingQuality = 'high'; c.scale(f.s, f.s); c.drawImage(src, -f.cx, -f.cy); } else a.draw(c, a.r);
      out[key] = { cv, half, painted: !!f };
    }
    const cs = Math.round(40 * pk), core = mk(cs, cs), cc = core.getContext('2d'); cc.scale(cs / 40, cs / 40); cc.translate(20, 20); drawCore(cc, 17, '#e9d79c'); out.core = { cv: core, half: 20 };
    const ap = mk(cs, cs), ac = ap.getContext('2d'); ac.scale(cs / 40, cs / 40);
    if (FIT.apple_red && IMG.apple_red) { const f = FIT.apple_red, k = 15 / 30; ac.translate(20, 22); ac.scale(f.s * k, f.s * k); ac.drawImage(IMG.apple_red, -f.cx, -f.cy); } else { ac.translate(20, 22); ASSETS.apple_red.draw(ac, 15); }
    out.apple_icon = { cv: ap, half: 20 };
    return out;
  }

  /* ---------------- background: an orchard at golden hour ---------------- */
  function hill(c, W, base, amp, seed, c0, c1) {
    const r = rng(seed), f0 = r() * 6, f1 = r() * 6, f2 = r() * 6;
    c.beginPath(); c.moveTo(0, base + amp + 80);
    for (let x = 0; x <= W + 8; x += 6) c.lineTo(x, base - amp * (.5 + .3 * Math.sin(x * .011 + f0) + .2 * Math.sin(x * .029 + f1) + .1 * Math.sin(x * .07 + f2)));
    c.lineTo(W, base + amp + 80); c.closePath(); c.fillStyle = lg(c, 0, base - amp, 0, base + amp, [[0, c0], [1, c1]]); c.fill();
  }
  function tree(c, x, y, s, depth, seed, haze) {
    const r = rng(seed);
    const mix = (a, b) => lerpHex(a, b, Math.min(1, depth));
    // ground shadow, stretched away from the low sun on the right
    c.save(); c.translate(x - s * .5, y); c.scale(1, .22); c.beginPath(); c.arc(0, 0, s * 1.5, 0, TAU); c.fillStyle = 'rgba(30,12,40,' + (.12 + .2 * depth) + ')'; c.fill(); c.restore();
    // trunk
    c.beginPath(); c.moveTo(x - s * .16, y); c.lineTo(x - s * .1, y - s * 1.1); c.lineTo(x + s * .1, y - s * 1.1); c.lineTo(x + s * .17, y); c.closePath();
    c.fillStyle = lg(c, x - s * .2, 0, x + s * .2, 0, [[0, mix(haze, '#2c1a10')], [.7, mix(haze, '#5a3a22')], [1, mix(haze, '#9a6a3a')]]); c.fill();
    // canopy
    const cy = y - s * 1.65, blobs = [[0, 0, 1.0], [-.7, .15, .72], [.72, .12, .74], [-.35, -.55, .66], [.4, -.55, .68], [0, .5, .65]];
    const dark = mix(haze, '#1f4a35'), mid = mix(haze, '#3d7a3c'), light = mix(haze, '#9bc24a'), rim = mix(haze, '#ffcf6a');
    blobs.forEach((b, i) => {
      const bx = x + b[0] * s, by = cy + b[1] * s, br = b[2] * s;
      c.beginPath(); c.arc(bx, by, br, 0, TAU);
      c.fillStyle = rg(c, bx + br * .35, by - br * .4, br * .05, bx, by, br * 1.1, [[0, light], [.45, mid], [1, dark]]); c.fill();
    });
    // rim light on the sun side
    c.save(); c.globalCompositeOperation = 'lighter'; blobs.forEach(b => { const bx = x + b[0] * s, by = cy + b[1] * s, br = b[2] * s; c.beginPath(); c.arc(bx, by, br, -1.2, .7); c.lineWidth = br * .12; c.strokeStyle = 'rgba(255,170,70,' + (.18 + .12 * depth) + ')'; c.stroke(); }); c.restore();
    // apples hiding in the leaves
    const n = Math.round(3 + 7 * depth);
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * s * 1.1, ax = x + Math.cos(a) * d * 1.15, ay = cy + Math.sin(a) * d * .8, ar = Math.max(1.2, s * .085);
      c.beginPath(); c.arc(ax, ay, ar, 0, TAU); c.fillStyle = mix(haze, r() < .75 ? '#b8423a' : '#d8ad3c'); c.fill();
      if (ar > 2.5) { c.beginPath(); c.arc(ax - ar * .3, ay - ar * .3, ar * .3, 0, TAU); c.fillStyle = 'rgba(255,255,255,.4)'; c.fill(); }
    }
  }
  function cider(c, x, y, s) {
    // A little farm barn with a cider press beside it, drawn in unit coordinates (barn ~100 wide)
    c.save(); c.translate(x, y); c.scale(s, s);
    // barn
    c.fillStyle = lg(c, -50, 0, 50, 0, [[0, '#6e2424'], [.6, '#a93a2c'], [1, '#d4623a']]); c.fillRect(-50, -46, 100, 46);
    c.fillStyle = 'rgba(255,255,255,.12)'; for (let i = -48; i < 50; i += 7) c.fillRect(i, -46, 1.2, 46);
    c.beginPath(); c.moveTo(-58, -44); c.lineTo(-38, -72); c.lineTo(38, -72); c.lineTo(58, -44); c.closePath(); c.fillStyle = lg(c, 0, -72, 0, -44, [[0, '#6a4350'], [1, '#3e2634']]); c.fill();
    c.strokeStyle = '#ffc070'; c.lineWidth = 2.2; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-58, -44); c.lineTo(-38, -72); c.lineTo(38, -72); c.lineTo(58, -44); c.stroke();
    c.fillStyle = '#3a1818'; c.fillRect(-14, -30, 28, 30); c.strokeStyle = '#f3e3c0'; c.lineWidth = 2; c.strokeRect(-14, -30, 28, 30);
    c.beginPath(); c.moveTo(-14, -30); c.lineTo(14, 0); c.moveTo(14, -30); c.lineTo(-14, 0); c.stroke();
    c.fillStyle = '#ffe08a'; c.fillRect(-6, -62, 12, 11); c.strokeStyle = '#f3e3c0'; c.strokeRect(-6, -62, 12, 11);
    c.fillStyle = '#ffe08a'; c.fillRect(-40, -38, 10, 10); c.fillRect(30, -38, 10, 10);
    c.fillStyle = '#4a2a30'; c.fillRect(-5, -82, 10, 11); c.beginPath(); c.moveTo(-8, -82); c.lineTo(0, -92); c.lineTo(8, -82); c.closePath(); c.fill();
    // cider press (to the right)
    c.translate(80, 0);
    c.fillStyle = '#4a2c18'; c.fillRect(-16, -42, 5, 42); c.fillRect(11, -42, 5, 42); c.fillRect(-20, -46, 40, 6);
    c.fillStyle = '#7a4a22'; c.fillRect(-3, -66, 6, 24); c.fillStyle = '#c99a58'; for (let i = 0; i < 6; i++) c.fillRect(-3, -64 + i * 4, 6, 1.4);
    c.fillStyle = '#4a2c18'; c.fillRect(-18, -68, 36, 4);
    c.beginPath(); c.roundRect(-13, -20, 26, 20, 3); c.fillStyle = lg(c, -13, 0, 13, 0, [[0, '#6a4020'], [.5, '#b57a3c'], [1, '#6a4020']]); c.fill();
    c.fillStyle = '#2a1a10'; c.fillRect(-13, -15, 26, 2); c.fillRect(-13, -6, 26, 2);
    c.fillStyle = '#e8b84a'; c.beginPath(); c.arc(25, -6, 6, 0, TAU); c.fill(); c.fillStyle = '#c93a2a'; c.beginPath(); c.arc(31, -4, 5, 0, TAU); c.fill();
    c.restore();
  }
  function hayBale(c, x, y, R) { // (kept the name) a wooden picking crate heaped with apples
    c.save(); c.translate(x, y);
    const w = R * 2.4, h = R * 1.3, r0 = rng(12);
    c.fillStyle = 'rgba(20,8,30,.4)'; c.beginPath(); c.ellipse(R * .3, h * .55, w * .62, R * .2, 0, 0, TAU); c.fill();
    // apples heaped on top (behind the front slats)
    const cols = [['#ff7a68', '#c42a2a', '#7d1020'], ['#fff1a0', '#e9b62a', '#a86a10'], ['#e8f590', '#9ccf3f', '#4f7c18']];
    const ap = []; for (let i = 0; i < 9; i++) ap.push({ x: -w * .42 + (i % 5) * w * .21 + (i > 4 ? w * .1 : 0) + (r0() - .5) * 4, y: -h * .5 - (i > 4 ? R * .42 : R * .12) + (r0() - .5) * 3, k: r0() < .6 ? 0 : r0() < .5 ? 1 : 2 });
    ap.sort((p, q) => p.y - q.y).forEach(p => { const ar = R * .3, cc = cols[p.k];
      c.beginPath(); c.arc(p.x, p.y, ar, 0, TAU); c.fillStyle = rg(c, p.x - ar * .35, p.y - ar * .4, ar * .1, p.x, p.y, ar * 1.1, [[0, cc[0]], [.5, cc[1]], [1, cc[2]]]); c.fill();
      c.lineWidth = R * .035; c.strokeStyle = 'rgba(50,10,10,.7)'; c.stroke();
      c.beginPath(); c.arc(p.x - ar * .35, p.y - ar * .35, ar * .2, 0, TAU); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill(); });
    // crate: three slats with dark gaps, corner posts
    c.fillStyle = '#3a200e'; c.fillRect(-w / 2, -h / 2, w, h);
    for (let i = 0; i < 3; i++) { const sy = -h / 2 + i * h / 3 + h * .03, sh = h / 3 - h * .07;
      c.fillStyle = lg(c, 0, sy, 0, sy + sh, [[0, '#d9a465'], [1, '#a8723c']]); c.fillRect(-w / 2, sy, w, sh);
      c.strokeStyle = 'rgba(90,50,20,.45)'; c.lineWidth = 1; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-w / 2 + r0() * w * .3, sy + sh * (.3 + k * .2)); c.lineTo(w / 2 - r0() * w * .3, sy + sh * (.3 + k * .2) + (r0() - .5) * 2); c.stroke(); } }
    c.fillStyle = '#8a5a2c'; c.fillRect(-w / 2, -h / 2, w * .08, h); c.fillRect(w / 2 - w * .08, -h / 2, w * .08, h);
    c.strokeStyle = '#2a1408'; c.lineWidth = R * .05; c.strokeRect(-w / 2, -h / 2, w, h);
    // stencilled label
    c.fillStyle = 'rgba(110,24,16,.85)'; c.font = 'bold ' + (R * .3).toFixed(1) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('VT APPLES', 0, 0);
    c.restore();
  }
  function tuft(c, x, y, s, col) {
    c.strokeStyle = col; c.lineWidth = Math.max(1.2, s * .12); c.lineCap = 'round';
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(x + i * s * .12, y); c.quadraticCurveTo(x + i * s * .3, y - s * .5, x + i * s * .45, y - s * (.7 - Math.abs(i) * .08)); c.stroke(); }
  }

  function paintedBackground(W, H, pk) {
    const im = BGP.img, cv = mk(W * pk, H * pk), c = cv.getContext('2d'); c.scale(cv.width / W, cv.height / H);
    const s = Math.max(W / im.naturalWidth, H / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
    c.imageSmoothingQuality = 'high';
    c.drawImage(im, (W - dw) / 2, (H - dh) * .78, dw, dh); // when cropping, crop mostly sky so the orchard stays in view
    // keep the HUD readable and the flying fruit the brightest thing on screen
    c.fillStyle = lg(c, 0, 0, 0, H * .22, [[0, 'rgba(20,8,40,.55)'], [1, 'rgba(20,8,40,0)']]); c.fillRect(0, 0, W, H * .22);
    c.fillStyle = lg(c, 0, H * .55, 0, H, [[0, 'rgba(30,14,40,0)'], [1, 'rgba(30,14,40,.32)']]); c.fillRect(0, H * .55, W, H * .45);
    c.fillStyle = rg(c, W / 2, H * .5, Math.min(W, H) * .4, W / 2, H * .5, Math.max(W, H) * .8, [[0, 'rgba(18,6,34,0)'], [1, 'rgba(18,6,34,.38)']]); c.fillRect(0, 0, W, H);
    return cv;
  }
  function makeBackground(W, H, pk) {
    if (BGP.img && H > W) return paintedBackground(W, H, pk); // portrait gets the painting; landscape/desktop keep the code-drawn scene
    const cv = mk(W * pk, H * pk), c = cv.getContext('2d'); c.scale(cv.width / W, cv.height / H);
    const land = W > H, hz = H * (land ? .5 : .46), r = rng(2024);
    // sky
    c.fillStyle = lg(c, 0, 0, 0, hz, [[0, '#2a1f5c'], [.3, '#5e3a82'], [.55, '#b84a7a'], [.78, '#e8804f'], [1, '#fbc47a']]); c.fillRect(0, 0, W, hz + 4);
    const sx = W * (land ? .66 : .7), sy = hz - H * .02, sr = Math.min(W, H) * .075;
    c.fillStyle = rg(c, sx, sy, 0, sx, sy, Math.max(W, H) * .55, [[0, 'rgba(255,236,170,.9)'], [.08, 'rgba(255,200,110,.55)'], [.3, 'rgba(255,140,90,.2)'], [1, 'rgba(255,120,90,0)']]); c.fillRect(0, 0, W, hz + 4);
    // sun rays
    c.save(); c.globalCompositeOperation = 'lighter'; c.beginPath(); c.rect(0, 0, W, hz + 4); c.clip();
    for (let i = 0; i < 9; i++) { const a = -Math.PI + (i + .5) * Math.PI / 9 + (r() - .5) * .1, w = .06 + r() * .05; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a - w) * H * 1.4, sy + Math.sin(a - w) * H * 1.4); c.lineTo(sx + Math.cos(a + w) * H * 1.4, sy + Math.sin(a + w) * H * 1.4); c.closePath(); c.fillStyle = rg(c, sx, sy, 0, sx, sy, H * .9, [[0, 'rgba(255,214,140,.10)'], [1, 'rgba(255,214,140,0)']]); c.fill(); }
    c.restore();
    ell(c, sx, sy, sr, sr, 0, rg(c, sx, sy, 0, sx, sy, sr, [[0, '#fffbe6'], [.7, '#ffe9a0'], [1, '#ffcf6a']]));
    // clouds
    for (let i = 0; i < 8; i++) {
      const cx = r() * W, cy = hz * (.12 + r() * .6), cw = (60 + r() * 130) * (W / 390 > 1.6 ? 1.6 : 1), ch = cw * (.05 + r() * .04);
      for (let k = 0; k < 4; k++) { const ox = (r() - .5) * cw * .6, oy = (r() - .5) * ch * 1.4; c.save(); c.translate(cx + ox, cy + oy); c.scale(1, ch / cw); c.beginPath(); c.arc(0, 0, cw * (.35 + r() * .25), 0, TAU); c.fillStyle = rg(c, 0, -cw * .1, 0, 0, 0, cw * .6, [[0, 'rgba(255,200,170,' + (.5 - cy / hz * .2) + ')'], [1, 'rgba(255,150,150,0)']]); c.fill(); c.restore(); }
    }
    // hills
    hill(c, W, hz - H * .012, H * .05, 4, '#b0628c', '#c9708a');
    hill(c, W, hz + H * .006, H * .035, 9, '#7c4a7c', '#9a5c7e');
    // far haze band
    c.fillStyle = lg(c, 0, hz - H * .06, 0, hz + H * .02, [[0, 'rgba(255,190,120,0)'], [1, 'rgba(255,190,120,.45)']]); c.fillRect(0, hz - H * .06, W, H * .08);
    // ground
    const gTop = hz - 2;
    c.fillStyle = lg(c, 0, gTop, 0, H, [[0, '#d7a24e'], [.18, '#a2943f'], [.55, '#5b8a36'], [1, '#2f5a2c']]); c.fillRect(0, gTop, W, H - gTop);
    // mowed stripes in perspective
    for (let i = 0; i < 16; i++) { const t0 = Math.pow(i / 16, 1.8), t1 = Math.pow((i + .5) / 16, 1.8); if (i & 1) { c.fillStyle = 'rgba(255,230,140,.09)'; c.fillRect(0, gTop + (H - gTop) * t0, W, (H - gTop) * (t1 - t0)); } }
    // lane
    c.beginPath(); c.moveTo(W * .5 - W * .012, hz); c.lineTo(W * .5 + W * .012, hz); c.lineTo(W * .5 + W * .33, H); c.lineTo(W * .5 - W * .33, H); c.closePath();
    c.fillStyle = lg(c, 0, hz, 0, H, [[0, 'rgba(255,214,150,.45)'], [1, 'rgba(210,160,90,.4)']]); c.fill();
    // cider house at the end of the lane
    const cs = Math.min(W, H) / 390 * .62;
    cider(c, W * .43, hz + 3, cs);
    // rows of trees (back to front)
    const trees = [];
    const rows = [.46, .86, 1.34, 1.9];
    rows.forEach((rw, ri) => { for (let side = -1; side <= 1; side += 2) { let d = .05 + ri * .017; let k = 0; while (d < 1.25) { trees.push({ d, x: W * .5 + side * rw * W * d * .52, seed: ri * 97 + k * 13 + (side > 0 ? 5 : 0) }); d *= 1.34 - ri * .015; k++; } } });
    trees.sort((a, b) => a.d - b.d);
    const sc = Math.min(W, H) / 390 * (land ? 1.0 : 1.0);
    trees.forEach(t => {
      const y = hz + (H - hz) * t.d * .98, s = Math.min(W, H) * .105 * t.d * (land ? 1.25 : 1), depth = Math.pow(Math.min(1, t.d), .55);
      if (t.x < -s * 3 || t.x > W + s * 3) return;
      tree(c, t.x, y, s, depth, t.seed, '#e79a78');
    });
    // atmospheric haze at horizon over everything behind
    c.fillStyle = lg(c, 0, hz - 6, 0, hz + (H - hz) * .22, [[0, 'rgba(255,196,130,.35)'], [1, 'rgba(255,196,130,0)']]); c.fillRect(0, hz - 6, W, (H - hz) * .24 + 6);
    // fallen windfall + grass tufts near camera
    const fr = rng(31);
    for (let i = 0; i < 28; i++) { const x = fr() * W, y = H * (.78 + fr() * .22); tuft(c, x, y, 7 + fr() * 12, 'rgba(' + (60 + (fr() * 40 | 0)) + ',' + (110 + (fr() * 40 | 0)) + ',60,.7)'); }
    hayBale(c, W * (land ? .08 : .13), H - (land ? 30 : 40), Math.min(W, H) * (land ? .1 : .09));
    // calm the orchard floor so flying fruit stays the brightest thing on screen
    c.fillStyle = lg(c, 0, hz, 0, H, [[0, 'rgba(40,16,60,0)'], [1, 'rgba(40,16,60,.2)']]); c.fillRect(0, hz, W, H - hz);
    // vignette & top shade (keeps the HUD readable)
    c.fillStyle = rg(c, W / 2, H * .52, Math.min(W, H) * .35, W / 2, H * .52, Math.max(W, H) * .78, [[0, 'rgba(18,6,34,0)'], [1, 'rgba(18,6,34,.5)']]); c.fillRect(0, 0, W, H);
    c.fillStyle = lg(c, 0, 0, 0, H * .2, [[0, 'rgba(20,8,40,.45)'], [1, 'rgba(20,8,40,0)']]); c.fillRect(0, 0, W, H * .2);
    return cv;
  }

  return { ASSETS, build, makeBackground, rng, drawCore, load, get loadInfo() { return { state: loadState, ms: Math.round(loadMs), painted: Object.keys(FIT).length, bg: !!BGP.img }; } };
})();
