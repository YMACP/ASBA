const {DatabaseSync}=require('node:sqlite');
const p=process.argv[2]||`${process.env.APPDATA}\\ASBA\\data\\asba.db`;
const q=process.argv[3]||'4o';
const d=new DatabaseSync(p,{readOnly:true});
const rows=d.prepare('select id,title,url,length(content_html) as html from articles where title like ? order by id').all('%'+q+'%');
console.log(JSON.stringify(rows,null,2));d.close();
