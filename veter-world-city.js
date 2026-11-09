import * as THREE from 'https://esm.sh/three@0.160.0';

(()=>{
const canvas=document.querySelector('#game'), scene=new THREE.Scene();
scene.background=new THREE.Color(0x91b9d0); scene.fog=new THREE.Fog(0x91b9d0,95,310);
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,600);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
scene.add(new THREE.HemisphereLight(0xdceeff,0x59604c,1.7));
const sun=new THREE.DirectionalLight(0xffe4b8,3.1);sun.position.set(-65,100,45);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-130;sun.shadow.camera.right=130;sun.shadow.camera.top=130;sun.shadow.camera.bottom=-130;scene.add(sun);
const mat=(c,rough=.88)=>new THREE.MeshStandardMaterial({color:c,roughness:rough});
function makeTexture(base,windowColor,seed=1){
 const c=document.createElement('canvas');c.width=256;c.height=512;const g=c.getContext('2d');
 g.fillStyle=base;g.fillRect(0,0,256,512);
 // subtle facade variation
 for(let i=0;i<900;i++){g.fillStyle=`rgba(20,25,28,${Math.random()*.055})`;g.fillRect(Math.random()*256,Math.random()*512,2+Math.random()*12,2+Math.random()*12)}
 for(let y=18;y<500;y+=38)for(let x=12;x<250;x+=34){
  g.fillStyle='#343f46';g.fillRect(x-2,y-2,25,28);g.fillStyle=windowColor;g.fillRect(x,y,21,24);
  g.fillStyle='rgba(255,255,255,.22)';g.fillRect(x+2,y+2,3,19);
 }
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
}
function asphaltTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.fillStyle='#343a3d';g.fillRect(0,0,512,512);
 for(let i=0;i<12000;i++){let v=Math.random()*55;g.fillStyle=`rgba(${v},${v},${v},.22)`;g.fillRect(Math.random()*512,Math.random()*512,1+Math.random()*3,1+Math.random()*2)}
 let t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,5);return t;
}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(850,850),mat(0x526d49));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const roadMat=new THREE.MeshStandardMaterial({map:asphaltTexture(),roughness:1}),lineMat=mat(0xe1d6a6),sideMat=mat(0x9c9c91);
function slab(x,z,w,d,y,m){let o=new THREE.Mesh(new THREE.BoxGeometry(w,y,d),m);o.position.set(x,y/2,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o}
for(let k=-380;k<=380;k+=40){
 let r=new THREE.Mesh(new THREE.BoxGeometry(820,.11,13),roadMat);r.position.set(0,.015,k);scene.add(r);
 let r2=new THREE.Mesh(new THREE.BoxGeometry(13,.11,820),roadMat);r2.position.set(k,.015,0);scene.add(r2);
 // raised sidewalks on both sides of every road
 for(let side of [-1,1]){let sw=slab(0,k+side*8.1,820,2.8,.22,sideMat);let sw2=slab(k+side*8.1,0,2.8,820,.22,sideMat)}
 for(let q=-400;q<=400;q+=12){
  let d=new THREE.Mesh(new THREE.BoxGeometry(3,.025,.18),lineMat);d.position.set(q,.09,k);scene.add(d);
  let d2=new THREE.Mesh(new THREE.BoxGeometry(.18,.025,3),lineMat);d2.position.set(k,.09,q);scene.add(d2);
 }
 // crosswalk stripes at intersections
 for(let n=-2;n<=2;n++){let a=new THREE.Mesh(new THREE.BoxGeometry(1.1,.03,5),mat(0xd5d4c7));a.position.set(k+n*1.6,.105,k+9);scene.add(a)}
}
const buildingColliders=[];
const facades=[['#b7aa96','#85a6b5'],['#8e9da4','#a5c1cb'],['#c9bba7','#7797a7'],['#a3b1a0','#8caebd'],['#b29d96','#9bb6bf'],['#89969b','#b5c8ca']];
for(let x=-380;x<=380;x+=40)for(let z=-380;z<=380;z+=40){
 if(Math.abs(x)<=20&&Math.abs(z)<=20)continue;
 for(let dx of [-10,10])for(let dz of [-10,10]){
  if(Math.random()<.12)continue;
  let w=8+Math.random()*5,d=8+Math.random()*5,h=12+Math.random()*35;
  let pair=facades[Math.floor(Math.random()*facades.length)],tex=makeTexture(pair[0],pair[1]);
  let b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({map:tex,roughness:.82}));
  b.position.set(x+dx,h/2,z+dz);b.castShadow=true;b.receiveShadow=true;scene.add(b);buildingColliders.push({x:x+dx,z:z+dz,w,d});
  let roof=new THREE.Mesh(new THREE.BoxGeometry(w+.2,.35,d+.2),mat(0x596168));roof.position.set(x+dx,h+.17,z+dz);scene.add(roof);
  // ground-floor storefront-like glazing (decorative only; no stores)
  let glass=new THREE.Mesh(new THREE.BoxGeometry(w*.72,2.5,.12),mat(0x3d6674,.35));glass.position.set(x+dx,1.6,z+dz+d/2+.08);scene.add(glass);
 }
}
function tree(x,z){let trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,2.2,8),mat(0x60452f));trunk.position.set(x,1.1,z);scene.add(trunk);let crown=new THREE.Mesh(new THREE.SphereGeometry(1.65,12,10),mat(0x2f6841));crown.position.set(x,3.1,z);crown.castShadow=true;scene.add(crown)}
for(let i=0;i<520;i++){let x=(Math.random()-.5)*780,z=(Math.random()-.5)*780;if(Math.abs(x%40)<9||Math.abs(z%40)<9)continue;tree(x,z)}
// street lamps, poles, and pools of warm light
for(let x=-380;x<=380;x+=40)for(let z=-380;z<=380;z+=40)for(let side of [-1,1]){
 let px=x+side*9,pz=z+9;
 let pole=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,5,7),mat(0x41494c));pole.position.set(px,2.5,pz);scene.add(pole);
 let arm=new THREE.Mesh(new THREE.BoxGeometry(1.4,.1,.1),mat(0x41494c));arm.position.set(px+.6,4.8,pz);scene.add(arm);
 let bulb=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),new THREE.MeshBasicMaterial({color:0xffe1a3}));bulb.position.set(px+1.2,4.7,pz);scene.add(bulb);
}
// Enterable civic hall and a compact indoor room
const civic=new THREE.Group();scene.add(civic);
let hall=new THREE.Mesh(new THREE.BoxGeometry(17,8,12),new THREE.MeshStandardMaterial({map:makeTexture('#b8b3a6','#91b8c5')}));hall.position.set(10,4,-14);hall.castShadow=true;hall.receiveShadow=true;civic.add(hall);
let hallRoof=new THREE.Mesh(new THREE.BoxGeometry(17.5,.5,12.5),mat(0x454e52));hallRoof.position.set(10,8.2,-14);civic.add(hallRoof);
let hallDoor=new THREE.Mesh(new THREE.BoxGeometry(2.2,3,.2),mat(0x263b46));hallDoor.position.set(10,1.5,-7.9);civic.add(hallDoor);
let sign=new THREE.Mesh(new THREE.BoxGeometry(7,.8,.18),mat(0x1e5c50));sign.position.set(10,6.3,-7.8);civic.add(sign);
let interior=new THREE.Group();scene.add(interior);interior.position.y=-55;
let floor=new THREE.Mesh(new THREE.BoxGeometry(22,.3,18),mat(0x8b8b83));floor.position.set(0,-.15,0);interior.add(floor);
for(let [x,z,w,d] of [[0,-9,22,.4],[0,9,22,.4],[-11,0,.4,18],[11,0,.4,18]]){let wall=new THREE.Mesh(new THREE.BoxGeometry(w,6,d),mat(0xc7c0ad));wall.position.set(x,3,z);interior.add(wall)}
let desk=new THREE.Mesh(new THREE.BoxGeometry(5,1.2,1.8),mat(0x684a34));desk.position.set(0,.6,-4);interior.add(desk);
let board=new THREE.Mesh(new THREE.BoxGeometry(5,2.2,.15),mat(0x2c5e55));board.position.set(0,3,-8.7);interior.add(board);
let indoorLight=new THREE.PointLight(0xffe6bd,28,24);indoorLight.position.set(0,4,0);interior.add(indoorLight);
let inside=false,activeInterior=0;
const interiors=[
 {name:'Civic Hall',door:new THREE.Vector3(10,0,-6.5),outside:new THREE.Vector3(10,0,-5.5),offset:-55},
 {name:'Community Clinic',door:new THREE.Vector3(-12,0,0),outside:new THREE.Vector3(-12,0,1),offset:-80},
 {name:'Apartment Lobby',door:new THREE.Vector3(12,0,0),outside:new THREE.Vector3(12,0,1),offset:-105},
 {name:'Riverside Library',door:new THREE.Vector3(-82,0,-82),outside:new THREE.Vector3(-82,0,-81),offset:-130},
 {name:'Community Sports Hall',door:new THREE.Vector3(82,0,-82),outside:new THREE.Vector3(82,0,-81),offset:-155},
 {name:'Hilltop Museum',door:new THREE.Vector3(-82,0,82),outside:new THREE.Vector3(-82,0,83),offset:-180}
];
for(let i=3;i<interiors.length;i++){const it=interiors[i];const arch=new THREE.Group();arch.position.set(it.door.x,0,it.door.z);for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(.4,3,.4),mat([0x5bbbd1,0xd2a35c,0x9d83cf][i-3]));post.position.set(side*1.4,1.5,0);arch.add(post)}const lintel=new THREE.Mesh(new THREE.BoxGeometry(3.2,.4,.5),mat(0xe4e0cf));lintel.position.y=3;arch.add(lintel);scene.add(arch)}
function buildRoom(offset,kind){
 let group=new THREE.Group();group.position.y=offset;scene.add(group);
 let wallMat=mat(kind===1?0xdce1df:0xc7c0ad),floorMat=mat(kind===1?0x9ba9a8:0x8b8b83);
 let fl=new THREE.Mesh(new THREE.BoxGeometry(22,.3,18),floorMat);fl.position.y=-.15;group.add(fl);
 for(let [x,z,w,d] of [[0,-9,22,.4],[0,9,22,.4],[-11,0,.4,18],[11,0,.4,18]]){let wall=new THREE.Mesh(new THREE.BoxGeometry(w,6,d),wallMat);wall.position.set(x,3,z);group.add(wall)}
 if(kind===0){let desk=new THREE.Mesh(new THREE.BoxGeometry(5,1.2,1.8),mat(0x684a34));desk.position.set(0,.6,-4);group.add(desk);let board=new THREE.Mesh(new THREE.BoxGeometry(5,2.2,.15),mat(0x2c5e55));board.position.set(0,3,-8.7);group.add(board)}
 if(kind===1){for(let i=0;i<3;i++){let bed=new THREE.Mesh(new THREE.BoxGeometry(3,.55,5),mat(0x6e9fae));bed.position.set(-6+i*6,.3,-2);group.add(bed)}}
 if(kind===2){let sofa=new THREE.Mesh(new THREE.BoxGeometry(5,1,2),mat(0x526b70));sofa.position.set(0,.5,2);group.add(sofa);let plant=new THREE.Mesh(new THREE.ConeGeometry(.9,2,8),mat(0x3d7546));plant.position.set(7,1,5);group.add(plant)}
 if(kind===0){for(let x of [-7,7]){let chair=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1),mat(0x405c67));chair.position.set(x,.55,1);group.add(chair)}}
 if(kind===1){let counter=new THREE.Mesh(new THREE.BoxGeometry(6,1.1,1.4),mat(0x4f777c));counter.position.set(0,.55,-6);group.add(counter);for(let x of [-7,0,7]){let screen=new THREE.Mesh(new THREE.BoxGeometry(1.2,1,.12),mat(0x263c46));screen.position.set(x,2,-8.5);group.add(screen)}}
 if(kind===2){let table=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,.18,12),mat(0x75563e));table.position.set(-6,.8,-3);group.add(table);for(let x of [-7,7]){let frame=new THREE.Mesh(new THREE.BoxGeometry(2,2,.12),mat(0x9caaad));frame.position.set(x,3,-8.65);group.add(frame)}}
 if(kind===0){for(let x of [-8,-5,5,8]){let shelf=new THREE.Mesh(new THREE.BoxGeometry(1,3.4,6),mat(0x674b37));shelf.position.set(x,1.7,0);group.add(shelf);for(let y=.65;y<3;y+=.7){let books=new THREE.Mesh(new THREE.BoxGeometry(.8,.35,5.6),mat(0x4d7781));books.position.set(x,y,0);group.add(books)}}}
 if(kind===1){for(let x of [-7,7]){let hoop=new THREE.Mesh(new THREE.TorusGeometry(1,.08,8,20),mat(0xe4e4e4));hoop.position.set(x,3.2,-7);group.add(hoop)}let court=new THREE.Mesh(new THREE.BoxGeometry(12,.04,7),mat(0x497c65));court.position.set(0,.05,1);group.add(court)}
 if(kind===2){for(let x of [-7,0,7]){let plinth=new THREE.Mesh(new THREE.BoxGeometry(2,.8,2),mat(0x8b8b87));plinth.position.set(x,.4,-2);group.add(plinth);let artifact=new THREE.Mesh(new THREE.DodecahedronGeometry(.7),mat(0xb58b51));artifact.position.set(x,1.3,-2);group.add(artifact)}}
 let light=new THREE.PointLight(0xffe6bd,24,24);light.position.set(0,4,0);group.add(light);return group;
}
const roomGroups=interiors.map((it,i)=>buildRoom(it.offset,i%3));
for(let [x,color,label] of [[-12,0x55bde0,0x2b7289],[12,0xe6c36a,0x94723d]]){
 let arch=new THREE.Group();arch.position.set(x,0,-2);
 for(let side of [-1,1]){let post=new THREE.Mesh(new THREE.BoxGeometry(.35,3,.35),mat(color));post.position.set(side*1.35,1.5,0);arch.add(post)}
 let top=new THREE.Mesh(new THREE.BoxGeometry(3.1,.35,.4),mat(color));top.position.y=3;arch.add(top);scene.add(arch);
 let plate=new THREE.Mesh(new THREE.BoxGeometry(2.2,.65,.15),mat(label));plate.position.set(x,3.6,-1.75);scene.add(plate);
}

