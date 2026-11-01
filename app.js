(()=>{
'use strict';
const catalog=window.CATALOG;
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
const countLabel=n=>`${n} ${plural(n,'прибор','прибора','приборов')}`;
const defaultState=()=>({pose:'standing',place:'table',category:'Все',search:'',selected:new Set(['2100','3500','1200']),focus:'2100',human:170,table:76,zoom:1,personPosition:0,camera:'overview'});
const state=defaultState();
function cameraFrame(){
 const humanCm=state.pose==='standing'?state.human:129*state.human/170;
 const tallest=Math.max(0,...activeModels().map(p=>p.dimensions[2]));
 if(state.camera==='overview')return {top:Math.max(humanCm,(state.place==='table'?state.table:0)+tallest)+8,bottom:-23};
 if(state.place==='table'){const top=Math.max(humanCm,state.table+tallest)+7;return {top,bottom:Math.min(state.table-16,top-106*state.human/170)}}
 return {top:Math.max(90*state.human/170,tallest+15),bottom:-20};
}
const sceneBaseScale=()=>{const f=cameraFrame();return ($('stageScroll').clientHeight-28)/(f.top-f.bottom)};
const sceneScale=()=>sceneBaseScale()*state.zoom;
// Every page opening starts from the same example. There is no saved or shared selection.
function resetScene(){clearTimeout(toast.timer);$('status').classList.remove('visible');$('status').textContent='';Object.assign(state,defaultState());$('search').value='';$('sidebar').classList.remove('open');$('pickerToggle').setAttribute('aria-expanded','false');renderAll();$('stageScroll').scrollLeft=0}
function toast(message){$('status').textContent=message;$('status').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('status').classList.remove('visible'),4200)}
const currentList=()=>catalog.filter(p=>(state.category==='Все'||p.category===state.category)&&(!state.search||`${p.name} ${p.id} ${p.sku} ${p.category}`.toLocaleLowerCase('ru').includes(state.search)));
const categories=['Все','Аэрогрили','Кофеварки','Блендеры'];
function keepWordsTogether(root=document.body){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode()))if(!/^(SCRIPT|STYLE)$/.test(node.parentElement?.tagName||''))node.nodeValue=node.nodeValue.replace(/(^|[\s(«])((?:[Вв]о?|[Кк]о?|[Сс]о?|[Уу]|[Оо]б?|[Ии]|[Аа]|[Нн]о|[Нн]е|[Нн]и|[Оо]т|[Дд]о|[Пп]о|[Нн]а|[Ии]з|[Зз]а|[Дд]ля|[Бб]ез|[Пп]од|[Нн]ад|[Пп]ри|[Ии]ли)) +(?=[А-ЯЁа-яёA-Za-z0-9«])/gu,'$1$2\u00a0');
}

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
  return `${header}<button type="button" class="catalog-item ${chosen?'chosen':''}" data-id="${esc(p.id)}" aria-pressed="${chosen}" aria-label="${chosen?'Убрать':'Добавить'} ${esc(p.name)}, ${esc(p.sku)}${p.dimensions?'':', размеры пока не указаны'}"><span class="check" aria-hidden="true">${chosen?'✓':''}</span>${p.image?productPhoto(p,'thumb'):'<span class="no-thumb" aria-hidden="true">Нужен<br>анфас</span>'}<span><span class="item-name">${esc(p.name)}</span><span class="item-sku">${esc(p.sku)}</span>${p.dimensions?`<span class="item-size">Ш&nbsp;${fmt(p.dimensions[1])} × В&nbsp;${fmt(p.dimensions[2])} × Г&nbsp;${fmt(p.dimensions[0])}&nbsp;см</span>`:'<span class="pending-label">Уточняем размеры</span>'}</span></button>`;
 }).join('')||'<div class="no-results">Ничего не нашлось.<br>Попробуйте название или артикул.<button type="button" id="resetSearch">Сбросить поиск</button></div>';
 $('resetSearch')?.addEventListener('click',()=>{state.search='';$('search').value='';renderCatalog();$('search').focus()});
 keepWordsTogether($('catalog'));
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
 const humanHeight=humanCm*scale,personWidth=humanHeight*(state.pose==='standing'?.27091:.38727);
 const viewportWidth=$('stageScroll').clientWidth;
 const compact=viewportWidth<600;
 let humanStart=compact?55:65,tableLeft=humanStart+personWidth+(compact?-10:26),x=tableLeft+(compact?6:22);const items=[];
 for(const p of activeModels()){
  const [,width,height]=p.dimensions,w=width*scale,h=height*scale,photoWidth=(p.aspect||width/height)*h;
  const slot=Math.max(compact?118:130,Math.max(w,photoWidth)+(compact?40:68));
  items.push({p,x:x+slot/2-w/2,width:w,height:h,photoWidth,slot});x+=slot;
 }
 const contentWidth=items.length?x+40:tableLeft+220;
 const offset=Math.max(0,(viewportWidth-contentWidth)/2);
 humanStart+=offset;tableLeft+=offset;items.forEach(item=>item.x+=offset);
 const width=Math.max(viewportWidth,contentWidth),humanEnd=Math.max(humanStart,width-personWidth-42);
 const humanLeft=humanStart+(humanEnd-humanStart)*state.personPosition/100;
 return {items,tableLeft,width,humanHeight,personWidth,humanLeft,humanStart,humanEnd};
}
function renderScene(){
 const viewport=$('stageScroll'),height=viewport.clientHeight,stage=$('stage');
 const scale=sceneScale(),frame=cameraFrame(),center=(frame.top+frame.bottom)/2;
 // Project physical centimetres into a fixed-height camera. No vertical scene scrolling.
 const floor=height/2-center*scale,base=floor+(state.place==='table'?state.table*scale:0);
 const layout=sceneLayout(scale);
 stage.style.height=`${height}px`;stage.style.width=`${layout.width}px`;stage.style.setProperty('--unit',scale);stage.style.setProperty('--floor',`${floor}px`);
 let html='<div class="floor"></div><div class="floor-label">УРОВЕНЬ ПОЛА</div><span class="ruler-unit">см</span>';
 html+=`<div class="ruler" style="height:${Math.ceil(state.human/25)*25*scale}px">`;
 for(let cm=0;cm<=state.human;cm+=25)html+=`<div class="ruler-mark" style="bottom:${cm*scale}px"><span>${cm}</span></div>`;
 html+='</div>';
 html+=`<div class="human-badge">Рост <strong>${fmt(state.human)} см</strong> · ${state.pose==='standing'?'стоит':'сидит'}</div><div class="human-zone" role="slider" tabindex="0" aria-label="Положение человека по горизонтали" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(state.personPosition)}" aria-valuetext="${Math.round(state.personPosition)} процентов ширины сцены" aria-orientation="horizontal" style="height:${layout.humanHeight}px;width:${layout.personWidth}px;left:${layout.humanLeft}px;bottom:${floor}px"><img src="assets/human-${state.pose==='standing'?'standing':'seated'}.webp" alt="Человек ${state.pose==='standing'?'стоит':'сидит'}, рост ${state.human} сантиметров" style="height:${layout.humanHeight}px"></div>`;
 if(state.place==='table')html+=`<div class="table-top" style="left:${layout.tableLeft}px;bottom:${base-10}px;width:${layout.width-layout.tableLeft-30}px"></div><div class="table-leg" style="left:${layout.tableLeft+16}px;height:${state.table*scale-10}px"></div><div class="table-leg" style="left:${layout.width-57}px;height:${state.table*scale-10}px"></div><span class="table-caption" style="left:${layout.tableLeft+15}px;bottom:${floor+18}px">Стол · ${fmt(state.table)} см</span>`;
 for(const item of layout.items){
  const p=item.p,d=p.dimensions;
  html+=`<button class="device ${state.focus===p.id?'active':''} ${p.whiteBackground?'original-render':''}" type="button" data-id="${esc(p.id)}" aria-pressed="${state.focus===p.id}" aria-controls="detailCard" aria-label="Показать размеры ${esc(p.name)}: ширина ${fmt(d[1])}, высота ${fmt(d[2])}, глубина ${fmt(d[0])} сантиметров${p.image?'':'. Пока без фото'}" style="left:${item.x}px;bottom:${base}px;width:${item.width}px;height:${item.height}px">${p.image?productPhoto(p,'scene',item.height):'<span class="dimension-box"><span>Ожидаем<br>фото анфас</span></span>'}<span class="height-tag" aria-hidden="true"><span>${fmt(d[2])} см</span></span><span class="device-label">${esc(p.name)}<small>${esc(p.sku)}</small></span></button>`;
 }
 $('emptyScene').hidden=layout.items.length>0;
 stage.innerHTML=html;
 applyScenePhotoMasks();
 bindPersonMovement(layout);
 updatePersonControls();
 viewport.scrollTop=0;
 stage.querySelectorAll('.device').forEach(b=>b.addEventListener('click',()=>{state.focus=b.dataset.id;stage.querySelectorAll('.device').forEach(d=>{const on=d.dataset.id===state.focus;d.classList.toggle('active',on);d.setAttribute('aria-pressed',String(on))});renderDetail();}));
 $('exampleBtn').onclick=resetScene;
 $('frontBadge').innerHTML=layout.items.some(item=>item.p.view==='three-quarter')?'<span aria-hidden="true">◉</span> Анфас и ¾':'<span aria-hidden="true">◉</span> Вид спереди';
 const n=layout.items.length;$('selectedCount').textContent=countLabel(n);$('mobileCount').textContent=countLabel(n);
 $('zoomValue').textContent=`${Math.round(state.zoom*100)}%`;$('zoomOut').disabled=state.zoom<=.5;$('zoomIn').disabled=state.zoom>=1.5;
 updateSceneHint();keepWordsTogether(stage);
}
function updatePersonControls(){
 $('humanPosition').value=state.personPosition;
 for(const [id,camera]of [['overviewBtn','overview'],['closeViewBtn','close']]){const on=state.camera===camera;$(id).setAttribute('aria-pressed',String(on));$(id).classList.toggle('active',on)}
 $('scaleExplainer').textContent=state.camera==='close'?(state.place==='table'?'Крупный план · человек и\u00a0приборы в\u00a0одном масштабе.':'Крупный план · приборы и\u00a0нижняя часть человека в\u00a0одном масштабе.'):'Человек и\u00a0приборы показаны в\u00a0одном масштабе.';
}
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
function updateSceneHint(){
 const el=$('stageScroll'),overflow=el.scrollWidth>el.clientWidth+4;
 $('scenePan').hidden=!overflow;
 $('panLeft').disabled=el.scrollLeft<2;$('panRight').disabled=el.scrollLeft+el.clientWidth>=el.scrollWidth-2;
 $('sceneHint').textContent=overflow?'Сцену можно листать по\u00a0горизонтали. Нажмите на\u00a0прибор для\u00a0просмотра размеров.':'Нажмите на\u00a0прибор, чтобы увидеть его размеры.';
}
function frameSelection(){
 const viewport=$('stageScroll'),l=sceneLayout(sceneScale()),item=l.items.find(x=>x.p.id===state.focus)||l.items[0];if(!item){viewport.scrollLeft=0;return}
 const compact=viewport.clientWidth<600;
 const left=Math.min(l.humanLeft,item.x)-(compact?12:35),right=Math.max(l.humanLeft+l.personWidth,item.x+item.width)+(compact?24:65);
 viewport.scrollLeft=right-left<=viewport.clientWidth?(left+right-viewport.clientWidth)/2:item.x+item.width/2-viewport.clientWidth/2;
 updateSceneHint();
}
function revealDevice(id){const el=[...$('stage').querySelectorAll('.device')].find(x=>x.dataset.id===id);if(!el)return;const parent=$('stageScroll'),left=parseFloat(el.style.left)-45,right=left+el.offsetWidth+140;if(right>parent.scrollLeft+parent.clientWidth)parent.scrollLeft=right-parent.clientWidth;if(left<parent.scrollLeft)parent.scrollLeft=Math.max(0,left)}
function renderDetail(){
 const p=catalog.find(p=>p.id===state.focus);
 if(!p){$('detailBody').innerHTML='<div class="detail-empty"><h2 id="detailTitle">Размеры выбранного прибора</h2><p>Добавьте модель из каталога или нажмите на прибор на сцене.</p></div>';return}
 const d=p.dimensions;const notes=[];
 if(!p.image)notes.push('Фото анфас ещё не добавлено. На сцене показана только габаритная рамка.');
 if(p.view==='three-quarter')notes.push('Рендер в ракурсе ¾. Видимая ширина на изображении может отличаться от ширины корпуса.');
 if(!d)notes.push('Габариты пока не указаны. Модель появится на сцене после уточнения размеров.');
 if(p.verified===false)notes.push('Размеры сохранены из исходных материалов. Перед точным размещением прибора нужен контрольный замер.');
 if(p.review)notes.push('В карточке сайта и исходной матрице есть расхождение. Использованы значения сайта; требуется контрольный замер.');
 $('detailBody').innerHTML=`<div class="detail-content">${p.image?productPhoto(p,'detail'):'<div class="detail-preview-empty">Ожидаем<br>анфас</div>'}<div class="detail-info"><div class="section-kicker">03 / РАЗМЕРЫ ПРИБОРА</div><div class="detail-title-row"><h2 id="detailTitle">${esc(p.name)}</h2><span class="category-pill">${esc(p.category)}</span></div><p class="detail-sku">${esc(p.sku)}${p.color?' · '+esc(p.color):''}</p></div>${d?`<div class="stats">${[['Ширина',d[1]],['Высота',d[2]],['Глубина',d[0]]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${fmt(value)} <small>см</small></strong></div>`).join('')}</div>`:''}</div>${notes.length?`<div class="detail-notes">${notes.map(n=>`<p>${n}</p>`).join('')}</div>`:''}<div class="detail-bottom"><p>${d?'Габариты корпуса · без упаковки':'Модель ожидает уточнения размеров'}</p>${state.selected.has(p.id)?'<button type="button" id="removeDevice">Убрать со сцены ×</button>':''}</div>`;
 keepWordsTogether($('detailBody'));
 $('removeDevice')?.addEventListener('click',()=>{state.selected.delete(p.id);state.focus=[...state.selected].at(-1)||null;renderAll();});
}
function renderAll(){renderModes();renderTabs();renderCatalog();renderScene();renderDetail()}
for(const [id,group,val]of [['standingBtn','pose','standing'],['sittingBtn','pose','sitting'],['tableBtn','place','table'],['floorBtn','place','floor']])$(id).addEventListener('click',()=>setMode(group,val));
for(const [id,key,min,max]of [['humanHeight','human',145,205],['tableHeight','table',65,110]]){
 $(id).addEventListener('input',()=>{const value=Number($(id).value);if(Number.isFinite(value)&&value>=min&&value<=max){state[key]=value;renderScene();}});
 $(id).addEventListener('change',()=>{state[key]=Math.round(Math.max(min,Math.min(max,Number($(id).value)||state[key])));renderModes();renderScene();renderDetail();});
}
$('resetSceneBtn').addEventListener('click',resetScene);
$('open3dBtn').addEventListener('click',()=>{
 const query=new URLSearchParams({rev:'20261101-32',human:String(state.human),table:String(state.table),place:state.place,models:[...state.selected].join(',')});
 if(location.protocol==='file:'){window.open('https://julia0613.github.io/matrix/3d.html?'+query,'_blank','noopener');return}
 $('threeFrame').src='3d.html?'+query;$('threeDialog').showModal();document.body.classList.add('three-open');
});
function close3d(){if($('threeDialog').open)$('threeDialog').close();document.body.classList.remove('three-open');$('threeFrame').removeAttribute('src');$('open3dBtn').focus({preventScroll:true});}
$('threeDialog').addEventListener('cancel',e=>{e.preventDefault();close3d()});
window.addEventListener('message',e=>{
 if(e.source!==$('threeFrame').contentWindow||e.origin!==location.origin||e.data?.type!=='demiand-close-3d')return;
 if(Number.isFinite(e.data.human))state.human=Math.max(145,Math.min(205,e.data.human));
 if(Number.isFinite(e.data.table))state.table=Math.max(65,Math.min(110,e.data.table));
 if(['table','floor'].includes(e.data.place))state.place=e.data.place;
 if(Array.isArray(e.data.models)){state.selected=new Set(e.data.models.filter(id=>catalog.some(p=>p.id===id)));state.focus=[...state.selected][0]||null;}
 close3d();renderAll();
});
$('humanPosition').addEventListener('input',e=>movePerson(Number(e.target.value),true));
for(const [id,camera]of [['overviewBtn','overview'],['closeViewBtn','close']])$(id).addEventListener('click',()=>{state.camera=camera;state.zoom=1;renderScene();frameSelection()});
$('stageScroll').addEventListener('scroll',updateSceneHint,{passive:true});
for(const [id,direction]of [['panLeft',-1],['panRight',1]])$(id).addEventListener('click',()=>$('stageScroll').scrollBy({left:direction*$('stageScroll').clientWidth*.7,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
$('search').addEventListener('input',e=>{state.search=e.target.value.toLocaleLowerCase('ru').trim();renderCatalog()});
$('clearBtn').addEventListener('click',()=>{state.selected.clear();state.focus=null;renderAll();$('stageScroll').scrollLeft=0});
$('allBtn').addEventListener('click',()=>{currentList().forEach(p=>{if(p.dimensions)state.selected.add(p.id)});if(!state.focus)state.focus=[...state.selected][0];renderAll();toast('Модели добавлены. Прокрутите сцену вправо или нажмите «Вписать».')});
$('pickerToggle').addEventListener('click',()=>{const on=$('pickerToggle').getAttribute('aria-expanded')!=='true';$('pickerToggle').setAttribute('aria-expanded',String(on));$('sidebar').classList.toggle('open',on)});
function zoomBy(delta){state.zoom=Math.max(.5,Math.min(1.5,Math.round((state.zoom+delta)*100)/100));renderScene();frameSelection();}
$('zoomOut').addEventListener('click',()=>zoomBy(-.1));$('zoomIn').addEventListener('click',()=>zoomBy(.1));
$('zoomReset').addEventListener('click',()=>{state.zoom=1;renderScene();frameSelection();});
$('fitBtn').addEventListener('click',()=>{state.camera='overview';const available=$('stageScroll').clientWidth;let zoom=1;while(zoom>.5&&sceneLayout(sceneBaseScale()*zoom).width>available+1)zoom-=.025;state.zoom=Math.max(.5,Math.round(zoom*100)/100);renderScene();$('stageScroll').scrollLeft=0;if($('stageScroll').scrollWidth>available+4)toast('Установлен минимальный масштаб. Для всех моделей используйте прокрутку.')});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderScene,50)});
if(window.ResizeObserver){let lastWidth=0,lastHeight=0;new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;if(Math.abs(width-lastWidth)>1||Math.abs(height-lastHeight)>1){lastWidth=width;lastHeight=height;renderScene()}}).observe($('stageScroll'))}
// Small pure helpers are exposed for catalog validation and language checks.
window.ScaleMath={plural,countLabel,sceneLayout};
window.addEventListener('pageshow',event=>{if(event.persisted)resetScene()});
renderAll();keepWordsTogether();
})();
