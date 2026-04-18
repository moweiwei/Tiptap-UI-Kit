import 'dotenv/config';
import { runMigrations } from './db/migrate.js';
import { server } from './hocuspocus.js';

async function main(): Promise<void> {
  console.log('[Server] Running database migrations...');
  await runMigrations();

  await server.listen();

  const port = Number(process.env.HOCUSPOCUS_PORT) || 1234;
  console.log(`[Server] Hocuspocus collaboration server running on ws://0.0.0.0:${port}`);
}

main().catch((err) => {
  console.error('[Server] Fatal error during startup:', err);
  process.exit(1);
});
