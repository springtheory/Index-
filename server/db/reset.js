const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'index.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Database deleted. It will be recreated on next server start.');
} else {
  console.log('No database file found.');
}
