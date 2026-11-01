import * as THREE from 'three';

// Positions are in calibrated appliance coordinates (meters), behind each window.
// The two opaque-front appliances retain their real enclosures.
const chambers={
 '1416':{glass:[],servings:[{x:0,y:.083,front:.132,width:.16}]},
 '1800':{glass:['Стекло'],servings:[{x:0,y:.065,front:.112,width:.16}]},
 '2100':{glass:['Glass_1'],servings:[{x:0,y:.065,front:.148,width:.13},{x:0,y:.217,front:.148,width:.13}]},
 '2200':{glass:['2200 actual viewing window GLASS'],servings:[{x:0,y:.067,front:.078,width:.14}]},
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

export function createFoodInteriors(loader){
 let ready,fruitReady;
 const template=()=>ready??=(async()=>{const gltf=await loader.loadAsync('./assets/models/food-serving.glb?v=20261101-21');const root=gltf.scene;root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(root,true),s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());root.position.x-=c.x;root.position.y-=b.min.y;root.position.z-=c.z;root.updateMatrixWorld(true);return{root,size:s};})().catch(error=>{ready=undefined;throw error;});
 async function attach(id,group){
  if(id==='1200'){await attachFruit(group);return;}
  const config=chambers[id];if(!config||group.userData.interiorFood)return;
  const food=await template();const holder=new THREE.Group();holder.name='Food and warm chamber light';
  const repaired=new Map();
  group.traverse(mesh=>{if(!mesh.isMesh)return;const fix=material=>{if(!config.glass.includes(material.name))return material;if(repaired.has(material))return repaired.get(material);const m=material.clone();m.metalness=0;m.roughness=.12;m.transparent=true;m.opacity=.16;m.depthWrite=false;m.envMapIntensity=.35;if('transmission'in m)m.transmission=0;if('clearcoat'in m)m.clearcoat=.18;if('specularIntensity'in m)m.specularIntensity=.65;m.needsUpdate=true;repaired.set(material,m);return m;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(fix):fix(mesh.material);});
  for(const chamber of config.servings){
   const portion=new THREE.Group(),copy=food.root.clone(true),scale=chamber.width/food.size.x;portion.add(copy);portion.scale.setScalar(scale);portion.position.set(chamber.x,chamber.y,chamber.front-food.size.z*scale/2);portion.name='Grilled serving';portion.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});holder.add(portion);
   const lamp=new THREE.PointLight('#ffb56b',.18*scale*scale,.24*scale,2);lamp.position.set(chamber.x,chamber.y+food.size.y*scale+.022,chamber.front-.015);holder.add(lamp);
  }
  group.add(holder);group.userData.interiorFood={chambers:config.servings.length,visibleThroughWindow:!config.opaque};
 }
 async function attachFruit(group){
  if(group.userData.interiorFood)return;
  group.traverse(mesh=>{if(!mesh.isMesh)return;const clear=m=>{if(m.name!=='Стекло')return m;const copy=m.clone();copy.color.set('#b9c5cf');copy.opacity=.10;copy.depthWrite=false;copy.side=THREE.FrontSide;copy.envMapIntensity=.35;return copy;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(clear):clear(mesh.material);const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(list.every(m=>m.transparent))mesh.castShadow=false;});
  const root=await(fruitReady??=loader.loadAsync('./assets/models/fruit-serving.glb?v=20261101-21').then(g=>g.scene).catch(error=>{fruitReady=undefined;throw error;}));
  const fruit=root.clone(true);fruit.name='Strawberry, blueberry and banana pieces';fruit.position.set(.00054,.292,-.01506);fruit.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});group.add(fruit);
  const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.strokeStyle='#d8ebff';ctx.lineWidth=7;ctx.lineCap='round';
  for(const x of [92,168,290,366]){for(const [a,b]of [[[7,14],[47,14]],[[53,20],[53,55]],[[53,73],[53,108]],[[47,114],[7,114]],[[1,108],[1,73]],[[1,55],[1,20]]]){ctx.beginPath();ctx.moveTo(x+a[0],a[1]);ctx.lineTo(x+b[0],b[1]);ctx.stroke();}}
  ctx.fillStyle='#d8ebff';for(const y of [44,84]){ctx.beginPath();ctx.arc(255,y,5,0,Math.PI*2);ctx.fill();}
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const timer=new THREE.Mesh(new THREE.PlaneGeometry(.062535,.01707),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}));timer.name='DeMixi display 00:00';timer.position.set(.0019206,.1231938,.07135);timer.rotation.x=-1.75*Math.PI/180;group.add(timer);
  group.userData.interiorFood={fruit:true,timer:'00:00'};
 }
 return{attach};
}
