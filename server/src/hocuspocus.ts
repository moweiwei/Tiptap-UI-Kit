import { Server } from '@hocuspocus/server';
import { Redis } from '@hocuspocus/extension-redis';
import { PostgresExtension } from './extensions/postgres.js';

const port = Number(process.env.HOCUSPOCUS_PORT) || 1234;

const server = Server.configure({
  port,

  extensions: [
    new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    }),
    new PostgresExtension(),
  ],

  async onConnect({ documentName, requestParameters }) {
    const userId = requestParameters.get('userId') ?? 'anonymous';
    console.log(`[Hocuspocus] User "${userId}" connected to "${documentName}".`);
  },

  async onDisconnect({ documentName }) {
    console.log(`[Hocuspocus] Client disconnected from "${documentName}".`);
  },
});

export { server };
