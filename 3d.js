import * as THREE from 'three';
import {OrbitControls} from './assets/vendor/OrbitControls.js';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';
import {DRACOLoader} from './assets/vendor/DRACOLoader.js';
import {createKitchen} from './3d-kitchen.js?v=20261031-7';
import {EffectComposer} from './assets/vendor/addons/postprocessing/EffectComposer.js';
import {RenderPass} from './assets/vendor/addons/postprocessing/RenderPass.js';
import {SSAOPass} from './assets/vendor/addons/postprocessing/SSAOPass.js';
import {OutputPass} from './assets/vendor/addons/postprocessing/OutputPass.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))&&v!==null?Math.max(min,Math.min(max,Number(v))):fallback;
const initial={human:clamp(params.get('human'),145,205,164),table:clamp(params.get('table'),65,110,76),place:params.get('place')==='floor'?'floor':'table'};
const defaults=()=>({...initial,room:'kitchen',view:'perspective',personX:-1.14,show5100:true,show3500:true});
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
let kitchenDesign,composer,scenePass,contactAO;
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
 const hemi=new THREE.HemisphereLight('#ffe0b2','#24170d',.40);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#ffd29b',2.0);sun.position.set(-3,5,4);sun.castShadow=true;
 sun.shadow.mapSize.set(innerWidth<760?1024:2048,innerWidth<760?1024:2048);sun.shadow.camera.left=-3;sun.shadow.camera.right=3;sun.shadow.camera.top=3;sun.shadow.camera.bottom=-3;sun.shadow.camera.near=.1;sun.shadow.camera.far=12;sun.shadow.normalBias=.0008;sun.shadow.bias=-.00008;sun.shadow.radius=3;scene.add(sun);
 const fill=new THREE.DirectionalLight('#ffdeb1',.65);fill.position.set(3,3,2);scene.add(fill);
 const pmrem=new THREE.PMREMGenerator(renderer),room=warmReflectionRoom();environmentTexture=pmrem.fromScene(room,.06).texture;scene.environment=environmentTexture;scene.environmentIntensity=1.5;room.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});pmrem.dispose();
 setupControls();initPostprocessing();
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail('Браузер приостановил 3D. Обновите просмотр, чтобы продолжить.')});
}
function initPostprocessing(){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:innerWidth<760?2:4});
 composer=new EffectComposer(renderer,target);composer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 scenePass=new RenderPass(scene,camera);composer.addPass(scenePass);
 contactAO=new SSAOPass(scene,camera,1,1,16);contactAO.kernelRadius=.13;contactAO.minDistance=.000015;contactAO.maxDistance=.006;
 composer.addPass(contactAO);composer.addPass(new OutputPass());
}
function syncPostCamera(){if(!contactAO)return;scenePass.camera=camera;contactAO.camera=camera;const m=contactAO.ssaoMaterial;m.defines.PERSPECTIVE_CAMERA=camera.isPerspectiveCamera?1:0;m.needsUpdate=true;m.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);m.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);}
function warmReflectionRoom(){
 const room=new THREE.Scene();room.background=new THREE.Color('#20180f');
 const shell=new THREE.Mesh(new THREE.SphereGeometry(10,24,16),new THREE.MeshBasicMaterial({color:'#7f756b',side:THREE.BackSide}));room.add(shell);
 function panel(w,h,x,y,z,color,power){const m=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide,toneMapped:false});const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);p.position.set(x,y,z);p.lookAt(0,.9,0);room.add(p);}
 panel(2.0,3.3,-4.5,2.2,3.8,'#ffcb88',1.4);panel(1.1,3.5,4.7,2.0,2.1,'#ffb55b',1.6);
 panel(2.0,1.3,0,3.3,5.7,'#ffe0b2',1.0);panel(4.4,.15,0,2.6,-3.8,'#ffae46',1.7);
 panel(3.1,.11,-.5,4.2,0,'#ffd59b',1.2);return room;
}
function setupControls(){
 controls?.dispose();controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.7;controls.maxDistance=11;controls.minZoom=.45;controls.maxZoom=4;
 controls.minPolarAngle=.18;controls.maxPolarAngle=Math.PI/2-.025;controls.screenSpacePanning=true;controls.target.set(.1,.85,0);controls.listenToKeyEvents(canvas);controls.keyPanSpeed=15;
 controls.addEventListener('start',()=>{currentPreset='free';updateViewButtons()});
}
function makeContactShadow(id,w,d){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
 const spots=id==='woman'?[41,87]:[64];for(const x of spots){ctx.save();ctx.translate(x,64);ctx.scale(id==='woman'?.35:1,id==='woman'?.80:1);const g=ctx.createRadialGradient(0,0,2,0,0,58);g.addColorStop(0,'rgba(0,0,0,.88)');g.addColorStop(.24,'rgba(0,0,0,.60)');g.addColorStop(.62,'rgba(0,0,0,.20)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(-64,-64,128,128);ctx.restore();}

 const texture=new THREE.CanvasTexture(c),mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;scene.add(mesh);contactShadows.set(id,mesh);
}
function buildKitchen(){kitchenDesign=createKitchen(scene,renderer);kitchen=kitchenDesign.group;island=kitchenDesign.island;ground=kitchenDesign.ground;studioGrid=kitchenDesign.grid;}
function buildIsland(){kitchenDesign.setHeight(state.table/100,state.place==='table');}
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
 if(woman){woman.scale.setScalar(state.human/100);woman.position.set(state.personX,0,-.60);woman.updateMatrixWorld(true);}
 for(const [id,object]of objects){const p=products[id];$('size'+id).textContent=[p.width*100,p.height*100,p.depth*100].map(fmt).join(' × ')+' см';$('label'+id).querySelector('span').textContent='Высота '+fmt(p.height*100)+' см';object.visible=state['show'+id];object.position.set(p.x,state.place==='table'?state.table/100:0,p.z);object.updateMatrixWorld(true);}
 buildIsland();
 for(const [id,shadow]of contactShadows){if(id==='woman'){shadow.position.set(state.personX,.0003,-.60+.065*state.human/164);shadow.scale.setScalar(state.human/164);}else{const p=products[id];shadow.position.set(p.x,(state.place==='table'?state.table/100:0)+.0003,p.z);shadow.visible=state['show'+id];}}
 kitchenDesign.setEnvironment(state.room==='kitchen');
 scene.background.set(state.room==='kitchen'?'#2b2d32':'#eef0f5');$('personLabel').textContent=`Рост ${state.human} см`;
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
 camera.lookAt(center);camera.updateProjectionMatrix();syncPostCamera();controls.update();updateViewButtons();updateLabels();
}
function updateViewButtons(){for(const [id,view]of [['viewPerspective','perspective'],['viewFront','front'],['viewSide','side']]){const on=currentPreset===view;$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on))}}
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);composer?.setSize(w,h);if(contactAO)contactAO.setSize(Math.round(w*Math.min(devicePixelRatio,1.5)*.7),Math.round(h*Math.min(devicePixelRatio,1.5)*.7));perspective.aspect=w/h;perspective.updateProjectionMatrix();if(camera===orthographic){const half=(orthographic.top-orthographic.bottom)/2;orthographic.left=-half*w/h;orthographic.right=half*w/h;orthographic.updateProjectionMatrix();}if(currentPreset!=='free')fitView(state.view);else syncPostCamera();}
const projected=new THREE.Vector3();
function placeLabel(id,position,visible=true){const el=$(id);if(!visible){el.style.opacity='0';return}projected.copy(position).project(camera);const on=projected.z>=-1&&projected.z<=1&&Math.abs(projected.x)<1.05&&Math.abs(projected.y)<1.05;el.style.opacity=on?'1':'0';if(on){el.style.left=`${Math.max(45,Math.min(wrap.clientWidth-45,(projected.x+1)*wrap.clientWidth/2))}px`;el.style.top=`${(1-projected.y)*wrap.clientHeight/2}px`;}}
function updateLabels(){
 if(!camera)return;
 placeLabel('personLabel',new THREE.Vector3(state.personX,state.human/100+.09,-.60),!!woman);
 for(const [id,p]of Object.entries(products)){const object=objects.get(id);placeLabel(p.label,new THREE.Vector3(p.x,(state.place==='table'?state.table/100:0)+p.height+.10,p.z),object?.visible);}
 const a=$('label5100'),b=$('label3500');if(a.style.opacity==='1'&&b.style.opacity==='1'){const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();if(ar.left<br.right&&ar.right>br.left&&Math.abs(ar.top-br.top)<br.height+5)b.style.top=`${parseFloat(b.style.top)-br.height-10}px`;}
}
function animate(){if(disposed)return;frameId=requestAnimationFrame(animate);controls.update();kitchenDesign.updateCamera(camera,state.room==='kitchen');composer.render();updateLabels();}
function zoom(factor){if(camera.isOrthographicCamera){camera.zoom=Math.max(.45,Math.min(4,camera.zoom*factor));camera.updateProjectionMatrix();}else{const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(1/factor).clampLength(.7,11);camera.position.copy(controls.target).add(offset);}currentPreset='free';syncPostCamera();controls.update();updateViewButtons();}
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
 $('personPosition3d').addEventListener('input',e=>{state.personX=Number(e.target.value)/100;woman?.position.set(state.personX,0,-.60);contactShadows.get('woman')?.position.set(state.personX,.0003,-.60+.065*state.human/164);updateMeasurementData();});
 $('reset3d').addEventListener('click',()=>{Object.assign(state,defaults());syncScene();fitView('perspective');});
 $('settingsToggle').addEventListener('click',()=>{const on=$('settingsToggle').getAttribute('aria-expanded')!=='true';$('settingsToggle').setAttribute('aria-expanded',String(on));$('settings').classList.toggle('open',on);});
 $('retry3d').addEventListener('click',()=>location.reload());
 if(matchMedia('(pointer:coarse)').matches)$('gestureHint').textContent='Одним пальцем — вращение · Двумя — приближение и перемещение';
}
function nonBreakingCopy(){const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(!/^(SCRIPT|STYLE)$/.test(node.parentElement?.tagName||''))node.nodeValue=node.nodeValue.replace(/(^|[\s(«])([ВвКкСсУуИиАа]|[Нн]е|[Пп]о|[Нн]а|[Ии]з|[Зз]а|[Дд]ля|[Оо]т|[Дд]о) +(?=[А-ЯЁа-яёA-Za-z0-9«])/gu,'$1$2\u00a0');}
async function start(){
 try{
  initRenderer();buildKitchen();makeContactShadow('woman',.42,.34);for(const [id,p]of Object.entries(products))makeContactShadow(id,p.width*1.3,(id==='3500'?.41:p.depth)*1.2);bindUI();nonBreakingCopy();resize();animate();
  let completed=0;const loaded=()=>{$('loadingProgress').style.width=`${++completed/3*100}%`;$('loadingText').textContent=completed<3?'Расставляем приборы и настраиваем масштаб…':'Всё готово';};
  await Promise.all([ kitchenDesign.ready, ...Object.entries(products).map(async([id,p])=>{normalizeProduct(await loader.loadAsync(p.path),id);loaded();}), (async()=>{normalizeWoman(await loader.loadAsync('assets/models/woman-original.glb'));loaded();})() ]);
  syncScene();resize();fitView('perspective');$('loading').classList.add('done');$('loading').setAttribute('aria-hidden','true');setTimeout(()=>$('loading').hidden=true,450);canvas.dataset.ready='true';
  new ResizeObserver(resize).observe(wrap);
 }catch(error){console.error('DEMIAND 3D:',error);fail('Не удалось загрузить сцену. Проверьте подключение и попробуйте ещё раз.');}
}
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frameId);controls?.dispose();draco.dispose();composer?.dispose();contactAO?.dispose();renderer?.dispose();environmentTexture?.dispose();});
start();
