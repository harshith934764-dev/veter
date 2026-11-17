/* ============================================================
   IPL 2026 — VOICE COMMENTARY
   Calm, analyst-style ball-by-ball commentary pre-recorded with a
   single broadcast voice (shipped in assets/audio/commentary/).
   One clip plays at a time — a new call is skipped while a clip is
   playing, exactly like a live broadcast never talks over itself.
   Missing files are cached and skipped silently (game never breaks).
   Routed through its OWN mixer bus so the Commentary slider controls
   it independently of Music and Effects.
   ============================================================ */
'use strict';

window.IPLCommentary = (function(){
  const BASE = 'assets/audio/commentary/';
  /* full planned library — clips are added to the vault as they are recorded */
  const CLIPS = {
    intro:        ['intro-1.mp3', 'intro-2.mp3'],
    four:         ['four-1.mp3', 'four-2.mp3', 'four-3.mp3', 'four-4.mp3', 'four-5.mp3'],
    six:          ['six-1.mp3', 'six-2.mp3', 'six-3.mp3', 'six-4.mp3', 'six-5.mp3'],
    wicket:       ['wicket-1.mp3', 'wicket-2.mp3', 'wicket-3.mp3', 'wicket-4.mp3', 'wicket-5.mp3', 'wicket-6.mp3'],
    dot:          ['dot-1.mp3', 'dot-2.mp3', 'dot-3.mp3', 'dot-4.mp3'],
    run1:         ['run1-1.mp3', 'run1-2.mp3'],
    run2:         ['run2-1.mp3', 'run2-2.mp3'],
    run3:         ['run3-1.mp3', 'run3-2.mp3'],
    wide:         ['wide-1.mp3', 'wide-2.mp3'],
    noball:       ['noball-1.mp3'],
    inningsbreak: ['inningsbreak-1.mp3'],
    win:          ['win-1.mp3', 'win-2.mp3'],
    tie:          ['tie-1.mp3'],
  };
  /* full recorded library — every planned clip is present */
  const READY = CLIPS;

  const buffers = {};   /* url -> AudioBuffer (or null when known-missing) */
  const loading = {};   /* url -> Promise */
  let active = null;    /* { src, gain, url, cat, until } */
  let lastPlayed = {};  /* cat -> timestamp (avoid immediate repeats) */
  let enabled = true;
  const played = [];    /* diagnostics */

  /* ── dynamic announcements — speaks exact scores/targets at innings break & result ── */
  const speechOK = () => typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function';
  function pickVoice(){
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      const pref = ['Google Indian English', 'Indian English', 'en-IN', 'Google UK English Male', 'Google US English', 'en-GB', 'en-US'];
      for(const p of pref){ const v = voices.find(v => v.name.indexOf(p) !== -1 || v.lang === p); if(v) return v; }
      return voices.find(v => v.lang && v.lang.indexOf('en') === 0) || voices[0] || null;
    } catch(e){ return null; }
  }
  if(speechOK()){
    try { window.speechSynthesis.onvoiceschanged = () => { pickVoice(); }; } catch(e){}
  }
  /** Speaks arbitrary text at Commentary level. Cuts in over any clip. */
  function announce(text, opts){
    if(!isOn()) return false;
    if(!text) return false;
    stop();                                     /* never talk over the pre-recorded calls */
    if(!speechOK()) return false;               /* caller can fall back to recorded clips */
    try {
      const u = new window.SpeechSynthesisUtterance(String(text));
      const v = pickVoice(); if(v) u.voice = v;
      u.lang = (v && v.lang) || 'en-IN';
      u.rate = 0.98; u.pitch = 0.92; u.volume = level();
      const words = String(text).trim().split(/\s+/).length;
      active = { element: null, src: null, gain: null, url: 'tts', cat: 'announce', until: Date.now() + words * 430 + 900 };
      u.onend = u.onerror = () => { if(active && active.url === 'tts') active = null; };
      const delay = (opts && opts.delayMs) || 0;
      if(delay > 0){
        window.setTimeout(() => { try { window.speechSynthesis.speak(u); } catch(e){ if(active && active.url === 'tts') active = null; } }, delay);
      } else {
        window.speechSynthesis.speak(u);
      }
      played.push('announce'); if(played.length > 64) played.shift();
      return true;
    } catch(e){ if(active && active.url === 'tts') active = null; return false; }
  }

  const ctx = () => (window.IPLAudio && window.IPLAudio.ac ? window.IPLAudio.ac() : null);
  const bus = () => (window.IPLAudio && window.IPLAudio.getBuses ? window.IPLAudio.getBuses().commentary : null);
  const isOn = () => (window.IPLAudio ? window.IPLAudio.isAudioOn() : enabled);
  const useElements = () => !!(window.IPLAudio && window.IPLAudio.isFile && window.IPLAudio.isFile());
  const level = () => (window.IPLAudio && window.IPLAudio.busLevel ? window.IPLAudio.busLevel('commentary') : 0.7);

  function load(url){
    if(buffers[url] !== undefined) return Promise.resolve(buffers[url]);
    if(loading[url]) return loading[url];
    const c = ctx(); if(!c) return Promise.resolve(null);
    loading[url] = fetch(url)
      .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(buf => new Promise((res, rej) => c.decodeAudioData(buf, res, rej)))
      .then(decoded => { buffers[url] = decoded; return decoded; })
      .catch(() => { buffers[url] = null; return null; })   /* cache the miss — no repeated 404 churn */
      .finally(() => { loading[url] = null; });
    return loading[url];
  }

  function isSpeaking(){
    return !!(active && active.until && Date.now() < active.until);
  }

  function isPriority(cat, opts){ return !!(opts && opts.priority) || cat === 'win' || cat === 'tie' || cat === 'inningsbreak'; }

  function play(cat, opts){
    if(!isOn()) return false;
    const list = READY[cat]; if(!list || !list.length) return false;   /* not yet recorded — stay silent */
    const priority = isPriority(cat, opts);
    if(isSpeaking()){
      if(!priority) return false;                  /* broadcast discipline: never talk over yourself */
      stop();                                      /* but ALWAYS cut in for the big moments */
    }
    const now = Date.now();
    const candidates = list.filter(u => (now - (lastPlayed[u] || 0)) > 4000);
    const pickFrom = candidates.length ? candidates : list;
    const url = BASE + pickFrom[Math.floor(Math.random() * pickFrom.length)];
    const delayMs = (opts && opts.delayMs) || 0;
    if(useElements()){
      /* file:// double-click — plain <audio> elements */
      const a = new Audio(url);
      a.volume = level();
      active = { element: a, cat, url, until: Date.now() + delayMs + 6000 };
      a.onended = () => { if(active && active.element === a) active = null; };
      a.onerror = () => { if(active && active.element === a) active = null; };
      const go = () => { a.play().catch(() => { if(active && active.element === a) active = null; }); };
      if(delayMs > 0) window.setTimeout(go, delayMs); else go();
      lastPlayed[url] = Date.now();
      played.push(cat); if(played.length > 64) played.shift();
      return true;
    }
    load(url).then(buffer => {
      if(!buffer) return;
      if(!isOn()) return;
      const c = ctx(), b = bus(); if(!c || !b) return;
      if(isSpeaking()) return;                     /* re-check after async decode */
      const t0 = c.currentTime + Math.max(0, delayMs / 1000);
      const src = c.createBufferSource(); src.buffer = buffer;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(1, t0 + 0.06);
      src.connect(g); g.connect(b);
      src.start(t0); src.stop(t0 + buffer.duration + 0.05);
      active = { src, gain: g, url, cat, until: Date.now() + delayMs + buffer.duration * 1000 };
      lastPlayed[url] = Date.now();
      src.onended = () => { if(active && active.src === src) active = null; };
      played.push(cat); if(played.length > 64) played.shift();
    });
    return true;
  }

  function stop(){
    const a = active; active = null;
    if(speechOK()){ try { window.speechSynthesis.cancel(); } catch(e){} }
    if(!a) return;
    const c = ctx();
    if(a.element){ /* <audio> element path */
      try {
        const el = a.element;
        const start = el.volume; let i = 0;
        const t = setInterval(() => { i += 1; el.volume = Math.max(0, start * (1 - i / 4)); if(i >= 4){ clearInterval(t); try { el.pause(); el.currentTime = 0; } catch(e){} } }, 40);
      } catch(e){}
      return;
    }
    try {
      const t0 = c ? c.currentTime : 0;
      a.gain.gain.cancelScheduledValues(t0);
      a.gain.gain.setValueAtTime(Math.max(0.0002, a.gain.gain.value), t0);
      a.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
      a.src.stop(t0 + 0.18);
    } catch(e){}
  }

  /* map a ball result → commentary category (mirrors the SFX dispatch in match.js) */
  function categoryFor(result){
    if(result.isWicket) return 'wicket';
    if(result.runsOffBat === 6) return 'six';
    if(result.runsOffBat === 4) return 'four';
    if(result.isWide) return 'wide';
    if(result.isNoBall) return 'noball';
    if(result.runsOffBat === 1) return 'run1';
    if(result.runsOffBat === 2) return 'run2';
    if(result.runsOffBat === 3) return 'run3';
    return 'dot';
  }

  function debug(){
    return { speaking: isSpeaking(), activeCat: active && active.cat || null, played, cached: Object.keys(buffers).filter(k => buffers[k]).length, missing: Object.keys(buffers).filter(k => buffers[k] === null).length };
  }

  return { play, stop, announce, categoryFor, debug, CLIPS };
})();