const hallDoorPoint=new THREE.Vector3(10,0,-6.5);
const parkPoint=new THREE.Vector3(35,0,35);
const park=new THREE.Mesh(new THREE.PlaneGeometry(22,22),mat(0x3f8a4d));park.rotation.x=-Math.PI/2;park.position.set(35,.035,35);scene.add(park);
for(let [bx,bz] of [[27,27],[43,27],[27,43],[43,43]]){let bench=new THREE.Group();let seat=new THREE.Mesh(new THREE.BoxGeometry(2,.18,.65),mat(0x79563a));seat.position.y=.65;bench.add(seat);for(let lx of [-.75,.75]){let leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.65,.12),mat(0x45494a));leg.position.set(lx,.32,0);bench.add(leg)}bench.position.set(bx,0,bz);scene.add(bench)}
for(let [tx,tz] of [[25,35],[45,35],[35,25],[35,45]]){let trunk=new THREE.Mesh(new THREE.CylinderGeometry(.2,.28,2,7),mat(0x65452d));trunk.position.set(tx,1,tz);scene.add(trunk);let crown=new THREE.Mesh(new THREE.SphereGeometry(1.5,9,8),mat(0x286b3b));crown.position.set(tx,2.8,tz);scene.add(crown)}
// player
function makeHuman(shirtColor=0x2367c9,skinColor=0xd5a77f){
 const root=new THREE.Group(),shirt=mat(shirtColor),skin=mat(skinColor),pants=mat(0x263344);
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.43,.72,5,9),shirt);torso.position.y=1.28;torso.castShadow=true;root.add(torso);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.31,12,10),skin);head.position.y=2.08;root.add(head);
 const hair=new THREE.Mesh(new THREE.SphereGeometry(.32,12,8,0,Math.PI*2,0,Math.PI*.48),mat(0x30251f));hair.position.y=2.2;root.add(hair);
 const eyeMat=new THREE.MeshStandardMaterial({color:0xf4f0e8,roughness:.45}),pupilMat=mat(0x252525),mouthMat=mat(0x713e3b);
 const eyes=[];
 for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),eyeMat);eye.position.set(side*.115,2.105,.265);root.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.025,7,7),pupilMat);pupil.position.set(side*.115,2.105,.31);root.add(pupil);eyes.push(eye)}
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.055,7,7),skin);nose.scale.set(.7,1,1);nose.position.set(0,2.02,.3);root.add(nose);
 const mouth=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,.025),mouthMat);mouth.position.set(0,1.96,.292);root.add(mouth);
 const ears=[];for(const side of [-1,1]){let ear=new THREE.Mesh(new THREE.SphereGeometry(.07,7,7),skin);ear.position.set(side*.3,2.05,0);root.add(ear);ears.push(ear)}
 const limbs=[];
 for(let side of [-1,1]){
  const arm=new THREE.Group();arm.position.set(side*.53,1.62,0);
  const upper=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.48,4,7),shirt);upper.position.y=-.3;arm.add(upper);root.add(arm);limbs.push(arm);
  const leg=new THREE.Group();leg.position.set(side*.22,.82,0);
  const thigh=new THREE.Mesh(new THREE.CapsuleGeometry(.16,.53,4,7),pants);thigh.position.y=-.28;leg.add(thigh);
  const shoe=new THREE.Mesh(new THREE.BoxGeometry(.25,.13,.4),mat(0x222326));shoe.position.set(0,-.59,.08);leg.add(shoe);root.add(leg);limbs.push(leg);
 }
 return {root,torso,head,limbs,shirt,skin,hair,eyes,mouth};
}
const playerRig=makeHuman();const player=playerRig.root;scene.add(player);
const body=playerRig.torso,head=playerRig.head;
let importedPlayerModel=null,playerMixer=null,playerMorphTargets=[],cinemaState=null;
const modelInput=document.querySelector('#modelFile');
document.querySelector('#modelBtn').onclick=()=>modelInput.click();
modelInput.addEventListener('change',async()=>{
 const file=modelInput.files&&modelInput.files[0];if(!file)return;
 if(!file.name.toLowerCase().endsWith('.glb')&&!file.name.toLowerCase().endsWith('.gltf')){say('Please choose a .glb or .gltf 3D character file.');return}
 document.querySelector('#modelStatus').textContent='Loading 3D character…';
 try{
  // GLB is recommended because it packages textures and meshes in one file.
  const {GLTFLoader}=await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js');
  const loader=new GLTFLoader(),url=URL.createObjectURL(file);
  loader.load(url,gltf=>{
   URL.revokeObjectURL(url);
   if(importedPlayerModel)player.remove(importedPlayerModel);
   importedPlayerModel=gltf.scene;
   importedPlayerModel.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.morphTargetInfluences)playerMorphTargets.push(o)}});
   const box=new THREE.Box3().setFromObject(importedPlayerModel),size=box.getSize(new THREE.Vector3());
   const maxDim=Math.max(size.x,size.y,size.z)||1;importedPlayerModel.scale.setScalar(2.35/maxDim);
   const scaledBox=new THREE.Box3().setFromObject(importedPlayerModel);
   importedPlayerModel.position.y=-scaledBox.min.y;
   player.add(importedPlayerModel);playerRig.torso.visible=false;playerRig.head.visible=false;
   playerRig.limbs.forEach(x=>x.visible=false);playerRig.hair.visible=false;
   playerMixer=gltf.animations.length?new THREE.AnimationMixer(importedPlayerModel):null;
   if(playerMixer){const clip=gltf.animations.find(a=>/walk|idle/i.test(a.name))||gltf.animations[0];playerMixer.clipAction(clip).play()}
   document.querySelector('#modelStatus').textContent='Loaded: '+file.name+' · '+gltf.animations.length+' animation clips · facial morphs '+playerMorphTargets.length;
   say('3D character loaded!');URL.revokeObjectURL(url);
  },undefined,err=>{URL.revokeObjectURL(url);console.error(err);document.querySelector('#modelStatus').textContent='Could not load this model. Try a self-contained GLB file.';say('Model loading failed. Try a GLB file.')});
 }catch(err){console.error(err);document.querySelector('#modelStatus').textContent='3D loader could not start. Check internet access and try again.';say('Could not start the 3D model loader.')}
});
function animateFace(talking,now){
 if(!playerMorphTargets.length)return;
 for(const mesh of playerMorphTargets){
  const dict=mesh.morphTargetDictionary||{},weights=mesh.morphTargetInfluences||[];
  for(const [name,index] of Object.entries(dict)){
   const n=name.toLowerCase();
   if(n.includes('blink'))weights[index]=Math.max(weights[index]||0,Math.max(0,Math.sin(now*.0018))>.994?1:0);
   if(n.includes('mouthopen')||n.includes('jawopen')||n.includes('viseme_aa'))weights[index]=talking?(.12+Math.abs(Math.sin(now*.018))*.32):0;
  }
 }
}
function startCinematic(){
 cinemaState={start:performance.now(),duration:8500,origin:player.position.clone()};
 document.querySelector('#cinemaBars').style.display='block';
 say('Cinematic camera started!');
}
document.querySelector('#cinemaBtn').onclick=startCinematic;

