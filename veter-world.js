
import * as THREE from 'https://esm.sh/three@0.160.0';
(()=>{const root=document.getElementById('game');
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
function human(x,z,jersey,isKeeper=false){const g=new THREE.Group();g.position.set(x,0,z);const kit=mat(jersey,.58),shorts=mat(isKeeper?0x26364a:0x17212b),sock=mat(isKeeper?0xffd34f:0xe8e8e8),shoe=mat(0x11151b,.45);
const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.43,.92,6,12),kit);torso.position.y=1.58;torso.castShadow=true;g.add(torso);
const neck=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,.2,10),skin);neck.position.y=2.18;g.add(neck);
const head=new THREE.Mesh(new THREE.SphereGeometry(.3,20,16),skin);head.position.y=2.48;head.castShadow=true;g.add(head);
const hair=new THREE.Mesh(new THREE.SphereGeometry(.305,16,8,0,Math.PI*2,0,Math.PI*.48),mat(0x241a15));hair.position.y=2.55;g.add(hair);
const shortsMesh=new THREE.Mesh(new THREE.BoxGeometry(.72,.38,.48),shorts);shortsMesh.position.y=.96;g.add(shortsMesh);
for(let s of [-1,1]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.145,.62,5,10),skin);leg.position.set(s*.22,.53,0);g.add(leg);const sockMesh=new THREE.Mesh(new THREE.CylinderGeometry(.13,.14,.42,10),sock);sockMesh.position.set(s*.22,.29,0);g.add(sockMesh);const boot=new THREE.Mesh(new THREE.BoxGeometry(.24,.13,.4),shoe);boot.position.set(s*.22,.09,-.12);g.add(boot);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.125,.65,5,10),skin);arm.position.set(s*.55,1.55,0);arm.rotation.z=s*.18;g.add(arm);const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.14,.15,.28,10),kit);sleeve.position.set(s*.55,1.83,0);sleeve.rotation.z=s*.18;g.add(sleeve)}
// subtle chest stripe and collar
const stripe=new THREE.Mesh(new THREE.BoxGeometry(.12,.88,.025),mat(isKeeper?0xffffff:0xd9e2e9));stripe.position.set(0,1.58,-.435);g.add(stripe);
if(isKeeper){const gloves=mat(0xffcc36);for(let s of [-1,1]){const gl=new THREE.Mesh(new THREE.SphereGeometry(.2,12,10),gloves);gl.position.set(s*.7,1.15,0);g.add(gl)}}scene.add(g);return g}
const player=human(0,27,0x111827),opponents=[human(-5,-8,0xb62f36),human(5,-15,0xb62f36),human(0,-23,0xb62f36)],keeper=human(0,-39,0xf0c52d,true);
const ball=new THREE.Mesh(new THREE.SphereGeometry(.38,28,20),ballmat);ball.position.set(0,.4,23);ball.castShadow=true;scene.add(ball);
for(let i=0;i<5;i++){const patch=new THREE.Mesh(new THREE.CircleGeometry(.105,6),mat(0x20252a));patch.position.set(Math.cos(i*Math.PI*2/5)*.365,.4+Math.sin(i*Math.PI*2/5)*.12,23);patch.lookAt(ball.position.clone().add(new THREE.Vector3(Math.cos(i*Math.PI*2/5),0,Math.sin(i*Math.PI*2/5))));ball.add(patch)}
const keys={};let running=false,paused=false,goals=0,time=90,stamina=100,velocity=new THREE.Vector3(),ballVel=new THREE.Vector3(),last=performance.now(),lastShot=0;
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'){e.preventDefault();shoot()}if(e.code==='KeyE')pass();if(e.code==='Escape')togglePause()});addEventListener('keyup',e=>keys[e.code]=false);
document.querySelectorAll('[data-key]').forEach(b=>{let k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true});['pointerup','pointercancel','pointerleave'].forEach(ev=>b.addEventListener(ev,()=>keys[k]=false))});
function shoot(){if(!running||paused||performance.now()-lastShot<500)return;lastShot=performance.now();const d=player.position.distanceTo(ball.position);if(d<3.5){const aim=THREE.MathUtils.clamp(player.position.x*.08+(Math.random()-.5)*.45,-.85,.85);ballVel.set(aim*10,-.1,-(18+Math.random()*5));document.getElementById('status').textContent='SHOT!';}}
function pass(){if(!running||paused)return;const d=player.position.distanceTo(ball.position);if(d<4){ballVel.set((player.position.x-ball.position.x)*.7,1,-10);document.getElementById('status').textContent='PASS';}}
function togglePause(){if(!running)return;paused=!paused;document.getElementById('status').textContent=paused?'PAUSED':'PLAYING';document.getElementById('pause').textContent=paused?'▶':'Ⅱ';}document.getElementById('pause').onclick=togglePause;document.getElementById('shoot').onclick=shoot;document.getElementById('pass').onclick=pass;document.getElementById('sprint').onpointerdown=()=>keys.ShiftLeft=true;document.getElementById('sprint').onpointerup=()=>keys.ShiftLeft=false;
function start(){window.__VETER_GAME_STARTED=true;goals=0;time=90;stamina=100;paused=false;document.getElementById('pause').textContent='Ⅱ';document.getElementById('status').textContent='PLAYING';document.getElementById('goals').textContent=0;document.getElementById('clock').textContent=90;player.position.set(0,0,27);ball.position.set(0,.4,23);ballVel.set(0,0,0);running=true;document.getElementById('intro').classList.add('hidden');document.getElementById('result').classList.add('hidden')}
document.getElementById('kickoff').onclick=start;document.getElementById('again').onclick=start;
function finish(){running=false;document.getElementById('finalGoals').textContent=goals;document.getElementById('result').classList.remove('hidden')}
function animate(now){requestAnimationFrame(animate);let dt=Math.min((now-last)/1000,.04);last=now;if(running&&!paused){time-=dt;if(time<=0){time=0;finish()}document.getElementById('clock').textContent=Math.ceil(time);let x=(keys.ArrowRight||keys.KeyD?1:0)-(keys.ArrowLeft||keys.KeyA?1:0),z=(keys.ArrowDown||keys.KeyS?1:0)-(keys.ArrowUp||keys.KeyW?1:0);const sprinting=!!keys.ShiftLeft&&stamina>0&&!!(x||z);if(sprinting)stamina=Math.max(0,stamina-25*dt);else stamina=Math.min(100,stamina+12*dt);document.getElementById('staminaText').textContent=Math.round(stamina);document.getElementById('staminaBar').style.width=stamina+'%';let speed=sprinting?10:6;let v=new THREE.Vector3(x,0,z);if(v.length())v.normalize().multiplyScalar(speed*dt);player.position.x=THREE.MathUtils.clamp(player.position.x+v.x,-26,26);player.position.z=THREE.MathUtils.clamp(player.position.z+v.z,-42,39);
if(player.position.distanceTo(ball.position)<1.65&&ballVel.length()<2){ball.position.x=player.position.x;ball.position.z=player.position.z-1.2}
ball.position.addScaledVector(ballVel,dt);ballVel.multiplyScalar(Math.pow(.985,dt*60));if(ball.position.y>.4){ballVel.y-=12*dt;ball.position.y+=ballVel.y*dt;if(ball.position.y<.4){ball.position.y=.4;ballVel.y*=-.35}}
opponents.forEach((enemy,i)=>{const target=ballVel.length()>.7?ball.position:player.position;const dx=target.x-enemy.position.x,dz=target.z-enemy.position.z,len=Math.hypot(dx,dz)||1;const pace=2.1+i*.25;enemy.position.x+=dx/len*pace*dt;enemy.position.z+=dz/len*pace*dt;enemy.position.x=THREE.MathUtils.clamp(enemy.position.x,-24,24);enemy.position.z=THREE.MathUtils.clamp(enemy.position.z,-35,18);if(enemy.position.distanceTo(player.position)<1.35&&player.position.distanceTo(ball.position)<2.4){ballVel.set((enemy.position.x-ball.position.x)*2,1,5);document.getElementById('status').textContent='TACKLED';}});keeper.position.x=THREE.MathUtils.clamp(ball.position.x*.7,-6,6);if(ball.position.z<-38&&Math.abs(ball.position.x-keeper.position.x)<2.3&&ball.position.y<4&&ballVel.z<0){ballVel.z=Math.abs(ballVel.z)*.72;ballVel.x+=(ball.position.x-keeper.position.x)*2;ball.position.z=-37;document.getElementById('status').textContent='SAVE!';} if(ball.position.z<-43&&Math.abs(ball.position.x)<9){goals++;document.getElementById('goals').textContent=goals;ball.position.set(0,.4,23);ballVel.set(0,0,0)}
if(Math.abs(ball.position.x)>29||Math.abs(ball.position.z)>47){ball.position.set(0,.4,23);ballVel.set(0,0,0)}
}
camera.position.lerp(new THREE.Vector3(player.position.x*.35,12,player.position.z+20),.06);camera.lookAt(player.position.x*.3,0,player.position.z-8);renderer.render(scene,camera)}
requestAnimationFrame(animate);addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
})();
