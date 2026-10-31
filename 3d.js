import * as THREE from 'three';
import {OrbitControls} from './assets/vendor/OrbitControls.js';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';
import {DRACOLoader} from './assets/vendor/DRACOLoader.js';
import {RoomEnvironment} from './assets/vendor/RoomEnvironment.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))&&v!==null?Math.max(min,Math.min(max,Number(v))):fallback;
const initial={human:clamp(params.get('human'),145,205,164),table:clamp(params.get('table'),65,110,76),place:params.get('place')==='floor'?'floor':'table'};
const defaults=()=>({...initial,room:'kitchen',view:'perspective',personX:-.95,show5100:true,show3500:true});
const state=defaults();
const products={
 '5100':{name:'HARRINGTON',height:.33,width:.265,depth:.35,path:'assets/models/harrington-5100.glb',x:-.04,z:.06,label:'label5100'},
 // The portafilter extends past the RIVO housing. Its housing depth is calibrated
 // separately; the handle remains extended and is not squeezed into that depth.
 '3500':{name:'RIVO',height:.315,width:.21,depth:.305,housingDepth:.32365,path:'assets/models/rivo-3500.glb',x:.55,z:.04,label:'label3500'}
};
for(const [id,p]of Object.entries(products)){const row=window.CATALOG.find(r=>r.id===id);if(row?.dimensions){const [depth,width,height]=row.dimensions;p.width=width/100;p.height=height/100;p.depth=depth/100}}
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
let renderer,scene,perspective,orthographic,camera,controls,woman,island,kitchen,studioGrid,ground,frameId,environmentTexture;
let disposed=false,currentPreset='perspective';
const objects=new Map(),contactShadows=new Map(),wrap=$('canvasWrap'),canvas=$('sceneCanvas');
const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath('./assets/vendor/');draco.setWorkerLimit(2);loader.setDRACOLoader(draco);

