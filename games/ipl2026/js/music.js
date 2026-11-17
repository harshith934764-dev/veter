/* ============================================================
   IPL 2026 — BACKGROUND MUSIC MANAGER
   Scene-aware soundtrack with lazy decoding (RAM friendly),
   one track at a time (old track fades out, then stops — never
   two soundtracks stacking) and smooth fade-in / fade-out.

   Tracks ship in assets/audio/ — Mixkit License, free for any
   project, no attribution required:
     Life's a Movie · Serene View · Sports Highlights
     Games Music  · Welcome to The Games
   ============================================================ */
'use strict';

window.IPLMusic = (function(){
  const TRACKS = {
    menu:     'assets/audio/music-menu.mp3',      /* Life's a Movie — epic & hopeful */
    calm:     'assets/audio/music-calm.mp3',      /* Serene View — peaceful piano */
    gameplay: 'assets/audio/music-gameplay.mp3',  /* Sports Highlights — rock energy */
    intense:  'assets/audio/music-intense.mp3',   /* Games Music — breakbeat pressure */
    victory:  'assets/audio/music-victory.mp3',   /* Welcome to The Games — brass march */
  };
  const FADE_SLOW = 900, FADE_QUICK = 300;

  const buffers = {};   /* decoded AudioBuffers, cached after first use */
  const loading = {};   /* in-flight decode promises */
  const elements = {};  /* key -> looping HTMLAudioElement (file:// fallback) */
  const useElements = () => !!(window.IPLAudio && window.IPLAudio.isFile && window.IPLAudio.isFile());
  const musicLevel = () => (window.IPLAudio && window.IPLAudio.busLevel ? window.IPLAudio.busLevel('music') : 0.6);
  function elementFor(key){
    let el = elements[key];
    if(!el){
      el = new Audio(TRACKS[key]);
      el.loop = true; el.preload = 'auto'; el.volume = 0;
      elements[key] = el;
    }
    return el;
  }
  function fadeElement(el, target, ms){
    target = Math.max(0, Math.min(1, target));
    const steps = Math.max(1, Math.round((ms || 250) / 60));
    const start = el.volume;
    let i = 0;
    if(el._fadeTimer) clearInterval(el._fadeTimer);
    el._fadeTimer = setInterval(() => {
      i += 1; const k = Math.min(1, i / steps);
      el.volume = Math.max(0, Math.min(1, start + (target - start) * k));
      if(k >= 1){ clearInterval(el._fadeTimer); el._fadeTimer = null; }
    }, 60);
  }
  let currentKey = null, currentSrc = null, currentGain = null;
  let reqId = 0;        /* supersede stale async decodes */
  let desiredKey = null;/* last requested track — in-flight or playing */
  let lastScene = 'mode';
  let desiredWhenEnabled = null;   /* track that was requested while audio was off */
  let started = 0;      /* diagnostics counter */

  const ctx = () => (window.IPLAudio && window.IPLAudio.ac ? window.IPLAudio.ac() : null);
  const buses = () => (window.IPLAudio && window.IPLAudio.getBuses ? window.IPLAudio.getBuses() : null);

  function loadTrack(key){
    if(buffers[key]) return Promise.resolve(buffers[key]);
    if(loading[key]) return loading[key];
    const c = ctx(); if(!c) return Promise.resolve(null);
    loading[key] = fetch(TRACKS[key])
      .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(buf => new Promise((res, rej) => c.decodeAudioData(buf, res, rej)))
      .then(decoded => { buffers[key] = decoded; return decoded; })
      .catch(e => { console.warn('music track unavailable:', key, e && e.message); return null; })
      .finally(() => { loading[key] = null; });
    return loading[key];
  }

  /* which track plays on which scene */
  const SCENE_TRACK = {
    mode: 'menu', team1: 'menu', team2: 'menu', xi: 'menu', confirm: 'menu', seasonTeam: 'menu',
    season: 'calm', matchxi: 'calm', stats: 'calm', toss: 'calm',
    match: 'gameplay',
  };

  function current(){ return currentKey; }

  function startBuffer(key, buffer, fadeInMs){
    const c = ctx(), b = buses(); if(!c || !b) return;
    const src = c.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const g = c.createGain();
    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(1, t0 + Math.max(0.05, fadeInMs / 1000));
    src.connect(g); g.connect(b.music);
    src.start(t0);
    currentKey = key; currentSrc = src; currentGain = g; started += 1;
  }

  function stop(fadeMs){
    reqId += 1; /* cancel any pending async start */
    desiredKey = null;
    const c = ctx();
    const src = currentSrc, g = currentGain;
    currentKey = null; currentSrc = null; currentGain = null;
    const fMs = Math.max(80, fadeMs == null ? 400 : fadeMs);
    /* <audio> element path */
    if(src && src.element){
      const el = src.element;
      fadeElement(el, 0, fMs);
      if(el._pauseTimer) clearTimeout(el._pauseTimer);
      el._pauseTimer = setTimeout(() => { try { el.pause(); el.currentTime = 0; } catch(e){} }, fMs + 120);
      return;
    }
    /* Web Audio path */
    if(!src || !c || !g) return;
    const f = Math.max(0.08, fMs / 1000);
    try {
      const t0 = c.currentTime;
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(Math.max(0.0002, g.gain.value), t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + f);
      src.stop(t0 + f + 0.05);
    } catch(e){ try { src.stop(); } catch(_){} }
  }

  function play(key, opts){
    if(!TRACKS[key]) return false;
    const c = ctx(); if(!c) return false;
    opts = opts || {};
    if(!window.IPLAudio.isAudioOn()){ desiredWhenEnabled = key; return false; }
    desiredWhenEnabled = null;
    if(desiredKey === key && (currentSrc || loading[key])) return true;  /* already playing / on its way */
    /* keep lastScene honest so scene-restore lands in the right vibe */
    if(key === 'gameplay' || key === 'intense' || key === 'victory') lastScene = 'match';
    stop(opts.fadeOutMs == null ? FADE_QUICK + 150 : opts.fadeOutMs);   /* fade old out, never stack */
    desiredKey = key;
    const fadeIn = opts.fadeInMs == null ? FADE_SLOW : opts.fadeInMs;
    if(useElements()){
      /* file:// double-click — plain <audio> elements, driven by the same settings */
      const el = elementFor(key);
      fadeElement(el, musicLevel(), fadeIn);
      try {
        const p = el.play();
        if(p && p.then){
          p.then(() => { currentKey = key; currentSrc = { element: el }; currentGain = null; started += 1; })
           .catch(() => { desiredKey = null; });   /* autoplay blocked — audio-ui retries on next gesture */
        } else {
          currentKey = key; currentSrc = { element: el }; currentGain = null; started += 1;
        }
      } catch(e){ desiredKey = null; }
      return true;
    }
    const myReq = ++reqId;
    loadTrack(key).then(buffer => {
      if(!buffer || myReq !== reqId) return;             /* superseded while decoding */
      if(!window.IPLAudio.isAudioOn()) return;           /* user turned audio off meanwhile */
      startBuffer(key, buffer, fadeIn);
    });
    return true;
  }

  /* play the right track for a screen name (or the last known scene) */
  function playScene(screen){
    if(screen) lastScene = screen;
    const key = SCENE_TRACK[lastScene] || 'menu';
    return play(key, { fadeInMs: FADE_SLOW });
  }

  /* named situations — called by the match engine at phase transitions */
  function setSituation(kind){
    switch(kind){
      case 'match':   return play('gameplay');
      case 'intense': return play('intense', { fadeInMs: 650 });
      case 'break':   return play('calm');
      case 'win':     return play('victory', { fadeInMs: 700 });
      case 'lost':    return play('calm', { fadeInMs: 1200 });
      case 'tie':     return play('calm', { fadeInMs: 1200 });
      default:        return playScene();
    }
  }

  /* on re-enable: resume the track that was wanted while muted, else the scene default */
  function resume(){
    if(desiredWhenEnabled){ const k = desiredWhenEnabled; return play(k, { fadeInMs: FADE_SLOW }); }
    return playScene();
  }

  /* diagnostics for tests/probes */
  function debug(){
    return { current: currentKey, desiredKey, buffered: Object.keys(buffers), started, reqId, lastScene, desiredWhenEnabled };
  }

  /* keep <audio> elements in sync with the mixer when settings change */
  if(window.IPLAudio && window.IPLAudio.onChange){
    window.IPLAudio.onChange(() => {
      for(const k in elements){
        const el = elements[k];
        if(currentKey === k && !el.paused) fadeElement(el, musicLevel(), 180);
      }
    });
  }

  return {
    play, playScene, setSituation, stop, current, resume, debug, SCENE_TRACK, TRACKS,
  };
})();
