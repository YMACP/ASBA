'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const file = path.join(__dirname, '..', 'seed.db');

if (!fs.existsSync(file)) {
  console.error('[clean-seed] seed.db not found');
  process.exit(1);
}

const db = new DatabaseSync(file);
try {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const before = {
    translations: db.prepare('SELECT COUNT(*) AS n FROM translations').get().n,
    cache: db.prepare('SELECT COUNT(*) AS n FROM translation_cache').get().n,
  };
  db.exec('BEGIN');
  db.exec('DELETE FROM translations');
  db.exec('DELETE FROM translation_cache');
  db.exec('UPDATE sites SET last_sync_at = NULL');
  db.exec('COMMIT');
  db.exec('VACUUM');

  const after = {
    translations: db.prepare('SELECT COUNT(*) AS n FROM translations').get().n,
    cache: db.prepare('SELECT COUNT(*) AS n FROM translation_cache').get().n,
    articles: db.prepare('SELECT COUNT(*) AS n FROM articles').get().n,
  };
  if (after.translations || after.cache) {
    console.error('[clean-seed] translation data remains', after);
    process.exit(1);
  }
  console.log(
    `[clean-seed] removed translations=${before.translations}, cache=${before.cache}; ` +
    `articles=${after.articles}, translations=0, cache=0`,
  );
} finally {
  db.close();
}
