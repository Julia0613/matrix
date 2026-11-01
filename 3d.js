import * as THREE from 'three';
import {OrbitControls} from './assets/vendor/OrbitControls.js';
import {GLTFLoader} from './assets/vendor/GLTFLoader.js';
import {DRACOLoader} from './assets/vendor/DRACOLoader.js';
import {createKitchen} from './3d-kitchen.js?v=20261101-31';
import {labelAnchor} from './3d-labels.js?v=20261101-31';
import {createFoodInteriors} from './3d-food.js?v=20261101-32';
import {EffectComposer} from './assets/vendor/addons/postprocessing/EffectComposer.js';
import {RenderPass} from './assets/vendor/addons/postprocessing/RenderPass.js';
import {SSAOPass} from './assets/vendor/addons/postprocessing/SSAOPass.js';
import {OutputPass} from './assets/vendor/addons/postprocessing/OutputPass.js';
import {UnrealBloomPass} from './assets/vendor/addons/postprocessing/UnrealBloomPass.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))&&v!==null?Math.max(min,Math.min(max,Number(v))):fallback;
const initial={human:clamp(params.get('human'),145,205,164),table:clamp(params.get('table'),65,110,76),place:params.get('place')==='floor'?'floor':'table'};
const catalog=window.CATALOG,modelFiles=window.MODELS_3D,MAX_PRODUCTS=3;
const products=Object.fromEntries(catalog.filter(p=>modelFiles[p.id]).map(p=>{const [depth,width,height]=p.dimensions;return[p.id,{...p,...modelFiles[p.id],width:width/100,height:height/100,depth:depth/100,x:0,z:0,label:'label'+p.id}]}));
const requested=params.has('models')?params.get('models').split(',').filter(Boolean):null;
const initialSelection=requested?[...new Set(requested.filter(id=>products[id]))].slice(0,MAX_PRODUCTS):['2100','3500','1200'];
const defaults=()=>({...initial,room:'kitchen',view:'perspective',personX:-1.14,selected:new Set(initialSelection)});
const state=defaults();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let pickerCategory='Все',pickerSearch='',selectionRevision=0,selectionTouched=false,pickerSelectionAtOpen='';
const pendingLoads=new Map(),loadErrors=new Set();
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
let renderer,scene,perspective,orthographic,camera,controls,woman,island,kitchen,studioGrid,ground,frameId=0,environmentTexture,productEnvironmentTexture;
let kitchenDesign,composer,scenePass,contactAO,lightBloom;
let disposed=false,sceneReady=false,currentPreset='perspective',renderedFrames=0;
const objects=new Map(),contactShadows=new Map(),wrap=$('canvasWrap'),canvas=$('sceneCanvas');
const loader=new GLTFLoader(),draco=new DRACOLoader();draco.setDecoderPath('./assets/vendor/');draco.setWorkerLimit(2);loader.setDRACOLoader(draco);
const foodInteriors=createFoodInteriors({loadAsync:loadGLB},()=>environmentTexture);

async function loadGLB(url){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),45000);
 try{const response=await fetch(url,{signal:abort.signal});if(!response.ok)throw Error(`3D-файл недоступен (${response.status}).`);const buffer=await response.arrayBuffer();return await loader.parseAsync(buffer,new URL('.',new URL(url,location.href)).href);}
 finally{clearTimeout(timer);}
}
function requestRender(){if(!disposed&&sceneReady&&!document.hidden&&!$('productPicker').open&&!frameId)frameId=requestAnimationFrame(animate);}
function pauseRendering(){cancelAnimationFrame(frameId);frameId=0;}

