/* ============================================================
   IPL 2026 — PLAYING XI SELECTOR  (state machine + UI)
   Two formats:
     • full      — 11 players, max 4 overseas, keeper mandatory
     • showdown  — 4 BATTERS + 3 BOWLERS, innings ends at 2 wickets
   Flow: Format → Team1 → Team2 → Team1 XI → Team2 XI → Confirm → Toss → 2D Match
   The user controls squads; AI NEVER swaps a user pick.
   AI Quick Pick only fills EMPTY slots — user's picks are untouchable.
   ============================================================ */
'use strict';

const DATA = window.IPL_DATA;
const STORE_KEY = 'ipl2026-state-v1';

const NATION_NAMES = {
  IND:'India', AUS:'Australia', ENG:'England', SA:'South Africa', WI:'West Indies',
  NZ:'New Zealand', SL:'Sri Lanka', AFG:'Afghanistan', BAN:'Bangladesh'
};
const ROLE_NAMES = { BAT:'Batter', WK:'Wicketkeeper', AR:'All-Rounder', BOWL:'Bowler' };
const ROLE_ORDER = { BAT:0, WK:1, AR:2, BOWL:3 };
const isBatterRole = r => r === 'BAT' || r === 'WK';
const isBowlerRole = r => r === 'BOWL' || r === 'AR';

const MODE_CFG = {
  full:     { teamSize: 11, batSlots: null, bowlSlots: null, overseasCap: 4, wickets: 10, bowlOptionsMin: 5,
              label: 'Full XI Classic', xiLabel: 'PLAYING XI', doneLabel: 'PLAYING XI' },
  showdown: { teamSize: 7,  batSlots: 4,    bowlSlots: 3,    overseasCap: 4, wickets: 2,  bowlOptionsMin: 3,
              label: 'One-Over Showdown', xiLabel: 'SHOWDOWN SQUAD', doneLabel: 'SHOWDOWN SQUAD' },
  tournament: { teamSize: 11, batSlots: null, bowlSlots: null, overseasCap: 4, wickets: 10, bowlOptionsMin: 5,
             label: 'IPL 2026 Championship', xiLabel: 'PLAYING XI', doneLabel: 'PLAYING XI' },
};

/* ─────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────── */
const defaultState = () => ({
  mode: null,                 // 'full' | 'showdown'
  screen: 'mode',
  team1Id: null, team2Id: null,
  xiTeam1: [], capTeam1: null, wkTeam1: null, bowlTeam1: [], xi1Confirmed: false,
  xiTeam2: [], capTeam2: null, wkTeam2: null, bowlTeam2: [], xi2Confirmed: false,
  teamsLocked: false,
  toss: { spun: false, winnerId: null, choice: null },
});

let S = loadState();
let currentXITeam = 'team1';
let squadFilter = { q:'', role:'ALL', overseasOnly:false };
let pendingPick = { team1: null, team2: null };

function loadState(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const merged = Object.assign(defaultState(), parsed);
    merged.toss = Object.assign({ spun:false, winnerId:null, choice:null }, parsed.toss||{});
    sanitizeXI(merged, 'team1'); sanitizeXI(merged, 'team2');
    if(merged.screen === 'match') merged.screen = 'toss';   // never resurrect mid-match
    return merged;
  }catch(e){ return defaultState(); }
}
function sanitizeXI(st, side){
  const tid = st[side+'Id'];
  const allowed = st.mode === 'showdown' ? 7 : 11;
  const squad = tid && DATA[tid] ? new Set(DATA[tid].players.map(p=>p.id)) : new Set();
  st['xi'+cap(side)] = (st['xi'+cap(side)]||[]).filter(id=>squad.has(id)).slice(0, allowed);
  ['cap','wk'].forEach(k=>{ if(st[k+cap(side)] && !st['xi'+cap(side)].includes(st[k+cap(side)])) st[k+cap(side)] = null; });
  st['bowl'+cap(side)] = (st['bowl'+cap(side)]||[]).filter(id=>st['xi'+cap(side)].includes(id));
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function saveState(){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(S)); }catch(e){} }
function resetAll(){
  try{ localStorage.removeItem(STORE_KEY); }catch(e){}
  if(window.IPLLeague) window.IPLLeague.wipeSeason();
  S = defaultState();
  pendingPick = { team1:null, team2:null };
  currentXITeam = 'team1';
  if(window.IPLMatch) window.IPLMatch.abort();
  goto('mode');
  toast('Everything reset — choose your format.');
}

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */
const $ = (sel, root) => (root||document).querySelector(sel);
const $$ = (sel, root) => Array.from((root||document).querySelectorAll(sel));
const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initials = name => name.replace(/\(.*?\)/g,'').trim().split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const teamOf = id => DATA[id];
const playerOf = (teamId, pid) => teamOf(teamId).players.find(p=>p.id===pid);
const sideIds = side => side === 'team1' ? S.team1Id : S.team2Id;
const xiOf = side => side === 'team1' ? S.xiTeam1 : S.xiTeam2;
const capOf = side => side === 'team1' ? S.capTeam1 : S.capTeam2;
const wkOf = side => side === 'team1' ? S.wkTeam1 : S.wkTeam2;
const bowlOf = side => side === 'team1' ? S.bowlTeam1 : S.bowlTeam2;
const modeCfg = () => MODE_CFG[S.mode] || MODE_CFG.full;
const battersOf = (side, teamId) => xiOf(side).filter(id => isBatterRole(playerOf(teamId, id).role));
const bowlersOf = (side, teamId) => xiOf(side).filter(id => isBowlerRole(playerOf(teamId, id).role));

const crestUid = (() => { let n = 0; return () => 'crestgrad-' + (++n); })();
function crestSVG(team, extraClass){
  const ini = team.short;
  const gid = crestUid();
  return `<svg class="crest ${extraClass||''}" viewBox="0 0 100 104" role="img" aria-label="${esc(team.name)} crest">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${team.c1}"/><stop offset="1" stop-color="${team.c2}"/>
      </linearGradient>
    </defs>
    <path d="M50 3 L93 17.5 V51 C93 78.5 74.5 95.5 50 101 C25.5 95.5 7 78.5 7 51 V17.5 Z"
          fill="url(#${gid})" stroke="rgba(255,255,255,.35)" stroke-width="2.5"/>
    <path d="M50 10 L86 23 V51 C86 75.5 69.5 90.5 50 96 C30.5 90.5 14 75.5 14 51 V23 Z"
          fill="rgba(0,0,0,.22)" stroke="rgba(255,255,255,.18)" stroke-width="1.2"/>
    <text x="50" y="55" text-anchor="middle" font-family="Haettenschweiler,'Arial Narrow Bold',Impact,sans-serif"
          font-size="${ini.length > 3 ? 24 : 30}" fill="#ffffff" stroke="rgba(0,0,0,.55)" stroke-width="1.1"
          letter-spacing="2" dominant-baseline="middle" style="paint-order:stroke">${esc(ini)}</text>
    ${team.trophies > 0 ? `<text x="50" y="76" text-anchor="middle" font-size="9" fill="#f5c518" letter-spacing="2">${'★'.repeat(Math.min(team.trophies,5))}</text>` : ''}
  </svg>`;
}
function avatarHTML(player, team, size){
  const st = size ? ` style="width:${size}px;height:${size}px"` : '';
  return `<div class="avatar"${st} aria-hidden="true"><span class="initials">${esc(initials(player.name))}</span></div>`;
}
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>t.classList.remove('show'), 3400);
}

