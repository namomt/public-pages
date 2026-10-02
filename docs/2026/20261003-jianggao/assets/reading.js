(() => {
  'use strict';
  const DEFAULT_FONT = 18, MIN_FONT = 15, MAX_FONT = 36;
  const STORAGE_KEY = 'public_pages_reading_font_size';
  let fontSize = DEFAULT_FONT, pinch = null, frame = 0, pendingFont = null;
  let swipe = null, multiSeen = false, suppressClickUntil = 0;
  const root = document.documentElement;
  const clampFont = value => Number.isFinite(Number(value))
    ? Math.round(Math.max(MIN_FONT, Math.min(MAX_FONT, Number(value))) * 10) / 10 : DEFAULT_FONT;
  function saveFont() { try { localStorage.setItem(STORAGE_KEY, String(fontSize)); } catch (_) {} }
  function setFont(value, persist = true) {
    fontSize = clampFont(value);
    root.style.setProperty('--reading-font-size', fontSize + 'px');
    if (persist) saveFont();
  }
  function distance(a, b) { return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); }
  function applyPinch() {
    if (!pinch || pendingFont === null) return;
    setFont(pendingFont, false);
    if (pinch.anchor && pinch.anchor.isConnected) {
      const rect = pinch.anchor.getBoundingClientRect();
      const shift = rect.top + rect.height * pinch.ratio - pinch.y;
      if (Math.abs(shift) > 1) window.scrollBy(0, shift);
    }
  }
  function finishPinch() {
    if (!pinch) return;
    if (frame) { cancelAnimationFrame(frame); frame = 0; }
    applyPinch();
    pinch = null; pendingFont = null;
    saveFont();
  }
  function startPinch(event) {
    finishPinch();
    const [a,b] = Array.from(event.touches), gap = distance(a,b);
    if (gap < 8) return;
    if (event.cancelable) event.preventDefault();
    const x=(a.clientX+b.clientX)/2,y=(a.clientY+b.clientY)/2;
    const target=document.elementFromPoint(x,y);
    const anchor=target && target.closest('p,li,h1,h2,h3,h4,blockquote,.manuscript-card');
    const rect=anchor && anchor.getBoundingClientRect();
    pinch={ids:[a.identifier,b.identifier],gap,font:fontSize,anchor,y,
      ratio:rect && rect.height>0 ? Math.min(1,Math.max(0,(y-rect.top)/rect.height)) : 0};
  }
  function start(event) {
    if (event.touches.length >= 2) {
      multiSeen=true; swipe=null;
      if (event.touches.length === 2) startPinch(event); else finishPinch();
      return;
    }
    if (multiSeen || event.touches.length !== 1) return;
    const touch=event.touches[0],target=touch.target || event.target;
    if (!target || target.closest('button,input,textarea,select,.toolbar')) return;
    const card=document.body.dataset.view==='index' && target.closest('.manuscript-card');
    const url=card ? card.getAttribute('href') : document.body.dataset.view==='reader' ? document.body.dataset.returnUrl : null;
    if (!url) return;
    swipe={id:touch.identifier,x:touch.clientX,y:touch.clientY,lastX:touch.clientX,lastY:touch.clientY,
      started:Date.now(),url,direction:card?1:-1,horizontal:false};
  }
  function move(event) {
    if (pinch) {
      if (event.touches.length !== 2) { finishPinch(); return; }
      const touches=Array.from(event.touches),a=touches.find(t=>t.identifier===pinch.ids[0]),b=touches.find(t=>t.identifier===pinch.ids[1]);
      if (!a || !b) { finishPinch(); return; }
      if (event.cancelable) event.preventDefault();
      pendingFont=clampFont(pinch.font*distance(a,b)/pinch.gap);
      if (!frame) frame=requestAnimationFrame(()=>{frame=0;applyPinch();});
      return;
    }
    if (multiSeen || !swipe || event.touches.length!==1) return;
    const touch=event.touches[0];
    if (touch.identifier!==swipe.id) { swipe=null;return; }
    swipe.lastX=touch.clientX;swipe.lastY=touch.clientY;
    const dx=touch.clientX-swipe.x,dy=touch.clientY-swipe.y;
    if (!swipe.horizontal && Math.abs(dy)>12 && Math.abs(dy)>=Math.abs(dx)) { swipe=null;return; }
    if (Math.abs(dx)>12 && Math.abs(dx)>Math.abs(dy)*1.6 && dx*swipe.direction>0) {
      swipe.horizontal=true;
      if (event.cancelable) event.preventDefault();
    }
  }
  function end(event) {
    finishPinch();
    if (multiSeen) {
      swipe=null;suppressClickUntil=Date.now()+450;
      if (event.touches.length===0) multiSeen=false;
      return;
    }
    if (!swipe || event.touches.length!==0) return;
    const candidate=swipe;swipe=null;
    const finalTouch=Array.from(event.changedTouches || []).find(t=>t.identifier===candidate.id);
    const dx=(finalTouch?finalTouch.clientX:candidate.lastX)-candidate.x;
    const dy=(finalTouch?finalTouch.clientY:candidate.lastY)-candidate.y;
    const selected=window.getSelection && window.getSelection().type==='Range';
    if (candidate.horizontal && dx*candidate.direction>=64 && Math.abs(dx)>Math.abs(dy)*1.6 &&
        Date.now()-candidate.started<=1200 && !selected) {
      if (event.cancelable) event.preventDefault();
      suppressClickUntil=Date.now()+450;
      window.location.assign(candidate.url);
    }
  }
  function cancel(event) {
    finishPinch();swipe=null;multiSeen=event.touches.length>0;suppressClickUntil=Date.now()+450;
  }
  document.addEventListener('touchstart',start,{passive:false});
  document.addEventListener('touchmove',move,{passive:false});
  document.addEventListener('touchend',end,{passive:false});
  document.addEventListener('touchcancel',cancel,{passive:true});
  document.addEventListener('click',event=>{
    if (Date.now()<suppressClickUntil) { event.preventDefault();event.stopPropagation(); }
  },true);
  document.querySelectorAll('[data-font]').forEach(button=>button.addEventListener('click',()=>{
    finishPinch();swipe=null;
    setFont(button.dataset.font==='reset'?DEFAULT_FONT:fontSize+Number(button.dataset.font));
  }));
  let saved=null;
  try { saved=localStorage.getItem(STORAGE_KEY); } catch (_) {}
  setFont(saved===null?DEFAULT_FONT:saved,false);
  root.classList.add('reading-enabled');
})();
