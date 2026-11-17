/* ============================================================
   IPL 2026 — AI vs AI ONE-OVER MATCH ENGINE (v2)
   Rating-driven ball-by-ball simulation with a 2D canvas
   broadcast view (js/match2d.js).
   Modes: full XI (10 wickets) · showdown (2 wickets, 4+3).
   User confirms teams; AI controls everything on the field.
   ============================================================ */
'use strict';

window.IPLMatch = (function(){
  const APP = () => window.IPLApp;
  const $ = (s, r) => (r||document).querySelector(s);
  const $$ = (s, r) => Array.from((r||document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pickOne = arr => arr[Math.floor(Math.random()*arr.length)];
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

  const LEGAL_BALLS = 6;
  const BALL_RECOVER = 1900;       // pause after a delivery settles (field re-sets, bowler walks back)
  const INNINGS_BREAK = 4500;

  let M = null;
  let timer = null;
  /* ── SOUND (synthesized engine in js/sound.js; beep fallback kept) ── */
  let soundOn = window.IPLSFX ? window.IPLSFX.isEnabled()
    : (() => { try { return localStorage.getItem('ipl2026-sound') !== 'off'; } catch(e){ return true; } })();
  let audioCtx = null;
  function beep(freq, dur, type, gain, when){
    if(!soundOn) return;
    try{
      audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type||'sine'; o.frequency.value = freq;
      const t0 = audioCtx.currentTime + (when||0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain||0.07, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur||0.18));
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0); o.stop(t0 + (dur||0.18) + 0.02);
    }catch(e){}
  }
  const legacySfx = {
    click:  () => beep(880, .06, 'triangle', .05),
    run:    () => beep(660, .08, 'sine', .05),
    four:   () => { beep(660,.1,'sine',.07); beep(880,.12,'sine',.07,.09); beep(1180,.16,'sine',.07,.18); },
    six:    () => { beep(587,.09,'sine',.08); beep(784,.09,'sine',.08,.08); beep(988,.09,'sine',.08,.16); beep(1319,.22,'sine',.08,.24); },
    wicket: () => { beep(196,.3,'sawtooth',.09); beep(130,.4,'sawtooth',.08,.18); },
    dot:    () => beep(330,.05,'square',.03),
    win:    () => { [523,659,784,1047,1319].forEach((f,i)=>beep(f,.22,'triangle',.08,i*.14)); },
    tie:    () => { [440,523,659].forEach((f,i)=>beep(f,.3,'triangle',.07,i*.16)); },
    wide:   () => beep(2100,.16,'square',.03),
    noball: () => { beep(2450,.09,'square',.035); beep(2450,.16,'square',.035,.14); },
    inningsBreak: () => { [523,659,784].forEach((f,i)=>beep(f,.18,'triangle',.06,i*.11)); },
  };
  const sfx = window.IPLSFX ? {
    click:        () => window.IPLSFX.click(),
    run:          n  => window.IPLSFX.run(n),
    four:         () => window.IPLSFX.four(),
    six:          () => window.IPLSFX.six(),
    wicket:       k  => window.IPLSFX.wicket(k),
    dot:          () => window.IPLSFX.dot(),
    win:          () => window.IPLSFX.win(),
    tie:          () => window.IPLSFX.tie(),
    wide:         () => window.IPLSFX.wide(),
    noball:       () => window.IPLSFX.noball(),
    inningsBreak: () => window.IPLSFX.inningsBreak(),
  } : legacySfx;

  /* ── MODE HELPERS ─────────────────────────────────── */
  function maxWickets(){ const A = APP(); return (A.state.mode === 'showdown') ? 2 : 10; }
  function battingOrderFor(A, side, teamId){
    if(A.state.mode === 'showdown') return A.xiOf(side).filter(id => A.isBatterRole(A.playerOf(teamId, id).role));
    return A.xiOf(side).slice();
  }
  function bowlingOptionsFor(A, bowlingSide, bowlingTeamId){
    if(A.state.mode === 'showdown')
      return A.xiOf(bowlingSide).filter(id => A.isBowlerRole(A.playerOf(bowlingTeamId, id).role));
    return A.bowlOf(bowlingSide).filter(id => id);
  }

  /* ── MATCH CONSTRUCTION ────────────────────────────── */
  function buildInnings(battingSide){
    const A = APP();
    const battingTeamId = A.sideIds(battingSide);
    const bowlingSide = battingSide === 'team1' ? 'team2' : 'team1';
    const bowlingTeamId = A.sideIds(bowlingSide);
    const order = battingOrderFor(A, battingSide, battingTeamId);
    const optIds = bowlingOptionsFor(A, bowlingSide, bowlingTeamId);
    const bowler = optIds
      .map(id => A.playerOf(bowlingTeamId, id))
      .sort((a,b) => b.bowlR - a.bowlR)[0]
      || A.playerOf(bowlingTeamId, order[0]);
    const batters = {};
    order.forEach(id => {
      const p = A.playerOf(battingTeamId, id);
      batters[id] = { id, runs:0, balls:0, fours:0, sixes:0, out:false, howOut:'not out', batR:p.batR };
    });
    return {
      battingSide, bowlingSide, battingTeamId, bowlingTeamId,
      order, batters,
      striker: 0, nonStriker: 1, nextIn: 2,
      bowler: { id: bowler.id, legalBalls:0, runs:0, wickets:0 },
      runs:0, wickets:0, legalBalls:0, extras:0,
      fow: [], completed:false, overLog: [],
      freeHit:false, fielding: {},
    };
  }
  function ensureMatch(){
    if(M) { renderAll(); return; }
    const A = APP();
    const toss = A.state.toss;
    const tossWinner = toss.winnerId;
    const team1Id = A.state.team1Id;
    const firstSide = (toss.choice === 'bat')
      ? (tossWinner === team1Id ? 'team1' : 'team2')
      : (tossWinner === team1Id ? 'team2' : 'team1');
    M = {
      innings: [buildInnings(firstSide), buildInnings(firstSide === 'team1' ? 'team2' : 'team1')],
      current: 0,
      target: null,
      phase: 'live',               // live → anim → break → live → done
      log: [],
      result: null,
      winner: null,
      maxWickets: maxWickets(),
    };
    if(window.IPLSFX) window.IPLSFX.startAmbience();
    if(window.IPLMusic) window.IPLMusic.setSituation('match');
    if(window.IPLCommentary) window.IPLCommentary.play('intro', { delayMs: 800 });
    // boot the 2D game
    if(window.Match2D){
      window.Match2D.init();
      window.Match2D.resetStumps();
      setCanvasTeamColors();
    }
    pushHud();
    renderAll();
    const A2 = APP();
    const bowlingSide0 = M.innings[0].bowlingSide;
    const bp = A2.playerOf(M.innings[0].bowlingTeamId, M.innings[0].bowler.id);
    const capId = A2.capOf(bowlingSide0);
    const capP = capId ? A2.playerOf(A2.sideIds(bowlingSide0), capId) : null;
    const isChamp = A2.state.mode === 'tournament';
    const modeNote = A2.state.mode === 'showdown'
      ? 'Showdown rules: 4 batters, 3 bowlers — innings ends at 2 wickets.'
      : isChamp
        ? 'Championship rules: the full XI, one over a side — every ball is season-defining.'
        : 'Full XI rules: 10 wickets in hand, one over, twelve balls of destiny either way... six, actually.';
    const matchLabel = isChamp ? 'the IPL 2026 Championship' : 'the One-Over Showdown';
    addComment(0, null, `<b>Welcome to the ${esc(A2.teamOf(M.innings[0].battingTeamId).name)} vs ${esc(A2.teamOf(M.innings[0].bowlingTeamId).name)} — ${esc(matchLabel)}.</b> ${esc(A2.teamOf(tossWinner).name)} won the toss and chose to ${esc(toss.choice === 'bat' ? 'bat' : 'bowl')}. ${esc(modeNote)}`, 'highlight');
    addComment(0, null, `<b>${esc(bp.name)}</b> grabs the ball for ${esc(A2.teamOf(M.innings[0].bowlingTeamId).short)}${capP ? `. ${esc(capP.name)} backs him to strike early` : ''}.`, '');
    timer = setTimeout(playNextBall, 3000);
  }
  function abort(){ clearTimeout(timer); timer = null; M = null; if(window.IPLSFX) window.IPLSFX.stopAmbience(400); if(window.Match2D) window.Match2D.reset(); }
  function setCanvasTeamColors(){
    if(!window.Match2D || !M) return;
    const A = APP();
    const inn = M.innings[M.current];
    const batTeam = A.teamOf(inn.battingTeamId);
    const bowlTeam = A.teamOf(inn.bowlingTeamId);
    window.Match2D.setTeams(batTeam.c1, bowlTeam.c1);
  }

  const currentInnings = () => M.innings[M.current];

  /* ── BALL LOGIC ───────────────────────────────────── */
  function outcomeWeights(batter, bowler, battingEdge, freeHit){
    const d = batter.batR - bowler.bowlR + battingEdge;
    const w = { dot:.285, r1:.295, r2:.072, r3:.008, r4:.112, r6:.066, out:.058, wide:.038, noball:.008 };
    const delta = clamp(d * 0.0011, -0.055, 0.06);
    w.r4 += delta * 0.55; w.r6 += delta * 0.55; w.r1 -= delta * 0.6; w.dot -= delta * 0.4;
    w.out = clamp(w.out - d * 0.00085, .018, .115);
    if(freeHit){ w.out = 0; w.r4 += .06; w.r6 += .05; w.dot -= .09; }
    Object.keys(w).forEach(k => { if(w[k] < 0) w[k] = 0; });
    return w;
  }
  function pickWeighted(w){
    const total = Object.values(w).reduce((s,v)=>s+v,0);
    let r = Math.random()*total;
    for(const k of Object.keys(w)){ r -= w[k]; if(r <= 0) return k; }
    return 'dot';
  }
  function teamEdge(battingTeamId, bowlingTeamId){
    const A = APP();
    const xiAvg = (teamId, side) => {
      const xi = A.xiOf(side);
      return xi.reduce((s,id)=>s+A.playerOf(teamId,id).ovr,0) / Math.max(1, xi.length);
    };
    const bSide = battingTeamId === A.sideIds('team1') ? 'team1' : 'team2';
    const blSide = bSide === 'team1' ? 'team2' : 'team1';
    return clamp((xiAvg(battingTeamId, bSide) - xiAvg(bowlingTeamId, blSide)) * 0.09, -3, 3);
  }
  const strikerOf = inn => inn.batters[inn.order[inn.striker]];
  const bName = (inn, id) => APP().playerOf(inn.battingTeamId, id).name;
  function fielderName(inn){
    const A = APP();
    const candidates = A.xiOf(inn.bowlingSide).filter(id => id !== inn.bowler.id);
    const keepId = A.wkOf(inn.bowlingSide);
    if(keepId && Math.random() < 0.28) return { name: A.playerOf(inn.bowlingTeamId, keepId).name, id: keepId };
    const pick = pickOne(candidates);
    return { name: A.playerOf(inn.bowlingTeamId, pick).name, id: pick };
  }
  function howOut(inn, bowlerName, bowlerId){
    const A = APP();
    const f = fielderName(inn);
    const r = Math.random();
    if(r < .46) return { how:`c ${f.name} b ${bowlerName}`, kind:'caught', fielderId: f.id };
    if(r < .70) return { how:`b ${bowlerName}`, kind:'bowled', fielderId: null };
    if(r < .83) return { how:`lbw b ${bowlerName}`, kind:'lbw', fielderId: null };
    if(r < .92){ const wk = A.wkOf(inn.bowlingSide) || A.xiOf(inn.bowlingSide).find(id => A.playerOf(inn.bowlingTeamId, id).role === 'WK'); return { how:`st ${wk ? A.playerOf(inn.bowlingTeamId, wk).name : f.name} b ${bowlerName}`, kind:'stumped', fielderId: wk || f.id }; }
    return { how:`c & b ${bowlerName}`, kind:'c&b', fielderId: bowlerId };
  }
  const SHOT_SECTORS = [
    { x: 655, y: 225 }, { x: 800, y: 320 }, { x: 585, y: 285 },
    { x: 320, y: 285 }, { x: 175, y: 320 }, { x: 400, y: 200 }, { x: 600, y: 150 },
  ];

  // mutates the innings, returns a render/animation descriptor
  function simulateBall(inn){
    const A = APP();
    const bowlerP = A.playerOf(inn.bowlingTeamId, inn.bowler.id);
    const batter = strikerOf(inn);
    const strikerId = inn.order[inn.striker];
    const name = bName(inn, strikerId);
    const bwl = bowlerP.name;
    const weights = outcomeWeights(batter, bowlerP, teamEdge(inn.battingTeamId, inn.bowlingTeamId), inn.freeHit);
    const outcome = pickWeighted(weights);
    const isWide = outcome === 'wide';
    const isNB = outcome === 'noball';
    const legal = !isWide && !isNB;

    if(isWide || isNB){ inn.extras += 1; inn.runs += 1; inn.bowler.runs += 1; }

    let runsOffBat = 0, isWicket = false;
    let eff = outcome;
    if(isNB && eff === 'out') eff = 'dot';
    if(!isWide){
      switch(eff){
        case 'dot': runsOffBat = 0; break;
        case 'r1': runsOffBat = 1; break;
        case 'r2': runsOffBat = 2; break;
        case 'r3': runsOffBat = 3; break;
        case 'r4': runsOffBat = 4; break;
        case 'r6': runsOffBat = 6; break;
        case 'out': isWicket = true; break;
      }
    }

    if(!isWide){
      batter.balls += 1;
      batter.runs += runsOffBat;
      if(runsOffBat === 4) batter.fours += 1;
      if(runsOffBat === 6) batter.sixes += 1;
    }
    inn.runs += runsOffBat;
    inn.bowler.runs += runsOffBat;
    if(legal){ inn.legalBalls += 1; inn.bowler.legalBalls += 1; }

    const doneBefore = inn.legalBalls - (legal ? 1 : 0);
    const ballNo = (doneBefore % LEGAL_BALLS) + 1;
    const overStr = `${Math.floor(doneBefore / LEGAL_BALLS)}.${ballNo}`;

    let chip, cls, line, kind, wicketKind = null, dotType = null;
    const shotSector = pickOne(SHOT_SECTORS);

    if(isWide){
      chip='WD'; cls='wd'; kind='wide';
      line = pickOne([
        `<b>${esc(bwl)}</b> sprays it down leg — <b>wide</b>, one extra.`,
        `<b>${esc(bwl)}</b> misses his mark. <b>Wide</b> called.`,
      ]);
    } else if(isNB){
      chip='NB'; cls='nb'; kind='noball';
      line = pickOne([
        `<b>NO BALL!</b> ${esc(bwl)} oversteps — free hit next.`,
        `<b>NO BALL!</b> ${esc(bwl)} is too far down the track.`,
      ]);
      if(runsOffBat > 0) line += ` ${runsOffBat === 4 || runsOffBat === 6 ? `<b>${runsOffBat}</b> more off the bat!` : `${runsOffBat} run${runsOffBat>1?'s':''} off the bat.`}`;
    } else if(isWicket){
      chip='W'; cls='w'; kind='wicket';
      const out = howOut(inn, bwl, inn.bowler.id);
      wicketKind = out.kind;
      batter.out = true; batter.howOut = out.how;
      if(out.fielderId){
        const fEntry = inn.fielding[out.fielderId] || (inn.fielding[out.fielderId] = { ct:0, ro:0, st:0 });
        if(out.kind === 'caught' || out.kind === 'c&b') fEntry.ct += 1;
        else if(out.kind === 'stumped') fEntry.st += 1;
      }
      inn.wickets += 1; inn.bowler.wickets += 1;
      inn.fow.push({ score: inn.runs, wickets: inn.wickets, over: overStr, batter: name });
      line = pickOne([
        `<b>OUT!</b> ${esc(name)} — ${esc(out.how)}. ${esc(bwl)} strikes!`,
        `<b>WICKET!</b> ${esc(name)} departs — ${esc(out.how)}. Huge moment!`,
        `<b>GONE!</b> ${esc(out.how)}. ${esc(name)} has to go.`,
      ]);
    } else if(runsOffBat === 0){
      chip='0'; cls='b0'; kind='dot';
      dotType = Math.random() < .4 ? 'leave' : 'beaten';
      line = dotType === 'leave'
        ? pickOne([`<b>${esc(bwl)}</b> to ${esc(name)} — good ball, left alone.`, `<b>${esc(name)}</b> leaves it outside off. No run.`])
        : pickOne([
            `<b>${esc(bwl)}</b> nails the block hole. Dot ball.`,
            `<b>${esc(name)}</b> beaten through the air — dot ball.`,
            `<b>${esc(name)}</b> can't free his arms. Solid from ${esc(bwl)}.`,
          ]);
    } else if(runsOffBat === 1){
      chip='1'; cls=''; kind='run';
      line = pickOne([`<b>${esc(name)}</b> nudges to leg for a single.`, `Worked into the gap — one run.`, `<b>${esc(name)}</b> pushes a quick single.`]);
    } else if(runsOffBat === 2){
      chip='2'; cls=''; kind='run';
      line = pickOne([`<b>${esc(name)}</b> threads it past midwicket — two runs.`, `Good running — they come back for the second.`]);
    } else if(runsOffBat === 3){
      chip='3'; cls=''; kind='run';
      line = `<b>${esc(name)}</b> — placed into the gap! Three runs.`;
    } else if(runsOffBat === 4){
      chip='4'; cls='b4'; kind='four';
      line = pickOne([`<b>FOUR!</b> ${esc(name)} flays it through the covers!`, `<b>CRACKED FOR FOUR!</b> ${esc(name)} times it to perfection.`, `<b>FOUR more!</b> ${esc(bwl)} punished by ${esc(name)}.`]);
    } else {
      chip='6'; cls='b6'; kind='six';
      line = pickOne([`<b>SIX!</b> ${esc(name)} launches it into the second tier!`, `<b>MASSIVE!</b> That's out of here — ${esc(name)}.`, `<b>SIX runs!</b> ${esc(bwl)} disappears from the attack.`]);
    }

    inn.overLog.push({ chip, cls });

    // strike rotation
    if(isWicket){
      if(inn.nextIn < inn.order.length){ inn.striker = inn.nextIn; inn.nextIn += 1; }
    } else if(runsOffBat % 2 === 1){
      const t = inn.striker; inn.striker = inn.nonStriker; inn.nonStriker = t;
    }
    inn.freeHit = isNB;

    // tiny sub text for the canvas popup
    let subText = '';
    if(isWicket) subText = `${name} — ${inn.wickets}/${M.maxWickets} down`;
    else if(kind === 'four' || kind === 'six') subText = `${name}  ·  ${batter.runs}${runsOffBat === 6 ? ' (6)' : ''}`;

    return {
      outcome, chip, cls, kind, wicketKind, dotType, shotSector, subText,
      runsOffBat, isWicket, isWide, isNoBall: isNB, legal, overStr,
      line,
      commentKind: isWicket ? 'wicket' : (runsOffBat >= 6 ? 'big' : (runsOffBat === 4 ? 'highlight' : '')),
    };
  }
  function commitBall(inn, result){
    // sfx + commentary + over log strip re-render
    if(result.isWicket) sfx.wicket(result.wicketKind);
    else if(result.runsOffBat === 6) sfx.six();
    else if(result.runsOffBat === 4) sfx.four();
    else if(result.isWide) sfx.wide();
    else if(result.isNoBall) sfx.noball();
    else if(result.runsOffBat > 0) sfx.run(result.runsOffBat);
    else sfx.dot();
    if(window.IPLCommentary) window.IPLCommentary.play(window.IPLCommentary.categoryFor(result), { delayMs: 120 });
    addComment(M.current, result.overStr, result.line, result.commentKind);
    renderLive();
  }
  const overEndSwap = inn => { const t = inn.striker; inn.striker = inn.nonStriker; inn.nonStriker = t; };
  function checkInningsEnd(inn){
    if(inn.wickets >= M.maxWickets) return true;
    if(inn.legalBalls >= LEGAL_BALLS) return true;
    if(M.current === 1 && M.target !== null && inn.runs >= M.target) return true;
    return false;
  }
  function endFirstInnings(){
    sfx.inningsBreak();
    if(window.IPLMusic) window.IPLMusic.setSituation('break');
    const A = APP();
    const inn1 = M.innings[0];
    M.current = 1;
    M.target = inn1.runs + 1;
    M.phase = 'break';
    const t1 = A.teamOf(M.innings[0].battingTeamId), t2 = A.teamOf(M.innings[1].battingTeamId);
    if(window.IPLCommentary){
      const inningsMsg = `End of the first innings. ${t1.name} finish on ${inn1.runs} for ${inn1.wickets} from ${inn1.legalBalls} balls. ${t2.name} need ${M.target} to win from one over. Required rate, ${inn1.runs + 1} an over.`;
      const ok = window.IPLCommentary.announce ? window.IPLCommentary.announce(inningsMsg, { delayMs: 700 }) : false;
      if(!ok) window.IPLCommentary.play('inningsbreak', { delayMs: 600, priority: true });
    }
    addComment(0, null, `<b>Innings complete.</b> ${esc(t1.name)} finish on <b>${inn1.runs}/${inn1.wickets}</b> off ${inn1.legalBalls} balls${A.state.mode==='showdown' ? ' (2 wickets — showdown rules)' : ''}.`, 'highlight');
    addComment(1, null, `<b>INNINGS BREAK.</b> ${esc(t2.name)} need <b>${M.target}</b> off one over.`, 'highlight');
    setCanvasTeamColors();
    renderAll();
    timer = setTimeout(() => { M.phase = 'live'; renderLive(); playNextBall(); }, INNINGS_BREAK);
  }
  function playNextBall(){
    if(!M || M.phase !== 'live') return;
    const inn = currentInnings();
    const result = simulateBall(inn);
    // hand choreography to the 2D game, commit visuals on settle
    M.phase = 'anim';
    if(window.Match2D){
      window.Match2D.playDelivery(result, () => {
        if(!M || M.phase !== 'anim') return;   // a Sim-to-End / reset may have raced us
        commitBall(inn, result);
        if(checkInningsEnd(inn)){
          inn.completed = true;
          if(M.current === 0){ endFirstInnings(); return; }
          finishMatch();
          return;
        }
        if(inn.legalBalls > 0 && inn.legalBalls % LEGAL_BALLS === 0) overEndSwap(inn);
        M.phase = 'live';
        timer = setTimeout(playNextBall, BALL_RECOVER);
      });
    } else {
      commitBall(inn, result);
      if(checkInningsEnd(inn)){
        inn.completed = true;
        if(M.current === 0){ endFirstInnings(); return; }
        finishMatch();
        return;
      }
      if(inn.legalBalls > 0 && inn.legalBalls % LEGAL_BALLS === 0) overEndSwap(inn);
      timer = setTimeout(playNextBall, 1600);
    }
  }
  function finishMatch(){
    const A = APP();
    const [i1, i2] = M.innings;
    M.phase = 'done';
    const t1 = A.teamOf(i1.battingTeamId), t2 = A.teamOf(i2.battingTeamId);
    // IPL 2026 Championship — capture the played match into the season
    let champ = null;
    if(A.state.mode === 'tournament' && window.IPLMatchChamp && window.IPLMatchChamp.finish){
      try { champ = window.IPLMatchChamp.finish(M) || null; } catch(e){ console.warn('Championship capture failed', e); }
    }
    let kicker, title, sub;
    if(champ){
      kicker = champ.kicker; title = champ.title; sub = champ.sub; M.winner = champ.winner;
    } else if(i2.runs >= M.target){
      const wktsLeft = M.maxWickets - i2.wickets;
      const ballsLeft = LEGAL_BALLS - i2.legalBalls;
      kicker = 'Match Result';
      title = `${t2.name} win by ${wktsLeft} wicket${wktsLeft===1?'':'s'}`;
      sub = `${t2.short} chased ${M.target} with ${ballsLeft} ball${ballsLeft===1?'':'s'} to spare.`;
      M.winner = i2.battingTeamId;
    } else if(i2.runs === i1.runs){
      kicker = 'Match Result';
      title = 'Match Tied';
      sub = `Scores level at ${i1.runs} apiece after one over each — an absolute thriller.`;
      M.winner = null;
    } else {
      const margin = i1.runs - i2.runs;
      kicker = 'Match Result';
      title = `${t1.name} win by ${margin} run${margin===1?'':'s'}`;
      sub = `${t1.short} defended ${i1.runs}. ${t2.short} finished on ${i2.runs}/${i2.wickets}.`;
      M.winner = i1.battingTeamId;
    }
    const potmPool = [i1, i2].flatMap(inn => Object.values(inn.batters).map(b => ({ ...b, team: inn.battingTeamId })));
    potmPool.sort((a,b) => b.runs - a.runs || b.sixes - a.sixes || b.fours - a.fours);
    const potm = potmPool[0];
    const potmP = potm ? A.playerOf(potm.team, potm.id) : null;
    M.result = { kicker, title, sub, potmName: potmP ? potmP.name : '', potmRuns: potm ? potm.runs : 0 };
    addComment(1, null, `<b>${esc(title)}.</b> ${esc(sub)}`, 'highlight');
    renderAll();
    showResultBanner(kicker, title, sub + (potmP ? ` Player of the Match: ${potmP.name} (${potm.runs} runs).` : ''), champ);
    if(window.Match2D) window.Match2D.showBanner(M.winner ? `${(M.winner===i1.battingTeamId?t1:t2).short} WIN!` : 'MATCH TIED', title);
    fireConfetti();
    if(M.winner){ sfx.win(); if(window.IPLSFX && window.IPLSFX.reward) window.IPLSFX.reward(); }
    else sfx.tie();
    if(window.IPLMusic) window.IPLMusic.setSituation(M.winner ? 'win' : 'tie');
    if(window.IPLCommentary){
      const rc = M.result || {};
      const resultMsg = M.winner
        ? `The result. ${rc.title}. Player of the match, ${rc.potmName} with ${rc.potmRuns} runs.`
        : `The result. ${rc.title || 'Match tied'}. Scores level after one over a side.`;
      const ok = window.IPLCommentary.announce ? window.IPLCommentary.announce(resultMsg, { delayMs: 1100 }) : false;
      if(!ok) window.IPLCommentary.play(M.winner ? 'win' : 'tie', { delayMs: 900, priority: true });
    }
    if(window.IPLSFX) setTimeout(() => { if(window.IPLSFX) window.IPLSFX.stopAmbience(1800); }, 2400);
  }
  function showResultBanner(kicker, title, sub, champ){
    $('#rbKicker').textContent = kicker;
    $('#rbTitle').textContent = title;
    $('#rbSub').textContent = sub;
    const rematchBtn = $('#rematchBtn'), newSelBtn = $('#newSelectionBtn'), champBtn = $('#champResultBtn');
    if(champ){
      if(rematchBtn) rematchBtn.style.display = 'none';
      if(newSelBtn) newSelBtn.style.display = 'none';
      if(champBtn){
        champBtn.style.display = '';
        champBtn.innerHTML = `${esc(champ.buttonLabel || 'Back to the season hub')} <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
      }
    } else {
      if(rematchBtn) rematchBtn.style.display = '';
      if(newSelBtn) newSelBtn.style.display = '';
      if(champBtn) champBtn.style.display = 'none';
    }
    $('#resultBanner').classList.add('show');
    $('#simEndBtn').disabled = true;
    $('#liveDot').style.visibility = 'hidden';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ── RENDERING ─────────────────────────────────────── */
  const fmtOvers = balls => `${Math.floor(balls/6)}.${balls%6}`;
  const teamScore = inn => `${inn.runs}/${inn.wickets}`;
  function addComment(inningsIdx, overStr, html, kind){
    M.log.push({ inningsIdx, overStr, html, kind });
    appendCommentLine(M.log[M.log.length-1]);
  }
  function appendCommentLine(entry){
    const feed = $('#commentary');
    if(!feed) return;
    const div = document.createElement('div');
    div.className = 'comm-line' + (entry.kind ? ' ' + entry.kind : '');
    div.innerHTML = `<div class="comm-over">${entry.overStr ? esc(entry.overStr) : (entry.inningsIdx===0?'INN 1':'INN 2')}</div><div class="comm-text">${entry.html}</div>`;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  }
  function renderCommentaryAll(){
    const feed = $('#commentary');
    if(!feed) return;
    feed.innerHTML = '';
    M.log.forEach(appendCommentLine);
  }
  function battingRows(inn){
    const A = APP(); const tid = inn.battingTeamId;
    return inn.order.filter(id => inn.batters[id].balls > 0 || inn.batters[id].out).map(id => {
      const b = inn.batters[id]; const p = A.playerOf(tid, id);
      const sr = b.balls ? Math.round(b.runs / b.balls * 100) : 0;
      const isStriker = id === inn.order[inn.striker];
      const star = (isStriker && !b.out) ? ' *' : '';
      return `<tr class="${b.out?'out':''}"><td>${esc(p.name)}${star}</td><td>${esc(b.howOut)}</td><td>${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${sr}</td></tr>`;
    }).join('');
  }
  function bowlingRows(inn){
    const A = APP(); const tid = inn.bowlingTeamId; const b = inn.bowler; const p = A.playerOf(tid, b.id);
    const econ = b.legalBalls ? (b.runs / b.legalBalls * 6).toFixed(2) : '0.00';
    return `<tr><td>${esc(p.name)}</td><td>${fmtOvers(b.legalBalls)}</td><td>${b.runs}</td><td>${b.wickets}</td><td>${econ}</td></tr>`;
  }
  function renderScorecard(){
    const activeTab = $('.sc-tab.active')?.getAttribute('data-inning') || '0';
    $('#scTab1').textContent = `Innings 1 · ${APP().teamOf(M.innings[0].battingTeamId).short}`;
    $('#scTab2').textContent = `Innings 2 · ${APP().teamOf(M.innings[1].battingTeamId).short}`;
    const inn = M.innings[+activeTab];
    const body = $('#scorecardBody');
    if(!inn){ body.innerHTML = '<div class="xi-empty">Yet to bat.</div>'; return; }
    const t = APP().teamOf(inn.battingTeamId);
    body.innerHTML = `
      <div style="font-size:11px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">${esc(t.name)} — Batting</div>
      <table class="sc-table"><thead><tr><th>Batter</th><th>Dismissal</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead>
        <tbody>${battingRows(inn) || '<tr><td colspan="7" style="color:var(--dim2)">Yet to face a ball.</td></tr>'}
          <tr class="tot-row"><td colspan="2">Total (${inn.legalBalls} balls · extras ${inn.extras}) — max ${M.maxWickets} wkts</td><td>${inn.runs}/${inn.wickets}</td><td colspan="4"></td></tr>
        </tbody></table>
      <div style="font-size:11px;color:var(--dim);letter-spacing:.12em;text-transform:uppercase;margin:14px 0 8px">${esc(APP().teamOf(inn.bowlingTeamId).name)} — Bowling</div>
      <table class="sc-table"><thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
        <tbody>${bowlingRows(inn)}</tbody></table>
      ${inn.fow.length ? `<div style="font-size:10px;color:var(--dim2);margin-top:12px;line-height:1.8"><b style="color:var(--dim)">Fall of wickets:</b> ${inn.fow.map(f=>`${f.score}/${f.wickets} (${esc(f.batter)}, ${esc(f.over)})`).join(' · ')}</div>` : ''}`;
  }
  function pushHud(){
    if(!window.Match2D || !window.Match2D.setHud || !M) return;
    const A = APP();
    const inn = M.innings[M.current];
    if(!inn) return;
    const strikerId = inn.order[inn.striker];
    const sp = A.playerOf(inn.battingTeamId, strikerId);
    const sb = inn.batters[strikerId];
    const sr = sb && sb.balls ? Math.round(sb.runs / sb.balls * 100) : 0;
    const bp = A.playerOf(inn.bowlingTeamId, inn.bowler.id);
    const bowlerOvers = `${Math.floor(inn.bowler.legalBalls / 6)}.${inn.bowler.legalBalls % 6}`;
    const bowlInn = M.innings[M.current === 0 ? 1 : 0];
    const bowlDone = M.current === 1 || bowlInn.legalBalls > 0 || bowlInn.runs > 0;
    window.Match2D.setHud({
      batId: inn.battingTeamId, bowlId: inn.bowlingTeamId,
      batScore: `${inn.runs}/${inn.wickets} · ${Math.floor(inn.legalBalls / 6)}.${inn.legalBalls % 6} OV`,
      bowlScore: bowlDone ? `${bowlInn.runs}/${bowlInn.wickets} · ${Math.floor(bowlInn.legalBalls / 6)}.${bowlInn.legalBalls % 6} OV` : 'YET TO BAT',
      striker: sp ? { player: sp, stat: `${sb.runs} (${sb.balls}) · SR ${sr}` } : null,
      bowler: bp ? { player: bp, stat: `${inn.bowler.wickets}/${inn.bowler.runs} · ${bowlerOvers} OV` } : null,
      needText: M.current === 1 && M.target
        ? (Math.max(0, M.target - inn.runs) > 0
            ? `NEED ${Math.max(0, M.target - inn.runs)} OFF ${Math.max(0, 6 - inn.legalBalls)} · RRR ${(Math.max(0, M.target - inn.runs) / Math.max(1, 6 - inn.legalBalls) * 6).toFixed(1)}`
            : 'TARGET ACHIEVED')
        : null,
    });
  }
  function renderLive(){
    pushHud();
    if(!M) return;
    const A = APP();
    const inn = currentInnings();
    [0,1].forEach(i => {
      const elx = $(i===0 ? '#sbTeam1' : '#sbTeam2');
      const shown = M.innings[i];
      const team = A.teamOf(shown.battingTeamId);
      elx.classList.toggle('batting', shown.battingSide === inn.battingSide && M.phase !== 'done');
      elx.innerHTML = `${A.crestSVG(team)}<div class="snm" style="color:${team.c1}">${esc(team.short)}</div>
        <div class="sb-score">${teamScore(shown)}</div>
        <div class="sb-balls">${fmtOvers(shown.legalBalls)} ov · ${shown.legalBalls} ball${shown.legalBalls===1?'':'s'} · max ${M.maxWickets}w</div>`;
    });
    $('#overInfo').textContent = `INNINGS ${M.current+1}/2 · ${fmtOvers(inn.legalBalls)} OV`;
    // adaptive scoreboard music: tense chase → intense track, else gameplay
    if(window.IPLMusic && M.phase !== 'done'){
      if(M.current === 1 && M.target !== null){
        const ballsLeft = Math.max(0, LEGAL_BALLS - inn.legalBalls);
        const need = Math.max(0, M.target - inn.runs);
        const rrr = ballsLeft > 0 ? (need / ballsLeft) * 6 : 99;
        window.IPLMusic.setSituation((ballsLeft > 0 && (ballsLeft <= 3 || rrr >= 9)) ? 'intense' : 'match');
      } else {
        window.IPLMusic.setSituation('match');
      }
    }
    const tgt = $('#targetChip');
    if(M.target !== null && M.current === 1){
      const need = M.target - inn.runs;
      tgt.style.display = '';
      tgt.textContent = M.phase==='done'
        ? `Target ${M.target}`
        : (need > 0 ? `Need ${need} off ${LEGAL_BALLS - inn.legalBalls} ball${LEGAL_BALLS - inn.legalBalls===1?'':'s'}` : 'Target achieved!');
    } else tgt.style.display = 'none';
    const rrrEl = $('#rrrLine');
    if(rrrEl){
      if(M.target !== null && M.current === 1 && M.phase !== 'done'){
        const need = Math.max(0, M.target - inn.runs);
        const ballsLeft = Math.max(0, LEGAL_BALLS - inn.legalBalls);
        const rrr = ballsLeft > 0 ? (need / ballsLeft * 6).toFixed(1) : '—';
        rrrEl.style.display = '';
        const v = rrrEl.querySelector('.rrr-value'); if(v) v.textContent = rrr;
      } else {
        rrrEl.style.display = 'none';
      }
    }

    const tid = inn.battingTeamId, btid = inn.bowlingTeamId;
    $('#batTeamLbl').textContent = A.teamOf(tid).short;
    $('#bowlTeamLbl').textContent = A.teamOf(btid).short;
    const strikerId = inn.order[inn.striker], nonId = inn.order[inn.nonStriker];
    $('#batLines').innerHTML = [strikerId, nonId].map(id => {
      const b = inn.batters[id]; const p = A.playerOf(tid, id);
      return `<div class="bat-line${id===strikerId?' striker':''}"><span>${id===strikerId?'▸ ':''}${esc(p.name)}</span><span class="figs">${b.runs} (${b.balls})</span></div>`;
    }).join('');
    const bp = A.playerOf(btid, inn.bowler.id);
    $('#bowlLines').innerHTML = `<div class="bowl-line"><div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(bp.name)}</span><span class="figs">${inn.bowler.wickets}/${inn.bowler.runs}</span></div>
      <div style="font-size:10px;color:var(--dim);margin-top:4px">${esc(bp.bowl)} · ${fmtOvers(inn.bowler.legalBalls)} ov · ${inn.bowler.wickets} wkt${inn.bowler.wickets===1?'':'s'}</div></div>`;

    $('#ballsStrip').innerHTML = inn.overLog.slice(-12).map(b => `<span class="ball ${esc(b.cls)}">${esc(b.chip)}</span>`).join('');
    renderScorecard();
  }
  function renderAll(){
    if(!M) return;
    $('#commentary').innerHTML = '';
    renderCommentaryAll();
    renderLive();
    if(M.phase !== 'done'){
      $('#resultBanner').classList.remove('show');
      $('#simEndBtn').disabled = false;
      $('#liveDot').style.visibility = '';
    }
  }

  /* ── CONFETTI ──────────────────────────────────────── */
  function fireConfetti(){
    const canvas = $('#confetti');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ['#f5c518','#ffffff','#38bdf8','#ef4444','#22c55e','#a78bfa'];
    const rnd = (a,b) => a + Math.random()*(b-a);
    const parts = Array.from({length:170}, () => ({
      x: Math.random()*canvas.width, y: -30 - Math.random()*canvas.height*0.4,
      w: rnd(5,11), h: rnd(8,16), vy: rnd(1.3,3.4), vx: rnd(-1.4,1.4),
      rot: rnd(0,Math.PI), vr: rnd(-.08,.08), color: colors[Math.floor(Math.random()*colors.length)],
    }));
    let frames = 0;
    (function tick(){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      parts.forEach(p => {
        p.y += p.vy; p.x += p.vx + Math.sin((p.y + p.rot*40)*.02); p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
      });
      frames++;
      if(frames < 560) requestAnimationFrame(tick); else ctx.clearRect(0,0,canvas.width,canvas.height);
    })();
  }

  /* ── SIM TO END ────────────────────────────────────── */
  function simToEnd(){
    if(!M) return;
    clearTimeout(timer); timer = null;
    const A = APP();
    let guard = 400;
    while(M.phase !== 'done' && guard-- > 0){
      const inn = currentInnings();
      if(inn.completed){
        if(M.current === 0){ endFirstInningsSimulated(); continue; }
        break;
      }
      const result = simulateBall(inn);
      // silent commit (commentary only, no animation)
      addComment(M.current, result.overStr, result.line, result.commentKind);
      if(checkInningsEnd(inn)){
        inn.completed = true;
        if(M.current === 0){
          addComment(0, null, `<b>Innings complete.</b> ${esc(A.teamOf(inn.battingTeamId).name)} finish on <b>${inn.runs}/${inn.wickets}</b>.`, 'highlight');
          endFirstInningsSimulated();
        } else {
          finishMatch();   // sets phase done, banner, confetti, canvas banner
        }
      } else if(inn.legalBalls > 0 && inn.legalBalls % LEGAL_BALLS === 0){ overEndSwap(inn); }
    }
    renderAll();
  }
  function endFirstInningsSimulated(){
    const A = APP();
    const inn1 = M.innings[0];
    M.current = 1;
    M.target = inn1.runs + 1;
    M.phase = 'live';
    const bt1 = A.teamOf(M.innings[0].battingTeamId), bt2 = A.teamOf(M.innings[1].battingTeamId);
    if(window.IPLCommentary){
      const inningsMsg = `End of the first innings. ${bt1.name} finish on ${inn1.runs} for ${inn1.wickets} from ${inn1.legalBalls} balls. ${bt2.name} need ${M.target} to win from one over. Required rate, ${M.target} an over.`;
      const ok = window.IPLCommentary.announce ? window.IPLCommentary.announce(inningsMsg, { delayMs: 500 }) : false;
      if(!ok) window.IPLCommentary.play('inningsbreak', { delayMs: 400, priority: true });
    }
    setCanvasTeamColors();
    addComment(1, null, `<b>INNINGS BREAK.</b> ${esc(A.teamOf(M.innings[1].battingTeamId).name)} need <b>${M.target}</b> off one over.`, 'highlight');
  }

  /* ── CONTROLS ──────────────────────────────────────── */
  function init(){
    $$('.sc-tab').forEach(tab => tab.addEventListener('click', () => {
      $$('.sc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if(M) renderScorecard();
    }));
    $('#simEndBtn').addEventListener('click', () => { simToEnd(); });

    const soundBtn = $('#soundToggleBtn');
    const syncSoundLabel = () => {
      soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
      soundBtn.innerHTML = soundOn
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg> Sound On`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg> Sound Off`;
    };
    soundBtn.addEventListener('click', () => {
      soundOn = !soundOn;
      if(window.IPLSFX) window.IPLSFX.setEnabled(soundOn);
      else { try{ localStorage.setItem('ipl2026-sound', soundOn ? 'on' : 'off'); }catch(e){} }
      syncSoundLabel();
    });
    syncSoundLabel();

    $('#rematchBtn').addEventListener('click', () => {
      abort();
      const A = APP();
      A.state.toss = { spun:false, winnerId:null, choice:null };
      A.state.teamsLocked = false;
      A.saveState();
      $('#resultBanner').classList.remove('show');
      A.goto('toss');
    });
    $('#newSelectionBtn').addEventListener('click', () => {
      try{ localStorage.removeItem('ipl2026-state-v1'); }catch(e){}
      window.location.reload();
    });
    $('#champResultBtn').addEventListener('click', () => {
      abort();
      $('#resultBanner').classList.remove('show');
      if(window.IPLMatchChamp && window.IPLMatchChamp.returnToHub) window.IPLMatchChamp.returnToHub();
      else APP().goto('season');
    });
  }
  document.addEventListener('DOMContentLoaded', init);

  return { ensureMatch, abort };
})();
