/* ============================================================
   IPL 2026 — SHARED AUDIO CORE
   Single AudioContext shared by every audio system in the game.
   Bus layout:  SFX gain ─┐
                          ├─► MASTER gain ─► speakers/headphones
                MUSIC gain ┘
   Settings (master / music / sfx / muted / audioOn) persist to
   'ipl2026-audio-settings' and are restored on every restart.
   The legacy 'ipl2026-sound' on/off flag is migrated automatically.
   ============================================================ */
'use strict';

window.IPLAudio = (function(){
  const STORE = 'ipl2026-audio-settings';
  const LEGACY = 'ipl2026-sound';
  const DEFAULTS = { master: 0.85, music: 0.65, sfx: 0.9, commentary: 0.8, muted: false, audioOn: true };
  const clamp01 = v => Math.max(0, Math.min(1, isFinite(+v) ? +v : 0));

  let settings = Object.assign({}, DEFAULTS);
  try {
    const raw = localStorage.getItem(STORE);
    if(raw){
      const p = JSON.parse(raw) || {};
      ['master','music','sfx','commentary'].forEach(k => { if(typeof p[k] === 'number' && isFinite(p[k])) settings[k] = clamp01(p[k]); });
      if(typeof p.muted === 'boolean') settings.muted = p.muted;
      if(typeof p.audioOn === 'boolean') settings.audioOn = p.audioOn;
    } else {
      // migrate the older 'ipl2026-sound' preference
      if(localStorage.getItem(LEGACY) === 'off') settings.audioOn = false;
    }
  } catch(e){}

  /* exponential taper so slider feels linear to the human ear */
  const taper = v => Math.pow(clamp01(v), 1.6);

  let ctx = null, master = null, musicBus = null, sfxBus = null, commentaryBus = null;
  const listeners = [];
  const throttleTable = {};

  /* per-key SFX/OS-event rate limiter — prevents overlapping one-shots */
  function throttle(key, minMs){
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const min = Math.max(0, minMs || 50);
    if(throttleTable[key] && (t - throttleTable[key]) < min) return false;
    throttleTable[key] = t;
    return true;
  }

  function applyGains(){
    if(!ctx) return;
    const t0 = ctx.currentTime;
    const audible = settings.audioOn && !settings.muted;
    master.gain.cancelScheduledValues(t0);
    master.gain.setTargetAtTime(audible ? Math.max(0.0001, taper(settings.master)) : 0.0001, t0, 0.03);
    musicBus.gain.cancelScheduledValues(t0);
    musicBus.gain.setTargetAtTime(Math.max(0.0001, taper(settings.music)), t0, 0.03);
    sfxBus.gain.cancelScheduledValues(t0);
    sfxBus.gain.setTargetAtTime(Math.max(0.0001, taper(settings.sfx)), t0, 0.03);
    commentaryBus.gain.cancelScheduledValues(t0);
    commentaryBus.gain.setTargetAtTime(Math.max(0.0001, taper(settings.commentary)), t0, 0.03);
  }
  function save(){ try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch(e){} }
  function notify(){
    const snap = getSettings();
    listeners.forEach(fn => { try { fn(snap); } catch(e){} });
  }

  /* create (or return) the shared context + buses */
  function ac(){
    if(ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    commentaryBus = ctx.createGain();
    musicBus.connect(master);
    sfxBus.connect(master);
    commentaryBus.connect(master);
    master.connect(ctx.destination);
    applyGains();
    return ctx;
  }

  function getSettings(){ return Object.assign({}, settings); }

  function setVolume(key, v){
    if(['master','music','sfx','commentary'].indexOf(key) === -1) return getSettings();
    settings[key] = clamp01(v);
    save(); applyGains(); notify();
    return getSettings();
  }
  function setMuted(v){
    settings.muted = !!v;
    save(); applyGains(); notify();
    return settings.muted;
  }
  function setAudioOn(v){
    settings.audioOn = !!v;
    save(); applyGains();
    if(!settings.audioOn){
      // silence quickly and stop the expensive nodes to save CPU/RAM
      if(window.IPLMusic && typeof window.IPLMusic.stop === 'function') window.IPLMusic.stop(280);
      if(window.IPLCommentary && typeof window.IPLCommentary.stop === 'function') window.IPLCommentary.stop();
      if(window.IPLSFX && typeof window.IPLSFX.stopAmbience === 'function') window.IPLSFX.stopAmbience(180);
    } else {
      // restore the soundtrack for wherever the user is right now
      if(window.IPLMusic && typeof window.IPLMusic.resume === 'function') window.IPLMusic.resume();
      const inMatch = typeof document !== 'undefined' && !!document.querySelector('#screen-match.active');
      if(inMatch && window.IPLSFX && typeof window.IPLSFX.startAmbience === 'function') window.IPLSFX.startAmbience();
    }
    notify();
    return settings.audioOn;
  }
  function onChange(fn){ if(typeof fn === 'function') listeners.push(fn); }

  return {
    ac,
    getCtx: ac,
    getBuses(){ ac(); return { master, music: musicBus, sfx: sfxBus, commentary: commentaryBus }; },
    getSettings, setVolume, setMuted, setAudioOn, onChange, throttle,
    isAudioOn: () => settings.audioOn,
    isMuted: () => settings.muted,
    isAudible: () => settings.audioOn && !settings.muted,
    /* effective 0..1 level for a bus, honoring master + mute (for <audio>-element playback fallback) */
    busLevel(kind){
      if(!settings.audioOn || settings.muted) return 0;
      const b = taper(settings.master) * taper(settings[kind] == null ? 0.9 : settings[kind]);
      return Math.max(0, Math.min(1, b));
    },
    isFile: () => (typeof location !== 'undefined' && location.protocol === 'file:'),
    STORE,
  };
})();
