(() => {
/* ============================================================
   IPL 2026 CHAMPIONSHIP — browser UI & tournament controller
   Screens: #screen-season-team · #screen-season · #screen-stats
   Core engine: js/league-core.js (fixtures, sim, stats, table)
   ============================================================ */
'use strict';
const A = () => window.IPLApp;
const C = () => window.IPLLeagueCore;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE = 'ipl2026-season-v1';
const HIST = 'ipl2026-champions';

let season = null;
let pendingTeamId = null;
let currentRoundView = 1;
let lockReturnFocus = null;
// eager boot so app.js screen-restore sees the season synchronously
try { if(C().setData) C().setData(A().DATA); } catch(e){ console.warn('league-core data not ready', e); }
season = loadSeason();

/* ── boot / state helpers ─────────────────────────────── */
function persist(){
  try { localStorage.setItem(STORE, JSON.stringify(season)); } catch(e){ console.warn('season save failed', e); }
}
function loadSeason(){
  try {
    const raw = localStorage.getItem(STORE);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s || s.version !== 1 || !Array.isArray(s.fixtures)) return null;
    return s;
  } catch(e){ return null; }
}
function wipeSeason(){
  season = null; pendingTeamId = null; currentRoundView = 1;
  window.__iplChampionship = null; window.__iplChampFrom2D = false;
  try { localStorage.removeItem(STORE); } catch(e){}
}
function championsHistory(){
  try { return JSON.parse(localStorage.getItem(HIST) || '[]'); } catch(e){ return []; }
}
function saveChampionHistory(entry){
  try { const h = championsHistory(); h.unshift(entry); localStorage.setItem(HIST, JSON.stringify(h.slice(0, 12))); } catch(e){}
}

const teamShort = id => A().teamOf(id).short;
const teamName = id => A().teamOf(id).name;
const crestOf = (id, cls) => A().crestSVG(A().teamOf(id), cls);

function seasonTeamStats(tid){
  const rows = computeRows();
  const pos = rows.findIndex(r => r.id === tid) + 1;
  const me = rows.find(r => r.id === tid);
  return { pos, pts: me ? me.pts : 0, nrr: me ? me.nrr : 0, p: me ? me.p : 0, w: me ? me.w : 0, l: me ? me.l : 0, t: me ? me.t : 0, nr: me ? me.nr : 0 };
}
function computeRows(){
  return C().computeTable(season.cfg, season.fixtures, Object.keys(A().DATA));
}
function nextRound(){
  const unplayed = season.fixtures.filter(f => !f.played);
  if(!unplayed.length) return null;
  return Math.min(...unplayed.map(f => f.round));
}
function userNextFixture(){
  return season.fixtures
    .filter(f => f.userMatch && !f.played)
    .sort((a, b) => a.round - b.round || a.game - b.game)[0] || null;
}
function leagueComplete(){ return season.fixtures.every(f => f.played); }

/* ── init / lifecycle ─────────────────────────────────── */
function init(){
  const core = C();
  if(core && core.setData) core.setData(A().DATA);
  if(!season) season = loadSeason();
  if(season && season.cfg && season.cfg.overs !== 1){
    wipeSeason();
    setTimeout(() => toast('Championship moved to the one-over format — the old exhibition season was reset.'), 900);
  }
  if(season) currentRoundView = nextRound() || 18;
  bindStatic();
}
function setLeagueNavActive(which){
  $$('#leagueNav [data-hubnav]').forEach(b => b.classList.toggle('active', b.getAttribute('data-hubnav') === which));
}
function bindStatic(){
  $$('#leagueNav [data-hubnav]').forEach(b => b.addEventListener('click', () => {
    if(b.getAttribute('data-hubnav') === 'stats') gotoStats(); else gotoHub();
  }));
  const bind = (id, fn) => { const e = $(id); if(e) e.addEventListener('click', fn); };
  bind('#leagueConfirmBtn', confirmLockOpenModal);
  bind('#seasonTeamBackBtn', backToTeams);
  bind('#lockBackBtn', closeLockModal);
  bind('#lockConfirmBtn', confirmLockAndProceed);
  const lm = $('#lockTeamModal'); if(lm) lm.addEventListener('click', e => { if(e.target === lm) closeLockModal(); });
  bind('#playNextBtn', playNextMatch);
  bind('#simOtherBtn', simOtherFixturesInRound);
  bind('#simRemainingBtn', simRemainingLeague);
  bind('#hubStatsBtn', gotoStats);
  bind('#statsBackBtn', gotoHub);
  bind('#simAllCancelBtn', closeSimAllModal);
  bind('#simAllConfirmBtn', confirmSimRemainingLeague);
  bind('#matchResultContinueBtn', closeMatchResult);
  const rm = $('#matchResultModal'); if(rm) rm.addEventListener('click', e => { if(e.target === rm) closeMatchResult(); });
  bind('#resetSeasonBtn', armResetSeason);
  bind('#champResetBtn', resetSeason);
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    ['#matchResultModal', '#lockTeamModal', '#simAllModal'].forEach(id => { const m = $(id); if(m && m.classList.contains('show')) m.classList.remove('show'); });
  });
}
let resetArmAt = 0;
function armResetSeason(){
  const now = Date.now();
  if(now - resetArmAt > 3200){
    resetArmAt = now;
    toast('Click again within 3s to wipe the IPL 2026 season.');
    return;
  }
  resetSeason();
}
function createSeason(){
  wipeSeason();
  season = C().createSeasonState(A().state.team1Id, { overs: 1 });
  // user XI: read from the app's locked Team-1 XI
  const xiIds = (A().state.xiTeam1 || []).slice();
  const cap = A().state.capTeam1 || xiIds[0];
  const wk = A().state.wkTeam1 || null;
  const bowl = (A().state.bowlTeam1 || []).slice(0, 5);
  season.userXi = {
    order: xiIds,
    bowlOptions: bowl.length >= 5
      ? bowl
      : xiIds.filter(id => { const p = A().playerOf(A().state.team1Id, id); return p.role === 'BOWL' || p.role === 'AR'; }).slice(0, 5),
    captain: cap,
    keeper: wk,
  };
  // user matches flagged at creation
  season.fixtures.forEach(f => { f.userMatch = (f.home === season.userTeamId || f.away === season.userTeamId); });
  season.phase = 'league';
  persist();
  currentRoundView = 1;
  return season;
}
/* ══════════════════════════════════════════════════════
   2D BROADCAST CAPTURE — played-in-the-engine Championship matches
   Converts the live one-over engine state (js/match.js) into the same
   result shape the instant simulator produces, then routes it through the
   exact same pipeline (stats → standings → playoff bracket → persistence).
   Exposed for js/match.js via window.IPLMatchChamp.
   ══════════════════════════════════════════════════════ */
