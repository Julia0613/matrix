import * as THREE from 'three';

// Positions are in calibrated appliance coordinates (meters), behind each window.
// The two opaque-front appliances retain their real enclosures.
const chambers={
 '1416':{glass:[],servings:[{x:0,y:.083,front:.132,width:.16}]},
 '1800':{glass:['Стекло'],servings:[{x:0,y:.065,front:.112,width:.16}]},
 '2100':{glass:['Glass_1'],servings:[{x:0,y:.065,front:.148,width:.13},{x:0,y:.217,front:.148,width:.13}]},
 '2200':{glass:['2200 actual viewing window GLASS'],servings:[{x:0,y:.082,front:.078,width:.125}]},
 '2300':{glass:['Стекло'],servings:[{x:0,y:.048,front:.076,width:.17}]},
 '2400':{glass:['1стекло','1стекло.001','Material #64'],servings:[{x:0,y:.082,front:.120,width:.125}]},
 '2500':{glass:['Стекло'],servings:[{x:0,y:.064,front:.086,width:.15}]},
 '2600':{glass:['Стекло'],servings:[{x:-.01,y:.055,front:.088,width:.17}]},
 '2700':{glass:['GlassOptimized','FrontGlass'],servings:[{x:0,y:.073,front:.108,width:.14}]},
 '2900':{glass:['GlassBlack'],servings:[{x:-.052,y:.083,front:.114,width:.088},{x:.052,y:.083,front:.114,width:.088}]},
 '5100':{glass:[],opaque:true,servings:[{x:0,y:.065,front:.060,width:.16}]},
 '5200':{glass:[],opaque:true,servings:[{x:-.058,y:.057,front:.070,width:.095},{x:.058,y:.057,front:.070,width:.095}]},
 '5300':{glass:['Стекло'],servings:[{x:0,y:.070,front:.091,width:.16}]},
 'DO-E1000':{glass:['Empty material.003','screen.001'],servings:[{x:0,y:.084,front:.123,width:.25}]}
};

