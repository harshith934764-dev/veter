/* ============================================================
   IPL 2026 — SYNTHESIZED SOUND ENGINE
   Fully synthesized via Web Audio API — no external assets:
   bat cracks, wicket appeals, boundary stings, crowd ambience,
   crowd roars and groans. Preference persisted on this device
   under 'ipl2026-sound' ('on' | 'off').
   ============================================================ */
'use strict';

window.IPLSFX = (function(){
  const STORE = 'ipl2026-sound';
  let enabled = true;
  try { enabled = localStorage.getItem(STORE) !== 'off'; } catch(e){}
  const isOn = () => (window.IPLAudio ? window.IPLAudio.isAudioOn() : enabled);

  let ctx = null, master = null, noiseBuf = null;
  let ambience = null;   // { src, gain, lfo, lfoGain, hiSrc, hiGain }
  let ambientWanted = false;

  function buildNoise(){
    // 2s white-noise buffer, reused by everything noisy
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function ac(){
    if(ctx) return ctx;
    // preferred path: share ONE AudioContext with the music system + the mixer buses
    if(window.IPLAudio && window.IPLAudio.getBuses){
      const buses = window.IPLAudio.getBuses();
      if(buses){
        ctx = buses.sfx.context;
        master = ctx.createGain();
        master.gain.value = 1;
        master.connect(buses.sfx);   // SFX run through the shared SFX bus (volume slider applies)
        buildNoise();
        return ctx;
      }
    }
    // standalone fallback (e.g. audio.js missing) — old behavior
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);
    buildNoise();
    return ctx;
  }

  /* ── real crowd recordings (SoundDino, royalty-free) — decoded lazily ── */
  const SAMPLE_MANIFEST = {
    six:     'assets/audio/six-shout.mp3',
    four:    'assets/audio/four-shout.mp3',
    wow:     'assets/audio/crowd-roar-wow.mp3',
    stadium: 'assets/audio/stadium-crowd-loop.mp3',
  };
  const samples = {};
  let samplesLoading = false, samplesLoaded = false;
  function loadSamples(){
    if(samplesLoaded || samplesLoading) return;
    if(window.IPLAudio && window.IPLAudio.isFile && window.IPLAudio.isFile()){
      samplesLoaded = true;   /* file:// can't fetch — synth roars take over silently */
      return;
    }
    samplesLoading = true;
    const c = ac(); if(!c) { samplesLoading = false; return; }
    const jobs = Object.entries(SAMPLE_MANIFEST).map(([key, url]) =>
      fetch(url).then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
        .then(buf => new Promise((res, rej) => c.decodeAudioData(buf, res, rej)))
        .then(decoded => { samples[key] = decoded; })
        .catch(e => { console.warn('audio sample unavailable:', key, e); })
    );
    Promise.all(jobs).then(() => {
      samplesLoaded = true; samplesLoading = false;
      // if the match already started, attach the recorded walla late
      if(ambientWanted && ambience && !ambience.stadium && samples.stadium && ctx){
        try {
          const ssrc = ctx.createBufferSource(); ssrc.buffer = samples.stadium; ssrc.loop = true;
          const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, now());
          sg.gain.exponentialRampToValueAtTime(0.16, now() + 1.2);
          ssrc.connect(sg); sg.connect(master);
          ssrc.start(now());
          ambience.stadium = { src: ssrc, g: sg };
        } catch(e){}
      }
    });
  }
  /* plays a decoded sample; returns false when unavailable so callers can fall back to synth */
  function playSample(name, gain, t0, loop){
    const buf = samples[name];
    if(!buf || !ctx) return false;
    try {
      const srcNode = ctx.createBufferSource();
      srcNode.buffer = buf;
      srcNode.loop = !!loop;
      const g = gainAt(t0 || now(), gain || 1);
      srcNode.connect(g);
      srcNode.start(t0 || now());
      if(!loop) srcNode.stop((t0 || now()) + buf.duration + 0.05);
      return true;
    } catch(e) { return false; }
  }
  function resume(){ try { const c = ac(); if(c && c.state === 'suspended') c.resume(); } catch(e){} }
  // begin decoding crowd recordings in the background (page is same-origin/local)
  try { setTimeout(loadSamples, 150); } catch(e){}

  // any user gesture unlocks/resumes audio
  if(typeof document !== 'undefined'){
    const unlock = () => resume();
    document.addEventListener('click', unlock, { passive: true });
    document.addEventListener('keydown', unlock, { passive: true });
  }
  const now = () => ctx.currentTime;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function gainAt(t0, peak){
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
    g.connect(master);
    return g;
  }
  /* oscillator with optional pitch ramp */
  function osc(type, freq, t0, dur, peak, freqEnd, dest){
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if(freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    const g = gainAt(t0, peak);
    o.connect(g);
    if(dest) dest(g);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  /* filtered noise with optional filter sweep */
  function noise(t0, dur, peak, filterType, freq, freqEnd, Q, dest){
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(freq, t0);
    if(freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + dur);
    f.Q.value = Q || 0.9;
    const g = gainAt(t0, peak);
    src.connect(f); f.connect(g);
    if(dest) dest(g);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }
  function call(fn){
    if(!isOn()) return;
    const c = ac(); if(!c) return;
    resume();
    try { fn(now()); } catch(e){ /* never break the game over audio */ }
  }

  /* ── bat ─────────────────────────────────────────── */
  function batCrack(t0, power){
    const p = clamp(power || 1, 0.35, 1.4);
    noise(t0, 0.045, 0.34 * p, 'bandpass', 2300, 1500, 9);      // the crack itself
    osc('triangle', 205, t0, 0.10, 0.5 * p, 68);                 // woody thump
    noise(t0, 0.018, 0.18 * p, 'highpass', 4200, null, 0.7);     // edge click
  }

  /* ── crowd ───────────────────────────────────────── */
  function startAmbience(){
    ambientWanted = true;
    if(!enabled) return;
    const c = ac(); if(!c) return;
    resume();
    if(ambience) return;
    try {
      const t0 = now();
      // low roar bed
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480; lp.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 1.4);
      // slow swell LFO so the crowd breathes
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; lfo.type = 'sine';
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.016;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      src.connect(lp); lp.connect(g); g.connect(master);
      // faint upper crowd hiss
      const hi = ctx.createBufferSource(); hi.buffer = noiseBuf; hi.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 0.5;
      const hg = ctx.createGain(); hg.gain.setValueAtTime(0.0001, t0);
      hg.gain.exponentialRampToValueAtTime(0.012, t0 + 1.6);
      hi.connect(bp); bp.connect(hg); hg.connect(master);
      src.start(t0); hi.start(t0); lfo.start(t0);
      // real stadium walla underneath the synth bed (constant low level)
      let stadium = null;
      if(samples.stadium){
        try {
          const ssrc = ctx.createBufferSource(); ssrc.buffer = samples.stadium; ssrc.loop = true;
          const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t0);
          sg.gain.exponentialRampToValueAtTime(0.16, t0 + 1.5);
          ssrc.connect(sg); sg.connect(master);
          ssrc.start(t0);
          stadium = { src: ssrc, g: sg };
        } catch(e){}
      }
      ambience = { src, g, lfo, lfoGain, hi, hg, stadium };
    } catch(e){}
  }
  function stopAmbience(fadeMs){
    ambientWanted = false;
    const a = ambience; if(!a) return;
    ambience = null;
    try {
      const t0 = now(), f = clamp((fadeMs || 700) / 1000, 0.15, 3);
      a.g.gain.cancelScheduledValues(t0); a.g.gain.setValueAtTime(Math.max(0.0002, a.g.gain.value), t0);
      a.g.gain.exponentialRampToValueAtTime(0.0001, t0 + f);
      a.hg.gain.cancelScheduledValues(t0); a.hg.gain.setValueAtTime(Math.max(0.0002, a.hg.gain.value), t0);
      a.hg.gain.exponentialRampToValueAtTime(0.0001, t0 + f);
      if(a.stadium){
        a.stadium.g.gain.cancelScheduledValues(t0);
        a.stadium.g.gain.setValueAtTime(Math.max(0.0002, a.stadium.g.gain.value), t0);
        a.stadium.g.gain.exponentialRampToValueAtTime(0.0001, t0 + f);
        a.stadium.src.stop(t0 + f + 0.05);
      }
      a.src.stop(t0 + f + 0.05); a.hi.stop(t0 + f + 0.05); a.lfo.stop(t0 + f + 0.05);
    } catch(e){}
  }
  function duckAmbience(level, holdMs){
    const a = ambience; if(!a || !ctx) return;
    try {
      const t0 = now(), hold = clamp((holdMs || 650) / 1000, 0.2, 2);
      a.g.gain.cancelScheduledValues(t0);
      a.g.gain.setValueAtTime(a.g.gain.value, t0);
      a.g.gain.exponentialRampToValueAtTime(0.018 * (level || 1), t0 + 0.18);
      a.g.gain.exponentialRampToValueAtTime(0.05, t0 + hold);
      if(a.stadium){
        a.stadium.g.gain.cancelScheduledValues(t0);
        a.stadium.g.gain.setValueAtTime(Math.max(0.0002, a.stadium.g.gain.value), t0);
        a.stadium.g.gain.exponentialRampToValueAtTime(0.07 * (level || 1), t0 + 0.18);
        a.stadium.g.gain.exponentialRampToValueAtTime(0.16, t0 + hold);
      }
    } catch(e){}
  }
  function roar(t0, intensity){
    const k = clamp(intensity || 1, 0.4, 1.6);
    // crowd swell — band sweep down as thousands rise
    noise(t0, 2.1 * k, 0.22 * k, 'bandpass', 480, 1150, 0.55);
    noise(t0 + 0.12, 1.7 * k, 0.14 * k, 'bandpass', 750, 1500, 0.7);
    osc('sine', 58, t0, 0.7 * k, 0.16 * k, 44);          // sub thump of approval
  }
  function groan(t0){
    noise(t0, 1.15, 0.13, 'bandpass', 780, 310, 0.8);
    osc('sawtooth', 108, t0, 0.9, 0.05, 79);
  }

  /* ── stumps / appeals ────────────────────────────── */
  function stumps(t0){
    [0, 0.055, 0.135].forEach((d, i) => noise(t0 + d, 0.03, 0.22 - i * 0.05, 'bandpass', 2350 - i * 250, null, 7));
    osc('sine', 92, t0, 0.16, 0.2, 61);
  }
  function appeal(t0){
    // staccato HOOO — stacked saws through a megaphone-ish bandpass
    [196, 247, 294].forEach(f => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.075, t0 + 0.03);
      g.gain.setValueAtTime(0.075, t0 + 0.30);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
      o.connect(bp); bp.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.46);
    });
  }

  /* ── public SFX ──────────────────────────────────── */
  const SFX = {
    loadSamples,
    sampleStatus: () => ({ loaded: Object.keys(samples), done: samplesLoaded }),
    isEnabled: () => isOn(),
    setEnabled(v){
      enabled = !!v;
      try { localStorage.setItem(STORE, enabled ? 'on' : 'off'); } catch(e){}
      if(window.IPLAudio && window.IPLAudio.setAudioOn){
        window.IPLAudio.setAudioOn(enabled);   // master switch: music + SFX + ambience
        return window.IPLAudio.isAudioOn();
      }
      if(!enabled) stopAmbience(300);
      else if(ambientWanted) startAmbience();
      return enabled;
    },
    click(){
      if(window.IPLAudio && !window.IPLAudio.throttle('ui-click', 45)) return;
      call(t0 => osc('triangle', 880, t0, 0.055, 0.05));
    },
    navigate(){
      if(window.IPLAudio && !window.IPLAudio.throttle('ui-nav', 45)) return;
      call(t0 => { osc('triangle', 1320, t0, 0.05, 0.038); osc('sine', 1760, t0 + 0.035, 0.05, 0.022); });
    },
    whoosh(){
      if(window.IPLAudio && !window.IPLAudio.throttle('ui-whoosh', 90)) return;
      call(t0 => noise(t0, 0.16, 0.05, 'bandpass', 620, 1500, 1.1));
    },
    reward(){
      call(t0 => {
        // sparkle of a reward chime — high bells in quick ladder
        [1318.5, 1568, 2093, 2637].forEach((f, i) => osc('sine', f, t0 + 0.30 + i * 0.085, 0.22, 0.05));
        osc('triangle', 392, t0 + 0.30, 0.4, 0.05);
      });
    },

    run(runs){
      call(t0 => {
        batCrack(t0, 0.85);
        const n = clamp(runs || 1, 1, 3);
        for(let i = 0; i < n; i++) osc('sine', 620 + i * 60, t0 + 0.14 + i * 0.075, 0.07, 0.055);
        // footsteps — batters scrambling between the creases
        const steps = 1 + n * 2;
        for(let i = 0; i < steps; i++){
          const f = 680 + (i % 2) * 130 + Math.random() * 80;   // alternate heel/toe pitch
          noise(t0 + 0.18 + i * 0.155, 0.028, 0.055, 'bandpass', f, null, 1.6);
        }
      });
    },
    four(){
      call(t0 => {
        batCrack(t0, 1.15);
        [659.26, 783.99, 987.77].forEach((f, i) => osc('triangle', f, t0 + 0.12 + i * 0.09, 0.14, 0.06));
        if(!playSample('four', 0.6, t0 + 0.10)) roar(t0 + 0.15, 0.8);
      });
    },
    six(){
      call(t0 => {
        batCrack(t0, 1.35);
        [587.33, 739.99, 880, 1174.66].forEach((f, i) => osc('triangle', f, t0 + 0.13 + i * 0.105, 0.17, 0.07));
        if(!playSample('six', 1.0, t0 + 0.12)) roar(t0 + 0.18, 1.25);
        osc('sine', 49, t0 + 0.05, 0.55, 0.16, 38);
      });
    },
    wicket(kind){
      call(t0 => {
        appeal(t0);
        if(kind === 'bowled' || kind === 'c&b') stumps(t0 + 0.32);
        else osc('sine', 140, t0 + 0.30, 0.12, 0.09, 95);   // glove/turf thump for the catch & co.
        if(!playSample('wow', 0.75, t0 + 0.38)) roar(t0 + 0.40, kind === 'bowled' ? 1.1 : 0.9);
      });
    },
    dot(){
      call(t0 => {
        osc('sine', 155, t0, 0.07, 0.05, 110);
        noise(t0, 0.05, 0.045, 'lowpass', 900);
        duckAmbience(0.7, 600);
      });
    },
    wide(){ call(t0 => { osc('square', 2100, t0, 0.16, 0.028); duckAmbience(0.85, 450); }); },
    noball(){ call(t0 => { osc('square', 2450, t0, 0.09, 0.035); osc('square', 2450, t0 + 0.14, 0.16, 0.035); duckAmbience(0.85, 450); }); },

    inningsBreak(){
      call(t0 => { [523.25, 659.25, 783.99].forEach((f, i) => osc('triangle', f, t0 + i * 0.11, 0.18, 0.06)); });
    },
    win(){
      call(t0 => {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => osc('triangle', f, t0 + i * 0.13, 0.26, 0.075));
        if(!playSample('wow', 0.9, t0 + 0.25)) roar(t0 + 0.25, 1.45);
      });
    },
    tie(){
      call(t0 => {
        [440, 523.25, 659.25, 880].forEach((f, i) => osc('triangle', f, t0 + i * 0.16, 0.34, 0.06));
        roar(t0 + 0.2, 0.7);
      });
    },

    startAmbience, stopAmbience,
  };
  return SFX;
})();
