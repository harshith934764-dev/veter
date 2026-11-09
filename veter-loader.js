(() => {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const style = document.createElement('style');
  style.textContent = `
    #veter-loading-screen{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:radial-gradient(circle at 50% 42%,#142c49 0%,#080b14 58%,#05070d 100%);opacity:1;visibility:visible;transition:opacity .45s ease,visibility .45s ease}
    #veter-loading-screen.veter-loader-hide{opacity:0;visibility:hidden;pointer-events:none}
    .veter-loader-inner{display:flex;flex-direction:column;align-items:center;gap:18px;padding:24px}
    .veter-loader-mark{width:104px;height:104px;position:relative;display:grid;place-items:center;perspective:500px;filter:drop-shadow(0 12px 30px #29dce955)}
    .veter-loader-orbit{position:absolute;inset:5px;border:1px solid #54e5e588;border-radius:28px;transform:rotateX(62deg) rotateZ(0deg);animation:veterOrbit 2.2s linear infinite}
    .veter-loader-orbit:before{content:"";position:absolute;width:9px;height:9px;border-radius:50%;background:#54e5e5;top:8px;left:12px;box-shadow:0 0 18px #54e5e5}
    .veter-loader-core{width:72px;height:72px;display:grid;place-items:center;border:1px solid #83edff99;border-radius:22px;background:linear-gradient(145deg,#2e6b9b,#10243c 58%,#0b1527);box-shadow:inset 4px 4px 12px #ffffff22,inset -8px -8px 16px #02081399,0 0 26px #54e5e544;transform:rotateX(12deg) rotateY(-17deg);animation:veterFloat 1.8s ease-in-out infinite}
    .veter-loader-core span{font:900 38px/1 system-ui,sans-serif;letter-spacing:-4px;color:#efffff;text-shadow:0 2px 14px #54e5e5aa}
    .veter-loader-name{font:900 19px/1 system-ui,sans-serif;letter-spacing:.24em;color:#f4f7ff}
    .veter-loader-caption{font:12px/1.4 system-ui,sans-serif;letter-spacing:.12em;color:#9db4d1}
    .veter-loader-track{width:112px;height:3px;overflow:hidden;border-radius:8px;background:#25364d}
    .veter-loader-track:after{content:"";display:block;width:42%;height:100%;border-radius:8px;background:linear-gradient(90deg,#69a7ff,#54e5e5);animation:veterProgress 1.1s ease-in-out infinite}
    @keyframes veterOrbit{to{transform:rotateX(62deg) rotateZ(360deg)}}
    @keyframes veterFloat{0%,100%{transform:translateY(0) rotateX(12deg) rotateY(-17deg)}50%{transform:translateY(-7px) rotateX(18deg) rotateY(17deg)}}
    @keyframes veterProgress{0%{transform:translateX(-120%)}100%{transform:translateX(260%)}}
    @media(max-width:480px){.veter-loader-mark{width:90px;height:90px}.veter-loader-core{width:64px;height:64px}}
    @media(prefers-reduced-motion:reduce){#veter-loading-screen,.veter-loader-orbit,.veter-loader-core,.veter-loader-track:after{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);
  const show = () => {
    if (document.getElementById('veter-loading-screen')) return;
    const overlay = document.createElement('div');
    overlay.id = 'veter-loading-screen';
    overlay.setAttribute('role','status');
    overlay.setAttribute('aria-label','Loading VETER');
    overlay.innerHTML = '<div class="veter-loader-inner"><div class="veter-loader-mark" aria-hidden="true"><div class="veter-loader-orbit"></div><div class="veter-loader-core"><span>V</span></div></div><div class="veter-loader-name">VETER</div><div class="veter-loader-caption">BUILDING WHAT\'S NEXT</div><div class="veter-loader-track" aria-hidden="true"></div></div>';
    document.body.appendChild(overlay);
    const started = Date.now();
    let dismissed = false;
    const hide = () => {
      if (dismissed) return;
      dismissed = true;
      const wait = Math.max(0, 520 - (Date.now() - started));
      setTimeout(() => {
        overlay.classList.add('veter-loader-hide');
        setTimeout(() => overlay.remove(), 500);
      }, wait);
    };
    window.addEventListener('load', hide, {once:true});
    setTimeout(hide, 2200);
    window.addEventListener('pageshow', hide, {once:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, {once:true});
  else show();
})();