const marker=new THREE.Mesh(new THREE.TorusGeometry(1.05,.09,8,24),new THREE.MeshBasicMaterial({color:0x4dff9b}));marker.rotation.x=Math.PI/2;marker.position.y=.12;scene.add(marker);
player.position.set(0,0,0);
// Optional exploration collectibles: six glowing community badges.
const badgeSpots=[[-42,-35],[-15,42],[35,35],[58,-28],[-62,12],[8,-58]];
const collectibles=[];
for(let i=0;i<badgeSpots.length;i++){
 const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.65),new THREE.MeshStandardMaterial({color:0xffd45c,emissive:0x8a5a08,emissiveIntensity:.7,metalness:.45,roughness:.25}));
 gem.position.set(badgeSpots[i][0],1.25,badgeSpots[i][1]);scene.add(gem);collectibles.push({mesh:gem,found:false});
}
let badgeCount=0;

const npcs=[],districtNames=['CENTRAL','RIVERSIDE','OLD TOWN','HILLSIDE','CIVIC QUARTER'];
for(let i=0;i<110;i++){let rig=makeHuman([0xd15b50,0xe0b94f,0x8a63bb,0x35a58a,0x426b9c][i%5],0xb98561);let g=rig.root;g.position.set((Math.random()-.5)*760,0,(Math.random()-.5)*760);scene.add(g);npcs.push({g,rig,angle:Math.random()*6.28,speed:.5+Math.random()*.5,home:g.position.clone(),routine:Math.random(),phase:Math.random()*6.28})}
let keys={},clock=8,stamina=100,health=100,cash=500,mission=0,toastTimer=0,jump=0;
let paused=false,rainOn=false,cameraDistance=13,autoSaveClock=0;
const rainCount=650,rainPositions=new Float32Array(rainCount*3);
for(let i=0;i<rainCount;i++){rainPositions[i*3]=(Math.random()-.5)*150;rainPositions[i*3+1]=Math.random()*35+5;rainPositions[i*3+2]=(Math.random()-.5)*150}
const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xb8d9ef,size:.12,transparent:true,opacity:.65}));rain.visible=false;scene.add(rain);
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p'||e.key==='Escape'){setPaused(!paused);return}if(paused)return;keys[e.key.toLowerCase()]=true;if(e.key===' ')e.preventDefault();if(e.key.toLowerCase()==='e')interact()});
addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
document.querySelectorAll('#mobile button').forEach(b=>{let k=b.dataset.k;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true});['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,()=>keys[k]=false))});
let voiceTalkingUntil=0;
function speakLine(t){if(!soundOn||!('speechSynthesis'in window))return;try{speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(t);u.rate=.96;u.pitch=1;u.volume=.8;u.onstart=()=>{voiceTalkingUntil=performance.now()+Math.max(1200,t.length*65)};u.onend=()=>{voiceTalkingUntil=0};speechSynthesis.speak(u)}catch(e){}}
function say(t){let el=document.querySelector('#toast');el.textContent=t;el.style.opacity=1;toastTimer=2.8}
function interact(){
 const badgeNear=collectibles.find(c=>!c.found&&c.mesh.position.distanceTo(player.position)<3.2);
 if(badgeNear){badgeNear.found=true;badgeNear.mesh.visible=false;badgeCount++;cash+=50;tinyChime();document.querySelector('#collectText').textContent=`Community badges: ${badgeCount} / 6`;say('Community badge found! +₹50');if(badgeCount===6){cash+=300;say('All six badges found! Bonus +₹300')}return}
 if(emergencyActive&&!emergencyDone&&player.position.distanceTo(emergencyPoint)<5){emergencyDone=true;emergencyActive=false;cash+=400;marker.visible=false;mission=3;document.querySelector('#missionText').textContent='Mission 2 complete. Talk to any neighbour for your next task.';say('Citizen assisted. +₹400');showStory('NEIGHBOURHOOD HERO','You helped someone in need. Now speak with a neighbour and keep making Veter City better.');return}
 if(inside){
  if(activeInterior===1){health=Math.min(100,health+35);stamina=100;say('Clinic visit complete. Health and stamina restored!')}
  else if(activeInterior===2){clock=(clock+8)%24;stamina=100;say('You rested at home. Eight hours passed.')}
  else say('Civic Hall service desk: city information updated.');
  inside=false;player.position.copy(interiors[activeInterior].outside);return
 }
 let door=interiors.findIndex(it=>player.position.distanceTo(it.door)<5);
 if(door>=0){activeInterior=door;inside=true;player.position.set(0,interiors[door].offset,5);say('Welcome inside '+interiors[door].name+'.');return}
 let near=null,dist=4;for(let n of npcs){let d=n.g.position.distanceTo(player.position);if(d<dist){dist=d;near=n}}
 if(near){say('Citizen: “Welcome to Veter City!”');speakLine('Hello there! Welcome to Veter City. How can I help you today?');if(mission===0){mission=1;document.querySelector('#missionText').textContent='Mission 1: Visit the green park marker.'}else if(mission===3){mission=4;cash+=150;document.querySelector('#missionText').textContent='Mission 3 complete. You earned ₹150. Explore the Civic Hall.';say('Neighbour helped! +₹150');showStory('THE CITY NEEDS YOU','A storm damaged the Riverside Library. Visit the library, check the community board, then return to the neighbour.')}
 else if(mission===4){mission=5;cash+=250;document.querySelector('#missionText').textContent='Mission 4 complete. Visit the Civic Hall for the final briefing.';say('Library supplies delivered! +₹250');showStory('RIVERSIDE RECOVERY','You helped the library reopen. The city coordinator has one final request: visit Civic Hall for the celebration.')} }
 else if(player.position.distanceTo(new THREE.Vector3(0,0,0))<5){say('Welcome to Veter City! Explore the city.')}
 else say('Nothing to interact with nearby.')
}
function updateMap(){
 let c=document.querySelector('#map'),ctx=c.getContext('2d');ctx.clearRect(0,0,150,150);
 ctx.fillStyle='#26363a';ctx.fillRect(0,0,150,150);
 const scale=.16,ox=75-player.position.x*scale,oz=75-player.position.z*scale;
 ctx.strokeStyle='#64736e';ctx.lineWidth=5;
 for(let k=-380;k<=380;k+=40){ctx.beginPath();ctx.moveTo(ox-130*scale,oz+k*scale);ctx.lineTo(ox+130*scale,oz+k*scale);ctx.stroke();ctx.beginPath();ctx.moveTo(ox+k*scale,oz-130*scale);ctx.lineTo(ox+k*scale,oz+130*scale);ctx.stroke()}
 ctx.fillStyle='#49e99a';ctx.beginPath();ctx.arc(ox+parkPoint.x*scale,oz+parkPoint.z*scale,4,0,7);ctx.fill();
 ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(75,75,4,0,7);ctx.fill();
 ctx.fillStyle='#ffcf67';for(let n of npcs){let x=ox+n.g.position.x*scale,z=oz+n.g.position.z*scale;if(x>0&&x<150&&z>0&&z<150){ctx.beginPath();ctx.arc(x,z,1.8,0,7);ctx.fill()}}
} 

// Police patrol and peaceful emergency-response event (no combat/weapons).
const police=makeHuman(0x243b68,0xb98561);scene.add(police.root);police.root.position.set(-35,0,30);
const badge=new THREE.Mesh(new THREE.BoxGeometry(.24,.24,.06),mat(0xf0cf62));badge.position.set(.4,1.5,.42);police.root.add(badge);
const beacon=new THREE.Group();police.root.add(beacon);
for(let [x,c] of [[-.22,0x347cff],[.22,0xff4141]]){let lamp=new THREE.Mesh(new THREE.BoxGeometry(.28,.16,.22),new THREE.MeshBasicMaterial({color:c}));lamp.position.set(x,2.35,0);beacon.add(lamp)}
let emergencyActive=false,emergencyPoint=new THREE.Vector3(-35,0,30),emergencyDone=false;
function startEmergency(){emergencyActive=true;emergencyDone=false;emergencyPoint.set(-35,0,30);say('City alert: a citizen needs help near the Civic Quarter.');document.querySelector('#missionText').textContent='Emergency response: reach the marked citizen and press E.';marker.visible=true;marker.position.copy(emergencyPoint)}
function showStory(title,body){document.querySelector('#sceneTitle').textContent=title;document.querySelector('#sceneText').textContent=body;document.querySelector('#cutscene').style.display='flex'}
document.querySelector('#sceneNext').onclick=()=>{document.querySelector('#cutscene').style.display='none';if(soundOn)speakLine(document.querySelector('#sceneText').textContent)};
function saveGame(){let data={x:player.position.x,z:player.position.z,cash,health,stamina,clock,mission,shirt:playerRig.shirt.color.getHex(),skin:playerRig.skin.color.getHex(),hair:playerRig.hair.material.color.getHex(),inside,activeInterior,badgeCount,mission,xp,careerLevel,petAdopted};localStorage.setItem('veterWorldSave',JSON.stringify(data));say('Game saved on this browser.')}
function loadGame(){let raw=localStorage.getItem('veterWorldSave')||localStorage.getItem('veterWorldAutoSave');if(!raw){say('No saved game found yet.');return}try{let d=JSON.parse(raw);player.position.set(d.x||0,0,d.z||0);cash=d.cash??500;health=d.health??100;stamina=d.stamina??100;clock=d.clock??8;mission=d.mission??0;playerRig.shirt.color.setHex(d.shirt||0x2367c9);if(d.skin)playerRig.skin.color.setHex(d.skin);if(d.hair)playerRig.hair.material.color.setHex(d.hair);badgeCount=d.badgeCount||0;xp=d.xp||0;careerLevel=d.careerLevel||0;if(d.petAdopted&&!pet){document.querySelector('#petBtn').click()}collectibles.forEach((c,i)=>{c.found=i<badgeCount;c.mesh.visible=!c.found});document.querySelector('#collectText').textContent=`Community badges: ${badgeCount} / 6`;inside=false;activeInterior=d.activeInterior||0;say('Saved game loaded.')}catch(e){say('Save file could not be loaded.')}}
document.querySelector('#saveBtn').onclick=saveGame;document.querySelector('#loadBtn').onclick=loadGame;
function setPaused(v){paused=v;document.querySelector('#pause').style.display=paused?'flex':'none';if(paused)keys={}}
document.querySelector('#pauseBtn').onclick=()=>setPaused(true);
document.querySelector('#resumeBtn').onclick=()=>setPaused(false);
document.querySelector('#savePause').onclick=saveGame;
document.querySelector('#loadPause').onclick=loadGame;
let audioCtx=null,soundOn=false;
function tinyChime(){if(!soundOn)return;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=660;g.gain.value=.035;o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.12)}catch(e){}}
document.querySelector('#soundBtn').onclick=()=>{soundOn=!soundOn;document.querySelector('#soundBtn').textContent='SOUND: '+(soundOn?'ON':'OFF');if(soundOn){tinyChime();speakLine('Audio enabled')}else if('speechSynthesis'in window)speechSynthesis.cancel()};
document.querySelector('#weatherBtn').onclick=()=>{rainOn=!rainOn;rain.visible=rainOn;document.querySelector('#weatherBtn').textContent='WEATHER: '+(rainOn?'RAIN':'CLEAR');say(rainOn?'Rain started. Watch the wet city!':'The rain stopped.')};
document.querySelector('#zoomIn').onclick=()=>cameraDistance=Math.max(7,cameraDistance-2);
document.querySelector('#zoomOut').onclick=()=>cameraDistance=Math.min(23,cameraDistance+2);
document.querySelectorAll('[data-shirt]').forEach(b=>b.onclick=()=>{playerRig.shirt.color.setHex(Number(b.dataset.shirt));say('Outfit updated.')});
document.querySelectorAll('[data-skin]').forEach(b=>b.onclick=()=>{playerRig.skin.color.setHex(Number(b.dataset.skin));say('Skin tone updated.')});
document.querySelectorAll('[data-hair]').forEach(b=>b.onclick=()=>{playerRig.hair.material.color.setHex(Number(b.dataset.hair));say('Hair colour updated.')});

