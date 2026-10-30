(()=>{
'use strict';
const catalog=window.CATALOG;
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
const countLabel=n=>`${n} ${plural(n,'прибор','прибора','приборов')}`;
const defaultState=()=>({pose:'standing',place:'table',category:'Все',search:'',selected:new Set(['2100','3500','1200']),focus:'2100',human:170,table:76,zoom:1,personPosition:0,outlines:false,camera:'overview'});
const state=defaultState();
function closeFrame(){
 const humanCm=state.pose==='standing'?state.human:129*state.human/170;
 const tallest=Math.max(0,...activeModels().map(p=>p.dimensions[2]));
 return state.place==='table'?{top:Math.max(humanCm,state.table+tallest)+6,bottom:state.table-14}:{top:Math.max(90,tallest+12),bottom:-12};
}
const sceneBaseScale=()=>{if(state.camera!=='close')return 2.35;const frame=closeFrame();return Math.min(8,$('stageScroll').clientHeight/(frame.top-frame.bottom))};
const sceneScale=()=>sceneBaseScale()*state.zoom;
// Every page opening starts from the same example. There is no saved or shared selection.
function resetScene(){Object.assign(state,defaultState());$('search').value='';$('sidebar').classList.remove('open');$('pickerToggle').setAttribute('aria-expanded','false');renderAll();$('stageScroll').scrollLeft=0}
function toast(message){$('status').textContent=message;$('status').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('status').classList.remove('visible'),4200)}
const currentList=()=>catalog.filter(p=>(state.category==='Все'||p.category===state.category)&&(!state.search||`${p.name} ${p.id} ${p.sku} ${p.category}`.toLocaleLowerCase('ru').includes(state.search)));
const categories=['Все','Аэрогрили','Кофеварки','Блендеры'];
// A display-only SVG mask removes edge-connected white backdrop pixels.
// The source render, interior white details and appliance proportions stay intact.
const photoMasks=new Map();
async function scenePhotoMask(img){
 if(!photoMasks.has(img.src))photoMasks.set(img.src,(async()=>{
  try{
   await img.decode();
   const ratio=Math.min(1,400/Math.max(img.naturalWidth,img.naturalHeight));
   const w=Math.round(img.naturalWidth*ratio),h=Math.round(img.naturalHeight*ratio);
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);
   const pixels=ctx.getImageData(0,0,w,h).data,bg=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
   const seed=i=>{if(bg[i])return;const k=i*4;if(pixels[k+3]<10||(pixels[k]>230&&pixels[k+1]>230&&pixels[k+2]>230)){bg[i]=1;queue[tail++]=i}};
   for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x)}
   for(let y=1;y<h-1;y++){seed(y*w);seed(y*w+w-1)}
   while(head<tail){const i=queue[head++],x=i%w;if(x)seed(i-1);if(x<w-1)seed(i+1);if(i>=w)seed(i-w);if(i<w*(h-1))seed(i+w)}
   let path='';
   for(let y=0;y<h;y++){let x=0;while(x<w){while(x<w&&bg[y*w+x])x++;const start=x;while(x<w&&!bg[y*w+x])x++;if(x>start)path+=`M${start} ${y}h${x-start}v1H${start}z`}}
   return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path fill="white" d="${path}"/></svg>`)}")`;
  }catch{photoMasks.delete(img.src);return null}
 })());
 return photoMasks.get(img.src);
}
function applyScenePhotoMasks(){
 $('stage').querySelectorAll('.white-background img').forEach(async img=>{
  const mask=await scenePhotoMask(img);if(!mask||!img.isConnected)return;
  img.style.maskImage=mask;img.style.webkitMaskImage=mask;img.style.maskSize='100% 100%';img.style.webkitMaskSize='100% 100%';
  img.closest('.device').classList.add('mask-ready');
 });
}