function fail(message){$('loading').hidden=true;$('sceneError').hidden=false;$('errorText').textContent=message;}
function initRenderer(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.10;renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene=new THREE.Scene();scene.background=new THREE.Color('#eee9e1');
 perspective=new THREE.PerspectiveCamera(34,1,.03,40);orthographic=new THREE.OrthographicCamera(-2,2,2,-2,.03,40);camera=perspective;
 const hemi=new THREE.HemisphereLight('#fffaf8','#8b8588',.46);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#fff8f3',1.45);sun.position.set(-3,5,4);sun.castShadow=true;
 sun.shadow.mapSize.set(innerWidth<760?1024:2048,innerWidth<760?1024:2048);sun.shadow.camera.left=-3;sun.shadow.camera.right=3;sun.shadow.camera.top=3;sun.shadow.camera.bottom=-3;sun.shadow.camera.near=.1;sun.shadow.camera.far=12;sun.shadow.normalBias=.0008;sun.shadow.bias=-.00008;sun.shadow.radius=3;scene.add(sun);
 const fill=new THREE.DirectionalLight('#fffaff',.48);fill.position.set(3,3,2);scene.add(fill);
 const pmrem=new THREE.PMREMGenerator(renderer),room=pearlReflectionRoom();environmentTexture=pmrem.fromScene(room,.035).texture;scene.environment=environmentTexture;scene.environmentIntensity=.6;
 // Extra softboxes are visible only in appliance reflections; kitchen lighting stays fixed.
 const softbox=(w,h,x,y,z,power)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color('#fffaf5').multiplyScalar(power),side:THREE.DoubleSide,toneMapped:false}));p.position.set(x,y,z);p.lookAt(0,.8,0);room.add(p);};
 softbox(4.5,3.2,0,4.5,.2,3.0);softbox(.65,3.0,-3.6,2.4,-1.8,2.3);softbox(.55,2.5,3.6,2.0,-1.6,2.0);
 softbox(3.5,.9,0,2.8,-4.2,4.0);softbox(.9,2.8,-3,2,-4.2,2.5);softbox(.9,2.8,3,2,-4.2,2.5);
 productEnvironmentTexture=pmrem.fromScene(room,.035).texture;room.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});pmrem.dispose();
 setupControls();initPostprocessing();
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();sceneReady=false;pauseRendering();fail('Браузер приостановил 3D. Обновите просмотр, чтобы продолжить.')});
}
function initPostprocessing(){
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:innerWidth<760?2:4});
 composer=new EffectComposer(renderer,target);composer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 scenePass=new RenderPass(scene,camera);composer.addPass(scenePass);
 contactAO=new SSAOPass(scene,camera,1,1,16);contactAO.kernelRadius=.13;contactAO.minDistance=.000015;contactAO.maxDistance=.006;
 composer.addPass(contactAO);lightBloom=new UnrealBloomPass(new THREE.Vector2(1,1),.34,.36,3.8);composer.addPass(lightBloom);composer.addPass(new OutputPass());
}
function syncPostCamera(){if(!contactAO)return;scenePass.camera=camera;contactAO.camera=camera;const m=contactAO.ssaoMaterial;m.defines.PERSPECTIVE_CAMERA=camera.isPerspectiveCamera?1:0;m.needsUpdate=true;m.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);m.uniforms.cameraInverseProjectionMatrix.value.copy(camera.projectionMatrixInverse);requestRender();}
function pearlReflectionRoom(){
 const room=new THREE.Scene();room.background=new THREE.Color('#38363a');
 const shell=new THREE.Mesh(new THREE.SphereGeometry(10,24,16),new THREE.MeshBasicMaterial({color:'#514f53',side:THREE.BackSide}));room.add(shell);
 function panel(w,h,x,y,z,color,power){const m=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(power),side:THREE.DoubleSide,toneMapped:false});const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);p.position.set(x,y,z);p.lookAt(0,.9,0);room.add(p);}
 panel(2.0,3.3,-4.5,2.2,3.8,'#fff9f5',3.2);panel(1.1,3.5,4.7,2.0,2.1,'#fff7ff',2.0);
 panel(2.0,1.3,0,3.3,5.7,'#fff9f7',2.0);panel(4.4,.15,0,2.6,-3.8,'#ffe9d8',3.2);
 panel(3.1,.11,-.5,4.2,0,'#fff4ee',2.8);
 panel(2.2,3.5,-2,-.5,4,'#fff5f2',2.1);panel(.8,3.0,.8,-.4,4.5,'#fff9f7',1.5);
 const reflectedFloor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({color:'#ddd6d5',side:THREE.DoubleSide}));reflectedFloor.rotation.x=-Math.PI/2;reflectedFloor.position.y=-3.5;room.add(reflectedFloor);return room;
}
function setupControls(){
 controls?.dispose();controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.7;controls.maxDistance=11;controls.minZoom=.45;controls.maxZoom=4;
 controls.minPolarAngle=.18;controls.maxPolarAngle=Math.PI/2-.025;controls.screenSpacePanning=true;controls.target.set(.1,.85,0);controls.listenToKeyEvents(canvas);controls.keyPanSpeed=15;
 controls.addEventListener('start',()=>{currentPreset='free';updateViewButtons()});
 controls.addEventListener('change',requestRender);
}
function makeContactShadow(id,w,d){
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
 const spots=id==='woman'?[41,87]:[64];for(const x of spots){ctx.save();ctx.translate(x,64);ctx.scale(id==='woman'?.35:1,id==='woman'?.80:1);const g=ctx.createRadialGradient(0,0,2,0,0,58);g.addColorStop(0,'rgba(0,0,0,.88)');g.addColorStop(.24,'rgba(0,0,0,.60)');g.addColorStop(.62,'rgba(0,0,0,.20)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(-64,-64,128,128);ctx.restore();}

 const texture=new THREE.CanvasTexture(c),mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;scene.add(mesh);contactShadows.set(id,mesh);
}
function buildKitchen(){kitchenDesign=createKitchen(scene,renderer,environmentTexture);kitchen=kitchenDesign.group;island=kitchenDesign.island;ground=kitchenDesign.ground;studioGrid=kitchenDesign.grid;}
function buildIsland(){kitchenDesign.setHeight(state.table/100,state.place==='table');}
function prepareMeshes(root){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.isSkinnedMesh)o.frustumCulled=false;}});}
function normalizeProduct(gltf,id){
 const config=products[id],object=gltf.scene;if(config.rotationY)object.rotation.y+=config.rotationY;object.updateMatrixWorld(true);
 const sourceBox=new THREE.Box3().setFromObject(object,true),size=sourceBox.getSize(new THREE.Vector3());
 if(!size.x||!size.y||!size.z)throw Error('В файле отсутствует геометрия прибора.');
 object.scale.set(config.width/size.x,config.height/size.y,config.depth/(config.housingDepth||size.z));object.updateMatrixWorld(true);
 const calibratedBox=new THREE.Box3().setFromObject(object,true),center=calibratedBox.getCenter(new THREE.Vector3());
 object.position.x-=center.x;object.position.y-=calibratedBox.min.y;object.position.z-=center.z;object.updateMatrixWorld(true);
 const finishes=new Map();object.traverse(o=>{if(!o.isMesh)return;const reflect=m=>{if(!m.isMeshStandardMaterial||m.transparent||m.map)return m;if(finishes.has(m))return finishes.get(m);const copy=m.clone();copy.envMap=productEnvironmentTexture;copy.envMapIntensity=.65;
  if(Math.max(copy.color.r,copy.color.g,copy.color.b)<.05&&copy.roughness<.65){copy.envMapIntensity=.85;if('specularIntensity'in copy)copy.specularIntensity=Math.max(copy.specularIntensity,.8);}
  copy.needsUpdate=true;finishes.set(m,copy);return copy;};o.material=Array.isArray(o.material)?o.material.map(reflect):reflect(o.material);});
 if(id==='2400'){const replacements=new Map();object.traverse(o=>{if(!o.isMesh)return;const fix=m=>{if(m.name!=='Material #72.001')return m;if(replacements.has(m))return replacements.get(m);const glossy=m.clone();glossy.specularIntensity=1;glossy.roughness=.28;glossy.clearcoat=.25;glossy.clearcoatRoughness=.3;glossy.envMap=productEnvironmentTexture;glossy.envMapIntensity=.85;glossy.needsUpdate=true;replacements.set(m,glossy);return glossy;};o.material=Array.isArray(o.material)?o.material.map(fix):fix(o.material);});}
 const displayName=id==='2200'?'2200 CURRENT Display200 suppliedarchive':id==='2400'?'Material #127.001':null;
 if(displayName){const copies=new Map();object.traverse(o=>{if(!o.isMesh)return;const keepReadable=m=>{if(m.name!==displayName)return m;if(copies.has(m))return copies.get(m);const copy=m.clone();copy.envMap=environmentTexture;copy.envMapIntensity=.12;copy.roughness=.22;copy.needsUpdate=true;copies.set(m,copy);return copy;};o.material=Array.isArray(o.material)?o.material.map(keepReadable):keepReadable(o.material);});}
 const group=new THREE.Group();group.name=config.name;group.add(object);scene.add(group);prepareMeshes(group);objects.set(id,group);
 config.assembledSize=new THREE.Box3().setFromObject(group,true).getSize(new THREE.Vector3());
}
function normalizeWoman(gltf){
 woman=new THREE.Group();const model=gltf.scene;
 model.traverse(o=>{if(!o.isMesh)return;const recolor=m=>{const palette={'Charcoal tailored trousers':'#62666c','Tailoring seam':'#555a61','Trousers button':'#484d54','Ivory fine knit sweater':'#a9adb4','Sweater ribbed hems':'#a1a6ae'};if(!palette[m.name])return m;const copy=m.clone();copy.color.set(palette[m.name]);copy.roughness=.82;return copy;};o.material=Array.isArray(o.material)?o.material.map(recolor):recolor(o.material);});
 model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model,true);const size=bounds.getSize(new THREE.Vector3());
 model.scale.setScalar(1/size.y);model.updateMatrixWorld(true);const unitBounds=new THREE.Box3().setFromObject(model,true),center=unitBounds.getCenter(new THREE.Vector3());
 model.position.x-=center.x;model.position.y-=unitBounds.min.y;model.position.z-=center.z;woman.add(model);scene.add(woman);prepareMeshes(woman);
}
function syncScene(){
 $('height3d').value=state.human;$('table3d').value=state.table;$('table3d').disabled=state.place==='floor';$('table3d').closest('.field-row').style.opacity=state.place==='floor'?'.4':'1';
 for(const [id,on]of [['onTable',state.place==='table'],['onFloor',state.place==='floor'],['kitchenBtn',state.room==='kitchen'],['studioBtn',state.room==='studio']]){$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on));}
 $('personPosition3d').value=state.personX*100;layoutProducts();
 if(woman){woman.scale.setScalar(state.human/100);woman.position.set(state.personX,0,-.60);woman.updateMatrixWorld(true);}
 for(const [id,object]of objects){const p=products[id];object.visible=state.selected.has(id);object.position.set(p.x,state.place==='table'?state.table/100:0,p.z);object.updateMatrixWorld(true);}

 buildIsland();
 for(const [id,shadow]of contactShadows){if(id==='woman'){shadow.position.set(state.personX,.0003,-.60+.065*state.human/164);shadow.scale.setScalar(state.human/164);}else{const p=products[id];shadow.position.set(p.x,(state.place==='table'?state.table/100:0)+.0003,p.z);shadow.visible=state.selected.has(id)&&objects.has(id);}}
 kitchenDesign.setEnvironment(state.room==='kitchen');
 scene.background.set(state.room==='kitchen'?'#ccc8c6':'#eef0f5');$('personLabel').textContent=`Рост ${state.human} см`;
 updateMeasurementData();renderSelected();requestRender();
}
function layoutProducts(){
 const ids=[...state.selected],gap=ids.length>2?.16:.22,total=ids.reduce((sum,id)=>sum+products[id].width,0)+Math.max(0,ids.length-1)*gap;
 const deepest=Math.max(0,...ids.map(id=>products[id].assembledSize?.z||products[id].depth)),front=state.place==='table'?-.40+.05+deepest:.25;
 let left=.30-total/2;for(const id of ids){const p=products[id];p.x=left+p.width/2;p.z=front-(p.assembledSize?.z||p.depth)/2;left+=p.width+gap;}
}
function showSelectionNotice(message){$('selectionNotice').hidden=!message;$('selectionNotice').textContent=message;}
function renderSelected(){
 $('selectedCount').textContent=`${state.selected.size} из ${MAX_PRODUCTS}`;
 $('selectedModels').innerHTML=[...state.selected].map(id=>{const p=products[id],loading=!objects.has(id)&&!loadErrors.has(id);return `<div class="selected-model"><img src="${esc(p.image)}" alt="" width="37" height="48"><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)}</small><span>${[p.width*100,p.height*100,p.depth*100].map(fmt).join(' × ')} см</span>${loading?'<em>Загружаем 3D…</em>':''}${p.verified===false?'<small class=dimension-note>Размеры требуют сверки</small>':''}</div><button type="button" data-remove="${esc(id)}" aria-label="Убрать ${esc(p.name)} со сцены"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M1 1 11 11M11 1 1 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button></div>`}).join('')||'<p class="empty-selection">Выберите товары, чтобы поставить их на сцену.</p>';
}
function renderPicker(){
 const active=document.activeElement,focusProduct=active?.dataset?.product,focusCategory=active?.dataset?.category;
 $('productCategories').innerHTML=['Все','Аэрогрили','Кофеварки','Блендеры'].map(name=>`<button type="button" data-category="${name}" aria-pressed="${pickerCategory===name}">${name}</button>`).join('');
 const list=catalog.filter(p=>(pickerCategory==='Все'||p.category===pickerCategory)&&(!pickerSearch||`${p.name} ${p.sku} ${p.id} ${p.category}`.toLocaleLowerCase('ru').includes(pickerSearch)));
 $('pickerCount').textContent=`Выбрано ${state.selected.size} из ${MAX_PRODUCTS}`;
 $('productList').innerHTML=list.map(p=>{const available=!!products[p.id],on=state.selected.has(p.id);return `<label class="picker-product ${available?'':'unavailable'}"><input type="checkbox" data-product="${esc(p.id)}" ${on?'checked':''} ${available?'':'disabled'}><img src="${esc(p.image)}" alt="" width="42" height="52" loading="lazy" decoding="async"><span><strong>${esc(p.name)}</strong><small>${esc(p.sku)}${!available?' · 3D пока нет':''}${p.verified===false?' · размеры требуют сверки':''}</small><span>${[p.dimensions[1],p.dimensions[2],p.dimensions[0]].map(fmt).join(' × ')} см</span></span><i aria-hidden="true">${on?'✓':'+'}</i></label>`}).join('')||'<p class="picker-empty">По этому запросу ничего не найдено.</p>';
 updatePickerSelection();
 if($('productPicker').open){if(focusProduct)$('productList').querySelector(`[data-product="${CSS.escape(focusProduct)}"]`)?.focus({preventScroll:true});else if(focusCategory)$('productCategories').querySelector(`[data-category="${CSS.escape(focusCategory)}"]`)?.focus({preventScroll:true});}
}
function updatePickerSelection(){
 const full=state.selected.size>=MAX_PRODUCTS;$('pickerCount').textContent=`Выбрано ${state.selected.size} из ${MAX_PRODUCTS}`;
 $('productList').querySelectorAll('[data-product]').forEach(input=>{const id=input.dataset.product,on=state.selected.has(id);input.checked=on;input.disabled=!products[id]||(!on&&full);input.closest('.picker-product').querySelector('i').textContent=on?'✓':'+';});
 $('pickerStatus').textContent=full?'Выбраны три прибора. Снимите галочку, чтобы выбрать другой.':'Выберите до трёх приборов. Они появятся на сцене после нажатия «Готово».';
}
async function ensureProduct(id){
 if(objects.has(id))return;if(pendingLoads.has(id))return pendingLoads.get(id);
 const p=products[id],promise=(async()=>{try{const gltf=await loadGLB(p.path+'?v=20261101-28');if(disposed)return;normalizeProduct(gltf,id);try{await foodInteriors.attach(id,objects.get(id));}catch(error){console.warn('DEMIAND: interior unavailable',id,error);}if(disposed)return;makeContactShadow(id,p.width*1.3,p.assembledSize.z*1.2);loadErrors.delete(id);}catch(error){if(disposed)return;loadErrors.add(id);state.selected.delete(id);console.warn('DEMIAND: model unavailable',id,error);showSelectionNotice(`Не удалось загрузить ${p.name}. Попробуйте выбрать товар ещё раз.`);$('pickerStatus').textContent=`Не удалось загрузить ${p.name}. Попробуйте выбрать товар ещё раз.`;}finally{pendingLoads.delete(id);if(!disposed){syncScene();updatePickerSelection();}}})();pendingLoads.set(id,promise);return promise;
}
async function loadSelected(){await Promise.all([...state.selected].map(ensureProduct));}
async function toggleProduct(id,on){
 if(!products[id])return;
 if(on&&state.selected.size>=MAX_PRODUCTS&&!state.selected.has(id)){$('pickerStatus').textContent='На сцене могут стоять три прибора. Сначала уберите один из выбранных.';renderPicker();return;}
 selectionTouched=true;on?state.selected.add(id):state.selected.delete(id);const revision=++selectionRevision;
 showSelectionNotice('');renderSelected();updatePickerSelection();
 if($('productPicker').open)return;
 syncScene();
 if(on){await ensureProduct(id);if(disposed)return;syncScene();if(revision===selectionRevision&&state.selected.has(id))fitView(state.view);}
}
function bindProductPicker(){
 $('openProductPicker').addEventListener('click',()=>{pauseRendering();controls.enabled=false;pickerSelectionAtOpen=[...state.selected].join(',');renderPicker();$('productPicker').showModal();$('productSearch').focus();});
 const close=()=>{$('productPicker').close();$('openProductPicker').focus({preventScroll:true});};
 $('productPicker').addEventListener('close',async()=>{controls.enabled=true;syncScene();const changed=pickerSelectionAtOpen!==[...state.selected].join(','),revision=selectionRevision;await loadSelected();if(disposed)return;syncScene();if(changed&&revision===selectionRevision)fitView(state.view);requestRender();});
 $('closeProductPicker').addEventListener('click',close);$('doneProductPicker').addEventListener('click',close);
 $('productPicker').addEventListener('click',e=>{if(e.target===$('productPicker')){const r=$('productPicker').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 $('productSearch').addEventListener('input',e=>{pickerSearch=e.target.value.toLocaleLowerCase('ru').trim();renderPicker();});
 $('productCategories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){pickerCategory=b.dataset.category;renderPicker();}});
 $('productList').addEventListener('change',e=>{if(e.target.matches('[data-product]'))toggleProduct(e.target.dataset.product,e.target.checked);});
 $('selectedModels').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(b)toggleProduct(b.dataset.remove,false);});
 if(requested){const unavailable=requested.filter(id=>!products[id]).map(id=>catalog.find(p=>p.id===id)?.name).filter(Boolean);if(unavailable.length)showSelectionNotice(`Пока без 3D: ${unavailable.join(', ')}. Их можно сравнить в обычной матрице.`);if(requested.filter(id=>products[id]).length>MAX_PRODUCTS)showSelectionNotice('Показаны первые три выбранных прибора. Остальные можно выбрать здесь.');}
}
function updateMeasurementData(){
 const info={human:state.human/100,table:state.table/100,place:state.place,models:{}};
 for(const [id,o]of objects){const b=new THREE.Box3().setFromObject(o,true),s=b.getSize(new THREE.Vector3());o.userData.labelBounds=b;info.models[id]={visible:o.visible,width:s.x,height:s.y,assembledDepth:s.z,baseY:b.min.y,backZ:b.min.z,frontZ:b.max.z,rearEdgeGap:state.place==='table'?b.min.z+.4:null,housingDepth:products[id].depth,interiorFood:o.userData.interiorFood||null};}
 if(woman){const box=new THREE.Box3().setFromObject(woman,true);woman.userData.labelBounds=box;info.person={height:box.max.y-box.min.y,width:box.max.x-box.min.x,baseY:box.min.y,x:woman.position.x};}
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
function resize(){const w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);composer?.setSize(w,h);if(contactAO)contactAO.setSize(Math.round(w*Math.min(devicePixelRatio,1.5)*.7),Math.round(h*Math.min(devicePixelRatio,1.5)*.7));perspective.aspect=w/h;perspective.updateProjectionMatrix();if(camera===orthographic){const half=(orthographic.top-orthographic.bottom)/2;orthographic.left=-half*w/h;orthographic.right=half*w/h;orthographic.updateProjectionMatrix();}if(currentPreset!=='free')fitView(state.view);else syncPostCamera();requestRender();}
function placeLabel(id,object){
 const el=$(id),anchor=object?.visible?labelAnchor(object.userData.labelBounds,camera,wrap.clientWidth,wrap.clientHeight):null;
 el.style.opacity=anchor?'1':'0';
 if(anchor){el.style.left=`${anchor.x}px`;el.style.top=`${anchor.y}px`;}
}
function updateLabels(){
 if(!camera)return;
 placeLabel('personLabel',woman);
 for(const [id,p]of Object.entries(products))placeLabel(p.label,objects.get(id));
}

function animate(){frameId=0;if(disposed||document.hidden||$('productPicker').open)return;const moved=controls.update();kitchenDesign.updateCamera(camera,state.room==='kitchen');composer.render();updateLabels();if(params.has('diagnostics'))canvas.dataset.renderedFrames=String(++renderedFrames);if(moved)requestRender();}
function zoom(factor){if(camera.isOrthographicCamera){camera.zoom=Math.max(.45,Math.min(4,camera.zoom*factor));camera.updateProjectionMatrix();}else{const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(1/factor).clampLength(.7,11);camera.position.copy(controls.target).add(offset);}currentPreset='free';syncPostCamera();controls.update();updateViewButtons();}
function back(e){if(parent!==window){e?.preventDefault();parent.postMessage({type:'demiand-close-3d',human:state.human,table:state.table,place:state.place,models:selectionTouched?[...state.selected,...(requested||[]).filter(id=>!products[id])]:undefined},location.origin)}}
function bindUI(){
 $('backLink').addEventListener('click',back);window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('productPicker').open)back(e)});
 for(const [id,min,max,key]of [['height3d',145,205,'human'],['table3d',65,110,'table']]){
  $(id).addEventListener('input',()=>{const n=Number($(id).value);if(n>=min&&n<=max){state[key]=n;syncScene();}});
  $(id).addEventListener('change',()=>{state[key]=Math.round(clamp($(id).value,min,max,state[key]));syncScene();});
 }
 bindProductPicker();
 for(const [id,key,value]of [['onTable','place','table'],['onFloor','place','floor'],['kitchenBtn','room','kitchen'],['studioBtn','room','studio']])$(id).addEventListener('click',()=>{state[key]=value;syncScene();});
 for(const [id,view]of [['viewPerspective','perspective'],['viewFront','front'],['viewSide','side']])$(id).addEventListener('click',()=>fitView(view));
 $('fit3d').addEventListener('click',()=>fitView(state.view));$('zoomIn3d').addEventListener('click',()=>zoom(1.18));$('zoomOut3d').addEventListener('click',()=>zoom(1/1.18));
 $('personPosition3d').addEventListener('input',e=>{state.personX=Number(e.target.value)/100;woman?.position.set(state.personX,0,-.60);contactShadows.get('woman')?.position.set(state.personX,.0003,-.60+.065*state.human/164);updateMeasurementData();requestRender();});
 $('reset3d').addEventListener('click',()=>{Object.assign(state,defaults());selectionTouched=true;selectionRevision++;syncScene();renderPicker();loadSelected().then(()=>{syncScene();fitView('perspective')});});
 $('settingsToggle').addEventListener('click',()=>{const on=$('settingsToggle').getAttribute('aria-expanded')!=='true';$('settingsToggle').setAttribute('aria-expanded',String(on));$('settings').classList.toggle('open',on);});
 $('retry3d').addEventListener('click',()=>location.reload());
 if(matchMedia('(pointer:coarse)').matches)$('gestureHint').textContent='Одним пальцем — вращение · Двумя — приближение и перемещение';
}
function nonBreakingCopy(){const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(!/^(SCRIPT|STYLE)$/.test(node.parentElement?.tagName||''))node.nodeValue=node.nodeValue.replace(/(^|[\s(«])([ВвКкСсУуИиАа]|[Нн]е|[Пп]о|[Нн]а|[Ии]з|[Зз]а|[Дд]ля|[Оо]т|[Дд]о) +(?=[А-ЯЁа-яёA-Za-z0-9«])/gu,'$1$2\u00a0');}
async function start(){
 try{
  initRenderer();buildKitchen();makeContactShadow('woman',.42,.34);for(const [id,p]of Object.entries(products)){const label=document.createElement('div');label.id=p.label;label.className='label product-label';label.innerHTML=`<strong>${esc(p.name)}</strong><span>Высота ${fmt(p.height*100)} см</span>`;$('sceneLabels').append(label);}bindUI();syncScene();nonBreakingCopy();resize();
  $('loadingProgress').style.width='30%';
  await Promise.all([kitchenDesign.ready,loadSelected(),(async()=>{normalizeWoman(await loadGLB('assets/models/woman-original.glb?v=20261101-28'));})()]);
  $('loadingProgress').style.width='100%';
  syncScene();resize();fitView('perspective');sceneReady=true;animate();$('loading').classList.add('done');$('loading').setAttribute('aria-hidden','true');setTimeout(()=>$('loading').hidden=true,450);canvas.dataset.ready='true';
  new ResizeObserver(resize).observe(wrap);
 }catch(error){console.error('DEMIAND 3D:',error);fail('Не удалось загрузить сцену. Проверьте подключение и попробуйте ещё раз.');}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseRendering();else requestRender();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('pagehide',()=>{disposed=true;pauseRendering();controls?.dispose();kitchenDesign?.dispose();draco.dispose();composer?.dispose();contactAO?.dispose();lightBloom?.dispose();renderer?.dispose();environmentTexture?.dispose();productEnvironmentTexture?.dispose();});
start();