// VETER WORLD 0.9: extra activities, companion, career, landmarks and progression.
let careerLevel=0, xp=0, pet=null, petAdopted=false, photoMode=false, festivalUntil=0;
const worldStatus=document.querySelector('#worldStatus');
function worldMessage(t){worldStatus.textContent=t;say(t)}
document.querySelector('#worldBtn').onclick=()=>{
 const p=document.querySelector('#worldPanel');p.style.display=p.style.display==='none'?'block':'none';
};
function gainXP(n,why){xp+=n;let old=careerLevel;careerLevel=Math.floor(xp/250);if(careerLevel>old)say('Level up! You reached level '+(careerLevel+1));worldMessage(why+'  XP: '+xp+' · Level '+(careerLevel+1));}
document.querySelector('#jobBtn').onclick=()=>{
 const jobs=['Community Helper','Park Gardener','Library Assistant','Sports Coach','Campus Guide'];
 const job=jobs[careerLevel%jobs.length];cash+=100;gainXP(60,'Shift completed: '+job+'. +₹100');document.querySelector('#cash').textContent='₹'+cash;
};
document.querySelector('#sportBtn').onclick=()=>{
 if(!window.veterBall){
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.55,18,14),new THREE.MeshStandardMaterial({color:0xf4f0df,roughness:.55}));
  ball.position.set(player.position.x+2,.55,player.position.z+2);ball.castShadow=true;scene.add(ball);window.veterBall=ball;
 }
 const ball=window.veterBall;ball.position.set(player.position.x+Math.sin(player.rotation.y)*3,.55,player.position.z+Math.cos(player.rotation.y)*3);
 const goal=new THREE.Vector3(parkPoint.x,0,parkPoint.z);
 ball.position.lerp(new THREE.Vector3(goal.x,.55,goal.z),.55);
 cash+=25;gainXP(35,'Football practice complete! +₹25');document.querySelector('#cash').textContent='₹'+cash;
};
document.querySelector('#petBtn').onclick=()=>{
 if(!pet){
  pet=new THREE.Group();
  const fur=new THREE.MeshStandardMaterial({color:0xc58a55,roughness:.9});
  const torso=new THREE.Mesh(new THREE.SphereGeometry(.62,14,12),fur);torso.scale.set(1.25,.72,.72);torso.position.y=.72;pet.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.38,14,12),fur);head.position.set(0,1.05,.65);pet.add(head);
  for(const x of [-.23,.23]){const ear=new THREE.Mesh(new THREE.ConeGeometry(.13,.38,8),fur);ear.position.set(x,1.4,.63);pet.add(ear)}
  for(const x of [-.35,.35]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.09,.11,.48,8),fur);leg.position.set(x,.25,.05);pet.add(leg)}
  pet.position.copy(player.position);pet.position.x+=2;scene.add(pet);petAdopted=true;
  gainXP(20,'A friendly pet joined your adventure!');
 }else worldMessage('Your pet is already exploring with you!');
};
document.querySelector('#festivalBtn').onclick=()=>{
 festivalUntil=performance.now()+45000;
 const colors=[0xffb34d,0x6ed6ff,0xff79b8,0x9af0a6];
 for(let i=0;i<18;i++){
  const orb=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),new THREE.MeshBasicMaterial({color:colors[i%colors.length]}));
  const a=i/18*Math.PI*2;orb.position.set(player.position.x+Math.cos(a)*7,2+Math.sin(i*2)*1.2,player.position.z+Math.sin(a)*7);scene.add(orb);
  setTimeout(()=>{scene.remove(orb);orb.geometry.dispose();orb.material.dispose()},45000);
 }
 worldMessage('City festival started! Enjoy the lights and music.');
};
document.querySelector('#photoBtn').onclick=()=>{
 photoMode=!photoMode;
 document.querySelector('#brand').style.display=photoMode?'none':'block';
 ['stats','mission','mapbox','help','district','quick','tasks','profile','interact'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display=photoMode?'none':''});
 document.querySelector('#cinemaBars').style.display=photoMode?'block':'none';
 worldMessage(photoMode?'Photo mode: HUD hidden. Press PHOTO MODE again in the menu to restore it.':'Photo mode closed.');
};
document.querySelector('#travelBtn').onclick=()=>{
 const places=[['Central Plaza',0,0],['Riverside',160,0],['Old Town',-160,0],['Hillside',0,160],['Civic Quarter',0,-160],['Beach Lookout',300,260],['Forest Trail',-300,260],['University Campus',260,-260],['Airport Gardens',-300,-260]];
 const near=places.reduce((a,b)=>Math.hypot(player.position.x-b[1],player.position.z-b[2])<Math.hypot(player.position.x-a[1],player.position.z-a[2])?b:a,places[0]);
 const idx=(places.indexOf(near)+1)%places.length, dest=places[idx];
 player.position.set(dest[1],0,dest[2]);inside=false;worldMessage('Walking route destination: '+dest[0]+'. Explore the area on foot.');
};
document.querySelector('#achieveBtn').onclick=()=>worldMessage('Achievements: Explorer · Neighbour Helper · Athlete · Pet Friend. Keep exploring to earn more XP!');

