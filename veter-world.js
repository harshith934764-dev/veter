
import * as THREE from 'https://esm.sh/three@0.160.0';
(()=>{const root=document.getElementById('game');
// VETER World setup options and live mini-map
const introModal=document.querySelector('#intro .modal');
const setup=document.createElement('div');setup.id='veterSetup';setup.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:14px 0;color:#fff;font-size:12px';
setup.innerHTML='<label>TEAM <select id="veterTeam"><option value="blue">VETER FC</option><option value="green">GREEN CITY</option><option value="gold">GOLDEN UNITED</option></select></label><label>DIFFICULTY <select id="veterDifficulty"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option></select></label><label>MATCH <select id="veterLength"><option value="90">90 sec</option><option value="180">3 min</option><option value="300">5 min</option></select></label>';
introModal.insertBefore(setup,document.getElementById('kickoff'));
const setupStyle=document.createElement('style');setupStyle.textContent='#veterSetup label{display:grid;gap:4px;text-align:left;color:#c3d5df}#veterSetup select{background:#10283a;color:white;border:1px solid #ffffff55;border-radius:8px;padding:8px;min-width:100px}#veterMap{position:fixed;right:14px;bottom:100px;width:124px;height:180px;background:#071522d9;border:1px solid #ffffff70;border-radius:10px;z-index:5;pointer-events:none}#veterMap canvas{width:100%;height:100%}';document.head.appendChild(setupStyle);
const mapBox=document.createElement('div');mapBox.id='veterMap';const mapCanvas=document.createElement('canvas');mapCanvas.width=248;mapCanvas.height=360;mapBox.appendChild(mapCanvas);document.body.appendChild(mapBox);const mapCtx=mapCanvas.getContext('2d');let difficultyScale=1,matchLength=90;let matchStats={shots:0,passes:0,saves:0};
const stats=document.createElement('div');stats.id='veterStats';stats.style.cssText='position:fixed;right:14px;top:112px;z-index:6;padding:9px 12px;border:1px solid #ffffff55;border-radius:10px;background:#06131dcc;color:#fff;font:12px/1.7 system-ui;pointer-events:none';stats.innerHTML='<b>MATCH STATS</b><br>Shots: <span id="vShots">0</span><br>Passes: <span id="vPasses">0</span><br>Saves: <span id="vSaves">0</span>';document.body.appendChild(stats);
const notice=document.createElement('div');notice.id='veterNotice';notice.style.cssText='position:fixed;left:50%;top:24%;transform:translate(-50%,-50%);z-index:8;padding:14px 22px;border-radius:14px;background:#071522eF;border:1px solid #b7ff61;color:#b7ff61;font:bold 24px system-ui;opacity:0;transition:opacity .2s;pointer-events:none';document.body.appendChild(notice);let noticeTimer=0;function announce(message){notice.textContent=message;notice.style.opacity='1';clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.style.opacity='0',1300)}
function refreshStats(){document.getElementById('vShots').textContent=matchStats.shots;document.getElementById('vPasses').textContent=matchStats.passes;document.getElementById('vSaves').textContent=matchStats.saves;}
const scene=new THREE.Scene();scene.background=new THREE.Color(0x8db4ce);scene.fog=new THREE.Fog(0x8db4ce,55,145);
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,250);camera.position.set(0,13,22);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;root.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xddeeff,0x31502c,1.8));const sun=new THREE.DirectionalLight(0xffefcf,2.5);sun.position.set(-18,30,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;scene.add(sun);
const fill=new THREE.DirectionalLight(0xb8d8ff,.65);fill.position.set(25,18,-20);scene.add(fill);
const mat=(c,r=.8)=>new THREE.MeshStandardMaterial({color:c,roughness:r});const grass=mat(0x26743c),line=mat(0xe9f4e8),dark=mat(0x17212b),blue=mat(0x172b48),skin=mat(0xb87952),white=mat(0xf4f4ef),ballmat=mat(0xffffff,.45);
const field=new THREE.Mesh(new THREE.PlaneGeometry(58,92),grass);field.rotation.x=-Math.PI/2;field.receiveShadow=true;scene.add(field);
for(let z=-40;z<45;z+=10){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(58,10),mat(z%20?0x287a40:0x236f39));stripe.rotation.x=-Math.PI/2;stripe.position.set(0,.012,z+5);scene.add(stripe)}
function box(w,h,d,m,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o}
function mark(x,z,w,d){const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),line);o.rotation.x=-Math.PI/2;o.position.set(x,.03,z);scene.add(o)}
mark(0,-45,58,.18);mark(0,45,58,.18);mark(-29,0,.18,90);mark(29,0,.18,90);mark(0,0,58,.15);
const circle=new THREE.Mesh(new THREE.RingGeometry(9.8,10,.9),line);circle.rotation.x=-Math.PI/2;circle.position.y=.04;scene.add(circle);
function goal(z,dir){box(18,.35,.35,line,0,3,z);box(.35,6,.35,line,-9,3,z);box(.35,6,.35,line,9,3,z);for(let i=0;i<8;i++)box(18,.06,.06,white,0,.5+i*.7,z-dir*.7)}
goal(-44,1);goal(44,-1);
// Penalty areas, six-yard boxes and penalty spots
for(const z of [-35,35]){mark(0,z,30,.14);mark(-15,z+ (z<0?-4:4),.14,8);mark(15,z+(z<0?-4:4),.14,8);mark(0,z+(z<0?-8:8),.14,.14)}
// Stadium seating tiers and roof beams
for(const side of [-1,1]){for(let tier=0;tier<4;tier++){const stand=box(7,1.15,96,mat(tier%2?0x26394b:0x34495b),side*(34+tier*1.1),2.2+tier*1.35,0);stand.rotation.z=side*.05}
for(let i=0;i<18;i++){box(.35,.35,96,mat(i%2?0xc2a45d:0x9aa8b5),side*36,8.2,i*0.01-0.5)}}
for(const z of [-43,43]){box(72,1.2,7,mat(0x26394b),0,3,z);for(let i=0;i<20;i++)box(3,.45,6,mat(i%2?0x34495b:0x42576b),-34+i*3.6,4,z)}
// Floodlight towers
for(const x of [-39,39])for(const z of [-39,39]){box(.45,19,.45,dark,x,9.5,z);const lamp=box(5,1.4,1.2,mat(0xf5f0d0),x,19,z);const glow=new THREE.PointLight(0xddeeff,18,38);glow.position.set(x,18,z);scene.add(glow)}
for(let side of [-1,1]){for(let i=0;i<28;i++){let x=side* (32+Math.random()*10),z=-44+i*3.2;box(1.4,2+Math.random()*2,1.2,i%3?blue:dark,x,1,z)}}
function human(x,z,jersey,isKeeper=false){
const g=new THREE.Group();g.position.set(x,0,z);
const kit=mat(jersey,.72),shorts=mat(isKeeper?0x26364a:0x202936),skinTone=mat(0xb87952,.82),sock=mat(isKeeper?0xffd34f:0xe8e8e8),shoe=mat(0x11151b,.55),hairMat=mat(0x241a15,.9),detail=mat(0x211813);
function part(geo,m,parent,pos,scale){const o=new THREE.Mesh(geo,m);o.position.set(...pos);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function limb(parent,x,y,z,length,radius,m){const pivot=new THREE.Group();pivot.position.set(x,y,z);parent.add(pivot);part(new THREE.CapsuleGeometry(radius,length-radius*2,5,10),m,pivot,[0,-length/2,0]);return pivot}
const body=new THREE.Group();body.position.y=1.05;g.add(body);
// Tapered torso, neck and shoulders: classic late-90s/early-2000s open-world character proportions
part(new THREE.CylinderGeometry(.29,.43,.92,12),kit,body,[0,.53,0]);
part(new THREE.SphereGeometry(1,16,12),kit,body,[0,.93,0],[.43,.22,.25]);
part(new THREE.CylinderGeometry(.115,.14,.19,10),skinTone,body,[0,1.12,0]);
const head=new THREE.Group();head.position.set(0,1.42,-.015);body.add(head);
part(new THREE.SphereGeometry(1,20,16),skinTone,head,[0,.12,0],[.255,.34,.235]);
part(new THREE.SphereGeometry(1,12,10),skinTone,head,[-.25,.12,0],[.055,.095,.075]);
part(new THREE.SphereGeometry(1,12,10),skinTone,head,[.25,.12,0],[.055,.095,.075]);
// Nose, brows and eyes face toward the front (-Z)
part(new THREE.ConeGeometry(.055,.14,8),skinTone,head,[0,.12,-.235],[1,1,1]).rotation.x=-Math.PI/2;
const eyeMat=mat(0xf5eee0),pupil=mat(0x171717);
for(const side of [-1,1]){part(new THREE.SphereGeometry(.035,8,8),eyeMat,head,[side*.09,.19,-.211]);part(new THREE.SphereGeometry(.017,8,8),pupil,head,[side*.09,.19,-.241]);part(new THREE.BoxGeometry(.09,.025,.025),hairMat,head,[side*.09,.245,-.21]);}
part(new THREE.SphereGeometry(1,16,10,0,Math.PI*2,0,Math.PI*.48),hairMat,head,[0,.27,0],[1.02,.72,1.02]);
// shorts and two articulated legs
part(new THREE.CylinderGeometry(.34,.3,.34,12),shorts,body,[0,-.02,0]);
const legs=[],arms=[];
for(const side of [-1,1]){
 const hip=limb(body,side*.19,-.16,0,.57,.115,skinTone);legs.push(hip);
 part(new THREE.CylinderGeometry(.125,.13,.23,10),sock,hip,[0,-.48,0]);
 part(new THREE.BoxGeometry(.2,.12,.34),shoe,hip,[0,-.61,-.09]);
 const shoulder=limb(body,side*.48,.91,0,.62,.105,skinTone);shoulder.rotation.z=-side*.12;arms.push(shoulder);
 part(new THREE.CylinderGeometry(.135,.14,.22,10),kit,shoulder,[0,-.06,0]);
}
part(new THREE.CylinderGeometry(.12,.12,.055,12),kit,body,[0,1.02,-.005]);
if(isKeeper){const gloves=mat(0xffcc36);for(const side of [-1,1])part(new THREE.SphereGeometry(.12,12,10),gloves,arms[side===-1?0:1],[0,-.62,0]);}
g.userData.kit=kit;g.userData.legs=legs;g.userData.arms=arms;g.userData.body=body;g.userData.walkPhase=Math.random()*Math.PI*2;scene.add(g);return g}
const player=human(0,27,0x111827),opponents=[human(-5,-8,0xb62f36),human(5,-15,0xb62f36),human(0,-23,0xb62f36)],keeper=human(0,-39,0xf0c52d,true);
const ball=new THREE.Mesh(new THREE.SphereGeometry(.38,28,20),ballmat);ball.position.set(0,.4,23);ball.castShadow=true;scene.add(ball);
for(let i=0;i<5;i++){const patch=new THREE.Mesh(new THREE.CircleGeometry(.105,6),mat(0x20252a));patch.position.set(Math.cos(i*Math.PI*2/5)*.365,.4+Math.sin(i*Math.PI*2/5)*.12,23);patch.lookAt(ball.position.clone().add(new THREE.Vector3(Math.cos(i*Math.PI*2/5),0,Math.sin(i*Math.PI*2/5))));ball.add(patch)}
const keys={};let running=false,paused=false,goals=0,time=90,stamina=100,velocity=new THREE.Vector3(),ballVel=new THREE.Vector3(),last=performance.now(),lastShot=0;
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){e.preventDefault();shoot()}if(e.code==='KeyE')pass();if(e.code==='Escape')togglePause()});addEventListener('keyup',e=>keys[e.code]=false);
document.querySelectorAll('[data-key]').forEach(b=>{let k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true});['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>keys[k]=false))});
function shoot(){if(!running||paused||performance.now()-lastShot<500)return;lastShot=performance.now();const d=player.position.distanceTo(ball.position);if(d<3.5){const aim=THREE.MathUtils.clamp(player.position.x*.08+(Math.random()-.5)*.45,-.85,.85);ballVel.set(aim*10,-.1,-(18+Math.random()*5));matchStats.shots++;refreshStats();document.getElementById('status').textContent='SHOT!';announce('SHOT!');}}
function pass(){if(!running||paused)return;const d=player.position.distanceTo(ball.position);if(d<4){ballVel.set((player.position.x-ball.position.x)*.7,1,-10);matchStats.passes++;refreshStats();document.getElementById('status').textContent='PASS';announce('NICE PASS!');}}
function togglePause(){if(!running)return;paused=!paused;document.getElementById('status').textContent=paused?'PAUSED':'PLAYING';document.getElementById('pause').textContent=paused?'▶':'Ⅱ';}document.getElementById('pause').onclick=togglePause;document.getElementById('shoot').onclick=shoot;document.getElementById('pass').onclick=pass;document.getElementById('sprint').onpointerdown=()=>keys.ShiftLeft=true;document.getElementById('sprint').onpointerup=()=>keys.ShiftLeft=false;
function start(){window.__VETER_GAME_STARTED=true;goals=0;matchStats={shots:0,passes:0,saves:0};refreshStats();notice.style.opacity='0';matchLength=Number(document.getElementById('veterLength').value)||90;time=matchLength;difficultyScale={easy:.72,normal:1,hard:1.35}[document.getElementById('veterDifficulty').value]||1;const teamColors={blue:0x2563eb,green:0x16834a,gold:0xc49a22};player.userData.kit.color.setHex(teamColors[document.getElementById('veterTeam').value]||0x2563eb);stamina=100;paused=false;document.getElementById('pause').textContent='Ⅱ';document.getElementById('status').textContent='PLAYING';document.getElementById('goals').textContent=0;document.getElementById('clock').textContent=Math.ceil(matchLength);player.position.set(0,0,27);ball.position.set(0,.4,23);ballVel.set(0,0,0);running=true;document.getElementById('intro').classList.add('hidden');document.getElementById('result').classList.add('hidden')}
document.getElementById('kickoff').onclick=start;document.getElementById('again').onclick=start;
function finish(){running=false;document.getElementById('finalGoals').textContent=goals;const resultText=document.querySelector('#result .modal p');if(resultText)resultText.innerHTML='You scored <b>'+goals+'</b> goal(s)!<br>Shots: '+matchStats.shots+' · Passes: '+matchStats.passes+' · Saves: '+matchStats.saves+'<br>Difficulty: '+document.getElementById('veterDifficulty').value.toUpperCase();document.getElementById('result').classList.remove('hidden')}
function animate(now){requestAnimationFrame(animate);let dt=Math.min((now-last)/1000,.04);last=now;if(running&&!paused){time-=dt;if(time<=0){time=0;finish()}document.getElementById('clock').textContent=Math.ceil(time);let x=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),z=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0);const sprinting=!!keys.ShiftLeft&&stamina>0&&!!(x||z);if(sprinting)stamina=Math.max(0,stamina-25*dt);else stamina=Math.min(100,stamina+12*dt);document.getElementById('staminaText').textContent=Math.round(stamina);document.getElementById('staminaBar').style.width=stamina+'%';let speed=sprinting?10:6;let v=new THREE.Vector3(x,0,z);if(v.length())v.normalize().multiplyScalar(speed*dt);player.position.x=THREE.MathUtils.clamp(player.position.x+v.x,-26,26);player.position.z=THREE.MathUtils.clamp(player.position.z+v.z,-42,39);
if(player.position.distanceTo(ball.position)<1.65&&ballVel.length()<2){ball.position.x=player.position.x;ball.position.z=player.position.z-1.2}
ball.position.addScaledVector(ballVel,dt);ballVel.multiplyScalar(Math.pow(.985,dt*60));if(ball.position.y>.4){ballVel.y-=12*dt;ball.position.y+=ballVel.y*dt;if(ball.position.y<.4){ball.position.y=.4;ballVel.y*=-.35}}
opponents.forEach((enemy,i)=>{const target=ballVel.length()>.7?ball.position:player.position;const dx=target.x-enemy.position.x,dz=target.z-enemy.position.z,len=Math.hypot(dx,dz)||1;const pace=(2.1+i*.25)*difficultyScale;enemy.position.x+=dx/len*pace*dt;enemy.position.z+=dz/len*pace*dt;enemy.position.x=THREE.MathUtils.clamp(enemy.position.x,-24,24);enemy.position.z=THREE.MathUtils.clamp(enemy.position.z,-35,18);if(enemy.position.distanceTo(player.position)<1.35&&player.position.distanceTo(ball.position)<2.4){ballVel.set((enemy.position.x-ball.position.x)*2,1,5);document.getElementById('status').textContent='TACKLED';}});keeper.position.x=THREE.MathUtils.clamp(ball.position.x*.7,-6,6);if(ball.position.z<-38&&Math.abs(ball.position.x-keeper.position.x)<2.3&&ball.position.y<4&&ballVel.z<0){matchStats.saves++;refreshStats();announce('GREAT SAVE!');ballVel.z=Math.abs(ballVel.z)*.72;ballVel.x+=(ball.position.x-keeper.position.x)*2;ball.position.z=-37;document.getElementById('status').textContent='SAVE!';} if(ball.position.z<-43&&Math.abs(ball.position.x)<9){goals++;document.getElementById('goals').textContent=goals;announce('GOAL! VETER FC!');ball.position.set(0,.4,23);ballVel.set(0,0,0)}
if(Math.abs(ball.position.x)>29||Math.abs(ball.position.z)>47){ball.position.set(0,.4,23);ballVel.set(0,0,0)}
}
// Simple articulated walk cycles for the player and AI characters
const movers=[player,...opponents,keeper];movers.forEach((actor,index)=>{const moving=actor===player?(Math.abs(keys.ArrowRight||keys.KeyD?1:0)+Math.abs(keys.ArrowLeft||keys.KeyA?1:0)+Math.abs(keys.ArrowUp||keys.KeyW?1:0)+Math.abs(keys.ArrowDown||keys.KeyS?1:0)>0):actor.position.distanceTo(ball.position)>1.8;actor.userData.walkPhase=(actor.userData.walkPhase||0)+(moving?dt*(sprintingSafe(index)?10:7):dt*1.5);const swing=moving?Math.sin(actor.userData.walkPhase)*.48:Math.sin(actor.userData.walkPhase)*.025;(actor.userData.legs||[]).forEach((leg,i)=>leg.rotation.x=(i===0?1:-1)*swing);(actor.userData.arms||[]).forEach((arm,i)=>arm.rotation.x=(i===0?-1:1)*swing*.75);if(actor.userData.body)actor.userData.body.rotation.z=moving?Math.sin(actor.userData.walkPhase*2)*.025:0;});
function sprintingSafe(index){return index===0&&!!keys.ShiftLeft;}
camera.position.lerp(new THREE.Vector3(player.position.x*.35,12,player.position.z+20),.06);camera.lookAt(player.position.x*.3,0,player.position.z-8);renderer.render(scene,camera);drawMiniMap()}
function drawMiniMap(){const c=mapCtx;if(!c)return;c.clearRect(0,0,248,360);c.fillStyle='#246b3a';c.fillRect(14,12,220,336);c.strokeStyle='#e8f4e8';c.lineWidth=2;c.strokeRect(14,12,220,336);c.beginPath();c.moveTo(14,180);c.lineTo(234,180);c.stroke();c.beginPath();c.arc(124,180,32,0,Math.PI*2);c.stroke();const dot=(x,z,color,r)=>{c.fillStyle=color;c.beginPath();c.arc(124+x*3.65,180+z*3.55,r,0,Math.PI*2);c.fill()};dot(player.position.x,player.position.z,'#62b5ff',7);opponents.forEach(o=>dot(o.position.x,o.position.z,'#ff6464',6));dot(keeper.position.x,keeper.position.z,'#ffd34e',6);dot(ball.position.x,ball.position.z,'#ffffff',4)}
requestAnimationFrame(animate);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
})();
