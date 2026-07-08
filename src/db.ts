import mysql from 'mysql2/promise';
import { config } from './config.js';

export const db = mysql.createPool({
  uri: config.databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

export async function pingDatabase() {
  await db.query('SELECT 1');
}
