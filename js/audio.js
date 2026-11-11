'use strict';
/* Orchard Slice audio: everything is synthesized with WebAudio (no audio files).
   AUD.unlock() must be called from a user gesture (iOS rule). */
const AUD = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf;
  const on = { sfx: true, mus: true };
  let musTimer = null, nextNote = 0, beat = 0, musRunning = false, lastLaunch = 0;
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26]; // major pentatonic ladder for combo pitch
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { ac = null; return false; }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = 0.55; musBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function unlock() {
    if (!init()) return;
    if (ac.state !== 'running') { try { ac.resume(); } catch (e) {} }
    // iOS: play a silent buffer inside the gesture
    try { const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {}
    if (on.mus && !musRunning) startMusic();
  }
  function suspend() { if (ac && ac.state === 'running') { try { ac.suspend(); } catch (e) {} } }
  function resume() { if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) {} } }

  // ---- building blocks ----
  function tone(f, dur, type, vol, slideTo, delay, bus, attack) {
    if (!ac || !on.sfx && bus !== musBus) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const a = attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, ftype, f0, f1, vol, delay, q, bus) {
    if (!ac || !on.sfx && bus !== musBus) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = ftype || 'bandpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // ---- sound effects ----
  const sfx = {
    slice(step, big, heavy) {
      if (!ac) return;
      const st = SCALE[Math.min(step | 0, SCALE.length - 1)];
      const r = Math.pow(2, st / 12) * (0.96 + Math.random() * 0.08);
      noise(0.14, 'bandpass', 3000 * Math.sqrt(r), 700, 0.34, 0, 1.1);   // swoosh
      noise(0.022, 'highpass', 4200, 2500, 0.3, 0.004, 0.8);               // crisp crunch transient
      tone(720 * r, 0.1, 'triangle', 0.2, 240 * r);                         // pitched thock (rises with combo)
      noise(0.11, 'bandpass', 900, 260, 0.3, 0.018, 2.2);                   // wet squish
      noise(0.07, 'lowpass', 1100, 300, 0.22, 0.015);
      if (heavy) { tone(130, 0.17, 'sine', 0.42, 52, 0.005); noise(0.12, 'lowpass', 500, 120, 0.3, 0.01); }
      if (big) tone(1180 * r, 0.14, 'sine', 0.1, 1500 * r, 0.02);
      // apple crunch: a few tiny crackles right after the cut
      for (let i = 0; i < 3; i++) noise(0.012, 'highpass', 2600 + Math.random() * 1800, 0, 0.16 + Math.random() * 0.08, 0.008 + i * 0.011 + Math.random() * 0.004, 0.9);
    },
    whoosh(speed) {
      if (!ac) return;
      const k = Math.min(1, Math.max(0, (speed - 700) / 2200));
      noise(0.17, 'bandpass', 700 + 500 * k, 2400 + 1600 * k, 0.07 + 0.08 * k, 0, 1.6);
    },
    goldHit(n) {
      if (!ac) return;
      const m = 79 + SCALE[Math.min(n, SCALE.length - 1)];
      tone(hz(m), 0.16, 'triangle', 0.16, 0); tone(hz(m + 12), 0.1, 'sine', 0.07, 0, 0.01);
      noise(0.03, 'highpass', 5000, 0, 0.14, 0, 0.8); noise(0.06, 'bandpass', 1400, 500, 0.16, 0.005, 1.5);
    },
    goldBurst(n) {
      if (!ac) return;
      [72, 76, 79, 84, 88, 91].forEach((m, i) => tone(hz(m), 0.3, 'triangle', 0.13, 0, i * 0.045));
      tone(110, 0.3, 'sine', 0.4, 45); noise(0.5, 'highpass', 4000, 9000, 0.1, 0.05, 0.5); noise(0.25, 'bandpass', 900, 200, 0.3, 0, 1.4);
    },
    clean(n) { if (!ac) return; [84, 88, 91].forEach((m, i) => tone(hz(m), 0.18, 'sine', 0.1, 0, i * 0.04)); noise(0.2, 'highpass', 6000, 9000, 0.05, 0.05, 0.5); },
    daily() { if (!ac) return; [67, 72, 76, 79].forEach((m, i) => tone(hz(m), 0.25, 'triangle', 0.13, 0, i * 0.08)); },
    goal() {
      if (!ac) return;
      [76, 81, 84, 88].forEach((m, i) => tone(hz(m), 0.32, 'triangle', 0.14, 0, i * 0.07));
      tone(hz(93), 0.6, 'sine', 0.1, 0, 0.3);
      noise(0.4, 'highpass', 6000, 9000, 0.06, 0.25, 0.5);
    },
    slowmo() { if (!ac) return; tone(220, 0.5, 'sine', 0.18, 90); noise(0.45, 'bandpass', 1800, 300, 0.12, 0, 0.9); },
    launch() {
      if (!ac) return;
      const n = ac.currentTime; if (n - lastLaunch < 0.07) return; lastLaunch = n;
      noise(0.2, 'lowpass', 500 + Math.random() * 300, 1400, 0.07, 0, 0.7);
    },
    combo(n) {
      if (!ac) return;
      const base = 72 + Math.min(n, 8);
      const notes = [0, 4, 7, 12, 16].slice(0, Math.min(5, n - 1));
      notes.forEach((m, i) => tone(hz(base + m), 0.2, 'triangle', 0.13, 0, i * 0.055));
      if (n >= 5) noise(0.3, 'highpass', 5000, 7000, 0.07, 0.05, 0.5);
    },
    miss() {
      if (!ac) return;
      tone(330, 0.3, 'sine', 0.28, 110);
      tone(70, 0.22, 'sine', 0.38, 40, 0.02);
      noise(0.12, 'lowpass', 400, 120, 0.15, 0.02);
    },
    hive() {
      if (!ac) return;
      const t = ac.currentTime;
      // bee swarm buzz: sawtooth with fast tremolo
      const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 1.4;
      o.type = 'sawtooth'; o2.type = 'sawtooth';
      o.frequency.setValueAtTime(150, t); o.frequency.linearRampToValueAtTime(105, t + 1.2);
      o2.frequency.setValueAtTime(158, t); o2.frequency.linearRampToValueAtTime(112, t + 1.2);
      lfo.frequency.value = 34; lg.gain.value = 0.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.05);
      g.gain.setValueAtTime(0.45, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus);
      o.start(t); o2.start(t); lfo.start(t); o.stop(t + 1.4); o2.stop(t + 1.4); lfo.stop(t + 1.4);
      tone(95, 0.28, 'sine', 0.45, 38);
      tone(247, 0.35, 'square', 0.07, 233, 0.02);
      tone(233, 0.35, 'square', 0.07, 220, 0.02);
      noise(0.2, 'lowpass', 800, 200, 0.2);
    },
    maple() {
      if (!ac) return;
      [88, 91, 95, 100, 103].forEach((m, i) => tone(hz(m), 0.3, 'sine', 0.12, 0, i * 0.055));
      noise(0.35, 'highpass', 6000, 9000, 0.06, 0.02, 0.5);
    },
    donut() {
      if (!ac) return;
      [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(hz(m), 0.22, 'triangle', 0.15, 0, i * 0.06));
      tone(hz(88), 0.5, 'sine', 0.1, 0, 0.42);
      noise(0.6, 'highpass', 4000, 8000, 0.08, 0.1, 0.5);
    },
    tick() { tone(900, 0.06, 'square', 0.06, 0); },
    warn() { tone(520, 0.08, 'square', 0.07, 0); },
    click() { tone(620, 0.07, 'triangle', 0.15, 880); },
    over() {
      if (!ac) return;
      [67, 64, 60, 55].forEach((m, i) => tone(hz(m), 0.34, 'triangle', 0.18, 0, i * 0.17));
    },
    best() {
      if (!ac) return;
      [60, 64, 67, 72, 67, 72, 76, 84].forEach((m, i) => tone(hz(m), 0.26, 'triangle', 0.16, 0, i * 0.095));
      noise(0.5, 'highpass', 5000, 8000, 0.07, 0.4, 0.5);
    },
    timeup() {
      if (!ac) return;
      [72, 67, 64].forEach((m, i) => tone(hz(m), 0.3, 'triangle', 0.17, 0, i * 0.14));
    },
    wave() { tone(hz(79), 0.14, 'triangle', 0.1, 0); tone(hz(86), 0.2, 'triangle', 0.1, 0, 0.09); }
  };

  // ---- background music: a folky 16-bar tune (A and B phrases) with layers that build with the game ----
  // intensity 0 = title (pluck arp, bass, soft lead), 1 = playing (+ brushed drums), 2 = frenzy (+ 16th shaker, lead an octave up).
  let EIGHTH = 60 / 100 / 2, tr = 0, soft = false, theme = { bpm: 100, tr: 0, soft: false };
  const THEMES = { title: { bpm: 100, tr: 0, tune: 0 }, classic: { bpm: 100, tr: 0, tune: 0 }, timed: { bpm: 112, tr: 2, tune: 0 }, daily: { bpm: 104, tr: 0, tune: 1 }, zen: { bpm: 84, tr: -2, soft: true, tune: 1 } };
  const CH = { C: [60, 64, 67, 72], G: [55, 59, 62, 67], Am: [57, 60, 64, 69], F: [53, 57, 60, 65] };
  const PROG = ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C', 'Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'];
  const ROOT = { C: 36, G: 31, Am: 33, F: 29 };
  const MEL = [ // 16 bars x 8 eighths, midi, 0 = rest (original tune)
    [72, 0, 76, 79, 0, 76, 74, 72], [74, 0, 71, 74, 79, 0, 77, 76], [76, 0, 72, 76, 81, 79, 76, 0], [77, 76, 74, 0, 72, 0, 69, 0],
    [72, 0, 76, 79, 84, 0, 83, 81], [79, 0, 74, 79, 83, 81, 79, 0], [77, 0, 81, 77, 74, 0, 71, 74], [72, 0, 0, 0, 67, 0, 0, 0],
    [81, 0, 84, 81, 79, 0, 76, 0], [77, 0, 81, 77, 72, 0, 0, 0], [76, 0, 79, 76, 72, 0, 79, 0], [74, 0, 79, 74, 71, 0, 0, 0],
    [76, 77, 79, 0, 81, 0, 84, 0], [86, 0, 84, 81, 77, 0, 81, 0], [79, 0, 83, 86, 83, 0, 79, 0], [74, 0, 0, 0, 71, 0, 74, 0]
  ];
  // a second original tune ("Lake Road"): minor-leaning, for Zen and the Daily Harvest
  const PROG2 = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G', 'F', 'G', 'C', 'Am', 'F', 'G', 'C', 'C'];
  const MEL2 = [
    [69, 0, 72, 0, 76, 0, 74, 72], [72, 0, 69, 0, 65, 0, 69, 0], [67, 0, 72, 76, 79, 0, 76, 0], [74, 0, 71, 0, 67, 0, 71, 74],
    [76, 0, 72, 69, 72, 0, 76, 0], [77, 0, 76, 74, 72, 0, 69, 0], [71, 0, 74, 0, 79, 77, 74, 0], [71, 0, 0, 0, 74, 0, 71, 0],
    [77, 0, 81, 0, 84, 0, 81, 77], [79, 0, 83, 0, 86, 0, 83, 79], [84, 0, 79, 76, 72, 0, 76, 79], [81, 0, 76, 0, 72, 0, 76, 0],
    [77, 0, 72, 0, 69, 72, 77, 0], [79, 0, 74, 0, 71, 74, 79, 0], [76, 0, 79, 84, 79, 0, 76, 0], [72, 0, 0, 0, 0, 0, 0, 0]
  ];
  let tune = 0;
  let intensity = 0, layer = { lead: null, drums: null, fz: null, pad: null };
  function pad(ch, t, dur) { // warm two-saw pad under each bar, softly filtered
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 850; f.Q.value = 0.4;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.028, t + 0.35); g.gain.setValueAtTime(0.028, t + dur - 0.3); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(layer.pad);
    [ch[0], ch[1], ch[2]].forEach((m, i) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = i === 1 ? -7 : 6; o.connect(f); o.start(t); o.stop(t + dur + 0.05); });
  }
  function pluck(m, t, vol, dur, bus, type, bright) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = type || 'triangle'; o.frequency.value = hz(m);
    f.type = 'lowpass'; f.frequency.setValueAtTime(bright || 3200, t); f.frequency.exponentialRampToValueAtTime(600, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(bus || musBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(t, bus) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.25);
  }
  function drumNoise(t, dur, type, f0, vol, q, bus) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = f0; f.Q.value = q || 0.8;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function mkLayer() { const g = ac.createGain(); g.gain.value = 0.0001; g.connect(musBus); return g; }
  function applyIntensity(now) {
    if (!layer.lead) return;
    const T = now || ac.currentTime;
    layer.lead.gain.setTargetAtTime(intensity >= 1 ? 1 : 0.55, T, 0.25);
    layer.drums.gain.setTargetAtTime(intensity >= 1 ? 1 : 0.0001, T, intensity >= 1 ? 0.3 : 0.15);
    layer.fz.gain.setTargetAtTime(intensity >= 2 ? 1 : 0.0001, T, 0.08);
    layer.pad.gain.setTargetAtTime(intensity >= 1 ? 1 : 0.7, T, 0.4);
  }
  function scheduleMusic() {
    if (!ac || !musRunning) return;
    while (nextNote < ac.currentTime + 0.4) {
      if (beat % 8 === 0) { EIGHTH = 60 / theme.bpm / 2; tr = theme.tr; soft = !!theme.soft; if ((theme.tune || 0) !== tune) { tune = theme.tune || 0; beat = 0; } }
      const P = tune ? PROG2 : PROG, M = tune ? MEL2 : MEL;
      const bar = Math.floor(beat / 8) % 16, e = beat % 8, ch0 = CH[P[bar]], ch = ch0.map(m => m + tr), t = nextNote, B = bar >= 8;
      if (e === 0) pad(ch, t, EIGHTH * 8);
      // pluck arpeggio (banjo-ish roll); in the B phrase it turns into a bright music-box bell an octave up
      if (B) pluck(ch[[0, 2, 1, 3, 2, 1, 3, 2][e]] + 12, t, 0.04, 0.5, null, 'sine', 5000);
      else pluck(ch[[0, 2, 1, 3, 2, 1, 3, 2][e]], t, 0.055, 0.32);
      const root = ROOT[P[bar]] + tr;
      if (e === 0) pluck(root, t, 0.17, 0.55);
      if (e === 4) pluck(root + 7, t, 0.12, 0.4);
      if (e === 6 && bar % 4 === 3) pluck(root + 12, t, 0.1, 0.25);
      // lead melody (and its frenzy octave double)
      const m = M[bar][e] ? M[bar][e] + tr : 0;
      if (m) { if (B) pluck(m, t, 0.06, 0.5, layer.lead, 'square', 1500); else pluck(m, t, 0.085, 0.42, layer.lead); pluck(m + 12, t, 0.04, 0.22, layer.fz, 'square', 2400); }
      // brushed drums: kick on 1 and the "and" of 3, brush snare on 2 and 4, shaker on the offbeats
      if (e === 0 || (e === 5 && !soft)) kick(t, layer.drums);
      if (e === 2 || e === 6) drumNoise(t, 0.12, 'bandpass', 1900, 0.16, 0.7, layer.drums);
      if (bar % 8 === 7 && e >= 4) { drumNoise(t + EIGHTH / 2, 0.08, 'bandpass', 2100, 0.11, 0.8, layer.drums); if (e === 7) kick(t + EIGHTH / 2, layer.drums); } // fill into the next phrase
      if (e % 2 === 1) drumNoise(t, 0.035, 'highpass', 7000, 0.06, 0.5, layer.drums);
      // frenzy: 16th-note shaker and a clap on 2 and 4
      drumNoise(t, 0.03, 'highpass', 8000, 0.05, 0.5, layer.fz); drumNoise(t + EIGHTH / 2, 0.03, 'highpass', 8000, 0.035, 0.5, layer.fz);
      if (e === 2 || e === 6) drumNoise(t, 0.09, 'bandpass', 1200, 0.18, 1.2, layer.fz);
      nextNote += EIGHTH; beat++;
    }
  }
  function startMusic() {
    if (!ac || musRunning || !on.mus) return;
    if (!layer.lead) { layer.lead = mkLayer(); layer.drums = mkLayer(); layer.fz = mkLayer(); layer.pad = mkLayer(); }
    musRunning = true; nextNote = ac.currentTime + 0.1; beat = 0; applyIntensity();
    musTimer = setInterval(scheduleMusic, 90); scheduleMusic();
  }
  function stopMusic() { musRunning = false; if (musTimer) { clearInterval(musTimer); musTimer = null; } }

  return {
    unlock, suspend, resume, sfx,
    get on() { return on; },
    setSfx(v) { on.sfx = !!v; },
    setMusic(v) { on.mus = !!v; if (on.mus) { if (ac) startMusic(); } else stopMusic(); },
    duck(v) { if (musBus) musBus.gain.setTargetAtTime(v ? 0.2 : 0.55, ac.currentTime, 0.1); },
    theme(name) { theme = THEMES[name] || THEMES.title; },
    intensity(n) { if (n === intensity) return; intensity = n; if (ac) applyIntensity(); },
    get musicInfo() { return { running: musRunning, intensity, beat }; }
  };
})();
