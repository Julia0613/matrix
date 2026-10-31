import * as THREE from 'three';
import {RectAreaLightUniformsLib} from './assets/vendor/RectAreaLightUniformsLib.js';

// Original, meter-based geometry with a stone texture generated for this project.
export function createKitchen(scene,renderer){
 RectAreaLightUniformsLib.init();
 const group=new THREE.Group(),island=new THREE.Group(),lighting=new THREE.Group();scene.add(group,island,lighting);
 const back=new THREE.Group(),ends=new THREE.Group(),pendants=new THREE.Group();group.add(back,ends,pendants);
 const standard=(color,roughness=.5,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
 const charcoal=standard('#121519',.62),rib=standard('#0b0e12',.64),gold=standard('#b18a49',.29,.86),black=standard('#070a0d',.52),ceramic=standard('#c9c0ad',.58),wood=standard('#796246',.65),glass=new THREE.MeshPhysicalMaterial({color:'#30343a',metalness:.05,roughness:.16,transparent:true,opacity:.10,depthWrite:false});
 const warm=new THREE.MeshBasicMaterial({color:'#ffaf46',toneMapped:false});
 function box(parent,w,h,d,x,y,z,material,cast=true){const geometry=new THREE.BoxGeometry(w,h,d);if(material.userData.marble){const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv.setXY(i,(nx>.5?p.getZ(i)+z:p.getX(i)+x)/1.35,(ny>.5?p.getZ(i)+z:p.getY(i)+y)/1.35);}uv.needsUpdate=true;}const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=cast;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function cylinder(parent,r1,r2,h,x,y,z,material,n=24){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,n),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function ball(parent,rx,ry,rz,x,y,z,material){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),material);mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
 function tube(parent,points,r,material){const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),28,r,8,false),material);parent.add(mesh);mesh.castShadow=true;return mesh;}
 let resolveTexture,rejectTexture;const ready=new Promise((resolve,reject)=>{resolveTexture=resolve;rejectTexture=reject;});
 const stoneMap=new THREE.TextureLoader().load('./assets/textures/black-gold-marble.webp',()=>{floorMap.needsUpdate=true;resolveTexture();},undefined,()=>rejectTexture(Error('Не удалось загрузить камень.')));stoneMap.colorSpace=THREE.SRGBColorSpace;stoneMap.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());stoneMap.wrapS=stoneMap.wrapT=THREE.RepeatWrapping;const stone=new THREE.MeshPhysicalMaterial({color:'#ffffff',map:stoneMap,roughness:.52,metalness:0,clearcoat:0,envMapIntensity:.12,specularIntensity:.22,emissive:'#f5b765',emissiveIntensity:.035});
 stone.emissiveMap=stoneMap;stone.userData.marble=true;const backStone=stone.clone();backStone.color.set('#73777b');backStone.roughness=.42;backStone.clearcoat=0;backStone.envMapIntensity=.10;backStone.emissiveIntensity=.012;
 const floorMap=stoneMap.clone();floorMap.wrapS=floorMap.wrapT=THREE.RepeatWrapping;floorMap.repeat.set(3.7,3.7);floorMap.needsUpdate=true;
 const floorMat=new THREE.MeshPhysicalMaterial({color:'#79736c',map:floorMap,roughness:.94,metalness:0,envMapIntensity:.10,specularIntensity:.12}),studioMat=standard('#e7e9ee',.85);
 // Subtle mineral variation on the honed floor keeps contact shadows legible.
 floorMat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb = vec3(0.035, 0.032, 0.028) + diffuseColor.rgb * 0.12;');};
 floorMat.customProgramCacheKey=()=> 'honed-floor-v1';
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(12,12),floorMat);ground.rotation.x=-Math.PI/2;ground.position.y=-.0001;ground.receiveShadow=true;scene.add(ground);
 const grid=new THREE.GridHelper(8,32,'#c2c8d0','#d8dde5');grid.position.y=-.001;grid.material.transparent=true;grid.material.opacity=.3;scene.add(grid);
 // Only a rear wall: no front wall, side wall or ceiling can block the camera.
 const wall=new THREE.Mesh(new THREE.PlaneGeometry(6.2,2.75),standard('#17191e',.9));wall.position.set(0,1.375,-1.86);wall.receiveShadow=true;back.add(wall);
 box(back,4.7,.7,.028,0,1.24,-1.835,backStone,false);
 // Base cabinets, each with a fine brass reveal and recessed plinth.
 box(back,4.6,.1,.53,0,.05,-1.52,black);
 box(back,4.6,.014,.53,0,.108,-1.52,gold);
 for(let i=0;i<7;i++){
  const x=-1.98+i*.66;
  box(back,.65,.75,.60,x,.49,-1.51,charcoal);
  box(back,.638,.716,.02,x,.49,-1.199,charcoal);
  box(back,.35,.007,.018,x,.82,-1.181,gold);
 }
 // Split countertop gives the sink a real opening in the rear worktop.
 const sinkX=.18,sinkZ=-1.43,sinkW=.55,sinkD=.38,topY=.89;
 const left=-2.34,right=2.34,front=-1.16,rear=-1.82;
 const sl=sinkX-sinkW/2,sr=sinkX+sinkW/2,sf=sinkZ+sinkD/2,sb=sinkZ-sinkD/2;
 box(back,sl-left,.035,rear*-1+front,(left+sl)/2,topY-.0175,(front+rear)/2,stone);
 box(back,right-sr,.035,rear*-1+front,(right+sr)/2,topY-.0175,(front+rear)/2,stone);
 box(back,sinkW,.035,front-sf,sinkX,topY-.0175,(front+sf)/2,stone);
 box(back,sinkW,.035,sb-rear,sinkX,topY-.0175,(sb+rear)/2,stone);
 const basin=standard('#111820',.22,.55),rim=standard('#524632',.28,.7);
 box(back,sinkW,.008,sinkD,sinkX,.734,sinkZ,basin);
 for(const x of [sl,sr])box(back,.009,.15,sinkD,x,.813,sinkZ,basin);
 for(const z of [sb,sf])box(back,sinkW,.15,.009,sinkX,.813,z,basin);
 for(const x of [sl-.005,sr+.005])box(back,.014,.004,sinkD+.022,x,.892,sinkZ,rim);
 for(const z of [sb-.005,sf+.005])box(back,sinkW+.022,.004,.014,sinkX,.892,z,rim);
 cylinder(back,.023,.023,.014,sinkX,.9,-1.696,gold);
 cylinder(back,.011,.011,.235,sinkX,1.017,-1.696,gold);
 const arc=new THREE.Mesh(new THREE.TorusGeometry(.126,.011,10,36,Math.PI),gold);arc.rotation.y=Math.PI/2;arc.position.set(sinkX,1.134,-1.57);back.add(arc);
 cylinder(back,.011,.011,.05,sinkX,1.109,-1.444,gold);
 cylinder(back,.011,.011,.09,sinkX+.061,.948,-1.696,gold);
 // Hood remains above the rear sink. No hob, no ovens.
 box(back,.82,.042,.44,sinkX,1.57,-1.58,black);
 box(back,.82,.008,.028,sinkX,1.546,-1.368,gold);
 box(back,.34,.50,.30,sinkX,1.84,-1.70,charcoal);
 for(const x of [-1.72,-1.06,.99,1.65]){
  box(back,.64,.69,.35,x,1.965,-1.66,charcoal);
  box(back,.624,.67,.02,x,1.965,-1.474,charcoal);
 }
 for(const x of [-2.22,2.22]){
  box(ends,.42,2.40,.60,x,1.2,-1.51,charcoal);
  box(ends,.38,2.2,.02,x,1.26,-1.197,black);
  for(const y of [.45,.95,1.45,1.95,2.35]){
   box(ends,.38,.015,.40,x,y,-1.39,gold);
   box(ends,.35,.007,.012,x,y+.022,-1.18,warm,false);
  }
  box(ends,.006,2.3,.012,x-.16,1.24,-1.179,warm,false);
  box(ends,.006,2.3,.012,x+.16,1.24,-1.179,warm,false);
  box(ends,.365,2.30,.006,x,1.24,-1.155,glass,false);
  for(let k=0;k<4;k++){
   const y=.48+k*.5;
   for(const dx of [-.095,.08]){cylinder(ends,.023,.028,.065,x+dx,y+.036,-1.31,gold,14);cylinder(ends,.004,.004,.07,x+dx,y+.104,-1.31,gold,10);ball(ends,.032,.04,.032,x+dx,y+.16,-1.31,glass);}
  }
 }
 // Warm, recessed lines on the rear joinery only.
 box(back,4.7,.008,.014,0,1.614,-1.48,warm,false);
 box(back,4.7,.008,.016,0,2.38,-1.72,warm,false);
 box(back,4.7,.008,.014,0,.844,-1.186,gold,false);

 // Simple decor belongs exclusively to the rear worktop.
 function plant(x,z){
  cylinder(back,.073,.05,.19,x,.985,z,black,32);
  const greens=[standard('#284327'),standard('#435a2c'),standard('#1e3422')];
  for(let k=0;k<8;k++){
   const a=k*2.399,bx=x+Math.cos(a)*.025,bz=z+Math.sin(a)*.02,h=.23+(k%3)*.065;
   const end=[x+Math.cos(a)*.14,1.08+h,z+Math.sin(a)*.11];tube(back,[[bx,1.06,bz],[(bx+end[0])/2,1.14+h*.45,(bz+end[2])/2],end],.0025,wood);
   for(let j=0;j<4;j++){const t=.35+j*.2,px=bx+(end[0]-bx)*t,py=1.06+(end[1]-1.06)*t,pz=bz+(end[2]-bz)*t;for(const side of [-1,1]){const leaf=ball(back,.016,.044,.006,px+side*.017,py,pz,greens[(k+j)%3]);leaf.rotation.z=side*.68;leaf.rotation.y=a;}}
  }
 }
 plant(-1.65,-1.48);
 // Cutting board, canisters, crock and kitchen utensils behind the appliances.
 const boardShape=new THREE.Shape();boardShape.moveTo(-.105,0);boardShape.lineTo(.105,0);boardShape.lineTo(.105,.27);boardShape.quadraticCurveTo(.105,.30,.07,.30);boardShape.lineTo(.035,.30);boardShape.lineTo(.035,.375);boardShape.quadraticCurveTo(0,.407,-.035,.375);boardShape.lineTo(-.035,.30);boardShape.lineTo(-.07,.30);boardShape.quadraticCurveTo(-.105,.30,-.105,.27);boardShape.closePath();
 const hole=new THREE.Path();hole.absarc(0,.359,.012,0,Math.PI*2,true);boardShape.holes.push(hole);
 const board=new THREE.Mesh(new THREE.ExtrudeGeometry(boardShape,{depth:.019,bevelEnabled:true,bevelSize:.005,bevelThickness:.003,bevelSegments:2,steps:1}),wood);board.position.set(.94,.89,-1.76);board.rotation.z=-.12;back.add(board);
 for(const [x,h]of [[1.17,.16],[1.34,.12]]){cylinder(back,.052,.047,h,x,.89+h/2,-1.46,ceramic);cylinder(back,.054,.054,.015,x,.89+h+.008,-1.46,gold);}
 cylinder(back,.059,.052,.15,-1.13,.965,-1.47,ceramic);
 for(let i=0;i<4;i++){
  const x=-1.18+i*.033;const spoon=cylinder(back,.004,.004,.23,x,1.105,-1.46,wood,12);spoon.rotation.z=(i-1.5)*.1;
  const head=ball(back,.018,.032,.006,x+(i-1.5)*.012,1.23,-1.46,wood);head.rotation.z=(i-1.5)*.1;
 }
 // Pendants hang behind the comparison area and never over the products.
 for(const x of [-.9,.9]){
  cylinder(pendants,.004,.004,.36,x,2.45,-1.05,gold,12);
  ball(pendants,.085,.09,.085,x,2.18,-1.05,new THREE.MeshPhysicalMaterial({color:'#c9b487',transparent:true,opacity:.2,roughness:.05,metalness:.05,depthWrite:false}));
  cylinder(pendants,.014,.014,.06,x,2.18,-1.05,warm,16);
  cylinder(pendants,.026,.026,.018,x,2.27,-1.05,gold);
 }
 // Clean island: cabinetry, stone and light only; the app adds appliances separately.
 const parts=[];
 const top=box(island,1.94,.04,.80,.30,.74,0,stone);parts.push([top,'top']);
 const core=box(island,1.86,.6,.70,.30,.4,0,charcoal);parts.push([core,'core']);
 for(const x of [-.6525,1.2525]){const slab=box(island,.035,.76,.80,x,.38,0,stone);parts.push([slab,'slab']);}
 const plinth=box(island,1.85,.09,.63,.30,.045,0,black);parts.push([plinth,'plinth']);
 const toeGlow=box(island,1.83,.007,.013,.30,.088,.342,warm,false);parts.push([toeGlow,'toe']);
 const underGlow=box(island,1.84,.007,.012,.30,.7,.365,warm,false);parts.push([underGlow,'under']);
 const reveal=box(island,1.86,.012,.018,.30,.69,.358,gold,false);parts.push([reveal,'reveal']);
 const fluteGeo=new THREE.BoxGeometry(.011,1,.014),flutes=new THREE.InstancedMesh(fluteGeo,rib,104);flutes.castShadow=true;flutes.receiveShadow=true;island.add(flutes);const dummy=new THREE.Object3D();

 function grain(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),pixels=ctx.createImageData(128,128);let n=13;for(let i=0;i<pixels.data.length;i+=4){n=(n*16807)%2147483647;const g=184+(n%39);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=g;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(32,32);return tex;}
 const micro=grain();stone.bumpMap=micro;stone.bumpScale=.00018;stone.roughnessMap=micro;charcoal.bumpMap=micro;charcoal.bumpScale=.000055;
 function area(parent,w,h,x,y,z,tx,ty,tz,intensity){const light=new THREE.RectAreaLight('#ffb65b',intensity,w,h);light.position.set(x,y,z);light.lookAt(tx,ty,tz);lighting.add(light);return light;}
 area(back,4.4,.025,0,1.605,-1.48,0,.88,-1.43,45);
 for(const x of [-2.22,2.22])area(ends,.24,2.15,x,1.25,-1.18,x,1.25,-1.5,1.4);
 function lightWash(w,h){const c=document.createElement('canvas');c.width=8;c.height=128;const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,0,128);g.addColorStop(0,'rgba(255,161,51,.32)');g.addColorStop(.22,'rgba(255,156,40,.13)');g.addColorStop(1,'rgba(255,149,36,0)');ctx.fillStyle=g;ctx.fillRect(0,0,8,128);const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));}
 const frontWash=lightWash(1.83,.22);frontWash.position.set(.30,.60,.379);island.add(frontWash);
 const floorWash=lightWash(1.83,.48);floorWash.rotation.x=-Math.PI/2;floorWash.position.set(.30,.003,.59);island.add(floorWash);
 const lipLight=area(island,1.82,.018,.30,.71,.378,.30,.50,.41,24);
 const toeLight=area(island,1.82,.016,.30,.085,.35,.30,0,.56,22);
 // Lighting is independent of the view-dependent cabinet visibility.
 const pendantKey=new THREE.SpotLight('#ffcf90',8,4.5,.88,.65,2);pendantKey.position.set(-.9,2.18,-1.05);pendantKey.target.position.set(-.15,.55,.15);pendantKey.castShadow=true;pendantKey.shadow.mapSize.set(1024,1024);pendantKey.shadow.camera.near=.06;pendantKey.shadow.camera.far=4.5;pendantKey.shadow.normalBias=.001;pendantKey.shadow.bias=-.00008;lighting.add(pendantKey,pendantKey.target);

 function setHeight(h,visible=true){
  island.visible=visible;lipLight.visible=toeLight.visible=visible;
  frontWash.position.y=h-.16;lipLight.position.y=h-.053;lipLight.lookAt(.30,h-.25,.41);
  top.position.y=h-.02;core.scale.y=(h-.16)/.6;core.position.y=(h-.16)/2+.1;
  for(const [p,t]of parts){if(t==='slab'){p.scale.y=h/.76;p.position.y=h/2;}else if(t==='under')p.position.y=h-.055;else if(t==='reveal')p.position.y=h-.072;}
  for(let i=0;i<104;i++){dummy.position.set(-.605+i*.0176,(h-.22)/2+.12,.363);dummy.scale.set(1,h-.22,1);dummy.updateMatrix();flutes.setMatrixAt(i,dummy.matrix);}flutes.instanceMatrix.needsUpdate=true;flutes.computeBoundingSphere();
 }
 setHeight(.76);
 function setEnvironment(on){group.visible=on;lighting.visible=on;ground.material=on?floorMat:studioMat;grid.visible=!on;}
 function updateCamera(camera,on){
  // The rear joinery disappears from reverse viewpoints instead of blocking the appliances.
  const open=on&&camera.position.z>-.95;back.visible=open;ends.visible=open&&Math.abs(camera.position.x)<3.6;pendants.visible=open&&camera.position.y<2.45;
 }
 return {group,island,ground,grid,setHeight,setEnvironment,updateCamera,ready};
}
