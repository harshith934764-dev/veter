(() => {
/* ============================================================
   IPL 2026 CHAMPIONSHIP — tournament engine (pure logic core)
   10 verified 2026 squads · double round robin (90 matches)
   Points: W 2 · T 0.5 · NR 1 · TD — 5-team custom playoffs.
   NRR: standard method, all-out innings = full allotted overs.
   Exposed as window.IPLLeague (browser) and module.exports (node).
   ============================================================ */
'use strict';
const rootScope = typeof window !== 'undefined' ? window : globalThis;

/* ── helpers ─────────────────────────────────────────── */
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const escH = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtOvers = balls => `${Math.floor(balls/6)}${balls%6 ? '.'+(balls%6) : ''}`;
const mulberry32 = seed => function(){ let t = seed += 0x6D2B79F5; t = Math.imul(t ^ (t>>>15), t|1); t ^= t + Math.imul(t ^ (t>>>7), t|61); return ((t ^ (t>>>14)) >>> 0) / 4294967296; };

/* IPL roles classification used by the engine */
const isBatRole = r => r === 'BAT' || r === 'WK' || r === 'AR';
const isBowlingOpt = r => r === 'BOWL' || r === 'AR';

/* ── DATA access (injectable for node tests) ─────────── */
let CORE_DATA = rootScope.IPL_DATA || null;
function setData(d){ CORE_DATA = d; }
const teamOf = id => CORE_DATA[id];
const playerOf = (teamId, pid) => teamOf(teamId).players.find(p => p.id === pid);
const roleOfP = p => p.role;

/* ── FIXTURES: double round robin, circle method ─────── */
function generateFixtures(teamIds){
  teamIds = teamIds.slice();
  const n = teamIds.length;                       // 10
  const fixed = teamIds[0];
  let rot = teamIds.slice(1);                     // 9 rotating
  const rounds = [];
  for(let r = 0; r < n - 1; r++){
    const pairs = [];
    const left  = [fixed, ...rot.slice(0, n/2 - 1)];
    const right = rot.slice(n/2 - 1).slice().reverse();
    for(let i = 0; i < left.length; i++){
      if((r + i) % 2 === 0) pairs.push({ home: left[i], away: right[i] });
      else                  pairs.push({ home: right[i], away: left[i] });
    }
    rounds.push(pairs);
    rot.push(rot.shift());
  }
  const fixtures = [];
  let nfx = 1;
  rounds.forEach((rd, ri) => rd.forEach((p, gi) => fixtures.push({ id:'L'+(nfx++), round: ri+1,     game: gi+1, home: p.home, away: p.away, played:false, result:null })));
  rounds.forEach((rd, ri) => rd.forEach((p, gi) => fixtures.push({ id:'L'+(nfx++), round: 9+ri+1,   game: gi+1, home: p.away, away: p.home, played:false, result:null })));
  return fixtures;                                // 90 matches
}
const ALL_TEAM_IDS = () => Object.keys(CORE_DATA);
function fixtureSummary(fixtures, teamIds){
  const per = {}; teamIds.forEach(t => per[t] = {played:0, home:0, away:0});
  fixtures.forEach(f => { per[f.home].home++; per[f.away].away++; });
  return per;
}

/* ── AI XI selection (cached per season) ─────────────── */
function buildAiXi(teamId){
  const team = teamOf(teamId);
  const P = team.players;
  const picked = [];
  const overseasCount = () => picked.filter(id => playerOf(teamId,id).overseas).length;
  const canPick = p => overseasCount() < 4 || !p.overseas;
  const bestWK = P.filter(p => p.role === 'WK').sort((a,b) => b.ovr - a.ovr)[0];
  if(bestWK) picked.push(bestWK.id);
  const pool = P.slice().sort((a,b) => b.ovr - a.ovr);
  for(const p of pool){
    if(picked.length >= 11) break;
    if(picked.includes(p.id) || !canPick(p)) continue;
    picked.push(p.id);
  }
  // guarantee ≥5 bowling options — swap in best bowlers / all-rounders if short
  const bowlCount = () => picked.filter(id => isBowlingOpt(playerOf(teamId,id).role)).length;
  let guard = 12;
  while(bowlCount() < 5 && guard-- > 0){
    const spare = pool.find(p => !picked.includes(p.id) && isBowlingOpt(p.role) && canPick(p));
    if(!spare) break;
    // drop the weakest pure batter in XI who isn't the keeper
    let worstI = -1, worstOvr = Infinity;
    picked.forEach((id, i) => {
      const pl = playerOf(teamId, id);
      if(pl.role === 'BAT' && pl.ovr < worstOvr){ worstOvr = pl.ovr; worstI = i; }
    });
    if(worstI < 0) break;
    picked[worstI] = spare.id;
  }
  // batting order: batters (BAT/WK) by batR, then AR by batR, then bowlers
  const byBatR = (a,b) => playerOf(teamId,b).batR - playerOf(teamId,a).batR;
  const batters = picked.filter(id => { const r = playerOf(teamId,id).role; return r==='BAT' || r==='WK'; }).sort(byBatR);
  const allr    = picked.filter(id => playerOf(teamId,id).role === 'AR').sort(byBatR);
  const bowlers = picked.filter(id => playerOf(teamId,id).role === 'BOWL').sort(byBatR);
  const order = [...batters, ...allr, ...bowlers];
  const bowlOptions = picked
    .filter(id => isBowlingOpt(playerOf(teamId,id).role))
    .sort((a,b) => playerOf(teamId,b).bowlR - playerOf(teamId,a).bowlR);
  // pad bowling options to 5 if needed (already guaranteed but keep safe)
  for(const p of [...P].sort((a,b) => b.bowlR - a.bowlR)){
    if(bowlOptions.length >= 5) break;
    if(picked.includes(p.id) && !bowlOptions.includes(p.id) && p.bowlR >= 30) bowlOptions.push(p.id);
  }
  const keeper = (bestWK && picked.includes(bestWK.id)) ? bestWK.id : (picked.find(id => playerOf(teamId,id).role === 'WK') || null);
  return {
    order,
    bowlOptions: bowlOptions.slice(0, 5),
    captain: order[0],
    keeper,
  };
}

/* ── ball outcome model ──────────────────────────────── */
function drawOutcome(batR, bowlR, freeHit){
  const d = batR - bowlR;
  const pSix  = clamp(0.045 + d*0.0012, 0.018, 0.125);
  const pFour = clamp(0.150 + d*0.0032, 0.070, 0.265);
  const pDot  = clamp(0.265 - d*0.0036, 0.125, 0.410);
  const p1    = clamp(0.335 - d*0.0012, 0.215, 0.385);
  const p2    = 0.130;
  const p3    = 0.020;
  const pWk   = freeHit ? 0 : clamp(0.070 - d*0.0026, 0.016, 0.125);
  const table = [[6,pSix],[4,pFour],[0,pDot],[1,p1],[2,p2],[3,p3],['W',pWk]];
  let x = Math.random() * (pSix+pFour+pDot+p1+p2+p3+pWk);
  for(const [k,v] of table){ x -= v; if(x <= 0) return k; }
  return 0;
}

function wicketKind(){
  const r = Math.random();
  if(r < 0.34) return 'bowled';
  if(r < 0.40) return 'lbw';
  if(r < 0.82) return 'caught';
  if(r < 0.91) return 'stumped';
  return 'runout';
}

/* fielder attribution: caught→any fielder (skews to non-bowlers), runout→non-keeper, stumped→keeper */
function pickFielder(bowlXi, bowlerId, kind){
  const keeper = bowlXi.keeper || null;
  const candidates = bowlXi.order.filter(id => id !== bowlerId);
  if(kind === 'stumped') return keeper || candidates[0] || bowlerId;
  if(kind === 'runout'){
    const noKeeper = candidates.filter(id => id !== keeper);
    const pool = noKeeper.length ? noKeeper : candidates;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // caught: ~18% of catches are taken by the bowler (c&b)
  if(Math.random() < 0.18) return bowlerId;
  // otherwise a non-bowler fielder; keeper gets a fair share
  const fielders = candidates.filter(id => id !== keeper);
  if(keeper && Math.random() < 0.22) return keeper;
  return fielders[Math.floor(Math.random() * fielders.length)] || keeper || bowlerId;
}

/* ── play one innings, mutate stats ── */
function playInnings(sc, battingTeamId, bowlingTeamId, batXi, bowlXi, target, isSuperOver){
  const oversLimit = isSuperOver ? 1 : sc.overs;
  const wicketsLimit = isSuperOver ? 2 : 10;
  const order = batXi.order;
  const bowlPlan = isSuperOver
    ? [bowlXi.bowlOptions[0]]
    : buildBowlingPlan(bowlXi.bowlOptions, bowlingTeamId, oversLimit);
  const inn = {
    teamId: battingTeamId,
    runs: 0, wickets: 0, balls: 0, legalBalls: 0, extras: 0,
    batting: {}, bowling: {},
    fow: [],                       // fall of wickets [{n, runs, player}]
    allOut: false, completed: false,
  };
  order.forEach(id => inn.batting[id] = { id, runs:0, balls:0, '4s':0, '6s':0, out:false, how:'not out' });
  bowlXi.bowlOptions.forEach(id => inn.bowling[id] = { id, balls:0, runs:0, wickets:0, maidens:0 });
  inn.fielding = {};
  bowlXi.order.forEach(id => inn.fielding[id] = { id, ct:0, ro:0, st:0 });

  let strikerIdx = 0, nonStrikerIdx = 1;
  let freeHit = false;
  const activeCount = order.length;

  for(let over = 0; over < oversLimit; over++){
    if(inn.wickets >= wicketsLimit) break;
    const bowlerId = bowlPlan[over];
    if(!inn.bowling[bowlerId]) inn.bowling[bowlerId] = { id: bowlerId, balls:0, runs:0, wickets:0, maidens:0 };
    const bw = inn.bowling[bowlerId];
    let legalThisOver = 0, runsThisOver = 0;
    while(legalThisOver < 6 && inn.wickets < wicketsLimit && (target == null || inn.runs < target)){
      const batterId = order[strikerIdx];
      if(!inn.batting[batterId]){ strikerIdx = (strikerIdx + 1) % activeCount; continue; }
      const bs = inn.batting[batterId];
      const p = playerOf(battingTeamId, batterId);
      const bowlP = playerOf(bowlingTeamId, bowlerId);

      // wide
      if(Math.random() < 0.028){
        inn.runs++; inn.extras++; bw.runs++; runsThisOver++;
        inn.balls++;
        continue;                             // no ball counted as legal
      }
      // no-ball
      if(Math.random() < 0.005){
        inn.runs++; inn.extras++; bw.runs++; runsThisOver++;
        inn.balls++;
        const off = drawOutcome(p.batR, bowlP.bowlR, false);
        if(off === 'W'){
          const how = wicketKind();
          if(how === 'runout'){ /* catch not out off nb (illegal delivery) — count as runout only */ }
          else { inn.runs += 4; bw.runs += 4; bs.runs += 4; bs.balls++; bs['4s']++; legalThisOver++; }
        } else if(typeof off === 'number' && off > 0){
          inn.runs += off; bw.runs += off; bs.runs += off; bs.balls++;
          if(off === 4) bs['4s']++; else if(off === 6) bs['6s']++;
          if(off % 2 === 1) rotate();
          legalThisOver++;
        } else if(off === 0){
          bs.balls++; legalThisOver++;
        }
        freeHit = true;
        continue;
      }

      // legal delivery
      legalThisOver++; inn.legalBalls++; inn.balls++; bw.balls++;
      bs.balls++;
      const outc = drawOutcome(p.batR, bowlP.bowlR, freeHit);
      if(outc === 'W'){
        const how = wicketKind();
        bs.out = true;
        const lastName = bowlP.name.split(' ').slice(-1)[0];
        if(how === 'runout'){
          bs.how = 'run out';
          const f = pickFielder(bowlXi, bowlerId, 'runout');
          if(inn.fielding[f]) inn.fielding[f].ro++;
        } else if(how === 'stumped'){
          const f = pickFielder(bowlXi, bowlerId, 'stumped');
          const keeperName = playerOf(bowlingTeamId, f) ? playerOf(bowlingTeamId, f).name.split(' ').slice(-1)[0] : 'keeper';
          bs.how = 'st ' + keeperName + ' b ' + lastName;
          bw.wickets++;
          if(inn.fielding[f]) inn.fielding[f].st++;
        } else if(how === 'lbw'){
          bs.how = 'lbw b ' + lastName;
          bw.wickets++;
        } else if(how === 'bowled'){
          bs.how = 'b ' + lastName;
          bw.wickets++;
        } else {
          const f = pickFielder(bowlXi, bowlerId, 'caught');
          bs.how = f === bowlerId ? 'c & b ' + lastName : 'c ' + playerOf(bowlingTeamId, f).name.split(' ').slice(-1)[0] + ' b ' + lastName;
          if(inn.fielding[f]) inn.fielding[f].ct++;
          bw.wickets++;
        }
        inn.wickets++;
        inn.fow.push({ n: inn.wickets, runs: inn.runs, player: p.name });
        if(inn.wickets < wicketsLimit){
          // new batter to the crease (off strike)
          const next = order.find(id => !inn.batting[id].out && order.indexOf(id) !== strikerIdx && order.indexOf(id) !== nonStrikerIdx);
          if(next){
            strikerIdx = order.indexOf(next);
          }
        }
        freeHit = false;
        continue;
      }
      const off = outc;
      bs.runs += off; bw.runs += off; inn.runs += off; runsThisOver += off;
      if(off === 4) bs['4s']++; else if(off === 6) bs['6s']++;
      if(off % 2 === 1) rotate();
      freeHit = false;
    }
    if(runsThisOver === 0) bw.maidens++;
    // end of over: swap ends
    rotate();
  }
  inn.allOut = inn.wickets >= wicketsLimit;
  inn.completed = true;

  function rotate(){
    const t = strikerIdx; strikerIdx = nonStrikerIdx; nonStrikerIdx = t;
  }
  return inn;
}

function buildBowlingPlan(bowlOptions, bowlingTeamId, oversLimit){
  // T5: 2 overs each max, no consecutive overs; T20: 4 each
  const per = oversLimit === 20 ? 4 : 2;
  const sorted = bowlOptions.slice();
  const quota = {}; sorted.forEach(id => quota[id] = per);
  const plan = [];
  let last = null, guard = 200;
  while(plan.length < oversLimit && guard-- > 0){
    // pick the bowler with the most quota left, not same as last over
    let pick = null;
    for(const id of sorted){
      if(id === last) continue;
      if(quota[id] > 0 && (pick === null || quota[id] > quota[pick])) pick = id;
    }
    if(pick === null){ pick = sorted.find(id => quota[id] > 0) || sorted[0]; }
    plan.push(pick); quota[pick]--; last = pick;
  }
  return plan;
}

/* ── whole match simulation ──────────────────────────── */
function simMatch(homeId, awayId, sc, opts){
  opts = opts || {};
  const homeXi = opts.homeXi || buildAiXi(homeId);
  const awayXi = opts.awayXi || buildAiXi(awayId);

  // rain washout (league matches only, 3%)
  if(!opts.isPlayoff && Math.random() < 0.03){
    return {
      played: true, washout: true, winner: null, nr: true,
      home: homeId, away: awayId,
      homeXi, awayXi,
      inn1: null, inn2: null, potm: null,
      summary: { text: 'No result — rain stopped play.' },
    };
  }
  // toss
  const tossWinner = Math.random() < 0.5 ? homeId : awayId;
  const tossChoice = Math.random() < 0.52 ? 'field' : 'bat';
  const firstBatId = tossChoice === 'bat' ? tossWinner : (tossWinner === homeId ? awayId : homeId);
  const secondBatId = firstBatId === homeId ? awayId : homeId;

  const firstBatXi = firstBatId === homeId ? homeXi : awayXi;
  const secondBatXi = secondBatId === homeId ? homeXi : awayXi;
  const bowlXi1 = secondBatId === homeId ? homeXi : awayXi;   // bowls first innings
  const bowlXi2 = firstBatId === homeId ? homeXi : awayXi;    // bowls second innings

  const inn1 = playInnings(sc, firstBatId, firstBatId === homeId ? awayId : homeId, firstBatXi, bowlXi1, null, false);
  const target = inn1.runs + 1;
  const inn2 = playInnings(sc, secondBatId, secondBatId === homeId ? awayId : homeId, secondBatXi, bowlXi2, target, false);

  const res = finalizeMatch(sc, { homeId, awayId, inn1, inn2, homeXi, awayXi, firstBatId, secondBatId, tossWinner, tossChoice, isPlayoff: !!opts.isPlayoff, supOv: 0 });
  return res;
}

function finalizeMatch(sc, m){
  const { inn1, inn2 } = m;
  const homeBatFirst = m.firstBatId === m.homeId;
  const r1 = inn1.runs, r2 = inn2.runs;
  const res = {
    played: true, washout: false, nr: false,
    home: m.homeId, away: m.awayId, tossWinner: m.tossWinner, tossChoice: m.tossChoice,
    firstBat: m.firstBatId, secondBat: m.secondBatId,
    homeXi: m.homeXi, awayXi: m.awayXi,
    inn1, inn2, supOv: m.supOv || 0,
  };
  if(r1 === r2){
    res.tie = true;
    if(m.isPlayoff){
      const so = superOver(m.homeId, m.awayId, sc, m.homeXi, m.awayXi, m.inn1.teamId);
      res.supOv = 1 + (so.tiedAgain ? 1 : 0) + (so.tiedAgain2 ? 1 : 0);
      res.superOver = so;
      res.winner = so.winner;
      res.tie = false;
      res.margin = 'Super Over';
    } else {
      res.winner = null; res.margin = 'Match tied';
    }
  } else if(r2 > r1){
    res.winner = m.secondBatId;
    const wicketsLost = inn2.wickets;
    res.margin = `won by ${10 - wicketsLost} wicket${(10 - wicketsLost) === 1 ? '' : 's'}`;
    res.byWickets = 10 - wicketsLost;
    res.byRuns = null;
    res.ballsLeft = (sc.overs * 6) - inn2.legalBalls;
  } else {
    res.winner = m.firstBatId;
    const margin = r1 - r2;
    res.margin = `won by ${margin} run${margin === 1 ? '' : 's'}`;
    res.byRuns = margin;
    res.byWickets = null;
  }
  res.potm = pickPotm(inn1, inn2, m.firstBatId, m.secondBatId);
  res.summary = buildSummary(res);
  res.overs = sc.overs;
  return res;
}

function superOver(homeId, awayId, sc, homeXi, awayXi, teamBatFirstInMatch){
  // Super over: 1 over each, 2 wickets max. Team batting second in the match bats first? Standard: toss redrawn — random again.
  const aBowlsFirst = teamBatFirstInMatch === homeId ? awayId : homeId;   // bowls first in SO
  const batFirst = aBowlsFirst === homeId ? awayId : homeId;               // bats first in SO
  const xi = id => id === homeId ? homeXi : awayXi;
  const innA = playInnings(sc, batFirst, aBowlsFirst, xi(batFirst), xi(aBowlsFirst), null, true);
  const innB = playInnings(sc, aBowlsFirst, batFirst, xi(aBowlsFirst), xi(batFirst), innA.runs + 1, true);
  const res = { played: true, innA, innB, tiedAgain: false };
  if(innA.runs === innB.runs){
    // second super over, must resolve: keep looping quickly
    const innC = playInnings(sc, batFirst, aBowlsFirst, xi(batFirst), xi(aBowlsFirst), null, true);
    const innD = playInnings(sc, aBowlsFirst, batFirst, xi(aBowlsFirst), xi(batFirst), innC.runs + 1, true);
    res.tiedAgain = true;
    res.innC = innC; res.innD = innD;
    if(innC.runs === innD.runs){
      // sudden death: coin
      res.tiedAgain2 = true;
      res.winner = Math.random() < 0.5 ? homeId : awayId;
      res.summary = { text: 'Super overs level — decided by a coin toss.' };
      return res;
    }
    res.winner = innD.runs > innC.runs ? aBowlsFirst : batFirst;
    res.summary = { text: `2nd Super Over: ${res.winner === homeId ? 'HOME' : 'AWAY'} side wins the decider.` };
    return res;
  }
  res.winner = innB.runs > innA.runs ? aBowlsFirst : batFirst;
  res.summary = { text: `Super Over won by ${res.winner}.` };
  return res;
}

function pickPotm(inn1, inn2, firstBatId, secondBatId){
  let best = null, bestScore = -1;
  [[inn1, firstBatId], [inn2, secondBatId]].forEach(([inn, tid]) => {
    Object.values(inn.batting).forEach(b => {
      const score = b.runs + (b.runs >= 50 ? 10 : 0) + (b.runs >= 100 ? 25 : 0);
      if(score > bestScore){ bestScore = score; best = { id: b.id, teamId: tid, kind: 'bat', runs: b.runs, balls: b.balls }; }
    });
    Object.values(inn.bowling).forEach(bw => {
      const score = bw.wickets * 25 + (bw.wickets >= 4 ? 8 : 0) + (bw.wickets >= 5 ? 15 : 0);
      if(score > bestScore){ bestScore = score; best = { id: bw.id, teamId: tid, kind: 'bowl', wickets: bw.wickets, balls: bw.balls, runs: bw.runs }; }
    });
  });
  return best;
}

function buildSummary(res){
  const t = id => teamOf(id).short;
  if(res.washout) return { text: 'No result — rain. One point each.' };
  const w = res.winner, r1 = res.inn1.runs, r2 = res.inn2.runs;
  const s = `${t(res.firstBat)} ${r1}/${res.inn1.wickets} · ${t(res.secondBat)} ${r2}/${res.inn2.wickets}`;
  if(res.tie) return { text: `${s} — match tied.` };
  return { text: `${s} — ${t(w)} ${res.margin}.` };
}

/* ── stats aggregation ───────────────────────────────── */
function emptyStats(){
  return {
    bat: {},   // pid -> {team, runs, balls, inns, outs, 4s,6s, hs, hsAgainst, hsRuns, 50s, 100s}
    bowl: {},  // pid -> {team, wkts, balls, runs, maidens, bestW, bestR, haul3, haul4, haul5}
    field:{},  // pid -> {team, ct, ro, st}
    team: {},  // tid -> {rf,bf,ra,ba, w, l, t, nr, hiTotal, hiTotalOvers, loTotal, bigWinRuns, bigWinWkts}
  };
}
function batRow(stats, pid, team){ return stats.bat[pid] || (stats.bat[pid] = { team, runs:0, balls:0, inns:0, outs:0, '4s':0, '6s':0, hs:0, hsMatch:null, '50s':0, '100s':0 }); }
function bowlRow(stats, pid, team){ return stats.bowl[pid] || (stats.bowl[pid] = { team, wkts:0, balls:0, runs:0, maidens:0, bestW:0, bestR:0, haul3:0, haul4:0, haul5:0 }); }
function fieldRow(stats, pid, team){ return stats.field[pid] || (stats.field[pid] = { team, ct:0, ro:0, st:0 }); }
function teamRow(stats, tid){ return stats.team[tid] || (stats.team[tid] = { rf:0, bf:0, ra:0, ba:0, w:0, l:0, t:0, nr:0, hiTotal:0, hiTotalOvers:null, hiTeam:tid, loTotal:0, bigWinRuns:null, bigWinWkts:null }); }

function applyResultToStats(stats, res){
  if(!res || res.washout){
    // no-result: no stats
    [res && res.home, res && res.away].forEach(t => { if(t){ const tr = teamRow(stats, t); tr.nr++; } });
    return;
  }
  const innings = [res.inn1, res.inn2];
  innings.forEach(inn => {
    if(!inn) return;
    const battingTeam = inn.teamId;
    const bowlingTeam = battingTeam === res.home ? res.away : res.home;
    // batting stats
    Object.values(inn.batting).forEach(b => {
      if(b.balls === 0 && !b.out) return;    // didn't bat
      const row = batRow(stats, b.id, battingTeam);
      row.inns++; row.runs += b.runs; row.balls += b.balls;
      row['4s'] += b['4s']; row['6s'] += b['6s'];
      if(b.out) row.outs++;
      if(b.runs > row.hs){ row.hs = b.runs; row.hsMatch = { v: b.runs, against: bowlingTeam, out: b.out }; }
      if(b.runs >= 50 && b.runs < 100) row['50s']++;
      if(b.runs >= 100) row['100s']++;
    });
    // bowling stats
    Object.values(inn.bowling).forEach(bw => {
      if(bw.balls === 0) return;
      const row = bowlRow(stats, bw.id, bowlingTeam);
      row.wkts += bw.wickets; row.balls += bw.balls; row.runs += bw.runs; row.maidens += bw.maidens;
      if(bw.wickets >= 3) row.haul3++;
      if(bw.wickets >= 4) row.haul4++;
      if(bw.wickets >= 5) row.haul5++;
      if(bw.wickets > row.bestW || (bw.wickets === row.bestW && (row.bestR === 0 || bw.runs < row.bestR))){
        row.bestW = bw.wickets; row.bestR = bw.runs;
      }
    });
    // fielding stats
    Object.values(inn.fielding).forEach(f => {
      if(f.ct || f.ro || f.st){
        const row = fieldRow(stats, f.id, bowlingTeam);
        row.ct += f.ct; row.ro += f.ro; row.st += f.st;
      }
    });
  });
  // team stats — NRR needs raw figures; only for non-NR matches
  const t1 = teamRow(stats, res.home), t2 = teamRow(stats, res.away);
  const ov = res.overs || 20;
  [[res.inn1], [res.inn2]].forEach(([inn]) => {
    if(!inn) return;
    const battingTeamRow = teamRow(stats, inn.teamId);
    const bowlingTeamRow = teamRow(stats, inn.teamId === res.home ? res.away : res.home);
    const fullOv = inn.allOut ? ov : Math.floor(inn.legalBalls / 6) + (inn.legalBalls % 6 ? 0 : 0); // overs faced handled at calc time with balls
    battingTeamRow.rf += inn.runs;
    battingTeamRow.bf += (inn.allOut ? ov * 6 : inn.legalBalls);
    bowlingTeamRow.ra += inn.runs;
    bowlingTeamRow.ba += (inn.allOut ? ov * 6 : inn.legalBalls);
    if(inn.runs > battingTeamRow.hiTotal){ battingTeamRow.hiTotal = inn.runs; battingTeamRow.hiTotalOvers = fmtOvers(inn.legalBalls); }
    if(!battingTeamRow.loTotal || inn.runs < battingTeamRow.loTotal){ battingTeamRow.loTotal = inn.runs; }
  });
  // win/loss/tie
  if(res.tie){ t1.t++; t2.t++; return; }
  const wRow = teamRow(stats, res.winner);
  const lRow = teamRow(stats, res.winner === res.home ? res.away : res.home);
  wRow.w++; lRow.l++;
  if(res.byRuns != null){
    if(!wRow.bigWinRuns || res.byRuns > wRow.bigWinRuns.by){
      wRow.bigWinRuns = { by: res.byRuns, text: `${res.byRuns} runs vs ${teamOf(res.winner === res.home ? res.away : res.home).short}` };
    }
  }
  if(res.byWickets != null){
    if(!wRow.bigWinWkts || res.byWickets > wRow.bigWinWkts.by){
      wRow.bigWinWkts = { by: res.byWickets, text: `${res.byWickets} wickets vs ${teamOf(res.winner === res.home ? res.away : res.home).short}` };
    }
  }
}

/* ── super-over safe accessor used by UI ── */
function oversOfInnings(inn, sc){ return inn ? fmtOvers(inn.allOut ? sc.overs*6 : inn.legalBalls) : '—'; }


/* ── POINTS TABLE (computed from results) ───────────── */
function computeTable(sc, fixtures, teamIds){
  const ov = sc.overs;
  const rows = {};
  teamIds.forEach(t => rows[t] = { id: t, p:0, w:0, l:0, t:0, nr:0, pts:0, rf:0, bf:0, ra:0, ba:0 });
  fixtures.forEach(f => {
    if(!f.played || !f.result) return;
    const res = f.result;
    const h = rows[f.home], a = rows[f.away];
    if(res.washout){ h.p++; a.p++; h.nr++; a.nr++; h.pts += 1; a.pts += 1; return; }
    h.p++; a.p++;
    // NRR figures (all-out = full overs)
    [[res.inn1],[res.inn2]].forEach(([inn]) => {
      if(!inn) return;
      const batRow = rows[inn.teamId];
      const bowlRow = rows[inn.teamId === f.home ? f.away : f.home];
      const full = sc.overs * 6;
      const ballsFaced = inn.allOut ? full : inn.legalBalls;
      batRow.rf += inn.runs; batRow.bf += ballsFaced;
      bowlRow.ra += inn.runs; bowlRow.ba += ballsFaced;
    });
    if(res.tie){ h.t++; a.t++; h.pts += 0.5; a.pts += 0.5; return; }
    const w = res.winner, l = res.winner === f.home ? f.away : f.home;
    rows[w].w++; rows[l].l++; rows[w].pts += 2;
  });
  const arr = Object.values(rows);
  arr.forEach(r => { r.nrr = r.bf > 0 && r.ba > 0 ? (r.rf / (r.bf/6)) - (r.ra / (r.ba/6)) : 0; });
  arr.sort((x, y) => y.pts - x.pts || y.nrr - x.nrr || y.w - x.w || x.ra - y.ra);
  return arr;
}
function formatNRR(n){ return (n >= 0 ? '+' : '') + n.toFixed(3); }

/* ── PLAYOFFS: top-5 custom bracket ───────────────────
   Q1: #2 vs #3  → winner to Q2
   Q2: #1 vs Q1W → winner to FINAL
   ELIMINATOR: #4 vs #5 → winner to FINAL
   FINAL: Q2W vs EW → CHAMPION */
function seedPlayoffs(table){
  const t = table.slice(0, 5);
  return {
    ranked: t.map(r => r.id),
    q1: { id:'Q1', label:'QUALIFIER 1', home: t[1].id, away: t[2].id, winner:null, result:null },
    q2: { id:'Q2', label:'QUALIFIER 2', home: t[0].id, away: null, winner:null, result:null },
    elim:{ id:'EL', label:'ELIMINATOR', home: t[3].id, away: t[4].id, winner:null, result:null },
    final:{ id:'F', label:'IPL FINAL', home: null, away: null, winner:null, result:null },
  };
}
function playoffNext(po){
  if(!po.q1.winner) return po.q1;
  if(!po.q2.winner) return po.q2.away ? po.q2 : null;
  if(!po.elim.winner) return po.elim;
  if(!po.final.winner) return po.final.away ? po.final : null;
  return null;
}
function playoffReady(po){
  po.q2.away = po.q1.winner;
  po.final.home = po.q2.winner;
  po.final.away = po.elim.winner;
}

/* ── SEASON creation ─────────────────────────────────── */
function createSeasonState(userTeamId, cfg){
  const sc = { overs: cfg.overs, maxWickets: 10, matchesPerTeam: 18 };
  const teamIds = Object.keys(CORE_DATA);
  const fixtures = generateFixtures(teamIds);
  fixtures.forEach(f => { f.userMatch = (f.home === userTeamId || f.away === userTeamId); });
  return {
    version: 1,
    cfg: sc,
    userTeamId,
    aiXis: {},           // tid -> ai xi cache
    fixtures,
    stats: emptyStats(),
    playoff: null,
    phase: 'league',     // 'league' | 'playoffs' | 'done'
    champion: null,
    runnerUp: null,
    startedAt: Date.now(),
    oversChoice: cfg.overs,
  };
}

/* ── full league instant simulation (for "sim remaining") */
function simFixture(seasonObj, fx, applyStats){
  if(fx.played) return fx.result;
  const homeXi = fx.home === seasonObj.userTeamId ? null : aiXiCached(seasonObj, fx.home);
  const awayXi = fx.away === seasonObj.userTeamId ? null : aiXiCached(seasonObj, fx.away);
  const res = simMatch(fx.home, fx.away, seasonObj.cfg, {
    homeXi: fx.home === seasonObj.userTeamId ? seasonObj.userXi : homeXi,
    awayXi: fx.away === seasonObj.userTeamId ? seasonObj.userXi : awayXi,
    isPlayoff: false,
  });
  fx.result = res;
  fx.played = true;
  if(applyStats !== false) applyResultToStats(seasonObj.stats, res);
  return res;
}
function aiXiCached(seasonObj, teamId){
  if(!seasonObj.aiXis[teamId]) seasonObj.aiXis[teamId] = buildAiXi(teamId);
  return seasonObj.aiXis[teamId];
}

const CORE_API = {
  setData, generateFixtures, fixtureSummary, buildAiXi, simMatch, playInnings, buildBowlingPlan,
  emptyStats, applyResultToStats, fmtOvers,
  computeTable, formatNRR, seedPlayoffs, playoffNext, playoffReady,
  createSeasonState, simFixture, aiXiCached, superOver, pickPotm, buildSummary,
};
if(typeof module !== 'undefined' && module.exports) module.exports = CORE_API;
if(typeof window !== 'undefined') rootScope.IPLLeagueCore = CORE_API;

})();