function xiShapeFor(teamId){
  return teamId === season.userTeamId ? season.userXi : C().aiXiCached(season, teamId);
}
function convertEngineInn(inn){
  const pName = id => { const p = A().playerOf(inn.battingTeamId, id); return p ? p.name : id; };
  const bowling = {};
  { const bw = inn.bowler; bowling[bw.id] = { id: bw.id, balls: bw.legalBalls, runs: bw.runs, wickets: bw.wickets, maidens: 0 }; }
  const batting = {};
  Object.values(inn.batters).forEach(b => {
    batting[b.id] = { id: b.id, runs: b.runs, balls: b.balls, '4s': b.fours, '6s': b.sixes, out: b.out, how: b.howOut };
  });
  const fielding = {};
  Object.entries(inn.fielding || {}).forEach(([id, f]) => { fielding[id] = { id, ct: f.ct || 0, ro: f.ro || 0, st: f.st || 0 }; });
  return {
    teamId: inn.battingTeamId,
    runs: inn.runs, wickets: inn.wickets, balls: inn.legalBalls, legalBalls: inn.legalBalls, extras: inn.extras,
    batting, bowling, fielding,
    fow: (inn.fow || []).map(f => ({ n: f.wickets, runs: f.score, over: f.over, player: pName(f.batter) })),
    allOut: inn.wickets >= 10, completed: true,
  };
}
function build2DMatchResult(M){
  const ctx = window.__iplChampionship;
  const inn1M = M.innings[0], inn2M = M.innings[1];
  const homeId = ctx.homeId, awayId = ctx.awayId;
  const firstBatId = inn1M.battingTeamId, secondBatId = inn2M.battingTeamId;
  const homeXi = xiShapeFor(homeId), awayXi = xiShapeFor(awayId);
  const inn1 = convertEngineInn(inn1M), inn2 = convertEngineInn(inn2M);
  const res = {
    played: true, washout: false, nr: false, tie: false,
    home: homeId, away: awayId,
    tossWinner: A().state.toss.winnerId, tossChoice: A().state.toss.choice,
    firstBat: firstBatId, secondBat: secondBatId,
    homeXi, awayXi, inn1, inn2,
    supOv: 0, overs: 1, playedBy2D: true,
  };
  const r1 = inn1.runs, r2 = inn2.runs;
  const isPlayoff = ctx.kind === 'playoff';
  if(r1 === r2){
    res.tie = true;
    if(isPlayoff){
      const so = C().superOver(homeId, awayId, { overs: 1 }, homeXi, awayXi, firstBatId);
      res.supOv = 1 + (so.tiedAgain ? 1 : 0) + (so.tiedAgain2 ? 1 : 0);
      res.superOver = so;
      res.winner = so.winner;
      res.tie = false;
      res.margin = 'Super Over';
    } else {
      res.winner = null; res.margin = 'Match tied';
    }
  } else if(r2 > r1){
    res.winner = secondBatId;
    const wl = 10 - inn2.wickets;
    res.byWickets = wl; res.byRuns = null;
    res.margin = `won by ${wl} wicket${wl === 1 ? '' : 's'}`;
    res.ballsLeft = 6 - inn2.legalBalls;
  } else {
    res.winner = firstBatId;
    res.byRuns = r1 - r2; res.byWickets = null;
    res.margin = `won by ${r1 - r2} run${r1 - r2 === 1 ? '' : 's'}`;
  }
  res.potm = C().pickPotm(inn1, inn2, firstBatId, secondBatId);
  res.summary = C().buildSummary(res);
  res.overs = 1;
  return res;
}
function championshipCaptureFinish(M){
  const ctx = window.__iplChampionship;
  if(!ctx || !season) return null;
  const res = build2DMatchResult(M);
  const short = id => teamShort(id);
  if(ctx.kind === 'league'){
    const fx = season.fixtures.find(f => f.id === ctx.id);
    if(!fx || fx.played) return null;
    fx.result = res; fx.played = true;
    C().applyResultToStats(season.stats, res);
    finishLeagueProgress();
  } else {
    const m = season.playoff ? season.playoff[ctx.key] : null;
    if(!m || m.played) return null;
    m.result = res; m.played = true; m.winner = res.winner;
    C().applyResultToStats(season.stats, res);
    applyPlayoffAdvance();
  }
  persist();
  // build the banner payload
  let kicker, title, sub;
  const home = ctx.homeId, away = ctx.awayId;
  const tName = id => teamName(id).toUpperCase();
  if(ctx.kind === 'playoff' && res.margin === 'Super Over'){
    kicker = ctx.label || 'Playoff'; title = `${tName(res.winner)} SURVIVE THE SUPER OVER`;
  } else if(res.winner === null){
    kicker = ctx.kind === 'league' ? `Round ${ctx.round}` : (ctx.label || 'Playoff');
    title = 'MATCH TIED';
  } else {
    kicker = ctx.kind === 'league' ? `Round ${ctx.round}` : (ctx.label || 'Playoff');
    title = `${tName(res.winner)} WIN!`;
  }
  const scoreline = `${short(res.firstBat)} ${res.inn1.runs}/${res.inn1.wickets} · ${short(res.secondBat)} ${res.inn2.runs}/${res.inn2.wickets}`;
  if(res.margin === 'Super Over'){
    const so = res.superOver;
    sub = `Scores level at ${res.inn1.runs} — decided by the Super Over${so && so.teamScores ? ` (${so.teamScores.home}-${so.teamScores.away})` : ''}. ${scoreline}.`;
  } else if(res.winner === null){
    sub = `${scoreline} — honours even. A point each in the table.`;
  } else if(res.margin && res.margin.startsWith('won')){
    sub = `${short(res.winner)} ${res.margin}. ${scoreline}.`;
  } else {
    sub = scoreline;
  }
  return {
    kicker, title, sub, winner: res.winner,
    buttonLabel: ctx.kind === 'playoff' ? (season.champion ? 'Lift the trophy →' : 'Back to the season hub →') : 'Back to the season hub →',
  };
}
function championshipReturnToHub(){
  window.__iplChampionship = null;
  window.__iplChampFrom2D = false;
  A().goto('season');
  renderHub();
}
window.IPLMatchChamp = {
  finish: championshipCaptureFinish,
  returnToHub: championshipReturnToHub,
};

/* ── MATCH-DAY XI bridge for js/matchxi.js ─────────── */
window.IPLLeagueChamp = {
  matchdayInfo(){
    const ctx = window.__iplChampionship;
    if(!ctx || !season) return null;
    const userId = season.userTeamId;
    const opponentId = ctx.homeId === userId ? ctx.awayId : ctx.homeId;
    const xi = season.userXi || { order: [], bowlOptions: [], captain: null, keeper: null };
    return {
      kind: ctx.kind, round: ctx.round, label: ctx.label,
      opponentId, userTeamId: userId, involvesUser: ctx.involvesUser !== false,
      userXi: {
        order: xi.order.slice(),
        bowlOptions: (xi.bowlOptions || []).slice(0, 5),
        captain: xi.captain, keeper: xi.keeper,
      },
    };
  },
  confirmMatchdayXI(draft){
    if(!season) return;
    const ctx = window.__iplChampionship;
    if(!ctx){ toast('That match is no longer pending.'); A().goto('season'); return; }
    // the confirmed squad becomes the season squad (rolls forward to the next match)
    season.userXi = {
      order: draft.order.slice(),
      bowlOptions: (draft.bowl || []).filter(id => draft.order.includes(id)).slice(0, 5),
      captain: draft.cap,
      keeper: draft.wk,
    };
    persist();
    setAppForMatch(ctx.homeId, ctx.awayId);
    toast('Match-Day XI locked in — good luck out there.');
    A().goto('toss');
  },
  cancelMatchdayXI(){
    window.__iplChampionship = null;
    window.__iplChampFrom2D = false;
    A().goto('season');
  },
};

window.IPLLeague = {

  init, createSeason, persist, wipeSeason,
  openTeamPicker, renderSeasonTeamGrid, renderSeasonTeamDetail,
  confirmLockOpenModal, confirmLockAndProceed, closeLockModal, backToTeams,
  gotoHub, gotoStats, renderHub, renderStats,
  playNextMatch, simOtherFixturesInRound, simRemainingLeague,
  playNextPlayoffMatch, simRemainingPlayoffs, resetSeason,
  onMatchSaved: null,
  get season(){ return season; },
};
document.addEventListener('DOMContentLoaded', init);

/* ══════════════════════════════════════════════════════
   SEASON TEAM PICKER  (#screen-season-team)
   ══════════════════════════════════════════════════════ */
