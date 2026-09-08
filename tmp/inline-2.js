
/* PatchLog v1 — self-recording issue log for the next patch. Owner-facing, hidden by default.
   Ctrl+Shift+L toggles a panel. Never throws. Adapted namespace: bciq. */
(function(){
  var NS='bciq.patchlog.v1', BUILD='BlueClawsIQ index256 · 2026.08.07', MAX=250;
  function read(){ try{ var r=JSON.parse(localStorage.getItem(NS)||'[]'); return Array.isArray(r)?r:[]; }catch(e){ return []; } }
  function write(a){ try{ localStorage.setItem(NS, JSON.stringify(a.slice(-MAX))); }catch(e){} }
  function add(type,msg,extra){ try{ var a=read(); a.push(Object.assign({t:new Date().toISOString(),build:BUILD,type:type,msg:String(msg).slice(0,500)},extra||{})); write(a);}catch(e){} }
  window.addEventListener('error',function(e){ add('error',e.message,{src:(e.filename||'')+':'+e.lineno}); },true);
  window.addEventListener('unhandledrejection',function(e){ add('rejection',(e.reason&&e.reason.message)||e.reason); });
  var ce=console.error; console.error=function(){ try{add('console',[].slice.call(arguments).map(String).join(' '));}catch(e){} return ce.apply(console,arguments); };
  window.PatchLog={ log:function(m,x){add('note',m,x);}, list:read, clear:function(){write([]);},
    export:function(){ try{ var b=new Blob([JSON.stringify(read(),null,2)],{type:'application/json'}); var u=URL.createObjectURL(b); var l=document.createElement('a'); l.href=u; l.download='bciq-patchlog.json'; l.click(); setTimeout(function(){URL.revokeObjectURL(u);},2000);}catch(e){} } };
  document.addEventListener('keydown',function(e){ if(e.ctrlKey&&e.shiftKey&&(e.key==='L'||e.key==='l')){ e.preventDefault(); togglePanel(); } });
  function togglePanel(){ try{ var p=document.getElementById('patchlog-panel'); if(p){ p.remove(); return; }
    p=document.createElement('div'); p.id='patchlog-panel';
    p.style.cssText='position:fixed;bottom:12px;right:12px;z-index:99999;width:360px;max-height:50vh;overflow:auto;background:#0d1d41;color:#f5f3ee;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:10px;border:2px solid #facd01;';
    var a=read(); p.innerHTML='<div style="display:flex;gap:8px;margin-bottom:6px;align-items:center"><strong style="flex:1">PatchLog · '+a.length+' · '+BUILD+'</strong><button id="pl-x">export</button><button id="pl-c">clear</button><button id="pl-q">×</button></div>'+(a.length?a.slice(-40).reverse().map(function(r){return '<div style="border-top:1px solid #35507f;padding:3px 0"><span style="opacity:.6">'+r.t.slice(5,19)+'</span> <b>'+r.type+'</b> '+r.msg.replace(/</g,'&lt;')+(r.src?' <span style="opacity:.5">'+r.src+'</span>':'')+'</div>';}).join(''):'<div style="opacity:.6">no issues recorded</div>');
    document.body.appendChild(p);
    p.querySelector('#pl-x').onclick=window.PatchLog.export; p.querySelector('#pl-q').onclick=function(){p.remove();};
    p.querySelector('#pl-c').onclick=function(){ window.PatchLog.clear(); p.remove(); togglePanel(); };
  }catch(e){} }
})();

