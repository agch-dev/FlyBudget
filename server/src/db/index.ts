import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? path.resolve(__dirname, '../../budget.db');

const dbOptions: ConstructorParameters<typeof Database>[1] = {};
if (process.env.DB_NATIVE_BINDING) {
  dbOptions.nativeBinding = process.env.DB_NATIVE_BINDING;
}

const sqlite = new Database(dbPath, dbOptions);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