function openTeamPicker(){
  renderSeasonTeamGrid();
  A().goto('seasonTeam');
}
function renderSeasonTeamGrid(selected){
  const grid = $('#leagueTeamGrid');
  if(!grid) return;
  grid.innerHTML = '';
  Object.values(A().DATA).forEach(team => {
    const card = document.createElement('button');
    card.className = 'team-card league-team-card' + (selected === team.id ? ' selected' : '');
    card.setAttribute('data-team', team.id);
    card.setAttribute('aria-pressed', selected === team.id ? 'true' : 'false');
    card.style.setProperty('--tc', team.c1);
    card.style.setProperty('--tc2', team.c2);
    card.innerHTML = `${crestOf(team.id)}<div class="team-name">${esc(team.short)}</div>
      <div class="team-meta"><span><b>${esc(team.name)}</b></span><span>Capt: <b>${esc(team.cap)}</b></span></div>`;
    card.addEventListener('click', () => { pendingTeamId = team.id; renderSeasonTeamGrid(team.id); renderSeasonTeamDetail(team.id); });
    grid.appendChild(card);
  });
  renderSeasonTeamDetail(selected || pendingTeamId);
}
function renderSeasonTeamDetail(tid){
  const panel = $('#leagueTeamDetail');
  if(!panel) return;
  const team = tid ? A().teamOf(tid) : null;
  if(!team){ panel.innerHTML = `<div class="ltd-empty">Pick a franchise on the left to inspect its complete 25-man squad, then lock it in for the season.</div>`; $('#leagueConfirmBtn').disabled = true; return; }
  $('#leagueConfirmBtn').disabled = false;
  const rows = team.players.map(p => `
    <div class="ltd-row">
      <span class="ltd-pos">${esc(p.id.split('-')[1] || '')}</span>
      <span class="ltd-name">${esc(p.name)}${p.overseas ? ' <em>OS</em>' : ''}</span>
      <span class="ltd-role role-badge role-${esc(p.role)}">${esc(p.role)}</span>
      <span class="ltd-rate">BAT <b>${p.batR}</b></span>
      <span class="ltd-rate">BOWL <b>${p.bowlR}</b></span>
      <span class="ltd-ovr">${p.ovr}</span>
    </div>`).join('');
  panel.innerHTML = `
    <div class="ltd-head">${crestOf(team.id)}
      <div><div class="ltd-title">${esc(team.name)}</div>
      <div class="ltd-sub">${esc(team.city)} · ${esc(team.home)} · Capt: <b>${esc(team.cap)}</b> · ${team.trophies} title${team.trophies === 1 ? '' : 's'}</div></div>
      <div class="ltd-lock-chip">YOUR TEAM</div>
    </div>
    <div class="ltd-list" role="table" aria-label="${esc(team.name)} squad">${rows}</div>
    <div class="ltd-foot">${team.players.length} players · ratings out of 99 · OS = overseas · max 4 overseas in the XI</div>`;
}
function confirmLockOpenModal(){
  if(!pendingTeamId) return;
  const team = A().teamOf(pendingTeamId);
  $('#lockTeamName').textContent = team.name;
  $('#lockTeamCrest').innerHTML = crestOf(team.id);
  const line = $('#lockOversLine');
  if(line) line.textContent = 'One-over format · six balls per innings';
  $('#lockTeamModal').classList.add('show');
  lockReturnFocus = document.activeElement;
  $('#lockBackBtn').focus();
}
function confirmLockAndProceed(){
  $('#lockTeamModal').classList.remove('show');
  // hand the team to the app state, then build the XI
  const st = A().state;
  st.team1Id = pendingTeamId;
  st.team2Id = null; st.xiTeam1 = []; st.capTeam1 = null; st.wkTeam1 = null; st.bowlTeam1 = []; st.xi1Confirmed = false;
  A().saveState();
  wipeSeason();                      // fresh season will be created after XI confirm
  A().goto('xi');
}
function backToTeams(){
  pendingTeamId = null;
  A().goto('mode');
}
function closeLockModal(){ $('#lockTeamModal').classList.remove('show'); if(lockReturnFocus) lockReturnFocus.focus(); }

/* ══════════════════════════════════════════════════════
   SEASON HUB  (#screen-season)
   ══════════════════════════════════════════════════════ */
