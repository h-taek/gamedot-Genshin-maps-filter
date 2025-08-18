// ==UserScript==
// @name         원신 맵스 필터링
// @namespace    genshin-maps-filter
// @version      1.2
// @description  지도, 핀, 태그 UI (핀위치, 기타태그 AND/OR 동작, 숨김/펼침)
// @match        https://genshin.gamedot.org/?mid=genshinmaps*
// @run-at       document-end
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
  let ui = null;
  let tagBox = null;

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

    // 지도 보기
    const mapBox = document.createElement('div');
    mapBox.style.cssText = 'margin-bottom:0px;';  // flex 제거

    const mapHeader = document.createElement('div');
    mapHeader.style.cssText = 'margin-bottom:0px;font-weight:600;font-size:15px;display:flex;align-items:center;justify-content:space-between;';

    const mapTitle = document.createElement('span');
    mapTitle.textContent = "지도 보기";

// 숨김/펼침 버튼
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = "▼";
    toggleBtn.style.cssText = 'margin-left:auto;border:0;border-radius:4px;background:#1c1c1e;color:#fff;cursor:pointer;font-size:14px;';
    toggleBtn.title = "기타 태그 숨김/펼침";
    toggleBtn.addEventListener('click', () => {
      if (tagBox.style.display === "none") {
        tagBox.style.display = "";
        pinBox.style.cssText = 'margin-bottom:10px;padding-top:6px;border-top:1px solid #444';
        toggleBtn.textContent = "▼"; // 펼침 상태
      } else {
        tagBox.style.display = "none";
        pinBox.style.cssText = 'margin-bottom:0px;padding-top:6px;border-top:1px solid #444';
        toggleBtn.textContent = "▲"; // 숨김 상태
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

    // 핀 위치
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

    // 기타 태그 + 스위치
    tagBox = document.createElement('div');
    tagBox.style.cssText = 'padding-top:6px;border-top:1px solid #444';
    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom:4px;font-weight:600;font-size:15px;display:flex;align-items:center;';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = "기타 태그";

    // 스위치 컨테이너
    const switchWrap = document.createElement('div');
    switchWrap.style.cssText = 'display:flex;align-items:center;margin-left:auto;';

    const modeText = document.createElement('span');
    modeText.textContent = TAG_MODE;
    modeText.style.cssText = 'margin-right:-15px;font-size:12px;';

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

    switchWrap.appendChild(modeText);
    switchWrap.appendChild(switchLabel);

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

    // 태그 버튼들
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

    // 버튼 동작 (지도 보기)
    ui.querySelector('#map-ground').addEventListener('click', ()=> switchLayer('지상'));
    ui.querySelector('#map-under').addEventListener('click', ()=> switchLayer('지하'));

    attachUI();
    pinBox.querySelector('button[data-pin="모두"]').style.background = '#5f9ea0';
  }

  function switchLayer(label){
    const btn = document.querySelector(`[data-target='${label} 지도']`)
      || [...document.querySelectorAll('button,[role="button"],a')]
         .find(n => (n.textContent||'').includes(label));
    if(btn){ btn.click(); }
  }

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

  const observer = new MutationObserver(() => { attachUI(); });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

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
          if (TAG_MODE === "OR") {
            return tags.some(t => activeTags.includes(t.trim()));
          } else {
            return activeTags.every(t => tags.includes(t));
          }
        });
      }
      return filtered;
    }
  });

  function refresh(){
    try { W.setPinObjectRefresh?.(); } catch(_){}
    try { W.setPinDataRefresh?.(); } catch(_){}
  }

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
})();
