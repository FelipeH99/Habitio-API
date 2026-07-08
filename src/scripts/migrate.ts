import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { RowDataPacket } from 'mysql2/promise';
import { db } from '../db.js';

const migrationsDir = path.join(process.cwd(), 'migrations');

type MigrationRow = RowDataPacket & {
  filename: string;
};

async function ensureMigrationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function appliedMigrationFilenames() {
  const [rows] = await db.query<MigrationRow[]>(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC'
  );

  return new Set(rows.map((row) => row.filename));
}

async function runMigration(filename: string) {
  const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const statement of statements) {
      await connection.query(statement);
    }

    await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
    await connection.commit();
    console.log(`Applied migration ${filename}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  await ensureMigrationsTable();

  const applied = await appliedMigrationFilenames();
  const filenames = (await readdir(migrationsDir))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  for (const filename of filenames) {
    if (!applied.has(filename)) {
      await runMigration(filename);
    }
  }

  console.log('Database migrations are up to date');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.end();
  });
