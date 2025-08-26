import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

async function ensureDb() {
  await fs.ensureDir(DATA_DIR);
  const exists = await fs.pathExists(DB_FILE);
  if (!exists) {
    const initial = { users: [] };
    await fs.writeJson(DB_FILE, initial, { spaces: 2 });
  }
}

export async function getDb() {
  await ensureDb();
  return fs.readJson(DB_FILE);
}

export async function saveDb(db) {
  await fs.writeJson(DB_FILE, db, { spaces: 2 });
}
