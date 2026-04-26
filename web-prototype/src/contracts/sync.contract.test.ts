import { beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@libsql/client';
import { getDb, resetDbSingleton } from '@/lib/server/db';
import { ensureDb, resetInitialized } from '@/lib/server/init';

describe('sync queue contract', () => {
  let db: Client;

  beforeEach(async () => {
    resetDbSingleton();
    resetInitialized();
    db = getDb(':memory:');
    await ensureDb(db);
  });

  it('writes queue items matching the offline-sync contract', async () => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const payload = JSON.stringify({id: 'txn-123'});

    await db.execute({
      sql: 'INSERT INTO sync_queue (id, entity, operation, payload, created_at, status, retry_count, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, 'transaction', 'create', payload, createdAt, 'pending', 0, ''],
    });

    const result = await db.execute({
      sql: 'SELECT * FROM sync_queue WHERE id = ?',
      args: [id],
    });

    expect(result.rows.length).toBe(1);
    const item = result.rows[0];
    expect(item.entity).toBe('transaction');
    expect(item.operation).toBe('create');
    expect(item.status).toBe('pending');
    expect(Number(item.retry_count)).toBe(0);
    expect(item.last_error).toBe('');
    expect(typeof item.id).toBe('string');
    expect(typeof item.created_at).toBe('string');
  });
});
