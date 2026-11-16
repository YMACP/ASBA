const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const p=process.argv[2]||path.join(process.env.APPDATA,'ASBA','data','asba.db');
const d=new DatabaseSync(p,{readOnly:true});
const rows=d.prepare('select id,site_id,title,url,content_html from articles where content_html is not null').all().map(r=>({...r,count:(r.content_html.match(/<img\b/gi)||[]).length})).sort((a,b)=>b.count-a.count).slice(0,25).map(({id,site_id,title,url,count})=>({id,site_id,title,url,count}));
console.log(JSON.stringify(rows,null,2));d.close();
