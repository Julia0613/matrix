(()=>{
'use strict';
const catalog=window.CATALOG;
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
const countLabel=n=>`${n} ${plural(n,'прибор','прибора','приборов')}`;
const state={pose:'standing',place:'table',category:'Все',search:'',selected:new Set(['2100','3500','1200']),focus:'2100',human:170,table:76,zoom:1};
try{
 const saved=JSON.parse(localStorage.getItem('demiand-scale-v2')||'null');
 if(saved){
  state.selected=new Set((Array.isArray(saved.selected)?saved.selected:[]).filter(id=>catalog.some(p=>p.id===id&&p.dimensions)));
  state.focus=catalog.some(p=>p.id===saved.focus)?saved.focus:[...state.selected][0]||null;
  if(['standing','sitting'].includes(saved.pose))state.pose=saved.pose;
  if(['table','floor'].includes(saved.place))state.place=saved.place;
  if(Number.isFinite(saved.human))state.human=Math.max(145,Math.min(205,saved.human));
  if(Number.isFinite(saved.table))state.table=Math.max(65,Math.min(95,saved.table));
  if(Number.isFinite(saved.zoom))state.zoom=Math.max(.5,Math.min(1.5,saved.zoom));
 }
}catch{}
function persist(){try{localStorage.setItem('demiand-scale-v2',JSON.stringify({...state,selected:[...state.selected],category:'Все',search:''}))}catch{}}
function toast(message){$('status').textContent=message;$('status').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('status').classList.remove('visible'),4200)}
const currentList=()=>catalog.filter(p=>(state.category==='Все'||p.category===state.category)&&(!state.search||`${p.name} ${p.id} ${p.sku} ${p.category}`.toLocaleLowerCase('ru').includes(state.search)));
const categories=['Все','Аэрогрили','Кофеварки','Блендеры'];

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
  if(!p.dimensions){state.focus=p.id;renderDetail();persist();toast('У этой модели пока нет подтверждённых размеров. Она не добавлена на сцену.');return}
  const added=!state.selected.has(p.id);
  if(added){state.selected.add(p.id);state.focus=p.id}else{state.selected.delete(p.id);if(state.focus===p.id)state.focus=[...state.selected].at(-1)||null}
  renderAll();persist();
  if(added){requestAnimationFrame(()=>revealDevice(p.id));if(!p.image)toast('Показана габаритная рамка. Для этой модели ожидаем фото анфас.')}
 }));
}
function setMode(group,value){state[group]=value;renderModes();renderScene();renderDetail();persist()}
function renderModes(){for(const [id,group,val] of [['standingBtn','pose','standing'],['sittingBtn','pose','sitting'],['tableBtn','place','table'],['floorBtn','place','floor']]){const on=state[group]===val;$(id).classList.toggle('active',on);$(id).setAttribute('aria-pressed',String(on))}$('humanHeight').value=state.human;$('tableHeight').value=state.table;$('tableHeight').disabled=state.place==='floor';$('tableHeight').closest('.table-control').style.opacity=state.place==='floor'?'.4':'1'}
function activeModels(){return catalog.filter(p=>state.selected.has(p.id)&&p.dimensions)}
function sceneLayout(scale){
 const humanCm=state.pose==='standing'?state.human:129*state.human/170;
 const humanHeight=humanCm*scale;
 // The person is independent of the table and shares the same floor baseline.
 const personWidth=humanHeight*(state.pose==='standing'?.27091:.38727);
 const compact=$('stageScroll').clientWidth<600;
 const humanLeft=compact?55:75;
 const tableLeft=Math.max(compact?190:255,humanLeft+personWidth+26);
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
 return {items,tableLeft,width:Math.max(viewportWidth,x+55),humanHeight,personWidth,humanLeft};
}
function renderScene(){
 const scale=2.35*state.zoom;const floor=54;const stage=$('stage');const layout=sceneLayout(scale);
 const viewport=$('stageScroll');
 const oldHeight=stage.offsetHeight;const oldTop=viewport.scrollTop;
 const height=Math.max(viewport.clientHeight,state.human*scale+112);const base=floor+(state.place==='table'?state.table*scale:0);
 stage.style.height=`${height}px`;stage.style.width=`${layout.width}px`;stage.style.setProperty('--unit',scale);
 let html='<div class="floor"></div><div class="floor-label">УРОВЕНЬ ПОЛА</div><span class="ruler-unit">см</span>';
 html+=`<div class="ruler" style="height:${Math.ceil(state.human/25)*25*scale}px">`;
 for(let cm=0;cm<=state.human;cm+=25)html+=`<div class="ruler-mark" style="bottom:${cm*scale}px"><span>${cm}</span></div>`;
 html+='</div>';
 html+=`<div class="human-badge">Рост <strong>${fmt(state.human)} см</strong> · ${state.pose==='standing'?'стоит':'сидит'}</div><div class="human-zone" style="height:${layout.humanHeight}px;left:${layout.humanLeft}px"><img src="assets/human-${state.pose==='standing'?'standing':'seated'}.webp" alt="Человек ${state.pose==='standing'?'стоит':'сидит'}, рост ${state.human} сантиметров" style="height:${layout.humanHeight}px"></div>`;
 if(state.place==='table')html+=`<div class="table-top" style="left:${layout.tableLeft}px;bottom:${base-10}px;width:${layout.width-layout.tableLeft-30}px"></div><div class="table-leg" style="left:${layout.tableLeft+16}px;height:${state.table*scale-10}px"></div><div class="table-leg" style="left:${layout.width-57}px;height:${state.table*scale-10}px"></div><span class="table-caption" style="left:${layout.tableLeft+15}px;bottom:${floor+18}px">Стол · ${fmt(state.table)} см</span>`;
 for(const item of layout.items){
  const p=item.p,d=p.dimensions;
  html+=`<button class="device ${state.focus===p.id?'active':''} ${p.whiteBackground?'original-render':''}" type="button" data-id="${esc(p.id)}" aria-pressed="${state.focus===p.id}" aria-controls="detailCard" aria-label="Показать размеры ${esc(p.name)}: ширина ${fmt(d[1])}, высота ${fmt(d[2])}, глубина ${fmt(d[0])} сантиметров${p.image?'':'. Пока без фото'}" style="left:${item.x}px;bottom:${base}px;width:${item.width}px;height:${item.height}px">${p.image?productPhoto(p,'scene',item.height):'<span class="dimension-box"><span>Ожидаем<br>фото анфас</span></span>'}<span class="height-tag" aria-hidden="true"><span>${fmt(d[2])} см</span></span><span class="device-label">${esc(p.name)}<small>${esc(p.sku)} · ширина ${fmt(d[1])} см</small></span></button>`;
 }
 if(!layout.items.length)html+=`<div class="empty-scene"><strong>Поставим технику рядом?</strong>Выберите модели в каталоге и сравните их с человеком.<br><button type="button" id="exampleBtn">Показать пример</button></div>`;
 stage.innerHTML=html;
 viewport.scrollTop=Math.max(0,oldTop+height-oldHeight);
 stage.querySelectorAll('.device').forEach(b=>b.addEventListener('click',()=>{state.focus=b.dataset.id;stage.querySelectorAll('.device').forEach(d=>{const on=d.dataset.id===state.focus;d.classList.toggle('active',on);d.setAttribute('aria-pressed',String(on))});renderDetail();persist()}));
 $('exampleBtn')?.addEventListener('click',()=>{state.selected=new Set(['2100','3500','1200']);state.focus='2100';state.zoom=1;renderAll();persist()});
 $('frontBadge').innerHTML=layout.items.some(item=>item.p.view==='three-quarter')?'<span aria-hidden="true">◉</span> Анфас и ¾':'<span aria-hidden="true">◉</span> Вид спереди';
 const n=layout.items.length;$('selectedCount').textContent=countLabel(n);$('mobileCount').textContent=countLabel(n);$('totalCount').textContent=catalog.length;
 $('zoomValue').textContent=`${Math.round(state.zoom*100)}%`;$('zoomOut').disabled=state.zoom<=.5;$('zoomIn').disabled=state.zoom>=1.5;$('zoomReset').disabled=state.zoom===1;
 updateSceneHint();
}
function updateSceneHint(){const el=$('stageScroll');el.closest('.stage-shell').classList.toggle('overflowing',el.scrollWidth>el.clientWidth+4);$('sceneHint').textContent=el.scrollWidth>el.clientWidth+4?'Сцену можно прокрутить вправо ↔ · Нажмите на прибор, чтобы увидеть размеры.':'Нажмите на прибор — его размеры появятся ниже.'}
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
 $('removeDevice')?.addEventListener('click',()=>{state.selected.delete(p.id);state.focus=[...state.selected].at(-1)||null;renderAll();persist()});
}
function renderAll(){renderModes();renderTabs();renderCatalog();renderScene();renderDetail()}
for(const [id,group,val]of [['standingBtn','pose','standing'],['sittingBtn','pose','sitting'],['tableBtn','place','table'],['floorBtn','place','floor']])$(id).addEventListener('click',()=>setMode(group,val));
for(const [id,key,min,max]of [['humanHeight','human',145,205],['tableHeight','table',65,95]]){
 $(id).addEventListener('input',()=>{const value=Number($(id).value);if(Number.isFinite(value)&&value>=min&&value<=max){state[key]=value;renderScene();persist()}});
 $(id).addEventListener('change',()=>{state[key]=Math.round(Math.max(min,Math.min(max,Number($(id).value)||state[key])));renderModes();renderScene();renderDetail();persist()});
}
$('search').addEventListener('input',e=>{state.search=e.target.value.toLocaleLowerCase('ru').trim();renderCatalog()});
$('clearBtn').addEventListener('click',()=>{state.selected.clear();state.focus=null;renderAll();persist();$('stageScroll').scrollLeft=0});
$('allBtn').addEventListener('click',()=>{currentList().forEach(p=>{if(p.dimensions)state.selected.add(p.id)});if(!state.focus)state.focus=[...state.selected][0];renderAll();persist();toast('Модели добавлены. Прокрутите сцену вправо или нажмите «Вписать».')});
$('pickerToggle').addEventListener('click',()=>{const on=$('pickerToggle').getAttribute('aria-expanded')!=='true';$('pickerToggle').setAttribute('aria-expanded',String(on));$('sidebar').classList.toggle('open',on)});
function zoomBy(delta){state.zoom=Math.max(.5,Math.min(1.5,Math.round((state.zoom+delta)*100)/100));renderScene();persist()}
$('zoomOut').addEventListener('click',()=>zoomBy(-.1));$('zoomIn').addEventListener('click',()=>zoomBy(.1));
$('zoomReset').addEventListener('click',()=>{state.zoom=1;renderScene();persist()});
$('fitBtn').addEventListener('click',()=>{const available=$('stageScroll').clientWidth;let zoom=1.5;while(zoom>.5&&sceneLayout(2.35*zoom).width>available+1)zoom-=.025;state.zoom=Math.max(.5,Math.round(zoom*100)/100);renderScene();$('stageScroll').scrollLeft=0;persist();if($('stageScroll').scrollWidth>available+4)toast('Установлен минимальный масштаб. Для всех моделей используйте прокрутку.')});
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(renderScene,50)});
if(window.ResizeObserver){let lastWidth=0;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)>1){lastWidth=width;renderScene()}}).observe($('stageScroll'))}
// Small pure helpers are exposed for catalog validation and language checks.
window.ScaleMath={plural,countLabel,sceneLayout};
renderAll();
})();
