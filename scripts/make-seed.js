const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const src = path.join(process.env.TEMP, 'asba_probe', 'sync-data', 'asba.db');
const out = path.join(__dirname, '..', 'seed.db');
if (fs.existsSync(out)) fs.unlinkSync(out);
const db = new DatabaseSync(src);
db.exec(`VACUUM INTO '${out.replace(/\\/g, '/').replace(/'/g, "''")}'`);
db.close();
const stat = fs.statSync(out);
console.log('seed written', out, stat.size);
const check = new DatabaseSync(out, { readOnly: true });
console.log(check.prepare('select count(*) n from articles').get());
console.log(check.prepare('select count(*) n from translations').get());
check.close();