export function createFoodInteriors(loader,getEnvironment=()=>null){
 let ready,fruitReady;
 const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const glowContext=glowCanvas.getContext('2d'),glowGradient=glowContext.createRadialGradient(64,44,4,64,60,70);glowGradient.addColorStop(0,'rgba(255,143,48,.72)');glowGradient.addColorStop(.5,'rgba(255,109,20,.38)');glowGradient.addColorStop(1,'rgba(255,90,10,0)');glowContext.fillStyle=glowGradient;glowContext.fillRect(0,0,128,128);const glowMap=new THREE.CanvasTexture(glowCanvas);glowMap.colorSpace=THREE.SRGBColorSpace;
 const template=()=>ready??=(async()=>{const gltf=await loader.loadAsync('./assets/models/food-serving.glb?v=20261101-28');const root=gltf.scene;root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root,true),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());root.position.x-=c.x;root.position.y-=b.min.y;root.position.z-=c.z;root.updateMatrixWorld(true);return{root,size:s};})().catch(error=>{ready=undefined;throw error;});
 async function attach(id,group){
  if(id==='1200'||id==='1300'){await attachFruit(group,id);return;}
  const config=chambers[id];if(!config||group.userData.interiorFood)return;
  const food=await template();const holder=new THREE.Group();holder.name='Food and warm chamber light';
  if(id==='2200'){
   const liner=new THREE.MeshStandardMaterial({color:'#17191b',roughness:.65,metalness:.12,envMap:getEnvironment(),envMapIntensity:.08});
   const wall=(w,h,d,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),liner);mesh.position.set(x,y,z);mesh.receiveShadow=true;holder.add(mesh);};
   // A closed, dark cooking chamber stops the kitchen showing through the CAD aperture.
   wall(.204,.123,.003,0,.143,-.06);
   wall(.003,.123,.122,-.102,.143,.001);wall(.003,.123,.122,.102,.143,.001);
   wall(.204,.003,.122,0,.0805,.001);wall(.204,.003,.122,0,.204,.001);
   wall(.15,.002,.115,0,.081,.012);
  }
  const repaired=new Map();
  group.traverse(mesh=>{if(!mesh.isMesh)return;const fix=material=>{if(!config.glass.includes(material.name))return material;if(repaired.has(material))return repaired.get(material);const m=material.clone();m.metalness=0;m.roughness=.12;m.transparent=true;m.opacity=.16;m.depthWrite=false;m.envMap=getEnvironment();m.envMapIntensity=.35;if('transmission'in m)m.transmission=0;if('clearcoat'in m)m.clearcoat=.18;if('specularIntensity'in m)m.specularIntensity=.65;m.needsUpdate=true;repaired.set(material,m);return m;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(fix):fix(mesh.material);});
  for(const chamber of config.servings){
   const portion=new THREE.Group(),copy=food.root.clone(true),scale=chamber.width/food.size.x;portion.add(copy);portion.scale.setScalar(scale);portion.position.set(chamber.x,chamber.y,chamber.front-food.size.z*scale/2);portion.name='Grilled serving';portion.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const warm=m=>{const mat=m.clone();mat.envMap=getEnvironment();mat.envMapIntensity=.14;return mat;};o.material=Array.isArray(o.material)?o.material.map(warm):warm(o.material);}});holder.add(portion);
   // A saturated, local oven lamp stays orange instead of clipping to a white spot.
   const lamp=new THREE.PointLight('#ff791e',.14*scale*scale,.27*scale,2);lamp.position.set(chamber.x,chamber.y+food.size.y*scale+.025,chamber.front-.025);holder.add(lamp);
   const bounce=new THREE.PointLight('#ff9b38',.025*scale*scale,.22*scale,2);bounce.position.set(chamber.x-chamber.width*.3,chamber.y+.04*scale,chamber.front-.055*scale);holder.add(bounce);
   const glow=new THREE.Mesh(new THREE.PlaneGeometry(chamber.width*1.2,food.size.y*scale*2.1),new THREE.MeshBasicMaterial({map:glowMap,transparent:true,depthWrite:false,toneMapped:false,opacity:.85}));glow.name='Orange oven light on rear chamber wall';glow.position.set(chamber.x,chamber.y+food.size.y*scale*.85,chamber.front-food.size.z*scale-.002);holder.add(glow);
  }
  group.add(holder);group.userData.interiorFood={chambers:config.servings.length,visibleThroughWindow:!config.opaque};
 }
 async function attachFruit(group,id){
  if(group.userData.interiorFood)return;
  const profile=id==='1200'?{glass:['Стекло'],portions:[{x:.00054,y:.2735,z:-.01506,scale:1,rotation:0}]}:{glass:['glass','glass accent'],portions:[{x:0,y:.194,z:-.0278755,scale:.735,rotation:0},{x:0,y:.2525,z:-.0278755,scale:.9,rotation:Math.PI}]};
  group.traverse(mesh=>{if(!mesh.isMesh)return;const clear=m=>{if(!profile.glass.includes(m.name))return m;const copy=m.clone();copy.color.set('#f6f3f1');copy.metalness=0;copy.roughness=.06;copy.transparent=true;copy.opacity=.055;if('transmission'in copy)copy.transmission=0;copy.depthWrite=false;copy.side=THREE.FrontSide;copy.envMap=getEnvironment();copy.envMapIntensity=.18;return copy;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(clear):clear(mesh.material);const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(list.every(m=>m.transparent))mesh.castShadow=false;});
  const root=await(fruitReady??=loader.loadAsync('./assets/models/fruit-serving-v3.glb?v=20261101-28').then(g=>g.scene).catch(error=>{fruitReady=undefined;throw error;}));
  for(const placement of profile.portions){const fruit=root.clone(true);fruit.name='Strawberry, blueberry and banana pieces';fruit.position.set(placement.x,placement.y,placement.z);fruit.scale.setScalar(placement.scale);fruit.rotation.y=placement.rotation;fruit.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const juicy=m=>{const copy=m.clone();copy.envMap=getEnvironment();copy.envMapIntensity=1.6;copy.roughness=Math.min(copy.roughness,.40);return copy;};o.material=Array.isArray(o.material)?o.material.map(juicy):juicy(o.material);}});group.add(fruit);}
  if(id==='1200'){
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.strokeStyle='#d8ebff';ctx.lineWidth=7;ctx.lineCap='round';
  for(const x of [92,168,290,366]){for(const [a,b]of [[[7,14],[47,14]],[[53,20],[53,55]],[[53,73],[53,108]],[[47,114],[7,114]],[[1,108],[1,73]],[[1,55],[1,20]]]){ctx.beginPath();ctx.moveTo(x+a[0],a[1]);ctx.lineTo(x+b[0],b[1]);ctx.stroke();}}
  ctx.fillStyle='#d8ebff';for(const y of [44,84]){ctx.beginPath();ctx.arc(255,y,5,0,Math.PI*2);ctx.fill();}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const timer=new THREE.Mesh(new THREE.PlaneGeometry(.062535,.01707),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}));timer.name='DeMixi display 00:00';timer.position.set(.0019206,.1231938,.07135);timer.rotation.x=-1.75*Math.PI/180;group.add(timer);}
  group.userData.interiorFood={fruit:true,portions:profile.portions.length,...(id==='1200'?{timer:'00:00'}:{})};
 }
 return{attach};
}
