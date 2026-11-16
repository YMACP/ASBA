const http = require('node:http');
const PORT = Number(process.argv[2] || 9381);
const KEYWORD = process.argv[3] || 'An alignment assessment of recent cybersecurity incidents';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: p, timeout: 5000 }, (res) => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){reject(e)}});
    });
    req.on('error', reject); req.on('timeout',()=>req.destroy(new Error('timeout')));
  });
}
async function waitTarget() {
  const end = Date.now()+60000;
  while(Date.now()<end){ try { const a=await getJson('/json/list'); const t=a.find(x=>x.type==='page'&&x.webSocketDebuggerUrl); if(t)return t; }catch{} await sleep(300); }
  throw new Error('no CDP page');
}
async function main(){
 const target=await waitTarget(); const ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j)});
 let id=0; const pending=new Map(), events=[];
 ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method)events.push(m)});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 await send('Network.enable'); await send('Runtime.enable'); await send('Log.enable');
 const evalJs=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const kw=JSON.stringify(KEYWORD);
 let clicked=await evalJs(`(()=>{const e=[...document.querySelectorAll('.article-item')].find(x=>x.innerText.includes(${kw})); if(e)e.click(); return !!e})()`);
 if(!clicked){
   await evalJs(`(()=>{const i=document.querySelector('.search input');if(!i)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(i,${kw});i.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
   await sleep(1200);
   clicked=await evalJs(`(()=>{const e=[...document.querySelectorAll('.article-item')].find(x=>x.innerText.includes(${kw}));if(e)e.click();return !!e})()`);
 }
 if(!clicked) throw Error('article not found in list or search: '+KEYWORD);
 await sleep(12000);
 const initial=await evalJs(`(()=>({title:document.querySelector('.article-head h1')?.innerText,imgs:[...document.querySelectorAll('.article-body img')].map((i,n)=>({n,src:i.currentSrc||i.src,alt:i.alt,complete:i.complete,w:i.naturalWidth,h:i.naturalHeight,loading:i.loading,cls:i.className}))}))()`);
 const probe=await evalJs(`(async()=>{const imgs=[...document.querySelectorAll('.article-body img')];return await Promise.all(imgs.map((dom,n)=>new Promise(resolve=>{const p=new Image();let done=false;const finish=x=>{if(!done){done=true;resolve({n,src:dom.currentSrc||dom.src,alt:(dom.alt||'').slice(0,100),...x})}};p.onload=()=>finish({ok:true,w:p.naturalWidth,h:p.naturalHeight});p.onerror=()=>finish({ok:false,complete:p.complete});p.referrerPolicy='no-referrer';p.src=dom.currentSrc||dom.src;setTimeout(()=>finish({timeout:true,complete:p.complete,w:p.naturalWidth}),15000)})))})()`);
 const summarize=await evalJs(`(()=>{const a=[...document.querySelectorAll('.article-body img')];return {domCount:a.length,complete:a.filter(i=>i.complete).length,ok:a.filter(i=>i.complete&&i.naturalWidth>0).length,zero:a.filter(i=>i.complete&&i.naturalWidth===0).length,pending:a.filter(i=>!i.complete).length,first:a.slice(0,5).map((i,n)=>({n,src:i.currentSrc||i.src,complete:i.complete,w:i.naturalWidth,cls:i.className}))}})()`);
 const reqs=events.filter(e=>e.method==='Network.requestWillBeSent'&&e.params.type==='Image').map(e=>({id:e.params.requestId,url:e.params.request.url}));
 const resp=events.filter(e=>e.method==='Network.responseReceived'&&e.params.type==='Image').map(e=>({id:e.params.requestId,status:e.params.response.status,mime:e.params.response.mimeType,url:e.params.response.url}));
 const fails=events.filter(e=>e.method==='Network.loadingFailed').map(e=>({id:e.params.requestId,error:e.params.errorText,type:e.params.type,cancelled:e.params.canceled,blocked:e.params.blockedReason}));
 const logs=events.filter(e=>e.method==='Log.entryAdded').map(e=>({level:e.params.entry.level,text:String(e.params.entry.text).slice(0,300),source:e.params.entry.source}));
 console.log(JSON.stringify({keyword:KEYWORD,clicked,title:initial.title,counts:summarize,probe,requests:reqs.length,responses:resp.length,statuses:resp.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),failedUrls:fails,logs},null,2));
 ws.close();
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