function gotoHub(){
  if(!season) season = loadSeason();
  if(!season){ openTeamPicker(); return; }
  A().goto('season');
  setLeagueNavActive('hub');
  renderHub();
}
function gotoStats(){
  if(!season) season = loadSeason();
  A().goto('stats');
  setLeagueNavActive('stats');
  renderStats();
}
function renderHub(){
  if(!season) return;
  const me = seasonTeamStats(season.userTeamId);
  $('#seasonGameChip').textContent = `IPL 2026 · ${season.userTeamId} · ROUND ${nextRound() || 18}/18${leagueComplete() ? ' · COMPLETE' : ''}`;
  // phase switch
  const phase = season.phase;
  ['leaguePhase', 'playoffsPhase', 'donePhase'].forEach(id => { const e = $('#'+id); if(e) e.classList.toggle('active', (id === 'leaguePhase' && phase === 'league') || (id === 'playoffsPhase' && phase === 'playoffs') || (id === 'donePhase' && phase === 'done')); });
  renderYourCard(me);
  renderTable();
  renderCapsMini();
  renderRoundPills();
  renderRoundFixtures(currentRoundView);
  if(phase === 'playoffs') renderPlayoffBracket();
  if(phase === 'done') renderChampionPanel();
}
function renderYourCard(me){
  const t = A().teamOf(season.userTeamId);
  $('#yourTeamCrest').innerHTML = crestOf(t.id);
  $('#yourTeamName').textContent = t.name;
  $('#yourTeamCity').textContent = `${t.city} · ${t.home}`;
  $('#seasonRecord').innerHTML = `
    <div class="sr-cell"><b>${me.p}</b><span>P</span></div>
    <div class="sr-cell"><b>${me.w}</b><span>W</span></div>
    <div class="sr-cell"><b>${me.l}</b><span>L</span></div>
    <div class="sr-cell"><b>${me.t + me.nr}</b><span>T/NR</span></div>
    <div class="sr-cell gold"><b>${me.pts}</b><span>PTS</span></div>
    <div class="sr-cell ${me.nrr >= 0 ? 'pos' : 'neg'}"><b>${C().formatNRR(me.nrr)}</b><span>NRR</span></div>`;
  $('#yourPosition').textContent = me.p === 0 ? 'POSITION —' : `POSITION ${me.pos}${me.pos <= 5 ? ' · PLAYOFF SPOT' : ''}`;
  $('#yourPosition').classList.toggle('inzone', me.pos <= 5 && me.p > 0);
  // next fixture
  const fx = userNextFixture();
  const box = $('#nextFixtureBox');
  if(fx){
    const opp = A().teamOf(fx.home === season.userTeamId ? fx.away : fx.home);
    const isHome = fx.home === season.userTeamId;
    $('#nextFixtureInner').innerHTML = `
      <div class="nf-kicker">NEXT · ROUND ${fx.round} · ${isHome ? 'HOME' : 'AWAY'}</div>
      <div class="nf-teams">${crestOf(season.userTeamId, 'nf-crest')}<div class="nf-vs">VS</div>${crestOf(opp.id, 'nf-crest')}</div>
      <div class="nf-names"><b>${esc(teamShort(season.userTeamId))}</b><span>vs</span><b>${esc(opp.short)}</b></div>
      <div class="nf-venue">${esc(isHome ? A().teamOf(season.userTeamId).home : opp.home)}</div>`;
    $('#playNextBtn').disabled = false;
    $('#playNextBtn').innerHTML = `Play Match · R${fx.round} <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
  } else {
    $('#nextFixtureInner').innerHTML = `<div class="nf-kicker">LEAGUE STAGE COMPLETE</div>
      <div class="nf-venue">${leagueComplete() ? 'All 90 matches played — playoffs underway or champions crowned.' : 'Waiting for remaining fixtures to be simulated.'}</div>`;
    $('#playNextBtn').disabled = true;
    $('#playNextBtn').innerHTML = 'League Stage Complete';
  }
}
function renderTable(){
  const rows = computeRows();
  const tbody = $('#pointsTableBody');
  tbody.innerHTML = rows.map((r, i) => `
    <tr class="${i < 5 ? 'in-playoff-zone' : ''} ${r.id === season.userTeamId ? 'your-row' : ''}">
      <td class="pt-rank">${i + 1}</td>
      <td class="pt-team">${crestOf(r.id, 'pt-crest')}<span class="pt-short">${esc(teamShort(r.id))}</span></td>
      <td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td>${r.t}</td><td>${r.nr}</td>
      <td class="pt-pts">${r.pts}</td><td class="pt-nrr">${C().formatNRR(r.nrr)}</td>
    </tr>`).join('');
}
function renderCapsMini(){
  const bat = Object.entries(season.stats.bat).sort((a, b) => b[1].runs - a[1].runs).slice(0, 5);
  const bowl = Object.entries(season.stats.bowl).sort((a, b) => b[1].wkts - a[1].wkts || a[1].runs - b[1].runs).slice(0, 5);
  const nm = (pid) => { for(const t of Object.values(A().DATA)){ const p = t.players.find(p => p.id === pid); if(p) return p.name; } return pid; };
  $('#orangeMini').innerHTML = bat.map(([pid, b], i) => `<div class="cap-row ${i === 0 ? 'leader' : ''}"><span class="cap-pos">${i + 1}</span><span class="cap-name">${esc(nm(pid))}<i>${esc(b.team)}</i></span><b>${b.runs}</b></div>`).join('') || '<div class="cap-empty">No innings yet.</div>';
  $('#purpleMini').innerHTML = bowl.map(([pid, b], i) => `<div class="cap-row ${i === 0 ? 'leader' : ''}"><span class="cap-pos">${i + 1}</span><span class="cap-name">${esc(nm(pid))}<i>${esc(b.team)}</i></span><b>${b.wkts}</b></div>`).join('') || '<div class="cap-empty">No overs yet.</div>';
}

const ROUND_COUNT = 18;
function renderRoundPills(){
  const wrap = $('#roundPills');
  if(!wrap) return;
  const cur = nextRound() || ROUND_COUNT;
  let html = '';
  for(let r = 1; r <= ROUND_COUNT; r++){
    const played = season.fixtures.filter(f => f.round === r && f.played).length;
    html += `<button class="round-pill ${r === currentRoundView ? 'active' : ''} ${played === 5 ? 'done' : (played > 0 ? 'partial' : '')}" data-round="${r}">R${r}</button>`;
  }
  wrap.innerHTML = html;
  $$('.round-pill', wrap).forEach(b => b.addEventListener('click', () => { currentRoundView = +b.getAttribute('data-round'); renderRoundPills(); renderRoundFixtures(currentRoundView); }));
}
function renderRoundFixtures(round){
  const box = $('#roundFixtures');
  if(!box) return;
  const list = season.fixtures.filter(f => f.round === round).sort((a, b) => a.game - b.game);
  const label = $('#roundFixturesTitle');
  if(label) label.textContent = `ROUND ${round}${round <= 9 ? ' · FIRST HALF' : ' · SECOND HALF'}`;
  box.innerHTML = list.map(f => {
    const home = A().teamOf(f.home), away = A().teamOf(f.away);
    const your = f.userMatch;
    if(!f.played){
      return `<div class="fx-row upcoming ${your ? 'your' : ''}">
        <span class="fx-venue">${esc(home.city.toUpperCase())}</span>
        <span class="fx-team right">${esc(home.short)}${crestOf(f.home, 'fx-crest')}</span>
        <span class="fx-mid">vs</span>
        <span class="fx-team">${crestOf(f.away, 'fx-crest')}${esc(away.short)}</span>
        ${your ? '<span class="fx-yourtag">YOURS</span>' : '<span class="fx-resttag">AI</span>'}
      </div>`;
    }
    const r = f.result;
    const score = r.washout ? 'NR' : `${r.inn1.runs}/${r.inn1.wickets} · ${r.inn2.runs}/${r.inn2.wickets}`;
    const note = r.washout ? 'No result' : (r.tie ? 'Tied' : `${teamShort(r.winner)} won`);
    return `<button class="fx-row result ${your ? 'your' : ''}" data-fx="${f.id}" title="View scorecard">
      <span class="fx-venue">${esc(home.city.toUpperCase())}</span>
      <span class="fx-team right ${r.winner === f.home ? 'winner' : ''}">${esc(home.short)}${crestOf(f.home, 'fx-crest')}</span>
      <span class="fx-mid fx-score">${esc(score)}</span>
      <span class="fx-team ${r.winner === f.away ? 'winner' : ''}">${crestOf(f.away, 'fx-crest')}${esc(away.short)}</span>
      <span class="fx-resttag ${r.washout ? '' : 'done'}">${esc(note)}</span>
    </button>`;
  }).join('');
  $$('.fx-row.result', box).forEach(b => b.addEventListener('click', () => {
    const fx = season.fixtures.find(f => f.id === b.getAttribute('data-fx'));
    if(fx) showResultModal(fx, true);
  }));
}

/* ── simulate non-user fixtures for the earliest unfinished round ── */
function simRoundAi(round){
  const pending = season.fixtures.filter(f => f.round === round && !f.played && !f.userMatch);
  pending.forEach(fx => C().simFixture(season, fx, true));
  return pending;
}
/* App-state setup for a Championship match (reads season.userXi for whichever side is the user's) */
function setAppForMatch(homeId, awayId){
  const st = A().state;
  const homeXi = xiShapeFor(homeId), awayXi = xiShapeFor(awayId);
  st.team1Id = homeId; st.team2Id = awayId;
  st.xiTeam1 = homeXi.order.slice(); st.capTeam1 = homeXi.captain; st.wkTeam1 = homeXi.keeper; st.bowlTeam1 = homeXi.bowlOptions.slice(0, 5); st.xi1Confirmed = true;
  st.xiTeam2 = awayXi.order.slice(); st.capTeam2 = awayXi.captain; st.wkTeam2 = awayXi.keeper; st.bowlTeam2 = awayXi.bowlOptions.slice(0, 5); st.xi2Confirmed = true;
  st.teamsLocked = true;
  st.toss = { spun: false, winnerId: null, choice: null };
  A().saveState();
}
/* Launch a Championship match in the 2D broadcast. User matches route through the
   match-day XI screen first; AI-vs-AI playoffs go straight to the toss. */
function launchChampionshipMatch(ctx){
  if(!season) return;
  const homeFx = ctx.kind === 'league' ? season.fixtures.find(f => f.id === ctx.id) : null;
  const po = ctx.kind === 'playoff' ? season.playoff[ctx.key] : null;
  if(ctx.kind === 'league' && (!homeFx || homeFx.played)) return;
  if(ctx.kind === 'playoff' && (!po || po.played || !po.home || !po.away)) return;
  const homeId = homeFx ? homeFx.home : po.home;
  const awayId = homeFx ? homeFx.away : po.away;
  const involvesUser = homeId === season.userTeamId || awayId === season.userTeamId;
  window.__iplChampionship = Object.assign(ctx, {
    homeId, awayId,
    round: homeFx ? homeFx.round : null,
    label: po ? po.label : null,
    involvesUser,
  });
  window.__iplChampFrom2D = true;
  if(involvesUser){
    toast(`${homeFx ? `Round ${homeFx.round}` : (po.label || 'Knockout')} · ${teamShort(homeId)} vs ${teamShort(awayId)} — pick your match-day XI.`);
    A().goto('matchxi');
    return;
  }
  setAppForMatch(homeId, awayId);
  toast(`${ctx.label || 'Knockout'} — sit back and watch the broadcast.`);
  A().goto('toss');
}
function playNextMatch(){
  if(!season) return;
  const target = userNextFixture();
  // keep rounds in lockstep: first clear pending AI fixtures in earlier/same rounds
  const roundsNeeded = new Set();
  const limit = target ? target.round : (nextRound() || ROUND_COUNT);
  season.fixtures.forEach(f => { if(!f.played && !f.userMatch && f.round <= limit) roundsNeeded.add(f.round); });
  roundsNeeded.forEach(r => simRoundAi(r));
  persist();
  if(!target){ finishLeagueProgress(); persist(); renderHub(); toast('All league matches are complete.'); return; }
  launchChampionshipMatch({ kind: 'league', id: target.id });
}
function finishLeagueProgress(){
  if(leagueComplete() && season.phase === 'league'){
    const table = computeRows();
    season.playoff = C().seedPlayoffs(table);
    C().playoffReady(season.playoff);
    season.phase = 'playoffs';
  }
}
function simOtherFixturesInRound(){
  if(!season) return;
  const round = nextRound();
  if(!round){ toast('No rounds remaining.'); return; }
  const did = simRoundAi(round);
  persist();
  renderHub();
  toast(did.length ? `${did.length} AI fixture${did.length > 1 ? 's' : ''} in Round ${round} simulated.` : 'Nothing left to sim in Round ' + round + '.');
}
function simRemainingLeague(){
  if(!season) return;
  $('#simAllModal').classList.add('show');
}
function confirmSimRemainingLeague(){
  $('#simAllModal').classList.remove('show');
  // sim everything (including user's remaining matches, user-approved)
  const remaining = season.fixtures.filter(f => !f.played);
  remaining.forEach(fx => C().simFixture(season, fx, true));
  finishLeagueProgress();
  persist();
  renderHub();
  toast(`${remaining.length} remaining league fixtures simulated.`);
}
function closeSimAllModal(){ $('#simAllModal').classList.remove('show'); }
function toast(msg){ const t = $('#toast'); if(t){ t.textContent = msg; t.classList.add('show'); clearTimeout(window.__iplSeasonToastT); window.__iplSeasonToastT = setTimeout(() => t.classList.remove('show'), 3400); } }

/* ── match result modal ────────────────────────────────── */
function fowText(inn){
  if(!inn || !inn.fow || !inn.fow.length) return inn ? 'No wickets down.' : '—';
  return inn.fow.map(f => `${f.n}-${f.runs} (${f.player})`).join(' · ');
}
function scorecardHTML(inn, batTeamShort){
  if(!inn) return '<div class="mc-none">Innings not played.</div>';
  const btid = inn.teamId;
  const batRows = Object.values(inn.batting)
    .filter(b => b.balls > 0 || b.out)
    .map(b => {
      const p = A().playerOf(btid, b.id);
      const sr = b.balls ? Math.round(b.runs / b.balls * 100) : 0;
      return `<tr class="${b.out ? 'out' : ''}"><td>${b.out ? esc(p.name) : esc(p.name) + ' *'}</td><td class="mc-how">${esc(b.how)}</td><td>${b.runs}</td><td>${b.balls}</td><td>${b['4s']}</td><td>${b['6s']}</td><td>${sr}</td></tr>`;
    }).join('');
  // bowler names: scan every squad once
  const nameOf = (() => {
    const map = {};
    Object.values(A().DATA).forEach(t => t.players.forEach(p => { map[p.id] = p.name; }));
    return id => map[id] || id;
  })();
  const bowlRows = Object.values(inn.bowling).filter(bw => bw.balls > 0).map(bw => {
    const econ = bw.balls ? (bw.runs / (bw.balls / 6)).toFixed(2) : '0.00';
    return `<tr><td>${esc(nameOf(bw.id))}</td><td>${C().fmtOvers(bw.balls)}</td><td>${bw.maidens}</td><td>${bw.runs}</td><td>${bw.wickets}</td><td>${econ}</td></tr>`;
  }).join('');
  return `
    <div class="mc-team-line"><b>${esc(teamShort(btid))}</b> — ${inn.runs}/${inn.wickets} <span>(${C().fmtOvers(inn.legalBalls)} ov · extras ${inn.extras})</span></div>
    <table class="mc-table"><thead><tr><th>Batter</th><th>Dismissal</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>${batRows}</tbody></table>
    <table class="mc-table mc-bowl"><thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead><tbody>${bowlRows}</tbody></table>
    <div class="mc-fow"><b>FOW:</b> ${esc(fowText(inn))}</div>`;
}
function showResultModal(fx, readOnly){
  const r = fx.result;
  if(!r) return;
  const modal = $('#matchResultModal');
  const homeT = A().teamOf(fx.home), awayT = A().teamOf(fx.away);
  const title = $('#matchResultTitle'), sub = $('#matchResultSub');
  if(r.washout){
    title.textContent = 'MATCH ABANDONED';
    sub.textContent = 'Rain stopped play — one point each. NRR unaffected.';
  } else if(r.tie){
    title.textContent = 'MATCH TIED';
    sub.textContent = r.summary.text;
  } else {
    title.textContent = `${teamShort(r.winner)} WIN!`;
    sub.textContent = r.summary.text + (r.superOver ? ' · decided in a Super Over' : '');
  }
  $('#matchResultTeams').innerHTML = `
    <div class="mct-side ${r.winner === fx.home ? 'won' : ''}">${crestOf(fx.home, 'mct-crest')}<span>${esc(homeT.short)}</span></div>
    <div class="mct-mid">${esc(r.washout ? 'NR' : (r.inn1.runs + ' - ' + r.inn2.runs))}</div>
    <div class="mct-side right ${r.winner === fx.away ? 'won' : ''}">${crestOf(fx.away, 'mct-crest')}<span>${esc(awayT.short)}</span></div>`;
  const sc1 = $('#scorecardInnings1'), sc2 = $('#scorecardInnings2');
  if(r.washout){ sc1.innerHTML = '<div class="mc-none">Match abandoned.</div>'; sc2.innerHTML = ''; }
  else {
    sc1.innerHTML = scorecardHTML(r.inn1, teamShort(r.inn1.teamId));
    sc2.innerHTML = scorecardHTML(r.inn2, teamShort(r.inn2.teamId));
  }
  const potmBox = $('#matchPotm');
  if(r.potm){
    let p = null;
    for(const t of Object.values(A().DATA)){ p = t.players.find(x => x.id === r.potm.id); if(p){ potmBox.innerHTML = `<span class="potm-chip">PLAYER OF THE MATCH</span> <b>${esc(p.name)}</b> · ${r.potm.kind === 'bat' ? `${r.potm.runs} off ${r.potm.balls}b` : `${r.potm.wickets}/${r.potm.runs} (${r.potm.balls}b)`} · ${esc(r.potm.teamId || p.id.split('-')[0])}`; break; } }
  } else potmBox.innerHTML = '';
  $('#matchResultContinueBtn').textContent = readOnly ? 'CLOSE' : 'CONTINUE →';
  modal.classList.add('show');
  modal.dataset.readOnly = readOnly ? '1' : '';
}
function closeMatchResult(){
  const modal = $('#matchResultModal');
  modal.classList.remove('show');
  renderHub();
}

/* ══════════════════════════════════════════════════════
   PLAYOFFS  (#screen-season · playoffsPhase)
   Q1: #2 v #3 → winner to Q2 · Q2: #1 v Q1W → FINAL
   ELIMINATOR: #4 v #5 → FINAL · FINAL → champion
   ══════════════════════════════════════════════════════ */
const PO_ORDER = ['q1', 'q2', 'elim', 'final'];
function playoffFixtureOf(key){
  const po = season.playoff;
  const pf = po[key];
  if(!pf || !pf.home || !pf.away) return null;
  if(pf.played) return pf;
  return pf;
}
function renderPlayoffBracket(){
  const po = season.playoff;
  if(!po){ $('#playoffBracket').innerHTML = '<div class="bracket-empty">Playoff bracket will be seeded when the league completes.</div>'; return; }
  const card = (key, label, roundNote) => {
    const m = po[key];
    const teamLine = (id, side) => {
      if(!id) return `<div class="bk-team empty"><span>TBD</span></div>`;
      const won = m.winner === id;
      return `<div class="bk-team ${won ? 'winner' : ''} ${m.winner && m.winner !== id ? 'loser' : ''}">${crestOf(id, 'bk-crest')}<span>${esc(teamShort(id))}</span>${won ? '<i class="bk-tick">✓</i>' : ''}</div>`;
    };
    const score = m.played && m.result && !m.result.washout
      ? `${m.result.inn1.runs}/${m.result.inn1.wickets} – ${m.result.inn2.runs}/${m.result.inn2.wickets}${m.result.superOver ? ' · SO' : ''}`
      : (m.played && m.result && m.result.washout ? 'NR (1pt each, coin decides?)' : 'vs');
    return `<div class="bracket-card ${key}">
      <div class="bk-label">${esc(label)} <span>${esc(roundNote)}</span></div>
      ${teamLine(m.home)}${teamLine(m.away)}
      <div class="bk-score">${esc(score)}</div>
      ${m.played ? `<button class="bk-view" data-po="${key}">View result</button>` : ''}
    </div>`;
  };
  $('#playoffBracket').innerHTML = `
    <div class="bracket-grid">
      ${card('q1', 'QUALIFIER 1', 'R2 v R3')}
      ${card('q2', 'QUALIFIER 2', 'R1 v Q1 Winner')}
      ${card('elim', 'ELIMINATOR', 'R4 v R5')}
      ${card('final', 'IPL FINAL', 'Q2 Winner v Eliminator Winner')}
    </div>
    <div class="bracket-actions">
      <button class="btn btn-gold" id="playPlayoffBtn" ${playoffAllDone() ? 'disabled' : ''}>${playoffAllDone() ? 'Playoffs complete' : playoffButtonLabel()}</button>
      <button class="btn btn-ghost" id="simPlayoffsBtn">Sim remaining playoff matches</button>
    </div>`;
  $$('.bk-view', $('#playoffBracket')).forEach(b => b.addEventListener('click', () => showPlayoffResult(b.getAttribute('data-po'))));
  $('#playPlayoffBtn')?.addEventListener('click', playNextPlayoffMatch);
  $('#simPlayoffsBtn')?.addEventListener('click', simRemainingPlayoffs);
}
function playoffAllDone(){ return season.playoff && season.playoff.final && season.playoff.final.played; }
function playoffButtonLabel(){
  const next = C().playoffNext(season.playoff);
  if(!next || !next.home || !next.away) return 'Playoffs pending';
  const involvesUser = next.home === season.userTeamId || next.away === season.userTeamId;
  return involvesUser ? `Play ${next.label}` : `Watch ${next.label} (AI)`;
}
function playoffFixtureState(m){ return m.played; }
function simPlayoffGame(key){
  const po = season.playoff;
  const m = po[key];
  if(!m || m.played || !m.home || !m.away) return null;
  const homeXi = m.home === season.userTeamId ? season.userXi : C().aiXiCached(season, m.home);
  const awayXi = m.away === season.userTeamId ? season.userXi : C().aiXiCached(season, m.away);
  const res = C().simMatch(m.home, m.away, season.cfg, { homeXi, awayXi, isPlayoff: true });
  m.result = res; m.played = true; m.winner = res.winner;
  C().applyResultToStats(season.stats, res);
  applyPlayoffAdvance();
  persist();
  return res;
}
function applyPlayoffAdvance(){
  const po = season.playoff;
  C().playoffReady(po);
  if(po.q2.played){ po.final.home = po.q2.winner; }
  if(po.elim.played){ po.final.away = po.elim.winner; }
  if(po.final.played && !season.champion){
    season.champion = po.final.winner;
    season.runnerUp = po.final.winner === po.final.home ? po.final.away : po.final.home;
    season.phase = 'done';
    recordChampionsHistory();
    if(!season.celebrated){
      season.celebrated = true;
      persist();
      if(window.IPLSFX && window.IPLSFX.reward) window.IPLSFX.reward();
      if(!window.__iplChampFrom2D) setTimeout(() => { if(typeof burstChampionConfetti === 'function') burstChampionConfetti(); }, 350);
    }
  }
}
const PLAYOFF_KEY = { Q1: 'q1', Q2: 'q2', EL: 'elim', F: 'final' };
function playNextPlayoffMatch(){
  const po = season.playoff;
  const next = C().playoffNext(po);
  if(!next || !next.home || !next.away){ toast('Playoffs complete — champions decided.'); return; }
  launchChampionshipMatch({ kind: 'playoff', key: PLAYOFF_KEY[next.id] || next.id.toLowerCase(), label: next.label });
}
function simRemainingPlayoffs(){
  const po = season.playoff;
  if(!po) return;
  let guard = 8;
  while(guard-- > 0){
    const next = C().playoffNext(po);
    if(!next || !next.home || !next.away) break;
    simPlayoffGame(PLAYOFF_KEY[next.id] || next.id.toLowerCase());
  }
  renderHub();
  toast(season.champion ? `IPL 2026 champions: ${teamShort(season.champion)}!` : 'Playoff matches simulated.');
}
function showPlayoffResult(key){
  const m = season.playoff[key];
  if(!m || !m.result) return;
  const fakeFx = { id: m.id, round: 'PO', home: m.home, away: m.away, played: true, result: m.result, userMatch: m.home === season.userTeamId || m.away === season.userTeamId };
  showResultModal(fakeFx, true);
}
function recordChampionsHistory(){
  const bat = Object.entries(season.stats.bat).sort((a, b) => b[1].runs - a[1].runs)[0];
  const bowl = Object.entries(season.stats.bowl).sort((a, b) => b[1].wkts - a[1].wkts || a[1].runs - b[1].runs)[0];
  saveChampionHistory({
    year: 2026,
    champion: season.champion,
    runnerUp: season.runnerUp,
    overs: season.cfg.overs,
    orange: bat ? { id: bat[0], runs: bat[1].runs, team: bat[1].team } : null,
    purple: bowl ? { id: bowl[0], wkts: bowl[1].wkts, team: bowl[1].team } : null,
    final: season.playoff?.final?.result?.summary?.text || '',
    at: Date.now(),
  });
}
/* ══════════════════════════════════════════════════════
   CHAMPION PANEL  (#screen-season · donePhase)
   ══════════════════════════════════════════════════════ */
function renderChampionPanel(){
  const champ = A().teamOf(season.champion);
  const capName = champ.cap;
  $('#champCrest').innerHTML = crestOf(champ.id);
  $('#champTeamName').textContent = champ.name;
  $('#champCaptainLine').textContent = `Captain: ${capName}`;
  $('#champSub').textContent = `IPL 2026 CHAMPIONS · beat ${season.runnerUp} in the final`;
  // awards
  const batSorted = Object.entries(season.stats.bat).sort((a, b) => b[1].runs - a[1].runs)[0];
  const bowlSorted = Object.entries(season.stats.bowl).sort((a, b) => b[1].wkts - a[1].wkts || a[1].runs - b[1].runs)[0];
  const pot = computePot();
  const nm = pid => { for(const t of Object.values(A().DATA)){ const p = t.players.find(p => p.id === pid); if(p) return p; } return null; };
  const orangeP = batSorted ? nm(batSorted[0]) : null;
  const purpleP = bowlSorted ? nm(bowlSorted[0]) : null;
  const potP = pot ? nm(pot.id) : null;
  $('#orangeCapWinner').innerHTML = batSorted
    ? `<span class="award-label">ORANGE CAP</span><b>${esc(orangeP.name)}</b><span>${esc(batSorted[1].team)} · ${batSorted[1].runs} runs · SR ${batSorted[1].balls ? Math.round(batSorted[1].runs / batSorted[1].balls * 100) : 0} · ${batSorted[1]['50s'] + batSorted[1]['100s']} fifties+</span>`
    : '';
  $('#purpleCapWinner').innerHTML = bowlSorted
    ? `<span class="award-label purple">PURPLE CAP</span><b>${esc(purpleP.name)}</b><span>${esc(bowlSorted[1].team)} · ${bowlSorted[1].wkts} wickets · best ${bowlSorted[1].bestW}/${bowlSorted[1].bestR}</span>`
    : '';
  $('#potWinner').innerHTML = pot
    ? `<span class="award-label gold">PLAYER OF THE TOURNAMENT</span><b>${esc(potP.name)}</b><span>${esc(pot.team)} · impact ${pot.impact} <i>(${pot.runs} runs + ${pot.wkts} wkts + ${pot.field} fielding pts)</i></span>`
    : '';
  const hist = championsHistory();
  $('#seasonHistory').innerHTML = hist.length
    ? '<div class="hist-k">IPL CHAMPIONS HISTORY</div>' + hist.map(h => `<div class="hist-row"><b>${esc(h.year)}</b><span>${esc(h.champion)}</span><i>Orange: ${h.orange ? esc(nmNameOnly(h.orange.id)) + ' (' + h.orange.runs + ')' : '—'} · Purple: ${h.purple ? esc(nmNameOnly(h.purple.id)) + ' (' + h.purple.wkts + ')' : '—'}</i></div>`).join('')
    : '';
}
function nmNameOnly(pid){
  for(const t of Object.values(A().DATA)){ const p = t.players.find(p => p.id === pid); if(p) return p.name; }
  return pid;
}
function computePot(){
  let best = null, bestImpact = -1;
  const ids = new Set([...Object.keys(season.stats.bat), ...Object.keys(season.stats.bowl), ...Object.keys(season.stats.field)]);
  ids.forEach(pid => {
    const b = season.stats.bat[pid], bw = season.stats.bowl[pid], f = season.stats.field[pid];
    const team = (b && b.team) || (bw && bw.team) || (f && f.team);
    const runs = b ? b.runs : 0, wkts = bw ? bw.wkts : 0, field = f ? (f.ct + f.st + f.ro) : 0;
    const impact = Math.round(runs + wkts * 25 + field * 3 + (b ? b['50s'] * 10 + b['100s'] * 25 : 0) + (bw ? bw.haul4 * 8 + bw.haul5 * 15 : 0));
    if(impact > bestImpact){ bestImpact = impact; best = { id: pid, team, runs, wkts, field, impact }; }
  });
  return best;
}
function burstChampionConfetti(){
  const canvas = $('#confetti');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const colors = ['#f5c518', '#ffde59', '#c4b5fd', '#38bdf8', '#ffffff', '#fb7185', '#34d399'];
  const parts = [];
  for(let i = 0; i < 160; i++){
    parts.push({ x: Math.random() * canvas.width, y: -40 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 8, h: 8 + Math.random() * 12, vy: 1.6 + Math.random() * 2.4, vx: (Math.random() - 0.5) * 2.2,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.16,
      color: colors[Math.floor(Math.random() * colors.length)] });
  }
  const t0 = performance.now();
  function tick(now){
    const el = (now - t0) / 1000;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(el > 7){ ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    parts.forEach(p => {
      p.y += p.vy; p.x += p.vx + Math.sin((p.y + p.rot * 40) * 0.02); p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - el / 7);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function resetSeason(){
  wipeSeason();
  A().toast('Season wiped — pick a franchise to start IPL 2026 again.');
  A().goto('mode');
}

/* ══════════════════════════════════════════════════════
   STATS & RECORDS  (#screen-stats)
   ══════════════════════════════════════════════════════ */
function nameOfPlayer(pid){
  for(const t of Object.values(A().DATA)){ const p = t.players.find(p => p.id === pid); if(p) return p; }
  return null;
}
function roleOfPlayer(pid){
  const p = nameOfPlayer(pid);
  return p ? p.role : null;
}
function renderStats(){
  if(!season){ A().goto('season'); return; }
  $('#statsProgressChip').textContent = `IPL 2026 · ROUND ${nextRound() || 18}/18${leagueComplete() ? ' · LEAGUE COMPLETE' : ''}`;
  renderOrangeCap();
  renderPurpleCap();
  renderMvpRace();
  renderRecords();
  renderTeamStats();
}
function renderOrangeCap(){
  const rows = Object.entries(season.stats.bat)
    .map(([pid, b]) => ({ pid, ...b }))
    .filter(r => r.inns > 0)
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 10);
  $('#orangeCapBody').innerHTML = rows.map((r, i) => {
    const p = nameOfPlayer(r.pid);
    const sr = r.balls ? Math.round(r.runs / r.balls * 100) : 0;
    const avg = r.outs ? (r.runs / r.outs).toFixed(1) : String(r.runs);
    return `<tr class="${i === 0 ? 'leader' : ''}"><td class="sc-rank">${i + 1}</td>
      <td class="sc-player"><b>${esc(p ? p.name : r.pid)}</b><i>${esc(r.team)}</i></td>
      <td>${r.inns}</td><td class="sc-runs">${r.runs}</td><td>${r.hs}</td><td>${avg}</td><td>${sr}</td>
      <td>${r['4s']}</td><td>${r['6s']}</td><td>${r['50s']}</td><td>${r['100s']}</td></tr>`;
  }).join('') || '<tr><td colspan="11" class="sc-empty">No innings recorded yet.</td></tr>';
  $('#orangeCapName').textContent = rows.length ? (nameOfPlayer(rows[0].pid) || {}).name || '—' : '—';
}
function renderPurpleCap(){
  const rows = Object.entries(season.stats.bowl)
    .map(([pid, b]) => ({ pid, ...b }))
    .filter(r => r.balls > 0)
    .sort((a, b) => b.wkts - a.wkts || a.runs - b.runs || a.balls - b.balls)
    .slice(0, 10);
  $('#purpleCapBody').innerHTML = rows.map((r, i) => {
    const p = nameOfPlayer(r.pid);
    const econ = r.balls ? (r.runs / (r.balls / 6)).toFixed(2) : '0.00';
    const avg = r.wkts ? (r.runs / r.wkts).toFixed(1) : '—';
    return `<tr class="${i === 0 ? 'leader' : ''}"><td class="sc-rank">${i + 1}</td>
      <td class="sc-player"><b>${esc(p ? p.name : r.pid)}</b><i>${esc(r.team)}</i></td>
      <td>${r.wkts}</td><td>${C().fmtOvers(r.balls)}</td><td>${econ}</td><td>${avg}</td>
      <td>${r.bestW}/${r.bestR}</td><td>${r.haul3}</td><td>${r.haul4}</td><td>${r.haul5}</td><td>${r.maidens}</td></tr>`;
  }).join('') || '<tr><td colspan="11" class="sc-empty">No overs recorded yet.</td></tr>';
  $('#purpleCapName').textContent = rows.length ? (nameOfPlayer(rows[0].pid) || {}).name || '—' : '—';
}
function renderMvpRace(){
  const ids = new Set([...Object.keys(season.stats.bat), ...Object.keys(season.stats.bowl), ...Object.keys(season.stats.field)]);
  const list = [...ids].map(pid => {
    const b = season.stats.bat[pid], bw = season.stats.bowl[pid], f = season.stats.field[pid];
    const team = (b && b.team) || (bw && bw.team) || (f && f.team);
    const runs = b ? b.runs : 0, wkts = bw ? bw.wkts : 0, field = f ? (f.ct + f.st + f.ro) : 0;
    const impact = Math.round(runs + wkts * 25 + field * 3 + (b ? b['50s'] * 10 + b['100s'] * 25 : 0) + (bw ? bw.haul4 * 8 + bw.haul5 * 15 : 0));
    return { pid, team, runs, wkts, field, impact };
  }).filter(r => r.impact > 0).sort((a, b) => b.impact - a.impact).slice(0, 5);
  $('#mvpRaceBody').innerHTML = list.map((r, i) => {
    const p = nameOfPlayer(r.pid);
    return `<div class="mvp-row ${i === 0 ? 'leader' : ''}"><span class="mvp-pos">${i + 1}</span>
      <span class="mvp-name"><b>${esc(p ? p.name : r.pid)}</b><i>${esc(r.team)}</i></span>
      <span class="mvp-impact">${r.impact}<em>IMPACT</em></span></div>`;
  }).join('') || '<div class="sc-empty">No performances yet.</div>';
}
function renderRecords(){
  const bat = Object.entries(season.stats.bat).map(([pid, b]) => ({ pid, ...b }));
  const bowl = Object.entries(season.stats.bowl).map(([pid, b]) => ({ pid, ...b }));
  const field = Object.entries(season.stats.field).map(([pid, b]) => ({ pid, ...b, role: roleOfPlayer(pid) }));
  const team = Object.entries(season.stats.team).map(([id, s]) => ({ id, ...s }));
  const nm = r => { const p = nameOfPlayer(r.pid); return p ? `${p.name} · ${r.team}` : r.pid; };
  const tName = t => esc(teamShort(t.id));
  const mostSixes = bat.slice().sort((a, b) => b['6s'] - a['6s'])[0];
  const mostFours  = bat.slice().sort((a, b) => b['4s'] - a['4s'])[0];
  const topScore   = bat.slice().sort((a, b) => b.hs - a.hs)[0];
  const bestSR     = bat.filter(r => r.balls >= 24).sort((a, b) => (b.runs / b.balls) - (a.runs / a.balls))[0];
  const bestEcon   = bowl.filter(r => r.balls >= 24).sort((a, b) => (a.runs / a.balls) - (b.runs / b.balls))[0];
  const bestFigs   = bowl.slice().sort((a, b) => b.bestW - a.bestW || a.bestR - b.bestR)[0];
  const mostCt     = field.slice().sort((a, b) => b.ct - a.ct)[0];
  const mostRo     = field.slice().sort((a, b) => b.ro - a.ro)[0];
  const keeperDis  = field.filter(r => r.role === 'WK').map(r => ({ ...r, dis: r.st + r.ct })).sort((a, b) => b.dis - a.dis)[0];
  const mostWins   = team.slice().sort((a, b) => b.w - a.w)[0];
  const hiTotal    = team.slice().filter(t => t.hiTotal > 0).sort((a, b) => b.hiTotal - a.hiTotal)[0];
  const loTotal    = team.slice().filter(t => t.loTotal > 0).sort((a, b) => a.loTotal - b.loTotal)[0];
  const bestWinRuns = team.filter(t => t.bigWinRuns).sort((a, b) => b.bigWinRuns.by - a.bigWinRuns.by)[0];
  const bestWinWkts = team.filter(t => t.bigWinWkts).sort((a, b) => b.bigWinWkts.by - a.bigWinWkts.by)[0];
  const tile = (label, value, sub, cls) => `<div class="rec-tile ${cls || ''}"><span class="rec-label">${esc(label)}</span><b>${value}</b><span class="rec-sub">${sub ? esc(sub) : ''}</span></div>`;
  const tiles = [
    mostSixes ? tile('MOST SIXES', mostSixes['6s'], nm(mostSixes)) : null,
    mostFours ? tile('MOST FOURS', mostFours['4s'], nm(mostFours)) : null,
    topScore ? tile('HIGHEST SCORE', topScore.hs, nm(topScore)) : null,
    bestSR ? tile('BEST SR (24+ BALLS)', Math.round(bestSR.runs / bestSR.balls * 100), nm(bestSR)) : tile('BEST SR (24+ BALLS)', '—', 'Not enough balls yet'),
    bestEcon ? tile('BEST ECONOMY (24+ BALLS)', (bestEcon.runs / (bestEcon.balls / 6)).toFixed(2), nm(bestEcon)) : tile('BEST ECONOMY (24+ BALLS)', '—', 'Not enough balls yet'),
    bestFigs && bestFigs.bestW > 0 ? tile('BEST BOWLING FIGURES', `${bestFigs.bestW}/${bestFigs.bestR}`, nm(bestFigs)) : tile('BEST BOWLING FIGURES', '—', '—'),
    mostCt && mostCt.ct > 0 ? tile('MOST CATCHES', mostCt.ct, nm(mostCt)) : null,
    mostRo && mostRo.ro > 0 ? tile('MOST RUN-OUTS', mostRo.ro, nm(mostRo)) : null,
    keeperDis && keeperDis.dis > 0 ? tile('MOST KEEPER DISMISSALS', keeperDis.dis, nm(keeperDis)) : null,
    mostWins ? tile('MOST TEAM WINS', mostWins.w, `${tName(mostWins)} (${mostWins.w} wins)`) : null,
    hiTotal ? tile('HIGHEST TEAM TOTAL', hiTotal.hiTotal, `${tName(hiTotal)} in ${hiTotal.hiTotalOvers || ''} overs`) : null,
    loTotal ? tile('LOWEST TEAM TOTAL', loTotal.loTotal, tName(loTotal)) : null,
    bestWinRuns ? tile('BIGGEST WIN BY RUNS', `${bestWinRuns.bigWinRuns.by} runs`, `${tName(bestWinRuns)} — ${bestWinRuns.bigWinRuns.text}`) : null,
    bestWinWkts ? tile('BIGGEST WIN BY WICKETS', `${bestWinWkts.bigWinWkts.by} wkts`, `${tName(bestWinWkts)}`) : null,
  ].filter(Boolean);
  $('#recordsGrid').innerHTML = tiles.join('');
}
function renderTeamStats(){
  const rows = computeRows();
  $('#teamStatsBody').innerHTML = rows.map((r, i) => {
    const s = season.stats.team[r.id] || {};
    const rf = s.rf || 0, ra = s.ra || 0;
    return `<tr class="${i < 5 ? 'in-playoff-zone' : ''} ${r.id === season.userTeamId ? 'your-row' : ''}">
      <td class="pt-rank">${i + 1}</td>
      <td class="pt-team">${crestOf(r.id, 'pt-crest')}<span class="pt-short">${esc(teamShort(r.id))}</span></td>
      <td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td>${r.t}</td><td>${r.nr}</td><td class="pt-pts">${r.pts}</td><td class="pt-nrr">${C().formatNRR(r.nrr)}</td>
      <td>${rf}</td><td>${ra}</td><td>${s.hiTotal || 0}</td><td>${s.loTotal || 0}</td></tr>`;
  }).join('');
}

})();