function productPhoto(p,kind,sceneHeight){
 const className=kind==='scene'?'device-image':kind==='thumb'?'thumb':'detail-preview';
 const alt=kind==='thumb'?'':`${p.name}, ${p.view==='three-quarter'?'ракурс ¾':'анфас'}${p.color?', '+p.color:''}`;
 if(!p.crop)return `<img class="${className}" src="${p.image}" alt="${esc(alt)}"${kind==='thumb'?' loading="lazy"':''}>`;
 const c=p.crop;const h=kind==='scene'?sceneHeight:Math.min(kind==='thumb'?48:110,(kind==='thumb'?40:80)/p.aspect);const w=h*p.aspect;
 return `<span class="image-crop ${className} ${p.whiteBackground?'white-background':''}" style="width:${w}px;height:${h}px"><img src="${p.image}" alt="${esc(alt)}" style="width:${c.sourceWidth/c.width*100}%;height:${c.sourceHeight/c.height*100}%;left:${-c.x/c.width*100}%;top:${-c.y/c.height*100}%"${kind==='thumb'?' loading="lazy"':''}></span>`;
}

function renderTabs(){
 $('tabs').innerHTML=categories.map(c=>`<button type="button" data-category="${esc(c)}" class="${state.category===c?'active':''}" aria-pressed="${state.category===c}">${esc(c)}</button>`).join('');
 $('tabs').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{state.category=b.dataset.category;renderTabs();renderCatalog()}));
}
function renderCatalog(){
 const list=currentList();let previous='';
 $('resultsCount').textContent=`${list.length} ${plural(list.length,'модель','модели','моделей')}`;
 $('allBtn').disabled=!list.some(p=>p.dimensions&&!state.selected.has(p.id));
 $('clearBtn').disabled=!state.selected.size;
 $('catalog').innerHTML=list.map(p=>{
  const chosen=state.selected.has(p.id);const header=state.category==='Все'&&previous!==p.category?`<div class="catalog-group"><span>${esc(p.category)}</span><span>${catalog.filter(x=>x.category===p.category).length}</span></div>`:'';previous=p.category;
  return `${header}<button type="button" class="catalog-item ${chosen?'chosen':''}" data-id="${esc(p.id)}" aria-pressed="${chosen}" aria-label="${chosen?'Убрать':'Добавить'} ${esc(p.name)}, ${esc(p.sku)}${p.dimensions?'':', размеры пока не указаны'}"><span class="check" aria-hidden="true">${chosen?'✓':''}</span>${p.image?productPhoto(p,'thumb'):'<span class="no-thumb" aria-hidden="true">Нужен<br>анфас</span>'}<span><span class="item-name">${esc(p.name)}</span><span class="item-sku">${esc(p.sku)}</span>${p.dimensions?`<span class="item-size">Ш ${fmt(p.dimensions[1])} × В ${fmt(p.dimensions[2])} × Г ${fmt(p.dimensions[0])} см</span>`:'<span class="pending-label">Уточняем размеры</span>'}</span></button>`;
 }).join('')||'<div class="no-results">Ничего не нашлось.<br>Попробуйте название или артикул.<button type="button" id="resetSearch">Сбросить поиск</button></div>';
 $('resetSearch')?.addEventListener('click',()=>{state.search='';$('search').value='';renderCatalog();$('search').focus()});
 $('catalog').querySelectorAll('.catalog-item').forEach(b=>b.addEventListener('click',()=>{
  const p=catalog.find(p=>p.id===b.dataset.id);
  if(!p.dimensions){state.focus=p.id;renderDetail();toast('У этой модели пока нет подтверждённых размеров. Она не добавлена на сцену.');return}
  const added=!state.selected.has(p.id);
  if(added){state.selected.add(p.id);state.focus=p.id}else{state.selected.delete(p.id);if(state.focus===p.id)state.focus=[...state.selected].at(-1)||null}
  renderAll();
  if(added){requestAnimationFrame(()=>revealDevice(p.id));if(!p.image)toast('Показана габаритная рамка. Для этой модели ожидаем фото анфас.')}
 }));
}
function setMode(group,value){state[group]=value;renderModes();renderScene();renderDetail();}
function renderModes(){for(const [id,group,val] of [['standingBtn','pose','standing'],['sittingBtn','pose','sitting'],['tableBtn','place','table'],['floorBtn','place','floor']]){const on=state[group]===val;$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on))}$('humanHeight').value=state.human;$('tableHeight').value=state.table;$('tableHeight').disabled=state.place==='floor';$('tableHeight').closest('.table-control').style.opacity=state.place==='floor'?'.4':'1'}
function activeModels(){return catalog.filter(p=>state.selected.has(p.id)&&p.dimensions)}
function sceneLayout(scale){
 const humanCm=state.pose==='standing'?state.human:129*state.human/170;
 const humanHeight=humanCm*scale;
 // The person is independent of the table and shares the same floor baseline.
 const personWidth=humanHeight*(state.pose==='standing'?.27091:.38727);
 const compact=$('stageScroll').clientWidth<600;
 const humanStart=compact?55:75;
 const tableLeft=Math.max(compact?190:255,humanStart+personWidth+26);
 let x=tableLeft+22;const items=[];
 for(const p of activeModels()){
  const [depth,width,height]=p.dimensions;const w=width*scale,h=height*scale;
  const photoWidth=(p.aspect||width/height)*h;
  const slot=Math.max(145,Math.max(w,photoWidth)+65);
  items.push({p,x:x+slot/2-w/2,width:w,height:h,photoWidth,slot});x+=slot;
 }
 const viewportWidth=$('stageScroll').clientWidth;
 const extra=Math.max(0,viewportWidth-x-55);
 if(items.length&&extra){items.forEach((item,i)=>{item.x+=extra*(i+.5)/items.length});x+=extra}
 const width=Math.max(viewportWidth,x+55);
 const humanEnd=Math.max(humanStart,width-personWidth-30);
 const humanLeft=humanStart+(humanEnd-humanStart)*state.personPosition/100;
 return {items,tableLeft,width,humanHeight,personWidth,humanLeft,humanStart,humanEnd};
}
function renderScene(){
 $('stageScroll').classList.toggle('close-view',state.camera==='close');
 const scale=sceneScale();const floor=54;const stage=$('stage');const layout=sceneLayout(scale);
 const viewport=$('stageScroll');
 const oldHeight=stage.offsetHeight;const oldTop=viewport.scrollTop;
 const height=Math.max(viewport.clientHeight,state.human*scale+112);const base=floor+(state.place==='table'?state.table*scale:0);
 stage.classList.toggle('show-outlines',state.outlines);
 stage.style.height=`${height}px`;stage.style.width=`${layout.width}px`;stage.style.setProperty('--unit',scale);
 let html='<div class="floor"></div><div class="floor-label">УРОВЕНЬ ПОЛА</div><span class="ruler-unit">см</span>';
 html+=`<div class="ruler" style="height:${Math.ceil(state.human/25)*25*scale}px">`;
 for(let cm=0;cm<=state.human;cm+=25)html+=`<div class="ruler-mark" style="bottom:${cm*scale}px"><span>${cm}</span></div>`;
 html+='</div>';
 html+=`<div class="human-badge">Рост <strong>${fmt(state.human)} см</strong> · ${state.pose==='standing'?'стоит':'сидит'}</div><div class="human-zone" role="slider" tabindex="0" aria-label="Положение человека по горизонтали" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.personPosition)}" aria-valuetext="${Math.round(state.personPosition)} процентов ширины сцены" aria-orientation="horizontal" style="height:${layout.humanHeight}px;width:${layout.personWidth}px;left:${layout.humanLeft}px"><img src="assets/human-${state.pose==='standing'?'standing':'seated'}.webp" alt="Человек ${state.pose==='standing'?'стоит':'сидит'}, рост ${state.human} сантиметров" style="height:${layout.humanHeight}px"></div>`;
 if(state.place==='table')html+=`<div class="table-top" style="left:${layout.tableLeft}px;bottom:${base-10}px;width:${layout.width-layout.tableLeft-30}px"></div><div class="table-leg" style="left:${layout.tableLeft+16}px;height:${state.table*scale-10}px"></div><div class="table-leg" style="left:${layout.width-57}px;height:${state.table*scale-10}px"></div><span class="table-caption" style="left:${layout.tableLeft+15}px;bottom:${floor+18}px">Стол · ${fmt(state.table)} см</span>`;
 for(const item of layout.items){
  const p=item.p,d=p.dimensions;
  html+=`<button class="device ${state.focus===p.id?'active':''} ${p.whiteBackground?'original-render':''}" type="button" data-id="${esc(p.id)}" aria-pressed="${state.focus===p.id}" aria-controls="detailCard" aria-label="Показать размеры ${esc(p.name)}: ширина ${fmt(d[1])}, высота ${fmt(d[2])}, глубина ${fmt(d[0])} сантиметров${p.image?'':'. Пока без фото'}" style="left:${item.x}px;bottom:${base}px;width:${item.width}px;height:${item.height}px">${p.image?productPhoto(p,'scene',item.height):'<span class="dimension-box"><span>Ожидаем<br>фото анфас</span></span>'}<span class="body-outline" aria-hidden="true"><span>Ш ${fmt(d[1])} см</span></span><span class="height-tag" aria-hidden="true"><span>${fmt(d[2])} см</span></span><span class="device-label">${esc(p.name)}<small>${esc(p.sku)} · ширина ${fmt(d[1])} см</small></span></button>`;
 }
 if(!layout.items.length)html+=`<div class="empty-scene"><strong>Поставим технику рядом?</strong>Выберите модели в каталоге и сравните их с человеком.<br><button type="button" id="exampleBtn">Показать пример</button></div>`;
 stage.innerHTML=html;
 applyScenePhotoMasks();
 bindPersonMovement(layout);
 updatePersonControls();
 if(state.camera==='close'){
  const frame=closeFrame(),centerCm=(frame.top+frame.bottom)/2;
  viewport.scrollTop=Math.max(0,Math.min(height-viewport.clientHeight,height-floor-centerCm*scale-viewport.clientHeight/2));
 }else viewport.scrollTop=Math.max(0,oldTop+height-oldHeight);
 pinSceneLabels();
 stage.querySelectorAll('.device').forEach(b=>b.addEventListener('click',()=>{state.focus=b.dataset.id;stage.querySelectorAll('.device').forEach(d=>{const on=d.dataset.id===state.focus;d.classList.toggle('active',on);d.setAttribute('aria-pressed',String(on))});renderDetail();}));
 $('exampleBtn')?.addEventListener('click',resetScene);
 $('frontBadge').innerHTML=layout.items.some(item=>item.p.view==='three-quarter')?'<span aria-hidden="true">◉</span> Анфас и ¾':'<span aria-hidden="true">◉</span> Вид спереди';
 const n=layout.items.length;$('selectedCount').textContent=countLabel(n);$('mobileCount').textContent=countLabel(n);$('totalCount').textContent=catalog.length;
 $('zoomValue').textContent=`${Math.round(state.zoom*100)}%`;$('zoomOut').disabled=state.zoom<=.5;$('zoomIn').disabled=state.zoom>=1.5;$('zoomReset').disabled=state.zoom===1;
 updateSceneHint();
}
function updatePersonControls(){
 $('humanPosition').value=state.personPosition;
 $('personBesideBtn').setAttribute('aria-pressed',String(state.personPosition<.01));
 $('personBehindBtn').disabled=!activeModels().length;
 $('outlineBtn').setAttribute('aria-pressed',String(state.outlines));
 $('closeViewBtn').setAttribute('aria-pressed',String(state.camera==='close'));
 $('closeViewBtn').textContent=state.camera==='close'?'Общий вид':'Крупный план';
 $('scaleExplainer').textContent=state.camera==='close'?(state.place==='table'?'Крупный план: верхняя часть фигуры и приборы в одном масштабе.':'Крупный план: нижняя часть фигуры и приборы в одном масштабе.'):'Рост человека и высота приборов — в одном масштабе. Фигуру можно перетащить по горизонтали.';
}
function pinSceneLabels(){const top=$('stageScroll').scrollTop+14;$('stage').querySelectorAll('.human-badge,.ruler-unit').forEach(e=>e.style.top=`${top}px`)}
function movePerson(value,reveal=false){
 state.personPosition=Math.max(0,Math.min(100,value));
 const layout=sceneLayout(sceneScale()),person=$('stage').querySelector('.human-zone');
 if(!person)return;
 person.style.left=`${layout.humanLeft}px`;person.setAttribute('aria-valuenow',Math.round(state.personPosition));person.setAttribute('aria-valuetext',`${Math.round(state.personPosition)} процентов ширины сцены`);
 updatePersonControls();
 if(reveal){const viewport=$('stageScroll');const left=layout.humanLeft-35,right=layout.humanLeft+layout.personWidth+35;if(left<viewport.scrollLeft)viewport.scrollLeft=Math.max(0,left);else if(right>viewport.scrollLeft+viewport.clientWidth)viewport.scrollLeft=right-viewport.clientWidth}
}
function bindPersonMovement(layout){
 const person=$('stage').querySelector('.human-zone');let drag=null;
 person.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,startX:e.clientX,left:parseFloat(person.style.left),moved:false};person.setPointerCapture(e.pointerId);person.classList.add('dragging')});
 person.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const delta=e.clientX-drag.startX;if(Math.abs(delta)>3)drag.moved=true;if(!drag.moved)return;const span=layout.humanEnd-layout.humanStart;movePerson(span?(drag.left+delta-layout.humanStart)/span*100:0)});
 const finish=()=>{drag=null;person.classList.remove('dragging')};person.addEventListener('pointerup',finish);person.addEventListener('pointercancel',finish);person.addEventListener('lostpointercapture',finish);
 person.addEventListener('keydown',e=>{const keys={ArrowLeft:-2,ArrowRight:2};if(e.key in keys){e.preventDefault();movePerson(state.personPosition+keys[e.key]*(e.shiftKey?5:1),true)}else if(e.key==='Home'||e.key==='End'){e.preventDefault();movePerson(e.key==='Home'?0:100,true)}});
}
function updateSceneHint(){const el=$('stageScroll');el.closest('.stage-shell').classList.toggle('overflowing',el.scrollWidth>el.clientWidth+4);$('sceneHint').textContent=el.scrollWidth>el.clientWidth+4?'Листайте сцену вправо ↔ · Нажмите на прибор, чтобы увидеть размеры.':'Нажмите на прибор — его размеры появятся ниже.'}
function revealDevice(id){const el=[...$('stage').querySelectorAll('.device')].find(x=>x.dataset.id===id);if(!el)return;const parent=$('stageScroll'),left=parseFloat(el.style.left)-45,right=left+el.offsetWidth+140;if(right>parent.scrollLeft+parent.clientWidth)parent.scrollLeft=right-parent.clientWidth;if(left<parent.scrollLeft)parent.scrollLeft=Math.max(0,left)}
function renderDetail(){
 const p=catalog.find(p=>p.id===state.focus);
 if(!p){$('detailBody').innerHTML='<div class="detail-empty"><h2 id="detailTitle">Размеры выбранного прибора</h2><p>Добавьте модель из каталога или нажмите на прибор на сцене.</p></div>';return}
 const d=p.dimensions;const notes=[];
 if(!p.image)notes.push('Фото анфас ещё не добавлено. На сцене показана только габаритная рамка.');
 if(p.view==='three-quarter')notes.push('Рендер в ракурсе ¾. Видимая ширина на изображении может отличаться от ширины корпуса.');
 if(!d)notes.push('Габариты пока не указаны. Модель появится на сцене после уточнения размеров.');
 if(p.review)notes.push('В карточке сайта и исходной матрице есть расхождение. Использованы значения сайта; требуется контрольный замер.');
 $('detailBody').innerHTML=`<div class="detail-content">${p.image?productPhoto(p,'detail'):'<div class="detail-preview-empty">Ожидаем<br>анфас</div>'}<div class="detail-info"><div class="section-kicker">03 / РАЗМЕРЫ ПРИБОРА</div><div class="detail-title-row"><h2 id="detailTitle">${esc(p.name)}</h2><span class="category-pill">${esc(p.category)}</span></div><p class="detail-sku">${esc(p.sku)}${p.color?' · '+esc(p.color):''}</p></div>${d?`<div class="stats">${[['Ширина',d[1]],['Высота',d[2]],['Глубина',d[0]]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${fmt(value)} <small>см</small></strong></div>`).join('')}</div>`:''}</div>${notes.length?`<div class="detail-notes">${notes.map(n=>`<p>${n}</p>`).join('')}</div>`:''}<div class="detail-bottom"><p>${d?'Габариты корпуса · без упаковки':'Модель ожидает уточнения размеров'}</p>${state.selected.has(p.id)?'<button type="button" id="removeDevice">Убрать со сцены ×</button>':''}</div>`;
 $('removeDevice')?.addEventListener('click',()=>{state.selected.delete(p.id);state.focus=[...state.selected].at(-1)||null;renderAll();});
}
function renderAll(){renderModes();renderTabs();renderCatalog();renderScene();renderDetail()}
for(const [id,group,val]of [['standingBtn','pose','standing'],['sittingBtn','pose','sitting'],['tableBtn','place','table'],['floorBtn','place','floor']])$(id).addEventListener('click',()=>setMode(group,val));
for(const [id,key,min,max]of [['humanHeight','human',145,205],['tableHeight','table',65,110]]){
 $(id).addEventListener('input',()=>{const value=Number($(id).value);if(Number.isFinite(value)&&value>=min&&value<=max){state[key]=value;renderScene();}});
 $(id).addEventListener('change',()=>{state[key]=Math.round(Math.max(min,Math.min(max,Number($(id).value)||state[key])));renderModes();renderScene();renderDetail();});
}
$('resetSceneBtn').addEventListener('click',resetScene);
$('humanPosition').addEventListener('input',e=>movePerson(Number(e.target.value),true));
$('personBesideBtn').addEventListener('click',()=>movePerson(0,true));
function placePersonAtFocus(){const layout=sceneLayout(sceneScale()),item=layout.items.find(x=>x.p.id===state.focus)||layout.items[0];if(!item)return;const target=item.x+item.width/2-layout.personWidth/2,span=layout.humanEnd-layout.humanStart;movePerson(span?(target-layout.humanStart)/span*100:0,true)}
$('personBehindBtn').addEventListener('click',placePersonAtFocus);
$('outlineBtn').addEventListener('click',()=>{state.outlines=!state.outlines;$('stage').classList.toggle('show-outlines',state.outlines);updatePersonControls()});
$('closeViewBtn').addEventListener('click',()=>{state.camera=state.camera==='close'?'overview':'close';renderScene();if(state.camera==='close')placePersonAtFocus()});
$('stageScroll').addEventListener('scroll',pinSceneLabels,{passive:true});
$('search').addEventListener('input',e=>{state.search=e.target.value.toLocaleLowerCase('ru').trim();renderCatalog()});
$('clearBtn').addEventListener('click',()=>{state.selected.clear();state.focus=null;renderAll();$('stageScroll').scrollLeft=0});
$('allBtn').addEventListener('click',()=>{currentList().forEach(p=>{if(p.dimensions)state.selected.add(p.id)});if(!state.focus)state.focus=[...state.selected][0];renderAll();toast('Модели добавлены. Прокрутите сцену вправо или нажмите «Вписать».')});
$('pickerToggle').addEventListener('click',()=>{const on=$('pickerToggle').getAttribute('aria-expanded')!=='true';$('pickerToggle').setAttribute('aria-expanded',String(on));$('sidebar').classList.toggle('open',on)});
function zoomBy(delta){state.zoom=Math.max(.5,Math.min(1.5,Math.round((state.zoom+delta)*100)/100));renderScene();}
$('zoomOut').addEventListener('click',()=>zoomBy(-.1));$('zoomIn').addEventListener('click',()=>zoomBy(.1));
$('zoomReset').addEventListener('click',()=>{state.zoom=1;renderScene();});
$('fitBtn').addEventListener('click',()=>{state.camera='overview';const available=$('stageScroll').clientWidth;let zoom=1.5;while(zoom>.5&&sceneLayout(sceneBaseScale()*zoom).width>available+1)zoom-=.025;state.zoom=Math.max(.5,Math.round(zoom*100)/100);renderScene();$('stageScroll').scrollLeft=0;if($('stageScroll').scrollWidth>available+4)toast('Установлен минимальный масштаб. Для всех моделей используйте прокрутку.')});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderScene,50)});
if(window.ResizeObserver){let lastWidth=0;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)>1){lastWidth=width;renderScene()}}).observe($('stageScroll'))}
// Small pure helpers are exposed for catalog validation and language checks.
window.ScaleMath={plural,countLabel,sceneLayout};
window.addEventListener('pageshow',event=>{if(event.persisted)resetScene()});
renderAll();
})();
