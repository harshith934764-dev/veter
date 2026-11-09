
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
const kit=mat(jersey,.94),pants=mat(isKeeper?0x26364a:0x30343b,.96),skinTone=mat(0x986447,.92),sock=mat(isKeeper?0xffd34f:0xb9b9b2),shoe=mat(0x17191d,.72),hairMat=mat(0x17120f,.98),eyeWhite=mat(0xe6dfd1),iris=mat(0x30251e),mouthMat=mat(0x59352d),seam=mat(0x111923);
function part(geo,m,parent,pos,scale,rot){const o=new THREE.Mesh(geo,m);o.position.set(...pos);if(scale)o.scale.set(...scale);if(rot)o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function segment(parent,x,y,z,len,r1,r2,m){const pivot=new THREE.Group();pivot.position.set(x,y,z);parent.add(pivot);part(new THREE.CylinderGeometry(r2,r1,len,12,1),m,pivot,[0,-len/2,0]);return pivot}
const body=new THREE.Group();body.position.y=1.02;g.add(body);
// Athletic human silhouette: hips, tapered waist, broad chest and shoulders
part(new THREE.CylinderGeometry(.31,.39,.34,16),pants,body,[0,-.02,0]);
part(new THREE.CylinderGeometry(.34,.47,.72,16,1),kit,body,[0,.52,0]);
part(new THREE.SphereGeometry(1,18,12),kit,body,[0,.88,0],[.46,.19,.27]);
part(new THREE.CylinderGeometry(.105,.12,.18,12),skinTone,body,[0,1.02,0]);
// Head with jaw, cheek volume and visible front-facing features
const head=new THREE.Group();head.position.set(0,1.28,-.015);body.add(head);
part(new THREE.SphereGeometry(1,24,18),skinTone,head,[0,.12,0],[.245,.325,.225]);
part(new THREE.SphereGeometry(1,16,12),skinTone,head,[0,-.055,-.015],[.205,.17,.207]);
for(const s of [-1,1]){
 part(new THREE.SphereGeometry(1,12,10),skinTone,head,[s*.242,.105,0],[.052,.085,.07]);
 part(new THREE.SphereGeometry(1,12,10),eyeWhite,head,[s*.087,.17,-.205],[.041,.027,.018]);
 part(new THREE.SphereGeometry(1,10,8),iris,head,[s*.087,.17,-.222],[.018,.02,.009]);
 part(new THREE.BoxGeometry(.09,.022,.025),hairMat,head,[s*.087,.222,-.205],[1,1,1]);
}
part(new THREE.SphereGeometry(1,12,10),skinTone,head,[0,.095,-.226],[.043,.075,.045]);
part(new THREE.BoxGeometry(.075,.012,.012),mouthMat,head,[0,-.025,-.213]);
part(new THREE.SphereGeometry(1,18,12,0,Math.PI*2,0,Math.PI*.48),hairMat,head,[0,.285,.005],[1.03,.78,1.02]);
// Hairline and side hair give the head a more finished silhouette
part(new THREE.BoxGeometry(.09,.22,.19),hairMat,head,[-.205,.19,.015]);
part(new THREE.BoxGeometry(.09,.22,.19),hairMat,head,[.205,.19,.015]);
// Shirt collar and sleeve caps
part(new THREE.TorusGeometry(.115,.025,8,16),seam,body,[0,.99,-.005],[1,1,1],[Math.PI/2,0,0]);
const legs=[],arms=[];
for(const s of [-1,1]){
 const leg=segment(body,s*.19,-.17,0,.56,.135,.105,pants);legs.push(leg);
 part(new THREE.CylinderGeometry(.105,.09,.42,12),pants,leg,[0,-.48,0]);
 part(new THREE.CylinderGeometry(.092,.09,.13,12),sock,leg,[0,-.75,0]);
 part(new THREE.BoxGeometry(.19,.12,.34),shoe,leg,[0,-.84,-.09]);
 part(new THREE.BoxGeometry(.19,.025,.31),seam,leg,[0,-.902,-.09]);
 const arm=segment(body,s*.47,.83,0,.42,.125,.095,kit);arm.rotation.z=-s*.16;arms.push(arm);
 part(new THREE.CylinderGeometry(.092,.075,.31,12),skinTone,arm,[0,-.37,0]);
 part(new THREE.SphereGeometry(.085,12,10),skinTone,arm,[0,-.56,-.005]);
 // Fingers are small separate shapes, visible at close camera distance
 for(let f=0;f<4;f++)part(new THREE.CapsuleGeometry(.014,.075,3,6),skinTone,arm,[s*.025+(f-1.5)*.026,-.625,-.012]);
 if(isKeeper)part(new THREE.SphereGeometry(.115,12,10),mat(0xffcc36),arm,[0,-.57,0]);
}
// Shirt hem and side seams make the outfit read as clothing rather than a single capsule
part(new THREE.TorusGeometry(.335,.018,6,20),seam,body,[0,.17,0],[1,1,1],[Math.PI/2,0,0]);
g.userData.kit=kit;g.userData.legs=legs;g.userData.arms=arms;g.userData.body=body;g.userData.walkPhase=Math.random()*Math.PI*2;scene.add(g);return g}
const player=human(0,27,0x111827),opponents=[human(-5,-8,0xb62f36),human(5,-15,0xb62f36),human(0,-23,0xb62f36)],keeper=human(0,-39,0xf0c52d,true);
const ball=new THREE.Mesh(new THREE.SphereGeometry(.38,28,20),ballmat);ball.position.set(0,.4,23);ball.castShadow=true;scene.add(ball);
for(let i=0;i<5;i++){const patch=new THREE.Mesh(new THREE.CircleGeometry(.075,6),mat(0x252a30));const a=i*Math.PI*2/5;patch.position.set(Math.cos(a)*.31,Math.sin(a)*.31,0);ball.add(patch)}
const keys={};let running=false,paused=false,goals=0,time=90,stamina=100,velocity=new THREE.Vector3(),ballVel=new THREE.Vector3(),last=performance.now(),lastShot=0;const facing=new THREE.Vector3(0,0,-1);
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){e.preventDefault();shoot()}if(e.code==='KeyE')pass();if(e.code==='Escape')togglePause()});addEventListener('keyup',e=>keys[e.code]=false);
document.querySelectorAll('[data-key]').forEach(b=>{let k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true});['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>keys[k]=false))});
function shoot(){if(!running||paused||performance.now()-lastShot<420)return;lastShot=performance.now();const d=player.position.distanceTo(ball.position);if(d<3.8){const dir=facing.clone();dir.x+=THREE.MathUtils.clamp(-player.position.x*.018,-.22,.22);dir.y=0;dir.normalize();ball.position.y=Math.max(ball.position.y,.48);ballVel.copy(dir.multiplyScalar(20));ballVel.y=2.2;matchStats.shots++;refreshStats();document.getElementById('status').textContent='SHOT!';announce('SHOT!');}}
function pass(){if(!running||paused)return;const d=player.position.distanceTo(ball.position);if(d<4){const dir=facing.clone();dir.x+=THREE.MathUtils.clamp(-player.position.x*.025,-.35,.35);dir.y=0;dir.normalize();ballVel.copy(dir.multiplyScalar(12));ballVel.y=.8;matchStats.passes++;refreshStats();document.getElementById('status').textContent='THROUGH BALL';announce('THROUGH BALL!');}}
function togglePause(){if(!running)return;paused=!paused;document.getElementById('status').textContent=paused?'PAUSED':'PLAYING';document.getElementById('pause').textContent=paused?'▶':'Ⅱ';}document.getElementById('pause').onclick=togglePause;document.getElementById('shoot').onclick=shoot;document.getElementById('pass').onclick=pass;document.getElementById('sprint').onpointerdown=()=>keys.ShiftLeft=true;document.getElementById('sprint').onpointerup=()=>keys.ShiftLeft=false;
function start(){window.__VETER_GAME_STARTED=true;goals=0;matchStats={shots:0,passes:0,saves:0};refreshStats();notice.style.opacity='0';matchLength=Number(document.getElementById('veterLength').value)||90;time=matchLength;difficultyScale={easy:.72,normal:1,hard:1.35}[document.getElementById('veterDifficulty').value]||1;const teamColors={blue:0x2563eb,green:0x16834a,gold:0xc49a22};player.userData.kit.color.setHex(teamColors[document.getElementById('veterTeam').value]||0x2563eb);stamina=100;paused=false;document.getElementById('pause').textContent='Ⅱ';document.getElementById('status').textContent='PLAYING';document.getElementById('goals').textContent=0;document.getElementById('clock').textContent=Math.ceil(matchLength);player.position.set(0,0,27);player.rotation.y=0;facing.set(0,0,-1);ball.position.set(0,.4,23);ballVel.set(0,0,0);opponents.forEach((o,i)=>{o.position.set((i-1)*5,-8-i*7,0);o.rotation.y=0;});keeper.position.set(0,0,-39);running=true;document.getElementById('intro').classList.add('hidden');document.getElementById('result').classList.add('hidden')}
document.getElementById('kickoff').onclick=start;document.getElementById('again').onclick=start;
function finish(){running=false;document.getElementById('finalGoals').textContent=goals;const resultText=document.querySelector('#result .modal p');if(resultText)resultText.innerHTML='You scored <b>'+goals+'</b> goal(s)!<br>Shots: '+matchStats.shots+' · Passes: '+matchStats.passes+' · Saves: '+matchStats.saves+'<br>Difficulty: '+document.getElementById('veterDifficulty').value.toUpperCase();document.getElementById('result').classList.remove('hidden')}
function animate(now){requestAnimationFrame(animate);let dt=Math.min((now-last)/1000,.04);last=now;if(running&&!paused){time-=dt;if(time<=0){time=0;finish()}document.getElementById('clock').textContent=Math.ceil(time);let x=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),z=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0);const sprinting=!!keys.ShiftLeft&&stamina>0&&!!(x||z);if(sprinting)stamina=Math.max(0,stamina-25*dt);else stamina=Math.min(100,stamina+12*dt);document.getElementById('staminaText').textContent=Math.round(stamina);document.getElementById('staminaBar').style.width=stamina+'%';let speed=sprinting?9.2:5.8;let v=new THREE.Vector3(x,0,z);if(v.length()){v.normalize();facing.lerp(v,.28).normalize();player.rotation.y=Math.atan2(facing.x,-facing.z);v.multiplyScalar(speed*dt);}player.position.x=THREE.MathUtils.clamp(player.position.x+v.x,-26,26);player.position.z=THREE.MathUtils.clamp(player.position.z+v.z,-42,39);
// Close control: guide the ball just ahead of the player's facing direction.
const ballDistance=player.position.distanceTo(ball.position);if(ballDistance<2.35&&ballVel.length()<8){const target=player.position.clone().addScaledVector(facing,1.05);target.y=.38;ball.position.lerp(target,Math.min(1,dt*12));ballVel.multiplyScalar(.72);}
ball.position.addScaledVector(ballVel,dt);ballVel.multiplyScalar(Math.pow(.985,dt*60));if(ball.position.y>.4){ballVel.y-=12*dt;ball.position.y+=ballVel.y*dt;if(ball.position.y<.4){ball.position.y=.4;ballVel.y*=-.35}}
opponents.forEach((enemy,i)=>{const target=ball.position;const dx=target.x-enemy.position.x,dz=target.z-enemy.position.z,len=Math.hypot(dx,dz)||1;const pace=(1.65+i*.22)*difficultyScale;enemy.position.x+=dx/len*pace*dt;enemy.position.z+=dz/len*pace*dt;enemy.position.x=THREE.MathUtils.clamp(enemy.position.x,-24,24);enemy.position.z=THREE.MathUtils.clamp(enemy.position.z,-35,18);enemy.rotation.y=Math.atan2(dx,-dz);if(enemy.position.distanceTo(player.position)<1.15&&ballDistance<2.8&&ballVel.length()<5){const steal=new THREE.Vector3(enemy.position.x-ball.position.x,0,enemy.position.z-ball.position.z).normalize();ballVel.copy(steal.multiplyScalar(5));document.getElementById('status').textContent='PRESSURE!';}});keeper.position.x=THREE.MathUtils.clamp(ball.position.x*.7,-6,6);if(ball.position.z<-38&&Math.abs(ball.position.x-keeper.position.x)<2.3&&ball.position.y<4&&ballVel.z<0){matchStats.saves++;refreshStats();announce('GREAT SAVE!');ballVel.z=Math.abs(ballVel.z)*.72;ballVel.x+=(ball.position.x-keeper.position.x)*2;ball.position.z=-37;document.getElementById('status').textContent='SAVE!';} if(ball.position.z<-43&&Math.abs(ball.position.x)<9){goals++;document.getElementById('goals').textContent=goals;announce('GOAL! VETER FC!');ball.position.set(0,.4,23);ballVel.set(0,0,0)}
if(Math.abs(ball.position.x)>29||Math.abs(ball.position.z)>47){ball.position.set(0,.4,23);ballVel.set(0,0,0)}
}
// Simple articulated walk cycles for the player and AI characters
const movers=[player,...opponents,keeper];movers.forEach((actor,index)=>{const moving=actor===player?(Math.abs(keys.ArrowRight||keys.KeyD?1:0)+Math.abs(keys.ArrowLeft||keys.KeyA?1:0)+Math.abs(keys.ArrowUp||keys.KeyW?1:0)+Math.abs(keys.ArrowDown||keys.KeyS?1:0)>0):actor.position.distanceTo(ball.position)>1.8;actor.userData.walkPhase=(actor.userData.walkPhase||0)+(moving?dt*(sprintingSafe(index)?10:7):dt*1.5);const swing=moving?Math.sin(actor.userData.walkPhase)*.48:Math.sin(actor.userData.walkPhase)*.025;(actor.userData.legs||[]).forEach((leg,i)=>leg.rotation.x=(i===0?1:-1)*swing);(actor.userData.arms||[]).forEach((arm,i)=>arm.rotation.x=(i===0?-1:1)*swing*.75);if(actor.userData.body)actor.userData.body.rotation.z=moving?Math.sin(actor.userData.walkPhase*2)*.025:0;});
function sprintingSafe(index){return index===0&&!!keys.ShiftLeft;}
const cameraTarget=new THREE.Vector3(player.position.x-facing.x*1.5,8.5,player.position.z-facing.z*1.5+13);camera.position.lerp(cameraTarget,.075);const lookTarget=player.position.clone().addScaledVector(facing,7);lookTarget.y=1.4;camera.lookAt(lookTarget);renderer.render(scene,camera);drawMiniMap()}
function drawMiniMap(){const c=mapCtx;if(!c)return;c.clearRect(0,0,248,360);c.fillStyle='#246b3a';c.fillRect(14,12,220,336);c.strokeStyle='#e8f4e8';c.lineWidth=2;c.strokeRect(14,12,220,336);c.beginPath();c.moveTo(14,180);c.lineTo(234,180);c.stroke();c.beginPath();c.arc(124,180,32,0,Math.PI*2);c.stroke();const dot=(x,z,color,r)=>{c.fillStyle=color;c.beginPath();c.arc(124+x*3.65,180+z*3.55,r,0,Math.PI*2);c.fill()};dot(player.position.x,player.position.z,'#62b5ff',7);opponents.forEach(o=>dot(o.position.x,o.position.z,'#ff6464',6));dot(keeper.position.x,keeper.position.z,'#ffd34e',6);dot(ball.position.x,ball.position.z,'#ffffff',4)}
requestAnimationFrame(animate);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
})();
