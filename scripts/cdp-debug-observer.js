const http=require('node:http');
const PORT=Number(process.argv[2]||9396);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function j(p){return new Promise((res,rej)=>{const q=http.get({host:'127.0.0.1',port:PORT,path:p,timeout:3000},r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{try{res(JSON.parse(s))}catch(e){rej(e)}})});q.on('error',rej);q.on('timeout',()=>q.destroy(Error('t')));});}
(async()=>{
 let t; const end=Date.now()+60000; while(Date.now()<end){try{const a=await j('/json/list');t=(a||[]).find(x=>x.type==='page'&&x.webSocketDebuggerUrl);if(t)break}catch{} await sleep(300)}
 const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise((r,e)=>{ws.addEventListener('open',r);ws.addEventListener('error',e)});
 let id=0;const pend=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(Error(JSON.stringify(m.error))):p.res(m.result)}});
 const send=(method,params={})=>new Promise((res,rej)=>{const n=++id;pend.set(n,{res,rej});ws.send(JSON.stringify({id:n,method,params}))});
 const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 await ev(`(()=>{document.querySelectorAll('.article-item')[2].click()})()`);
 await sleep(4000);
 const before=await ev(`(()=>{const s=document.querySelector('.reader-scroll');const imgs=[...document.querySelectorAll('.article-body img')];return {top:s.scrollTop,firstRects:imgs.slice(0,3).map(i=>({t:Math.round(i.getBoundingClientRect().top),loading:i.loading,src:i.getAttribute('src')?.slice(0,50),complete:i.complete})),scrollRect:s.getBoundingClientRect().top}})()`);
 await ev(`(()=>{document.querySelector('.reader-scroll').scrollTop=600})()`);
 await sleep(3000);
 const after=await ev(`(()=>{const imgs=[...document.querySelectorAll('.article-body img')];return {done:imgs.filter(i=>i.complete).length,ok:imgs.filter(i=>i.complete&&i.naturalWidth>0).length,loading:imgs.slice(0,3).map(i=>i.loading)}})()`);
 console.log(JSON.stringify({before,after},null,2));ws.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
