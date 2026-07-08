import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './db.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Habitio API listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await db.end();
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
