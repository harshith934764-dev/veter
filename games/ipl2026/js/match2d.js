/* ============================================================
   IPL 2026 — 2D CRICKET GAME (broadcast-camera canvas engine)
   Animated AI vs AI deliveries: run-up, flight, bounce, bat
   swing, stumps / catches / boundaries. Rating results from
   the match engine drive the choreography.
   ============================================================ */
'use strict';

window.Match2D = (function(){
  const W = 960, H = 600;
  let canvas = null, ctx = null;
  let raf = null;
  let particles = [];
  let popup = null;             // {text, sub, color, t0}
  let scene = 'idle';           // idle | delivery | done
  let delivery = null;          // animation descriptor while a ball is playing
  let stumpsFallen = false;
  let teamColors = { bat:'#38bdf8', bowl:'#f5c518' };
  let crowdDots = [];
  let idleT0 = 0;

  /* ── helpers ─────────────────────────────────────── */
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const lerp = (a,b,t)=>a+(b-a)*t;
  const easeOut = t=>1-Math.pow(1-t,3);
  const easeIn = t=>t*t*t;
  const easeInOut = t=>t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
  const quad = (p0,p1,p2,t)=>({
    x:(1-t)*(1-t)*p0.x + 2*(1-t)*t*p1.x + t*t*p2.x,
    y:(1-t)*(1-t)*p0.y + 2*(1-t)*t*p1.y + t*t*p2.y,
  });
  function roundedRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }
  function circle(x,y,r){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.closePath(); }
  function fillCircle(x,y,r,fill){ ctx.fillStyle = fill; circle(x,y,r); ctx.fill(); }

  /* ── seeded crowd dots (generated once) ───────────── */
  function buildCrowd(){
    crowdDots = [];
    let seed = 2026;
    const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    for(let i=0;i<430;i++){
      crowdDots.push({
        x: 40 + rand()*880,
        y: 18 + rand()*128,
        r: .6 + rand()*1.7,
        c: ['#3b4a75','#54457a','#715c2a','#2f5a6e','#6e2f3f','#485a3a'][Math.floor(rand()*6)],
        a: .35 + rand()*.5
      });
    }
  }

  /* ── geometry (broadcast view, pitch vertical) ────── */
  const GEO = {
    farStumps:  { x: 480, y: 202 },
    striker:    { x: 503, y: 234 },
    keeper:     { x: 480, y: 186 },
    nearStumps: { x: 480, y: 436 },
    nonStriker: { x: 452, y: 420 },
    bowlerHome: { x: 480, y: 545 },
    bowlerCrease:{ x: 480, y: 405 },
    release:    { x: 466, y: 392 },
    bounce:     { x: 487, y: 266 },
    batContact: { x: 491, y: 244 },
    boundaryY:  192,         // rope line (top / far edge, just inside the outfield)
    ropeLeft:   28, ropeRight: 932,
  };
  const FIELDERS = [
    { x: 552, y: 196, s: .58, name:'slip' },
    { x: 400, y: 196, s: .58, name:'gullyleg' },
    { x: 700, y: 200, s: .6,  name:'third' },
    { x: 250, y: 200, s: .6,  name:'fineleg' },
    { x: 668, y: 252, s: .7,  name:'cover' },
    { x: 800, y: 336, s: .78, name:'point' },
    { x: 575, y: 296, s: .85, name:'midoff' },
    { x: 320, y: 296, s: .85, name:'midon' },
    { x: 168, y: 330, s: .8,  name:'squareleg' },
    { x: 676, y: 228, s: .58, name:'longoff' },
    { x: 268, y: 228, s: .58, name:'longon' },
  ];
  // shot sectors for run-scoring balls: direction the ball is sent
  const SHOT_SECTORS = [
    { x: 655, y: 225 },  // cover
    { x: 800, y: 320 },  // point
    { x: 585, y: 285 },  // mid-off
    { x: 320, y: 285 },  // mid-on
    { x: 175, y: 320 },  // square leg
    { x: 400, y: 210 },  // glance behind
    { x: 600, y: 205 },  // loft toward long-off (but kept inside for 1-3)
  ];

  /* ── scene painting ───────────────────────────────── */
  function drawSky(){
    const g = ctx.createLinearGradient(0,0,0,150);
    g.addColorStop(0,'#050a1c');
    g.addColorStop(.55,'#0d1730');
    g.addColorStop(1,'#18264a');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,150);
  }
  function drawFloodlights(){
    const tower = (x, flip) => {
      ctx.strokeStyle = '#232f4f'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(x, 165); ctx.lineTo(x + (flip?-16:16), 26); ctx.stroke();
      // light head
      ctx.fillStyle = '#2c3a5f';
      roundedRect(x + (flip?-58:-8), 8, 66, 20, 4); ctx.fill();
      for(let i=0;i<4;i++){
        ctx.fillStyle = '#fdf6d8';
        circle(x + (flip?-48:2) + i*15, 18, 3.4); ctx.fill();
      }
      // glow
      const gx = x + (flip?-25:25);
      const glow = ctx.createRadialGradient(gx, 22, 4, gx, 22, 150);
      glow.addColorStop(0, 'rgba(255,250,214,.34)');
      glow.addColorStop(1, 'rgba(255,250,214,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0,0,W,190);
    };
    tower(120, false);
    tower(840, true);
  }
  function drawStands(){
    const g = ctx.createLinearGradient(0,30,0,152);
    g.addColorStop(0,'#131c36');
    g.addColorStop(1,'#0b1226');
    ctx.fillStyle = g;
    ctx.fillRect(0, 32, W, 120);
    // crowd speckle
    crowdDots.forEach(d => {
      ctx.globalAlpha = d.a;
      ctx.fillStyle = d.c;
      circle(d.x, d.y, d.r); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // stand rail
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(0, 146, W, 5);
  }
  function drawAdBoards(){
    ctx.fillStyle = '#0a1024';
    ctx.fillRect(0, 150, W, 26);
    ctx.fillStyle = 'rgba(245,197,24,.85)';
    ctx.font = "800 12px 'Segoe UI', sans-serif";
    ctx.textBaseline = 'middle';
    const msg = 'IPL 2026  •  PLAYING XI SIMULATOR  •  ';
    let x = 8;
    while(x < W){ ctx.fillText(msg, x, 164); x += ctx.measureText(msg).width + 24; }
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(0, 174, W, 3);
  }
  function drawOutfield(){
    const g = ctx.createLinearGradient(0, 180, 0, H);
    g.addColorStop(0, '#175427');
    g.addColorStop(.5, '#1c6b31');
    g.addColorStop(1, '#14502a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 180, W, H-180);
    // mow stripes (vertical bands, perspective-ish)
    ctx.globalAlpha = .12;
    for(let i=0;i<10;i++){
      if(i%2===0) continue;
      const x0 = i*96;
      ctx.fillStyle = i%4===1 ? '#ffffff' : '#000000';
      ctx.beginPath();
      ctx.moveTo(x0+40, 180); ctx.lineTo(x0+56, 180);
      ctx.lineTo(x0+96, H); ctx.lineTo(x0, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // boundary rope (inset ring)
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    roundedRect(GEO.ropeLeft - 14, GEO.boundaryY - 8, GEO.ropeRight - GEO.ropeLeft + 28, H - GEO.boundaryY - 4, 26);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawPitch(){
    // trapezoid pitch (wider at bottom = nearer camera)
    const nearW = 132, farW = 84, top = GEO.farStumps.y - 10, bot = GEO.nearStumps.y + 18;
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, '#c9b37a');
    g.addColorStop(.5, '#b8a067');
    g.addColorStop(1, '#cdb87f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(480 - farW/2, top); ctx.lineTo(480 + farW/2, top);
    ctx.lineTo(480 + nearW/2, bot); ctx.lineTo(480 - nearW/2, bot);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90,70,30,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    // worn middle
    ctx.fillStyle = 'rgba(120,95,55,.35)';
    ctx.fillRect(474, top+24, 12, bot-top-48);
    // crease lines
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(436, GEO.farStumps.y + 16); ctx.lineTo(524, GEO.farStumps.y + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(430, GEO.nearStumps.y - 14); ctx.lineTo(530, GEO.nearStumps.y - 14); ctx.stroke();
    // stumps
    drawStumps();
  }
  function drawStumps(){
    if(stumpsFallen) return;
    const { x, y } = GEO.farStumps;
    ctx.strokeStyle = '#f3e9c8'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for(let i=-1;i<=1;i++){
      ctx.beginPath(); ctx.moveTo(x + i*5, y + 2); ctx.lineTo(x + i*5, y - 22); ctx.stroke();
    }
    // bails
    ctx.strokeStyle = '#e8d88f'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x-7, y-23.5); ctx.lineTo(x+7, y-23.5); ctx.stroke();
  }

  /* ── figures ─────────────────────────────────────── */
  function drawFigure(x, y, scale, kit, opts){
    // opts: {crouch, swing, runPhase, facing (1 down-screen / -1), bat}
    const o = opts || {};
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(0, 2, 15, 4.6, 0, 0, Math.PI*2); ctx.fill();
    const legSwing = o.runPhase != null ? Math.sin(o.runPhase) * 7 : 0;
    // legs
    ctx.strokeStyle = kit.legs; ctx.lineWidth = 5; ctx.lineCap='round';
    if(o.crouch){
      ctx.beginPath(); ctx.moveTo(-4,-12); ctx.lineTo(-10,0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4,-12); ctx.lineTo(10,0); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-3,-12); ctx.lineTo(-6 - legSwing, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3,-12); ctx.lineTo(6 + legSwing, 0); ctx.stroke();
    }
    // torso
    const tg = ctx.createLinearGradient(0,-30,0,-10);
    tg.addColorStop(0, kit.torsoHi); tg.addColorStop(1, kit.torso);
    ctx.fillStyle = tg;
    roundedRect(-7.5, -31, 15, 20, 5); ctx.fill();
    // arms
    ctx.strokeStyle = kit.torso; ctx.lineWidth = 4;
    const swing = o.swing || 0; // 0 neutral, 1 mid-swing
    if(o.bat){
      // batting stance / swing
      const ang = lerp(-0.6, 1.5, swing);
      ctx.beginPath(); ctx.moveTo(-5,-26); ctx.lineTo(-9,-17); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5,-26); ctx.lineTo(9,-18); ctx.stroke();
      // bat
      ctx.save();
      ctx.translate(9,-18);
      ctx.rotate(ang);
      ctx.strokeStyle = '#8a6a3b'; ctx.lineWidth = 4.6;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-19); ctx.stroke();
      ctx.strokeStyle = '#d8c28a'; ctx.lineWidth = 5.4;
      ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(0,-21); ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.moveTo(-5,-26); ctx.lineTo(-8,-15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5,-26); ctx.lineTo(8,-15); ctx.stroke();
    }
    // head (helmet for batter/keeper)
    ctx.fillStyle = kit.head;
    circle(0, -38, 6.4); ctx.fill();
    if(kit.helmet){
      ctx.fillStyle = kit.helmet;
      ctx.beginPath(); ctx.arc(0, -39.5, 6.6, Math.PI*1.02, Math.PI*1.98); ctx.fill();
      ctx.fillRect(-6.6, -40.5, 13.2, 2);
    }
    ctx.restore();
  }
  function kitFor(primary, secondary){
    return { torso: primary, torsoHi: secondary, legs: '#0e1424', head: '#2a1f14', helmet: secondary };
  }

  function drawFielders(t){
    FIELDERS.forEach(f => {
      const kit = kitFor(teamColors.bowl, '#1b2338');
      // slight idle sway
      drawFigure(f.x, f.y, f.s * 1.18, kit, { runPhase: Math.sin(t*0.0016 + f.x) * 0.4 });
    });
  }
  function drawBatters(t, swing){
    const kit = kitFor(teamColors.bat, '#101828');
    // striker
    drawFigure(GEO.striker.x, GEO.striker.y, 1.02, kit, { bat: true, swing });
    // non-striker
    drawFigure(GEO.nonStriker.x, GEO.nonStriker.y, 1.15, kit, { runPhase: Math.sin(t*0.0012)*0.15 });
    // keeper (bowling side kit)
    const kkit = kitFor(teamColors.bowl, '#101828');
    drawFigure(GEO.keeper.x, GEO.keeper.y, .8, kkit, { crouch: true });
    // bowler
    if(delivery && delivery.bowlerX != null){
      drawFigure(delivery.bowlerX, delivery.bowlerY, 1.24, kitFor(teamColors.bowl, '#101828'), { runPhase: delivery.runPhase });
    } else {
      drawFigure(GEO.bowlerHome.x, GEO.bowlerHome.y, 1.24, kitFor(teamColors.bowl, '#101828'), {});
    }
  }
  function drawBall(b){
    if(!b) return;
    // trail
    if(b.trail && b.trail.length > 1){
      for(let i=1;i<b.trail.length;i++){
        const a = i / b.trail.length;
        ctx.strokeStyle = `rgba(255,120,90,${a*.5})`;
        ctx.lineWidth = 2.6*a + .6;
        ctx.beginPath(); ctx.moveTo(b.trail[i-1].x, b.trail[i-1].y); ctx.lineTo(b.trail[i].x, b.trail[i].y); ctx.stroke();
      }
    }
    ctx.fillStyle = '#c02a2a';
    circle(b.x, b.y, 4.6); ctx.fill();
    ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(b.x-3.4, b.y-1.6); ctx.quadraticCurveTo(b.x, b.y+2.2, b.x+3.4, b.y-1.6); ctx.stroke();
  }
  function drawParticles(){
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.life -= p.decay;
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      if(p.size > 3.4){ ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size*.68); }
      else { circle(p.x, p.y, p.size); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  }
  function drawPopup(){
    if(!popup) return;
    const age = (performance.now() - popup.t0) / 1000;
    const dur = 2.6;
    if(age > dur){ popup = null; return; }
    const inT = clamp(age / .18, 0, 1);
    const outT = clamp((age - (dur - .35)) / .35, 0, 1);
    const scale = (0.55 + 0.65 * easeOut(inT)) * (1 + outT * 0.12);
    const alpha = 1 - outT;
    ctx.save();
    ctx.translate(W/2, 268);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = "64px Haettenschweiler,'Arial Narrow Bold',Impact,sans-serif";
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,.72)';
    ctx.strokeText(popup.text, 0, 0);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, 0, 0);
    if(popup.sub){
      ctx.font = "800 21px 'Segoe UI',sans-serif";
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.72)';
      ctx.strokeText(popup.sub, 0, 62);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(popup.sub, 0, 62);
    }
    ctx.restore();
  }
  function drawWatermark(){
    ctx.globalAlpha = .5;
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.font = "700 11px 'Segoe UI',sans-serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('IPL 2026  ·  ONE OVER', 14, H - 10);
    ctx.textAlign = 'right';
    ctx.fillText(scene === 'done' ? 'FULL TIME' : 'BROADCAST', W - 14, H - 10);
    ctx.globalAlpha = 1;
  }

  /* ── main render loop ─────────────────────────────── */
  function renderFrame(){
    if(!ctx) return;
    const t = performance.now();
    ctx.clearRect(0,0,W,H);
    drawSky(); drawFloodlights(); drawStands(); drawAdBoards(); drawOutfield(); drawPitch();
    drawFielders(t);
    const swing = delivery && delivery.swingT != null ? swingCurve(delivery.swingT) : 0;
    drawBatters(t, swing);
    drawParticles();
    drawBall(delivery ? delivery.ball : null);
    drawWatermark();
    drawBroadcastHud();
    drawPopup();
  }
  function swingCurve(t){
    // 0→1 swing: quick backlift then sweep
    return t < .4 ? easeOut(t/.4) * .35 : .35 + easeInOut((t-.4)/.6) * .65;
  }
  function loop(){
    renderFrame();
    if(delivery) advanceDelivery(performance.now());
    raf = requestAnimationFrame(loop);
  }
  function ensureLoop(){
    if(!raf) raf = requestAnimationFrame(loop);
  }

  /* ── delivery choreography ────────────────────────── */
  function setPopup(text, color, sub){
    popup = { text, color, sub: sub || '', t0: performance.now() };
  }
  function burst(x, y, n, colors, speed, grav){
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2, s = (0.4+Math.random()*0.6)*(speed||5);
      particles.push({
        x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2.4,
        size: 2.5 + Math.random()*4.5, life: 1, decay: .012 + Math.random()*.012,
        color: colors[Math.floor(Math.random()*colors.length)],
        grav: grav == null ? .16 : grav,
      });
    }
  }
  function stumpDebris(){
    const { x, y } = GEO.farStumps;
    const bails = [
      {x: x-9, y: y-24, vx: -2.6, vy: -4.6},
      {x: x+9, y: y-24, vx: 2.8, vy: -4.2},
      {x: x-5, y: y-12, vx: -1.6, vy: -3.4},
      {x: 0,   y: y-14, vx: .4,  vy: -5.2},
      {x: x+5, y: y-10, vx: 1.9, vy: -3.1},
    ];
    bails.forEach(b => particles.push({ ...b, size: 3.4, life: 1.15, decay: .011, color: '#f3e9c8', grav: .22, spin: 0 }));
    burst(x, y-16, 14, ['#f3e9c8','#e8d88f','#cdb87f'], 4.5, .2);
  }

  // delivery phases: runup → flight → contact → outcome → settle → done
  function buildDelivery(result){
    const now = performance.now();
    const dur = result.totalMs || 5200;
    return {
      result,
      t0: now,
      totalMs: dur,
      phase: 'runup',
      bowlerX: GEO.bowlerHome.x, bowlerY: GEO.bowlerHome.y, runPhase: 0,
      ball: null,
      swingT: null,
      contactDone: false,
      outcomeStart: null,
      done: false,
    };
  }
  function advanceDelivery(now){
    const d = delivery;
    const el = now - d.t0;
    const r = d.result;
    const RUNUP = 1400, FLIGHT = 1150, CONTACT_END = 250, SETTLE = 1500;
    const t = el;

    if(t < RUNUP){                                     // ── run-up
      const p = easeInOut(t / RUNUP);
      d.bowlerX = GEO.bowlerHome.x; d.bowlerY = lerp(GEO.bowlerHome.y, GEO.bowlerCrease.y, p);
      d.runPhase = t * .019;
      d.ball = null;
      return;
    }
    const fT = clamp((t - RUNUP) / FLIGHT, 0, 1);      // ── flight to bat
    if(fT < 1){
      d.bowlerX = GEO.bowlerCrease.x; d.bowlerY = GEO.bowlerCrease.y; d.runPhase = 0;
      // piecewise: hand → bounce → bat
      let pos;
      if(fT < .52){
        const q = fT / .52;
        pos = quad(GEO.release, { x: 481, y: 330 }, GEO.bounce, q);
      } else {
        const q = (fT - .52) / .48;
        pos = quad(GEO.bounce, { x: 490, y: 244 }, GEO.batContact, q);
      }
      pos.trail = d.ball ? (d.ball.trail||[]).concat({x:pos.x, y:pos.y}).slice(-9) : [{x:pos.x,y:pos.y}];
      d.ball = pos;
      d.swingT = fT > .68 ? clamp((fT-.68)/.32, 0, 1) : 0;
      return;
    }
    if(!d.contactDone){
      d.contactDone = true;
      d.outcomeStart = now;
      d.swingT = 1;
      // immediate sfx/popup triggers for wicket-type outcomes
      if(r.isWicket){
        if(r.wicketKind === 'bowled' || r.wicketKind === 'lbw' || r.wicketKind === 'stumped' || r.wicketKind === 'c&b'){
          if(r.wicketKind === 'bowled' || r.wicketKind === 'c&b'){ stumpsFallen = true; stumpDebris(); }
        }
      }
    }
    // ── outcome trajectory
    const oT = now - d.outcomeStart;
    const oDur = SETTLE;
    const q = clamp(oT / oDur, 0, 1);
    d.swingT = 1;   // hold the follow-through pose through the outcome

    if(r.kind === 'wicket' && r.wicketKind === 'bowled'){
      // ball into stumps; stumps already shattered
      const p = quad({x:GEO.batContact.x, y:GEO.batContact.y}, {x:487, y:186}, {x:GEO.farStumps.x, y:GEO.farStumps.y-8}, easeOut(q));
      p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-8);
      d.ball = p;
      if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('BOWLED!', '#f87171', r.subText || ''); }
    }
    else if(r.kind === 'wicket' && (r.wicketKind === 'caught' || r.wicketKind === 'c&b')){
      const f = pickFielderForShot(r);
      const arc = r.wicketKind === 'c&b' ? { x: 505, y: 145 } : { x: lerp(GEO.batContact.x, f.x, .5), y: Math.min(GEO.batContact.y, f.y) - 150 };
      const p = quad(GEO.batContact, arc, { x: f.x, y: f.y - 14 }, easeOut(q));
      p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-8);
      d.ball = p;
      if(q > .92 && !d.catchBurst){ d.catchBurst = true; burst(f.x, f.y - 16, 18, ['#fde68a','#ffffff','#fca5a5'], 4, .12); }
      if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup(r.wicketKind === 'c&b' ? 'CAUGHT & BOWLED!' : 'CAUGHT!', '#f87171', (r.subText || '') + (f ? ` · ${f.name} takes it` : '')); }
    }
    else if(r.kind === 'wicket' && r.wicketKind === 'lbw'){
      const p = quad(GEO.batContact, {x:494, y:216}, {x:496, y:228}, easeOut(q));
      p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-8);
      d.ball = p;
      if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('LBW!', '#f87171', r.subText || ''); }
    }
    else if(r.kind === 'wicket' && r.wicketKind === 'stumped'){
      // ball misses bat, reaches keeper's gloves
      const p = quad(GEO.batContact, {x:478, y:158}, {x:GEO.keeper.x, y:GEO.keeper.y - 6}, easeOut(q));
      p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-8);
      d.ball = p;
      if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('STUMPED!', '#f87171', r.subText || ''); }
    }
    else if(r.kind === 'four'){
      const dir = r.shotSector || { x: GEO.ropeRight, y: 320 };
      const end = { x: dir.x > W/2 ? GEO.ropeRight + 24 : GEO.ropeLeft - 24, y: dir.y };
      const p = quad(GEO.batContact, { x: lerp(GEO.batContact.x, dir.x, .6), y: dir.y - 24 }, end, easeIn(q));
      p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-12);
      d.ball = p;
      if(q >= .96 && !d.ropeBurst){ d.ropeBurst = true; burst(clamp(end.x, 30, W-30), clamp(end.y, 90, H-30), 22, ['#7dd3fc','#ffffff','#f5c518'], 5, .1); }
      if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('FOUR!', '#7dd3fc', r.subText || ''); }
    }
    else if(r.kind === 'six'){
      const dir = r.shotSector || { x: 265, y: 0 };
      const end = { x: dir.x, y: -40 };
      const p = quad(GEO.batContact, { x: lerp(GEO.batContact.x, dir.x, .45), y: 40 }, end, easeIn(q));
      p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-12);
      d.ball = p;
      if(q > .8 && !d.crowdBurst){ d.crowdBurst = true; burst(clamp(dir.x, 60, W-60), 90, 26, ['#c4b5fd','#ffffff','#f5c518','#38bdf8'], 6, .08); }
      if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('SIX!', '#c4b5fd', r.subText || ''); }
    }
    else if(r.kind === 'run' || r.kind === 'dot'){
      if(r.kind === 'dot' && r.dotType === 'leave'){
        d.swingT = 0;   // batter leaves it alone
        // ball runs past to keeper, untouched
        const p = quad(GEO.batContact, {x:482, y:170}, {x:GEO.keeper.x, y:GEO.keeper.y - 4}, easeInOut(q));
        p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-8);
        d.ball = p;
        if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('LEFT ALONE', '#cfd8f2', ''); }
      } else if(r.kind === 'dot'){
        // beaten / blocked near pad
        const p = quad(GEO.batContact, {x:497, y:222}, {x:503, y:236}, easeOut(q));
        p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-8);
        d.ball = p;
        if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('BEATEN!', '#9aa7cf', ''); }
      } else {
        // worked into the gap for runs
        const sec = r.shotSector || SHOT_SECTORS[0];
        const end = { x: sec.x, y: sec.y };
        const p = quad(GEO.batContact, { x: lerp(GEO.batContact.x, end.x, .5), y: end.y - 26 }, end, easeInOut(q));
        p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-10);
        d.ball = p;
        if(q >= 1 && !d.popupFired){
          d.popupFired = true;
          setPopup(r.runsOffBat + (r.runsOffBat === 1 ? ' RUN' : ' RUNS'), '#ffe98a', '');
        }
      }
    }
    else if(r.kind === 'wide'){
      // ball sails down leg side to keeper
      const p = quad(GEO.release, {x:520, y:250}, {x:528, y:GEO.keeper.y - 2}, easeInOut(clamp((now - d.outcomeStart + 300) / (SETTLE + 300), 0, 1)));
      p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-8);
      d.ball = p;
      d.swingT = 0;
      if(q >= .35 && !d.popupFired){ d.popupFired = true; setPopup('WIDE', '#ffe45e', '+1 run · re-bowled'); }
    }
    else if(r.kind === 'noball'){
      if(r.runsOffBat > 0){
        const sec = r.shotSector || SHOT_SECTORS[0];
        const p = quad(GEO.batContact, { x: lerp(GEO.batContact.x, sec.x, .5), y: sec.y - 18 }, { x: sec.x, y: sec.y }, easeInOut(q));
        p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-10);
        d.ball = p;
        if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('NO BALL', '#ffe45e', `+1 penalty & ${r.runsOffBat} off the bat · free hit`); }
      } else {
        const p = quad(GEO.batContact, {x:500, y:226}, {x:505, y:240}, easeOut(q));
        p.trail = (d.ball && d.ball.trail || []).concat({x:p.x, y:p.y}).slice(-8);
        d.ball = p;
        if(q >= 1 && !d.popupFired){ d.popupFired = true; setPopup('NO BALL', '#ffe45e', '+1 penalty · free hit next'); }
      }
    }
    // phase bookkeeping
    if(oT > oDur + 600 && !d.done){
      d.done = true;
      scene = 'idle';
      delivery = null;
      stumpsFallen = false;   // redrawn next delivery
      const cb = r.onSettled;
      if(typeof cb === 'function') cb();
    }
  }
  function pickFielderForShot(r){
    if(r.shotSector){
      let best = FIELDERS[0], bd = Infinity;
      FIELDERS.forEach(f => {
        const dist = Math.hypot(f.x - r.shotSector.x, f.y - r.shotSector.y);
        if(dist < bd){ bd = dist; best = f; }
      });
      return best;
    }
    return FIELDERS[3 + Math.floor(Math.random() * 4)];
  }

  /* ── BROADCAST HUD: team logos + player portraits ── */
  let hud = null;
  const crestCache = {};
  const portraitCache = {};
  const hashStr = s => { let h = 2166136261; s = String(s); for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const SKIN = ['#f2c79b','#e4b184','#c68e5e','#a06a3d','#7d4f28'];
  const HAIR = ['#141414','#2b1d10','#3a3a3a','#101010','#241a12'];
  function shade(hex, amt){
    const n = parseInt(String(hex).replace('#',''), 16);
    if(isNaN(n)) return hex;
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }
  function hudCrestImage(teamId, px){
    const key = String(teamId) + '@' + px;
    let entry = crestCache[key];
    if(entry) return entry;
    entry = { img: new Image(), ok: false };
    try {
      const A = window.IPLApp;
      const team = A && A.DATA ? A.DATA[teamId] : null;
      if(team && A.crestSVG){
        const svg = A.crestSVG(team, 'hud')
          .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${Math.round(px * 1.04)}" `);
        entry.img.onload = () => { entry.ok = true; };
        entry.img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      }
    } catch(e){ /* crest unavailable — bug still draws text */ }
    crestCache[key] = entry;
    return entry;
  }
  // stylized broadcast portrait — flat illustrative likeness per player id (no external assets)
  function portraitFor(player, team){
    const key = String(player.id);
    if(portraitCache[key]) return portraitCache[key];
    const S = 112, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const c = cv.getContext('2d');
    const h = hashStr(player.id);
    const skin = SKIN[h % SKIN.length];
    const hair = HAIR[(h >>> 4) % HAIR.length];
    const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, team.c1); g.addColorStop(1, team.c2);
    c.fillStyle = g; c.beginPath(); c.arc(S/2, S/2, S/2, 0, Math.PI*2); c.fill();
    const rg = c.createRadialGradient(S*0.42, S*0.38, 6, S/2, S/2, S*0.62);
    rg.addColorStop(0, 'rgba(255,255,255,.30)'); rg.addColorStop(1, 'rgba(0,0,0,.32)');
    c.fillStyle = rg; c.beginPath(); c.arc(S/2, S/2, S/2, 0, Math.PI*2); c.fill();
    // shoulders — jersey tone
    c.fillStyle = shade(team.c1, 0.22);
    c.beginPath(); c.ellipse(S/2, S*1.16, S*0.52, S*0.40, 0, Math.PI, Math.PI*2); c.fill();
    // collar stripe
    c.fillStyle = 'rgba(255,255,255,.35)';
    c.fillRect(S*0.40, S*0.845, S*0.20, S*0.045);
    // neck
    c.fillStyle = shade(skin, -0.16);
    c.fillRect(S*0.435, S*0.55, S*0.13, S*0.17);
    // ears
    c.fillStyle = skin;
    c.beginPath(); c.arc(S*0.315, S*0.475, S*0.035, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(S*0.685, S*0.475, S*0.035, 0, Math.PI*2); c.fill();
    // head
    c.fillStyle = skin;
    c.beginPath(); c.ellipse(S/2, S*0.45, S*0.19, S*0.225, 0, 0, Math.PI*2); c.fill();
    // hair — three silhouettes by hash
    c.fillStyle = hair;
    const style = h % 3;
    if(style === 0){ c.beginPath(); c.ellipse(S/2, S*0.305, S*0.195, S*0.105, 0, Math.PI, 0); c.fill(); }
    else if(style === 1){ c.fillRect(S*0.315, S*0.235, S*0.37, S*0.075); c.beginPath(); c.ellipse(S/2, S*0.30, S*0.19, S*0.085, 0, Math.PI, 0); c.fill(); }
    else { c.beginPath(); c.ellipse(S/2, S*0.315, S*0.20, S*0.088, 0, Math.PI*1.02, -0.02); c.fill(); }
    // eyes
    c.fillStyle = 'rgba(18,18,24,.92)';
    c.beginPath(); c.arc(S*0.425, S*0.465, 2.7, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(S*0.575, S*0.465, 2.7, 0, Math.PI*2); c.fill();
    // smile
    c.strokeStyle = 'rgba(18,18,24,.72)'; c.lineWidth = 2.3;
    c.beginPath(); c.arc(S/2, S*0.552, S*0.072, Math.PI*0.16, Math.PI*0.84); c.stroke();
    portraitCache[key] = cv;
    return cv;
  }
  function truncate(s, n){ s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function drawBug(x, team, scoreText, alignRight){
    const w = 226, h = 72;
    if(alignRight) x = W - 12 - w;
    ctx.save();
    roundedRect(x, 12, w, h, 13);
    ctx.fillStyle = 'rgba(5,9,20,.88)'; ctx.fill();
    ctx.strokeStyle = team.c1; ctx.lineWidth = 2.5; ctx.stroke();
    const img = hudCrestImage(team.id, 52);
    if(img.ok) ctx.drawImage(img.img, x + 10, 15, 50, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 23px Haettenschweiler,'Arial Narrow Bold',Impact,sans-serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(team.short, x + 70, 41);
    ctx.fillStyle = '#f5c518';
    ctx.font = "800 15.5px SFMono-Regular,Consolas,Menlo,monospace";
    ctx.fillText(truncate(scoreText, 18), x + 70, 64);
    ctx.restore();
  }
  function drawPlayerCard(x, player, stat, kicker, team, alignRight, hot){
    const w = 302, h = 100, y = H - 12 - h;
    if(alignRight) x = W - 12 - w;
    if(!player) return;
    ctx.save();
    roundedRect(x, y, w, h, 13);
    ctx.fillStyle = 'rgba(5,9,20,.88)'; ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(245,197,24,.85)' : 'rgba(245,197,24,.4)'; ctx.lineWidth = hot ? 2.5 : 1.5; ctx.stroke();
    ctx.drawImage(portraitFor(player, team), x + 10, y + 11, 76, 76);
    const tx = x + 96;
    ctx.fillStyle = '#f5c518';
    ctx.font = "800 9.5px 'Segoe UI',sans-serif";
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(kicker, tx, y + 22);
    ctx.fillStyle = '#ffffff';
    ctx.font = "800 15px 'Segoe UI',sans-serif";
    ctx.fillText(truncate(player.name, 22), tx, y + 44);
    ctx.fillStyle = hot ? '#ffd866' : '#aeb8de';
    ctx.font = "800 " + (hot ? 15.5 : 12) + "px SFMono-Regular,Consolas,Menlo,monospace";
    ctx.fillText(truncate(stat, 24), tx, y + 72);
    ctx.restore();
  }
  function drawBroadcastHud(){
    if(!hud) return;
    const A = window.IPLApp;
    const tBat = A && A.DATA ? A.DATA[hud.batId] : null;
    const tBowl = A && A.DATA ? A.DATA[hud.bowlId] : null;
    if(tBat) drawBug(12, tBat, hud.batScore || '—', false);
    if(tBowl) drawBug(W - 12 - 226, tBowl, hud.bowlScore || '—', true);
    if(hud.needText){
      ctx.save();
      ctx.font = "800 19px 'Segoe UI',sans-serif";
      const tw = ctx.measureText(hud.needText).width + 52;
      const cx = W / 2, bw = Math.max(150, tw);
      roundedRect(cx - bw / 2, 12, bw, 46, 23);
      ctx.fillStyle = 'rgba(245,197,24,.95)'; ctx.fill();
      ctx.strokeStyle = '#8a6a00'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#201800';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(hud.needText, cx, 36);
      ctx.restore();
    }
    if(hud.striker && tBat) drawPlayerCard(12, hud.striker.player, hud.striker.stat, 'ON STRIKE', tBat, false, true);
    if(hud.bowler && tBowl) drawPlayerCard(W - 12 - 302, hud.bowler.player, hud.bowler.stat, 'BOWLING', tBowl, true, false);
  }
  function setHud(partial){ hud = Object.assign(hud || {}, partial || {}); }

  /* ── public API ───────────────────────────────────── */
  function init(){
    canvas = document.getElementById('gameCanvas');
    if(!canvas) return;
    ctx = canvas.getContext('2d');
    buildCrowd();
    idleT0 = performance.now();
    ensureLoop();
  }
  function setTeams(batColor, bowlColor){
    teamColors = { bat: batColor || '#38bdf8', bowl: bowlColor || '#f5c518' };
  }
  function playDelivery(payload, onSettled){
    // payload: { kind, runsOffBat, isWicket, wicketKind, dotType, shotSector, subText, totalMs }
    const copy = Object.assign({}, payload, { onSettled });
    delivery = buildDelivery(copy);
    scene = 'delivery';
    ensureLoop();
  }
  function showBanner(text, sub){
    scene = 'done';
    delivery = null;
    setPopup(text, '#f5c518', sub || '');
  }
  function resetStumps(){ stumpsFallen = false; }
  function reset(){
    delivery = null; particles = []; popup = null;
    scene = 'idle'; stumpsFallen = false;
  }
  function stop(){
    if(raf){ cancelAnimationFrame(raf); raf = null; }
    reset();
  }
  return { init, setTeams, playDelivery, showBanner, resetStumps, reset, stop, setHud };
})();