function fail(message){$('loading').hidden=true;$('sceneError').hidden=false;$('errorText').textContent=message;}
function initRenderer(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene=new THREE.Scene();scene.background=new THREE.Color('#eee9e1');
 perspective=new THREE.PerspectiveCamera(34,1,.03,40);orthographic=new THREE.OrthographicCamera(-2,2,2,-2,.03,40);camera=perspective;
 const hemi=new THREE.HemisphereLight('#fff9ef','#b5bac7',1.0);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff7e8',2.4);sun.position.set(-3,5,4);sun.castShadow=true;
 sun.shadow.mapSize.set(innerWidth<760?1024:2048,innerWidth<760?1024:2048);sun.shadow.camera.left=-3;sun.shadow.camera.right=3;sun.shadow.camera.top=3;sun.shadow.camera.bottom=-3;sun.shadow.camera.near=.1;sun.shadow.camera.far=12;sun.shadow.normalBias=.012;sun.shadow.bias=-.00005;sun.shadow.radius=3;scene.add(sun);
 const fill=new THREE.DirectionalLight('#e9efff',1.3);fill.position.set(3,3,-1);scene.add(fill);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environmentTexture=pmrem.fromScene(room,.04).texture;scene.environment=environmentTexture;scene.environmentIntensity=.65;room.dispose();pmrem.dispose();
 setupControls();
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('Браузер приостановил 3D. Обновите просмотр, чтобы продолжить.')});
}
function setupControls(){
 controls?.dispose();controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.7;controls.maxDistance=11;controls.minZoom=.45;controls.maxZoom=4;
 controls.minPolarAngle=.18;controls.maxPolarAngle=Math.PI/2-.025;controls.screenSpacePanning=true;controls.target.set(.1,.85,0);controls.listenToKeyEvents(canvas);controls.keyPanSpeed=15;
 controls.addEventListener('start',()=>{currentPreset='free';updateViewButtons()});
}
const mat=(color,roughness=.65,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function box(parent,w,h,d,x,y,z,material,cast=true){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=cast;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function cylinder(parent,r1,r2,height,x,y,z,material){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,height,24),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function floorTexture(){
 const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#d4c7b2';ctx.fillRect(0,0,512,512);
 let seed=73;const rand=()=>((seed=(seed*16807)%2147483647)-1)/2147483646;
 for(let x=0;x<512;x+=64){ctx.fillStyle=`rgba(119,94,57,${rand()*.06})`;ctx.fillRect(x,0,64,512);ctx.fillStyle='#bcae983b';ctx.fillRect(x,0,1,512);for(let i=0;i<38;i++){ctx.strokeStyle=`rgba(117,90,50,${.015+rand()*.03})`;ctx.beginPath();let dx=x+rand()*64;ctx.moveTo(dx,0);ctx.bezierCurveTo(dx+8,170,dx-6,340,dx+3,512);ctx.stroke()}ctx.fillStyle='#bcae9840';ctx.fillRect(x,x%128?150:360,64,1)}
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,3);texture.anisotropy=renderer.capabilities.getMaxAnisotropy();return texture;
}
function makePlant(parent,x,y,z,scale=1){
 const group=new THREE.Group();group.position.set(x,y,z);group.scale.setScalar(scale);parent.add(group);
 cylinder(group,.066,.049,.13,0,.065,0,mat('#bb947a'));
 const green=mat('#6c8062'),stem=mat('#849571');
 for(let i=0;i<7;i++){const angle=i*2.399,a=.04+i*.004;const leaf=new THREE.Mesh(new THREE.SphereGeometry(1,9,7),green);leaf.scale.set(.025,.11,.017);leaf.position.set(Math.cos(angle)*a,.19+(i%3)*.026,Math.sin(angle)*a);leaf.rotation.z=Math.cos(angle)*.55;leaf.rotation.x=Math.sin(angle)*.55;leaf.castShadow=true;group.add(leaf);cylinder(group,.003,.003,.16,Math.cos(angle)*a/2,.15,Math.sin(angle)*a/2,stem)}
}
function makeContactShadow(id,w,d){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(42,35,27,.24)');g.addColorStop(.5,'rgba(42,35,27,.13)');g.addColorStop(1,'rgba(42,35,27,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(c),mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;scene.add(mesh);contactShadows.set(id,mesh);
}
function buildKitchen(){
 kitchen=new THREE.Group();scene.add(kitchen);
 const cream=mat('#e2ddcf'),wood=mat('#bda98d'),top=mat('#f1eee7',.42),metal=mat('#706e65',.3,.65),toe=mat('#8e8679'),wallmat=mat('#e6e1d8');
 // One open wall keeps orbiting usable; it fades out when viewed from behind.
 const wall=new THREE.Mesh(new THREE.PlaneGeometry(6,2.65),wallmat);wall.position.set(0,1.325,-1.85);wall.receiveShadow=true;kitchen.add(wall);
 box(kitchen,4.2,.07,.035,0,.035,-1.825,toe,false);
 for(let i=0;i<6;i++){
  const x=-1.575+i*.63;
  box(kitchen,.62,.73,.60,x,.445,-1.51,cream);
  box(kitchen,.60,.70,.016,x,.46,-1.20,cream);
  box(kitchen,.22,.008,.018,x,.73,-1.181,metal);
  box(kitchen,.61,.08,.49,x,.04,-1.54,toe);
 }
 box(kitchen,3.82,.04,.67,0,.83,-1.50,top);
 box(kitchen,3.8,.38,.026,0,1.04,-1.82,mat('#f5f2eb'));
 for(const x of [-1.15,-.45]){
  box(kitchen,.66,.66,.32,x,1.85,-1.65,cream);
  box(kitchen,.63,.63,.018,x,1.85,-1.48,cream);
  box(kitchen,.006,.21,.022,x+.22,1.8,-1.46,metal);
 }
 box(kitchen,1.27,.035,.27,1.06,1.57,-1.67,wood);
 makePlant(kitchen,1.48,1.59,-1.63,.8);
 cylinder(kitchen,.052,.052,.11,.76,1.64,-1.64,mat('#d4c1a5'));
 box(kitchen,.44,.008,.32,.45,.854,-1.48,mat('#777d79',.35,.5));
 box(kitchen,.37,.004,.25,.45,.861,-1.48,mat('#505d5b',.45,.3));
 const faucet=new THREE.Mesh(new THREE.TorusGeometry(.092,.009,8,22,Math.PI),metal);faucet.position.set(.45,1.04,-1.69);faucet.rotation.y=Math.PI/2;kitchen.add(faucet);
 cylinder(kitchen,.009,.009,.19,.45,.95,-1.782,metal);
 // A small warm wood niche gives a familiar kitchen reference without adding appliances.
 const board=box(kitchen,.23,.32,.023,-1.30,1.01,-1.77,wood);board.rotation.z=-.13;
 makePlant(kitchen,1.68,.85,-1.51,.85);
 ground=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial({color:'#ffffff',map:floorTexture(),roughness:.86}));ground.rotation.x=-Math.PI/2;ground.position.y=-.004;ground.receiveShadow=true;scene.add(ground);
 studioGrid=new THREE.GridHelper(8,32,'#d4d8df','#e0e3e9');studioGrid.position.y=-.001;studioGrid.material.transparent=true;studioGrid.material.opacity=.34;scene.add(studioGrid);
}
function buildIsland(){
 if(island){scene.remove(island);const materials=new Set();island.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material)});materials.forEach(m=>m.dispose());}
 island=new THREE.Group();scene.add(island);const h=state.table/100;
 const frame=mat('#ddd6c8'),counter=mat('#cbb897',.5);
 // An open base keeps the shared floor and the person's full height visible.
 for(const x of [-.52,1.12])for(const z of [-.28,.28])box(island,.055,h-.04,.055,x,(h-.04)/2,z,frame);
 box(island,1.78,.075,.035,.30,h-.0775,.29,frame);
 box(island,1.78,.075,.035,.30,h-.0775,-.29,frame);
 box(island,.035,.075,.58,-.55,h-.0775,0,frame);
 box(island,.035,.075,.58,1.15,h-.0775,0,frame);
 box(island,1.94,.04,.76,.30,h-.02,0,counter);
 island.visible=state.place==='table';
}
function prepareMeshes(root){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;}});}
function normalizeProduct(gltf,id){
 const config=products[id],object=gltf.scene;object.updateMatrixWorld(true);
 const sourceBox=new THREE.Box3().setFromObject(object,true),size=sourceBox.getSize(new THREE.Vector3());
 if(!size.x||!size.y||!size.z)throw Error('В файле отсутствует геометрия прибора.');
 object.scale.set(config.width/size.x,config.height/size.y,config.depth/(config.housingDepth||size.z));object.updateMatrixWorld(true);
 const calibratedBox=new THREE.Box3().setFromObject(object,true),center=calibratedBox.getCenter(new THREE.Vector3());
 object.position.x-=center.x;object.position.y-=calibratedBox.min.y;object.position.z-=center.z;object.updateMatrixWorld(true);
 const group=new THREE.Group();group.name=config.name;group.add(object);scene.add(group);prepareMeshes(group);objects.set(id,group);
 config.assembledSize=new THREE.Box3().setFromObject(group,true).getSize(new THREE.Vector3());
}
function normalizeWoman(gltf){
 woman=new THREE.Group();const model=gltf.scene;
 model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model,true);const size=bounds.getSize(new THREE.Vector3());
 model.scale.setScalar(1/size.y);model.updateMatrixWorld(true);const unitBounds=new THREE.Box3().setFromObject(model,true),center=unitBounds.getCenter(new THREE.Vector3());
 model.position.x-=center.x;model.position.y-=unitBounds.min.y;model.position.z-=center.z;woman.add(model);scene.add(woman);prepareMeshes(woman);
}
function syncScene(){
 $('height3d').value=state.human;$('table3d').value=state.table;$('table3d').disabled=state.place==='floor';$('table3d').closest('.field-row').style.opacity=state.place==='floor'?'.4':'1';
 for(const [id,on]of [['onTable',state.place==='table'],['onFloor',state.place==='floor'],['kitchenBtn',state.room==='kitchen'],['studioBtn',state.room==='studio']]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}
 $('show5100').checked=state.show5100;$('show3500').checked=state.show3500;$('personPosition3d').value=state.personX*100;
 if(woman){woman.scale.setScalar(state.human/100);woman.position.set(state.personX,0,-.53);woman.updateMatrixWorld(true);}
 for(const [id,object]of objects){const p=products[id];$('size'+id).textContent=[p.width*100,p.height*100,p.depth*100].map(fmt).join(' × ')+' см';$('label'+id).querySelector('span').textContent='Высота '+fmt(p.height*100)+' см';object.visible=state['show'+id];object.position.set(p.x,state.place==='table'?state.table/100:0,p.z);object.updateMatrixWorld(true);}
 buildIsland();
 for(const [id,shadow]of contactShadows){if(id==='woman'){shadow.position.set(state.personX,.001,-.53);}else{const p=products[id];shadow.position.set(p.x,(state.place==='table'?state.table/100:0)+.001,p.z);shadow.visible=state['show'+id];}}
 kitchen.visible=state.room==='kitchen';studioGrid.visible=state.room==='studio';ground.material.color.set(state.room==='kitchen'?'#ffffff':'#f3f4f8');ground.material.map=state.room==='kitchen'?ground.userData.woodTexture:null;ground.material.needsUpdate=true;
 scene.background.set(state.room==='kitchen'?'#eee9e1':'#eef0f5');$('personLabel').textContent=`Рост ${state.human} см`;
 updateMeasurementData();
}
function updateMeasurementData(){
 const info={human:state.human/100,table:state.table/100,place:state.place,models:{}};
 for(const [id,o]of objects){const b=new THREE.Box3().setFromObject(o,true),s=b.getSize(new THREE.Vector3());info.models[id]={visible:o.visible,width:s.x,height:s.y,assembledDepth:s.z,baseY:b.min.y,housingDepth:products[id].depth};}
 if(woman){const box=new THREE.Box3().setFromObject(woman,true);info.person={height:box.max.y-box.min.y,width:box.max.x-box.min.x,baseY:box.min.y,x:woman.position.x};}
 canvas.dataset.measurements=JSON.stringify(info);
}
function subjectBounds(){const bounds=new THREE.Box3();if(woman)bounds.expandByObject(woman,true);for(const object of objects.values())if(object.visible)bounds.expandByObject(object,true);if(bounds.isEmpty())bounds.set(new THREE.Vector3(-.8,0,-.4),new THREE.Vector3(.9,1.7,.4));return bounds;}
function fitView(view=state.view){
 state.view=view;currentPreset=view;
 const useOrtho=view==='front'||view==='side';camera=useOrtho?orthographic:perspective;setupControls();
 const bounds=subjectBounds(),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),aspect=wrap.clientWidth/wrap.clientHeight;
 center.y+=.015;controls.target.copy(center);
 const vertical=size.y+.22,horizontal=(view==='side'?size.z+.26:size.x+.24),distance=Math.max(vertical,horizontal/aspect)/(2*Math.tan(THREE.MathUtils.degToRad(34)/2))*1.08;
 if(useOrtho){const h=Math.max(vertical,horizontal/aspect)*1.14;orthographic.left=-h*aspect/2;orthographic.right=h*aspect/2;orthographic.top=h/2;orthographic.bottom=-h/2;orthographic.zoom=1;camera.position.copy(center).add(view==='front'?new THREE.Vector3(0,.035,5):new THREE.Vector3(5,.035,0));}
 else{const direction=new THREE.Vector3(.55,.24,1).normalize();camera.position.copy(center).addScaledVector(direction,Math.min(10.2,distance));}
 camera.lookAt(center);camera.updateProjectionMatrix();controls.update();updateViewButtons();updateLabels();
}
function updateViewButtons(){for(const [id,view]of [['viewPerspective','perspective'],['viewFront','front'],['viewSide','side']]){const on=currentPreset===view;$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on))}}
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);perspective.aspect=w/h;perspective.updateProjectionMatrix();if(camera===orthographic){const half=(orthographic.top-orthographic.bottom)/2;orthographic.left=-half*w/h;orthographic.right=half*w/h;orthographic.updateProjectionMatrix();}if(currentPreset!=='free')fitView(state.view);}
const projected=new THREE.Vector3();
function placeLabel(id,position,visible=true){const el=$(id);if(!visible){el.style.opacity='0';return}projected.copy(position).project(camera);const on=projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<1.05&&Math.abs(projected.y)<1.05;el.style.opacity=on?'1':'0';if(on){el.style.left=`${Math.max(45,Math.min(wrap.clientWidth-45,(projected.x+1)*wrap.clientWidth/2))}px`;el.style.top=`${(1-projected.y)*wrap.clientHeight/2}px`;}}
function updateLabels(){
 if(!camera)return;
 placeLabel('personLabel',new THREE.Vector3(state.personX,state.human/100+.09,-.53),!!woman);
 for(const [id,p]of Object.entries(products)){const object=objects.get(id);placeLabel(p.label,new THREE.Vector3(p.x,(state.place==='table'?state.table/100:0)+p.height+.10,p.z),object?.visible);}
 const a=$('label5100'),b=$('label3500');if(a.style.opacity==='1'&&b.style.opacity==='1'){const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();if(ar.left<br.right&&ar.right>br.left&&Math.abs(ar.top-br.top)<br.height+5)b.style.top=`${parseFloat(b.style.top)-br.height-10}px`;}
}
function animate(){if(disposed)return;frameId=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);updateLabels();}
function zoom(factor){if(camera.isOrthographicCamera){camera.zoom=Math.max(.45,Math.min(4,camera.zoom*factor));camera.updateProjectionMatrix();}else{const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(1/factor).clampLength(.7,11);camera.position.copy(controls.target).add(offset);}currentPreset='free';controls.update();updateViewButtons();}
function back(e){if(parent!==window){e?.preventDefault();parent.postMessage({type:'demiand-close-3d',human:state.human,table:state.table,place:state.place},location.origin)}}
function bindUI(){
 $('backLink').addEventListener('click',back);window.addEventListener('keydown',e=>{if(e.key==='Escape')back(e)});
 for(const [id,min,max,key]of [['height3d',145,205,'human'],['table3d',65,110,'table']]){
  $(id).addEventListener('input',()=>{const n=Number($(id).value);if(n>=min&&n<=max){state[key]=n;syncScene();}});
  $(id).addEventListener('change',()=>{state[key]=Math.round(clamp($(id).value,min,max,state[key]));syncScene();});
 }
 for(const id of ['5100','3500'])$('show'+id).addEventListener('change',e=>{state['show'+id]=e.target.checked;syncScene();});
 for(const [id,key,value]of [['onTable','place','table'],['onFloor','place','floor'],['kitchenBtn','room','kitchen'],['studioBtn','room','studio']])$(id).addEventListener('click',()=>{state[key]=value;syncScene();});
 for(const [id,view]of [['viewPerspective','perspective'],['viewFront','front'],['viewSide','side']])$(id).addEventListener('click',()=>fitView(view));
 $('fit3d').addEventListener('click',()=>fitView(state.view));$('zoomIn3d').addEventListener('click',()=>zoom(1.18));$('zoomOut3d').addEventListener('click',()=>zoom(1/1.18));
 $('personPosition3d').addEventListener('input',e=>{state.personX=Number(e.target.value)/100;woman?.position.set(state.personX,0,-.53);contactShadows.get('woman')?.position.set(state.personX,.001,-.53);updateMeasurementData();});
 $('reset3d').addEventListener('click',()=>{Object.assign(state,defaults());syncScene();fitView('perspective');});
 $('settingsToggle').addEventListener('click',()=>{const on=$('settingsToggle').getAttribute('aria-expanded')!=='true';$('settingsToggle').setAttribute('aria-expanded',String(on));$('settings').classList.toggle('open',on);});
 $('retry3d').addEventListener('click',()=>location.reload());
 if(matchMedia('(pointer:coarse)').matches)$('gestureHint').textContent='Одним пальцем — вращение · Двумя — приближение и перемещение';
}
function nonBreakingCopy(){const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(!/^(SCRIPT|STYLE)$/.test(node.parentElement?.tagName||''))node.nodeValue=node.nodeValue.replace(/(^|[\s(«])([ВвКкСсУуИиАа]|[Нн]е|[Пп]о|[Нн]а|[Ии]з|[Зз]а|[Дд]ля|[Оо]т|[Дд]о) +(?=[А-ЯЁа-яёA-Za-z0-9«])/gu,'$1$2\u00a0');}
async function start(){
 try{
  initRenderer();buildKitchen();makeContactShadow('woman',.58,.42);for(const [id,p]of Object.entries(products))makeContactShadow(id,p.width*1.3,(id==='3500'?.41:p.depth)*1.2);ground.userData.woodTexture=ground.material.map;bindUI();nonBreakingCopy();resize();animate();
  let completed=0;const loaded=()=>{$('loadingProgress').style.width=`${++completed/3*100}%`;$('loadingText').textContent=completed<3?'Расставляем приборы и настраиваем масштаб…':'Всё готово';};
  await Promise.all([ ...Object.entries(products).map(async([id,p])=>{normalizeProduct(await loader.loadAsync(p.path),id);loaded();}), (async()=>{normalizeWoman(await loader.loadAsync('assets/models/woman-standing.glb'));loaded();})() ]);
  syncScene();resize();fitView('perspective');$('loading').classList.add('done');$('loading').setAttribute('aria-hidden','true');setTimeout(()=>$('loading').hidden=true,450);canvas.dataset.ready='true';
  new ResizeObserver(resize).observe(wrap);
 }catch(error){console.error('DEMIAND 3D:',error);fail('Не удалось загрузить сцену. Проверьте подключение и попробуйте ещё раз.');}
}
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frameId);controls?.dispose();draco.dispose();renderer?.dispose();environmentTexture?.dispose();});
start();
