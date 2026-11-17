/* ============================================================
   IPL 2026 CHAMPIONSHIP — MATCH-DAY XI SELECTION
   Before every Championship match the user can reshuffle their
   playing XI (from the locked franchise's 25-man squad). The
   confirmed XI is used for that match and rolls forward as the
   baseline for the next one.
   Owns: #screen-matchxi. Talks to league.js via window.IPLLeagueChamp.
   ============================================================ */
(() => {
'use strict';

const A = () => window.IPLApp;
const L = () => window.IPLLeagueChamp;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const NATION_NAMES = {
  IND:'India', AUS:'Australia', ENG:'England', SA:'South Africa', WI:'West Indies',
  NZ:'New Zealand', SL:'Sri Lanka', AFG:'Afghanistan', BAN:'Bangladesh'
};
const ROLE_NAMES = { BAT:'Batter', WK:'Wicketkeeper', AR:'All-Rounder', BOWL:'Bowler' };
const isBatterRole = r => r === 'BAT' || r === 'WK';
const isBowlerRole = r => r === 'BOWL' || r === 'AR';

let draft = null;            // { order: [], bowl: [], cap: null, wk: null }
let userTeamId = null;
let info = null;             // snapshot from league.js
let filter = { q: '', role: 'ALL', overseasOnly: false };
let bound = false;

/* ── helpers ─────────────────────────────────────────── */
function initials(name){
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
function avatarHTML(p, size){
  const st = size ? ` style="width:${size}px;height:${size}px"` : '';
  return `<div class="avatar"${st} aria-hidden="true"><span class="initials">${esc(initials(p.name))}</span></div>`;
}
const roleTag = role => `<span class="role-badge role-${role}">${ROLE_NAMES[role]}</span>`;
const overseasCount = () => draft.order.filter(id => A().playerOf(userTeamId, id)?.overseas).length;
const inXI = id => draft.order.includes(id);
const teamPlayers = () => (A().DATA[userTeamId]?.players || []);

/* ── squad list ──────────────────────────────────────── */
function getFilteredSquad(){
  const q = filter.q.trim().toLowerCase();
  return teamPlayers().filter(p => {
    if(filter.role !== 'ALL' && p.role !== filter.role) return false;
    if(filter.overseasOnly && !p.overseas) return false;
    if(q){
      const hay = [p.name, p.nation, NATION_NAMES[p.nation]||'', ROLE_NAMES[p.role], p.bat, p.bowl].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function squadAddState(p){
  if(inXI(p.id)) return { inXI: true };
  if(draft.order.length >= 11) return { blocked: true, reason: 'XI full', msg: 'Playing XI is full — remove a player first' };
  if(p.overseas && overseasCount() >= 4) return { blocked: true, reason: 'Max 4 OS', msg: 'Overseas slots full (4/4)' };
  return { open: true };
}
function playerRowHTML(p){
  const state = squadAddState(p);
  const isCap = draft.cap === p.id, isWk = draft.wk === p.id;
  const marks = (isCap ? ' is-captain' : '') + (isWk ? ' is-keeper' : '');
  const addBtn = state.inXI
    ? `<span class="inxi-tag"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>In Squad</span>`
    : state.blocked
      ? `<button class="add-btn" disabled style="opacity:.35;cursor:not-allowed" title="${esc(state.msg)}">${esc(state.reason)}</button>`
      : `<button class="add-btn" data-add="${esc(p.id)}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add</button>`;
  return `<div class="player-row${state.inXI ? ' in-xi' : ''}${marks}" data-pid="${esc(p.id)}">
    ${avatarHTML(p)}
    <div class="pr-main">
      <div class="pr-name">${esc(p.name)}
        <span class="nat-chip">${esc(p.nation)}</span>
        ${p.overseas ? '<span class="os-badge">OVERSEAS</span>' : ''}
        ${roleTag(p.role)}
      </div>
      <div class="pr-sub">
        <span><b>${esc(NATION_NAMES[p.nation] || p.nation)}</b></span>
        <span>Bat: <b>${p.bat === 'RHB' ? 'Right-hand' : 'Left-hand'} bat</b></span>
        <span>Bowl: <b>${esc(p.bowl)}</b></span>
      </div>
      <div class="ratings">
        <div class="rate"><div class="rl">BAT<b>${p.batR}</b></div><div class="bar bat"><i style="width:${p.batR}%"></i></div></div>
        <div class="rate"><div class="rl">BOWL<b>${p.bowlR}</b></div><div class="bar bowl"><i style="width:${p.bowlR}%"></i></div></div>
        <div class="rate"><div class="rl">FIELD<b>${p.field}</b></div><div class="bar fld"><i style="width:${p.field}%"></i></div></div>
      </div>
    </div>
    <div class="ovr-box">
      <div class="ovr${p.ovr < 60 ? ' low' : ''}" title="Overall rating ${p.ovr}/99">${p.ovr}</div>
      ${addBtn}
    </div>
  </div>`;
}
function renderSquadList(){
  const list = getFilteredSquad();
  const wrap = $('#mdSquadList');
  if(!wrap) return;
  wrap.innerHTML = list.length
    ? list.map(playerRowHTML).join('')
    : '<div class="xi-empty">No players match this filter.</div>';
  $$('[data-add]', wrap).forEach(btn => btn.addEventListener('click', () => addToXI(btn.getAttribute('data-add'))));
}

/* ── XI panel ────────────────────────────────────────── */
function xiItemHTML(p, i){
  const isCap = draft.cap === p.id, isWk = draft.wk === p.id;
  const isBowlPick = isBowlerRole(p.role);
  const isBowlMarked = draft.bowl.includes(p.id);
  return `<div class="xi-item${isCap ? ' is-cap' : ''}${isWk ? ' is-wk' : ''}" data-pid="${esc(p.id)}">
    <div class="xi-order">${i + 1}</div>
    ${avatarHTML(p, 40)}
    <div>
      <div class="xi-name">${esc(p.name)}
        ${isCap ? '<span class="mini-tag C">C</span>' : ''}
        ${isWk ? '<span class="mini-tag WK">WK</span>' : ''}
        ${p.overseas ? '<span class="mini-tag OS">OS</span>' : ''}
        ${isBowlMarked ? '<span class="mini-tag BALL">BWL</span>' : ''}
      </div>
      <div class="xi-role">${ROLE_NAMES[p.role]} · OVR ${p.ovr}</div>
    </div>
    <div class="xi-actions">
      <button class="icon-btn" data-move="-1" title="Move up in batting order" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button>
      <button class="icon-btn" data-move="1" title="Move down in batting order" ${i === draft.order.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
      <button class="icon-btn${isCap ? ' on-cap' : ''}" data-cap="1" title="Make captain" aria-pressed="${isCap}">C</button>
      <button class="icon-btn${isWk ? ' on-wk' : ''}" data-wk="1" title="${p.role === 'WK' ? 'Make wicketkeeper' : 'Only wicketkeeper-role players can keep'}" aria-pressed="${isWk}" ${p.role !== 'WK' ? 'disabled' : ''}>K</button>
      <button class="icon-btn${isBowlMarked ? ' on-bowl' : ''}" data-bowl="1" title="${isBowlPick ? 'Toggle bowling option' : 'Only bowlers / all-rounders can bowl'}" aria-pressed="${isBowlMarked}" ${!isBowlPick ? 'disabled' : ''}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="${isBowlMarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 8c1.5 1.2 2 2.6 2 4s-.5 2.8-2 4M12 5.5c1.8 1.6 2.6 3.8 2.6 6.5s-.8 4.9-2.6 6.5M16 8c1.2 1.2 1.7 2.5 1.7 4s-.5 2.8-1.7 4" stroke-width="1.3" fill="none"/></svg>
      </button>
      <button class="icon-btn remove" data-remove="1" title="Remove from selection" aria-label="Remove">✕</button>
    </div>
  </div>`;
}
function renderXIList(){
  const wrap = $('#mdXiList');
  if(!wrap) return;
  if(!draft.order.length){
    wrap.innerHTML = '<div class="xi-empty">Your Playing XI is empty.<br>Add players from the squad →</div>';
    return;
  }
  wrap.innerHTML = draft.order.map((id, i) => xiItemHTML(A().playerOf(userTeamId, id), i)).join('');
  $$('.xi-item', wrap).forEach(item => {
    const pid = item.getAttribute('data-pid');
    $$('[data-move]', item).forEach(b => b.addEventListener('click', () => moveInXI(pid, +b.getAttribute('data-move'))));
    const cBtn = item.querySelector('[data-cap]'); if(cBtn) cBtn.addEventListener('click', () => makeCaptain(pid));
    const kBtn = item.querySelector('[data-wk]'); if(kBtn) kBtn.addEventListener('click', () => makeKeeper(pid));
    const bBtn = item.querySelector('[data-bowl]'); if(bBtn) bBtn.addEventListener('click', () => toggleBowling(pid));
    const rBtn = item.querySelector('[data-remove]'); if(rBtn) rBtn.addEventListener('click', () => removeFromXI(pid));
  });
}

/* ── mutations ───────────────────────────────────────── */
function addToXI(id){
  const p = A().playerOf(userTeamId, id);
  if(!p) return;
  if(draft.order.length >= 11){ A().toast('Playing XI is full — remove a player first.'); return; }
  if(inXI(id)) return;
  if(p.overseas && overseasCount() >= 4){ A().toast('Overseas slots full (4/4).'); return; }
  draft.order.push(id);
  if(isBowlerRole(p.role) && draft.bowl.length < 5) draft.bowl.push(id);
  if(!draft.cap) draft.cap = id;
  if(!draft.wk && p.role === 'WK') draft.wk = id;
  renderAll();
}
function removeFromXI(id){
  const i = draft.order.indexOf(id);
  if(i < 0) return;
  draft.order.splice(i, 1);
  draft.bowl = draft.bowl.filter(b => b !== id);
  if(draft.cap === id) draft.cap = draft.order[0] || null;
  if(draft.wk === id) draft.wk = draft.order.find(x => A().playerOf(userTeamId, x)?.role === 'WK') || null;
  renderAll();
}
function moveInXI(id, delta){
  const i = draft.order.indexOf(id);
  const j = i + delta;
  if(i < 0 || j < 0 || j >= draft.order.length) return;
  const t = draft.order[i]; draft.order[i] = draft.order[j]; draft.order[j] = t;
  renderAll();
}
function makeCaptain(id){ draft.cap = (draft.cap === id ? null : id); renderAll(); }
function makeKeeper(id){
  const p = A().playerOf(userTeamId, id);
  if(!p || p.role !== 'WK'){ A().toast('Only wicketkeeper-role players can keep.'); return; }
  draft.wk = (draft.wk === id ? null : id);
  renderAll();
}
function toggleBowling(id){
  const p = A().playerOf(userTeamId, id);
  if(!p || !isBowlerRole(p.role)){ A().toast('Only bowlers / all-rounders carry bowling options.'); return; }
  const i = draft.bowl.indexOf(id);
  if(i >= 0) draft.bowl.splice(i, 1); else draft.bowl.push(id);
  renderAll();
}

/* ── quick pick / suggest order ──────────────────────── */
function quickPickFill(){
  if(!draft) return;
  const players = teamPlayers();
  // never remove user picks — fill empties only
  const sorted = players.slice().sort((a, b) => b.ovr - a.ovr);
  for(const p of sorted){
    if(draft.order.length >= 11) break;
    if(inXI(p.id)) continue;
    if(p.overseas && overseasCount() >= 4) continue;
    draft.order.push(p.id);
    if(isBowlerRole(p.role) && draft.bowl.length < 5) draft.bowl.push(p.id);
  }
  // guarantee a wicketkeeper if one is available and missing
  const hasWK = draft.order.some(id => A().playerOf(userTeamId, id)?.role === 'WK');
  if(!hasWK){
    const wk = sorted.find(p => p.role === 'WK' && !inXI(p.id) && (!p.overseas || overseasCount() < 4));
    if(wk && draft.order.length >= 11){
      // swap out the lowest-rated non-captain, non-WK batter
      let worstI = -1, worstOvr = Infinity;
      draft.order.forEach((id, i) => {
        const pl = A().playerOf(userTeamId, id);
        if(id === draft.cap || pl.role === 'WK') return;
        if(pl.ovr < worstOvr){ worstOvr = pl.ovr; worstI = i; }
      });
      if(worstI >= 0){
        const outId = draft.order[worstI];
        draft.order[worstI] = wk.id;
        draft.bowl = draft.bowl.filter(b => b !== outId);
        if(isBowlerRole(wk.role) && draft.bowl.length < 5) draft.bowl.push(wk.id);
      }
    } else if(wk){
      draft.order.push(wk.id);
    }
  }
  // top up bowling options from the XI by bowling rating
  const bowlCands = draft.order
    .map(id => A().playerOf(userTeamId, id))
    .filter(p => p && isBowlerRole(p.role))
    .sort((a, b) => b.bowlR - a.bowlR);
  const current = new Set(draft.bowl);
  for(const p of bowlCands){
    if(draft.bowl.length >= 5) break;
    if(!current.has(p.id)){ draft.bowl.push(p.id); current.add(p.id); }
  }
  if(!draft.cap) draft.cap = draft.order[0] || null;
  if(!draft.wk) draft.wk = draft.order.find(id => A().playerOf(userTeamId, id)?.role === 'WK') || null;
  renderAll();
  A().toast('AI Quick Pick filled the empty slots — every pick stays editable.');
}
function suggestOrder(){
  const order = draft.order.map(id => A().playerOf(userTeamId, id)).filter(Boolean);
  const grp = p => (p.role === 'BAT' || p.role === 'WK') ? 0 : p.role === 'AR' ? 1 : 2;
  const stable = arr => arr.map((v, i) => [v, i]).sort((a, b) => grp(a[0]) - grp(b[0]) || b[0].batR - a[0].batR || a[1] - b[1]).map(x => x[0]);
  draft.order = stable(order).map(p => p.id);
  renderAll();
  A().toast('Batting order suggested — adjust with ▲▼.');
}

/* ── validation ──────────────────────────────────────── */
function validationItems(){
  const xi = draft.order;
  const unique = new Set(xi).size === xi.length;
  const osCount = xi.filter(id => A().playerOf(userTeamId, id)?.overseas).length;
  const capOK = !!draft.cap && xi.includes(draft.cap);
  const wkInXI = xi.some(id => A().playerOf(userTeamId, id)?.role === 'WK');
  const wkOK = draft.wk ? (xi.includes(draft.wk) && A().playerOf(userTeamId, draft.wk)?.role === 'WK') : !wkInXI;
  const bowlOpts = draft.bowl.filter(id => xi.includes(id));
  return [
    { label: `Exactly 11 players selected (${xi.length}/11)`, ok: xi.length === 11 },
    { label: `Overseas players: ${osCount} of max 4`, ok: osCount <= 4 },
    { label: 'No duplicate players', ok: unique },
    { label: 'At least one wicketkeeper in the XI', ok: wkInXI },
    { label: 'Captain selected from the XI', ok: capOK },
    { label: 'Wicketkeeper selected (WK role only)', ok: wkOK },
    { label: `Batting order set (${xi.length === 11 ? '11 named · tap ▲▼ to adjust' : 'needs 11 players'})`, ok: xi.length === 11 },
    { label: `Bowling options marked: ${bowlOpts.length} of min 5`, ok: bowlOpts.length >= 5 },
    { label: 'Championship franchise locked', ok: !!userTeamId },
  ];
}
function renderValidation(){
  const items = validationItems();
  const el = $('#mdValidation');
  if(el){
    el.innerHTML = items.map(it => `<div class="validation-item ${it.ok ? 'ok' : 'bad'}">
      <span class="v-dot" aria-hidden="true">${it.ok ? '✓' : '•'}</span>${esc(it.label)}
    </div>`).join('');
  }
  const okAll = items.every(i => i.ok);
  const btn = $('#mdConfirmBtn');
  if(btn) btn.disabled = !okAll;
  const hint = $('#mdConfirmHint');
  if(hint) hint.textContent = okAll ? 'Ready — one over to glory.' : 'Meet every item above to confirm.';
  return okAll;
}

/* ── chrome (stats + meter + count) ──────────────────── */
function renderChrome(){
  const xi = draft.order;
  const avg = xi.length ? Math.round(xi.reduce((s, id) => s + (A().playerOf(userTeamId, id)?.ovr || 0), 0) / xi.length) : '–';
  const os = overseasCount();
  const bowl = draft.bowl.filter(id => xi.includes(id)).length;
  const setT = (id, v) => { const el = $(id); if(el) el.textContent = v; };
  setT('#mdOverseasStat', os); setT('#mdAvgStat', avg); setT('#mdBowlStat', bowl); setT('#mdXiCount', xi.length);
  const osText = $('#mdOsMeterText'); if(osText) osText.textContent = `${os} / 4`;
  const dots = $('#mdOsDots');
  if(dots){
    dots.innerHTML = [0,1,2,3].map(i => `<span class="os-dot${i < os ? ' filled' : ''}"></span>`).join('');
  }
}
function renderAll(){
  renderSquadList();
  renderXIList();
  renderChrome();
  renderValidation();
}

/* ── static binding (once) ───────────────────────────── */
function bindOnce(){
  if(bound) return; bound = true;
  const search = $('#mdSquadSearch');
  if(search) search.addEventListener('input', () => { filter.q = search.value; renderSquadList(); });
  const pills = $('#mdRolePills');
  if(pills){
    const roles = ['ALL', 'BAT', 'WK', 'AR', 'BOWL'];
    pills.innerHTML = roles.map(r => `<button class="pill${r === filter.role ? ' active' : ''}" data-role="${r}">${r === 'ALL' ? 'All' : ROLE_NAMES[r]}</button>`).join('');
    pills.addEventListener('click', e => {
      const btn = e.target.closest('[data-role]'); if(!btn) return;
      filter.role = btn.getAttribute('data-role');
      $$('.pill', pills).forEach(p => p.classList.toggle('active', p.getAttribute('data-role') === filter.role));
      renderSquadList();
    });
  }
  const osT = $('#mdOverseasToggle');
  if(osT) osT.addEventListener('click', () => {
    filter.overseasOnly = !filter.overseasOnly;
    osT.setAttribute('aria-pressed', String(filter.overseasOnly));
    osT.classList.toggle('on', filter.overseasOnly);
    renderSquadList();
  });
  const qp = $('#mdQuickPickBtn'); if(qp) qp.addEventListener('click', quickPickFill);
  const so = $('#mdSuggestOrderBtn'); if(so) so.addEventListener('click', suggestOrder);
  const back = $('#mdBackBtn'); if(back) back.addEventListener('click', () => { if(L()?.cancelMatchdayXI) L().cancelMatchdayXI(); });
  const confirm = $('#mdConfirmBtn');
  if(confirm) confirm.addEventListener('click', () => {
    if(!renderValidation()){ A().toast('Meet every validation item first.'); return; }
    if(L()?.confirmMatchdayXI) L().confirmMatchdayXI({ order: draft.order.slice(), bowl: draft.bowl.slice(0, 5), cap: draft.cap, wk: draft.wk });
  });
}

/* ── entry ───────────────────────────────────────────── */
function render(){
  const snap = L() && L().matchdayInfo ? L().matchdayInfo() : null;
  if(!snap){
    A().toast('That match is no longer pending.');
    A().goto('season');
    return;
  }
  info = snap;
  userTeamId = snap.userTeamId;
  draft = {
    order: snap.userXi.order.slice(),
    bowl: (snap.userXi.bowlOptions || []).filter(Boolean).slice(0, 5),
    cap: snap.userXi.captain || null,
    wk: snap.userXi.keeper || null,
  };
  filter = { q: '', role: 'ALL', overseasOnly: false };
  const opp = A().teamOf(snap.opponentId);
  const setT = (id, v) => { const el = $(id); if(el) el.textContent = v; };
  setT('#mdContext', snap.kind === 'playoff'
    ? `${snap.label} · vs ${opp ? opp.name : 'opponent'}`
    : `Round ${snap.round} · vs ${opp ? opp.name : 'opponent'}`);
  setT('#mdXITitle', `Match-Day XI · ${opp ? (A().teamOf(userTeamId).short) : ''}`);
  const title = $('#mdTitle'); if(title) title.textContent = 'Match-Day XI';
  const search = $('#mdSquadSearch'); if(search) search.value = '';
  const osT = $('#mdOverseasToggle'); if(osT){ osT.classList.remove('on'); osT.setAttribute('aria-pressed', 'false'); }
  const pills = $('#mdRolePills'); if(pills) $$('.pill', pills).forEach(p => p.classList.toggle('active', p.getAttribute('data-role') === 'ALL'));
  bindOnce();
  renderAll();
}

window.IPLMatchXI = { render };
})();