/* ─────────────────────────────────────────────
   STEPPER / NAVIGATION
   ───────────────────────────────────────────── */
const STEPS = [
  { key:'mode', label:'Format' },
  { key:'team1', label:'Team 1' },
  { key:'team2', label:'Team 2' },
  { key:'xi1',   label:'Team 1 XI' },
  { key:'xi2',   label:'Team 2 XI' },
  { key:'confirm', label:'Confirm' },
  { key:'toss',  label:'Toss' },
  { key:'match', label:'Match' },
];
function stepIndexFor(screen){
  if(screen==='mode') return 0;
  if(screen==='team1') return 1;
  if(screen==='team2') return 2;
  if(screen==='xi') return currentXITeam==='team1' ? 3 : 4;
  return STEPS.findIndex(s=>s.key===screen);
}
function renderStepper(){
  const isTournament = S.mode === 'tournament';
  const nav = $('#leagueNav');
  if(nav) nav.style.display = isTournament ? 'flex' : 'none';
  const wrap = $('#stepper');
  if(isTournament){ wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const active = stepIndexFor(S.screen);
  wrap.innerHTML = '';
  STEPS.forEach((st, i) => {
    if(i>0) wrap.appendChild(el('div','step-sep'));
    const d = el('div','step' + (i<active?' done':'') + (i===active?' active':''));
    d.innerHTML = `<span class="num">${i<active?'✓':(i+1)}</span><span>${esc(st.label)}</span>`;
    wrap.appendChild(d);
  });
}
function goto(screen){
  S.screen = screen;
  saveState();
  $$('.screen').forEach(s=>s.classList.remove('active'));
  const map = { mode:'#screen-mode', team1:'#screen-team1', team2:'#screen-team2', xi:'#screen-xi', confirm:'#screen-confirm', toss:'#screen-toss', match:'#screen-match',
                seasonTeam:'#screen-season-team', season:'#screen-season', matchxi:'#screen-matchxi', stats:'#screen-stats' };
  $(map[screen]).classList.add('active');
  $('#globalFootnote').style.display = (screen==='match') ? 'none' : '';
  updateSelectBar(null);
  if(screen==='mode') renderModeScreen();
  if(screen==='team1') renderTeamGrid('team1');
  if(screen==='team2') renderTeamGrid('team2');
  if(screen==='xi') renderXIScreen();
  if(screen==='seasonTeam' && window.IPLLeague) window.IPLLeague.renderSeasonTeamGrid();
  if(screen==='season' && window.IPLLeague) window.IPLLeague.renderHub();
  if(screen==='matchxi' && window.IPLMatchXI) window.IPLMatchXI.render();
  if(screen==='stats' && window.IPLLeague) window.IPLLeague.renderStats();
  if(screen==='confirm') renderConfirmScreen();
  if(screen==='toss') renderTossScreen();
  if(screen==='match' && window.IPLMatch) window.IPLMatch.ensureMatch();
  window.scrollTo({top:0, behavior:'smooth'});
  renderStepper();
  if(window.IPLMusic) window.IPLMusic.playScene(screen);
}

/* ─────────────────────────────────────────────
   MODE SELECTION
   ───────────────────────────────────────────── */
function renderModeScreen(){
  $$('.mode-card').forEach(card => {
    card.classList.toggle('selected', S.mode === card.getAttribute('data-mode'));
  });
}
function pickMode(mode){
  const had = S.mode && S.mode !== mode;
  if(had){
    // switching format wipes teams, XIs, confirms and toss — fresh slate
    if(window.IPLLeague) window.IPLLeague.wipeSeason();
    S = Object.assign(defaultState(), { mode, screen: mode==='tournament' ? 'seasonTeam' : 'team1' });
    pendingPick = { team1:null, team2:null };
    currentXITeam = 'team1';
    saveState();
    toast(`Format switched to ${MODE_CFG[mode].label} — teams & squads cleared for a fresh pick.`);
    goto(mode === 'tournament' ? 'seasonTeam' : 'team1');
    return;
  }
  S.mode = mode;
  saveState();
  if(mode === 'tournament'){
    toast('IPL 2026 Championship selected — lock in your franchise.');
    goto('seasonTeam');
    return;
  }
  toast(`${MODE_CFG[mode].label} selected${mode==='showdown' ? ' — 4 batters + 3 bowlers, 2 wickets end the innings' : ' — your full 11-player arc'}.`);
  goto('team1');
}

/* ─────────────────────────────────────────────
   TEAM SELECTION SCREENS
   ───────────────────────────────────────────── */
function renderTeamGrid(side){
  const gridId = side==='team1' ? '#team1Grid' : '#team2Grid';
  const committed = side==='team1' ? S.team1Id : S.team2Id;
  const sel = pendingPick[side] || committed;
  const grid = $(gridId);
  grid.innerHTML = '';
  Object.values(DATA).forEach(team => {
    const isOther = (side==='team2' && team.id===S.team1Id) || (side==='team1' && team.id===S.team2Id);
    const card = el('button', 'team-card' + (sel===team.id?' selected':'') + (isOther?' disabled':''));
    card.setAttribute('role','option');
    card.setAttribute('aria-pressed', sel===team.id ? 'true':'false');
    card.style.setProperty('--tc', team.c1);
    card.style.setProperty('--tc2', team.c2);
    card.innerHTML = `
      ${crestSVG(team)}
      <div class="team-name">${esc(team.short)}</div>
      <div class="team-meta">
        <span><b>${esc(team.name)}</b></span>
        <span>${esc(team.city)} · Capt: <b>${esc(team.cap)}</b></span>
        <span>${esc(team.home)}</span>
      </div>
      <div class="trophies">${team.trophies>0 ? '★'.repeat(Math.min(team.trophies,5)) + ' IPL Titles' : 'Seeking 1st Title'}</div>`;
    if(!isOther){
      card.addEventListener('click', () => {
        pendingPick[side] = (pendingPick[side]===team.id) ? null : team.id;
        renderTeamGrid(side);
      });
    }
    grid.appendChild(card);
  });
  if(side==='team2'){
    $('#team2Sub').innerHTML = S.team1Id
      ? `${esc(DATA[S.team1Id].name)} are locked in as Team 1. Pick the opposition — it must be a different franchise.`
      : 'Choose the opponent franchise. Team 2 must be different from Team 1.';
  }
  updateSelectBar(side);
}
function updateSelectBar(side){
  const bar = $('#selectBar');
  if(!side || S.screen!==('team'+(side==='team1'?'1':'2'))) { bar.classList.remove('show'); return; }
  const pickId = pendingPick[side];
  if(!pickId){ bar.classList.remove('show'); return; }
  const t = DATA[pickId];
  $('#selectBarCrest').innerHTML = crestSVG(t);
  $('#selectBarName').textContent = t.name;
  $('#selectBarSub').textContent = `${t.city} · Captain ${t.cap} · Home of ${t.short}`;
  $('#selectBarConfirmBtn').innerHTML = (side==='team1' ? 'Confirm Team 1' : 'Confirm Team 2') +
    ` <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
  $('#selectBarConfirmBtn').onclick = () => confirmTeamPick(side);
  bar.classList.add('show');
}
function confirmTeamPick(side){
  const pick = pendingPick[side];
  if(!pick) return;
  const other = side==='team1' ? S.team2Id : S.team1Id;
  if(other && pick === other){ toast('Both teams must be different franchises.'); return; }
  const prev = side==='team1' ? S.team1Id : S.team2Id;
  if(prev && prev !== pick){
    if(side==='team1'){ S.xiTeam1=[]; S.capTeam1=null; S.wkTeam1=null; S.bowlTeam1=[]; S.xi1Confirmed=false; }
    else              { S.xiTeam2=[]; S.capTeam2=null; S.wkTeam2=null; S.bowlTeam2=[]; S.xi2Confirmed=false; }
  }
  if(side==='team1') S.team1Id = pick; else S.team2Id = pick;
  pendingPick[side] = null;
  saveState();
  if(side==='team1'){
    goto('team2');
  } else {
    currentXITeam = (S.xi1Confirmed || !S.team1Id) ? 'team2' : 'team1';
    goto('xi');
  }
}

/* ─────────────────────────────────────────────
   XI / SHOWDOWN SQUAD BUILDER
   ───────────────────────────────────────────── */
function roleTag(role){ return `<span class="role-badge role-${role}">${ROLE_NAMES[role]}</span>`; }
function categorySlots(side, teamId){
  const xi = xiOf(side);
  const team = teamOf(teamId);
  return {
    batters: xi.filter(id => isBatterRole(playerOf(teamId,id).role)),
    bowlers: xi.filter(id => isBowlerRole(playerOf(teamId,id).role)),
  };
}
function squadAddState(p, team){
  const side = currentXITeam;
  const xi = xiOf(side);
  const cfg = modeCfg();
  if(xi.includes(p.id)) return { inXI:true };
  const overseasCount = xi.filter(id=>playerOf(team.id,id).overseas).length;
  if(p.overseas && overseasCount >= cfg.overseasCap) return { blocked:true, reason:'MAX OS', msg:`Max ${cfg.overseasCap} overseas players` };
  if(xi.length >= cfg.teamSize) return { blocked:true, reason:'FULL', msg:'Selection full' };
  if(S.mode === 'showdown'){
    const { batters, bowlers } = categorySlots(side, team.id);
    if(isBatterRole(p.role) && batters.length >= cfg.batSlots) return { blocked:true, reason:'BAT FULL', msg:'4 batter slots full' };
    if(isBowlerRole(p.role) && bowlers.length >= cfg.bowlSlots) return { blocked:true, reason:'BWL FULL', msg:'3 bowler slots full' };
  }
  return { canAdd:true };
}
function playerRowHTML(p, team){
  const state = squadAddState(p, team);
  const capP = capOf(currentXITeam), wkP = wkOf(currentXITeam);
  const marks = (capP===p.id?' is-captain':'') + (wkP===p.id?' is-keeper':'');
  const addBtn = state.inXI
    ? `<span class="inxi-tag"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>In Squad</span>`
    : state.blocked
      ? `<button class="add-btn" disabled style="opacity:.35;cursor:not-allowed" title="${esc(state.msg)}">${esc(state.reason)}</button>`
      : `<button class="add-btn" data-add="${p.id}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add</button>`;
  return `<div class="player-row${state.inXI?' in-xi':''}${marks}" data-pid="${p.id}">
    ${avatarHTML(p, team)}
    <div class="pr-main">
      <div class="pr-name">${esc(p.name)}
        <span class="nat-chip">${esc(p.nation)}</span>
        ${p.overseas?'<span class="os-badge">OVERSEAS</span>':''}
        ${roleTag(p.role)}
      </div>
      <div class="pr-sub">
        <span><b>${esc(NATION_NAMES[p.nation]||p.nation)}</b></span>
        <span>Bat: <b>${p.bat==='RHB'?'Right-hand':'Left-hand'} bat</b></span>
        <span>Bowl: <b>${esc(p.bowl)}</b></span>
      </div>
      <div class="ratings">
        <div class="rate"><div class="rl">BAT<b>${p.batR}</b></div><div class="bar bat"><i style="width:${p.batR}%"></i></div></div>
        <div class="rate"><div class="rl">BOWL<b>${p.bowlR}</b></div><div class="bar bowl"><i style="width:${p.bowlR}%"></i></div></div>
        <div class="rate"><div class="rl">FIELD<b>${p.field}</b></div><div class="bar fld"><i style="width:${p.field}%"></i></div></div>
      </div>
    </div>
    <div class="ovr-box">
      <div class="ovr${p.ovr<60?' low':''}" title="Overall rating ${p.ovr}/99">${p.ovr}</div>
      ${addBtn}
    </div>
  </div>`;
}
function getFilteredSquad(team){
  const q = squadFilter.q.trim().toLowerCase();
  return team.players.filter(p => {
    if(squadFilter.role !== 'ALL' && p.role !== squadFilter.role) return false;
    if(squadFilter.overseasOnly && !p.overseas) return false;
    if(q){
      const hay = [p.name, p.nation, NATION_NAMES[p.nation]||'', ROLE_NAMES[p.role], p.bat, p.bowl].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}
function renderSquadList(){
  const team = teamOf(sideIds(currentXITeam));
  const list = getFilteredSquad(team);
  const wrap = $('#squadList');
  if(!list.length){
    wrap.innerHTML = '<div class="xi-empty">No players match this filter.</div>';
    return;
  }
  wrap.innerHTML = list.map(p => playerRowHTML(p, team)).join('');
  $$('[data-add]', wrap).forEach(btn => btn.addEventListener('click', () => addToXI(btn.getAttribute('data-add'))));
}
function xiItemHTML(p, team, i, opts){
  const side = currentXITeam;
  const isCap = capOf(side)===p.id, isWk = wkOf(side)===p.id;
  const isBowlRolePick = isBowlerRole(p.role);
  const isShowdown = S.mode === 'showdown';
  const showOrder = !isShowdown || isBatterRole(p.role);
  const orderLabel = showOrder ? String(opts.orderNo) : 'B';
  const bowlTag = (isShowdown ? isBowlerRole(p.role) : bowlOf(side).includes(p.id));
  return `<div class="xi-item${isCap?' is-cap':''}${isWk?' is-wk':''}" data-pid="${p.id}">
    <div class="xi-order${showOrder?'':' bowl-tag'}">${orderLabel}</div>
    ${avatarHTML(p, team, 40)}
    <div>
      <div class="xi-name">${esc(p.name)}
        ${isCap?'<span class="mini-tag C">C</span>':''}
        ${isWk?'<span class="mini-tag WK">WK</span>':''}
        ${p.overseas?'<span class="mini-tag OS">OS</span>':''}
        ${bowlTag?'<span class="mini-tag BALL">BWL</span>':''}
      </div>
      <div class="xi-role">${ROLE_NAMES[p.role]} · OVR ${p.ovr}</div>
    </div>
    <div class="xi-actions">
      ${showOrder ? `<button class="icon-btn" data-move="-1" title="Move up in batting order" ${opts.canUp?'':'disabled'} aria-label="Move up">▲</button>
      <button class="icon-btn" data-move="1" title="Move down in batting order" ${opts.canDown?'':'disabled'} aria-label="Move down">▼</button>` : ''}
      <button class="icon-btn${isCap?' on-cap':''}" data-cap="1" title="Make captain" aria-pressed="${isCap}">C</button>
      <button class="icon-btn${isWk?' on-wk':''}" data-wk="1" title="${p.role==='WK'?'Make wicketkeeper':'Only wicketkeeper-role players can keep'}" aria-pressed="${isWk}" ${p.role!=='WK'?'disabled':''}>K</button>
      ${!isShowdown ? `<button class="icon-btn${bowlOf(side).includes(p.id)?' on-bowl':''}" data-bowl="1" title="${isBowlRolePick?'Toggle bowling option':'Only bowlers / all-rounders can bowl'}" aria-pressed="${bowlOf(side).includes(p.id)}" ${!isBowlRolePick?'disabled':''}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="${bowlOf(side).includes(p.id)?'currentColor':'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M8 8c1.5 1.2 2 2.6 2 4s-.5 2.8-2 4M12 5.5c1.8 1.6 2.6 3.8 2.6 6.5s-.8 4.9-2.6 6.5M16 8c1.2 1.2 1.7 2.5 1.7 4s-.5 2.8-1.7 4" stroke-width="1.3" fill="none"/></svg>
      </button>` : ''}
      <button class="icon-btn remove" data-remove="1" title="Remove from selection" aria-label="Remove">✕</button>
    </div>
  </div>`;
}
function renderXiList(){
  const side = currentXITeam;
  const team = teamOf(sideIds(side));
  const xi = xiOf(side);
  const wrap = $('#xiList');
  if(!xi.length){
    wrap.innerHTML = `<div class="xi-empty">${S.mode==='showdown' ? 'Squad is empty.<br>Pick 4 batters and 3 bowlers →' : 'Your Playing XI is empty.<br>Add players from the squad →'}</div>`;
    return;
  }
  let html = '';
  if(S.mode === 'showdown'){
    const batters = xi.filter(id => isBatterRole(playerOf(team.id,id).role));
    const bowlers = xi.filter(id => isBowlerRole(playerOf(team.id,id).role));
    batters.forEach((pid, i) => {
      const p = playerOf(team.id, pid);
      html += xiItemHTML(p, team, i, { orderNo: i+1, canUp: i>0, canDown: i<batters.length-1 });
    });
    // ghost batter slots
    for(let i = batters.length; i < MODE_CFG.showdown.batSlots; i++){
      html += `<div class="xi-slot-ghost"><div class="xi-order">${i+1}</div><div class="ghost-label">Empty batter slot — pick a BAT / WK</div></div>`;
    }
    if(bowlers.length || batters.length === MODE_CFG.showdown.batSlots || bowlers.length < MODE_CFG.showdown.bowlSlots){
      html += `<div class="xi-divider"><span>BOWLERS · ${bowlers.length}/3</span></div>`;
      bowlers.forEach(pid => {
        const p = playerOf(team.id, pid);
        html += xiItemHTML(p, team, 0, { orderNo: 0, canUp:false, canDown:false });
      });
      for(let i = bowlers.length; i < MODE_CFG.showdown.bowlSlots; i++){
        html += `<div class="xi-slot-ghost bowl"><div class="xi-order bowl-tag">B</div><div class="ghost-label">Empty bowler slot — pick a BOWL / AR</div></div>`;
      }
    }
  } else {
    xi.forEach((pid, i) => {
      const p = playerOf(team.id, pid);
      html += xiItemHTML(p, team, i, { orderNo: i+1, canUp: i>0, canDown: i<xi.length-1 });
    });
  }
  wrap.innerHTML = html;

  $$('.xi-item', wrap).forEach(item => {
    const pid = item.getAttribute('data-pid');
    $$('[data-move]', item).forEach(b => b.addEventListener('click', () => moveInXI(pid, +b.getAttribute('data-move'))));
    const cBtn = item.querySelector('[data-cap]'); if(cBtn) cBtn.addEventListener('click', () => makeCaptain(pid));
    const kBtn = item.querySelector('[data-wk]'); if(kBtn) kBtn.addEventListener('click', () => makeKeeper(pid));
    const bBtn = item.querySelector('[data-bowl]'); if(bBtn) bBtn.addEventListener('click', () => toggleBowling(pid));
    const rBtn = item.querySelector('[data-remove]'); if(rBtn) rBtn.addEventListener('click', () => removeFromXI(pid));
  });
}
function renderOverseasMeter(){
  const side = currentXITeam;
  const teamId = sideIds(side);
  const xi = xiOf(side);
  const os = xi.filter(id => playerOf(teamId, id).overseas).length;
  $('#xiOverseasStat').textContent = os;
  $('#osMeterText').textContent = `${os} / 4`;
  $('#osDots').innerHTML = [0,1,2,3].map(i=>`<span class="os-dot${i<os?' fill':''}"></span>`).join('');
}
function renderXiStats(){
  const side = currentXITeam;
  const teamId = sideIds(side);
  const xi = xiOf(side);
  const avg = xi.length ? Math.round(xi.reduce((s,id)=>s+playerOf(teamId,id).ovr,0)/xi.length) : '–';
  $('#xiAvgStat').textContent = avg;
  $('#xiBowlStat').textContent = S.mode==='showdown'
    ? bowlersOf(side, teamId).length
    : bowlOf(side).length;
  $('#xiCount').textContent = xi.length;
  const maxEl = $('#xiCountMax'); if(maxEl) maxEl.textContent = ' / ' + modeCfg().teamSize;
}
function validateXI(side){
  const team = teamOf(sideIds(side));
  const squadIds = new Set(team.players.map(p=>p.id));
  const xi = xiOf(side);
  const unique = new Set(xi).size === xi.length;
  const allEligible = xi.every(id => squadIds.has(id));
  const osCount = xi.filter(id => playerOf(team.id,id)?.overseas).length;
  const capP = capOf(side), wkP = wkOf(side);
  const capOK = !!capP && xi.includes(capP);
  const wkInXI = xi.some(id => playerOf(team.id,id).role==='WK');
  const wkOK = wkP ? (xi.includes(wkP) && playerOf(team.id, wkP).role==='WK') : !wkInXI; // keeper mandatory only when a WK is on the sheet
  const teamsDifferent = !!S.team1Id && !!S.team2Id && S.team1Id !== S.team2Id;
  const cfg = modeCfg();

  if(S.mode === 'showdown'){
    const batters = battersOf(side, team.id);
    const bowlers = bowlersOf(side, team.id);
    return [
      { label:`Squad size ${xi.length}/7 (4 batters + 3 bowlers)`, ok: xi.length===7 },
      { label:`Batters selected: ${batters.length}/4`, ok: batters.length===4 },
      { label:`Bowlers selected: ${bowlers.length}/3`, ok: bowlers.length===3 },
      { label:`Overseas players: ${osCount} of max 4`, ok: osCount<=4 },
      { label:'No duplicate players', ok: unique },
      { label:'All players eligible (from this squad)', ok: allEligible },
      { label:'Captain selected from the squad', ok: capOK },
      { label: wkInXI ? (wkP ? 'Wicketkeeper selected (WK role)' : 'Wicketkeeper selected (a WK is in the squad)') : 'No WK picked — keeper not required', ok: wkOK },
      { label:`Batting order set — ${Math.min(batters.length,4)}/4 (▲▼ to shuffle)`, ok: batters.length===4 },
      { label:'Bowling attack set (the 3 picks are the options)', ok: bowlers.length===3 },
      { label:'Both franchises different', ok: teamsDifferent },
    ];
  }
  const bowl = bowlOf(side);
  const bowlOpts = bowl.filter(id=>xi.includes(id));
  return [
    { label:`Exactly 11 players selected (${xi.length}/11)`, ok: xi.length===11 },
    { label:`Overseas players: ${osCount} of max 4`, ok: osCount<=4 },
    { label:'No duplicate players', ok: unique },
    { label:'All players eligible (from this squad)', ok: allEligible },
    { label:`At least one wicketkeeper in the XI`, ok: wkInXI },
    { label:'Captain selected from the XI', ok: capOK },
    { label:'Wicketkeeper selected (WK role only)', ok: wkOK },
    { label:`Batting order set (${xi.length===11?'11 named · tap ▲▼ to adjust':'needs 11 players'})`, ok: xi.length===11 },
    { label:`Bowling options marked: ${bowlOpts.length} of min 5`, ok: bowlOpts.length>=5 },
    S.mode==='tournament'
      ? { label:'Championship franchise locked', ok: !!S.team1Id }
      : { label:'Both franchises different', ok: teamsDifferent },
  ];
}
function renderValidation(){
  const items = validateXI(currentXITeam);
  $('#xiValidation').innerHTML = items.map(v =>
    `<div class="v-item ${v.ok?'ok':'bad'}"><span class="vi">✓</span><span>${esc(v.label)}</span></div>`).join('');
  const allOk = items.every(v => v.ok);
  const btn = $('#confirmXiBtn');
  btn.disabled = !allOk;
  const label = $('#confirmXiLabel');
  const isShowdown = S.mode === 'showdown';
  if(label) label.textContent = S.mode==='tournament' ? 'Lock In Championship XI'
    : currentXITeam === 'team1'
      ? (isShowdown ? 'Confirm Team 1 Squad' : 'Confirm Team 1 XI')
      : (isShowdown ? 'Confirm Team 2 Squad' : 'Confirm Team 2 XI');
  const hint = $('#confirmHint');
  if(hint){
    if(allOk){
      hint.textContent = 'All checks green — you are clear to proceed.';
      hint.className = 'confirm-hint ok';
    } else {
      const next = items.find(v => !v.ok);
      hint.textContent = 'Locked until fixed: ' + (next ? next.label : 'complete the checklist');
      hint.className = 'confirm-hint bad';
    }
  }
}
function renderXIScreen(){
  const side = currentXITeam;
  const teamId = sideIds(side);
  if(!teamId){ goto(side==='team1'?'team1':'team2'); return; }
  const team = teamOf(teamId);
  const isShowdown = S.mode === 'showdown';
  const isTournament = S.mode === 'tournament';
  const root = $('#screen-xi');
  root.style.setProperty('--tc', team.c1);
  root.style.setProperty('--tc2', team.c2);
  $('#xiTeamName').textContent = team.name;
  $('#xiTeamSub').textContent = isTournament
    ? `Championship XI — one squad, entire IPL 2026 season · Capt: ${team.cap}`
    : isShowdown
      ? `Showdown Squad — ${side==='team1'?'Team 1':'Team 2'} · 4 BAT + 3 BOWL · Capt: ${team.cap}`
      : `Playing XI Selection — ${side==='team1'?'Team 1':'Team 2'} · Capt: ${team.cap}`;
  $('#xiSidebarTitle').textContent = isShowdown
    ? `Showdown Squad · ${team.short}`
    : `Playing XI · ${team.short}`;
  $('#xiHead').querySelector('.crest')?.remove();
  $('#xiHead').insertAdjacentHTML('afterbegin', crestSVG(team));
  const pills = [ ['ALL','All'], ['BAT','Batters'], ['WK','Keepers'], ['AR','All-Round'], ['BOWL','Bowlers'] ];
  $('#rolePills').innerHTML = pills.map(([k,l])=>`<button class="pill${squadFilter.role===k?' active':''}" data-role="${k}">${l}</button>`).join('');
  $$('#rolePills .pill').forEach(b => b.addEventListener('click', () => { squadFilter.role = b.getAttribute('data-role'); renderSquadList(); renderRolePillActive(); }));
  $('#overseasToggle').classList.toggle('on', squadFilter.overseasOnly);
  $('#overseasToggle').setAttribute('aria-pressed', squadFilter.overseasOnly ? 'true':'false');
  const switchBtn = $('#switchXiBtn');
  if(switchBtn){
    const other = side === 'team1' ? 'team2' : 'team1';
    const otherTeamId = sideIds(other);
    if(otherTeamId){
      switchBtn.style.display = '';
      switchBtn.textContent = other === 'team1' ? '← Team 1 XI' : 'Team 2 XI →';
      switchBtn.onclick = () => {
        squadFilter = { q:'', role:'ALL', overseasOnly:false };
        $('#squadSearch').value = '';
        currentXITeam = other;
        renderXIScreen();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    } else {
      switchBtn.style.display = 'none';
    }
  }
  renderSquadList(); renderXiList(); renderOverseasMeter(); renderXiStats(); renderValidation();
  $('#confirmXiBtn').innerHTML = (S.mode==='tournament' ? 'Lock In Championship XI'
      : (isShowdown
        ? (side==='team1' ? 'Confirm Team 1 Squad' : 'Confirm Team 2 Squad')
        : (side==='team1' ? 'Confirm Team 1 XI' : 'Confirm Team 2 XI'))) +
    ` <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
}
function renderRolePillActive(){
  $$('#rolePills .pill').forEach(b=>b.classList.toggle('active', b.getAttribute('data-role')===squadFilter.role));
}
function refreshXIViews(){
  renderSquadList(); renderXiList(); renderOverseasMeter(); renderXiStats(); renderValidation(); saveState();
}
function rebalanceXiOrder(side){
  // keep [batters..., bowlers...] with batter/selection order preserved
  const teamId = sideIds(side);
  const team = teamOf(teamId);
  const xi = xiOf(side);
  const batters = xi.filter(id=>isBatterRole(playerOf(teamId,id).role));
  const bowlers = xi.filter(id=>isBowlerRole(playerOf(teamId,id).role));
  const ordered = [...batters, ...bowlers];
  if(side==='team1') S.xiTeam1 = ordered; else S.xiTeam2 = ordered;
}
function addToXI(pid){
  const side = currentXITeam;
  const teamId = sideIds(side);
  const team = teamOf(teamId);
  const p = playerOf(teamId, pid);
  const state = squadAddState(p, team);
  if(state.inXI) return;
  if(state.blocked){ toast(state.msg); return; }
  xiOf(side).push(pid);
  if(S.mode === 'showdown') rebalanceXiOrder(side);
  refreshXIViews();
}
function removeFromXI(pid){
  const side = currentXITeam;
  if(side==='team1'){
    S.xiTeam1 = S.xiTeam1.filter(id=>id!==pid);
    if(S.capTeam1===pid) S.capTeam1 = null;
    if(S.wkTeam1===pid)  S.wkTeam1  = null;
    S.bowlTeam1 = S.bowlTeam1.filter(id=>id!==pid);
    S.xi1Confirmed = false;
  } else {
    S.xiTeam2 = S.xiTeam2.filter(id=>id!==pid);
    if(S.capTeam2===pid) S.capTeam2 = null;
    if(S.wkTeam2===pid)  S.wkTeam2  = null;
    S.bowlTeam2 = S.bowlTeam2.filter(id=>id!==pid);
    S.xi2Confirmed = false;
  }
  refreshXIViews();
}
function moveInXI(pid, dir){
  const side = currentXITeam;
  const teamId = sideIds(side);
  const team = teamOf(teamId);
  const xi = xiOf(side);
  if(S.mode === 'showdown'){
    // reorder only inside the batter block
    const batters = xi.filter(id=>isBatterRole(playerOf(teamId,id).role));
    const i = batters.indexOf(pid);
    const j = i + dir;
    if(i<0 || j<0 || j>=batters.length){ toast('Only batters bat — bowlers have no order.'); return; }
    [batters[i], batters[j]] = [batters[j], batters[i]];
    const bowlers = xi.filter(id=>isBowlerRole(playerOf(teamId,id).role));
    const ordered = [...batters, ...bowlers];
    if(side==='team1') S.xiTeam1 = ordered; else S.xiTeam2 = ordered;
  } else {
    const i = xi.indexOf(pid);
    const j = i + dir;
    if(i<0 || j<0 || j>=xi.length) return;
    [xi[i], xi[j]] = [xi[j], xi[i]];
  }
  refreshXIViews();
}
function makeCaptain(pid){
  const side = currentXITeam;
  if(side==='team1') S.capTeam1 = (S.capTeam1===pid ? null : pid);
  else               S.capTeam2 = (S.capTeam2===pid ? null : pid);
  refreshXIViews();
}
function makeKeeper(pid){
  const side = currentXITeam;
  const teamId = sideIds(side);
  const p = playerOf(teamId, pid);
  if(p.role !== 'WK'){ toast(`${p.name} is not a wicketkeeping-role player.`); return; }
  if(side==='team1') S.wkTeam1 = (S.wkTeam1===pid ? null : pid);
  else               S.wkTeam2 = (S.wkTeam2===pid ? null : pid);
  refreshXIViews();
}
function toggleBowling(pid){
  const side = currentXITeam;
  const teamId = sideIds(side);
  const p = playerOf(teamId, pid);
  if(!isBowlerRole(p.role)){ toast('Only bowlers / all-rounders can be marked as bowling options.'); return; }
  const arr = bowlOf(side);
  const i = arr.indexOf(pid);
  if(i>=0) arr.splice(i,1); else arr.push(pid);
  refreshXIViews();
}
function suggestBattingOrder(){
  const side = currentXITeam;
  const teamId = sideIds(side);
  const xi = xiOf(side);
  if(xi.length < 2){ toast('Add at least 2 players first.'); return; }
  const batters = xi.filter(id=>isBatterRole(playerOf(teamId,id).role))
    .sort((a,b)=>playerOf(teamId,b).batR - playerOf(teamId,a).batR);
  const bowlers = xi.filter(id=>isBowlerRole(playerOf(teamId,id).role));
  const ordered = [...batters, ...bowlers];
  if(side==='team1') S.xiTeam1 = ordered; else S.xiTeam2 = ordered;
  refreshXIViews();
  toast('Batters arranged by batting rating — fine-tune with ▲▼. Nobody was added or removed.');
}
/* ── AI QUICK PICK — fills EMPTY slots only, never touches user picks ── */
function aiQuickPick(){
  const side = currentXITeam;
  const teamId = sideIds(side);
  const team = teamOf(teamId);
  const xi = xiOf(side);
  const cap = modeCfg().overseasCap;
  const overseasOK = p => !p.overseas || xi.filter(id=>playerOf(teamId,id).overseas).length < cap;
  const eligible = p => !xi.includes(p.id) && overseasOK(p);
  const sorted = (arr, key) => [...arr].sort((a,b)=>(b[key]-a[key]) || (b.ovr-a.ovr));
  let added = 0;

  if(S.mode === 'showdown'){
    const BAT_SLOTS = MODE_CFG.showdown.batSlots, BOWL_SLOTS = MODE_CFG.showdown.bowlSlots;
    const batters = xi.filter(id=>isBatterRole(playerOf(teamId,id).role));
    const bowlers = xi.filter(id=>isBowlerRole(playerOf(teamId,id).role));
    for(const p of sorted(team.players.filter(p=>isBatterRole(p.role)), 'batR')){
      if(batters.length >= BAT_SLOTS) break;
      if(!eligible(p)) continue;
      xi.push(p.id); batters.push(p.id); added++;
    }
    for(const p of sorted(team.players.filter(p=>isBowlerRole(p.role)), 'bowlR')){
      if(bowlers.length >= BOWL_SLOTS) break;
      if(!eligible(p)) continue;
      xi.push(p.id); bowlers.push(p.id); added++;
    }
    rebalanceXiOrder(side);
  } else {
    const pool = sorted(team.players, 'ovr');
    const bestWK = sorted(team.players.filter(p=>p.role==='WK'), 'ovr')[0];
    const hasWK = () => xi.some(id=>playerOf(teamId,id).role==='WK');
    const bowlCount = () => xi.filter(id=>isBowlerRole(playerOf(teamId,id).role)).length;
    let guard = 20;
    while(xi.length < 11 && guard-- > 0){
      let pick = null;
      // Priority 1: a wicketkeeper must be in the XI
      if(!hasWK() && bestWK && eligible(bestWK)) pick = bestWK;
      // Priority 2: need at least 5 bowling options
      if(!pick && bowlCount() < 5){
        pick = sorted(team.players.filter(p=>isBowlerRole(p.role) && eligible(p)), 'bowlR')[0] || null;
      }
      // Otherwise: best remaining player overall
      if(!pick) pick = pool.find(eligible) || null;
      if(!pick) break;   // nothing legal left (overseas cap etc.)
      xi.push(pick.id); added++;
    }
    // Constraints that can't be met WITHOUT dropping a user pick are reported, never swapped in silently
    if(xi.length >= 11){
      const problems = [];
      if(!hasWK()) problems.push('no wicketkeeper in the XI');
      if(bowlCount() < 5) problems.push(`only ${bowlCount()} bowling options (min 5)`);
      if(problems.length){
        saveState(); refreshXIViews();
        toast(`Filled all slots, but: ${problems.join('; ')}. Swap somebody in yourself — your picks were never touched.`);
        return;
      }
    }
  }
  // ── Finish the sheet — only fills UNSET markers, never changes a user's choice ──
  const autoNotes = [];
  const inXI = id => xi.includes(id);
  const bestInXI = roleFilter => {
    const cands = xi.map(id=>playerOf(teamId,id)).filter(p=>roleFilter(p));
    cands.sort((a,b)=>b.ovr - a.ovr);
    return cands[0] || null;
  };
  // Captain: only if none chosen yet
  if(!capOf(side)){
    const captain = bestInXI(()=>true);
    if(captain){
      if(side==='team1') S.capTeam1 = captain.id; else S.capTeam2 = captain.id;
      autoNotes.push(`captain ${captain.name}`);
    }
  }
  // Wicketkeeper: only if none chosen yet — and only if a WK is in the XI
  const wksInXI = xi.map(id=>playerOf(teamId,id)).filter(p=>p.role==='WK');
  if(!wkOf(side) && wksInXI.length){
    wksInXI.sort((a,b)=>b.ovr - a.ovr);
    if(side==='team1') S.wkTeam1 = wksInXI[0].id; else S.wkTeam2 = wksInXI[0].id;
    autoNotes.push(`keeper ${wksInXI[0].name}`);
  }
  // Bowling options (full mode only): mark the best bowlers until ≥5 are set
  if(S.mode !== 'showdown'){
    const arr = bowlOf(side);
    const marked = arr.filter(id=>xi.includes(id));
    if(marked.length < 5){
      const bowlers = xi.map(id=>playerOf(teamId,id))
        .filter(p=>isBowlerRole(p.role) && !marked.includes(p.id))
        .sort((a,b)=>b.bowlR - a.bowlR);
      const need = 5 - marked.length;
      for(let i=0;i<Math.min(need, bowlers.length);i++){
        arr.push(bowlers[i].id); autoNotes.push(`bowling option ${bowlers[i].name}`);
      }
    }
  }

  if(added === 0 && !autoNotes.length){ toast('Squad already complete — use ✕ to free a slot first.'); return; }
  saveState();
  refreshXIViews();
  const bits = [];
  if(added) bits.push(`added ${added} player${added>1?'s':''}`);
  if(autoNotes.length) bits.push(`set ${autoNotes.length>2 ? autoNotes.length + ' markers' : autoNotes.join(' & ')}`);
  toast(`AI Quick Pick ${bits.join(' and ')} — everything stays editable.`);
}

/* ─────────────────────────────────────────────
   CONFIRM SCREEN
   ───────────────────────────────────────────── */
function teamSheetHTML(side){
  const teamId = sideIds(side);
  const team = teamOf(teamId);
  const xi = xiOf(side);
  const capP = capOf(side), wkP = wkOf(side);
  const isShowdown = S.mode === 'showdown';
  const avg = Math.round(xi.reduce((s,id)=>s+playerOf(teamId,id).ovr,0)/xi.length);
  const os = xi.filter(id=>playerOf(teamId,id).overseas).length;
  const batters = xi.filter(id=>isBatterRole(playerOf(teamId,id).role));
  const bowlers = xi.filter(id=>isBowlerRole(playerOf(teamId,id).role));
  const bowlCount = isShowdown ? bowlers.length : bowlOf(side).length;
  const row = (pid, i) => {
    const p = playerOf(teamId, pid);
    const tags = [capP===pid?'<span class="mini-tag C">C</span>':'', wkP===pid?'<span class="mini-tag WK">WK</span>':'', (isShowdown ? isBowlerRole(p.role) : bowlOf(side).includes(pid))?'<span class="mini-tag BALL">BWL</span>':''].join('');
    return `<div class="ts-row"><span class="n">${String(i+1).padStart(2,'0')}</span>
      <span class="nm">${esc(p.name)}${tags}</span>
      <span class="rt">${p.ovr}</span>
      <span class="role-badge role-${p.role}" style="font-size:8px">${ROLE_NAMES[p.role].split(' ')[0]}</span></div>`;
  };
  let rows = '';
  if(isShowdown){
    rows += batters.map((pid,i)=>row(pid,i)).join('');
    rows += `<div class="ts-divider"><span>BOWLERS</span></div>`;
    rows += bowlers.map((pid,i)=>`<div class="ts-row bowler-row"><span class="n">B${i+1}</span>
      <span class="nm">${esc(playerOf(teamId,pid).name)}${capP===pid?'<span class="mini-tag C">C</span>':''}</span>
      <span class="rt">${playerOf(teamId,pid).ovr}</span>
      <span class="role-badge role-${playerOf(teamId,pid).role}" style="font-size:8px">${ROLE_NAMES[playerOf(teamId,pid).role].split(' ')[0]}</span></div>`).join('');
  } else {
    rows = xi.map((pid,i)=>row(pid,i)).join('');
  }
  return `<div class="ts-head">${crestSVG(team)}
      <div><h3>${esc(team.short)}</h3><div class="ts-sub">${esc(team.name)}</div></div>
      <div class="ts-avg"><div class="v">${avg}</div><div class="l">Avg OVR</div></div>
    </div>
    <div class="ts-body">${rows}</div>
    <div class="ts-foot">
      <span>Captain <b>${esc(playerOf(teamId,capP)?.name||'—')}</b></span>
      <span>Keeper <b>${esc(playerOf(teamId,wkP)?.name||'—')}</b></span>
      <span>Overseas <b>${os}/4</b></span>
      <span>Bowling options <b>${bowlCount}</b></span>
    </div>`;
}
function renderConfirmScreen(){
  if(!S.xi1Confirmed || !S.xi2Confirmed){ currentXITeam = S.xi1Confirmed ? 'team2':'team1'; goto('xi'); return; }
  const t1 = teamOf(S.team1Id), t2 = teamOf(S.team2Id);
  $('#sheetTeam1').style.setProperty('--tc', t1.c1);
  $('#sheetTeam2').style.setProperty('--tc', t2.c1);
  $('#sheetTeam1').innerHTML = teamSheetHTML('team1');
  $('#sheetTeam2').innerHTML = teamSheetHTML('team2');
  const showdown = S.mode === 'showdown';
  $('#fairplayChips').innerHTML = [
    showdown ? '4 batters + 3 bowlers each' : '11 players each',
    'Max 4 overseas each','No duplicates','Different franchises',
    showdown ? '2 wickets end the innings' : 'Full batting card',
    'Captains named','Batting orders set',
    showdown ? '3 bowling options each' : '5+ bowling options each'
  ].map(t=>`<span class="fp-chip"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>${esc(t)}</span>`).join('');
}

/* ─────────────────────────────────────────────
   TOSS
   ───────────────────────────────────────────── */
function renderTossScreen(){
  const t1 = teamOf(S.team1Id), t2 = teamOf(S.team2Id);
  $('#tossCap1').innerHTML = `${crestSVG(t1)}<div class="nm">${esc(t1.cap)}</div><div class="cap-role">${esc(t1.short)} Captain</div>`;
  $('#tossCap2').innerHTML = `${crestSVG(t2)}<div class="nm">${esc(t2.cap)}</div><div class="cap-role">${esc(t2.short)} Captain</div>`;
  $('#tossResult').innerHTML = S.toss.spun
    ? `<em>${esc(teamOf(S.toss.winnerId).short)}</em> won the toss`
    : 'Flip the coin';
  $('#decisionZone').style.display = S.toss.spun ? 'flex' : 'none';
  $('#startMatchZone').style.display = (S.toss.spun && S.toss.choice) ? 'flex' : 'none';
  $$('#decisionZone .choice-card').forEach(c => c.classList.toggle('picked', S.toss.choice === c.getAttribute('data-choice')));
  $('#coinBtn').style.pointerEvents = S.toss.spun ? 'none' : 'auto';
  $('#coinBtn').style.opacity = S.toss.spun ? '.85' : '1';
}
function flipCoin(){
  if(S.toss.spun) return;
  const heads = Math.random() < 0.5;
  const winnerId = heads ? S.team1Id : S.team2Id;
  const coin = $('#coinBtn');
  coin.style.setProperty('--spin-end', (heads ? 2160 : 1980) + 'deg');
  coin.classList.remove('flipping');
  void coin.offsetWidth;
  coin.classList.add('flipping');
  $('#tossResult').textContent = '…';
  setTimeout(() => {
    S.toss = { spun:true, winnerId, choice:null };
    saveState();
    renderTossScreen();
    toast(`${teamOf(winnerId).name} win the toss — ${teamOf(winnerId).cap} elects.`);
  }, 1650);
}
function setTossChoice(choice){
  if(!S.toss.spun) return;
  S.toss.choice = choice;
  saveState();
  renderTossScreen();
}

/* ─────────────────────────────────────────────
   WIRE-UP
   ───────────────────────────────────────────── */
function init(){
  $('#resetAllBtn').addEventListener('click', resetAll);
  updateSelectBar(null);

  // format cards
  $$('.mode-card').forEach(card => card.addEventListener('click', () => pickMode(card.getAttribute('data-mode'))));

  // XI screen interactions
  $('#squadSearch').addEventListener('input', e => { squadFilter.q = e.target.value; renderSquadList(); });
  $('#overseasToggle').addEventListener('click', () => { squadFilter.overseasOnly = !squadFilter.overseasOnly; renderXIScreen(); });
  $('#suggestOrderBtn').addEventListener('click', suggestBattingOrder);
  $('#quickPickBtn').addEventListener('click', aiQuickPick);
  $('#confirmXiBtn').addEventListener('click', () => {
    if($('#confirmXiBtn').disabled) return;
    if(S.mode === 'tournament'){
      S.xi1Confirmed = true; saveState();
      const overs = window.__iplLeagueOvers === 20 ? 20 : 5;
      window.IPLLeague.createSeason(overs);
      toast('Championship locked in — the road to the IPL 2026 final begins.');
      goto('season');
      return;
    }
    if(currentXITeam==='team1'){
      S.xi1Confirmed = true; saveState();
      if(S.xi2Confirmed){ toast('Team 1 squad re-locked. Back to the final review.'); goto('confirm'); }
      else { toast('Team 1 locked in. Now build Team 2’s side.'); currentXITeam = 'team2'; goto('xi'); }
    } else { S.xi2Confirmed = true; saveState(); toast('Both sides confirmed — review and lock the match.'); goto('confirm'); }
  });

  // confirm screen
  $('#backToXiBtn').addEventListener('click', () => { currentXITeam = 'team1'; goto('xi'); });
  $('#confirmMatchBtn').addEventListener('click', () => { S.teamsLocked = true; saveState(); toast('Teams locked. The stage is set for the toss.'); goto('toss'); });

  // toss
  $('#coinBtn').addEventListener('click', flipCoin);
  $$('#decisionZone .choice-card').forEach(c => c.addEventListener('click', () => setTossChoice(c.getAttribute('data-choice'))));
  $('#startMatchBtn').addEventListener('click', () => {
    if(!S.toss.spun || !S.toss.choice){ toast('Complete the toss first.'); return; }
    saveState();
    goto('match');
  });

  // boot into saved screen (guarding illegal states)
  let boot = S.screen || 'mode';
  if(!S.mode && boot !== 'mode') boot = 'mode';
  if(boot==='team2' && !S.team1Id) boot='team1';
  if(S.mode==='tournament'){
    const seasonLive = !!(window.IPLLeague && window.IPLLeague.season);
    if(boot==='season' && !seasonLive) boot = 'seasonTeam';
    if(boot==='stats' && !seasonLive) boot = 'seasonTeam';
    if(boot==='seasonTeam' && seasonLive) boot = 'season';
    if(boot==='xi'){ currentXITeam = 'team1'; if(!S.team1Id) boot = 'seasonTeam'; }
    if(boot==='team1' || boot==='team2' || boot==='confirm' || boot==='toss' || boot==='match') boot = seasonLive ? 'season' : (S.team1Id ? 'xi' : 'seasonTeam');
  }
  if(boot==='xi' && S.mode!=='tournament'){ currentXITeam = (S.team1Id && !S.xi1Confirmed) ? 'team1' : (S.team2Id ? 'team2':'team1'); if(!sideIds(currentXITeam)) boot = S.team1Id ? 'team2':'team1'; }
  if(boot==='confirm' && S.mode!=='tournament' && !(S.xi1Confirmed && S.xi2Confirmed)) { boot = 'xi'; currentXITeam = S.xi1Confirmed ? 'team2':'team1'; }
  if(boot==='toss' && S.mode!=='tournament' && !(S.xi1Confirmed && S.xi2Confirmed)) boot='confirm';
  S.screen = boot;
  goto(boot);
}
document.addEventListener('DOMContentLoaded', init);

/* exposed for match.js + match2d.js + debugging */
window.IPLApp = {
  get state(){ return S; },
  DATA, teamOf, playerOf, sideIds, xiOf, capOf, wkOf, bowlOf, crestSVG, toast, goto, saveState, esc,
  modeCfg, battersOf, bowlersOf, isBatterRole, isBowlerRole,
};
