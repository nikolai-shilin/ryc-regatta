// The site doesn't zoom: the viewport's maximumScale/userScalable (app/[lang]/layout.tsx) is enough for Android, but iOS
// Safari ignores it, so a pinch (gesturestart, a two-finger touchmove) is cancelled here; on a desktop, so is a trackpad
// pinch or Ctrl+wheel (a wheel event with ctrlKey) and Ctrl/⌘ with +, − or 0. A double tap is styles/ryc.css's
// touch-action: manipulation. Inlined in the head of each root layout, before the first paint; public/play/index.html
// carries its own copy.
export const NO_ZOOM = `;try{var nz=function(e){e.preventDefault()},o={passive:false},d=document;d.addEventListener('gesturestart',nz,o);d.addEventListener('gesturechange',nz,o);d.addEventListener('touchmove',function(e){if(e.touches&&e.touches.length>1)e.preventDefault()},o);d.addEventListener('wheel',function(e){if(e.ctrlKey)e.preventDefault()},o);d.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&/^(Equal|Minus|Digit0|NumpadAdd|NumpadSubtract|Numpad0)$/.test(e.code))e.preventDefault()})}catch(e){}`;
