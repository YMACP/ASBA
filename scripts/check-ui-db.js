const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(path.join(process.env.TEMP, 'asba_probe', 'ui-data2', 'data', 'asba.db'), { readOnly: true });
console.log(db.prepare("select title, category, published_at from articles where title like 'Introducing GPT-5.5%' or title like 'Testing Claude%' limit 4").all());
console.log(db.prepare("select count(*) n from articles where category = ''").get());
console.log(db.prepare("select category, count(*) n from articles group by category order by n desc limit 5").all());
db.close();
