/* ============================================================
   IPL 2026 — AUDIO SETTINGS + GLOBAL UI SOUND
   Header "Audio" button → full settings modal (Master / Music /
   SFX sliders, Mute toggle, Audio ON/OFF switch). Settings are
   persisted by js/audio.js and restored on restart.
   Also installs the delegated UI click / navigation sounds for
   every button in the app (single global listener, rate-limited).
   ============================================================ */
'use strict';

(function(){
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ── delegated UI sounds for every button / card / tab ───────── */
  const NAV_SEL = '.league-nav-btn, .step, .mode-card, .league-team-card, .choice-card, .xi-pick-card, .player-row, .champ-btn';
  const BTN_SEL = 'button, [role="button"], .choice-card, .mode-card, .league-team-card, .sc-tab, .xi-pick-card, .player-row, .ball, .tab-btn';
  document.addEventListener('click', (e) => {
    if(!window.IPLSFX || !window.IPLAudio) return;
    const t = e.target && e.target.closest ? e.target.closest(BTN_SEL) : null;
    if(!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    if(t.closest('#audioModal')) return;   /* the modal manages its own feedback (whoosh/click) */
    if(t.matches && t.matches(NAV_SEL)) window.IPLSFX.navigate();
    else window.IPLSFX.click();
  }, true);

  /* ── audio settings modal ────────────────────────────────────── */
  const modal = $('#audioModal');
  if(!modal) return;
  const openBtn = $('#audioSettingsBtn');
  const closeBtn = $('#audioCloseBtn');
  const doneBtn = $('#audioDoneBtn');
  const muteBtn = $('#muteToggleBtn');
  const onToggle = $('#audioOnToggle');
  const master = $('#masterVolume'), music = $('#musicVolume'), sfx = $('#sfxVolume'), commentary = $('#commentaryVolume');
  const masterVal = $('#masterVolumeVal'), musicVal = $('#musicVolumeVal'), sfxVal = $('#sfxVolumeVal'), commentaryVal = $('#commentaryVolumeVal');
  let lastFocus = null;

  const pct = el => `${Math.round((+el.value || 0))}%`;
  const fill = el => { if(el) el.style.setProperty('--fill', pct(el)); };
  function syncLabels(){
    if(masterVal) masterVal.textContent = pct(master);
    if(musicVal) musicVal.textContent = pct(music);
    if(sfxVal) sfxVal.textContent = pct(sfx);
    if(commentaryVal) commentaryVal.textContent = pct(commentary);
    fill(master); fill(music); fill(sfx);
    if(commentary) fill(commentary);
  }
  function syncSwitch(){
    const on = window.IPLAudio.isAudioOn();
    onToggle.classList.toggle('on', on);
    onToggle.setAttribute('aria-checked', on ? 'true' : 'false');
    syncMuteBtn();
  }
  function syncMuteBtn(){
    const muted = window.IPLAudio.isMuted();
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.innerHTML = muted
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg> Unmute All`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg> Mute All`;
  }
  function syncFromStore(){
    const s = window.IPLAudio.getSettings();
    master.value = Math.round(s.master * 100);
    music.value = Math.round(s.music * 100);
    sfx.value = Math.round(s.sfx * 100);
    if(commentary) commentary.value = Math.round((s.commentary == null ? 0.8 : s.commentary) * 100);
    syncLabels(); syncSwitch();
  }
  function openModal(){
    lastFocus = document.activeElement;
    syncFromStore();
    modal.classList.add('show');
    if(window.IPLSFX) window.IPLSFX.whoosh();
    window.setTimeout(() => { try { master.focus({ preventScroll: true }); } catch(e){ try { master.focus(); } catch(_){} } }, 120);
  }
  function closeModal(){
    if(!modal.classList.contains('show')) return;
    modal.classList.remove('show');
    if(window.IPLSFX) window.IPLSFX.whoosh();
    if(lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch(e){} }
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  doneBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && modal.classList.contains('show')){ e.preventDefault(); closeModal(); }
  });

  master.addEventListener('input', () => { window.IPLAudio.setVolume('master', master.value / 100); syncLabels(); });
  music.addEventListener('input', () => { window.IPLAudio.setVolume('music', music.value / 100); syncLabels(); });
  sfx.addEventListener('input', () => { window.IPLAudio.setVolume('sfx', sfx.value / 100); syncLabels(); });
  if(commentary) commentary.addEventListener('input', () => { window.IPLAudio.setVolume('commentary', commentary.value / 100); syncLabels(); });
  /* one crisp preview tick when the SFX slider settles */
  sfx.addEventListener('change', () => { if(window.IPLSFX) window.IPLSFX.click(); });

  muteBtn.addEventListener('click', () => {
    window.IPLAudio.setMuted(!window.IPLAudio.isMuted());
    syncSwitch();
    if(!window.IPLAudio.isMuted() && window.IPLSFX) window.IPLSFX.click();
  });
  onToggle.addEventListener('click', () => {
    window.IPLAudio.setAudioOn(!window.IPLAudio.isAudioOn());
    syncSwitch();
    if(window.IPLSFX && window.IPLSFX.click) window.IPLSFX.click();
  });

  /* reflect external changes (e.g. the legacy sound toggle) in the modal */
  if(window.IPLAudio.onChange) window.IPLAudio.onChange(() => { if(modal.classList.contains('show')) syncSwitch(); });

  /* ── kick the soundtrack once the page is ready ──────────────── */
  function bootMusic(){
    if(!window.IPLMusic) return;
    const active = document.querySelector('.screen.active');
    const screen = active ? active.id.replace('screen-', '') : 'mode';
    window.IPLMusic.playScene(screen);
  }
  bootMusic();
  /* first gesture unlock: resume/start music if the browser suspended the context */
  const kick = () => {
    if(window.IPLAudio){ const c = window.IPLAudio.ac(); if(c && c.state === 'suspended') c.resume(); }
    if(window.IPLMusic && !window.IPLMusic.current()) bootMusic();
  };
  document.addEventListener('click', kick, { passive: true });
  document.addEventListener('keydown', kick, { passive: true });
})();
