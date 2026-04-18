import type {
  Extension,
  onLoadDocumentPayload,
  onStoreDocumentPayload,
  onConnectPayload,
} from '@hocuspocus/server';
import * as Y from 'yjs';
import { pool } from '../db/pool.js';

function parseDocId(documentName: string): string {
  return documentName.startsWith('document-')
    ? documentName.slice('document-'.length)
    : documentName;
}

export class PostgresExtension implements Extension {
  async onLoadDocument({ documentName, document }: onLoadDocumentPayload): Promise<void> {
    const docId = parseDocId(documentName);

    const result = await pool.query(
      `SELECT snapshot FROM document_version
       WHERE doc_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [docId],
    );

    if (result.rows.length > 0) {
      const snapshot = result.rows[0].snapshot as Buffer;
      Y.applyUpdate(document, new Uint8Array(snapshot));
      console.log(`[Postgres] Loaded document "${docId}" from snapshot.`);
    } else {
      console.log(`[Postgres] No snapshot found for "${docId}", starting fresh.`);
    }
  }

  async onStoreDocument({ documentName, document }: onStoreDocumentPayload): Promise<void> {
    const docId = parseDocId(documentName);
    const update = Y.encodeStateAsUpdate(document);
    const buffer = Buffer.from(update);

    await pool.query(
      `INSERT INTO document_version (doc_id, snapshot, created_at)
       VALUES ($1, $2, NOW())`,
      [docId, buffer],
    );

    await pool.query(
      `UPDATE document SET updated_at = NOW() WHERE id = $1`,
      [docId],
    );

    console.log(`[Postgres] Stored snapshot for "${docId}".`);
  }

  async onConnect({ documentName }: onConnectPayload): Promise<void> {
    const docId = parseDocId(documentName);

    await pool.query(
      `INSERT INTO document (id, title, created_at, updated_at)
       VALUES ($1, '未命名文档', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [docId],
    );
  }

}
