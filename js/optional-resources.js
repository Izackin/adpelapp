// Optional dependencies, loaded only by explicit user actions.
(function () {
  'use strict';
  const dependencies = Object.freeze({
    youtube: {src:'https://www.youtube.com/iframe_api',ready:()=>typeof window.YT?.Player==='function'},
    xlsx: {src:'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',ready:()=>typeof window.XLSX?.read==='function' && !!window.XLSX?.utils},
    pdf: {src:'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js',ready:()=>typeof window.jspdf?.jsPDF==='function'}
  });
  const pending = new Map();
  function load(name) {
    if (!Object.prototype.hasOwnProperty.call(dependencies,name)) return Promise.reject(new Error('Dependência desconhecida.'));
    const dependency=dependencies[name];
    if (dependency.ready()) return Promise.resolve();
    if (pending.has(name)) return pending.get(name);
    const script=document.createElement('script');
    script.src=dependency.src;
    script.async=true;
    script.dataset.adpelOptional=name;
    const task=new Promise((resolve,reject)=>{
      let timer, poll, finished=false;
      function finish(error) {
        if(finished)return;
        finished=true;
        clearTimeout(timer);clearInterval(poll);
        script.onload=null;script.onerror=null;
        if(error){script.remove();reject(error);}else resolve();
      }
      function check(){if(dependency.ready())finish();}
      script.onload=check;
      script.onerror=()=>finish(new Error('Não foi possível carregar o recurso. Verifique sua conexão e tente novamente.'));
      timer=setTimeout(()=>finish(new Error('O recurso demorou para carregar. Tente novamente.')),20000);
      poll=setInterval(check,100);
      try{document.head.appendChild(script);check();}catch(error){finish(error);}
    }).finally(()=>{if(pending.get(name)===task)pending.delete(name);});
    pending.set(name,task);
    return task;
  }
  window.ADPELOptional=Object.freeze({load});
})();
