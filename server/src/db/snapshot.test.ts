import { readFileSync, readdirSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from './schema.js';

// Migrations here are written by hand, so nothing keeps drizzle-kit's snapshot of the schema
// up to date. `npm run db:generate` compares the schema with the latest snapshot: a table
// missing from it comes back as a CREATE TABLE that fails on every existing database.

const META = 'src/db/migrations/meta';

interface Snapshot {
  id: string;
  prevId: string;
  tables: Record<string, { columns: Record<string, unknown>; indexes: Record<string, unknown> }>;
}

const read = (file: string): Snapshot => JSON.parse(readFileSync(`${META}/${file}`, 'utf8'));
const files = readdirSync(META)
  .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
  .sort();
const latest = read(files[files.length - 1]);

const tables = (Object.values(schema) as unknown[])
  .filter((value): value is SQLiteTable => is(value, SQLiteTable))
  .map((table) => getTableConfig(table));

describe('the latest drizzle snapshot', () => {
  it('belongs to the latest migration and follows the snapshot before it', () => {
    const journal: { entries: { tag: string }[] } = JSON.parse(
      readFileSync(`${META}/_journal.json`, 'utf8'),
    );
    const lastTag = journal.entries[journal.entries.length - 1].tag;
    expect(files[files.length - 1]).toBe(`${lastTag.slice(0, 4)}_snapshot.json`);
    expect(latest.prevId).toBe(read(files[files.length - 2]).id);
  });

  it('records every table, column and index of the schema', () => {
    expect(tables.length).toBeGreaterThan(20);
    for (const table of tables) {
      const recorded = latest.tables[table.name];
      expect(recorded, `table ${table.name}`).toBeDefined();
      expect(Object.keys(recorded.columns), `columns of ${table.name}`).toEqual(
        expect.arrayContaining(table.columns.map((c) => c.name)),
      );
      expect(Object.keys(recorded.indexes), `indexes of ${table.name}`).toEqual(
        expect.arrayContaining(table.indexes.map((i) => i.config.name)),
      );
    }
  });

  it('records nothing else, except what the pending legacy cleanup leaves in place', () => {
    // CLAUDE.md, "Pending legacy cleanup": still in every database, no longer in the schema
    const names = tables.map((t) => t.name);
    expect(Object.keys(latest.tables).filter((name) => !names.includes(name))).toEqual([
      'recurring_transactions',
    ]);
    for (const table of tables) {
      const extra = Object.keys(latest.tables[table.name].columns).filter(
        (column) => !table.columns.some((c) => c.name === column),
      );
      expect(extra, `columns of ${table.name}`).toEqual(
        table.name === 'transactions' ? ['recurring_transaction_id'] : [],
      );
    }
  });
});
