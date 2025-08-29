// ==UserScript==
// @name         원신 맵스 필터링
// @namespace    genshin-maps-filter
// @version      5.8.1
// @description  지도/핀/태그 필터링, 경로 탐색 UI
// @match        https://genshin.gamedot.org/?mid=genshinmaps*
// @downloadURL  https://raw.githubusercontent.com/h-taek/gamedot-Genshin-maps-filter/refs/heads/main/genshin_maps_filter.js
// @updateURL    https://raw.githubusercontent.com/h-taek/gamedot-Genshin-maps-filter/refs/heads/main/genshin_maps_filter.js
// ==/UserScript==

(function() {
  'use strict';
  const W = typeof unsafeWindow!=='undefined'?unsafeWindow:window;
  if (!W.MAPS_PinDraw?.get) {
    console.warn('[Filter] MAPS_PinDraw.get 없음');
    return;
  }

  const TAG_DICT = {};
  let PIN_FILTER = "모두";
  let TAG_MODE = "OR";
  let NOT_MODE = false;
  let ui = null;
  let tagBox = null;


  // 태그 수집
  function collectTags() {
    (W.MAPS_PinLoad || []).forEach(set => {
      (set.mapData || []).forEach(md => {
        if (!md?.tag) return;
        const tags = Array.isArray(md.tag) ? md.tag : String(md.tag).split(',');
        tags.forEach(t => {
          const tag = String(t).trim();
          if (tag && tag !== "지하") TAG_DICT[tag] = false;
        });
      });
    });
  }

  // UI 생성
  function createUI() {
    ui = document.createElement('div');
    ui.style.cssText = [
      'position:absolute',
      'bottom:10px',
      'right:-10px',
      'z-index:9999',
      'background:#1c1c1e','color:#fff','border:1px solid #3a3a3c',
      'padding:8px','padding-top:4px','border-radius:10px',
      'font:12px/1.4 -apple-system,system-ui',
      'width:260px',
      'max-height:500px',
      'overflow-y:auto',
      'transform:translateX(100%)'
    ].join(';');

    const mapBox = document.createElement('div');
    mapBox.style.cssText = 'margin-bottom:0px;';

    const mapHeader = document.createElement('div');
    mapHeader.style.cssText = 'margin-bottom:0px;font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:space-between;';

    const mapTitle = document.createElement('span');
    mapTitle.textContent = "지도 보기";

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = "▼";
    toggleBtn.style.cssText = 'margin-left:auto;border:0;border-radius:4px;background:#1c1c1e;color:#fff;cursor:pointer;font-size:14px;';
    toggleBtn.title = "기타 태그 숨김/펼침";
    toggleBtn.addEventListener('click', () => {
      if (tagBox.style.display === "none") {
        tagBox.style.display = "";
        pinBox.style.cssText = 'margin-bottom:10px;padding-top:6px;border-top:1px solid #444';
        toggleBtn.textContent = "▼";
      } else {
        tagBox.style.display = "none";
        pinBox.style.cssText = 'margin-bottom:0px;padding-top:6px;border-top:1px solid #444';
        toggleBtn.textContent = "▲";
      }
    });
    mapHeader.appendChild(mapTitle);
    mapHeader.appendChild(toggleBtn);
    mapBox.appendChild(mapHeader);
      
    const mapBtns = document.createElement('div');
    mapBtns.style.cssText = 'margin-bottom:10px';
    mapBtns.innerHTML = `
      <button id="map-ground" style="margin:2px;padding:4px 8px;border:0;border-radius:4px;background:#2c2c2e;color:#fff;cursor:pointer;">지상</button>
      <button id="map-under"  style="margin:2px;padding:4px 8px;border:0;border-radius:4px;background:#2c2c2e;color:#fff;cursor:pointer;">지하</button>
    `;
    mapBox.appendChild(mapBtns);
    ui.appendChild(mapBox);

    const routeBox = document.createElement('div');
    routeBox.style.cssText = 'margin-top:10px;padding-top:6px;border-top:1px solid #444';
    const routeHeader = document.createElement('div');
    routeHeader.textContent = "경로 탐색";
    routeHeader.style.cssText = 'margin-bottom:4px;font-weight:600;font-size:15px';
    routeBox.appendChild(routeHeader);

    const btnSelect=document.createElement("button");
    btnSelect.textContent="핀 선택";
    btnSelect.style.cssText="flex:1;padding:6px;cursor:pointer;background:#444;color:#fff;border:none;border-radius:6px;";
    btnSelect.onclick=()=>{
      selectMode=!selectMode;
      btnSelect.textContent="핀 선택";
      btnSelect.style.background = selectMode ? "#5f9ea0" : "#444";
      if (!selectMode) startSelectMode = false;
      resetSelection();
    };

    const btnCalc=document.createElement("button");
    btnCalc.textContent="경로 계산";
    btnCalc.style.cssText="flex:1;padding:6px;cursor:pointer;background:#444;color:#fff;border:none;border-radius:6px;";
    btnCalc.onclick=()=>{
      if (selectedPins.size<2){
        alert("선택된 핀이 2개 이상 필요");
        return;
      }
      if (!startPinId) {
        startSelectMode = true;
        pendingCalc = true;
        alert("시작점을 지도에서 선택");
      }
      else { 
        calcRoute(startPinId);
      }
    };

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;';
    btnRow.append(btnSelect, btnCalc);
    routeBox.appendChild(btnRow);
    ui.appendChild(routeBox);

    const pinBox = document.createElement('div');
    pinBox.style.cssText = 'margin-bottom:10px;padding-top:6px;border-top:1px solid #444';      
    pinBox.innerHTML = `<div style="margin-bottom:4px;font-weight:600;font-size:15px">핀 위치</div>`;
    function makePinBtn(label){
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.dataset.pin = label;
      btn.style.cssText = 'margin:2px;padding:4px 8px;background:#444;color:#fff;border:0;border-radius:4px;cursor:pointer;';
      btn.addEventListener('click', ()=>{
        PIN_FILTER = label;
        [...pinBox.querySelectorAll('button')].forEach(b => b.style.background='#444');
        btn.style.background = '#5f9ea0';
        refresh();
      });
      return btn;
    }
    pinBox.appendChild(makePinBtn('모두'));
    pinBox.appendChild(makePinBtn('지상'));
    pinBox.appendChild(makePinBtn('지하'));
    ui.appendChild(pinBox);


    tagBox = document.createElement('div');
    tagBox.style.cssText = 'padding-top:6px;border-top:1px solid #444';
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom:4px;font-weight:600;font-size:15px;display:flex;align-items:center;';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = "기타 태그";

    
    const switchWrap = document.createElement('div');
    switchWrap.style.cssText = 'display:flex;align-items:center;margin-left:auto;';

    const modeText = document.createElement('span');
    modeText.textContent = TAG_MODE;
    modeText.style.cssText = 'margin-right:-19px;font-size:12px;font-weight:normal;';


    const notBtn = document.createElement('button');
    notBtn.textContent = "NOT";
    notBtn.style.cssText = 'margin-left:4px;padding:2px 6px;border:0;border-radius:4px;background:#444;color:#fff;cursor:pointer;font-size:12px;';
    notBtn.addEventListener('click', ()=>{
      NOT_MODE = !NOT_MODE;
      notBtn.style.background = NOT_MODE ? '#5f9ea0' : '#444';
      refresh();
    });

    const switchLabel = document.createElement('label');
    switchLabel.style.cssText = 'position:relative;display:inline-block;width:50px;height:24px;cursor:pointer;transform:scale(0.6);transform-origin:right center;';
    switchLabel.innerHTML = `
      <input type="checkbox" id="tagModeSwitch" style="opacity:0;width:0;height:0;">
      <span class="slider"></span>
      <span class="knob"></span>
    `;
    const sliderStyle = `
      .slider {
        position:absolute;top:0;left:0;right:0;bottom:0;
        background-color:#555;border-radius:24px;
        transition:.4s;
      }
      .knob {
        position:absolute;content:'';height:18px;width:18px;
        left:3px;bottom:3px;background-color:white;
        border-radius:50%;transition:.4s;
      }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = sliderStyle;
    document.head.appendChild(styleEl);

    // Custom scrollbar style for .ui-scroll
    const scrollbarStyle = `
      .ui-scroll::-webkit-scrollbar {
        width: 8px;
      }
      .ui-scroll::-webkit-scrollbar-track {
        background: #2c2c2e;
        border-radius: 5px;
      }
      .ui-scroll::-webkit-scrollbar-thumb {
        background: #abababff;
        border-radius: 5px;
      }
      .ui-scroll::-webkit-scrollbar-thumb:hover {
        background: #d0d0d0ff;
      }
    `;
    const scrollbarStyleEl = document.createElement('style');
    scrollbarStyleEl.textContent = scrollbarStyle;
    document.head.appendChild(scrollbarStyleEl);

    switchWrap.appendChild(modeText);
    switchWrap.appendChild(switchLabel);
    switchWrap.appendChild(notBtn); 

    header.appendChild(titleSpan);
    header.appendChild(switchWrap);
    tagBox.appendChild(header);

    // 스위치 동작
    const inputEl = switchLabel.querySelector('input');
    const slider = switchLabel.querySelector('.slider');
    const knob = switchLabel.querySelector('.knob');
    inputEl.addEventListener('change', ()=>{
      TAG_MODE = inputEl.checked ? "AND" : "OR";
      modeText.textContent = TAG_MODE;
      slider.style.backgroundColor = inputEl.checked ? '#5f9ea0' : '#555';
      knob.style.transform = inputEl.checked ? 'translateX(26px)' : 'translateX(0)';
      refresh();
    });

    // 태그 버튼
    Object.keys(TAG_DICT).forEach(tag => {
      const btn = document.createElement('button');
      btn.textContent = tag;
      btn.dataset.tag = tag;
      btn.style.cssText = 'margin:2px;padding:4px 8px;background:#444;color:#fff;border:0;border-radius:4px;cursor:pointer;font-size:12px;';
      btn.addEventListener('click', () => {
        TAG_DICT[tag] = !TAG_DICT[tag];
        btn.style.background = TAG_DICT[tag] ? '#5f9ea0' : '#444';
        refresh();
      });
      tagBox.appendChild(btn);
    });
    ui.appendChild(tagBox);

    // Add custom scrollbar class
    ui.classList.add('ui-scroll');

    // 버튼 동작 (지도 보기)
    ui.querySelector('#map-ground').addEventListener('click', ()=> switchLayer('지상'));
    ui.querySelector('#map-under').addEventListener('click', ()=> switchLayer('지하'));

    attachUI();
    pinBox.querySelector('button[data-pin="모두"]').style.background = '#5f9ea0';
  }

  // 지도 레이어 전환
  function switchLayer(label){
    const btn = document.querySelector(`[data-target='${label} 지도']`)
      || document.querySelector(`[data-target='${label}']`);
    if(btn){ btn.click(); }
  }

  // UI 부착
  function attachUI() {
    const rightPanel = document.querySelector("#mapsContainer");
    const menu = document.querySelector("#mapsMenu");
    if (rightPanel && rightPanel.style.display !== "none") {
      if (ui.parentNode !== rightPanel.parentNode) {
        rightPanel.insertAdjacentElement("afterend", ui);
      }
    } else if (menu) {
      if (ui.parentNode !== menu.parentNode) {
        menu.insertAdjacentElement("afterend", ui);
      }
    } else {
      if (!ui.parentNode) document.body.appendChild(ui);
    }
  }

  // UI 위치 감시
  const observer = new MutationObserver(() => { 
    attachUI();
    updateHighlight();  
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // 필터링 Proxy
  const origGet = W.MAPS_PinDraw.get;
  W.MAPS_PinDraw.get = new Proxy(origGet, {
    apply(target, thisArg, args) {
      const res = Reflect.apply(target, thisArg, args);
      if (!Array.isArray(res)) return res;

      let filtered = res.filter(md => {
        const tags = Array.isArray(md.tag) ? md.tag.map(String) : String(md.tag).split(',');
        if (PIN_FILTER === "지상" && tags.includes("지하")) return false;
        if (PIN_FILTER === "지하" && !tags.includes("지하")) return false;
        return true;
      });

      const activeTags = Object.keys(TAG_DICT).filter(k => TAG_DICT[k]);
      if (activeTags.length > 0) {
        filtered = filtered.filter(md => {
          if (!md?.tag) return false;
          const tags = Array.isArray(md.tag) ? md.tag.map(String) : String(md.tag).split(',');
          let cond;
          if (TAG_MODE === "OR") {
            cond = tags.some(t => activeTags.includes(t.trim()));
          } else {
            cond = activeTags.every(t => tags.includes(t));
          }
          return NOT_MODE ? !cond : cond;
        });
      }
      return filtered;
    }
  });

  // 새로고침
  function refresh(){
    try { W.setPinObjectRefresh?.(); } catch(_){}
    try { W.setPinDataRefresh?.(); } catch(_){}

    const visibleIds = new Set();
    document.querySelectorAll('.maps-point').forEach(el => {
      const pin = el.getAttribute('data-pin') || "p";
      const point = el.getAttribute('data-point') || "0";
      visibleIds.add(pin + ":" + point);
    });

    // 선택된 핀 중 화면에 없는 건 제거
    selectedPins.forEach(id=>{
      if (!visibleIds.has(id)) {
        selectedPins.delete(id);
        if (startPinId === id) startPinId = null;
      }
    });

    console.log("[Debug] visible:", [...visibleIds], "selected:", [...selectedPins]);
    updateHighlight();
  }

  // 초기화
  function init() {
    collectTags();
    createUI();
    console.log('[Filter] UI 구성 완료:', Object.keys(TAG_DICT));
  }

  const timer = setInterval(() => {
    if (document.readyState === 'complete' && W.MAPS_PinLoad?.length) {
      clearInterval(timer);
      init();
    }
  }, 1000);
  
  
  // 선택 모드
  let selectMode = false;
  let dragStart = null, dragBox = null;
  let selectedPins = new Set();

  let startSelectMode = false;
  let pendingCalc = false;      
  let startPinId = null;        

  // 선택 초기화
  function resetSelection() {
    selectedPins.clear();
    startPinId = null;
    document.querySelectorAll('.route-line').forEach(el => el.remove());
    updateHighlight();
  }

  const REGIONS = ["몬드", "리월", "이나즈마", "수메르", "폰타인", "나타"];


  // 제외 핀 판별
  function isExcludedPin(el) {
    const tip = el.getAttribute("data-tip") || "";
    if (tip.startsWith("워프 포인트")) return true;
    if (tip.startsWith("비경")) return true;
    if (REGIONS.some(region => tip.startsWith(region + "#"))) return true;
    if (el.getAttribute("data-state")=="true" || el.getAttribute("data-state")=="1") return true;   // 추가: 숨겨진 핀 제외
    return false;
  }

  // 핀 ID 추출
  function getPinId(el){
    const pin = el.getAttribute('data-pin') || "p";
    const point = el.getAttribute('data-point') || "0";
    return pin + ":" + point;
  }

  // 선택 핀 하이라이트
  function updateHighlight() {
    document.querySelectorAll('.maps-point').forEach(el=>{
      const id = getPinId(el);
      if (selectedPins.has(id)) {
        el.style.outline = (id === startPinId) ? '3px solid blue' : '2px solid red';
      } else {
        el.style.outline = '';
      }
    });
  }

  // 경로 계산 유틸
  function parseXY(el) {
    const m = el.style.transform.match(/translate\(([-0-9.]+)px,\s*([-0-9.]+)px/);
    return {x:parseFloat(m[1]), y:parseFloat(m[2])};
  }

  function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }

  function nnRoute(points, start=0){
    const n=points.length, used=Array(n).fill(false), route=[start];
    used[start]=true;
    for(let step=1;step<n;step++){
      let best=-1,bestD=1e18,cur=route[route.length-1];
      for(let i=0;i<n;i++) if(!used[i]){
        const d=dist(points[cur],points[i]);
        if(d<bestD){bestD=d;best=i;}
      }
      used[best]=true; route.push(best);
    }
    return route;
  }

  function twoOpt(points, order, maxIter=2000){
    let improved=true, n=order.length;
    while(improved && maxIter--){
      improved=false;
      for(let i=1;i<n-2;i++){
        for(let k=i+1;k<n-1;k++){
          const a=points[order[i-1]], b=points[order[i]];
          const c=points[order[k]], d=points[order[k+1]];
          const delta=(dist(a,c)+dist(b,d))-(dist(a,b)+dist(c,d));
          if(delta<-1e-9){
            for(let l=0;l<(k-i+1)/2;l++){
              [order[i+l],order[k-l]]=[order[k-l],order[i+l]];
            }
            improved=true;
          }
        }
      }
    }
    return order;
  }

  function routeLength(points, order){
    let s=0;
    for(let i=0;i<order.length-1;i++) s+=dist(points[order[i]],points[order[i+1]]);
    return s;
  }

  // 경로 시각화
  function drawRoute(pins, order){
    document.querySelectorAll('.route-line').forEach(el=>el.remove());

    const container = document.querySelector('#mapsLayerPoint');
    if (!container) return;

    for (let i=0;i<order.length-1;i++){
      const a=pins[order[i]], b=pins[order[i+1]];
      const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy);
      const angle=Math.atan2(dy,dx)*180/Math.PI;

      const line=document.createElement('div');
      line.className='route-line';
      line.style.cssText=`
        position:absolute;
        left:${a.x}px; top:${a.y}px;
        width:${len}px; height:2px;
        background:rgba(255, 0, 85, 0.55);
        transform:rotate(${angle}deg);
        transform-origin:0 0;
        pointer-events:none;
        z-index:9999;
      `;
      container.appendChild(line);
    }
  }


  // 경로 계산
  function calcRoute(startId) {
    const ids = [...selectedPins];
    if (!selectMode) {
      alert("핀 선택 모드가 아님");
      return;
    }
    if (ids.length < 2) {
      alert("선택된 핀 2개 이상 필요");
      return;
    }

    let shown = false;
    const pins = ids.map(id=>{
      const el=document.querySelector(`.maps-point[data-pin="${id.split(":")[0]}"][data-point="${id.split(":")[1]}"]`);
      if(!el && !shown) {
        alert("선택된 핀이 화면 밖에 있음");
        shown = true;
        return;
      }
      const {x,y}=parseXY(el);
      return {id,el,x,y,tip:el.getAttribute("data-tip")};
    });

    let startIndex=0;
    if (startId){
      startIndex = pins.findIndex(p=>p.id===startId);
      if (startIndex<0) startIndex=0;
    }

    let order=nnRoute(pins,startIndex);
    order=twoOpt(pins,order);

    console.log("=== [동선 계산 결과] ===");
    order.forEach((idx,rank)=>{
      console.log(`${rank+1}. ${pins[idx].tip} (id=${pins[idx].id}, x=${pins[idx].x}, y=${pins[idx].y})`);
    });
    console.log("총 경로 길이:", routeLength(pins,order).toFixed(1));
    console.log("=======================");

    drawRoute(pins,order);

    // 계산 후 선택 모드 OFF
    selectMode = false;
    updateHighlight();

    const btnSelect = [...document.querySelectorAll("button")]
      .find(b => b.textContent.startsWith("핀 선택"));
    if (btnSelect) {
      btnSelect.textContent = "핀 선택";
      btnSelect.style.background = "#444";
    }
  }


  // 클릭 선택
  document.addEventListener('click', e => {
    const el = e.target.closest('.maps-point');
    if (!el || isExcludedPin(el)) return;
    if (!selectMode) return;

    // 시작점 선택 모드 우선 처리
    if (startSelectMode){
      const id=getPinId(el);
      if (!selectedPins.has(id)){
        alert("시작점은 선택된 핀 중에서만 지정할 수 있음");
        return;
      }
      startPinId=id;
      updateHighlight();
      startSelectMode=false;
      if (pendingCalc){
        calcRoute(startPinId);
        pendingCalc=false;
      }
      e.stopPropagation(); e.preventDefault();
      return;
    }

    // 클릭 선택
    const id = getPinId(el);
    if (selectedPins.has(id)) selectedPins.delete(id);
    else selectedPins.add(id);

    updateHighlight();
    e.stopPropagation();
    e.preventDefault();
  }, true);

  // 드래그 선택
  document.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!selectMode) return;
    if (ui && ui.contains(e.target)) return; 
    dragStart={x:e.clientX,y:e.clientY};
    dragBox=document.createElement('div');
    dragBox.style.cssText=`
      position:fixed; border:1px dashed rgba(255, 255, 255, 0.71); background:rgba(255, 255, 255, 0.1);
      left:${e.clientX}px; top:${e.clientY}px; width:0; height:0;
      z-index:99999; pointer-events:none;
    `;
    document.body.appendChild(dragBox);

    e.stopPropagation(); e.preventDefault();
  }, true);

  document.addEventListener('mousemove', e => {
    if (!selectMode || !dragBox) return;
    const x1=Math.min(dragStart.x,e.clientX), y1=Math.min(dragStart.y,e.clientY);
    const x2=Math.max(dragStart.x,e.clientX), y2=Math.max(dragStart.y,e.clientY);
    dragBox.style.left=x1+'px'; dragBox.style.top=y1+'px';
    dragBox.style.width=(x2-x1)+'px'; dragBox.style.height=(y2-y1)+'px';
    e.stopPropagation(); e.preventDefault();
  }, true);

  document.addEventListener('mouseup', e => {
    if (!selectMode || !dragBox) return;
    const r=dragBox.getBoundingClientRect();
    document.body.removeChild(dragBox);
    dragBox=null;

    if (Math.abs(e.clientX-dragStart.x)<3 && Math.abs(e.clientY-dragStart.y)<3) return;

    const els=document.querySelectorAll('.maps-point');
    const hits=[];
    els.forEach(el=>{
      if (isExcludedPin(el)) return;
      const b=el.getBoundingClientRect();
      const cx=b.left+b.width/2, cy=b.top+b.height/2;
      if (cx>=r.left && cx<=r.right && cy>=r.top && cy<=r.bottom) {
        hits.push(getPinId(el));
      }
    });

    if (hits.length){
      const allInRectAlreadySelected = hits.every(id => selectedPins.has(id));
      if (allInRectAlreadySelected){
        hits.forEach(id => selectedPins.delete(id));
      } else {
        hits.forEach(id => selectedPins.add(id));
      }
      updateHighlight();
    }

    e.stopPropagation(); e.preventDefault();
  }, true);

})();
