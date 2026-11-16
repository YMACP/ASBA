// Watch a slow article for 30s after reaching the bottom.
const http=require('node:http');
const PORT=Number(process.argv[2]||9398);
const TITLE=process.argv[3]||'The components of agent memory';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function j(p){return new Promise((res,rej)=>{const q=http.get({host:'127.0.0.1',port:PORT,path:p,timeout:3000},r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{try{res(JSON.parse(s))}catch(e){rej(e)}})});q.on('error',rej);q.on('timeout',()=>q.destroy(Error('t')));});}
(async()=>{
 let t;const end=Date.now()+60000;while(Date.now()<end){try{const a=await j('/json/list');t=(a||[]).find(x=>x.type==='page'&&x.webSocketDebuggerUrl);if(t)break}catch{}await sleep(300)}
 const ws=new WebSocket(t.webSocketDebuggerUrl);await new Promise((r,e)=>{ws.addEventListener('open',r);ws.addEventListener('error',e)});
 let id=0;const pend=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){const p=pend.get(m.id);pend.delete(m.id);m.error?p.rej(Error(JSON.stringify(m.error))):p.res(m.result)}});
 const send=(method,params={})=>new Promise((res,rej)=>{const n=++id;pend.set(n,{res,rej});ws.send(JSON.stringify({id:n,method,params}))});
 const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 await ev(`(()=>{const i=document.querySelector('.search input');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i,${JSON.stringify(TITLE)});i.dispatchEvent(new Event('input',{bubbles:true}))})()`);
 await sleep(1200);
 await ev(`(()=>{const e=[...document.querySelectorAll('.article-item')].find(x=>x.innerText.includes(${JSON.stringify(TITLE)}));if(e)e.click();return !!e})()`);
 await sleep(1500);
 for(let s=0;s<30;s++){const end=await ev(`(()=>{const el=document.querySelector('.reader-scroll');if(!el)return true;const b=el.scrollTop;el.scrollTop=b+800;return el.scrollTop===b})()`);await sleep(400);if(end)break;}
 const samples=[];
 for(let i=0;i<10;i++){
   await sleep(3000);
   samples.push(await ev(`(()=>{const imgs=[...document.querySelectorAll('.article-body img')];const res=performance.getEntriesByType('resource').filter(e=>/ctfassets|claude\.com/.test(e.name));return {ok:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,pending:imgs.filter(x=>!x.complete).length,failed:imgs.filter(x=>x.classList.contains('img-failed')).length,transferredKB:Math.round(res.reduce((a,e)=>a+(e.transferSize||0),0)/1024),entries:res.length,loading:imgs.filter(x=>!x.complete).slice(0,3).map(x=>({src:(x.currentSrc||x.src).slice(0,90),loading:x.loading}))}})()`));
 }
 console.log(JSON.stringify({title:TITLE,samples},null,2));ws.close();
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