let storyStarted=false;
setTimeout(()=>{if(!storyStarted){storyStarted=true;showStory('WELCOME TO VETER CITY','A new city, a fresh start. Meet people, explore districts, and help your neighbours. Your first assignment is to visit the Civic Hall.');}},900);

let last=performance.now(),mapTick=0;
function loop(now){requestAnimationFrame(loop);let dt=Math.min((now-last)/1000,.04);last=now;
if(paused){renderer.render(scene,camera);return}
if(playerMixer)playerMixer.update(dt);
if(pet){
 const follow=new THREE.Vector3(player.position.x- Math.sin(player.rotation.y)*2,0,player.position.z- Math.cos(player.rotation.y)*2);
 pet.position.lerp(follow,Math.min(1,dt*2.8));pet.rotation.y=player.rotation.y;
}

animateFace(performance.now()<voiceTalkingUntil,now);
let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0),dz=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0);let len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;
let running=keys.shift&&stamina>1,speed=running?9:5; if(running&&len>0)stamina=Math.max(0,stamina-22*dt);else stamina=Math.min(100,stamina+13*dt);
if(inside){player.position.x=THREE.MathUtils.clamp(player.position.x+dx*speed*dt,-9.5,9.5);player.position.z=THREE.MathUtils.clamp(player.position.z+dz*speed*dt,-7.5,7.5)}
else{
 let nx=THREE.MathUtils.clamp(player.position.x+dx*speed*dt,-405,405),nz=THREE.MathUtils.clamp(player.position.z+dz*speed*dt,-405,405);
 const blocked=(x,z)=>buildingColliders.some(b=>Math.abs(x-b.x)<b.w/2+.65&&Math.abs(z-b.z)<b.d/2+.65);
 if(!blocked(nx,player.position.z))player.position.x=nx;
 if(!blocked(player.position.x,nz))player.position.z=nz;
}
if(dx||dz){player.rotation.y=Math.atan2(dx,dz);body.position.y=1.28+Math.sin(now*.012)*.035;playerRig.limbs.forEach((limb,i)=>limb.rotation.x=Math.sin(now*.012+i*Math.PI)*.62)}else playerRig.limbs.forEach(limb=>limb.rotation.x*=.75);
if(keys[' ']&&jump===0&&!inside)jump=.22;if(jump>0){jump=Math.max(0,jump-dt);player.position.y=(inside?interiors[activeInterior].offset:0)+Math.sin((.22-jump)/.22*Math.PI)*1.5}else player.position.y=inside?interiors[activeInterior].offset:0;
if(mission===1){marker.visible=true;marker.position.x=parkPoint.x;marker.position.z=parkPoint.z}else if(!emergencyActive){marker.visible=false;}
for(let n of npcs){
 n.phase+=dt;
 const blink=Math.sin(now*.0017+n.phase*3)>0.994?.12:1;n.rig.eyes.forEach(e=>e.scale.y=blink);n.rig.head.rotation.y=Math.sin(n.phase*.7)*.08;

 // simple daily routine: commute toward a nearby plaza during daytime, wander, then head home at night
 let target=(clock>19||clock<6)?n.home:new THREE.Vector3(Math.round(n.home.x/40)*40+((n.routine>.5)?8:-8),0,Math.round(n.home.z/40)*40+((n.routine>.5)?8:-8));
 let to=target.clone().sub(n.g.position);if(to.length()>2){to.normalize();n.g.position.addScaledVector(to,n.speed*dt);n.g.rotation.y=Math.atan2(to.x,to.z)}
 else {n.angle+=dt*.25;n.g.rotation.y=n.angle}
 let moving=to.length()>2;n.rig.limbs.forEach((limb,i)=>limb.rotation.x=moving?Math.sin(n.phase*5+i*Math.PI)*.42:0);
 if(Math.abs(n.g.position.x)>118||Math.abs(n.g.position.z)>118)n.g.position.copy(n.home);
}
// Emergency officer follows the marked incident location; blinking roof lights are cosmetic.
if(emergencyActive&&!emergencyDone){
 let v=emergencyPoint.clone().sub(police.root.position);if(v.length()>2){v.normalize();police.root.position.addScaledVector(v,5*dt);police.root.rotation.y=Math.atan2(v.x,v.z)}
 let blink=Math.sin(now*.012)>0;beacon.children.forEach(o=>o.material.opacity=blink?1:.22);
 if(player.position.distanceTo(emergencyPoint)<4){document.querySelector('#interact').textContent='Press E to help the citizen'}
}
if(cinemaState){
 const elapsed=now-cinemaState.start,progress=Math.min(1,elapsed/cinemaState.duration),angle=progress*Math.PI*2.1;
 const radius=17-progress*5,target=new THREE.Vector3(player.position.x+Math.cos(angle)*radius,player.position.y+5+Math.sin(progress*Math.PI)*3,player.position.z+Math.sin(angle)*radius);
 camera.position.lerp(target,.055);camera.lookAt(player.position.x,player.position.y+1.25,player.position.z);
 if(progress>=1){cinemaState=null;document.querySelector('#cinemaBars').style.display='none'}
}else{camera.position.lerp(new THREE.Vector3(player.position.x,player.position.y+cameraDistance*.62,player.position.z+cameraDistance),.12);camera.lookAt(player.position.x,player.position.y+1.35,player.position.z)}
let prompt='';if(inside)prompt=activeInterior===1?'Press E to leave clinic (heals you)':activeInterior===2?'Press E to leave apartment (rest 8 hours)':'Press E to leave Civic Hall';else if(interiors.some(it=>player.position.distanceTo(it.door)<5))prompt='Press E to enter building';else if(npcs.some(n=>n.g.position.distanceTo(player.position)<4))prompt='Press E to talk';document.querySelector('#interact').textContent=prompt;
clock=(clock+dt*.08)%24;
for(const c of collectibles){if(!c.found){c.mesh.rotation.y+=dt*1.2;c.mesh.position.y=1.25+Math.sin(now*.002+c.mesh.position.x)*.18}}
if(rainOn){let a=rain.geometry.attributes.position;for(let i=0;i<rainCount;i++){a.array[i*3+1]-=dt*24;if(a.array[i*3+1]<0){a.array[i*3+1]=30+Math.random()*10;a.array[i*3]=(Math.random()-.5)*150;a.array[i*3+2]=(Math.random()-.5)*150}}a.needsUpdate=true;rain.position.x=player.position.x;rain.position.z=player.position.z}
autoSaveClock+=dt;if(autoSaveClock>90){autoSaveClock=0;try{localStorage.setItem('veterWorldAutoSave',JSON.stringify({x:player.position.x,z:player.position.z,cash,health,stamina,clock,mission,shirt:playerRig.shirt.color.getHex(),skin:playerRig.skin.color.getHex(),hair:playerRig.hair.material.color.getHex()}))}catch(e){}}
let hh=Math.floor(clock),mm=Math.floor((clock-hh)*60);document.querySelector('#clock').textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
document.querySelector('#stamina').textContent=Math.round(stamina);document.querySelector('#health').textContent=health;document.querySelector('#cash').textContent='₹'+cash;
sun.position.set(Math.cos(clock/24*Math.PI*2)*70,70,Math.sin(clock/24*Math.PI*2)*70);sun.intensity=.5+1.8*Math.max(0,Math.sin((clock-6)/12*Math.PI));scene.background.setHSL(.55,.45,.25+.35*Math.max(0,Math.sin((clock-6)/12*Math.PI)));
if(mission===1&&player.position.distanceTo(parkPoint)<5){mission=2;cash+=250;document.querySelector('#missionText').textContent='Mission complete! Bonus ₹250. Visit the Civic Hall or meet more citizens.';say('Mission complete! +₹250');showStory('A CITY THAT NEEDS YOU','Your first visit is complete. A city emergency has been reported. Reach the green marker and assist the citizen.');setTimeout(startEmergency,2500)}
if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)document.querySelector('#toast').style.opacity=0}
let distName='CENTRAL';if(player.position.x>40)distName='RIVERSIDE';else if(player.position.x< -40)distName='OLD TOWN';else if(player.position.z>40)distName='HILLSIDE';else if(player.position.z< -40)distName='CIVIC QUARTER';document.querySelector('#district').textContent='DISTRICT: '+distName;
if(++mapTick%5===0)updateMap();renderer.render(scene,camera)}
requestAnimationFrame(loop);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
updateMap();
})();

;

// Keep the extra activity panel usable on narrow screens.
if (matchMedia('(max-width:700px)').matches) {
 const wp=document.getElementById('worldPanel');
 if(wp){wp.style.right='8px';wp.style.top='165px';wp.style.width='min(250px,55vw)';}
}